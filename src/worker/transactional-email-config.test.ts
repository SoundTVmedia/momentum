import { describe, expect, it } from 'vitest';
import {
  RESEND_SANDBOX_FROM,
  isUsableResendApiKey,
  resolveResendApiKey,
  resolveTransactionalEmailFrom,
} from './transactional-email-config';

describe('transactional email config', () => {
  it('defaults from address to FEEDBACK Resend sandbox sender', () => {
    expect(resolveTransactionalEmailFrom({})).toBe(RESEND_SANDBOX_FROM);
  });

  it('uses TRANSACTIONAL_EMAIL_FROM when set', () => {
    expect(
      resolveTransactionalEmailFrom({
        TRANSACTIONAL_EMAIL_FROM: 'FEEDBACK <no-reply@example.com>',
      }),
    ).toBe('FEEDBACK <no-reply@example.com>');
  });

  it('trims RESEND_API_KEY', () => {
    const key = 're_AbCdEfGh1234567890';
    expect(resolveResendApiKey({ RESEND_API_KEY: `  ${key}  ` })).toBe(key);
    expect(resolveResendApiKey({})).toBe('');
  });

  it('rejects placeholder and malformed keys', () => {
    expect(isUsableResendApiKey('re_xxxxxxxx')).toBe(false);
    expect(isUsableResendApiKey('re_xxx')).toBe(false);
    expect(isUsableResendApiKey('not-a-resend-key')).toBe(false);
    expect(isUsableResendApiKey('re_AbCdEfGh1234567890')).toBe(true);
  });

  it('ignores placeholder RESEND_API_KEY in env', () => {
    expect(resolveResendApiKey({ RESEND_API_KEY: 're_xxxxxxxx' })).toBe('');
  });
});
