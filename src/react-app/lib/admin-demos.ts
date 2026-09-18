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
    durationLabel: '35 sec',
  },
  {
    id: 'personalized-feed-ios',
    title: 'Personalized feed on iOS',
    description:
      'Open Follow, search an artist, and tap to follow — clips fill the home feed. The same search-and-follow flow works for venues, songs, and friends.',
    videoSrc: '/demos/personalized-feed-ios/personalized-feed-ios-demo.mp4',
    posterSrc: '/demos/personalized-feed-ios/poster.png',
    durationLabel: '22 sec',
  },
  {
    id: 'find-a-show-ios',
    title: 'Find a Show on iOS',
    description:
      'Open Find a Show from the home carousel, search a past night, mark I went, and upload a clip. Date and GPS metadata prove you were there, the clip inserts in recorded (setlist) order, and you can rate the show.',
    videoSrc: '/demos/find-a-show-ios/find-a-show-ios-demo.mp4',
    posterSrc: '/demos/find-a-show-ios/poster.png',
    durationLabel: '21 sec',
  },
  {
    id: 'profile-ios',
    title: 'Profile on iOS',
    description:
      'Open Profile to see your past-show archive, every clip you posted, clips you saved, and upcoming dates from artists you follow.',
    videoSrc: '/demos/profile-ios/profile-ios-demo.mp4',
    posterSrc: '/demos/profile-ios/poster.png',
    durationLabel: '20 sec',
  },
];
