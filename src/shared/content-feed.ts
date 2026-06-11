import { headlinerMatchesAcrArtist } from './artist-name-match';
import { artistAtVenueTitle } from './event-title';

/** Temporary: skip main vs pre/post split; all clips post to main with manual tags allowed. */
export const BYPASS_CONTENT_FEED_BIFURCATION = true;

export type ContentFeedLane = 'main' | 'pre_post';

export type ContentFeedClassification =
  | {
      content_feed: ContentFeedLane;
      acr_matched: boolean;
      has_speech: boolean;
      headliner_matched: boolean;
      reason: string;
      acr_artist?: string | null;
      acr_title?: string | null;
    }
  | {
      content_feed: 'rejected';
      acr_matched: boolean;
      has_speech: boolean;
      headliner_matched: boolean;
      reason: string;
      message: string;
      acr_artist?: string | null;
      acr_title?: string | null;
    };

export type ClassifyContentFeedInput = {
  acrMatch: { artist: string; title: string } | null;
  headlinerName: string | null | undefined;
};

export const CONTENT_FEED_REJECTION_MESSAGES: Record<string, string> = {
  acr_no_headliner_match:
    'This sounds like a song, but the artist you selected does not match the identified track. Pick the artist ACR detected, or post as a friends-only talking moment.',
  missing_headliner:
    'Select the show artist that matches the identified song before posting to the main feed.',
  acr_artist_required:
    'The main feed requires an artist that matches the identified song.',
};

/**
 * Decision matrix (ACR only — no speech/Whisper gate):
 * - ACR match + headliner match → main
 * - ACR match + no headliner yet → main (artist required at post; must match ACR)
 * - ACR match + headliner mismatch → rejected (unless bypass)
 * - ACR no match → main (manual song/artist/venue entry)
 */
export function classifyContentFeed(input: ClassifyContentFeedInput): ContentFeedClassification {
  const acrArtist = input.acrMatch?.artist?.trim() || null;
  const acrTitle = input.acrMatch?.title?.trim() || null;
  const acrMatched = Boolean(acrArtist || acrTitle);
  const headliner = input.headlinerName?.trim() || null;

  if (acrMatched) {
    if (!headliner) {
      return {
        content_feed: 'main',
        acr_matched: true,
        has_speech: false,
        headliner_matched: false,
        reason: 'acr_pending_headliner',
        acr_artist: acrArtist,
        acr_title: acrTitle,
      };
    }
    const headlinerMatched = headlinerMatchesAcrArtist(acrArtist ?? '', headliner);
    if (headlinerMatched) {
      return {
        content_feed: 'main',
        acr_matched: true,
        has_speech: false,
        headliner_matched: true,
        reason: 'acr_headliner_match',
        acr_artist: acrArtist,
        acr_title: acrTitle,
      };
    }
    if (BYPASS_CONTENT_FEED_BIFURCATION) {
      return {
        content_feed: 'main',
        acr_matched: true,
        has_speech: false,
        headliner_matched: false,
        reason: 'acr_no_headliner_match',
        acr_artist: acrArtist,
        acr_title: acrTitle,
      };
    }
    return {
      content_feed: 'rejected',
      acr_matched: true,
      has_speech: false,
      headliner_matched: false,
      reason: 'acr_no_headliner_match',
      message: CONTENT_FEED_REJECTION_MESSAGES.acr_no_headliner_match,
      acr_artist: acrArtist,
      acr_title: acrTitle,
    };
  }

  return {
    content_feed: 'main',
    acr_matched: false,
    has_speech: false,
    headliner_matched: false,
    reason: 'no_acr',
    acr_artist: null,
    acr_title: null,
  };
}

/** SQL fragment: clips eligible for the public main performance feed. */
export const MAIN_FEED_CLIP_SQL = `(clips.content_feed = 'main' OR clips.content_feed IS NULL)`;

/** Lane used when persisting a clip — respects temporary bifurcation bypass. */
export function effectiveContentFeedForPost(feed: string | null | undefined): ContentFeedLane {
  if (BYPASS_CONTENT_FEED_BIFURCATION) return 'main';
  return feed === 'pre_post' ? 'pre_post' : 'main';
}

/** User-provided artist + venue — skip ACR clip-type gate when both are set. */
export function hasManualShowArtistVenue(
  artistName?: string | null,
  venueName?: string | null,
): boolean {
  return Boolean(artistName?.trim() && venueName?.trim());
}

/** User-provided show metadata — skip ACR clip-type gate when venue, title, and date are set. */
export function hasManualShowPostDetails(input: {
  venueName?: string | null;
  eventTitle?: string | null;
  artistName?: string | null;
  eventDateIso?: string | null;
}): boolean {
  const venue = input.venueName?.trim();
  if (!venue) return false;

  const title = input.eventTitle?.trim() || artistAtVenueTitle(input.artistName, venue);
  if (!title) return false;

  const date = input.eventDateIso?.trim();
  if (!date || Number.isNaN(Date.parse(date))) return false;

  return true;
}

/** @deprecated Use hasManualShowArtistVenue */
export function hasManualShowAssociation(
  artistName: string | null | undefined,
  venueName: string | null | undefined,
): boolean {
  return hasManualShowArtistVenue(artistName, venueName);
}
