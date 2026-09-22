import { WebPlugin } from '@capacitor/core';
import type { AppBuildConfigPlugin, GoogleSignInBuildConfig } from './definitions';

export class AppBuildConfigWeb extends WebPlugin implements AppBuildConfigPlugin {
  async getGoogleSignInConfig(): Promise<GoogleSignInBuildConfig> {
    return { iosClientId: null, urlScheme: null, urlSchemeRegistered: false };
  }
}
