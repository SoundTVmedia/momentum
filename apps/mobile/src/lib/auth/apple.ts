import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

export type AppleNativeCredentials = {
  identityToken: string;
  authorizationCode?: string | null;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  user?: string | null;
};

export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithAppleCredentials(): Promise<AppleNativeCredentials> {
  if (Platform.OS !== 'ios') {
    throw new Error('Sign in with Apple is only available on iOS.');
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error('Sign in with Apple is not available on this device.');
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  return {
    identityToken: credential.identityToken,
    authorizationCode: credential.authorizationCode,
    email: credential.email,
    givenName: credential.fullName?.givenName ?? null,
    familyName: credential.fullName?.familyName ?? null,
    user: credential.user,
  };
}

export function appleSignInErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'ERR_REQUEST_CANCELED'
  ) {
    return 'Apple sign-in was cancelled.';
  }
  return error instanceof Error ? error.message : 'Apple sign-in failed.';
}
