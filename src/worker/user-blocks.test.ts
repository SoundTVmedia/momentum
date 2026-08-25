import { describe, expect, it } from 'vitest';
import { blockKey, withoutBlockedAuthors } from './user-blocks';

describe('blockKey', () => {
  it('lowercases and trims ids so mixed-case mocha ids match', () => {
    expect(blockKey('  User-ABC  ')).toBe('user-abc');
    expect(blockKey(null)).toBe('');
  });
});

describe('withoutBlockedAuthors', () => {
  it('drops rows whose author is in the hidden set', () => {
    const rows = [
      { mocha_user_id: 'Alice', title: 'keep' },
      { mocha_user_id: 'Bob', title: 'hide' },
      { mocha_user_id: ' bob ', title: 'hide-case' },
    ];
    const hidden = new Set(['bob']);
    expect(withoutBlockedAuthors(rows, hidden).map((r) => r.title)).toEqual(['keep']);
  });

  it('can filter a different author field', () => {
    const rows = [
      { related_user_id: 'x', body: 'a' },
      { related_user_id: 'y', body: 'b' },
    ];
    expect(
      withoutBlockedAuthors(rows, new Set(['y']), 'related_user_id').map((r) => r.body),
    ).toEqual(['a']);
  });

  it('returns the original array when nothing is hidden', () => {
    const rows = [{ mocha_user_id: 'a' }];
    expect(withoutBlockedAuthors(rows, new Set())).toBe(rows);
  });
});
