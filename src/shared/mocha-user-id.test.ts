import { describe, expect, it } from 'vitest';
import { navigableMochaUserId } from './mocha-user-id';

describe('navigableMochaUserId', () => {
  it('returns a trimmed real user id', () => {
    expect(navigableMochaUserId('  usr_abc  ')).toBe('usr_abc');
  });

  it('rejects missing and placeholder ids', () => {
    expect(navigableMochaUserId(null)).toBeNull();
    expect(navigableMochaUserId('')).toBeNull();
    expect(navigableMochaUserId('   ')).toBeNull();
    expect(navigableMochaUserId('deleted_user')).toBeNull();
    expect(navigableMochaUserId('Anonymous')).toBeNull();
    expect(navigableMochaUserId('me')).toBeNull();
  });
});
