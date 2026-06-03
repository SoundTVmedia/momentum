import { describe, expect, it } from 'vitest';
import { artistAtVenueTitle, jamBaseEventTitle, resolveClipEventTitle } from './event-title';

describe('event-title', () => {
  it('reads JamBase event name', () => {
    expect(jamBaseEventTitle({ name: 'Don Toliver at Colonial Life Arena' })).toBe(
      'Don Toliver at Colonial Life Arena',
    );
  });

  it('builds artist at venue fallback', () => {
    expect(artistAtVenueTitle('Don Toliver', 'Colonial Life Arena')).toBe(
      'Don Toliver at Colonial Life Arena',
    );
  });

  it('prefers stored event_title', () => {
    expect(
      resolveClipEventTitle({
        event_title: 'JamBase Official Name',
        artist_name: 'Don Toliver',
        venue_name: 'Colonial Life Arena',
      }),
    ).toBe('JamBase Official Name');
  });
});
