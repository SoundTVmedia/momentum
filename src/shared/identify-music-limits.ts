/** ACRCloud identify API max sample size. */
export const ACR_MAX_SAMPLE_BYTES = 5 * 1024 * 1024;

/** Minimum bytes for a valid WebM/fingerprint sample (client + worker). */
export const MIN_IDENTIFY_SAMPLE_BYTES = 4096;

/** Client may POST up to this; worker trims to {@link ACR_MAX_SAMPLE_BYTES} for ACR. */
export const MAX_IDENTIFY_UPLOAD_BYTES = 12 * 1024 * 1024;

/**
 * Max audio duration sent to ShazamKit or ACRCloud on every identify path
 * (capture, upload outbox, caption screen, superadmin re-identify).
 */
export const IDENTIFY_SAMPLE_SECONDS = 12;

/**
 * Bytes of muxed A/V that typically cover {@link IDENTIFY_SAMPLE_SECONDS}
 * (~3.2 Mbps). Used when duration/size are unknown. Stays under ACRCloud's 5MB cap.
 */
export const IDENTIFY_SAMPLE_BYTES_PER_SECOND = 400_000;

function finitePositive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Byte length of a ~12s sample taken from the start of a muxed video/audio file.
 * When size + duration are known, scales to {@link IDENTIFY_SAMPLE_SECONDS} with
 * 15% mux-header headroom; otherwise uses {@link IDENTIFY_SAMPLE_BYTES_PER_SECOND}.
 * Always capped at `maxBytes` (ACRCloud 5MB by default).
 */
export function identifySampleByteLength(opts?: {
  fileSize?: number | null;
  durationSeconds?: number | null;
  maxBytes?: number;
}): number {
  const maxBytes = opts?.maxBytes ?? ACR_MAX_SAMPLE_BYTES;
  const size = finitePositive(opts?.fileSize ?? null);
  const duration = finitePositive(opts?.durationSeconds ?? null);
  if (size != null && duration != null) {
    const scaled = Math.ceil((size / duration) * IDENTIFY_SAMPLE_SECONDS * 1.15);
    return Math.min(maxBytes, Math.max(MIN_IDENTIFY_SAMPLE_BYTES, scaled));
  }
  return Math.min(maxBytes, IDENTIFY_SAMPLE_SECONDS * IDENTIFY_SAMPLE_BYTES_PER_SECOND);
}
