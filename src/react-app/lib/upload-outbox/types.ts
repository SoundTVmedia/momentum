import type { ClipUploadJobPayload } from '@/react-app/lib/processClipUpload';
import type { ClipUploadStatus, UploadSessionStatus } from '@/shared/upload';

export type OutboxJobStatus =
  | 'queued'
  | 'uploading'
  | 'completing'
  | 'processing'
  | 'published'
  | 'failed';

export type StoredUploadBlobs = {
  video: Blob;
  thumbnail?: Blob | null;
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
};

export type PersistedOutboxMeta = Omit<UploadOutboxJob, 'videoFile' | 'videoBlob' | 'thumbnailFile' | 'captureAudioBlob'>;

export type UploadStatusPoll = {
  sessionStatus: UploadSessionStatus;
  uploadStatus: ClipUploadStatus;
  progress: number;
  clipPublished: boolean;
};
