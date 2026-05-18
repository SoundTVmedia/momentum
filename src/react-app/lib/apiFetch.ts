/**
 * Authenticated API requests (session cookies). Use for all `/api/*` calls.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? 'include',
  });
}

/** User-facing message when `fetch` fails before a response (worker down, proxy, offline). */
export function apiFetchErrorMessage(err: unknown, fallback = 'Request failed'): string {
  if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
    return 'Cannot reach the API. If you are developing locally, run `npm run dev` (it starts the worker on macOS) or run `npm run dev:api` in another terminal while Vite is running.';
  }
  return err instanceof Error ? err.message : fallback;
}
