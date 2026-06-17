/**
 * Native bridge for Capacitor — background upload, gallery save, push registration.
 * Web falls back to IndexedDB outbox (ClipUploadQueueContext).
 * Install @capacitor/* packages and run `npx cap sync` for native builds.
 */

export type NativePlatform = 'web' | 'ios' | 'android';

type CapacitorWindow = Window & {
  Capacitor?: {
    getPlatform?: () => string;
    Plugins?: Record<string, {
      requestPermissions?: () => Promise<{ receive: string }>;
      register?: () => Promise<void>;
      saveVideo?: (opts: { path: string }) => Promise<void>;
    }>;
  };
  MomentumUploadBridge?: { schedule?: (id: string) => void };
};

export function getNativePlatform(): NativePlatform {
  if (typeof window === 'undefined') return 'web';
  const p = (window as CapacitorWindow).Capacitor?.getPlatform?.();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}

export function isNativeApp(): boolean {
  return getNativePlatform() !== 'web';
}

export async function registerNativePush(): Promise<void> {
  if (!isNativeApp()) return;
  const push = (window as CapacitorWindow).Capacitor?.Plugins?.PushNotifications;
  if (!push?.requestPermissions || !push.register) return;
  try {
    const perm = await push.requestPermissions();
    if (perm.receive !== 'granted') return;
    await push.register();
  } catch (err) {
    console.warn('registerNativePush:', err);
  }
}

export async function saveVideoToGallery(filePath: string): Promise<void> {
  if (!isNativeApp()) return;
  const media = (window as CapacitorWindow).Capacitor?.Plugins?.Media;
  if (!media?.saveVideo) return;
  try {
    await media.saveVideo({ path: filePath });
  } catch (err) {
    console.warn('saveVideoToGallery:', err);
  }
}

export function scheduleNativeBackgroundUpload(jobId: string): void {
  if (!isNativeApp()) return;
  (window as CapacitorWindow).MomentumUploadBridge?.schedule?.(jobId);
}
