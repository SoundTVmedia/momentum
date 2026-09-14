import type { UserShowMark } from '@/shared/show-marks';

export type ArchivalUploadNavState = {
  fromPhotoLibrary: true;
  showData?: {
    jambase_event_id?: string;
    jambase_venue_id?: string;
    jambase_artist_id?: string;
    event_title?: string;
    artist_name?: string;
    venue_name?: string;
    location?: string;
    start_date?: string;
  };
};

export function archivalUploadNavState(mark?: UserShowMark | null): ArchivalUploadNavState {
  if (!mark) return { fromPhotoLibrary: true };
  return {
    fromPhotoLibrary: true,
    showData: {
      jambase_event_id: mark.jambase_event_id,
      jambase_venue_id: mark.jambase_venue_id ?? undefined,
      jambase_artist_id: mark.jambase_artist_id ?? undefined,
      event_title: mark.event_title ?? undefined,
      artist_name: mark.artist_name ?? undefined,
      venue_name: mark.venue_name ?? undefined,
      location: mark.venue_location ?? undefined,
      start_date: mark.start_date ?? undefined,
    },
  };
}
