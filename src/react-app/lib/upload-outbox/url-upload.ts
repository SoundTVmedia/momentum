import { clipShowFieldsForContentFeed } from '@/shared/pre-post-clip';
import { resolveClipEventTitle } from '@/shared/event-title';
import type { UploadOutboxJob } from './types';
import { withUploadBackoff } from './upload-retry';

async function uploadFile(file: File, type: 'video' | 'thumbnail'): Promise<Record<string, unknown>> {
  return withUploadBackoff(async () => {
    const formDataToSend = new FormData();
    formDataToSend.append('file', file);
    formDataToSend.append('type', type);
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formDataToSend,
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Failed to upload ${type}`);
    }
    return response.json() as Promise<Record<string, unknown>>;
  });
}

async function uploadVideoFromUrl(videoUrl: string, artistName: string): Promise<Record<string, unknown>> {
  return withUploadBackoff(async () => {
    const response = await fetch('/api/stream/upload-from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        video_url: videoUrl,
        name: artistName || 'Concert Clip',
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to upload video from URL');
    }
    return response.json() as Promise<Record<string, unknown>>;
  });
}

function buildClipCreateBody(
  job: UploadOutboxJob,
  videoData: Record<string, unknown>,
  thumbnailUrl: string | null,
): Record<string, unknown> {
  const { form } = job;
  const showFields = clipShowFieldsForContentFeed(job.contentFeed ?? 'main', {
    artist_name: form.artist_name,
    venue_name: form.venue_name,
    location: form.location,
    song_title: form.song_title,
    genre_name: form.genre_name,
    hashtagsInput: form.hashtags,
    jambaseLink: job.jambaseLink,
    eventTitleFallback:
      resolveClipEventTitle({
        artist_name: form.artist_name,
        venue_name: form.venue_name,
      }) ?? null,
  });

  const clipData: Record<string, unknown> = {
    artist_name: showFields.artist_name,
    venue_name: showFields.venue_name,
    location: showFields.location,
    content_description: form.content_description || null,
    hashtags: showFields.hashtags,
    song_title: showFields.song_title,
    genre_name: showFields.genre_name,
    status: 'published',
    timestamp: job.recordingAtIso || undefined,
    jambase_event_id: showFields.jambase_event_id ?? undefined,
    jambase_artist_id: showFields.jambase_artist_id ?? undefined,
    jambase_venue_id: showFields.jambase_venue_id ?? undefined,
    event_title: showFields.event_title ?? undefined,
    geolocation_latitude: job.captureGeo?.latitude,
    geolocation_longitude: job.captureGeo?.longitude,
    recording_orientation: job.videoMetadata.recording_orientation || null,
    video_resolution_w: job.videoMetadata.video_resolution_w || null,
    video_resolution_h: job.videoMetadata.video_resolution_h || null,
  };

  if (job.classificationId) {
    clipData.classification_id = job.classificationId;
  }

  if (videoData.type === 'stream') {
    clipData.stream_video_id = videoData.streamVideoId;
    clipData.stream_playback_url = videoData.playbackUrl;
    clipData.stream_thumbnail_url = thumbnailUrl || videoData.thumbnailUrl;
    clipData.video_status = videoData.status;
    clipData.video_duration = videoData.duration;
    clipData.video_url = videoData.mp4PlaybackUrl || videoData.playbackUrl;
    clipData.thumbnail_url = thumbnailUrl || videoData.thumbnailUrl;
  } else {
    clipData.video_url = videoData.url || job.videoUrl;
    clipData.thumbnail_url = thumbnailUrl || null;
  }

  return clipData;
}

/** Legacy Stream/R2 URL pipeline — queued with retries (no local video blob). */
export async function runUrlOutboxJob(
  job: UploadOutboxJob,
  onPatch: (patch: Partial<UploadOutboxJob>) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!job.videoUrl?.trim()) {
    throw new Error('Video URL is required');
  }

  onPatch({ status: 'uploading', progress: 5 });

  let thumbnailUrl: string | null = null;
  if (job.thumbnailFile) {
    onPatch({ progress: 8 });
    const thumbData = await uploadFile(job.thumbnailFile, 'thumbnail');
    thumbnailUrl = typeof thumbData.url === 'string' ? thumbData.url : null;
  }

  onPatch({ progress: 15 });
  const videoData = await uploadVideoFromUrl(job.videoUrl.trim(), job.form.artist_name);
  onPatch({ progress: 85, status: 'completing' });

  const clipData = buildClipCreateBody(job, videoData, thumbnailUrl);

  await withUploadBackoff(
    async () => {
      if (signal?.aborted) throw new Error('Upload cancelled');
      const response = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(clipData),
      });
      if (!response.ok) {
        let msg = 'Failed to create clip';
        try {
          const errBody = (await response.json()) as { error?: string; message?: string };
          if (typeof errBody?.error === 'string') msg = errBody.error;
          else if (typeof errBody?.message === 'string') msg = errBody.message;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      await response.json();
    },
    { signal },
  );

  onPatch({ status: 'published', progress: 100 });
}
