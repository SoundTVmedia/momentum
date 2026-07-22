import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/src/lib/auth/AuthContext';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string }>();
  const { signInWithGoogle, signInWithApple, appleAvailable, user, isLoading } =
    useAuth();
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(
    typeof params.error === 'string' ? params.error : null,
  );

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/profile');
    }
  }, [isLoading, user, router]);

  const run = async (provider: 'google' | 'apple') => {
    setError(null);
    setBusy(provider);
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithApple();
      }
      router.replace('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: 'Sign in' }} />
      <View style={styles.container}>
        <Text style={styles.brand}>Feedback</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, styles.google]}
          disabled={busy != null}
          onPress={() => void run('google')}
        >
          {busy === 'google' ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.googleLabel}>Continue with Google</Text>
          )}
        </Pressable>

        {appleAvailable ? (
          <Pressable
            style={[styles.button, styles.apple]}
            disabled={busy != null}
            onPress={() => void run('apple')}
          >
            {busy === 'apple' ? (
              <ActivityIndicator color={colors.textBody} />
            ) : (
              <Text style={styles.appleLabel}>Continue with Apple</Text>
            )}
          </Pressable>
        ) : null}

        <Text style={styles.note}>
          Sessions use Worker cookies when available, with a SecureStore bearer
          fallback for iOS. Google Sign-In needs a development build (not Expo Go).
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.shellBg,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  brand: {
    ...typography.brand,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  google: {
    backgroundColor: colors.textBody,
  },
  googleLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  apple: {
    backgroundColor: colors.glassBgStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  appleLabel: {
    color: colors.textBody,
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    ...typography.caption,
    marginTop: spacing.lg,
    lineHeight: 18,
  },
});
