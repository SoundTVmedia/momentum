/**
 * Superadmin demo catalog. Source files live in `docs/demos/<id>/` and are
 * published for the app at `/demos/<id>/`.
 */
export type AdminDemo = {
  id: string;
  title: string;
  description: string;
  videoSrc: string;
  posterSrc: string;
  durationLabel: string;
};

export const ADMIN_DEMOS: AdminDemo[] = [
  {
    id: 'quickrecord-ios',
    title: 'Quick Record on iOS',
    description:
      'GPS matches a nearby JamBase show in the camera HUD, the clip uploads in the background, and the show page populates with the new moment.',
    videoSrc: '/demos/quickrecord-ios/quickrecord-ios-demo.mp4',
    posterSrc: '/demos/quickrecord-ios/poster.png',
    durationLabel: '33 sec',
  },
  {
    id: 'personalized-feed-ios',
    title: 'Personalized feed on iOS',
    description:
      'Open Follow, search an artist, and tap to follow — clips fill the home feed. The same search-and-follow flow works for venues, songs, and friends.',
    videoSrc: '/demos/personalized-feed-ios/personalized-feed-ios-demo.mp4',
    posterSrc: '/demos/personalized-feed-ios/poster.png',
    durationLabel: '36 sec',
  },
];
