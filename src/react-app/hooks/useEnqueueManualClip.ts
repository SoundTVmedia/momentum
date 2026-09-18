import { useCallback } from 'react';
import { useClipUploadQueue } from '@/react-app/contexts/ClipUploadQueueContext';
import type { ArchivalUploadShowData } from '@/react-app/lib/archival-upload';
import { clipUploadTargetFromShowData } from '@/react-app/lib/archival-upload';
import { resolveEnqueueClassification } from '@/react-app/lib/upload-outbox/enqueue-classification';
import { extractVideoFileMetadata } from '@/react-app/utils/extractVideoFileMetadata';
import { isLibraryVideoFile } from '@/react-app/lib/pickLibraryVideo';

const MAX_LIBRARY_CLIP_BYTES = 500 * 1024 * 1024;
const MAX_LIBRARY_CLIP_SECONDS = 60;

export type EnqueueManualClipResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string };

export type EnqueueManualClipOptions = {
  /** When uploading from a show page, stamp that concert onto the clip. */
  showData?: ArchivalUploadShowData | null;
};

/**
 * Queue a dropped / library clip with no details form.
 * Show comes from the page the user started on when present; otherwise
 * file metadata and the upload pipeline fill it in.
 */
export function useEnqueueManualClip() {
  const { enqueue } = useClipUploadQueue();

  return useCallback(
    async (
      file: File,
      options?: EnqueueManualClipOptions,
    ): Promise<EnqueueManualClipResult> => {
      if (!isLibraryVideoFile(file)) {
        return { ok: false, error: 'Please choose a video clip.' };
      }
      if (file.size > MAX_LIBRARY_CLIP_BYTES) {
        return { ok: false, error: 'Video file must be less than 500MB.' };
      }

      const meta = await extractVideoFileMetadata(file);
      if (
        meta.durationSec != null &&
        Number.isFinite(meta.durationSec) &&
        meta.durationSec > MAX_LIBRARY_CLIP_SECONDS + 1
      ) {
        return { ok: false, error: 'Videos must be 1 minute or shorter.' };
      }

      const target = clipUploadTargetFromShowData(options?.showData);
      const classification = resolveEnqueueClassification({
        uploadMethod: 'file',
        form: target.form,
        storedClassificationId: null,
        classifyResult: null,
      });
      if (!classification.ok) {
        return { ok: false, error: classification.error };
      }

      const recordingAtIso = meta.recordedAtIso;
      const captureTimestampMissing = !meta.recordedAtIso;
      const captureGeo =
        meta.latitude != null && meta.longitude != null
          ? {
              latitude: meta.latitude,
              longitude: meta.longitude,
              city: null as string | null,
              state: null as string | null,
              country: null as string | null,
            }
          : null;

      const previewUrl = URL.createObjectURL(file);
      const jobId = enqueue(
        {
          uploadMethod: 'file',
          videoFile: file,
          videoBlob: null,
          thumbnailFile: null,
          videoUrl: '',
          classificationId: classification.classificationId,
          contentFeed: classification.contentFeed,
          classificationPending: classification.classificationPending,
          songIdentifyPending: true,
          form: {
            artist_name: target.form.artist_name,
            venue_name: target.form.venue_name,
            location: target.form.location,
            content_description: '',
            song_title: '',
            genre_name: '',
            hashtags: '',
          },
          jambaseLink: target.jambaseLink,
          recordingAtIso,
          captureTimestampMissing,
          captureGeo,
          videoMetadata: {
            recording_orientation: meta.recording_orientation ?? undefined,
            video_resolution_w: meta.width ?? undefined,
            video_resolution_h: meta.height ?? undefined,
          },
        },
        previewUrl,
      );

      if (!jobId) {
        URL.revokeObjectURL(previewUrl);
        return {
          ok: false,
          error: 'Could not queue this clip. Wait for an upload to finish, then try again.',
        };
      }

      return { ok: true, jobId };
    },
    [enqueue],
  );
}
