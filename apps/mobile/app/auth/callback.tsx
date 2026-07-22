import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { apiJson } from '@/src/lib/api/client';
import { useAuth } from '@/src/lib/auth/AuthContext';
import { colors, spacing, typography } from '@/src/theme/tokens';

/**
 * Browser-fallback OAuth completion for RN scheme deep links.
 * Preferred path is native Google/Apple ID tokens on /auth.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const [message, setMessage] = useState('Completing sign-in…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (params.error) {
        router.replace({ pathname: '/auth', params: { error: String(params.error) } });
        return;
      }
      const code = typeof params.code === 'string' ? params.code : '';
      if (!code) {
        setMessage('Missing OAuth code.');
        return;
      }
      try {
        await apiJson('/api/sessions', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
        await refresh();
        if (!cancelled) router.replace('/');
      } catch (error) {
        if (!cancelled) {
          const msg = error instanceof Error ? error.message : 'Sign-in failed.';
          router.replace({ pathname: '/auth', params: { error: msg } });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.code, params.error, refresh, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: 'Signing in' }} />
      <View style={styles.container}>
        <ActivityIndicator color={colors.ember} />
        <Text style={styles.message}>{message}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  message: {
    ...typography.body,
  },
});
