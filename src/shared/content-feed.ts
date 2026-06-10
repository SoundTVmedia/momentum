import { headlinerMatchesAcrArtist } from './artist-name-match';

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
  hasSpeech: boolean;
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
 * Decision matrix:
 * - ACR match + headliner match → main
 * - ACR match + no headliner yet → main (artist required at post; must match ACR)
 * - ACR match + headliner mismatch → rejected
 * - ACR no match + speech → pre_post (friends-only talking moment)
 * - ACR no match + no speech → main (manual song/artist/venue entry)
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
        has_speech: input.hasSpeech,
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
        has_speech: input.hasSpeech,
        headliner_matched: true,
        reason: 'acr_headliner_match',
        acr_artist: acrArtist,
        acr_title: acrTitle,
      };
    }
    return {
      content_feed: 'rejected',
      acr_matched: true,
      has_speech: input.hasSpeech,
      headliner_matched: false,
      reason: 'acr_no_headliner_match',
      message: CONTENT_FEED_REJECTION_MESSAGES.acr_no_headliner_match,
      acr_artist: acrArtist,
      acr_title: acrTitle,
    };
  }

  if (input.hasSpeech) {
    return {
      content_feed: 'pre_post',
      acr_matched: false,
      has_speech: true,
      headliner_matched: false,
      reason: 'speech_no_acr',
      acr_artist: null,
      acr_title: null,
    };
  }

  return {
    content_feed: 'main',
    acr_matched: false,
    has_speech: false,
    headliner_matched: false,
    reason: 'no_acr_no_speech',
    acr_artist: null,
    acr_title: null,
  };
}

/** SQL fragment: clips eligible for the public main performance feed. */
export const MAIN_FEED_CLIP_SQL = `(clips.content_feed = 'main' OR clips.content_feed IS NULL)`;
