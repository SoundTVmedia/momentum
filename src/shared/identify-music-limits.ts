/** ACRCloud identify API max sample size. */
export const ACR_MAX_SAMPLE_BYTES = 5 * 1024 * 1024;

/** Minimum bytes for a valid WebM/fingerprint sample (client + worker). */
export const MIN_IDENTIFY_SAMPLE_BYTES = 4096;

/** Client may POST up to this; worker trims to {@link ACR_MAX_SAMPLE_BYTES} for ACR. */
export const MAX_IDENTIFY_UPLOAD_BYTES = 12 * 1024 * 1024;

/**
 * Max audio duration sent to ShazamKit or ACRCloud on every identify path
 * (capture, upload outbox, caption screen, clip-player tap-to-identify).
 * Apple's SHSignature max is 12.000s; stay at 11s so we cannot overshoot.
 */
export const IDENTIFY_SAMPLE_SECONDS = 11;

/** Max 11s signatures per clip-player file scan. */
export const IDENTIFY_SCAN_MAX_WINDOWS = 8;

/** Target spacing between window starts when duration is known. */
export const IDENTIFY_SCAN_STEP_SECONDS = 8;

/**
 * Timeout budget for each stage of the clip-player identify pass.
 *
 * These must stay consistent with {@link IDENTIFY_CLIP_PLAYER_TIMEOUT_MS}: a
 * caller budget smaller than the native budget it wraps aborts a scan that was
 * still working, which reads as "identify always fails" in the UI.
 * `identify-music-limits.test.ts` asserts the ordering so it cannot drift again.
 */
export const IDENTIFY_NATIVE_DOWNLOAD_TIMEOUT_MS = 45_000;

/** Single 11s signature from a local file — the quick-capture upload path. */
export const IDENTIFY_SHAZAMKIT_FILE_TIMEOUT_MS = 20_000;

/** Remote progressive MP4: AVAsset track load alone allows 45s natively. */
export const IDENTIFY_SHAZAMKIT_REMOTE_FILE_TIMEOUT_MS = 50_000;

/** Overlapping 11s windows, each its own catalog lookup. */
export const IDENTIFY_SHAZAMKIT_SCAN_TIMEOUT_MS = 75_000;

/** Worker ACRCloud round trip after a clean ShazamKit no-match. */
export const IDENTIFY_ACR_FALLBACK_TIMEOUT_MS = 30_000;

/** Headroom for bridge overhead between stages. */
const IDENTIFY_STAGE_OVERHEAD_MS = 10_000;

/**
 * Whole clip-player tap-to-identify pass: download, then the ShazamKit fast
 * pass, then the window scan, then ACRCloud. Must exceed the sum of the stages
 * it wraps.
 */
export const IDENTIFY_CLIP_PLAYER_TIMEOUT_MS =
  IDENTIFY_NATIVE_DOWNLOAD_TIMEOUT_MS +
  IDENTIFY_SHAZAMKIT_FILE_TIMEOUT_MS +
  IDENTIFY_SHAZAMKIT_SCAN_TIMEOUT_MS +
  IDENTIFY_ACR_FALLBACK_TIMEOUT_MS +
  IDENTIFY_STAGE_OVERHEAD_MS;

/**
 * Bytes of muxed A/V that typically cover {@link IDENTIFY_SAMPLE_SECONDS}
 * (~3.2 Mbps). Used when duration/size are unknown. Stays under ACRCloud's 5MB cap.
 */
export const IDENTIFY_SAMPLE_BYTES_PER_SECOND = 400_000;

function finitePositive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Byte length of a ~11s sample taken from the start of a muxed video/audio file.
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
