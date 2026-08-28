import { describe, expect, it } from 'vitest';
import { parseRangeHeader } from './r2-serve';
import { pickRecoveredR2VideoKey } from './r2-clip-key';

describe('parseRangeHeader', () => {
  it('parses bytes=start-end', () => {
    expect(parseRangeHeader('bytes=0-1023', 5000)).toEqual({ offset: 0, length: 1024 });
  });

  it('parses suffix range', () => {
    expect(parseRangeHeader('bytes=-500', 10_000)).toEqual({ offset: 9500, length: 500 });
  });

  it('returns unsatisfiable when start past EOF', () => {
    expect(parseRangeHeader('bytes=9000-', 100)).toBe('unsatisfiable');
  });
});

describe('pickRecoveredR2VideoKey', () => {
  const dir = 'clips/user/video/';
  const missing = `${dir}1787355436413_recording-clip_1785200186899_3vdz2sk.mp4`;
  const sibling = `${dir}1787445643137_recording-clip_1785200186899_3vdz2sk.mp4`;

  it('recovers a recording-clip sibling when the stored key is gone', () => {
    expect(pickRecoveredR2VideoKey(missing, [sibling, `${dir}other.mp4`])).toBe(sibling);
  });

  it('returns null when no sibling matches', () => {
    expect(pickRecoveredR2VideoKey(missing, [`${dir}other.mp4`])).toBeNull();
  });
});
