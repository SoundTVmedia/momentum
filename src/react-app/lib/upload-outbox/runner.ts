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
  effectiveUploadMode,
  fetchUploadSessionStatus,
  pollUploadUntilPublished,
  tryFinishSessionWithoutVideo,
  uploadFileMultipart,
  UploadSessionInvalidError,
  isUploadFinishedOnServer,
} from './multipart-upload';
import {
  clearCachedOutboxBlobs,
  persistOutboxThumbnail,
  resolveOutboxBlobs,
} from './blob-store';
import { releaseClipBlob } from './clip-blob-registry';
import { deleteOutboxJob } from './idb';
import { withUploadBackoff } from './upload-retry';
import { uploadFetch } from './upload-fetch';
import {
  resolveSongIdentifyForUploadJob,
  uploadJobNeedsSongIdentify,
} from './identify-for-upload';
import { runUrlOutboxJob } from './url-upload';
import type { UploadInitResponse } from '@/shared/upload';

function applyFormPatch(
  job: UploadOutboxJob,
  patch: Partial<UploadOutboxJob['form']>,
): UploadOutboxJob {
  if (!patch || Object.keys(patch).length === 0) return job;
  return { ...job, form: { ...job.form, ...patch } };
}

async function enrichJobWithAcrIfNeeded(
  job: UploadOutboxJob,
  video: Blob,
  captureAudio: Blob | null | undefined,
  onPatch: (patch: Partial<UploadOutboxJob>) => void,
): Promise<UploadOutboxJob> {
  let current = job;

  if (uploadJobNeedsClassification(job)) {
    onPatch({ status: 'classifying', progress: 1, error: null });
    const resolved = await resolveClassificationForUploadJob(job, video);
    current = applyFormPatch(
      {
        ...job,
        classificationId: resolved.classificationId,
        contentFeed: resolved.contentFeed,
        classificationPending: false,
      },
      resolved.formPatch ?? {},
    );
    onPatch({
      classificationId: resolved.classificationId,
      contentFeed: resolved.contentFeed,
      classificationPending: false,
      ...(Object.keys(resolved.formPatch ?? {}).length > 0 ? { form: current.form } : {}),
    });
  }

  if (uploadJobNeedsSongIdentify(current)) {
    onPatch({ status: 'classifying', progress: Math.max(current.progress, 2), error: null });
    const formPatch = await resolveSongIdentifyForUploadJob(current, video, captureAudio);
    current = applyFormPatch(current, formPatch);
    onPatch({
      songIdentifyPending: false,
      ...(Object.keys(formPatch).length > 0 ? { form: current.form } : {}),
    });
  }

  return current;
}

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

