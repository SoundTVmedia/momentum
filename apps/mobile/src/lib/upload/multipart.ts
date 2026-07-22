import { UPLOAD_PART_SIZE_BYTES } from '@shared/upload';
import { apiFetch, apiJson } from '@/src/lib/api/client';

const PART_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000, 45_000];
const MAX_UPLOAD_ATTEMPTS = PART_RETRY_DELAYS_MS.length + 1;
const PART_TIMEOUT_MS = 300_000;

export type CaptureGeo = {
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  country: string | null;
} | null;

export type UploadFormFields = {
  artist_name: string;
  venue_name: string;
  location: string;
  content_description: string;
  song_title: string;
  genre_name: string;
  hashtags: string;
};

export type OutboxJobStatus =
  | 'queued'
  | 'uploading'
  | 'completing'
  | 'processing'
  | 'paused'
  | 'published'
  | 'failed';

export type OutboxJob = {
  id: string;
  status: OutboxJobStatus;
  error: string | null;
  progress: number;
  createdAt: number;
  videoUri: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  form: UploadFormFields;
  recordingAtIso: string | null;
  captureGeo: CaptureGeo;
  videoMetadata: {
    recording_orientation?: 'portrait' | 'landscape';
    video_resolution_w?: number;
    video_resolution_h?: number;
  };
  sessionId: string | null;
  clipId: number | null;
  idempotencyKey: string;
  gallerySaved: boolean;
  uploadRetryCount: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientUploadError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return (
      m.includes('network') ||
      m.includes('failed to fetch') ||
      m.includes('timed out') ||
      m.includes('timeout') ||
      m.includes('part ') ||
      m.includes('connection') ||
      m.includes('502') ||
      m.includes('503') ||
      m.includes('504') ||
      m.includes('429')
    );
  }
  return false;
}

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientUploadError(err) || attempt >= MAX_UPLOAD_ATTEMPTS - 1) {
        throw err;
      }
      await sleep(PART_RETRY_DELAYS_MS[attempt] ?? 45_000);
    }
  }
  throw lastErr;
}

async function fetchWithTimeout(
  path: string,
  init: RequestInit,
  timeoutMs = PART_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await apiFetch(path, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new TypeError('Upload request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function buildInitBody(job: OutboxJob): Record<string, unknown> {
  return {
    fileName: job.fileName,
    fileSize: job.fileSize,
    contentType: job.contentType,
    artist_name: job.form.artist_name || null,
    venue_name: job.form.venue_name || null,
    location: job.form.location || null,
    content_description: job.form.content_description || null,
    hashtags: job.form.hashtags
      ? job.form.hashtags
          .split(/[\s,]+/)
          .map((t) => t.replace(/^#/, '').trim())
          .filter(Boolean)
      : null,
    song_title: job.form.song_title || null,
    genre_name: job.form.genre_name || null,
    timestamp: job.recordingAtIso || undefined,
    geolocation_latitude: job.captureGeo?.latitude,
    geolocation_longitude: job.captureGeo?.longitude,
    recording_orientation: job.videoMetadata.recording_orientation || null,
    video_resolution_w: job.videoMetadata.video_resolution_w || null,
    video_resolution_h: job.videoMetadata.video_resolution_h || null,
  };
}

export async function initUploadSession(job: OutboxJob): Promise<{
  sessionId: string;
  clipId: number;
  partSize: number;
  totalParts: number;
}> {
  const data = await apiJson<{
    sessionId: string;
    clipId: number;
    partSize: number;
    totalParts: number;
  }>('/api/uploads/init', {
    method: 'POST',
    body: JSON.stringify(buildInitBody(job)),
  });
  return data;
}

async function uploadPart(
  sessionId: string,
  partNumber: number,
  chunk: Blob,
): Promise<void> {
  await withBackoff(async () => {
    const res = await fetchWithTimeout(`/api/uploads/${sessionId}/parts/${partNumber}`, {
      method: 'PUT',
      body: chunk,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Part ${partNumber} upload failed: ${text || res.status}`);
    }
  });
}

export async function completeUploadSession(
  sessionId: string,
  idempotencyKey: string,
): Promise<void> {
  await withBackoff(async () => {
    const res = await fetchWithTimeout(`/api/uploads/${sessionId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Complete failed: ${text || res.status}`);
    }
  });
}

export async function pollUntilPublished(
  sessionId: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const status = await apiJson<{
      uploadStatus?: string;
      clipPublished?: boolean;
      progress?: number;
    }>(`/api/uploads/${sessionId}/status`);
    if (status.clipPublished || status.uploadStatus === 'ready') {
      onProgress?.(100);
      return;
    }
    if (typeof status.progress === 'number') {
      onProgress?.(Math.max(90, Math.min(99, status.progress)));
    }
    await sleep(1500);
  }
  throw new Error('Timed out waiting for clip to publish');
}

/** Slice a local file URI into multipart chunks and upload via Worker. */
export async function uploadVideoFileMultipart(options: {
  sessionId: string;
  fileUri: string;
  fileSize: number;
  onProgress?: (pct: number) => void;
}): Promise<void> {
  const { sessionId, fileUri, fileSize, onProgress } = options;
  const partSize = UPLOAD_PART_SIZE_BYTES;
  const totalParts = Math.max(1, Math.ceil(fileSize / partSize));

  // Read once — concert clips are ≤60s so this stays bounded.
  const response = await fetch(fileUri);
  if (!response.ok) {
    throw new Error('Could not read the recorded video file for upload.');
  }
  const blob = await response.blob();
  let uploaded = 0;

  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const start = (partNumber - 1) * partSize;
    const end = Math.min(start + partSize, fileSize);
    const chunk = blob.slice(start, end);
    await uploadPart(sessionId, partNumber, chunk);
    uploaded += chunk.size;
    onProgress?.(Math.round((uploaded / Math.max(fileSize, 1)) * 100));
  }
}

export function newJobId(): string {
  return `clip_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function newIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
