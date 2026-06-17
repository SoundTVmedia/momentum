import { generateVideoThumbnailJpeg } from '@/react-app/utils/videoThumbnail';
import type { ClipUploadJobPayload } from '@/react-app/lib/processClipUpload';
import type { UploadOutboxJob } from './types';
import {
  resolveClassificationForUploadJob,
  uploadJobNeedsClassification,
} from './classify-for-upload';
import {
  attachThumbnailToSession,
  blobToUploadFile,
  buildUploadInitBody,
  completeUploadSession,
  pollUploadUntilPublished,
  uploadFileMultipart,
} from './multipart-upload';
import {
  clearCachedOutboxBlobs,
  persistOutboxThumbnail,
  resolveOutboxBlobs,
} from './blob-store';
import { deleteOutboxJob } from './idb';
import { withUploadBackoff } from './upload-retry';
import type { UploadInitResponse } from '@/shared/upload';

async function resolveThumbnailFile(
  job: UploadOutboxJob,
  videoFile: File,
): Promise<File | null> {
  if (job.thumbnailFile) return job.thumbnailFile;
  const blobs = await resolveOutboxBlobs(job.id);
  if (blobs?.thumbnail) {
    return new File([blobs.thumbnail], 'thumb.jpg', { type: 'image/jpeg' });
  }
  return generateVideoThumbnailJpeg(videoFile, { maxWidth: 640, quality: 0.82 });
}

export async function runOutboxJob(
  job: UploadOutboxJob,
  onPatch: (patch: Partial<UploadOutboxJob>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const blobs = await resolveOutboxBlobs(job.id);
  if (!blobs?.video) {
    throw new Error(
      'Clip video is not on this device anymore. Record and post again if needed.',
    );
  }

  const file = job.videoFile ?? blobToUploadFile(blobs.video, job.id);

  let jobForUpload = job;

  if (uploadJobNeedsClassification(job)) {
    onPatch({ status: 'classifying', progress: 1, error: null });
    const resolved = await resolveClassificationForUploadJob(job, blobs.video);
    jobForUpload = {
      ...job,
      classificationId: resolved.classificationId,
      contentFeed: resolved.contentFeed,
      classificationPending: false,
    };
    onPatch({
      classificationId: resolved.classificationId,
      contentFeed: resolved.contentFeed,
      classificationPending: false,
    });
  }

  onPatch({ status: 'uploading', progress: Math.max(job.progress, 2) });

  let sessionId = job.sessionId;
  let clipId = job.clipId;
  let uploadMode = job.uploadMode;
  let partUrls = job.partUrls;
  let attachedThumb: { url: string; key: string } | null = null;

  if (!sessionId) {
    const init = await withUploadBackoff(
      async () => {
        let initRes: Response;
        try {
          initRes = await fetch('/api/uploads/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(buildUploadInitBody(jobForUpload, file)),
          });
        } catch {
          throw new TypeError('Network error starting upload');
        }
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
        return (await initRes.json()) as UploadInitResponse;
      },
      { signal },
    );
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

  // Thumbnail is best-effort when offline — video upload can still resume.
  try {
    const thumbFile = await resolveThumbnailFile(job, file);
    if (thumbFile) {
      onPatch({ progress: Math.max(job.progress, 2) });
      attachedThumb = await attachThumbnailToSession(sessionId, thumbFile, signal);
      if (!blobs.thumbnail) {
        await persistOutboxThumbnail(job.id, thumbFile);
      }
      onPatch({ progress: Math.max(job.progress, 8) });
    }
  } catch (thumbErr) {
    console.warn('Thumbnail attach skipped (will retry on complete):', thumbErr);
  }

  await uploadFileMultipart({
    sessionId,
    file,
    uploadMode: uploadMode ?? 'worker',
    partUrls,
    signal,
    onProgress: (pct) => onPatch({ progress: Math.round(8 + pct * 0.77) }),
  });

  onPatch({ status: 'completing', progress: 88 });

  if (!attachedThumb) {
    try {
      const thumbFile = await resolveThumbnailFile(job, file);
      if (thumbFile) {
        attachedThumb = await attachThumbnailToSession(sessionId, thumbFile, signal);
      }
    } catch {
      /* complete may still succeed without thumb */
    }
  }

  await completeUploadSession(sessionId, job.idempotencyKey, attachedThumb, signal);

  onPatch({ status: 'processing', progress: 92 });

  await pollUploadUntilPublished(sessionId, (pct) => onPatch({ progress: pct }), signal);

  onPatch({ status: 'published', progress: 100 });
  clearCachedOutboxBlobs(job.id);
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
    blobsReady: false,
    classificationPending: payload.classificationPending ?? false,
  };
}

export type { ClipUploadJobPayload };
