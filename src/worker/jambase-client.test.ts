import { describe, expect, it } from 'vitest';
import { normalizeJamBaseApiKey } from './jambase-client';

describe('normalizeJamBaseApiKey', () => {
  it('trims whitespace', () => {
    expect(normalizeJamBaseApiKey('  abc  ')).toBe('abc');
  });

  it('strips Bearer prefix', () => {
    expect(normalizeJamBaseApiKey('Bearer my-key')).toBe('my-key');
  });

  it('strips wrapping quotes', () => {
    expect(normalizeJamBaseApiKey('"my-key"')).toBe('my-key');
  });
});
