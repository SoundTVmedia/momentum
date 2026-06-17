/** Strong pin for in-flight clip video — survives IDB failures until upload finishes. */
const pinnedVideos = new Map<string, Blob>();

export function registerClipBlob(jobId: string, video: Blob): void {
  if (!video || video.size <= 0) return;
  pinnedVideos.set(jobId, video);
}

export function getClipBlob(jobId: string): Blob | null {
  const video = pinnedVideos.get(jobId);
  if (!video || video.size <= 0) return null;
  return video;
}

export function releaseClipBlob(jobId: string): void {
  pinnedVideos.delete(jobId);
}

export function isRecoverableSaveError(error: string | null | undefined): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes('could not save clip') ||
    lower.includes('not on this device') ||
    lower.includes('video data missing')
  );
}