async function runFileUploadJob(
  job: UploadOutboxJob,
  file: File,
  blobs: NonNullable<Awaited<ReturnType<typeof resolveOutboxBlobs>>>,
  onPatch: (patch: Partial<UploadOutboxJob>) => void,
  signal?: AbortSignal,
): Promise<void> {
  let jobForUpload = job;
  let sessionId = job.sessionId;
  let uploadMode = job.uploadMode;
  let partUrls = job.partUrls;
  let attachedThumb: { url: string; key: string } | null = null;

  jobForUpload = await enrichJobWithAcrIfNeeded(
    job,
    blobs.video,
    blobs.captureAudio ?? job.captureAudioBlob,
    onPatch,
  );

  onPatch({ status: 'uploading', progress: Math.max(jobForUpload.progress, 5) });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (!sessionId) {
        const init = await withUploadBackoff(
          async () => {
            let initRes: Response;
            try {
              initRes = await uploadFetch('/api/uploads/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(buildUploadInitBody(jobForUpload, file)),
                signal,
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
        uploadMode = init.uploadMode;
        partUrls = init.partUrls ?? null;
        onPatch({
          sessionId,
          clipId: init.clipId,
          uploadMode: effectiveUploadMode(init.uploadMode),
          partUrls,
          totalParts: init.totalParts,
          partSize: init.partSize,
          progress: Math.max(job.progress, 8),
        });
      }

      await uploadFileMultipart({
        sessionId: sessionId!,
        file,
        uploadMode: effectiveUploadMode(uploadMode),
        partUrls,
        signal,
        onProgress: (pct) => onPatch({ progress: Math.round(8 + pct * 0.77) }),
      });

      onPatch({ status: 'completing', progress: 88 });

      try {
        const thumbFile = await resolveThumbnailFile(job, file);
        if (thumbFile) {
          attachedThumb = await attachThumbnailToSession(sessionId!, thumbFile, signal);
          if (!blobs.thumbnail) {
            await persistOutboxThumbnail(job.id, thumbFile);
          }
        }
      } catch (thumbErr) {
        console.warn('Thumbnail attach skipped (will retry on complete):', thumbErr);
      }

      await completeUploadSession(sessionId!, job.idempotencyKey, attachedThumb, signal);

      onPatch({ status: 'processing', progress: 92 });
      await pollUploadUntilPublished(sessionId!, (pct) => onPatch({ progress: pct }), signal);
      return;
    } catch (err) {
      if (err instanceof UploadSessionInvalidError && attempt === 0) {
        sessionId = null;
        uploadMode = null;
        partUrls = null;
        onPatch({
          sessionId: null,
          clipId: null,
          uploadMode: null,
          partUrls: null,
        });
        continue;
      }
      throw err;
    }
  }
}

export async function runOutboxJob(
  job: UploadOutboxJob,
  onPatch: (patch: Partial<UploadOutboxJob>) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (job.uploadMethod === 'url') {
    if (uploadJobNeedsClassification(job)) {
      throw new Error(
        'Add artist and venue for this clip, or upload a video file for auto-tagging.',
      );
    }
    await runUrlOutboxJob(job, onPatch, signal);
    return;
  }

  const blobs = await resolveOutboxBlobs(job.id);
  if (!blobs?.video) {
    if (job.sessionId?.trim()) {
      try {
        const status = await fetchUploadSessionStatus(job.sessionId, signal);
        if (isUploadFinishedOnServer(status.uploadStatus, status.clipPublished)) {
          onPatch({ status: 'processing', progress: 95 });
        } else {
          const finished = await tryFinishSessionWithoutVideo(
            job.sessionId,
            job.idempotencyKey,
            job.totalParts,
            onPatch,
            signal,
          );
          if (!finished) {
            throw new Error(
              'Waiting for video on this device — upload will start shortly.',
            );
          }
        }
        onPatch({ status: 'published', progress: 100 });
        clearCachedOutboxBlobs(job.id);
        releaseClipBlob(job.id);
        await deleteOutboxJob(job.id);
        return;
      } catch (err) {
        if (err instanceof UploadSessionInvalidError) {
          onPatch({
            sessionId: null,
            clipId: null,
            uploadMode: null,
            partUrls: null,
          });
          throw new Error(
            'Waiting for video on this device — upload will start shortly.',
          );
        }
        throw err;
      }
    }
    throw new Error(
      'Clip video is not on this device anymore. Record and post again if needed.',
    );
  }

  const file = job.videoFile ?? blobToUploadFile(blobs.video, job.id);

  await runFileUploadJob(job, file, blobs, onPatch, signal);

  onPatch({ status: 'published', progress: 100 });
  clearCachedOutboxBlobs(job.id);
  releaseClipBlob(job.id);
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
  const defaultExt =
    /mp4|quicktime|x-m4v/i.test(type) || /\.mp4$/i.test(file?.name ?? '')
      ? 'mp4'
      : /webm/i.test(type)
        ? 'webm'
        : 'mp4';
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
    fileName: file?.name ?? `momentum-${id}.${defaultExt}`,
    fileSize: size,
    contentType: type,
    previewObjectUrl: previewObjectUrl ?? null,
    blobsReady: false,
    gallerySaved: payload.uploadMethod === 'url',
    classificationPending: payload.classificationPending ?? false,
    songIdentifyPending: payload.songIdentifyPending,
  };
}

export type { ClipUploadJobPayload };
