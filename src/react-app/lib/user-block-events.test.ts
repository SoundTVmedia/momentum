import { describe, expect, it } from 'vitest';
import { userBlocksChangedDetail } from './user-block-events';

describe('userBlocksChangedDetail', () => {
  it('normalizes a valid block change', () => {
    const event = { detail: { userId: '  User-ABC  ', blocked: true } } as CustomEvent;

    expect(userBlocksChangedDetail(event)).toEqual({
      userId: 'user-abc',
      blocked: true,
    });
  });

  it('rejects incomplete event details', () => {
    expect(userBlocksChangedDetail({ detail: { userId: 'user-abc' } } as CustomEvent)).toBeNull();
    expect(userBlocksChangedDetail({ detail: { blocked: false } } as CustomEvent)).toBeNull();
  });
});
