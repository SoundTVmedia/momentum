import { describe, expect, it } from 'vitest';
import { applyArtistImagesToPastShows, libraryStubMatchesEntity } from './past-show-list';
import type { PastShowListRow } from './past-show-sql';

function stub(overrides: Partial<PastShowListRow> = {}): PastShowListRow {
  return {
    show_id: 'jambase:1',
    event_title: 'Ariana Grande at Barclays Center',
    artist_name: 'Ariana Grande',
    show_date: '2026-07-14T20:00:00',
    venue_name: 'Barclays Center',
    venue_location: 'Brooklyn, NY',
    jambase_event_id: 'jambase:1',
    jambase_venue_id: 'jambase:venue',
    jambase_artist_id: 'jambase:artist',
    clip_count: 0,
    thumbnail_url: null,
    ...overrides,
  };
}

describe('libraryStubMatchesEntity', () => {
  it('matches an added show by JamBase artist id even when the names differ', () => {
    expect(
      libraryStubMatchesEntity(stub({ artist_name: 'Grande, Ariana' }), {
        artistName: 'Ariana Grande',
        artistId: 'jambase:artist',
      }),
    ).toBe(true);
  });

  it('matches a venue by slug when the display names are close', () => {
    expect(
      libraryStubMatchesEntity(stub({ venue_name: 'Barclays Center Brooklyn' }), {
        venueName: 'Barclays Center',
      }),
    ).toBe(true);
  });

  it('does not list a show on the wrong artist page', () => {
    expect(
      libraryStubMatchesEntity(stub(), {
        artistName: 'Phish',
        artistId: 'jambase:other',
      }),
    ).toBe(false);
  });
});

describe('applyArtistImagesToPastShows', () => {
  it('fills missing art from the JamBase artist photo keyed by name', () => {
    const images = new Map([['phish', 'https://www.jambase.com/img/phish.jpg']]);
    const [row] = applyArtistImagesToPastShows(
      [stub({ artist_name: 'Phish', thumbnail_url: null })],
      images,
    );
    expect(row?.artist_image_url).toBe('https://www.jambase.com/img/phish.jpg');
  });

  it('keeps an artist photo that is already on the row', () => {
    const images = new Map([['phish', 'https://www.jambase.com/img/other.jpg']]);
    const [row] = applyArtistImagesToPastShows(
      [stub({ artist_name: 'Phish', artist_image_url: 'https://www.jambase.com/img/phish.jpg' })],
      images,
    );
    expect(row?.artist_image_url).toBe('https://www.jambase.com/img/phish.jpg');
  });
});
