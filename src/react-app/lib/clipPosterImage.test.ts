import { describe, expect, it } from 'vitest';
import { posterPixelsLookUnusable } from '@/react-app/lib/clipPosterImage';

function rgbaFill(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return data;
}

describe('posterPixelsLookUnusable', () => {
  it('rejects solid black frames', () => {
    expect(posterPixelsLookUnusable(rgbaFill(32, 32, 0, 0, 0), 32, 32)).toBe(true);
  });

  it('rejects near-white flash frames', () => {
    expect(posterPixelsLookUnusable(rgbaFill(32, 32, 255, 255, 255), 32, 32)).toBe(true);
  });

  it('keeps a varied concert-like frame', () => {
    const data = rgbaFill(32, 32, 40, 20, 10);
    for (let i = 0; i < data.length; i += 4) {
      const t = (i / 4) % 32;
      data[i] = Math.min(255, 30 + t * 6);
      data[i + 1] = Math.min(255, 10 + t * 3);
      data[i + 2] = 80;
    }
    expect(posterPixelsLookUnusable(data, 32, 32)).toBe(false);
  });
});
