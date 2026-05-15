import { describe, expect, it } from 'vitest';
import { mochaUserIdKey, parseD1LastRowId } from './mocha-user-id';

describe('mochaUserIdKey', () => {
  it('stringifies numeric and string ids', () => {
    expect(mochaUserIdKey({ id: 42 })).toBe('42');
    expect(mochaUserIdKey({ id: 'uuid-abc' })).toBe('uuid-abc');
    expect(mochaUserIdKey({ id: '  trim  ' })).toBe('trim');
  });
});

describe('parseD1LastRowId', () => {
  it('accepts number and numeric string last_row_id', () => {
    expect(parseD1LastRowId(7)).toBe(7);
    expect(parseD1LastRowId('12')).toBe(12);
  });

  it('rejects invalid values', () => {
    expect(parseD1LastRowId(null)).toBeNull();
    expect(parseD1LastRowId('')).toBeNull();
    expect(parseD1LastRowId('nope')).toBeNull();
    expect(parseD1LastRowId(0)).toBeNull();
  });
});
