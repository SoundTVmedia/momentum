import { describe, expect, it } from 'vitest';
import { clipPostedAt, formatRelativeTime } from './formatRelativeTime';

describe('formatRelativeTime', () => {
  it('returns Recently for invalid values', () => {
    expect(formatRelativeTime(undefined)).toBe('Recently');
    expect(formatRelativeTime('')).toBe('Recently');
    expect(formatRelativeTime('not-a-date')).toBe('Recently');
  });

  it('never returns NaN in the output', () => {
    expect(formatRelativeTime(undefined)).not.toMatch(/NaN/);
  });

  it('formats recent times', () => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    expect(formatRelativeTime(new Date(fiveMinAgo).toISOString())).toBe('5 min ago');
  });
});

describe('clipPostedAt', () => {
  it('prefers created_at when valid', () => {
    expect(
      clipPostedAt({
        created_at: '2025-01-01T00:00:00.000Z',
        timestamp: '2024-01-01T00:00:00.000Z',
      }),
    ).toBe('2025-01-01T00:00:00.000Z');
  });

  it('falls back to timestamp', () => {
    expect(
      clipPostedAt({
        created_at: undefined,
        timestamp: '2024-06-01T12:00:00.000Z',
      }),
    ).toBe('2024-06-01T12:00:00.000Z');
  });
});
