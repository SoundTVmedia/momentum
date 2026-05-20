import { describe, expect, it } from 'vitest';
import {
  RESEND_SANDBOX_FROM,
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
    expect(resolveResendApiKey({ RESEND_API_KEY: '  re_test  ' })).toBe('re_test');
    expect(resolveResendApiKey({})).toBe('');
  });
});
