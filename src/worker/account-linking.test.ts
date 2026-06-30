import { describe, expect, it } from 'vitest';
import { normalizeEmail } from './auth-password-utils';

describe('normalizeEmail (account linking)', () => {
  it('matches OAuth and signup emails case-insensitively', () => {
    expect(normalizeEmail('Wes@SoundTVMedia.com')).toBe('wes@soundtvmedia.com');
    expect(normalizeEmail('  wes@soundtvmedia.com  ')).toBe('wes@soundtvmedia.com');
  });
});
