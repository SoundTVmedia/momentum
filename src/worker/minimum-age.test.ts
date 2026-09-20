import { describe, expect, it } from 'vitest';
import {
  AccountTooYoungError,
  ageSignalFromAppleClaims,
  ageSignalFromGooglePerson,
  assertMinimumAge,
  isYoungerThanMinAge,
} from './minimum-age';

describe('isYoungerThanMinAge', () => {
  const now = new Date('2026-09-19T12:00:00.000Z');

  it('blocks a full birthday under 13', () => {
    expect(
      isYoungerThanMinAge({ birthday: { year: 2015, month: 9, day: 20 } }, 13, now),
    ).toBe(true);
  });

  it('allows a 13th birthday that has already occurred', () => {
    expect(
      isYoungerThanMinAge({ birthday: { year: 2013, month: 9, day: 19 } }, 13, now),
    ).toBe(false);
  });

  it('treats year-only birthdays as Dec 31 so COPPA fails closed', () => {
    expect(isYoungerThanMinAge({ birthday: { year: 2013 } }, 13, now)).toBe(true);
    expect(isYoungerThanMinAge({ birthday: { year: 2012 } }, 13, now)).toBe(false);
  });

  it('blocks Apple age ranges whose upper bound is under 13', () => {
    expect(isYoungerThanMinAge({ lowerAgeBound: 0, upperAgeBound: 12 }, 13, now)).toBe(true);
    expect(isYoungerThanMinAge({ lowerAgeBound: 13, upperAgeBound: 15 }, 13, now)).toBe(false);
  });

  it('does not block when Google/Apple did not share age data', () => {
    expect(isYoungerThanMinAge({}, 13, now)).toBe(false);
    expect(isYoungerThanMinAge(null, 13, now)).toBe(false);
  });
});

describe('assertMinimumAge', () => {
  it('throws AccountTooYoungError when the signal is under 13', () => {
    expect(() =>
      assertMinimumAge({ birthday: { year: 2020, month: 1, day: 1 } }),
    ).toThrow(AccountTooYoungError);
  });
});

describe('ageSignalFromGooglePerson', () => {
  it('prefers the profile birthday with a year', () => {
    const signal = ageSignalFromGooglePerson({
      birthdays: [
        { date: { month: 3, day: 4 }, metadata: { primary: true } },
        {
          date: { year: 2014, month: 6, day: 8 },
          metadata: { source: { type: 'PROFILE' } },
        },
      ],
    });
    expect(signal.birthday).toEqual({ year: 2014, month: 6, day: 8 });
  });
});

describe('ageSignalFromAppleClaims', () => {
  it('reads a 0-12 declared age range', () => {
    expect(ageSignalFromAppleClaims({ age_range: '0-12' })).toEqual({
      birthday: null,
      lowerAgeBound: 0,
      upperAgeBound: 12,
    });
  });
});
