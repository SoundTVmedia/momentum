import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  verifyPasswordStored,
  normalizeEmail,
  isValidEmail,
} from './auth-password-utils';

describe('auth password utils (core loop)', () => {
  it('normalizes email', () => {
    expect(normalizeEmail('  Hello@Example.COM ')).toBe('hello@example.com');
  });

  it('validates email shape', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('hashes and verifies password roundtrip', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(verifyPasswordStored('correct horse battery staple', stored)).toBe(true);
    expect(verifyPasswordStored('wrong', stored)).toBe(false);
  });

  it('rejects malformed stored hash', () => {
    expect(verifyPasswordStored('x', 'nocolon')).toBe(false);
    expect(verifyPasswordStored('x', 'bad:hexnot64chars')).toBe(false);
  });
});
