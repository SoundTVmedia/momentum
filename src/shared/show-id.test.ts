import { describe, expect, it } from 'vitest';
import {
  computeLegacyClipShowKey,
  computeShowId,
  isJamBaseEventId,
  majorityCaptureDay,
  normalizeJamBaseEventId,
  pickClipForShowHeader,
  resolveClipShowNavigationId,
  utcYmdFromTimestamp,
} from './show-id';

describe('show-id', () => {
  it('prefers jambase_event_id', () => {
    expect(
      computeShowId({
        jambase_event_id: 'jambase:12345',
        artist_name: 'Phish',
        venue_name: 'MSG',
        timestamp: '2025-04-20T01:00:00.000Z',
      }),
    ).toBe('jambase:12345');
  });

  it('builds composite slug from artist, venue, and UTC date', () => {
    expect(
      computeShowId({
        artist_name: 'Taylor Swift',
        venue_name: 'Madison Square Garden',
        timestamp: '2025-04-20T01:00:00.000Z',
      }),
    ).toBe('taylor-swift-madison-square-garden-2025-04-20');
  });

  it('groups clips from the same artist and venue on the same date', () => {
    const show = {
      artist_name: 'Phish',
      venue_name: 'Madison Square Garden',
    };

    expect(computeShowId({ ...show, timestamp: '2025-04-20T01:00:00.000Z' })).toBe(
      computeShowId({ ...show, timestamp: '2025-04-20T23:59:59.000Z' }),
    );
  });

  it('separates consecutive shows by date for the same artist and venue', () => {
    const show = {
      artist_name: 'Phish',
      venue_name: 'Madison Square Garden',
    };

    expect(computeShowId({ ...show, timestamp: '2025-04-20T01:00:00.000Z' })).toBe(
      'phish-madison-square-garden-2025-04-20',
    );
    expect(computeShowId({ ...show, timestamp: '2025-04-21T01:00:00.000Z' })).toBe(
      'phish-madison-square-garden-2025-04-21',
    );
  });

  it('returns null when required fields are missing', () => {
    expect(
      computeShowId({
        artist_name: 'Phish',
        venue_name: 'MSG',
      }),
    ).toBeNull();
    expect(computeShowId({ artist_name: 'Phish', timestamp: '2025-04-20T00:00:00.000Z' })).toBeNull();
  });

  it('builds the legacy database key for clips without stored ids', () => {
    expect(
      computeLegacyClipShowKey({
        artist_name: 'The Beatles',
        venue_name: 'Abbey Road Studios',
        timestamp: '2026-07-25T19:00:00.000Z',
      }),
    ).toBe('the beatles|abbey road studios|2026-07-25');
  });

  it('cannot build a legacy database key from incomplete clip identity', () => {
    expect(
      computeLegacyClipShowKey({
        artist_name: 'The Beatles',
        timestamp: '2026-07-25T19:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('parses UTC calendar day', () => {
    expect(utcYmdFromTimestamp('2025-04-20T01:00:00.000Z')).toBe('2025-04-20');
  });

  it('detects JamBase event ids', () => {
    expect(isJamBaseEventId('jambase:14852021')).toBe(true);
    expect(isJamBaseEventId('ariana-grande-barclays-center-2026-07-14')).toBe(false);
    expect(normalizeJamBaseEventId('foreigner-the-bell-auditorium-2026-09-20')).toBeNull();
    expect(normalizeJamBaseEventId('jambase:15705118')).toBe('jambase:15705118');
  });

  it('does not treat a slug stored in jambase_event_id as a JamBase show id', () => {
    expect(
      computeShowId({
        jambase_event_id: 'foreigner-the-bell-auditorium-2026-09-20',
        artist_name: 'Foreigner',
        venue_name: 'The Bell Auditorium',
        timestamp: '2026-09-20T00:13:03.119Z',
      }),
    ).toBe('foreigner-the-bell-auditorium-2026-09-20');
  });

  it('navigates mixed-id clips to the JamBase show page', () => {
    expect(
      resolveClipShowNavigationId({
        show_id: 'ariana-grande-barclays-center-2026-07-14',
        jambase_event_id: 'jambase:14852021',
        artist_name: 'Ariana Grande',
        venue_name: 'Barclays Center',
        timestamp: '2026-07-14T00:32:47.000Z',
      }),
    ).toBe('jambase:14852021');
  });

  it('picks the majority capture night for show headers', () => {
    expect(
      majorityCaptureDay([
        '2025-12-29T03:24:42.000Z',
        '2026-07-28T00:55:35.531Z',
        '2026-07-28T01:20:22.502Z',
        '2026-07-28T03:36:51.732Z',
      ]),
    ).toBe('2026-07-28');

    const header = pickClipForShowHeader([
      {
        id: 349,
        timestamp: '2025-12-29T03:24:42.000Z',
        jambase_event_id: 'jambase:15668779',
      },
      {
        id: 351,
        timestamp: '2026-07-28T00:55:35.531Z',
        jambase_event_id: 'jambase:15668779',
      },
      {
        id: 325,
        timestamp: '2026-07-28T01:20:22.502Z',
        jambase_event_id: 'jambase:15668779',
      },
    ]);
    expect(header?.id).toBe(351);
  });
});
