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

  it('detects AVIF ftyp brand', () => {
    const avif = new Uint8Array(12);
    avif.set([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70], 0);
    avif.set([0x61, 0x76, 0x69, 0x66], 8); // avif
    expect(sniffImageContentType(avif)).toBe('image/avif');
  });

  it('returns null for non-images', () => {
    expect(sniffImageContentType(Uint8Array.of(0x00, 0x01))).toBeNull();
    expect(
      sniffImageContentType(new TextEncoder().encode('<!DOCTYPE html>')),
    ).toBeNull();
  });
});
