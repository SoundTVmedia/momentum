import { describe, expect, it } from 'vitest';
import { sniffImageContentType } from './media-proxy';

describe('sniffImageContentType', () => {
  it('detects JPEG / PNG / GIF / WebP magic bytes', () => {
    expect(sniffImageContentType(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0))).toBe(
      'image/jpeg',
    );
    expect(
      sniffImageContentType(
        Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
      ),
    ).toBe('image/png');
    expect(
      sniffImageContentType(Uint8Array.of(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)),
    ).toBe('image/gif');
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(sniffImageContentType(webp)).toBe('image/webp');
  });

  it('returns null for non-images', () => {
    expect(sniffImageContentType(Uint8Array.of(0x00, 0x01))).toBeNull();
    expect(
      sniffImageContentType(new TextEncoder().encode('<!DOCTYPE html>')),
    ).toBeNull();
  });
});
