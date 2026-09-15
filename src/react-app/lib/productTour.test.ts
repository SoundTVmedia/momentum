import { describe, expect, it, beforeEach } from 'vitest';
import {
  PRODUCT_TOUR_PENDING_KEY,
  TOUR_ANCHORS,
  clearPendingTour,
  consumePendingTour,
  isTourPending,
  isTourQuery,
  markTourPending,
  resolveProductTourSteps,
  type TourAnchorId,
} from './productTour';

function hasAnchor(visible: TourAnchorId[], anchor: TourAnchorId): boolean {
  return visible.includes(anchor);
}

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

describe('productTour pending flag', () => {
  beforeEach(() => {
    installSessionStorageMock();
  });

  it('marks, reads, and clears pending tour intent', () => {
    expect(isTourPending()).toBe(false);
    markTourPending();
    expect(isTourPending()).toBe(true);
    expect(sessionStorage.getItem(PRODUCT_TOUR_PENDING_KEY)).toBe('1');
    clearPendingTour();
    expect(isTourPending()).toBe(false);
  });

  it('consumePendingTour returns true once then false', () => {
    expect(consumePendingTour()).toBe(false);
    markTourPending();
    expect(consumePendingTour()).toBe(true);
    expect(isTourPending()).toBe(false);
    expect(consumePendingTour()).toBe(false);
  });
});

describe('isTourQuery', () => {
  it('detects tour=1 on the auth search string', () => {
    expect(isTourQuery('mode=signup&tour=1')).toBe(true);
    expect(isTourQuery('?mode=signup&tour=1')).toBe(true);
    expect(isTourQuery('mode=signup')).toBe(false);
    expect(isTourQuery(new URLSearchParams('tour=1'))).toBe(true);
  });
});

describe('resolveProductTourSteps', () => {
  it('uses capture instead of upcoming shows when the camera tab is visible', () => {
    const steps = resolveProductTourSteps((anchor) =>
      hasAnchor(
        [
          TOUR_ANCHORS.findAShow,
          TOUR_ANCHORS.search,
          TOUR_ANCHORS.follow,
          TOUR_ANCHORS.fromTheScene,
          TOUR_ANCHORS.capture,
          TOUR_ANCHORS.upcomingShows,
          TOUR_ANCHORS.uploadQueue,
          TOUR_ANCHORS.profile,
        ],
        anchor,
      ),
    );
    expect(steps.map((step) => step.id)).toEqual([
      'find-a-show',
      'search',
      'follow',
      'from-the-scene',
      'capture',
      'upload-queue',
      'profile',
    ]);
  });

  it('uses upcoming shows on desktop when capture is hidden', () => {
    const steps = resolveProductTourSteps((anchor) =>
      hasAnchor(
        [
          TOUR_ANCHORS.findAShow,
          TOUR_ANCHORS.search,
          TOUR_ANCHORS.follow,
          TOUR_ANCHORS.fromTheScene,
          TOUR_ANCHORS.upcomingShows,
          TOUR_ANCHORS.uploadQueue,
          TOUR_ANCHORS.profile,
        ],
        anchor,
      ),
    );
    expect(steps.map((step) => step.id)).toEqual([
      'find-a-show',
      'search',
      'follow',
      'from-the-scene',
      'upcoming-shows',
      'upload-queue',
      'profile',
    ]);
  });

  it('drops steps whose anchors are missing', () => {
    const steps = resolveProductTourSteps((anchor) => anchor === TOUR_ANCHORS.search);
    expect(steps.map((step) => step.id)).toEqual(['search']);
  });
});
