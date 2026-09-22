import { describe, expect, it } from 'vitest';
import {
  downloadLooksComplete,
  isIosClientFromHints,
  nativeVideoFileUrlForGallery,
} from './native-bridge';

describe('nativeVideoFileUrlForGallery', () => {
  it('passes file:// URLs through unchanged (Capgo + Filesystem output)', () => {
    const capgo = 'file:///private/var/mobile/Containers/Data/Application/ABC/Documents/clip.mp4';
    expect(nativeVideoFileUrlForGallery(capgo)).toBe(capgo);
    expect(nativeVideoFileUrlForGallery(`  ${capgo}  `)).toBe(capgo);
  });

  it('maps a plain outbox path to a percent-encoded file URL', () => {
    // BackgroundUpload.persistVideoFile returns dest.path, and Application Support has a space.
    const plain =
      '/var/mobile/Containers/Data/Application/ABC/Library/Application Support/upload-outbox/clip_1.mp4';
    expect(nativeVideoFileUrlForGallery(plain)).toBe(
      'file:///var/mobile/Containers/Data/Application/ABC/Library/Application%20Support/upload-outbox/clip_1.mp4',
    );
  });

  it('unwraps WebView-served _capacitor_file_ URLs instead of handing them to Photos', () => {
    // Media.saveVideo force-unwraps Data(contentsOf:) for non-file URLs — a capacitor:// URL crashes.
    expect(
      nativeVideoFileUrlForGallery(
        'capacitor://localhost/_capacitor_file_/private/var/tmp/momentum/clips/a.mp4',
      ),
    ).toBe('file:///private/var/tmp/momentum/clips/a.mp4');
    expect(
      nativeVideoFileUrlForGallery(
        'https://example.workers.dev/_capacitor_file_/var/mobile/x/clip.mov',
      ),
    ).toBe('file:///var/mobile/x/clip.mov');
  });

  it('refuses locations that are not local files', () => {
    expect(nativeVideoFileUrlForGallery('')).toBeNull();
    expect(nativeVideoFileUrlForGallery('https://videodelivery.net/abc/downloads/default.mp4')).toBeNull();
    expect(nativeVideoFileUrlForGallery('blob:https://app/123')).toBeNull();
    expect(nativeVideoFileUrlForGallery('relative/clip.mp4')).toBeNull();
  });
});

describe('downloadLooksComplete', () => {
  it('rejects an error body parked in the identify cache', () => {
    // A 404 HTML page or JSON error is a few KB and would be handed to
    // AVFoundation as a "clip", failing identify forever for that clip.
    expect(downloadLooksComplete(1_200, null)).toBe(false);
    expect(downloadLooksComplete(1_200, 44_182_449)).toBe(false);
  });

  it('rejects a truncated download against the known content length', () => {
    expect(downloadLooksComplete(20_000_000, 44_182_449)).toBe(false);
  });

  it('accepts a complete download', () => {
    expect(downloadLooksComplete(44_182_449, 44_182_449)).toBe(true);
  });

  it('tolerates a small overshoot or short read within 2%', () => {
    expect(downloadLooksComplete(43_900_000, 44_182_449)).toBe(true);
    expect(downloadLooksComplete(44_200_000, 44_182_449)).toBe(true);
  });

  it('accepts a plausible size when the server sent no content-length', () => {
    expect(downloadLooksComplete(5_000_000, null)).toBe(true);
  });
});

describe('isIosClientFromHints', () => {
  it('is true for the native iOS Capacitor shell', () => {
    expect(isIosClientFromHints({ capacitorPlatform: 'ios' })).toBe(true);
  });

  it('is true for iPhone Safari', () => {
    expect(
      isIosClientFromHints({
        capacitorPlatform: 'web',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      }),
    ).toBe(true);
  });

  it('is false on desktop web', () => {
    expect(
      isIosClientFromHints({
        capacitorPlatform: 'web',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        navigatorPlatform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });
});
