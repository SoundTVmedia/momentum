import { describe, expect, it, beforeEach } from 'vitest';
import {
  CAPTURE_SHOW_POST_EVENT_HOURS,
  clearCaptureShowSession,
  clearCaptureShowSessionForEvent,
  loadCaptureShowSession,
  markCaptureShowSessionPosted,
  saveCaptureShowSession,
} from './captureShowSession';
import type { ClipShowCandidate } from '@/shared/types';

const candidate = (): ClipShowCandidate => {
  const start = new Date(Date.now() + 4 * 60 * 60 * 1000);
  return {
    jambase_event_id: 'jambase:ev1',
    jambase_artist_id: 'jambase:ar1',
    jambase_venue_id: 'jambase:vn1',
    artist_name: 'Headliner',
    venue_name: 'Brooklyn Steel',
    location: 'Brooklyn, NY',
    event_title: 'Headliner at Brooklyn Steel',
    startDate: start.toISOString(),
    distance_miles: 0.3,
  };
};

function installSessionStorageMock(): void {
  const store = new Map<string, string>();
  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: mock,
    configurable: true,
  });
}

describe('captureShowSession', () => {
  beforeEach(() => {
    installSessionStorageMock();
    clearCaptureShowSession();
  });

  it('saves and loads near the anchor', () => {
    saveCaptureShowSession(candidate(), 40.73, -73.99);
    const loaded = loadCaptureShowSession({ lat: 40.731, lon: -73.991 });
    expect(loaded?.candidate.venue_name).toBe('Brooklyn Steel');
    expect(loaded?.postsAtVenue).toBe(0);
  });

  it('rejects load when too far from anchor before first post', () => {
    saveCaptureShowSession(candidate(), 40.73, -73.99);
    expect(loadCaptureShowSession({ lat: 40.8, lon: -73.99 })).toBeNull();
  });

  it('allows wider drift after a post at the venue', () => {
    saveCaptureShowSession(candidate(), 40.73, -73.99);
    markCaptureShowSessionPosted(candidate(), 40.73, -73.99);
    const loaded = loadCaptureShowSession({ lat: 40.745, lon: -73.99 });
    expect(loaded?.postsAtVenue).toBe(1);
  });

  it('expires after show window', () => {
    saveCaptureShowSession(candidate(), 40.73, -73.99);
    const raw = sessionStorage.getItem('momentum.captureShowSession.v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { expiresAtMs: number };
    parsed.expiresAtMs = Date.now() - 1000;
    sessionStorage.setItem('momentum.captureShowSession.v1', JSON.stringify(parsed));
    expect(loadCaptureShowSession({ lat: 40.73, lon: -73.99 })).toBeNull();
  });

  it('expires at show start plus post-show hours', () => {
    const cand = candidate();
    saveCaptureShowSession(cand, 40.73, -73.99);
    const raw = sessionStorage.getItem('momentum.captureShowSession.v1');
    const parsed = JSON.parse(raw!) as { expiresAtMs: number };
    const showStart = Date.parse(cand.startDate!);
    expect(parsed.expiresAtMs).toBe(
      showStart + CAPTURE_SHOW_POST_EVENT_HOURS * 60 * 60 * 1000,
    );
  });

  it('clears session when a going mark is removed for that event', () => {
    saveCaptureShowSession(candidate(), 40.73, -73.99, { source: 'going' });
    clearCaptureShowSessionForEvent('jambase:ev1');
    expect(loadCaptureShowSession({ lat: 40.73, lon: -73.99 })).toBeNull();
  });
});
