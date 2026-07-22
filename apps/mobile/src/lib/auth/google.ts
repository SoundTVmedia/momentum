import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_IOS_CLIENT_ID } from '@/src/config/env';

let configured = false;

export function configureGoogleSignIn(): void {
  if (configured) return;
  GoogleSignin.configure({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

export async function signInWithGoogleIdToken(): Promise<string> {
  if (Platform.OS !== 'ios') {
    throw new Error('Google Sign-In is only wired for iOS in Phase 2.');
  }

  configureGoogleSignIn();

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    throw new Error('Google sign-in was cancelled.');
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error('Google did not return an ID token.');
  }
  return idToken;
}

export function googleSignInErrorMessage(error: unknown): string {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return 'Google sign-in was cancelled.';
      case statusCodes.IN_PROGRESS:
        return 'Google sign-in is already in progress.';
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Google Play Services unavailable.';
      default:
        break;
    }
  }
  if (error instanceof Error && /Native module|Expo Go|RNGoogleSignin/i.test(error.message)) {
    return 'Google Sign-In needs a development build (not Expo Go). Run a prebuild/dev client for com.feedbacklive.app.rn.';
  }
  return error instanceof Error ? error.message : 'Google sign-in failed.';
}
