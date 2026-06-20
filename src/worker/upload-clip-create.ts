import type { Context } from 'hono';
import { mochaUserIdKey, parseD1LastRowId } from './mocha-user-id';
import {
  BYPASS_CONTENT_FEED_BIFURCATION,
  CONTENT_FEED_REJECTION_MESSAGES,
  hasManualShowArtistVenue,
} from '../shared/content-feed';
import { headlinerMatchesAcrArtist } from '../shared/artist-name-match';
import { computeShowId } from '../shared/show-id';
import { resolveClipEventTitle } from '../shared/event-title';
import {
  clipShowFieldsForContentFeed,
  isPrePostContentFeed,
} from '../shared/pre-post-clip';
import { genreFieldsFromBody, songFieldsFromBody } from './clip-tag-fields';
import { loadValidClassification } from './content-feed-endpoints';
import {
  enrichClipShowTagsFromMetadata,
  mergeEnrichmentIntoClipFields,
} from './clips-enrich-upload-show';

export type ClipCreateBody = Record<string, unknown>;

export type ResolvedClipInsert = {
  uid: string;
  resolvedArtist: string | null;
  resolvedVenue: string | null;
  resolvedLocation: string | null;
  resolvedSongTitle: string | null;
  resolvedGenreName: string | null;
  resolvedJambaseEventId: string | null;
  resolvedJambaseArtistId: string | null;
  resolvedJambaseVenueId: string | null;
  resolvedEventTitle: string | null;
  hashtagList: string[];
  song_slug: string | null;
  genre_slug: string | null;
  showId: string | null;
  contentFeed: string;
  classification: {
    content_feed: string;
    acr_matched: number;
    has_speech: number;
    headliner_matched: number;
    acr_artist: string | null;
    acr_title: string | null;
  } | null;
  classificationId: string;
  content_description: string | null;
  resolvedTimestamp: string;
  geolocation_latitude: number | null;
  geolocation_longitude: number | null;
  geolocation_accuracy_radius: number | null;
  recording_orientation: string | null;
  video_resolution_w: number | null;
  video_resolution_h: number | null;
};

