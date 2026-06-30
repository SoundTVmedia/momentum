import { createPrivateKey, createPublicKey, createSign, verify } from 'node:crypto';
import type { JsonWebKey } from 'node:crypto';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const JWKS_CACHE_MS = 60 * 60 * 1000;

type JwtHeader = { alg?: string; kid?: string };
type AppleJwk = JsonWebKey & { kid?: string };
type AppleJwksResponse = { keys: AppleJwk[] };

let jwksCache: { keys: AppleJwksResponse; fetchedAt: number } | null = null;

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function base64UrlDecodeJson<T>(part: string): T {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;
}

function normalizeApplePrivateKey(pem: string): string {
  return pem.replace(/\\n/g, '\n').trim();
}

/** Apple OAuth client secret — ES256 JWT signed with the .p8 key (valid up to 6 months). */
export function createAppleClientSecret(env: Env): string {
  const teamId = env.APPLE_TEAM_ID?.trim();
  const keyId = env.APPLE_KEY_ID?.trim();
  const clientId = env.APPLE_SERVICES_ID?.trim();
  const privateKeyPem = normalizeApplePrivateKey(env.APPLE_PRIVATE_KEY ?? '');

  if (!teamId || !keyId || !clientId || !privateKeyPem) {
    throw new Error('Apple Sign In is not fully configured on the server.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 60 * 60 * 24 * 150,
    aud: APPLE_ISSUER,
    sub: clientId,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = createPrivateKey(privateKeyPem);
  const signer = createSign('SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({ key, dsaEncoding: 'ieee-p1363' });

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function fetchAppleJwks(): Promise<AppleJwksResponse> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(APPLE_JWKS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Apple JWKS (${res.status})`);
  }
  const keys = (await res.json()) as AppleJwksResponse;
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

export async function verifyAppleJwt(
  token: string,
  expectedAudience: string,
): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid Apple JWT format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = base64UrlDecodeJson<JwtHeader>(headerB64);
  if (header.alg !== 'ES256' || !header.kid) {
    throw new Error('Unsupported Apple JWT header');
  }

  const jwks = await fetchAppleJwks();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    throw new Error('Apple JWKS key not found');
  }

  const key = createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' });
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = Buffer.from(signatureB64, 'base64url');
  const valid = verify(
    'sha256',
    Buffer.from(signingInput, 'utf8'),
    { key, dsaEncoding: 'ieee-p1363' },
    signature,
  );
  if (!valid) {
    throw new Error('Invalid Apple JWT signature');
  }

  const payload = base64UrlDecodeJson<Record<string, unknown>>(payloadB64);
  if (payload.iss !== APPLE_ISSUER) {
    throw new Error('Invalid Apple JWT issuer');
  }
  if (payload.aud !== expectedAudience) {
    throw new Error('Invalid Apple JWT audience');
  }
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  if (exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Apple JWT expired');
  }

  return payload;
}
