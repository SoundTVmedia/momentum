import { describe, expect, it } from 'vitest';
import { meanLuminanceLooksBlack } from '@/react-app/utils/videoThumbnail';

describe('meanLuminanceLooksBlack', () => {
  it('treats encoder-black frames as unusable', () => {
    expect(meanLuminanceLooksBlack(0)).toBe(true);
    expect(meanLuminanceLooksBlack(8)).toBe(true);
    expect(meanLuminanceLooksBlack(40)).toBe(false);
  });
});
