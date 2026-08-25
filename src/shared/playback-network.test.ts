import { describe, expect, it } from 'vitest';
import { shouldPrefetchFullClip } from './playback-network';

describe('shouldPrefetchFullClip', () => {
  it('never full-prefetches when the user enabled data saver', () => {
    expect(
      shouldPrefetchFullClip({
        connection: { saveData: true, effectiveType: '4g', downlink: 50 },
        nativeApp: true,
      }),
    ).toBe(false);
  });

  it('skips slow cellular rungs', () => {
    expect(shouldPrefetchFullClip({ connection: { effectiveType: '3g' } })).toBe(false);
    expect(shouldPrefetchFullClip({ connection: { downlink: 1.5 } })).toBe(false);
  });

  it('full-prefetches Wi-Fi, high downlink, and Android 4g (includes 5G)', () => {
    expect(shouldPrefetchFullClip({ connection: { type: 'wifi' } })).toBe(true);
    expect(shouldPrefetchFullClip({ connection: { downlink: 12 } })).toBe(true);
    expect(shouldPrefetchFullClip({ connection: { effectiveType: '4g' } })).toBe(true);
  });

  it('full-prefetches native apps with no Network Information API (iOS)', () => {
    expect(shouldPrefetchFullClip({ nativeApp: true, connection: null })).toBe(true);
    expect(shouldPrefetchFullClip({ nativeApp: false, connection: null })).toBe(false);
  });

  it('escalates after a session already started a clip quickly', () => {
    expect(shouldPrefetchFullClip({ sessionLooksFast: true })).toBe(true);
  });
});
