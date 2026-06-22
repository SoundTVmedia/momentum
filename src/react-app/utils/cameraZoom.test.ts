import { describe, expect, it } from 'vitest';
import {
  buildCameraZoomPresets,
  buildCaptureZoomPresets,
  clampCameraZoom,
  formatCameraZoomLabel,
  zoomFromPinchScale,
} from './cameraZoom';

describe('buildCaptureZoomPresets', () => {
  it('includes 0.5 through 3× when supported', () => {
    expect(buildCaptureZoomPresets({ min: 0.5, max: 3 })).toEqual([0.5, 1, 2, 3]);
  });

  it('omits stops outside hardware range', () => {
    expect(buildCaptureZoomPresets({ min: 1, max: 3 })).toEqual([1, 2, 3]);
  });
});

describe('buildCameraZoomPresets', () => {
  it('prefers capture presets when enough are in range', () => {
    expect(buildCameraZoomPresets({ min: 1, max: 5 })).toEqual([1, 2, 3]);
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

  it('formats ultrawide', () => {
    expect(formatCameraZoomLabel(0.5, false)).toBe('0.5');
    expect(formatCameraZoomLabel(0.5, true)).toBe('0.5×');
  });
});

describe('zoomFromPinchScale', () => {
  it('scales relative to pinch distance', () => {
    const range = { min: 1, max: 5 };
    expect(zoomFromPinchScale(1, 100, 200, range)).toBe(2);
    expect(zoomFromPinchScale(2, 200, 100, range)).toBe(1);
  });
});
