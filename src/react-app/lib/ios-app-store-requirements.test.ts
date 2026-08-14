import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('iOS App Store delivery requirements', () => {
  it('sets MinimumOSVersion via IPHONEOS_DEPLOYMENT_TARGET 15.0', () => {
    const pbx = readFileSync(resolve(root, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
    const podfile = readFileSync(resolve(root, 'ios/App/Podfile'), 'utf8');
    const podspec = readFileSync(
      resolve(root, 'packages/native-audio-capture/FeedbackNativeAudioCapture.podspec'),
      'utf8',
    );

    expect(pbx).not.toMatch(/IPHONEOS_DEPLOYMENT_TARGET = 14\.0/);
    expect(pbx).toMatch(/IPHONEOS_DEPLOYMENT_TARGET = 15\.0/);
    expect(podfile).toContain("platform :ios, '15.0'");
    expect(podspec).toContain("s.ios.deployment_target = '15.0'");
  });

  it('declares NSLocationAlwaysAndWhenInUseUsageDescription', () => {
    const plist = readFileSync(resolve(root, 'ios/App/App/Info.plist'), 'utf8');
    const capConfig = readFileSync(resolve(root, 'capacitor.config.ts'), 'utf8');

    expect(plist).toContain('NSLocationAlwaysAndWhenInUseUsageDescription');
    expect(plist).toContain('NSLocationWhenInUseUsageDescription');
    expect(capConfig).toContain('NSLocationAlwaysAndWhenInUseUsageDescription');
  });
});
