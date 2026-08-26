import { Capacitor } from '@capacitor/core';
import { isPlatform, setupIonicReact } from '@ionic/react';

/** Capacitor + Ionic: iOS chrome on Apple, Material on Android, iOS on web. */
export function bootstrapIonic() {
  const nativeAndroid =
    Capacitor.getPlatform() === 'android' || isPlatform('android');
  setupIonicReact({
    mode: nativeAndroid ? 'md' : 'ios',
    animated: true,
  });
}
