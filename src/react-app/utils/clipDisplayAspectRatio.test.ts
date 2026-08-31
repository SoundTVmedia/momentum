import { describe, expect, it } from 'vitest';
import { clipPlayerFramePixels, clipPlayerLayout } from './clipDisplayAspectRatio';

describe('clipPlayerLayout', () => {
  it('fills width for 16:9 landscape', () => {
    expect(
      clipPlayerLayout({ video_resolution_w: 1920, video_resolution_h: 1080 }),
    ).toEqual({ fillWidth: true, aspectRatio: '1920 / 1080', width: 1920, height: 1080 });
  });

  it('fills height for 9:16 portrait', () => {
    expect(
      clipPlayerLayout({ video_resolution_w: 1080, video_resolution_h: 1920 }),
    ).toEqual({ fillWidth: false, aspectRatio: '1080 / 1920', width: 1080, height: 1920 });
  });

  it('treats coded landscape pixels as portrait when orientation says so', () => {
    expect(
      clipPlayerLayout({
        recording_orientation: 'portrait',
        video_resolution_w: 1920,
        video_resolution_h: 1080,
      }),
    ).toEqual({ fillWidth: false, aspectRatio: '1080 / 1920', width: 1080, height: 1920 });
  });

  it('prefers measured pixels over stored resolution', () => {
    expect(
      clipPlayerLayout(
        { video_resolution_w: 1920, video_resolution_h: 1080 },
        { width: 1080, height: 1920 },
      ),
    ).toEqual({ fillWidth: false, aspectRatio: '1080 / 1920', width: 1080, height: 1920 });
  });

  it('does not swap portrait pixels just because orientation says landscape', () => {
    expect(
      clipPlayerLayout({
        recording_orientation: 'landscape',
        video_resolution_w: 402,
        video_resolution_h: 874,
      }),
    ).toEqual({ fillWidth: false, aspectRatio: '402 / 874', width: 402, height: 874 });
  });
});

describe('clipPlayerFramePixels', () => {
  it('makes 16:9 span the player width (bars above/below on a tall pane)', () => {
    expect(
      clipPlayerFramePixels({ width: 745, height: 970 }, clipPlayerLayout({
        video_resolution_w: 1920,
        video_resolution_h: 1080,
      })),
    ).toEqual({ width: 745, height: 745 / (1920 / 1080) });
  });

  it('makes 9:16 span the player height (side bars on a wide pane)', () => {
    expect(
      clipPlayerFramePixels({ width: 745, height: 970 }, clipPlayerLayout({
        video_resolution_w: 1080,
        video_resolution_h: 1920,
      })),
    ).toEqual({ height: 970, width: 970 * (1080 / 1920) });
  });

  it('crops 9:16 sides when the player is narrower than the height-fitted frame', () => {
    const frame = clipPlayerFramePixels(
      { width: 390, height: 844 },
      clipPlayerLayout({ video_resolution_w: 1080, video_resolution_h: 1920 }),
    );
    expect(frame.height).toBe(844);
    expect(frame.width).toBeGreaterThan(390);
  });
});
