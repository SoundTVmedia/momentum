/** Shared upload session + clip upload status values. */

export const UPLOAD_PART_SIZE_BYTES = 5 * 1024 * 1024;

export const CLIP_UPLOAD_STATUSES = [
  'pending',
  'uploading',
  'uploaded',
  'processing',
  'ready',
  'failed',
] as const;

export type ClipUploadStatus = (typeof CLIP_UPLOAD_STATUSES)[number];

export const UPLOAD_SESSION_STATUSES = [
  'initiated',
  'uploading',
  'completed',
  'failed',
  'abandoned',
] as const;

export type UploadSessionStatus = (typeof UPLOAD_SESSION_STATUSES)[number];

export type CompletedUploadPart = {
  partNumber: number;
  etag: string;
};

export type UploadInitResponse = {
  sessionId: string;
  clipId: number;
  r2Key: string;
  multipartUploadId: string;
  partSize: number;
  totalParts: number;
  uploadMode: 'direct' | 'worker';
  partUrls?: string[];
  expiresAt: string;
};

export type UploadStatusResponse = {
  sessionId: string;
  clipId: number;
  sessionStatus: UploadSessionStatus;
  uploadStatus: ClipUploadStatus;
  completedParts: number;
  totalParts: number;
  progress: number;
  clipPublished: boolean;
  thumbnailUrl?: string | null;
  completedPartNumbers?: number[];
  error?: string | null;
};

/** Hours before an incomplete upload session is abandoned. */
export const UPLOAD_SESSION_TTL_HOURS = 24;
