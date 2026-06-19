import type { UploadOutboxJob } from './types';
import { isBlobWaitPauseError, isRetryableUploadError } from './blob-store';
import { isRecoverableSaveError } from './clip-blob-registry';
import { isNetworkAvailable } from './network-utils';

export function uploadJobLabel(job: UploadOutboxJob): string {
  return job.form.artist_name?.trim() || job.form.venue_name?.trim() || 'Your clip';
}

export function uploadJobStatusText(job: UploadOutboxJob): string {
  if (job.status === 'published') return 'Posted';
  if (job.status === 'paused') {
    if (isBlobWaitPauseError(job.error)) {
      return 'Restoring clip from this device…';
    }
    return 'Waiting to retry — saved on this device';
  }
  if (job.status === 'failed') {
    if (isRetryableUploadError(job.error) || isRecoverableSaveError(job.error)) {
      return 'Retrying automatically…';
    }
    return job.error ?? 'Upload failed';
  }
  if (job.status === 'queued' && !isNetworkAvailable()) {
    return 'Saved on device — waiting for connection…';
  }
  if (job.status === 'queued') return 'Waiting in queue…';
  if (job.status === 'classifying') return 'Identifying song…';
  if (job.status === 'uploading') return 'Uploading video…';
  if (job.status === 'completing') return 'Finishing upload…';
  if (job.status === 'processing') return 'Processing…';
  return 'Uploading…';
}

export function uploadJobIsActive(job: UploadOutboxJob): boolean {
  return (
    job.status === 'queued' ||
    job.status === 'classifying' ||
    job.status === 'uploading' ||
    job.status === 'completing' ||
    job.status === 'processing' ||
    job.status === 'paused'
  );
}

export function uploadJobShowProgress(job: UploadOutboxJob): boolean {
  return uploadJobIsActive(job) || job.status === 'failed';
}

export function uploadJobCanRestart(job: UploadOutboxJob): boolean {
  return job.status === 'failed' || job.status === 'paused';
}

/** Oldest first — matches FIFO upload order (active clip is next at the top). */
export function sortUploadJobsForDisplay(jobs: UploadOutboxJob[]): UploadOutboxJob[] {
  return [...jobs].sort((a, b) => a.createdAt - b.createdAt);
}
