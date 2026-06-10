import { describe, expect, it, beforeEach } from 'vitest';
import {
  CAPTURE_SHOW_SESSION_TTL_MS,
  clearCaptureShowSession,
  loadCaptureShowSession,
  markCaptureShowSessionPosted,
  saveCaptureShowSession,
} from './captureShowSession';
import type { ClipShowCandidate } from '@/shared/types';

const candidate = (): ClipShowCandidate => ({
  jambase_event_id: 'jambase:ev1',
  jambase_artist_id: 'jambase:ar1',
  jambase_venue_id: 'jambase:vn1',
  artist_name: 'Headliner',
  venue_name: 'Brooklyn Steel',
  location: 'Brooklyn, NY',
  event_title: 'Headliner at Brooklyn Steel',
  startDate: '2026-06-09T20:00:00',
  distance_miles: 0.3,
});

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

  it('expires after TTL', () => {
    saveCaptureShowSession(candidate(), 40.73, -73.99);
    const raw = sessionStorage.getItem('momentum.captureShowSession.v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { savedAtMs: number };
    parsed.savedAtMs = Date.now() - CAPTURE_SHOW_SESSION_TTL_MS - 1000;
    sessionStorage.setItem('momentum.captureShowSession.v1', JSON.stringify(parsed));
    expect(loadCaptureShowSession({ lat: 40.73, lon: -73.99 })).toBeNull();
  });
});
