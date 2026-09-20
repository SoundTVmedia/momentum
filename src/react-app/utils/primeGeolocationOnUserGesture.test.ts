import { describe, expect, it } from 'vitest';
import { CAPTURE_GEO_POSITION_OPTIONS } from './primeGeolocationOnUserGesture';

describe('CAPTURE_GEO_POSITION_OPTIONS', () => {
  it('reuses a recent fix instead of waking GPS on every Capture tap', () => {
    expect(CAPTURE_GEO_POSITION_OPTIONS.maximumAge).toBe(60_000);
    expect(CAPTURE_GEO_POSITION_OPTIONS.enableHighAccuracy).toBe(true);
  });
});
