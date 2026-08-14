import { WebPlugin } from '@capacitor/core';
import type { ShazamKitMatchPayload, ShazamKitPlugin } from './definitions';

export class ShazamKitWeb extends WebPlugin implements ShazamKitPlugin {
  async isSupported(): Promise<{ supported: boolean }> {
    return { supported: false };
  }

  async recognizeAudio(): Promise<{ match: ShazamKitMatchPayload | null }> {
    throw this.unavailable('ShazamKit is only available on native iOS.');
  }

  async recognizeFile(): Promise<{ match: ShazamKitMatchPayload | null }> {
    throw this.unavailable('ShazamKit is only available on native iOS.');
  }
}
