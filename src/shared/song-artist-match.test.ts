import { describe, expect, it } from 'vitest';
import {
  artistNamesMatch,
  normalizeArtistName,
  recognizedArtistMatchesShow,
} from './song-artist-match';

describe('normalizeArtistName', () => {
  it('strips The, punctuation, and &', () => {
    expect(normalizeArtistName('The Weeknd')).toBe('weeknd');
    expect(normalizeArtistName('AC/DC')).toBe('ac dc');
    expect(normalizeArtistName('Macklemore & Ryan Lewis')).toBe('macklemore and ryan lewis');
  });
});

describe('artistNamesMatch', () => {
  it('does not filter when the show has no artist', () => {
    expect(artistNamesMatch('', 'Paul Wall')).toBe(true);
    expect(artistNamesMatch(null, 'Drake')).toBe(true);
  });

  it('matches Paul Wall including featured guests on the recording', () => {
    expect(artistNamesMatch('Paul Wall', 'Paul Wall')).toBe(true);
    expect(artistNamesMatch('Paul Wall', 'Paul Wall feat. Chamillionaire')).toBe(true);
    expect(artistNamesMatch('Paul Wall', 'Paul Wall ft Chamillionaire')).toBe(true);
  });

  it('rejects a different headliner', () => {
    expect(artistNamesMatch('Paul Wall', 'Drake')).toBe(false);
    expect(artistNamesMatch('Paul Wall', 'Chamillionaire')).toBe(false);
  });

  it('is case-insensitive and ignores leading The', () => {
    expect(artistNamesMatch('the weeknd', 'The Weeknd')).toBe(true);
    expect(artistNamesMatch('Weeknd', 'The Weeknd')).toBe(true);
  });

  it('ignores accents', () => {
    expect(artistNamesMatch('Beyoncé', 'Beyonce')).toBe(true);
  });
});

describe('recognizedArtistMatchesShow', () => {
  it('matches any billed artist on a multi-act show', () => {
    expect(recognizedArtistMatchesShow('Paul Wall / Slim Thug', 'Slim Thug')).toBe(true);
    expect(recognizedArtistMatchesShow('Paul Wall / Slim Thug', 'Drake')).toBe(false);
  });

  it('keeps AC/DC as one artist', () => {
    expect(recognizedArtistMatchesShow('AC/DC', 'AC/DC')).toBe(true);
    expect(recognizedArtistMatchesShow('AC/DC', 'DC')).toBe(false);
  });
});
