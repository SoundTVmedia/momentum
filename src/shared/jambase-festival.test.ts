import { describe, expect, it } from 'vitest';
import {
  festivalCanonicalSlug,
  festivalPageFromEvents,
  festivalSlugMatches,
  formatFestivalDateRange,
  isJamBaseFestivalEvent,
  jamBaseEventOfficialWebsite,
  mergeFestivalLineups,
  pickFestivalGroupForSlug,
} from './jambase-festival';

const lineup = (names: string[], headliner = names[0]) =>
  names.map((name) => ({
    name,
    image: `https://img.example/${name}.jpg`,
    identifier: `jambase:${name}`,
    'x-isHeadliner': name === headliner,
  }));

describe('isJamBaseFestivalEvent', () => {
  it('detects festival in the event name', () => {
    expect(isJamBaseFestivalEvent({ name: 'Governors Ball Music Festival' })).toBe(true);
    expect(isJamBaseFestivalEvent({ name: 'Jazz Fest' })).toBe(true);
    expect(isJamBaseFestivalEvent({ name: 'Summerfest' })).toBe(true);
  });

  it('detects known festival brands without fest in the name', () => {
    expect(isJamBaseFestivalEvent({ name: 'Coachella' })).toBe(true);
    expect(isJamBaseFestivalEvent({ name: 'Bonnaroo' })).toBe(true);
  });

  it('detects @type Festival', () => {
    expect(isJamBaseFestivalEvent({ name: 'Weekend', '@type': 'Festival' })).toBe(true);
  });

  it('treats a large performer list as a festival', () => {
    const performer = Array.from({ length: 8 }, (_, i) => ({ name: `Act ${i}` }));
    expect(isJamBaseFestivalEvent({ name: 'Big Weekend', performer })).toBe(true);
  });

  it('does not treat a normal concert as a festival', () => {
    expect(
      isJamBaseFestivalEvent({
        name: 'Phish at Madison Square Garden',
        performer: [{ name: 'Phish', 'x-isHeadliner': true }],
      }),
    ).toBe(false);
  });
});

describe('festivalCanonicalSlug', () => {
  it('drops a trailing year so annual editions share a page', () => {
    expect(festivalCanonicalSlug('Bonnaroo Music Festival 2026')).toBe('bonnaroo-music-festival');
  });
});

describe('festivalSlugMatches', () => {
  it('matches a shortened festival slug', () => {
    expect(festivalSlugMatches('Bonnaroo Music & Arts Festival', 'bonnaroo')).toBe(true);
  });

  it('does not match unrelated short tokens', () => {
    expect(festivalSlugMatches('Jazz Fest', 'fest')).toBe(false);
  });
});

describe('jamBaseEventOfficialWebsite', () => {
  it('skips JamBase and ticket hosts', () => {
    expect(
      jamBaseEventOfficialWebsite({
        url: 'https://www.jambase.com/show/gov-ball',
        sameAs: [{ identifier: 'officialSite', url: 'https://www.governorsballmusicfestival.com' }],
        offers: [{ url: 'https://www.ticketmaster.com/event/1' }],
      }),
    ).toBe('https://www.governorsballmusicfestival.com/');
  });
});

describe('mergeFestivalLineups', () => {
  it('unions performers across festival days and keeps headliners first', () => {
    const artists = mergeFestivalLineups([
      { name: 'Fest Friday', performer: lineup(['Headliner', 'Opener']) },
      { name: 'Fest Saturday', performer: lineup(['Headliner', 'Closer'], 'Headliner') },
    ]);
    expect(artists.map((a) => a.name)).toEqual(['Headliner', 'Closer', 'Opener']);
    expect(artists[0]?.is_headliner).toBe(true);
  });
});

describe('pickFestivalGroupForSlug', () => {
  it('groups same-named days and prefers the upcoming edition', () => {
    const group = pickFestivalGroupForSlug(
      [
        {
          identifier: 'past',
          name: 'Gov Ball',
          startDate: '2020-06-01',
          performer: lineup(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
        },
        {
          identifier: 'fri',
          name: 'Gov Ball',
          startDate: '2099-06-06',
          performer: lineup(['Fri Act']),
        },
        {
          identifier: 'sat',
          name: 'Gov Ball',
          startDate: '2099-06-07',
          performer: lineup(['Sat Act']),
        },
      ],
      'gov-ball',
      Date.parse('2026-01-01Z'),
    );
    expect(group.map((ev) => ev.identifier).sort()).toEqual(['fri', 'sat']);
  });
});

describe('festivalPageFromEvents', () => {
  it('builds ticket, website, dates, and lineup', () => {
    const page = festivalPageFromEvents([
      {
        identifier: 'jambase:1',
        name: 'Governors Ball Music Festival',
        startDate: '2099-06-06',
        endDate: '2099-06-08',
        image: 'https://img.example/fest.jpg',
        url: 'https://www.jambase.com/show/1',
        sameAs: [{ url: 'https://govball.com' }],
        offers: [{ category: 'ticketingLinkPrimary', url: 'https://ticketmaster.com/gov' }],
        location: { name: 'Flushing Meadows', address: { addressLocality: 'New York', addressRegion: { alternateName: 'NY' } } },
        performer: lineup(['The Strokes', 'SZA']),
      },
    ]);
    expect(page?.festival.ticket_url).toBe('https://ticketmaster.com/gov');
    expect(page?.festival.website_url).toContain('govball.com');
    expect(page?.festival.venue_name).toBe('Flushing Meadows');
    expect(page?.artists.map((a) => a.name)).toContain('SZA');
  });
});

describe('formatFestivalDateRange', () => {
  it('formats a single day', () => {
    expect(formatFestivalDateRange('2099-06-06T12:00:00', '2099-06-06T23:00:00')).toBe('Jun 6, 2099');
  });

  it('formats a multi-day span', () => {
    expect(formatFestivalDateRange('2099-06-06', '2099-06-08')).toBe('Jun 6 – 8, 2099');
  });
});
