import { describe, expect, it } from 'vitest';
import {
  showCalendarDay,
  showCalendarDaysApart,
  showNightKey,
} from './show-night-key';

describe('showCalendarDaysApart', () => {
  it('treats UTC midnight spill as one concert night', () => {
    expect(showCalendarDay('2026-09-19T23:43:35.989Z')).toBe('2026-09-19');
    expect(showCalendarDay('2026-09-20T00:13:03.119Z')).toBe('2026-09-20');
    expect(
      showCalendarDaysApart('2026-09-19T23:43:35.989Z', '2026-09-20T00:13:03.119Z'),
    ).toBe(1);
  });
});

describe('showNightKey', () => {
  it('ignores apostrophes in venue names', () => {
    expect(
      showNightKey('Phish', "Madison Square Garden", '2024-07-14T20:00:00'),
    ).toBe('phish|madison square garden|2024-07-14');
  });
});
