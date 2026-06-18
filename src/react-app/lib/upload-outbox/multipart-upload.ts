import { UPLOAD_PART_SIZE_BYTES } from '@/shared/upload';
import { clipShowFieldsForContentFeed } from '@/shared/pre-post-clip';
import { resolveClipEventTitle } from '@/shared/event-title';
import type { ClipUploadJobPayload } from '@/react-app/lib/processClipUpload';
import { withUploadBackoff } from './upload-retry';
import { uploadFetch, PART_UPLOAD_FETCH_TIMEOUT_MS } from './upload-fetch';
import type { UploadOutboxJob } from './types';

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

export function isUploadFinishedOnServer(
  uploadStatus?: string | null,
  clipPublished?: boolean,
): boolean {
  if (clipPublished) return true;
  return (
    uploadStatus === 'ready' ||
    uploadStatus === 'uploaded' ||
    uploadStatus === 'processing'
  );
}

export class UploadSessionInvalidError extends Error {
  constructor(message = 'Upload session expired or invalid') {
    super(message);
    this.name = 'UploadSessionInvalidError';
  }
}

async function readUploadError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** Browser uploads always use Worker → R2 (presigned direct PUT needs bucket CORS). */
export function effectiveUploadMode(
  _uploadMode: 'direct' | 'worker' | null | undefined,
): 'direct' | 'worker' {
  return 'worker';
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
  return withUploadBackoff(
    async () => {
      let res: Response;
      try {
        res = await uploadFetch(`/api/uploads/${sessionId}/parts/${partNumber}`, {
          method: 'PUT',
          body: chunk,
          credentials: 'include',
          signal,
          timeoutMs: PART_UPLOAD_FETCH_TIMEOUT_MS,
        });
      } catch {
        throw new TypeError('Network error during part upload');
      }
      if (!res.ok) {
        const detail = await readUploadError(res);
        if (res.status === 404 || res.status === 409) {
          throw new UploadSessionInvalidError(detail);
        }
        throw new Error(`Part ${partNumber} upload failed: ${detail}`);
      }
      const data = (await res.json()) as { etag?: string };
      return { etag: data.etag ?? '' };
    },
    { signal },
  );
}

