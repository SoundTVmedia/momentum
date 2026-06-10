import { describe, expect, it } from 'vitest';
import {
  buildCameraZoomPresets,
  clampCameraZoom,
  formatCameraZoomLabel,
  zoomFromPinchScale,
} from './cameraZoom';

describe('buildCameraZoomPresets', () => {
  it('includes common stops within range', () => {
    expect(buildCameraZoomPresets({ min: 1, max: 5 })).toEqual([1, 2, 3, 5]);
  });

  it('includes ultrawide when supported', () => {
    expect(buildCameraZoomPresets({ min: 0.5, max: 3 })).toEqual([0.5, 1, 2, 3]);
  });
});

describe('clampCameraZoom', () => {
  it('clamps and steps', () => {
    expect(clampCameraZoom(2.3, { min: 1, max: 5, step: 0.5 })).toBe(2.5);
    expect(clampCameraZoom(9, { min: 1, max: 5 })).toBe(5);
  });
});

describe('formatCameraZoomLabel', () => {
  it('marks active 1x with multiply sign', () => {
    expect(formatCameraZoomLabel(1, true)).toBe('1×');
    expect(formatCameraZoomLabel(1, false)).toBe('1');
    expect(formatCameraZoomLabel(2, true)).toBe('2×');
  });
});

describe('zoomFromPinchScale', () => {
  it('scales relative to pinch distance', () => {
    const range = { min: 1, max: 5 };
    expect(zoomFromPinchScale(1, 100, 200, range)).toBe(2);
    expect(zoomFromPinchScale(2, 200, 100, range)).toBe(1);
  });
});
