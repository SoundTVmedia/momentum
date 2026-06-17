import {
  persistOutboxThumbnail,
  persistOutboxVideo,
} from '@/react-app/lib/upload-outbox/blob-store';
import { adoptPendingCaptureForJob } from '@/react-app/lib/upload-outbox/capture-local-save';
import {
  blobSourceKey,
  saveClipToDeviceGallery,
} from '@/react-app/lib/upload-outbox/gallery-save';
import { scheduleNativeBackgroundUpload } from '@/react-app/lib/native-bridge';
import { generateVideoThumbnailJpeg } from '@/react-app/utils/videoThumbnail';

/** Best-effort IDB, gallery, and thumbnail — must not block upload start. */
export async function persistClipInBackground(opts: {
  jobId: string;
  video: Blob;
  fileName: string;
  thumbnailFile?: File | null;
  onGallerySaved?: (saved: boolean) => void;
}): Promise<void> {
  const { jobId, video, fileName, thumbnailFile, onGallerySaved } = opts;

  try {
    await adoptPendingCaptureForJob(jobId, video);
    await persistOutboxVideo(jobId, video, thumbnailFile ?? null);
  } catch (err) {
    console.warn('background-persist video:', err);
    try {
      await persistOutboxVideo(jobId, video, thumbnailFile ?? null);
    } catch (fallbackErr) {
      console.warn('background-persist video fallback:', fallbackErr);
    }
  }

  try {
    const sourceKey = blobSourceKey(video);
    const gallery = await saveClipToDeviceGallery(video, fileName, {
      sourceKey,
      skipIfSaved: true,
    });
    onGallerySaved?.(gallery.method === 'native' || gallery.method === 'share');
    scheduleNativeBackgroundUpload(jobId, gallery.nativeCachePath);
  } catch (galleryErr) {
    console.warn('background-persist gallery:', galleryErr);
  }

  try {
    let thumb = thumbnailFile ?? null;
    if (!thumb) {
      thumb = await generateVideoThumbnailJpeg(video, {
        maxWidth: 640,
        quality: 0.82,
      });
    }
    if (thumb) {
      await persistOutboxThumbnail(jobId, thumb);
    }
  } catch (thumbErr) {
    console.warn('background-persist thumbnail:', thumbErr);
  }
}