async function uploadPartDirect(
  sessionId: string,
  partNumber: number,
  url: string,
  chunk: Blob,
  signal?: AbortSignal,
): Promise<{ etag: string }> {
  return withUploadBackoff(
    async () => {
      const res = await uploadFetch(url, {
        method: 'PUT',
        body: chunk,
        signal,
        timeoutMs: PART_UPLOAD_FETCH_TIMEOUT_MS,
      });
      if (!res.ok) {
        throw new Error(`Direct part ${partNumber} upload failed: HTTP ${res.status}`);
      }
      const etag = res.headers.get('etag')?.replace(/^"|"$/g, '') ?? '';
      const confirmRes = await uploadFetch(`/api/uploads/${sessionId}/parts/${partNumber}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ etag }),
        signal,
      });
      if (!confirmRes.ok) {
        const detail = await readUploadError(confirmRes);
        if (confirmRes.status === 404 || confirmRes.status === 409) {
          throw new UploadSessionInvalidError(detail);
        }
        throw new Error(`Direct part ${partNumber} confirm failed: ${detail}`);
      }
      return { etag };
    },
    { signal },
  );
}

export type UploadSessionPoll = {
  completedPartNumbers?: number[];
  completedParts?: number;
  totalParts?: number;
  progress?: number;
  uploadStatus?: string;
  clipPublished?: boolean;
  sessionStatus?: string;
};

export async function fetchUploadSessionStatus(
  sessionId: string,
  signal?: AbortSignal,
): Promise<UploadSessionPoll> {
  return withUploadBackoff(
    async () => {
      let res: Response;
      try {
        res = await uploadFetch(`/api/uploads/${sessionId}/status`, {
          credentials: 'include',
          signal,
        });
      } catch {
        throw new TypeError('Network error checking upload status');
      }
      if (!res.ok) {
        const detail = await readUploadError(res);
        if (res.status === 404 || res.status === 409) {
          throw new UploadSessionInvalidError(detail);
        }
        throw new Error(`Failed to check upload status: ${detail}`);
      }
      return res.json() as Promise<UploadSessionPoll>;
    },
    { signal },
  );
}

/** Finish upload when all parts are on the server but local video blob is gone (e.g. refresh). */
export async function tryFinishSessionWithoutVideo(
  sessionId: string,
  idempotencyKey: string,
  expectedTotalParts: number,
  onPatch: (patch: Partial<Pick<UploadOutboxJob, 'status' | 'progress'>>) => void,
  signal?: AbortSignal,
): Promise<boolean> {
  const status = await fetchUploadSessionStatus(sessionId, signal);
  if (isUploadFinishedOnServer(status.uploadStatus, status.clipPublished)) {
    return true;
  }

  const completed =
    status.completedPartNumbers ??
    Array.from({ length: status.completedParts ?? 0 }, (_, i) => i + 1);
  const totalParts = status.totalParts ?? expectedTotalParts;
  if (completed.length < totalParts) {
    return false;
  }

  onPatch({ status: 'completing', progress: 88 });
  await completeUploadSession(sessionId, idempotencyKey, null, signal);
  onPatch({ status: 'processing', progress: 92 });
  await pollUploadUntilPublished(sessionId, (pct) => onPatch({ progress: pct }), signal);
  return true;
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
  const mode = effectiveUploadMode(uploadMode);
  const { totalParts, partSize } = computePartPlan(file.size);

  let doneParts = new Set<number>();
  try {
    const status = await fetchUploadSessionStatus(sessionId, signal);
    const fromServer = status.completedPartNumbers ?? [];
    doneParts = new Set(fromServer);
    if (doneParts.size > 0) {
      const base = Math.round((doneParts.size / totalParts) * 100);
      onProgress?.(base);
    }
  } catch {
    /* first upload — no status yet */
  }

  let uploadedBytes = 0;
  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    if (doneParts.has(partNumber)) {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(start + partSize, file.size);
      uploadedBytes += end - start;
      continue;
    }

    if (signal?.aborted) throw new Error('Upload cancelled');
    const start = (partNumber - 1) * partSize;
    const end = Math.min(start + partSize, file.size);
    const chunk = file.slice(start, end);

    if (mode === 'direct' && partUrls?.[partNumber - 1]) {
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
  const res = await uploadFetch('/api/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
    timeoutMs: 60_000,
  });
  if (!res.ok) throw new Error('Thumbnail upload failed');
  const data = (await res.json()) as { url?: string; key?: string };
  return { url: data.url ?? '', key: data.key ?? '' };
}

/** Upload JPEG frame and attach to draft clip immediately (before video chunks). */
export async function attachThumbnailToSession(
  sessionId: string,
  file: File,
  signal?: AbortSignal,
): Promise<{ url: string; key: string }> {
  const thumb = await uploadThumbnail(file);
  const res = await uploadFetch(`/api/uploads/${sessionId}/thumbnail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
    body: JSON.stringify({
      thumbnailUrl: thumb.url,
      thumbnailKey: thumb.key,
    }),
    timeoutMs: 60_000,
  });
  if (!res.ok) {
    throw new Error('Failed to attach thumbnail to clip');
  }
  return thumb;
}

export async function completeUploadSession(
  sessionId: string,
  idempotencyKey: string,
  thumb?: { url: string; key: string } | null,
  signal?: AbortSignal,
): Promise<void> {
  await withUploadBackoff(
    async () => {
      const res = await uploadFetch(`/api/uploads/${sessionId}/complete`, {
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
        signal,
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
    },
    { signal },
  );
}

export async function pollUploadUntilPublished(
  sessionId: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const maxAttempts = 15;
  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new Error('Upload cancelled');
    const data = await withUploadBackoff(
      async () => {
        const res = await uploadFetch(`/api/uploads/${sessionId}/status`, {
          credentials: 'include',
          signal,
        });
        if (!res.ok) {
          const detail = await readUploadError(res);
          if (res.status === 404 || res.status === 409) {
            throw new UploadSessionInvalidError(detail);
          }
          throw new Error(`Failed to check upload status: ${detail}`);
        }
        return res.json() as Promise<{
          progress?: number;
          clipPublished?: boolean;
          uploadStatus?: string;
        }>;
      },
      { signal },
    );
    const base = data.progress ?? 100;
    onProgress?.(Math.min(100, Math.round(85 + base * 0.15)));
    if (isUploadFinishedOnServer(data.uploadStatus, data.clipPublished)) return;
    if (data.uploadStatus === 'failed') throw new Error('Clip processing failed');
    await new Promise((r) => setTimeout(r, 2000));
  }
  // R2 upload already completed — Stream ingest continues via cron.
}
