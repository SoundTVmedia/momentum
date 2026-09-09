import type { ClipUploadJobPayload } from '@/react-app/lib/processClipUpload';
import type { ClipUploadStatus, UploadSessionStatus } from '@/shared/upload';

export type OutboxJobStatus =
  | 'queued'
  | 'classifying'
  | 'uploading'
  | 'completing'
  | 'processing'
  | 'waiting'
  | 'paused'
  | 'published'
  | 'failed';

export type StoredUploadBlobs = {
  video: Blob;
  thumbnail?: Blob | null;
  /** Parallel mic recording from capture — improves queue-time ACR after refresh. */
  captureAudio?: Blob | null;
};

export type UploadOutboxJob = ClipUploadJobPayload & {
  id: string;
  status: OutboxJobStatus;
  error: string | null;
  progress: number;
  createdAt: number;
  /** Server session after init */
  sessionId: string | null;
  clipId: number | null;
  idempotencyKey: string;
  uploadMode: 'direct' | 'worker' | null;
  partUrls: string[] | null;
  totalParts: number;
  partSize: number;
  fileName: string;
  fileSize: number;
  contentType: string;
  previewObjectUrl: string | null;
  /** False until video blob is in local cache (memory or IndexedDB). */
  blobsReady: boolean;
  /** False until photo-library save attempt completes (file uploads). */
  gallerySaved?: boolean;
  /** Best-effort gallery / share / device cache */
  savedToDevice?: boolean;
  /** Native filesystem path that survives app kill / device restart (Application Support). */
  nativeVideoUri?: string;
  /** Auto-retry counter for transient upload failures */
  uploadRetryCount?: number;
  /**
   * True when the clip has no capture timestamp from file metadata.
   * Do not fall back to upload/post time for show matching.
   */
  captureTimestampMissing?: boolean;
};

export type PersistedOutboxMeta = Omit<UploadOutboxJob, 'videoFile' | 'videoBlob' | 'thumbnailFile' | 'captureAudioBlob'>;

export type UploadStatusPoll = {
  sessionStatus: UploadSessionStatus;
  uploadStatus: ClipUploadStatus;
  progress: number;
  clipPublished: boolean;
};
