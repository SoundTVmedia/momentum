import { describe, expect, it } from 'vitest';
import { planNativeParts } from './native-part-upload';

const PART = 1_000;

describe('planNativeParts', () => {
  it('splits the file into 1-based parts with a short tail', () => {
    const plan = planNativeParts(2_500, [], PART);
    expect(plan.totalParts).toBe(3);
    expect(plan.alreadyUploadedBytes).toBe(0);
    expect(plan.parts).toEqual([
      { partNumber: 1, offset: 0, length: 1_000 },
      { partNumber: 2, offset: 1_000, length: 1_000 },
      { partNumber: 3, offset: 2_000, length: 500 },
    ]);
  });

  it('skips parts the server already has after a background relaunch', () => {
    // URLSession finished parts 1 and 3 while the WebView was dead; only part 2 is missing.
    const plan = planNativeParts(2_500, [1, 3], PART);
    expect(plan.parts).toEqual([{ partNumber: 2, offset: 1_000, length: 1_000 }]);
    expect(plan.alreadyUploadedBytes).toBe(1_500);
  });

  it('ignores completed part numbers outside the plan', () => {
    const plan = planNativeParts(1_500, [0, 7, 2.5, 2], PART);
    expect(plan.parts).toEqual([{ partNumber: 1, offset: 0, length: 1_000 }]);
    expect(plan.alreadyUploadedBytes).toBe(500);
  });

  it('always yields one part for an empty or tiny file', () => {
    expect(planNativeParts(0, [], PART).parts).toEqual([{ partNumber: 1, offset: 0, length: 0 }]);
    expect(planNativeParts(10, [], PART).parts).toEqual([{ partNumber: 1, offset: 0, length: 10 }]);
  });

  it('uses the shared upload part size by default', () => {
    const plan = planNativeParts(1);
    expect(plan.totalParts).toBe(1);
    expect(plan.parts[0].length).toBe(1);
  });
});
