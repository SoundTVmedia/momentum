import { describe, expect, it } from 'vitest';
import {
  ACR_MAX_SAMPLE_BYTES,
  IDENTIFY_SAMPLE_BYTES_PER_SECOND,
  IDENTIFY_SAMPLE_SECONDS,
  MIN_IDENTIFY_SAMPLE_BYTES,
  identifySampleByteLength,
} from './identify-music-limits';

describe('identifySampleByteLength', () => {
  it('uses a 12s default under the ACRCloud 5MB cap when duration is unknown', () => {
    expect(IDENTIFY_SAMPLE_SECONDS).toBe(12);
    const n = identifySampleByteLength();
    expect(n).toBe(IDENTIFY_SAMPLE_SECONDS * IDENTIFY_SAMPLE_BYTES_PER_SECOND);
    expect(n).toBeLessThanOrEqual(ACR_MAX_SAMPLE_BYTES);
    expect(n).toBeGreaterThan(MIN_IDENTIFY_SAMPLE_BYTES);
  });

  it('scales a 60s file down to ~12s with mux headroom, capped at ACR max', () => {
    const n = identifySampleByteLength({
      fileSize: 30 * 1024 * 1024,
      durationSeconds: 60,
    });
    // 30MB * 12/60 * 1.15 = 6.9MB → capped at 5MB
    expect(n).toBe(ACR_MAX_SAMPLE_BYTES);
  });

  it('requests ~12s of a typical Stream MP4 (not the whole clip)', () => {
    const n = identifySampleByteLength({
      fileSize: 15 * 1024 * 1024,
      durationSeconds: 60,
    });
    // 15MB * 12/60 * 1.15 = 3.45MB
    expect(n).toBe(Math.ceil(((15 * 1024 * 1024) / 60) * 12 * 1.15));
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
