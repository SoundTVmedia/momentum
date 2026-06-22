import { describe, expect, it } from 'vitest';
import {
  APP_MAX_CAMERA_ZOOM,
  buildCameraZoomPresets,
  buildCaptureZoomPresets,
  captureZoomRange,
  clampCameraZoom,
  decomposeCaptureZoom,
  formatCameraZoomLabel,
  zoomFromPinchScale,
} from './cameraZoom';

describe('captureZoomRange', () => {
  it('caps UI max at APP_MAX_CAMERA_ZOOM', () => {
    expect(captureZoomRange({ min: 1, max: 10 })).toEqual({ min: 1, max: APP_MAX_CAMERA_ZOOM });
  });

  it('preserves ultrawide min', () => {
    expect(captureZoomRange({ min: 0.5, max: 5 })).toEqual({ min: 0.5, max: APP_MAX_CAMERA_ZOOM });
  });
});

describe('decomposeCaptureZoom', () => {
  it('uses optical zoom when within hardware max', () => {
    const hardware = { min: 1, max: 5 };
    const capture = captureZoomRange(hardware);
    expect(decomposeCaptureZoom(3, hardware, capture)).toEqual({
      level: 3,
      optical: 3,
      digitalScale: 1,
    });
  });

  it('uses digital preview when target exceeds optical max', () => {
    const hardware = { min: 1, max: 2 };
    const capture = captureZoomRange(hardware);
    expect(decomposeCaptureZoom(3, hardware, capture)).toEqual({
      level: 3,
      optical: 2,
      digitalScale: 1.5,
    });
  });
});

describe('buildCaptureZoomPresets', () => {
  it('includes 0.5 through 3× when supported', () => {
    expect(buildCaptureZoomPresets({ min: 0.5, max: 3 })).toEqual([0.5, 1, 2, 3]);
  });

  it('omits stops outside range', () => {
    expect(buildCaptureZoomPresets({ min: 1, max: 3 })).toEqual([1, 2, 3]);
  });

  it('never includes zoom above 3×', () => {
    const presets = buildCaptureZoomPresets(captureZoomRange({ min: 0.5, max: 15 }));
    expect(presets).toEqual([0.5, 1, 2, 3]);
    expect(Math.max(...presets)).toBeLessThanOrEqual(3);
  });
});

describe('buildCameraZoomPresets', () => {
  it('prefers capture presets when enough are in range', () => {
    expect(buildCameraZoomPresets(captureZoomRange({ min: 1, max: 10 }))).toEqual([1, 2, 3]);
  });

  it('includes ultrawide when supported', () => {
    expect(buildCameraZoomPresets({ min: 0.5, max: 3 })).toEqual([0.5, 1, 2, 3]);
  });
});

describe('clampCameraZoom', () => {
  it('clamps and steps', () => {
    expect(clampCameraZoom(2.3, { min: 1, max: 5, step: 0.5 })).toBe(2.5);
    expect(clampCameraZoom(9, { min: 1, max: 5 })).toBe(5);
    expect(clampCameraZoom(5, { min: 1, max: 3 })).toBe(3);
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
  it('scales relative to pinch distance and respects 3× cap', () => {
    const range = captureZoomRange({ min: 1, max: 10 });
    expect(zoomFromPinchScale(1, 100, 200, range)).toBe(2);
    expect(zoomFromPinchScale(2, 100, 200, range)).toBe(3);
    expect(zoomFromPinchScale(2, 200, 400, range)).toBe(3);
  });
});
