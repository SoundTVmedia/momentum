import * as Linking from 'expo-linking';
import { RN_BUNDLE_ID } from '@/src/config/env';

/** Deep link: com.feedbacklive.app.rn://auth/callback?... */
export const RN_OAUTH_CALLBACK_PATH = '/auth/callback';

export function buildRnOAuthCallbackUrl(queryString = ''): string {
  const qs = queryString.replace(/^\?/, '');
  const base = `${RN_BUNDLE_ID}://${RN_OAUTH_CALLBACK_PATH.replace(/^\//, '')}`;
  return qs ? `${base}?${qs}` : base;
}

export function isRnOAuthCallbackUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.startsWith(`${RN_BUNDLE_ID}://auth/callback`) ||
    trimmed.startsWith(`${Linking.createURL(RN_OAUTH_CALLBACK_PATH)}`)
  );
}

export function parseOAuthCallbackParams(url: string): {
  code: string | null;
  error: string | null;
  state: string | null;
} {
  try {
    const parsed = Linking.parse(url);
    const query = parsed.queryParams ?? {};
    const code = typeof query.code === 'string' ? query.code : null;
    const error = typeof query.error === 'string' ? query.error : null;
    const state = typeof query.state === 'string' ? query.state : null;
    return { code, error, state };
  } catch {
    return { code: null, error: null, state: null };
  }
}
