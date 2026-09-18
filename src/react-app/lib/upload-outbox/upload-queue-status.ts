import type { UploadOutboxJob } from './types';
import { isBlobWaitPauseError } from './blob-store';
import { isNetworkAvailable } from './network-utils';

export function uploadJobLabel(job: UploadOutboxJob): string {
  return (
    job.jambaseLink?.eventTitle?.trim() ||
    job.form.artist_name?.trim() ||
    job.form.venue_name?.trim() ||
    'Your clip'
  );
}

export function uploadJobStatusText(job: UploadOutboxJob): string {
  if (job.status === 'published') {
    if (job.captureTimestampMissing && !job.jambaseLink?.event) {
      return 'Posted — choose a show (no capture time on this file)';
    }
    return 'Posted';
  }
  if (job.status === 'waiting') {
    return 'Waiting for connection';
  }
  if (job.status === 'paused') {
    if (isBlobWaitPauseError(job.error)) {
      return 'Restoring clip from this device…';
    }
    return 'Waiting to retry — saved on this device';
  }
  if (job.status === 'failed') {
    return job.error ?? 'Upload failed';
  }
  if (job.status === 'queued' && !isNetworkAvailable()) {
    return 'Waiting for connection';
  }
  if (job.status === 'queued') return 'Pending';
  if (job.status === 'classifying') return 'Identifying song…';
  if (job.status === 'uploading') return `Uploading ${Math.max(0, Math.min(100, job.progress))}%`;
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
    job.status === 'paused' ||
    job.status === 'waiting'
  );
}

export function uploadJobShowProgress(job: UploadOutboxJob): boolean {
  return (
    job.status === 'uploading' ||
    job.status === 'classifying' ||
    job.status === 'completing' ||
    job.status === 'processing'
  );
}

export function uploadJobCanRestart(job: UploadOutboxJob): boolean {
  return job.status === 'failed';
}

export function uploadJobNeedsShowPicker(job: UploadOutboxJob): boolean {
  return (
    job.status === 'published' &&
    Boolean(job.captureTimestampMissing) &&
    !job.jambaseLink?.event
  );
}

/** Oldest first — matches FIFO upload order (active clip is next at the top). */
export function sortUploadJobsForDisplay(jobs: UploadOutboxJob[]): UploadOutboxJob[] {
  return [...jobs].sort((a, b) => a.createdAt - b.createdAt);
}
