import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { isRnOAuthCallbackUrl, parseOAuthCallbackParams } from '@/src/lib/linking';
import { useAuth } from '@/src/lib/auth/AuthContext';
import { registerNativePush } from '@/src/lib/push';
import { readCaptureHandoff } from '@/src/lib/upload/outbox';

/** Deep links, push register, pending capture recovery. */
export function PlatformBootstrap() {
  const router = useRouter();
  const { refresh } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await registerNativePush();
      } catch {
        /* best-effort */
      }
      try {
        const pending = await readCaptureHandoff();
        if (!cancelled && pending) {
          router.push('/upload');
        }
      } catch {
        /* ignore */
      }
    })();

    const handleUrl = async (url: string | null) => {
      if (!url || cancelled) return;
      if (!isRnOAuthCallbackUrl(url)) return;
      const { code, error } = parseOAuthCallbackParams(url);
      if (error) {
        router.push({ pathname: '/auth', params: { error } });
        return;
      }
      if (code) {
        router.push({ pathname: '/auth/callback', params: { code } });
        return;
      }
      await refresh();
    };

    Linking.getInitialURL().then(handleUrl).catch(() => undefined);
    const sub = Linking.addEventListener('url', (event) => {
      void handleUrl(event.url);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [refresh, router]);

  return null;
}
