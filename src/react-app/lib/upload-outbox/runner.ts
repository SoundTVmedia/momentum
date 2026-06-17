import { generateVideoThumbnailJpeg } from '@/react-app/utils/videoThumbnail';
import type { ClipUploadJobPayload } from '@/react-app/lib/processClipUpload';
import type { UploadOutboxJob } from './types';
import {
  blobToUploadFile,
  buildUploadInitBody,
  completeUploadSession,
  pollUploadUntilPublished,
  uploadFileMultipart,
  uploadThumbnail,
} from './multipart-upload';
import { deleteOutboxJob, loadOutboxBlobs } from './idb';
import type { UploadInitResponse } from '@/shared/upload';

export async function runOutboxJob(
  job: UploadOutboxJob,
  onPatch: (patch: Partial<UploadOutboxJob>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const blobs = await loadOutboxBlobs(job.id);
  if (!blobs?.video) {
    throw new Error('Video data missing from local storage');
  }

  const file =
    job.videoFile ?? blobToUploadFile(blobs.video, job.id);

  onPatch({ status: 'uploading', progress: 0, error: null });

  let sessionId = job.sessionId;
  let clipId = job.clipId;
  let uploadMode = job.uploadMode;
  let partUrls = job.partUrls;

  if (!sessionId) {
    const initRes = await fetch('/api/uploads/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(buildUploadInitBody(job, file)),
      signal,
    });
    if (!initRes.ok) {
      let msg = 'Failed to start upload';
      try {
        const body = (await initRes.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const init = (await initRes.json()) as UploadInitResponse;
    sessionId = init.sessionId;
    clipId = init.clipId;
    uploadMode = init.uploadMode;
    partUrls = init.partUrls ?? null;
    onPatch({
      sessionId,
      clipId,
      uploadMode,
      partUrls,
      totalParts: init.totalParts,
      partSize: init.partSize,
    });
  }

  await uploadFileMultipart({
    sessionId,
    file,
    uploadMode: uploadMode ?? 'worker',
    partUrls,
    signal,
    onProgress: (pct) => onPatch({ progress: Math.round(pct * 0.85) }),
  });

  onPatch({ status: 'completing', progress: 85 });

  let thumbFile = job.thumbnailFile;
  if (!thumbFile && blobs.thumbnail) {
    thumbFile = new File([blobs.thumbnail], 'thumb.jpg', { type: 'image/jpeg' });
  }
  if (!thumbFile) {
    thumbFile = await generateVideoThumbnailJpeg(file);
  }

  let thumb: { url: string; key: string } | null = null;
  if (thumbFile) {
    thumb = await uploadThumbnail(thumbFile);
  }

  await completeUploadSession(sessionId, job.idempotencyKey, thumb);

  onPatch({ status: 'processing', progress: 90 });

  await pollUploadUntilPublished(sessionId, (pct) => onPatch({ progress: pct }), signal);

  onPatch({ status: 'published', progress: 100 });
  await deleteOutboxJob(job.id);
}

export function jobFromPayload(
  payload: ClipUploadJobPayload,
  previewObjectUrl?: string | null,
): UploadOutboxJob {
  const id = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const blob = payload.videoBlob;
  const file = payload.videoFile;
  const size = file?.size ?? blob?.size ?? 0;
  const type = file?.type ?? blob?.type ?? 'video/webm';
  return {
    ...payload,
    id,
    status: 'queued',
    error: null,
    progress: 0,
    createdAt: Date.now(),
    sessionId: null,
    clipId: null,
    idempotencyKey: id,
    uploadMode: null,
    partUrls: null,
    totalParts: 0,
    partSize: 0,
    fileName: file?.name ?? `recording-${id}.webm`,
    fileSize: size,
    contentType: type,
    previewObjectUrl: previewObjectUrl ?? null,
  };
}

export type { ClipUploadJobPayload };
