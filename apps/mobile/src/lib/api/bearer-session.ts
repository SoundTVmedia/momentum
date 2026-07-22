import * as SecureStore from 'expo-secure-store';

const BEARER_STORE_KEY = 'feedback.rn.bearer_session.v1';

export type BearerSession = {
  token: string;
  sessionType: 'google' | 'apple' | 'email' | 'mocha';
};

export async function getBearerSession(): Promise<BearerSession | null> {
  const raw = await SecureStore.getItemAsync(BEARER_STORE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BearerSession;
    if (
      typeof parsed?.token === 'string' &&
      parsed.token.length > 0 &&
      typeof parsed.sessionType === 'string'
    ) {
      return parsed;
    }
  } catch {
    /* corrupt */
  }
  return null;
}

export async function setBearerSession(session: BearerSession): Promise<void> {
  await SecureStore.setItemAsync(BEARER_STORE_KEY, JSON.stringify(session));
}

export async function clearBearerSession(): Promise<void> {
  await SecureStore.deleteItemAsync(BEARER_STORE_KEY);
}
