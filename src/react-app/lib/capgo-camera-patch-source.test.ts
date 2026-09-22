import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The patched Capgo plugin cannot be compiled in CI, so assert the source-level
 * invariants of patches/@capgo+camera-preview+7.5.0.patch that capture depends
 * on. Each maps to a shipped failure mode.
 */
const patch = readFileSync(
  resolve(process.cwd(), 'patches/@capgo+camera-preview+7.5.0.patch'),
  'utf8',
);
const applyScript = readFileSync(
  resolve(process.cwd(), 'scripts/apply-capgo-patch.mjs'),
  'utf8',
);

describe('capgo camera-preview patch', () => {
  it('resolves start() in video mode without waiting for a data-output frame', () => {
    // The thermal patch removes the AVCaptureVideoDataOutput in video mode, so
    // firstFrameReadyCallback never fires there. Without an explicit resolve the
    // WebView hangs on "Preparing camera…" forever (shipped 2026-09-22).
    expect(patch).toContain('FEEDBACK VIDEO MODE START RESOLVE');
    expect(patch).toContain('if self.videoCaptureMode {');
    expect(patch).toContain('call.resolve(returnedObject)');
  });

  it('still skips the uncompressed data output in video mode (thermal)', () => {
    expect(patch).toContain('FEEDBACK THERMAL PATCH');
    expect(patch).toContain('if !cameraMode, let dataOutput = self.dataOutput');
  });

  it('keeps stabilization, pinch ramp, and full-bleed hunks', () => {
    expect(patch).toContain('FEEDBACK STABILIZATION PATCH');
    expect(patch).toContain('FEEDBACK PINCH RAMP PATCH');
    expect(patch).toContain('previewLayer.videoGravity = .resizeAspectFill');
    expect(patch).toContain('movieFragmentInterval = CMTime.invalid');
  });

  it('apply script gates on every marker the app depends on', () => {
    // patchLooksApplied() short-circuits when markers pass, so a marker missing
    // from this list lets node_modules go stale against the patch file.
    for (const marker of [
      'FEEDBACK VIDEO MODE START RESOLVE',
      'FEEDBACK STABILIZATION PATCH',
      'FEEDBACK THERMAL PATCH',
      'FEEDBACK PINCH RAMP PATCH',
      'hasExplicitWidth',
      'movieFragmentInterval = CMTime.invalid',
    ]) {
      expect(applyScript).toContain(marker);
    }
  });
});
