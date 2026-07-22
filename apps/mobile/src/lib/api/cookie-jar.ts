import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '@/src/config/env';

const COOKIE_STORE_KEY = 'feedback.rn.cookie_jar.v1';

export type StoredCookie = {
  name: string;
  value: string;
  expiresAt?: number | null;
};

type CookieJarState = {
  host: string;
  cookies: Record<string, StoredCookie>;
};

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return new URL(API_BASE_URL).host;
  }
}

function parseSetCookieHeader(header: string): StoredCookie | null {
  const segments = header.split(';').map((part) => part.trim());
  const [nameValue, ...attrs] = segments;
  if (!nameValue) return null;
  const eq = nameValue.indexOf('=');
  if (eq <= 0) return null;
  const name = nameValue.slice(0, eq).trim();
  const value = nameValue.slice(eq + 1).trim();
  if (!name) return null;

  let expiresAt: number | null = null;
  for (const attr of attrs) {
    const lower = attr.toLowerCase();
    if (lower.startsWith('max-age=')) {
      const seconds = Number(attr.slice('max-age='.length));
      if (Number.isFinite(seconds) && seconds >= 0) {
        expiresAt = Date.now() + seconds * 1000;
      }
    } else if (lower.startsWith('expires=')) {
      const parsed = Date.parse(attr.slice('expires='.length));
      if (Number.isFinite(parsed)) {
        expiresAt = parsed;
      }
    }
  }

  return { name, value, expiresAt };
}

/**
 * RN fetch may join multiple Set-Cookie values with commas; split carefully.
 * Note: some iOS RN builds hide Set-Cookie from JS; native URLSession may still
 * persist host cookies. SecureStore jar covers the explicit header path.
 */
function splitSetCookieHeaders(raw: string | null): string[] {
  if (!raw) return [];
  // Prefer getSetCookie when available (undici / newer runtimes).
  return raw.split(/,(?=\s*[^;=]+=[^;]+)/).map((part) => part.trim()).filter(Boolean);
}

async function readJar(): Promise<CookieJarState> {
  const host = hostFromUrl(API_BASE_URL);
  const raw = await SecureStore.getItemAsync(COOKIE_STORE_KEY);
  if (!raw) {
    return { host, cookies: {} };
  }
  try {
    const parsed = JSON.parse(raw) as CookieJarState;
    if (parsed.host !== host) {
      return { host, cookies: {} };
    }
    return { host, cookies: parsed.cookies ?? {} };
  } catch {
    return { host, cookies: {} };
  }
}

async function writeJar(state: CookieJarState): Promise<void> {
  await SecureStore.setItemAsync(COOKIE_STORE_KEY, JSON.stringify(state));
}

function pruneExpired(cookies: Record<string, StoredCookie>): Record<string, StoredCookie> {
  const now = Date.now();
  const next: Record<string, StoredCookie> = {};
  for (const [name, cookie] of Object.entries(cookies)) {
    if (cookie.expiresAt != null && cookie.expiresAt <= now) continue;
    if (!cookie.value) continue;
    next[name] = cookie;
  }
  return next;
}

export async function clearCookieJar(): Promise<void> {
  await SecureStore.deleteItemAsync(COOKIE_STORE_KEY);
}

export async function getCookieHeaderForUrl(url: string): Promise<string | null> {
  const jar = await readJar();
  if (hostFromUrl(url) !== jar.host) return null;
  const cookies = pruneExpired(jar.cookies);
  const pairs = Object.values(cookies).map((c) => `${c.name}=${c.value}`);
  return pairs.length > 0 ? pairs.join('; ') : null;
}

export async function ingestSetCookieHeaders(
  url: string,
  headers: Headers,
): Promise<void> {
  const host = hostFromUrl(url);
  const jar = await readJar();
  const cookies = host === jar.host ? { ...jar.cookies } : {};

  const setCookies =
    typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie ===
    'function'
      ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : splitSetCookieHeaders(headers.get('set-cookie'));

  if (setCookies.length === 0) return;

  for (const header of setCookies) {
    const parsed = parseSetCookieHeader(header);
    if (!parsed) continue;
    if (!parsed.value || parsed.expiresAt === 0) {
      delete cookies[parsed.name];
      continue;
    }
    cookies[parsed.name] = parsed;
  }

  await writeJar({ host, cookies: pruneExpired(cookies) });
}

export async function hasSessionCookie(): Promise<boolean> {
  const header = await getCookieHeaderForUrl(API_BASE_URL);
  if (!header) return false;
  return /momentum_(google|apple|email)_session|mocha_session_token/i.test(header);
}
