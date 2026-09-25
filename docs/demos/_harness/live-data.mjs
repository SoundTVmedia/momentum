const ORIGIN =
  process.env.DEMO_APP_ORIGIN ||
  'https://019aa38d-a318-7dee-9fdf-30039470c120.wes-6f3.workers.dev';

async function getJson(path) {
  const res = await fetch(`${ORIGIN}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

function eventVenue(ev) {
  const loc = ev?.location;
  return loc && typeof loc === 'object' ? loc : {};
}

function eventArtist(ev) {
  const performer = ev?.performer;
  if (Array.isArray(performer) && performer[0] && typeof performer[0] === 'object') {
    return performer[0];
  }
  if (performer && typeof performer === 'object' && !Array.isArray(performer)) {
    return performer;
  }
  return {};
}

function eventGeo(ev) {
  const loc = eventVenue(ev);
  const geo = loc.geo;
  if (geo && Number.isFinite(Number(geo.latitude)) && Number.isFinite(Number(geo.longitude))) {
    return { latitude: Number(geo.latitude), longitude: Number(geo.longitude) };
  }
  return null;
}

function formatCity(loc) {
  const addr = loc?.address && typeof loc.address === 'object' ? loc.address : {};
  const city = addr.addressLocality || loc?.geo?.addressLocality || '';
  const region =
    addr.addressRegion?.alternateName ||
    addr.addressRegion?.name ||
    '';
  return [city, region].filter(Boolean).join(', ');
}

function isNycGeo(geo) {
  return Boolean(
    geo &&
      geo.latitude > 40.4 &&
      geo.latitude < 41.2 &&
      geo.longitude < -73.5 &&
      geo.longitude > -74.4,
  );
}

async function loadRecordNight() {
  const showId = 'jambase:15668776';
  const fallback = {
    name: 'Phish at Madison Square Garden',
    identifier: showId,
    startDate: '2026-07-26T00:20:55.866Z',
    artistName: 'Phish',
    artistId: 'jambase:41232',
    venueName: 'Madison Square Garden',
    venueId: 'jambase:62108',
    city: 'New York, NY',
    geo: { latitude: 40.7505, longitude: -73.9934 },
    href: showClipsHref('Phish', showId),
    artistHref: '/artists/phish',
    clips: [],
  };
  try {
    const clips = [];
    for (const id of [403, 404]) {
      const data = await getJson(`/api/clips/${id}`);
      const clip = data?.clip && typeof data.clip === 'object' ? data.clip : data;
      if (!clip?.video_url) continue;
      clips.push({
        ...clip,
        video_url: originUrl(clip.video_url),
        thumbnail_url: originUrl(clip.thumbnail_url),
      });
    }
    const first = clips[0];
    if (!first) return fallback;
    const artistName = first.artist_name || fallback.artistName;
    const identifier = first.jambase_event_id || showId;
    return {
      ...fallback,
      name: first.event_title || fallback.name,
      identifier,
      startDate: first.timestamp || fallback.startDate,
      artistName,
      venueName: first.venue_name || fallback.venueName,
      city: first.location || fallback.city,
      href: showClipsHref(artistName, identifier),
      clips,
    };
  } catch (err) {
    console.warn('record night clips unavailable', err);
    return fallback;
  }
}

export function showClipsHref(artistName, eventId) {
  const slug = String(artistName || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const id = String(eventId || '').trim();
  if (!slug || !id) return '/';
  return `/artists/${slug}/shows/${encodeURIComponent(id)}/clips`;
}

function ymd(value) {
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : '';
}

function originUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function loadLiveDemoData() {
  const today = new Date().toISOString().slice(0, 10);
  const clipsPayload = await getJson('/api/clips?limit=24&sort_by=latest');
  const clips = Array.isArray(clipsPayload.clips) ? clipsPayload.clips : [];
  const namedClips = clips.filter((c) => c?.artist_name && c?.venue_name);

  const artistName =
    namedClips.find((c) => /phish/i.test(c.artist_name))?.artist_name ||
    namedClips[0]?.artist_name ||
    'Phish';
  const venueName =
    namedClips.find((c) => /madison square garden/i.test(c.venue_name))?.venue_name ||
    namedClips.find((c) => c.artist_name === artistName)?.venue_name ||
    'Madison Square Garden';
  const songClip =
    namedClips.find((c) => typeof c.song_title === 'string' && c.song_title.trim()) || null;
  const friendClip =
    namedClips.find((c) => c.user_display_name && c.mocha_user_id) || namedClips[0] || null;

  const artistClips = namedClips.filter((c) => c.artist_name === artistName);
  const venueClips = namedClips.filter((c) => c.venue_name === venueName);
  const songClips = songClip
    ? namedClips.filter((c) => c.song_title === songClip.song_title)
    : [];
  const friendClips = friendClip
    ? namedClips.filter((c) => c.mocha_user_id === friendClip.mocha_user_id)
    : [];

  const [artistsPayload, venuesPayload, eventsPayload, tonightPayload] = await Promise.all([
    getJson(`/api/jambase/search/artists?q=${encodeURIComponent(artistName)}`),
    getJson(`/api/jambase/search/venues?q=${encodeURIComponent(venueName)}`),
    getJson(
      `/api/jambase/search/events?q=${encodeURIComponent(artistName)}&includePast=1&limit=12`,
    ),
    getJson('/api/jambase/search/events?q=Brooklyn%20Bowl&includePast=1&limit=12'),
  ]);

  const artist =
    (artistsPayload.artists || []).find((row) => row?.name === artistName) ||
    (artistsPayload.artists || [])[0] ||
    { name: artistName, identifier: 'jambase:41232', image: null };

  const venue =
    (venuesPayload.venues || []).find((row) => row?.name === venueName) ||
    (venuesPayload.venues || [])[0] ||
    {
      name: venueName,
      identifier: 'jambase:62108',
      geo: { latitude: 40.7497, longitude: -73.9916 },
      address: { addressLocality: 'New York, NY' },
    };

  const pastEvent =
    (eventsPayload.events || []).find((ev) => {
      const id = ev?.identifier;
      return namedClips.some((c) => c.jambase_event_id && c.jambase_event_id === id);
    }) ||
    (eventsPayload.events || []).find((ev) => ymd(ev.startDate) && ymd(ev.startDate) < today) ||
    (eventsPayload.events || [])[0];

  const bowlNyc =
    (venuesPayload.venues || []).find((row) => /brooklyn bowl/i.test(row?.name || '')) || null;
  const tonightEvent =
    (tonightPayload.events || []).find((ev) => ymd(ev.startDate) === today && isNycGeo(eventGeo(ev))) ||
    (tonightPayload.events || []).find((ev) => ymd(ev.startDate) === today) ||
    (tonightPayload.events || []).find((ev) => {
      const loc = eventVenue(ev);
      return ymd(ev.startDate) >= today && /brooklyn bowl/i.test(loc.name || '');
    }) ||
    (tonightPayload.events || [])[0];

  const bowlSearch = await getJson('/api/jambase/search/venues?q=Brooklyn%20Bowl');
  const brooklynBowl =
    (bowlSearch.venues || []).find((row) => {
      const locality = row?.address?.addressLocality || '';
      return /brooklyn/i.test(locality) || row?.geo?.latitude > 40;
    }) || (bowlSearch.venues || [])[1] || {
      name: 'Brooklyn Bowl',
      identifier: 'jambase:66713',
      geo: { latitude: 40.7219, longitude: -73.9577 },
      address: { addressLocality: 'Brooklyn', addressRegion: { alternateName: 'NY' } },
    };

  const tonightArtist = eventArtist(tonightEvent);
  const tonightVenue = eventVenue(tonightEvent);
  const tonightGeo = eventGeo(tonightEvent) || {
    latitude: brooklynBowl.geo?.latitude ?? 40.7219,
    longitude: brooklynBowl.geo?.longitude ?? -73.9577,
  };

  const recordNight = await loadRecordNight();
  const cameraClip = recordNight.clips[0] ||
    artistClips[0] || venueClips[0] || namedClips[0] || clips[0] || null;
  const cameraVideoUrl = originUrl(cameraClip?.video_url);

  const pastArtist = eventArtist(pastEvent);
  const pastVenue = eventVenue(pastEvent);

  return {
    origin: ORIGIN,
    artist: {
      name: artist.name,
      identifier: artist.identifier,
      image: originUrl(artist.image),
    },
    venue: {
      name: venue.name,
      identifier: venue.identifier,
      city:
        venue.address?.addressLocality ||
        venue.address?.addressRegion?.name ||
        'New York, NY',
      image: originUrl(venue.image),
      geo: venue.geo || { latitude: 40.7497, longitude: -73.9916 },
    },
    song: songClip
      ? {
          title: songClip.song_title,
          slug: String(songClip.song_title)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
          artistName: songClip.artist_name,
        }
      : { title: 'Night Train', slug: 'night-train', artistName: "Guns N' Roses" },
    friend: {
      mocha_user_id: friendClip?.mocha_user_id || 'rak',
      display_name: friendClip?.user_display_name || 'Rak',
      profile_image_url: friendClip?.user_avatar || null,
      clip_count: Math.max(friendClips.length, 2),
    },
    pastEvent: pastEvent
      ? {
          raw: pastEvent,
          name: pastEvent.name,
          identifier: pastEvent.identifier,
          startDate: pastEvent.startDate,
          image: originUrl(pastEvent.image),
          artistName: pastArtist.name || artist.name,
          artistId: pastArtist.identifier || artist.identifier,
          venueName: pastVenue.name || venue.name,
          venueId: pastVenue.identifier || venue.identifier,
          city: formatCity(pastVenue) || 'New York, NY',
          href: showClipsHref(pastArtist.name || artist.name, pastEvent.identifier),
        }
      : null,
    tonight: tonightEvent
      ? {
          raw: tonightEvent,
          name: tonightEvent.name,
          identifier: tonightEvent.identifier,
          startDate: tonightEvent.startDate,
          image: originUrl(tonightEvent.image),
          artistName: tonightArtist.name || 'Duane Betts',
          artistId: tonightArtist.identifier || null,
          venueName: tonightVenue.name || 'Brooklyn Bowl',
          venueId: tonightVenue.identifier || brooklynBowl.identifier,
          city: formatCity(tonightVenue) || 'Brooklyn, NY',
          geo: isNycGeo(tonightGeo)
            ? tonightGeo
            : { latitude: 40.7219, longitude: -73.9577 },
          href: showClipsHref(
            tonightArtist.name || 'Duane Betts',
            tonightEvent.identifier,
          ),
        }
      : {
          name: 'Duane Betts at Brooklyn Bowl',
          identifier: 'jambase:tonight',
          startDate: `${today}T19:00:00`,
          artistName: 'Duane Betts',
          artistId: null,
          venueName: 'Brooklyn Bowl',
          venueId: brooklynBowl.identifier,
          city: 'Brooklyn, NY',
          geo: tonightGeo,
          href: showClipsHref('Duane Betts', 'jambase:tonight'),
        },
    clips: {
      all: namedClips,
      artist: artistClips.length ? artistClips : namedClips.slice(0, 3),
      venue: venueClips.length ? venueClips : namedClips.slice(0, 3),
      song: songClips.length ? songClips : namedClips.slice(0, 2),
      friend: friendClips.length ? friendClips : namedClips.slice(0, 2),
      camera: cameraClip,
    },
    cameraVideoUrl,
    recordNight,
    brooklynBowl,
    bowlNyc,
  };
}

export { ORIGIN };