export async function resolveClipCreateFields(
  c: Context<{ Bindings: Env }>,
  body: ClipCreateBody,
): Promise<{ ok: true; fields: ResolvedClipInsert } | { ok: false; status: number; error: string }> {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const uid = mochaUserIdKey(mochaUser);
  const {
    artist_name,
    venue_name,
    location,
    timestamp,
    content_description,
    jambase_event_id,
    jambase_artist_id,
    jambase_venue_id,
    event_title: bodyEventTitle,
    classification_id,
    geolocation_latitude,
    geolocation_longitude,
    geolocation_accuracy_radius,
    recording_orientation,
    video_resolution_w,
    video_resolution_h,
  } = body;

  const postedArtistName = typeof artist_name === 'string' ? artist_name.trim() : '';
  const postedVenueName = typeof venue_name === 'string' ? venue_name.trim() : '';
  const resolvedTimestamp =
    typeof timestamp === 'string' && timestamp.trim()
      ? timestamp
      : new Date().toISOString();
  const hasManualShowTags = hasManualShowArtistVenue(postedArtistName, postedVenueName);

  let classification: ResolvedClipInsert['classification'] = null;
  let classificationId = typeof classification_id === 'string' ? classification_id.trim() : '';

  if (!classificationId && !hasManualShowTags && !BYPASS_CONTENT_FEED_BIFURCATION) {
    return {
      ok: false,
      status: 422,
      error:
        'Content classification is required. Run classify-content on your clip audio before posting.',
    };
  }

  if (classificationId) {
    classification = await loadValidClassification(c.env.DB, classificationId, uid);
    if (!classification) {
      return {
        ok: false,
        status: 422,
        error:
          'Classification expired or invalid. Re-check your clip on the caption screen before posting.',
      };
    }
    if (!BYPASS_CONTENT_FEED_BIFURCATION && classification.content_feed === 'rejected') {
      return {
        ok: false,
        status: 422,
        error: 'This clip cannot be posted based on music identification.',
      };
    }
    if (
      !BYPASS_CONTENT_FEED_BIFURCATION &&
      classification.content_feed !== 'main' &&
      classification.content_feed !== 'pre_post'
    ) {
      return { ok: false, status: 422, error: 'Invalid content feed classification.' };
    }
  }

  if (
    !hasManualShowTags &&
    !BYPASS_CONTENT_FEED_BIFURCATION &&
    classification?.content_feed === 'main' &&
    classification.acr_matched
  ) {
    const acrArtist = classification.acr_artist?.trim() ?? '';
    if (!acrArtist) {
      return {
        ok: false,
        status: 422,
        error: 'Music was identified but artist data is missing. Re-check your clip and try again.',
      };
    }
    if (!postedArtistName) {
      return {
        ok: false,
        status: 422,
        error: CONTENT_FEED_REJECTION_MESSAGES.missing_headliner,
      };
    }
    if (!headlinerMatchesAcrArtist(acrArtist, postedArtistName)) {
      return {
        ok: false,
        status: 422,
        error: CONTENT_FEED_REJECTION_MESSAGES.acr_no_headliner_match,
      };
    }
  }

  const contentFeed = hasManualShowTags
    ? 'main'
    : BYPASS_CONTENT_FEED_BIFURCATION && classification?.content_feed === 'pre_post'
      ? 'main'
      : (classification?.content_feed ?? 'main');

  const showFields = clipShowFieldsForContentFeed(contentFeed, {
    artist_name: typeof artist_name === 'string' ? artist_name : '',
    venue_name: typeof venue_name === 'string' ? venue_name : '',
    location: typeof location === 'string' ? location : '',
    song_title:
      typeof body.song_title === 'string'
        ? String(body.song_title)
        : typeof body.songTitle === 'string'
          ? String(body.songTitle)
          : '',
    genre_name:
      typeof body.genre_name === 'string'
        ? String(body.genre_name)
        : typeof body.genreName === 'string'
          ? String(body.genreName)
          : '',
    hashtagsInput: (() => {
      const raw = body.hashtags;
      if (typeof raw === 'string') return raw;
      if (Array.isArray(raw)) {
        return raw.map((t) => `#${String(t).replace(/^#+/, '')}`).join(' ');
      }
      return '';
    })(),
    jambaseLink: {
      event: typeof jambase_event_id === 'string' ? jambase_event_id : null,
      artist: typeof jambase_artist_id === 'string' ? jambase_artist_id : null,
      venue: typeof jambase_venue_id === 'string' ? jambase_venue_id : null,
      eventTitle: typeof bodyEventTitle === 'string' ? bodyEventTitle : null,
    },
    eventTitleFallback: resolveClipEventTitle({
      event_title: typeof bodyEventTitle === 'string' ? bodyEventTitle : null,
      artist_name: typeof artist_name === 'string' ? artist_name : null,
      venue_name: typeof venue_name === 'string' ? venue_name : null,
    }),
  });

  const resolvedSongTitle = showFields.song_title;
  const resolvedGenreName = showFields.genre_name;
  const song_slug = resolvedSongTitle
    ? songFieldsFromBody({ song_title: resolvedSongTitle }).song_slug
    : null;
  const genre_slug = resolvedGenreName
    ? genreFieldsFromBody({ genre_name: resolvedGenreName }).genre_slug
    : null;

  const showId = isPrePostContentFeed(contentFeed)
    ? null
    : computeShowId({
        jambase_event_id: showFields.jambase_event_id,
        artist_name: showFields.artist_name,
        venue_name: showFields.venue_name,
        timestamp: resolvedTimestamp,
      });

  let fields: ResolvedClipInsert = {
    uid,
    resolvedArtist: showFields.artist_name,
    resolvedVenue: showFields.venue_name,
    resolvedLocation: showFields.location,
    resolvedSongTitle,
    resolvedGenreName,
    resolvedJambaseEventId: showFields.jambase_event_id,
    resolvedJambaseArtistId: showFields.jambase_artist_id,
    resolvedJambaseVenueId: showFields.jambase_venue_id,
    resolvedEventTitle: showFields.event_title,
    hashtagList: showFields.hashtags,
    song_slug,
    genre_slug,
    showId,
    contentFeed,
    classification,
    classificationId,
    content_description:
      typeof content_description === 'string' ? content_description : null,
    resolvedTimestamp,
    geolocation_latitude:
      typeof geolocation_latitude === 'number' ? geolocation_latitude : null,
    geolocation_longitude:
      typeof geolocation_longitude === 'number' ? geolocation_longitude : null,
    geolocation_accuracy_radius:
      typeof geolocation_accuracy_radius === 'number'
        ? geolocation_accuracy_radius
        : null,
    recording_orientation:
      typeof recording_orientation === 'string' ? recording_orientation : null,
    video_resolution_w:
      typeof video_resolution_w === 'number' ? video_resolution_w : null,
    video_resolution_h:
      typeof video_resolution_h === 'number' ? video_resolution_h : null,
  };

  if (
    !hasManualShowTags &&
    fields.geolocation_latitude != null &&
    fields.geolocation_longitude != null
  ) {
    const captureMs = Number.isFinite(Date.parse(resolvedTimestamp))
      ? Date.parse(resolvedTimestamp)
      : Date.now();
    const enrichment = await enrichClipShowTagsFromMetadata(c.env, uid, {
      lat: fields.geolocation_latitude,
      lon: fields.geolocation_longitude,
      captureMs,
      artistName: fields.resolvedArtist,
      venueName: fields.resolvedVenue,
      location: fields.resolvedLocation,
      contentFeed,
    });
    if (enrichment) {
      fields = mergeEnrichmentIntoClipFields(fields, enrichment);
      if (!isPrePostContentFeed(contentFeed) && !fields.showId) {
        fields.showId = computeShowId({
          jambase_event_id: fields.resolvedJambaseEventId,
          artist_name: fields.resolvedArtist,
          venue_name: fields.resolvedVenue,
          timestamp: resolvedTimestamp,
        });
      }
    }
  }

  return {
    ok: true,
    fields,
  };
}

