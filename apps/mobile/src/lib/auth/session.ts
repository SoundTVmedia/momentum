import type { MochaUser } from '@shared/mocha-user';
import { setBearerSession } from '@/src/lib/api/bearer-session';
import { apiJson, clearApiSession } from '@/src/lib/api/client';

export type AuthUser = MochaUser & {
  authenticated: true;
  profile: {
    id: number;
    mocha_user_id: string;
    display_name: string | null;
    bio: string | null;
    location: string | null;
    profile_image_url: string | null;
    cover_image_url: string | null;
    city: string | null;
    is_verified?: number;
    is_premium?: number;
    favorite_artists?: string | null;
    [key: string]: unknown;
  } | null;
};

export type NativeAuthSuccess = {
  success: true;
  provider: 'google' | 'apple' | 'email' | 'mocha';
  sessionToken?: string;
  sessionType?: 'google' | 'apple' | 'email' | 'mocha';
};

async function persistNativeSession(result: NativeAuthSuccess): Promise<void> {
  if (result.sessionToken && result.sessionType) {
    await setBearerSession({
      token: result.sessionToken,
      sessionType: result.sessionType,
    });
  }
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const user = await apiJson<AuthUser | null>('/api/users/me');
  if (!user || typeof user !== 'object' || !('id' in user)) {
    return null;
  }
  return user;
}

export async function exchangeGoogleIdToken(idToken: string): Promise<NativeAuthSuccess> {
  const result = await apiJson<NativeAuthSuccess>('/api/auth/google/native', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  await persistNativeSession(result);
  return result;
}

export async function exchangeAppleIdentityToken(input: {
  identityToken: string;
  authorizationCode?: string | null;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  user?: string | null;
}): Promise<NativeAuthSuccess> {
  const result = await apiJson<NativeAuthSuccess>('/api/auth/apple/native', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  await persistNativeSession(result);
  return result;
}

export async function logoutSession(): Promise<void> {
  try {
    await apiJson('/api/logout');
  } catch {
    // Always clear local jar even if network fails.
  }
  await clearApiSession();
}
