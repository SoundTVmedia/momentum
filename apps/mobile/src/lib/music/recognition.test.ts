import { describe, expect, it } from 'vitest';
import {
  applyRecognitionPrefill,
  errorOutcome,
  matchedOutcome,
  noMatchOutcome,
  normalizeAcrCloudIdentifyMatch,
  normalizeShazamKitMatch,
  recognitionStatusText,
  shouldFallBackToAcrCloud,
  unavailableOutcome,
  type MusicRecognitionMatch,
} from './recognition';

function match(overrides: Partial<MusicRecognitionMatch> = {}): MusicRecognitionMatch {
  return {
    title: 'Harvest Moon',
    artist: 'Neil Young',
    album: null,
    genres: [],
    isrc: null,
    appleMusicId: null,
    appleMusicUrl: null,
    provider: 'shazamkit',
    confidence: null,
    ...overrides,
  };
}

describe('normalizeShazamKitMatch', () => {
  it('normalizes a full native payload', () => {
    const m = normalizeShazamKitMatch({
      title: '  Harvest Moon ',
      artist: 'Neil Young',
      album: null,
      genres: ['Rock', '', 42, 'Folk'],
      isrc: 'USRE19200001',
      appleMusicId: '123456',
      appleMusicUrl: 'https://music.apple.com/song/123456',
      shazamId: 'abc',
      confidence: 0.92,
    });
    expect(m).toEqual({
      title: 'Harvest Moon',
      artist: 'Neil Young',
      album: null,
      genres: ['Rock', 'Folk'],
      isrc: 'USRE19200001',
      appleMusicId: '123456',
      appleMusicUrl: 'https://music.apple.com/song/123456',
      provider: 'shazamkit',
      confidence: 0.92,
    });
  });

  it('returns null for null / empty payloads (no-match)', () => {
    expect(normalizeShazamKitMatch(null)).toBeNull();
    expect(normalizeShazamKitMatch(undefined)).toBeNull();
    expect(normalizeShazamKitMatch({})).toBeNull();
    expect(normalizeShazamKitMatch({ title: '  ', artist: '' })).toBeNull();
    expect(normalizeShazamKitMatch('not-an-object')).toBeNull();
  });

  it('keeps a title-only match and drops non-finite confidence', () => {
    const m = normalizeShazamKitMatch({ title: 'Encore Jam', confidence: NaN });
    expect(m).not.toBeNull();
    expect(m?.title).toBe('Encore Jam');
    expect(m?.artist).toBe('');
    expect(m?.confidence).toBeNull();
    expect(m?.provider).toBe('shazamkit');
  });
});

describe('normalizeAcrCloudIdentifyMatch', () => {
  it('maps a Worker identify-music match to the shared shape', () => {
    const m = normalizeAcrCloudIdentifyMatch({
      ok: true,
      match: {
        artist: 'Phish',
        title: 'Tweezer',
        album: 'A Picture of Nectar',
        confidence: 88,
        isrc: 'USEL19200002',
      },
      provider: 'acrcloud',
    });
    expect(m).toEqual({
      title: 'Tweezer',
      artist: 'Phish',
      album: 'A Picture of Nectar',
      genres: [],
      isrc: 'USEL19200002',
      appleMusicId: null,
      appleMusicUrl: null,
      provider: 'acrcloud',
      confidence: 88,
    });
  });

  it('returns null for errors, no-match, and empty matches', () => {
    expect(normalizeAcrCloudIdentifyMatch({ ok: false, error: 'boom' })).toBeNull();
    expect(normalizeAcrCloudIdentifyMatch({ ok: true, match: null })).toBeNull();
    expect(
      normalizeAcrCloudIdentifyMatch({ ok: true, match: { artist: ' ', title: '' } }),
    ).toBeNull();
    expect(normalizeAcrCloudIdentifyMatch(null)).toBeNull();
  });
});

describe('shouldFallBackToAcrCloud', () => {
  it('falls back when ShazamKit is unavailable (Android / old builds)', () => {
    expect(
      shouldFallBackToAcrCloud({ shazamKitAvailable: false, shazamKitStatus: null }),
    ).toBe(true);
  });

  it('falls back on ShazamKit no-match or error', () => {
    expect(
      shouldFallBackToAcrCloud({ shazamKitAvailable: true, shazamKitStatus: 'no_match' }),
    ).toBe(true);
    expect(
      shouldFallBackToAcrCloud({ shazamKitAvailable: true, shazamKitStatus: 'error' }),
    ).toBe(true);
  });

  it('does not fall back on a ShazamKit match', () => {
    expect(
      shouldFallBackToAcrCloud({ shazamKitAvailable: true, shazamKitStatus: 'matched' }),
    ).toBe(false);
  });
});

describe('applyRecognitionPrefill', () => {
  const emptyForm = { song_title: '', artist_name: '', venue_name: 'Red Rocks' };

  it('fills empty song and artist fields', () => {
    const next = applyRecognitionPrefill(emptyForm, match());
    expect(next.song_title).toBe('Harvest Moon');
    expect(next.artist_name).toBe('Neil Young');
    expect(next.venue_name).toBe('Red Rocks');
  });

  it('never overwrites user-edited values', () => {
    const next = applyRecognitionPrefill(
      { song_title: 'My Song', artist_name: 'My Artist', venue_name: '' },
      match(),
    );
    expect(next.song_title).toBe('My Song');
    expect(next.artist_name).toBe('My Artist');
  });

  it('treats whitespace-only values as empty', () => {
    const next = applyRecognitionPrefill(
      { song_title: '   ', artist_name: '\n', venue_name: '' },
      match(),
    );
    expect(next.song_title).toBe('Harvest Moon');
    expect(next.artist_name).toBe('Neil Young');
  });

  it('fills only fields the match actually has, and is a no-op without a match', () => {
    const titleOnly = applyRecognitionPrefill(emptyForm, match({ artist: '' }));
    expect(titleOnly.song_title).toBe('Harvest Moon');
    expect(titleOnly.artist_name).toBe('');
    expect(applyRecognitionPrefill(emptyForm, null)).toEqual(emptyForm);
  });
});

describe('recognitionStatusText', () => {
  it('shows the identifying state while running', () => {
    expect(recognitionStatusText(null, true)).toBe('Identifying song…');
    expect(recognitionStatusText(noMatchOutcome('shazamkit'), true)).toBe('Identifying song…');
  });

  it('is hidden before recognition starts', () => {
    expect(recognitionStatusText(null, false)).toBeNull();
  });

  it('describes matches, no-match, errors, and unavailable', () => {
    expect(recognitionStatusText(matchedOutcome(match()), false)).toBe(
      'Song identified: Harvest Moon — Neil Young',
    );
    expect(recognitionStatusText(matchedOutcome(match({ artist: '' })), false)).toBe(
      'Song identified: Harvest Moon',
    );
    expect(recognitionStatusText(noMatchOutcome('acrcloud'), false)).toMatch(/No song match/);
    expect(recognitionStatusText(errorOutcome('shazamkit', 'network down'), false)).toBe(
      'Song ID failed: network down',
    );
    expect(recognitionStatusText(unavailableOutcome(), false)).toMatch(/unavailable/i);
  });
});
