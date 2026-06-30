const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const JWKS_CACHE_MS = 60 * 60 * 1000;

type JwtHeader = { alg?: string; kid?: string };
type AppleJwk = JsonWebKey & { kid?: string; kty?: string };
type AppleJwksResponse = { keys: AppleJwk[] };

let jwksCache: { keys: AppleJwksResponse; fetchedAt: number } | null = null;

function base64UrlEncode(input: string | Buffer | Uint8Array): string {
  const buf =
    typeof input === 'string'
      ? Buffer.from(input, 'utf8')
      : Buffer.isBuffer(input)
        ? input
        : Buffer.from(input);
  return buf.toString('base64url');
}

function base64UrlDecodeJson<T>(part: string): T {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;
}

function normalizeApplePrivateKey(pem: string): string {
  return pem.replace(/\\n/g, '\n').trim();
}

function pemToPkcs8Der(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const bytes = Buffer.from(b64, 'base64');
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function importApplePrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8Der(pem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

async function importAppleVerificationKey(jwk: AppleJwk, alg: string): Promise<CryptoKey> {
  if (alg === 'RS256' || jwk.kty === 'RSA') {
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  }
  if (alg === 'ES256' || jwk.kty === 'EC') {
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
  }
  throw new Error(`Unsupported Apple JWT algorithm: ${alg}`);
}

function audienceMatchesClaim(aud: unknown, expectedAudience: string): boolean {
  if (typeof aud === 'string') {
    return aud === expectedAudience;
  }
  if (Array.isArray(aud)) {
    return aud.some((value) => typeof value === 'string' && value === expectedAudience);
  }
  return false;
}

/** Apple OAuth client secret — ES256 JWT signed with the .p8 key (valid up to 6 months). */
export async function createAppleClientSecret(env: Env): Promise<string> {
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

  const key = await importApplePrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
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
  const alg = header.alg?.trim();
  if (!alg || !header.kid) {
    throw new Error('Unsupported Apple JWT header');
  }
  if (alg !== 'RS256' && alg !== 'ES256') {
    throw new Error(`Unsupported Apple JWT algorithm: ${alg}`);
  }

  const jwks = await fetchAppleJwks();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    throw new Error('Apple JWKS key not found');
  }

  const key = await importAppleVerificationKey(jwk, alg);
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = Buffer.from(signatureB64, 'base64url');
  const valid = await crypto.subtle.verify(
    alg === 'RS256'
      ? { name: 'RSASSA-PKCS1-v1_5' }
      : { name: 'ECDSA', hash: 'SHA-256' },
    key,
    signature,
    new TextEncoder().encode(signingInput),
  );
  if (!valid) {
    throw new Error('Invalid Apple JWT signature');
  }

  const payload = base64UrlDecodeJson<Record<string, unknown>>(payloadB64);
  if (payload.iss !== APPLE_ISSUER) {
    throw new Error('Invalid Apple JWT issuer');
  }
  if (!audienceMatchesClaim(payload.aud, expectedAudience)) {
    throw new Error('Invalid Apple JWT audience');
  }
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  if (exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Apple JWT expired');
  }

  return payload;
}
