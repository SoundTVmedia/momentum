import { buildHashtagsArrayForPost } from '@/shared/clip-hashtags';
import { generateVideoThumbnailJpeg } from '@/react-app/utils/videoThumbnail';

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
  form: ClipUploadFormFields;
  jambaseLink: {
    event: string | null;
    artist: string | null;
    venue: string | null;
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

export type ClipUploadProgress = {
  video: number;
  thumbnail: number;
};

async function uploadFile(file: File, type: 'video' | 'thumbnail'): Promise<Record<string, unknown>> {
  const formDataToSend = new FormData();
  formDataToSend.append('file', file);
  formDataToSend.append('type', type);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formDataToSend,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload ${type}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

async function uploadVideoFromUrl(videoUrl: string, artistName: string): Promise<Record<string, unknown>> {
  const response = await fetch('/api/stream/upload-from-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_url: videoUrl,
      name: artistName || 'Concert Clip',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to upload video from URL');
  }

  return response.json() as Promise<Record<string, unknown>>;
}

/** Upload media and create a published clip (same pipeline as UploadClip handleSubmit). */
export async function processClipUpload(
  payload: ClipUploadJobPayload,
  onProgress?: (progress: ClipUploadProgress) => void,
): Promise<void> {
  const { form, uploadMethod } = payload;
  let videoData: Record<string, unknown> | null = null;
  let thumbnailUrl: string | null = null;
  let thumbnailFile = payload.thumbnailFile;

  onProgress?.({ video: 0, thumbnail: 0 });

  if (uploadMethod === 'file' && (payload.videoFile || payload.videoBlob)) {
    onProgress?.({ video: 10, thumbnail: 0 });

    let fileToUpload = payload.videoFile;
    if (!fileToUpload && payload.videoBlob) {
      fileToUpload = new File([payload.videoBlob], `recording-${Date.now()}.webm`, {
        type: payload.videoBlob.type || 'video/webm',
      });
    }

    if (fileToUpload && !thumbnailFile) {
      thumbnailFile = await generateVideoThumbnailJpeg(fileToUpload);
    }

    if (fileToUpload) {
      videoData = await uploadFile(fileToUpload, 'video');
    }
    onProgress?.({ video: 100, thumbnail: 0 });
  } else if (uploadMethod === 'url' && payload.videoUrl) {
    onProgress?.({ video: 10, thumbnail: 0 });
    videoData = await uploadVideoFromUrl(payload.videoUrl, form.artist_name);
    onProgress?.({ video: 100, thumbnail: 0 });
  } else {
    throw new Error('No video to upload');
  }

  if (thumbnailFile) {
    onProgress?.({ video: 100, thumbnail: 10 });
    const thumbData = await uploadFile(thumbnailFile, 'thumbnail');
    thumbnailUrl = typeof thumbData.url === 'string' ? thumbData.url : null;
    onProgress?.({ video: 100, thumbnail: 100 });
  }

  const hashtagsArray = buildHashtagsArrayForPost(
    form.hashtags,
    form.artist_name,
    form.song_title,
    form.genre_name,
  );

  const clipData: Record<string, unknown> = {
    artist_name: form.artist_name || null,
    venue_name: form.venue_name || null,
    location: form.location || null,
    content_description: form.content_description || null,
    hashtags: hashtagsArray,
    song_title: form.song_title?.trim() || null,
    genre_name: form.genre_name?.trim() || null,
    status: 'published',
    timestamp: payload.recordingAtIso || undefined,
    jambase_event_id: payload.jambaseLink?.event ?? undefined,
    jambase_artist_id: payload.jambaseLink?.artist ?? undefined,
    jambase_venue_id: payload.jambaseLink?.venue ?? undefined,
    geolocation_latitude: payload.captureGeo?.latitude,
    geolocation_longitude: payload.captureGeo?.longitude,
    recording_orientation: payload.videoMetadata.recording_orientation || null,
    video_resolution_w: payload.videoMetadata.video_resolution_w || null,
    video_resolution_h: payload.videoMetadata.video_resolution_h || null,
  };

  if (videoData?.type === 'stream') {
    clipData.stream_video_id = videoData.streamVideoId;
    clipData.stream_playback_url = videoData.playbackUrl;
    clipData.stream_thumbnail_url = thumbnailUrl || videoData.thumbnailUrl;
    clipData.video_status = videoData.status;
    clipData.video_duration = videoData.duration;
    clipData.video_url = videoData.mp4PlaybackUrl || videoData.playbackUrl;
    clipData.thumbnail_url = thumbnailUrl || videoData.thumbnailUrl;
  } else {
    clipData.video_url = videoData?.url || payload.videoUrl;
    clipData.thumbnail_url = thumbnailUrl || null;
  }

  const response = await fetch('/api/clips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clipData),
  });

  if (!response.ok) {
    let msg = 'Failed to create clip';
    try {
      const errBody = (await response.json()) as { error?: string; message?: string };
      if (typeof errBody?.error === 'string') msg = errBody.error;
      else if (typeof errBody?.message === 'string') msg = errBody.message;
    } catch {
      /* non-JSON body */
    }
    throw new Error(msg);
  }

  await response.json();
}
