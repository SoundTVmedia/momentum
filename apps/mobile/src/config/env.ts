import Constants from 'expo-constants';

type MobileExtra = {
  apiBaseUrl?: string;
  googleIosClientId?: string;
  googleIosUrlScheme?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as MobileExtra;

/** Worker origin used by the RN app. Override via app.json `extra.apiBaseUrl` or EXPO_PUBLIC_API_BASE_URL. */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
  extra.apiBaseUrl?.trim() ||
  'https://019aa38d-a318-7dee-9fdf-30039470c120.wes-6f3.workers.dev'
).replace(/\/$/, '');

/** RN migration bundle ID — never reuse production Capacitor ID until cutover. */
export const RN_BUNDLE_ID = 'com.feedbacklive.app.rn';

export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ||
  extra.googleIosClientId?.trim() ||
  '254629847229-1ge9jdqj2l6j09n7o67pump5pfo8giki.apps.googleusercontent.com';

export const GOOGLE_IOS_URL_SCHEME =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim() ||
  extra.googleIosUrlScheme?.trim() ||
  'com.googleusercontent.apps.254629847229-1ge9jdqj2l6j09n7o67pump5pfo8giki';
