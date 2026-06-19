/** Shared types for the resilient upload outbox queue. */

export type ClipUploadFormFields = {
  artist_name: string;
  venue_name: string;
  location: string;
  content_description: string;
  song_title: string;
  genre_name: string;
  hashtags: string;
};

export type ClipUploadJobPayload = {
  uploadMethod: 'file' | 'url';
  videoFile: File | null;
  videoBlob: Blob | null;
  thumbnailFile: File | null;
  videoUrl: string;
  /** From POST /api/clips/classify-content — omitted when artist + venue are set manually. */
  classificationId: string;
  /** Lane from classify-content; pre_post clips must not carry show associations. */
  contentFeed?: 'main' | 'pre_post';
  /** When true, classify-content runs in the upload worker (Share works offline). */
  classificationPending?: boolean;
  /** When true, run ACR song ID when upload starts (caption had no song match). */
  songIdentifyPending?: boolean;
  captureAudioBlob?: Blob | null;
  form: ClipUploadFormFields;
  jambaseLink: {
    event: string | null;
    artist: string | null;
    venue: string | null;
    eventTitle?: string | null;
  } | null;
  recordingAtIso: string | null;
  captureGeo: {
    latitude: number;
    longitude: number;
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
  videoMetadata: {
    recording_orientation?: 'portrait' | 'landscape';
    video_resolution_w?: number;
    video_resolution_h?: number;
  };
};
