import { describe, expect, it } from 'vitest';
import { defaultDisplayNameFromEmail } from './oauth-profile-bootstrap';

describe('defaultDisplayNameFromEmail', () => {
  it('uses the email local-part for the display name', () => {
    expect(defaultDisplayNameFromEmail('jane.doe@example.com')).toBe('jane.doe');
    expect(defaultDisplayNameFromEmail('  WES@SoundTVMedia.com  ')).toBe('wes');
  });

  it('allows an explicit display name override (email signup)', () => {
    expect(defaultDisplayNameFromEmail('jane.doe@example.com', 'Jane Doe')).toBe(
      'Jane Doe',
    );
  });
});
