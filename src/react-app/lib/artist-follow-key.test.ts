import { describe, expect, it } from 'vitest';
import {
  artistFollowApiTarget,
  artistFollowStateKeys,
  artistNameFollowKey,
} from './artist-follow-key';

describe('artistFollowStateKeys', () => {
  it('does not share artist-0 across unnamed JamBase artists', () => {
    expect(artistFollowStateKeys(0, 'Ariana Grande')).toEqual(['artist-name:ariana grande']);
    expect(artistFollowStateKeys(0, 'Ariana Grande')).not.toContain('artist-0');
    expect(artistFollowStateKeys(0, 'Phish')).not.toEqual(artistFollowStateKeys(0, 'Ariana Grande'));
  });

  it('tracks known artists by id and normalized name', () => {
    expect(artistFollowStateKeys(12, 'Ariana Grande')).toEqual([
      'artist-12',
      'artist-name:ariana grande',
    ]);
  });

  it('returns no state keys without an id or name', () => {
    expect(artistFollowStateKeys(0)).toEqual([]);
    expect(artistFollowStateKeys(0, '   ')).toEqual([]);
  });
});

describe('artistFollowApiTarget', () => {
  it('still posts unknown artists to artist-0 with a name body', () => {
    expect(artistFollowApiTarget(0)).toBe('artist-0');
    expect(artistNameFollowKey('Ariana  Grande')).toBe('artist-name:ariana grande');
  });
});
