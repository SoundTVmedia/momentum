import { UPLOAD_PART_SIZE_BYTES } from '@/shared/upload';
import { clipShowFieldsForContentFeed } from '@/shared/pre-post-clip';
import { resolveClipEventTitle } from '@/shared/event-title';
import type { ClipUploadJobPayload } from '@/react-app/lib/processClipUpload';

/** Map outbox payload → POST /api/uploads/init body (clip metadata + file info). */
export function buildUploadInitBody(
  payload: ClipUploadJobPayload,
  file: File,
): Record<string, unknown> {
  const { form } = payload;
  const showFields = clipShowFieldsForContentFeed(payload.contentFeed ?? 'main', {
    artist_name: form.artist_name,
    venue_name: form.venue_name,
    location: form.location,
    song_title: form.song_title,
    genre_name: form.genre_name,
    hashtagsInput: form.hashtags,
    jambaseLink: payload.jambaseLink,
    eventTitleFallback:
      resolveClipEventTitle({
        artist_name: form.artist_name,
        venue_name: form.venue_name,
      }) ?? null,
  });

  return {
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type || 'video/webm',
    artist_name: showFields.artist_name,
    venue_name: showFields.venue_name,
    location: showFields.location,
    content_description: form.content_description || null,
    hashtags: showFields.hashtags,
    song_title: showFields.song_title,
    genre_name: showFields.genre_name,
    timestamp: payload.recordingAtIso || undefined,
    jambase_event_id: showFields.jambase_event_id ?? undefined,
    jambase_artist_id: showFields.jambase_artist_id ?? undefined,
    jambase_venue_id: showFields.jambase_venue_id ?? undefined,
    event_title: showFields.event_title ?? undefined,
    geolocation_latitude: payload.captureGeo?.latitude,
    geolocation_longitude: payload.captureGeo?.longitude,
    recording_orientation: payload.videoMetadata.recording_orientation || null,
    video_resolution_w: payload.videoMetadata.video_resolution_w || null,
    video_resolution_h: payload.videoMetadata.video_resolution_h || null,
    classification_id: payload.classificationId || undefined,
  };
}

export function blobToUploadFile(blob: Blob, jobId: string): File {
  const type = blob.type || 'video/webm';
  const ext = type.includes('mp4') ? 'mp4' : 'webm';
  return new File([blob], `recording-${jobId}.${ext}`, { type });
}

export function computePartPlan(fileSize: number): { totalParts: number; partSize: number } {
  const partSize = UPLOAD_PART_SIZE_BYTES;
  const totalParts = Math.max(1, Math.ceil(fileSize / partSize));
  return { totalParts, partSize };
}

async function uploadPartWorker(
  sessionId: string,
  partNumber: number,
  chunk: Blob,
  signal?: AbortSignal,
): Promise<{ etag: string }> {
  const res = await fetch(`/api/uploads/${sessionId}/parts/${partNumber}`, {
    method: 'PUT',
    body: chunk,
    signal,
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Part ${partNumber} upload failed`);
  }
  const data = (await res.json()) as { etag?: string };
  return { etag: data.etag ?? '' };
}

async function uploadPartDirect(
  sessionId: string,
  partNumber: number,
  url: string,
  chunk: Blob,
  signal?: AbortSignal,
): Promise<{ etag: string }> {
  const res = await fetch(url, { method: 'PUT', body: chunk, signal });
  if (!res.ok) {
    throw new Error(`Direct part ${partNumber} upload failed`);
  }
  const etag = res.headers.get('etag')?.replace(/^"|"$/g, '') ?? '';
  await fetch(`/api/uploads/${sessionId}/parts/${partNumber}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ etag }),
    signal,
  });
  return { etag };
}

export async function uploadFileMultipart(options: {
  sessionId: string;
  file: File;
  uploadMode: 'direct' | 'worker';
  partUrls: string[] | null;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { sessionId, file, uploadMode, partUrls, onProgress, signal } = options;
  const { totalParts, partSize } = computePartPlan(file.size);
  let uploadedBytes = 0;

  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    if (signal?.aborted) throw new Error('Upload cancelled');
    const start = (partNumber - 1) * partSize;
    const end = Math.min(start + partSize, file.size);
    const chunk = file.slice(start, end);

    if (uploadMode === 'direct' && partUrls?.[partNumber - 1]) {
      await uploadPartDirect(sessionId, partNumber, partUrls[partNumber - 1], chunk, signal);
    } else {
      await uploadPartWorker(sessionId, partNumber, chunk, signal);
    }

    uploadedBytes += chunk.size;
    onProgress?.(Math.round((uploadedBytes / file.size) * 100));
  }
}

export async function uploadThumbnail(file: File): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'thumbnail');
  const res = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
  if (!res.ok) throw new Error('Thumbnail upload failed');
  const data = (await res.json()) as { url?: string; key?: string };
  return { url: data.url ?? '', key: data.key ?? '' };
}

export async function completeUploadSession(
  sessionId: string,
  idempotencyKey: string,
  thumb?: { url: string; key: string } | null,
): Promise<void> {
  const res = await fetch(`/api/uploads/${sessionId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    credentials: 'include',
    body: JSON.stringify({
      thumbnailUrl: thumb?.url,
      thumbnailKey: thumb?.key,
    }),
  });
  if (!res.ok) {
    let msg = 'Failed to complete upload';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

export async function pollUploadUntilPublished(
  sessionId: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const maxAttempts = 120;
  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new Error('Upload cancelled');
    const res = await fetch(`/api/uploads/${sessionId}/status`, { credentials: 'include', signal });
    if (!res.ok) throw new Error('Failed to check upload status');
    const data = (await res.json()) as {
      progress?: number;
      clipPublished?: boolean;
      uploadStatus?: string;
    };
    const base = data.progress ?? 100;
    onProgress?.(Math.min(100, Math.round(85 + base * 0.15)));
    if (data.clipPublished || data.uploadStatus === 'ready') return;
    if (data.uploadStatus === 'failed') throw new Error('Clip processing failed');
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Timed out waiting for clip to publish');
}
