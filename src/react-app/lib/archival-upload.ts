import type { ClipUploadJobPayload } from '@/react-app/lib/processClipUpload';
import { resolveClipEventTitle } from '@/shared/event-title';
import { jamBaseEventToShowMarkInput, type UserShowMark } from '@/shared/show-marks';

export type ArchivalUploadShowData = {
  jambase_event_id?: string;
  jambase_venue_id?: string;
  jambase_artist_id?: string;
  event_title?: string;
  artist_name?: string;
  venue_name?: string;
  location?: string;
  start_date?: string;
};

export type ArchivalUploadNavState = {
  fromPhotoLibrary: true;
  showData?: ArchivalUploadShowData;
};

function trimField(value: string | null | undefined): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || undefined;
}

function showDataFromMark(mark: {
  jambase_event_id?: string | null;
  jambase_venue_id?: string | null;
  jambase_artist_id?: string | null;
  event_title?: string | null;
  artist_name?: string | null;
  venue_name?: string | null;
  venue_location?: string | null;
  start_date?: string | null;
}): ArchivalUploadShowData {
  return {
    jambase_event_id: trimField(mark.jambase_event_id),
    jambase_venue_id: trimField(mark.jambase_venue_id),
    jambase_artist_id: trimField(mark.jambase_artist_id),
    event_title: trimField(mark.event_title),
    artist_name: trimField(mark.artist_name),
    venue_name: trimField(mark.venue_name),
    location: trimField(mark.venue_location),
    start_date: trimField(mark.start_date),
  };
}

/** Show-page / past-show card event → the same fields we stamp onto the clip. */
export function archivalShowDataFromEvent(
  event: Record<string, unknown> | null | undefined,
): ArchivalUploadShowData | undefined {
  if (!event) return undefined;
  const mark = jamBaseEventToShowMarkInput(event, 'attended');
  if (!mark) return undefined;
  return showDataFromMark(mark);
}

function mergeShowData(
  primary?: ArchivalUploadShowData | null,
  fallback?: ArchivalUploadShowData | null,
): ArchivalUploadShowData | undefined {
  if (!primary && !fallback) return undefined;
  const merged: ArchivalUploadShowData = {
    jambase_event_id: primary?.jambase_event_id || fallback?.jambase_event_id,
    jambase_venue_id: primary?.jambase_venue_id || fallback?.jambase_venue_id,
    jambase_artist_id: primary?.jambase_artist_id || fallback?.jambase_artist_id,
    event_title: primary?.event_title || fallback?.event_title,
    artist_name: primary?.artist_name || fallback?.artist_name,
    venue_name: primary?.venue_name || fallback?.venue_name,
    location: primary?.location || fallback?.location,
    start_date: primary?.start_date || fallback?.start_date,
  };
  return Object.values(merged).some(Boolean) ? merged : undefined;
}

export function archivalUploadNavState(
  mark?: UserShowMark | null,
  event?: Record<string, unknown> | null,
): ArchivalUploadNavState {
  const showData = mergeShowData(
    archivalShowDataFromEvent(event),
    mark ? showDataFromMark(mark) : undefined,
  );
  if (!showData) return { fromPhotoLibrary: true };
  return { fromPhotoLibrary: true, showData };
}

/** Form + JamBase link so a library upload stays on the show it was started from. */
export function clipUploadTargetFromShowData(
  showData?: ArchivalUploadShowData | null,
): {
  form: Pick<ClipUploadJobPayload['form'], 'artist_name' | 'venue_name' | 'location'>;
  jambaseLink: ClipUploadJobPayload['jambaseLink'];
} {
  if (!showData) {
    return {
      form: { artist_name: '', venue_name: '', location: '' },
      jambaseLink: null,
    };
  }
  const artist_name = showData.artist_name?.trim() || '';
  const venue_name = showData.venue_name?.trim() || '';
  const location = showData.location?.trim() || '';
  const eventTitle = resolveClipEventTitle({
    event_title: showData.event_title ?? null,
    artist_name,
    venue_name,
  });
  const event = showData.jambase_event_id?.trim() || null;
  const artist = showData.jambase_artist_id?.trim() || null;
  const venue = showData.jambase_venue_id?.trim() || null;
  return {
    form: { artist_name, venue_name, location },
    jambaseLink:
      event || artist || venue || eventTitle
        ? { event, artist, venue, eventTitle }
        : null,
  };
}
