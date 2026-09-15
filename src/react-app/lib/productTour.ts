export const PRODUCT_TOUR_PENDING_KEY = 'feedback.productTour.pending';

export const PRODUCT_TOUR_AUTH_HREF = '/auth?mode=signup&tour=1';

export const TOUR_ANCHORS = {
  findAShow: 'find-a-show',
  search: 'search',
  follow: 'follow',
  fromTheScene: 'from-the-scene',
  capture: 'capture',
  upcomingShows: 'upcoming-shows',
  uploadQueue: 'upload-queue',
  profile: 'profile',
} as const;

export type TourAnchorId = (typeof TOUR_ANCHORS)[keyof typeof TOUR_ANCHORS];

export type ProductTourStep = {
  id: string;
  title: string;
  body: string;
  anchors: TourAnchorId[];
};

export const PRODUCT_TOUR_STEPS: ProductTourStep[] = [
  {
    id: 'find-a-show',
    title: 'Find a show',
    body: 'Search a concert you went to — or one coming up — then open it to rate, follow along, or grab tickets.',
    anchors: [TOUR_ANCHORS.findAShow],
  },
  {
    id: 'search',
    title: 'Search everything',
    body: 'Jump to artists, venues, friends, and songs from here.',
    anchors: [TOUR_ANCHORS.search],
  },
  {
    id: 'follow',
    title: 'Follow what you love',
    body: 'Follow artists, friends, venues, and songs so your feed fills with clips that match your taste.',
    anchors: [TOUR_ANCHORS.follow],
  },
  {
    id: 'from-the-scene',
    title: 'From the Scene',
    body: 'Watch live moments from shows happening around you. Latest, most liked, and most viewed are a tap away.',
    anchors: [TOUR_ANCHORS.fromTheScene],
  },
  {
    id: 'capture',
    title: 'Capture a moment',
    body: 'Hit the camera to record at the show. When you share, the clip lands in your upload queue.',
    anchors: [TOUR_ANCHORS.capture],
  },
  {
    id: 'upcoming-shows',
    title: 'Upcoming shows',
    body: 'Browse nearby dates and find a night worth leaving the house for.',
    anchors: [TOUR_ANCHORS.upcomingShows],
  },
  {
    id: 'upload-queue',
    title: 'Upload queue',
    body: 'Clips you capture or pick from your library wait here until they finish posting.',
    anchors: [TOUR_ANCHORS.uploadQueue],
  },
  {
    id: 'profile',
    title: 'Your profile',
    body: 'Your ratings, clips, and account live here. Open it anytime from this button.',
    anchors: [TOUR_ANCHORS.profile],
  },
];

function canUseSessionStorage(): boolean {
  return typeof sessionStorage !== 'undefined';
}

export function markTourPending(): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.setItem(PRODUCT_TOUR_PENDING_KEY, '1');
  } catch {
    /* private mode / quota */
  }
}

export function isTourPending(): boolean {
  if (!canUseSessionStorage()) return false;
  try {
    return sessionStorage.getItem(PRODUCT_TOUR_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearPendingTour(): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(PRODUCT_TOUR_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function consumePendingTour(): boolean {
  if (!isTourPending()) return false;
  clearPendingTour();
  return true;
}

export function isTourQuery(search: string | URLSearchParams): boolean {
  const params =
    typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search) : search;
  return params.get('tour') === '1';
}

export function isElementVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  let node: HTMLElement | null = el;
  while (node) {
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    node = node.parentElement;
  }
  const rect = el.getBoundingClientRect();
  return rect.width >= 2 && rect.height >= 2;
}

export function queryVisibleTourAnchor(anchor: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const nodes = document.querySelectorAll(`[data-tour="${anchor}"]`);
  for (const node of nodes) {
    if (node instanceof HTMLElement && isElementVisible(node)) return node;
  }
  return null;
}

export function resolveProductTourSteps(
  hasAnchor: (anchor: TourAnchorId) => boolean,
): ProductTourStep[] {
  const captureVisible = hasAnchor(TOUR_ANCHORS.capture);
  const upcomingVisible = hasAnchor(TOUR_ANCHORS.upcomingShows);

  return PRODUCT_TOUR_STEPS.filter((step) => {
    if (step.id === 'capture') return captureVisible;
    if (step.id === 'upcoming-shows') return upcomingVisible && !captureVisible;
    return step.anchors.some((anchor) => hasAnchor(anchor));
  });
}

export function resolveVisibleTourSteps(): ProductTourStep[] {
  return resolveProductTourSteps((anchor) => queryVisibleTourAnchor(anchor) != null);
}

export function targetForStep(step: ProductTourStep): HTMLElement | null {
  for (const anchor of step.anchors) {
    const el = queryVisibleTourAnchor(anchor);
    if (el) return el;
  }
  return null;
}
