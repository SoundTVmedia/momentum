import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  exchangeAppleIdentityToken,
  exchangeGoogleIdToken,
  fetchCurrentUser,
  logoutSession,
  type AuthUser,
} from '@/src/lib/auth/session';
import {
  appleSignInErrorMessage,
  isAppleAuthAvailable,
  signInWithAppleCredentials,
} from '@/src/lib/auth/apple';
import {
  googleSignInErrorMessage,
  signInWithGoogleIdToken,
} from '@/src/lib/auth/google';

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  appleAvailable: boolean;
  refresh: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const refresh = useCallback(async () => {
    const next = await fetchCurrentUser();
    setUser(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [next, apple] = await Promise.all([
          fetchCurrentUser(),
          isAppleAuthAvailable(),
        ]);
        if (!cancelled) {
          setUser(next);
          setAppleAvailable(apple);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const idToken = await signInWithGoogleIdToken();
      await exchangeGoogleIdToken(idToken);
      await refresh();
      const next = await fetchCurrentUser();
      if (!next) {
        throw new Error(
          'Signed in with Google, but the session did not stick. Try again.',
        );
      }
      setUser(next);
    } catch (error) {
      throw new Error(googleSignInErrorMessage(error));
    }
  }, [refresh]);

  const signInWithApple = useCallback(async () => {
    try {
      const credentials = await signInWithAppleCredentials();
      await exchangeAppleIdentityToken(credentials);
      await refresh();
      const next = await fetchCurrentUser();
      if (!next) {
        throw new Error(
          'Signed in with Apple, but the session did not stick. Try again.',
        );
      }
      setUser(next);
    } catch (error) {
      throw new Error(appleSignInErrorMessage(error));
    }
  }, [refresh]);

  const signOut = useCallback(async () => {
    await logoutSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      appleAvailable,
      refresh,
      signInWithGoogle,
      signInWithApple,
      signOut,
    }),
    [
      user,
      isLoading,
      appleAvailable,
      refresh,
      signInWithGoogle,
      signInWithApple,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