export async function insertDraftClipForUpload(
  db: D1Database,
  fields: ResolvedClipInsert,
  r2Key: string,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO clips
       (mocha_user_id, artist_name, venue_name, location, timestamp, content_description,
        video_url, thumbnail_url, hashtags, song_title, song_slug, genre_name, genre_slug,
        stream_video_id, stream_playback_url, stream_thumbnail_url, video_status, video_duration,
        status, geolocation_latitude, geolocation_longitude, geolocation_accuracy_radius,
        recording_orientation, video_resolution_w, video_resolution_h,
        jambase_event_id, jambase_artist_id, jambase_venue_id, show_id, event_title,
        content_feed, acr_matched, has_speech, headliner_matched,
        is_draft, upload_status, r2_raw_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'uploading', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    )
    .bind(
      fields.uid,
      fields.resolvedArtist,
      fields.resolvedVenue,
      fields.resolvedLocation,
      fields.resolvedTimestamp,
      fields.content_description,
      'pending:upload',
      null,
      JSON.stringify(fields.hashtagList),
      fields.resolvedSongTitle,
      fields.song_slug,
      fields.resolvedGenreName,
      fields.genre_slug,
      null,
      null,
      null,
      'uploading',
      null,
      'draft',
      fields.geolocation_latitude,
      fields.geolocation_longitude,
      fields.geolocation_accuracy_radius,
      fields.recording_orientation,
      fields.video_resolution_w,
      fields.video_resolution_h,
      fields.resolvedJambaseEventId,
      fields.resolvedJambaseArtistId,
      fields.resolvedJambaseVenueId,
      fields.showId,
      fields.resolvedEventTitle,
      fields.classification?.content_feed ?? 'main',
      fields.classification?.acr_matched ? 1 : 0,
      fields.classification?.has_speech ? 1 : 0,
      fields.classification?.headliner_matched ? 1 : 0,
      r2Key,
    )
    .run();

  await db
    .prepare(`UPDATE clips SET id = COALESCE(id, ?) WHERE rowid = ?`)
    .bind(result.meta.last_row_id, result.meta.last_row_id)
    .run();

  const row = await db
    .prepare('SELECT id FROM clips WHERE rowid = ?')
    .bind(result.meta.last_row_id)
    .first();

  return (
    parseD1LastRowId((row as { id?: unknown } | null)?.id) ??
    parseD1LastRowId(result.meta.last_row_id) ??
    0
  );
}

export async function deleteUsedClassification(
  db: D1Database,
  classificationId: string,
): Promise<void> {
  if (!classificationId) return;
  try {
    await db
      .prepare('DELETE FROM clip_content_classifications WHERE id = ?')
      .bind(classificationId)
      .run();
  } catch (err) {
    console.error('Failed to delete used classification:', err);
  }
}
