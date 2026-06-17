import { describe, expect, it } from 'vitest';
import { UPLOAD_PART_SIZE_BYTES } from '../shared/upload';
import { computeTotalParts } from '../worker/r2-multipart-presign';

describe('upload multipart planning', () => {
  it('computes single part for small files', () => {
    expect(computeTotalParts(1024)).toBe(1);
  });

  it('computes multiple parts for large files', () => {
    const size = UPLOAD_PART_SIZE_BYTES * 3 + 1;
    expect(computeTotalParts(size)).toBe(4);
  });
});
