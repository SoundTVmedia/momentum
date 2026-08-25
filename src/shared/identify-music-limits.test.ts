import { describe, expect, it } from 'vitest';
import {
  ACR_MAX_SAMPLE_BYTES,
  IDENTIFY_ACR_FALLBACK_TIMEOUT_MS,
  IDENTIFY_CLIP_PLAYER_TIMEOUT_MS,
  IDENTIFY_NATIVE_DOWNLOAD_TIMEOUT_MS,
  IDENTIFY_SAMPLE_BYTES_PER_SECOND,
  IDENTIFY_SAMPLE_SECONDS,
  IDENTIFY_SHAZAMKIT_FILE_TIMEOUT_MS,
  IDENTIFY_SHAZAMKIT_SCAN_TIMEOUT_MS,
  MIN_IDENTIFY_SAMPLE_BYTES,
  identifySampleByteLength,
} from './identify-music-limits';

describe('clip-player identify timeout budget', () => {
  it('gives the caller more time than every native stage it wraps', () => {
    // Regression: a 60s caller timeout wrapped a 120s ShazamKit window scan, so
    // the caller aborted its own scan and tap-to-identify "always failed".
    const stages =
      IDENTIFY_NATIVE_DOWNLOAD_TIMEOUT_MS +
      IDENTIFY_SHAZAMKIT_FILE_TIMEOUT_MS +
      IDENTIFY_SHAZAMKIT_SCAN_TIMEOUT_MS +
      IDENTIFY_ACR_FALLBACK_TIMEOUT_MS;
    expect(IDENTIFY_CLIP_PLAYER_TIMEOUT_MS).toBeGreaterThan(stages);
  });

  it('keeps the scan budget above a single-file read', () => {
    expect(IDENTIFY_SHAZAMKIT_SCAN_TIMEOUT_MS).toBeGreaterThan(
      IDENTIFY_SHAZAMKIT_FILE_TIMEOUT_MS,
    );
  });
});

describe('identifySampleByteLength', () => {
  it('uses an 11s default under the ACRCloud 5MB cap when duration is unknown', () => {
    expect(IDENTIFY_SAMPLE_SECONDS).toBe(11);
    const n = identifySampleByteLength();
    expect(n).toBe(IDENTIFY_SAMPLE_SECONDS * IDENTIFY_SAMPLE_BYTES_PER_SECOND);
    expect(n).toBeLessThanOrEqual(ACR_MAX_SAMPLE_BYTES);
    expect(n).toBeGreaterThan(MIN_IDENTIFY_SAMPLE_BYTES);
  });

  it('scales a 60s file down to ~11s with mux headroom, capped at ACR max', () => {
    const n = identifySampleByteLength({
      fileSize: 30 * 1024 * 1024,
      durationSeconds: 60,
    });
    // 30MB * 11/60 * 1.15 = 6.325MB → capped at 5MB
    expect(n).toBe(ACR_MAX_SAMPLE_BYTES);
  });

  it('requests ~11s of a typical Stream MP4 (not the whole clip)', () => {
    const n = identifySampleByteLength({
      fileSize: 15 * 1024 * 1024,
      durationSeconds: 60,
    });
    // 15MB * 11/60 * 1.15 = 3.1625MB
    expect(n).toBe(Math.ceil(((15 * 1024 * 1024) / 60) * IDENTIFY_SAMPLE_SECONDS * 1.15));
    expect(n).toBeLessThan(ACR_MAX_SAMPLE_BYTES);
  });

  it('does not exceed maxBytes even for a short high-bitrate file', () => {
    expect(
      identifySampleByteLength({
        fileSize: 8 * 1024 * 1024,
        durationSeconds: 12,
        maxBytes: ACR_MAX_SAMPLE_BYTES,
      }),
    ).toBe(ACR_MAX_SAMPLE_BYTES);
  });

  it('ignores non-positive size/duration', () => {
    expect(identifySampleByteLength({ fileSize: 0, durationSeconds: 60 })).toBe(
      IDENTIFY_SAMPLE_SECONDS * IDENTIFY_SAMPLE_BYTES_PER_SECOND,
    );
    expect(identifySampleByteLength({ fileSize: 1_000_000, durationSeconds: NaN })).toBe(
      IDENTIFY_SAMPLE_SECONDS * IDENTIFY_SAMPLE_BYTES_PER_SECOND,
    );
  });
});
