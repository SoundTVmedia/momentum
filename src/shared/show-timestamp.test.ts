import { describe, expect, it } from 'vitest';
import {
  formatShowCardDate,
  isoFromEventStart,
  parseShowTimeMs,
} from './show-timestamp';

describe('parseShowTimeMs', () => {
  it('rejects empty, zero, and Unix-epoch stand-ins', () => {
    expect(parseShowTimeMs(null)).toBeNull();
    expect(parseShowTimeMs('')).toBeNull();
    expect(parseShowTimeMs(0)).toBeNull();
    expect(parseShowTimeMs('0')).toBeNull();
    expect(parseShowTimeMs('1970-01-01T00:00:00.000Z')).toBeNull();
    expect(parseShowTimeMs('1969-12-31T19:00:00.000Z')).toBeNull();
  });

  it('parses real show nights', () => {
    expect(parseShowTimeMs('2026-09-18T20:00:00.000Z')).toBe(
      Date.parse('2026-09-18T20:00:00.000Z'),
    );
    expect(parseShowTimeMs('2026-09-18')).toBe(Date.parse('2026-09-18'));
  });
});

describe('isoFromEventStart', () => {
  it('stores date-only festival starts at UTC noon so the calendar day is stable', () => {
    expect(isoFromEventStart('2026-09-18')).toBe('2026-09-18T12:00:00.000Z');
  });

  it('rejects epoch starts', () => {
    expect(isoFromEventStart('1970-01-01T00:00:00.000Z')).toBeNull();
    expect(isoFromEventStart('')).toBeNull();
  });
});

describe('formatShowCardDate', () => {
  it('does not render Unix epoch as Dec 31 1969', () => {
    expect(formatShowCardDate(null)).toBe('Date TBA');
    expect(formatShowCardDate('')).toBe('Date TBA');
    expect(formatShowCardDate('1970-01-01T00:00:00.000Z')).toBe('Date TBA');
  });

  it('keeps date-only festival days on the UTC calendar date', () => {
    expect(formatShowCardDate('2026-09-18')).toBe('Fri, Sep 18, 2026');
  });
});
