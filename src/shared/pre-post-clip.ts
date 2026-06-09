import { buildHashtagsArrayForPost } from './clip-hashtags';

export function isPrePostContentFeed(feed: string | null | undefined): feed is 'pre_post' {
  return feed === 'pre_post';
}

/** Show association fields cleared for friends-only talking clips. */
export type StrippedShowAssociationFields = {
  artist_name: null;
  venue_name: null;
  location: null;
  song_title: null;
  genre_name: null;
  jambase_event_id: null;
  jambase_artist_id: null;
  jambase_venue_id: null;
  event_title: null;
  hashtags: string[];
};

export function emptyShowAssociationFields(): StrippedShowAssociationFields {
  return {
    artist_name: null,
    venue_name: null,
    location: null,
    song_title: null,
    genre_name: null,
    jambase_event_id: null,
    jambase_artist_id: null,
    jambase_venue_id: null,
    event_title: null,
    hashtags: [],
  };
}

export function clipShowFieldsForContentFeed(
  contentFeed: string | null | undefined,
  fields: {
    artist_name: string;
    venue_name: string;
    location: string;
    song_title: string;
    genre_name: string;
    hashtagsInput: string;
    jambaseLink?: {
      event: string | null;
      artist: string | null;
      venue: string | null;
      eventTitle?: string | null;
    } | null;
    eventTitleFallback?: string | null;
  },
): {
  artist_name: string | null;
  venue_name: string | null;
  location: string | null;
  song_title: string | null;
  genre_name: string | null;
  jambase_event_id: string | null;
  jambase_artist_id: string | null;
  jambase_venue_id: string | null;
  event_title: string | null;
  hashtags: string[];
} {
  if (isPrePostContentFeed(contentFeed)) {
    return emptyShowAssociationFields();
  }

  return {
    artist_name: fields.artist_name.trim() || null,
    venue_name: fields.venue_name.trim() || null,
    location: fields.location.trim() || null,
    song_title: fields.song_title.trim() || null,
    genre_name: fields.genre_name.trim() || null,
    jambase_event_id: fields.jambaseLink?.event ?? null,
    jambase_artist_id: fields.jambaseLink?.artist ?? null,
    jambase_venue_id: fields.jambaseLink?.venue ?? null,
    event_title: fields.jambaseLink?.eventTitle ?? fields.eventTitleFallback ?? null,
    hashtags: buildHashtagsArrayForPost(
      fields.hashtagsInput,
      fields.artist_name,
      fields.song_title,
      fields.genre_name,
    ),
  };
}
