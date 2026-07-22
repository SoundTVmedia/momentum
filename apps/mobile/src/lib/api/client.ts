import { API_BASE_URL } from '@/src/config/env';
import {
  clearBearerSession,
  getBearerSession,
} from '@/src/lib/api/bearer-session';
import {
  clearCookieJar,
  getCookieHeaderForUrl,
  ingestSetCookieHeaders,
} from '@/src/lib/api/cookie-jar';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function resolveUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${API_BASE_URL}${path}`;
}

/**
 * Authenticated API requests against the Worker.
 * Cookie jar when Set-Cookie is visible; Authorization Bearer fallback for iOS RN.
 */
export async function apiFetch(
  pathOrUrl: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = resolveUrl(pathOrUrl);
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const cookie = await getCookieHeaderForUrl(url);
  if (cookie) {
    headers.set('Cookie', cookie);
  }

  if (!headers.has('Authorization')) {
    const bearer = await getBearerSession();
    if (bearer?.token) {
      headers.set('Authorization', `Bearer ${bearer.token}`);
    }
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  await ingestSetCookieHeaders(url, response.headers);
  return response;
}

export async function apiJson<T>(
  pathOrUrl: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await apiFetch(pathOrUrl, { ...init, headers });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, body);
  }

  return body as T;
}

export async function clearApiSession(): Promise<void> {
  await Promise.all([clearCookieJar(), clearBearerSession()]);
}
