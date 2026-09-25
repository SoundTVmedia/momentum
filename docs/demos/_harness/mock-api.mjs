function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function cityLine(venue) {
  const addr = venue?.address;
  if (!addr) return venue?.city || '';
  const city = addr.addressLocality || '';
  const region = addr.addressRegion?.alternateName || addr.addressRegion?.name || '';
  return [city, region].filter(Boolean).join(', ');
}

function demoUser(live) {
  const avatar =
    live?.friend?.profile_image_url ||
    live?.clips?.camera?.user_avatar ||
    live?.clips?.all?.[0]?.user_avatar ||
    null;
  return {
    id: 'demo-alex-rivera',
    email: 'alex@feedback.demo',
    authenticated: true,
    google_user_data: {
      name: 'Alex Rivera',
      given_name: 'Alex',
      family_name: 'Rivera',
      picture: avatar,
    },
    profile: {
      mocha_user_id: 'demo-alex-rivera',
      display_name: 'Alex Rivera',
      profile_image_url: avatar,
      cover_image_url: null,
      role: 'fan',
      is_verified: 0,
      location: 'New York, NY',
      bio: 'Catching every night I can.',
      genres: JSON.stringify(['Rock', 'Jam']),
      favorite_artists: '[]',
    },
  };
}

function asMyClip(clip, index) {
  return {
    ...clip,
    id: 800001 + index,
    mocha_user_id: 'demo-alex-rivera',
    user_display_name: 'Alex Rivera',
  };
}

function pastShowCard(show, clip) {
  return {
    event_title: show.name || show.event_title || `${show.artistName} at ${show.venueName}`,
    artist_name: show.artistName || show.artist_name || '',
    show_date: show.startDate || show.show_date || '',
    show_id: show.identifier || show.jambase_event_id || null,
    venue_name: show.venueName || show.venue_name || null,
    venue_location: show.city || show.venue_location || null,
    jambase_event_id: show.identifier || show.jambase_event_id || null,
    jambase_venue_id: show.venueId || show.jambase_venue_id || null,
    jambase_artist_id: show.artistId || show.jambase_artist_id || null,
    clip_count: show.clip_count ?? 3,
    thumbnail_url: clip?.thumbnail_url || clip?.stream_thumbnail_url || show.image || null,
    artist_image_url: show.artist_image_url || clip?.artist_image_url || null,
  };
}

function jamBaseEventFromShow(show) {
  if (show?.raw && typeof show.raw === 'object') return show.raw;
  if (!show) return null;
  return {
    '@type': 'MusicEvent',
    name: show.name,
    identifier: show.identifier,
    startDate: show.startDate,
    image: show.image,
    performer: [
      { name: show.artistName, identifier: show.artistId, 'x-isHeadliner': true },
    ],
    location: {
      name: show.venueName,
      identifier: show.venueId,
      address: { addressLocality: show.city },
      geo: show.geo,
    },
  };
}

export function createDemoState(live) {
  const mineSource = (live.clips.all.length ? live.clips.all : live.clips.artist).slice(0, 6);
  const myClips = mineSource.map(asMyClip);
  const savedSource = (
    live.clips.friend.length ? live.clips.friend : live.clips.artist.length ? live.clips.artist : live.clips.all
  ).slice(0, 4);
  const attendedShows = [];
  if (live.pastEvent) {
    attendedShows.push(
      pastShowCard(
        { ...live.pastEvent, artist_image_url: live.artist?.image || null },
        live.clips.artist[0] || live.clips.camera,
      ),
    );
  }
  const seen = new Set(attendedShows.map((s) => s.jambase_event_id).filter(Boolean));
  for (const clip of live.clips.all) {
    const id = clip.jambase_event_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    attendedShows.push(
      pastShowCard(
        {
          name: clip.event_title || `${clip.artist_name} at ${clip.venue_name}`,
          artistName: clip.artist_name,
          venueName: clip.venue_name,
          city: clip.location,
          identifier: id,
          startDate: clip.timestamp || clip.created_at,
          image: clip.thumbnail_url,
        },
        clip,
      ),
    );
    if (attendedShows.length >= 4) break;
  }

  const upcoming = jamBaseEventFromShow(live.tonight);

  return {
    live,
    user: demoUser(live),
    followedArtists: [],
    followedVenues: [],
    followedSongs: [],
    followedUsers: [],
    followingIds: [],
    showMarks: [],
    myClips,
    savedClips: savedSource,
    attendedShows,
    upcomingFavoriteEvents: upcoming ? [upcoming] : [],
    rating: {
      averageRating: 4.6,
      ratingCount: 11,
      userRating: null,
      canRate: false,
    },
    injectClip: null,
    recordedClips: [],
    holdUploads: false,
    uploadSessions: [],
  };
}

function cameraCandidate(live) {
  const show = (live.preferRecordNight && live.recordNight) || live.tonight;
  return {
    jambase_event_id: show.identifier,
    jambase_artist_id: show.artistId,
    jambase_venue_id: show.venueId,
    artist_name: show.artistName,
    venue_name: show.venueName,
    location: show.city,
    event_title: show.name,
    startDate: show.startDate,
    distance_miles: 0.08,
    venue_timezone: 'America/New_York',
    geo_proximity_trusted: true,
  };
}

function newClip(live, show, src, id = 900001) {
  const clip = src || live.clips.camera || live.clips.all[0] || {};
  return {
    ...clip,
    id,
    user_display_name: 'Alex Rivera',
    mocha_user_id: 'demo-alex-rivera',
    artist_name: show.artistName,
    venue_name: show.venueName,
    event_title: show.name,
    location: show.city,
    jambase_event_id: show.identifier,
    likes_count: 0,
    views_count: 0,
    content_description: 'Recorded live',
  };
}

export async function installDemoMocks(page, state) {
  const origin = new URL(state.live.origin).origin;

  await page.route(`${origin}/api/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const live = state.live;

    try {
      if (path === '/api/users/me' && method === 'GET') {
        return json(route, state.user);
      }

      if (path === '/api/notifications' && method === 'GET') {
        return json(route, { notifications: [] });
      }

      if (path === '/api/users/me/following' && method === 'GET') {
        return json(route, { following_ids: state.followingIds });
      }

      if (path === '/api/users/me/following/list' && method === 'GET') {
        return json(route, {
          venues: state.followedVenues,
          users: state.followedUsers.map((u) => ({ mocha_user_id: u.mocha_user_id })),
        });
      }

      if (path === '/api/users/me/favorite-artists' && method === 'GET') {
        return json(route, { artists: state.followedArtists });
      }

      if (path === '/api/users/me/favorites' && method === 'GET') {
        const type = url.searchParams.get('type');
        if (type === 'song') {
          return json(route, {
            favorites: state.followedSongs.map((s) => ({
              entity_key: s.slug,
              display_name: s.title,
            })),
          });
        }
        return json(route, { favorites: [] });
      }

      if (path === '/api/personalization/update' && method === 'POST') {
        const body = req.postDataJSON() || {};
        const names = Array.isArray(body.favorite_artists) ? body.favorite_artists : [];
        state.followedArtists = names.map((name) => ({
          name,
          image_url: live.artist.image,
        }));
        return json(route, { ok: true });
      }

      if (path === '/api/archival-shows' && method === 'POST') {
        return json(route, { ok: true, show: null });
      }

      if (path === '/api/users/favorite-artists/sync-by-name' && method === 'POST') {
        const body = req.postDataJSON() || {};
        const names = Array.isArray(body.names) ? body.names : [];
        for (const name of names) {
          if (!state.followedArtists.some((a) => a.name === name)) {
            state.followedArtists.push({
              name,
              image_url: live.artist.image,
            });
          }
        }
        return json(route, { ok: true, artists: state.followedArtists });
      }

      if (path === '/api/users/me/favorites' && method === 'POST') {
        const body = req.postDataJSON() || {};
        if (body.type === 'song') {
          const title = String(body.name || live.song.title);
          const slug = live.song.slug;
          if (!state.followedSongs.some((s) => s.slug === slug)) {
            state.followedSongs.push({ slug, title, artist_name: live.song.artistName });
          }
        }
        return json(route, { ok: true });
      }

      if (path.startsWith('/api/users/') && path.endsWith('/follow') && method === 'POST') {
        const target = decodeURIComponent(path.slice('/api/users/'.length, -'/follow'.length));
        const body = req.postDataJSON() || {};
        if (target.startsWith('venue-') || body.venue_name) {
          const name = body.venue_name || live.venue.name;
          const venueId = 62108;
          if (!state.followedVenues.some((v) => v.name === name)) {
            state.followedVenues.push({
              venue_id: venueId,
              name,
              clip_count: live.clips.venue.length,
            });
          }
          const fid = `venue-${venueId}`;
          if (!state.followingIds.includes(fid)) state.followingIds.push(fid);
          return json(route, { following: true, venue_id: venueId });
        }
        if (!state.followingIds.includes(target)) state.followingIds.push(target);
        const friend = live.friend;
        if (target === friend.mocha_user_id && !state.followedUsers.some((u) => u.mocha_user_id === target)) {
          state.followedUsers.push(friend);
        }
        return json(route, { following: true });
      }

      if (path === '/api/jambase/search/events' && method === 'GET') {
        const q = (url.searchParams.get('q') || '').trim().toLowerCase();
        const events = [];
        const artist = (live.artist.name || '').toLowerCase();
        const pastName = (live.pastEvent?.artistName || '').toLowerCase();
        if (
          live.pastEvent?.raw &&
          q.length >= 2 &&
          (artist.includes(q) ||
            pastName.includes(q) ||
            q.includes(artist) ||
            q.includes(pastName) ||
            q.includes('phish'))
        ) {
          events.push(live.pastEvent.raw);
        }
        if (events.length) return json(route, { events });
        return route.continue();
      }

      if (path === '/api/search/unified-favorites' && method === 'GET') {
        const q = (url.searchParams.get('q') || '').trim().toLowerCase();
        const artists = [];
        const venues = [];
        const songs = [];
        const friends = [];
        if (q.length >= 2) {
          if (live.artist.name.toLowerCase().includes(q) || q.includes('phish')) {
            artists.push({
              identifier: live.artist.identifier,
              name: live.artist.name,
              image: live.artist.image,
            });
          }
          if (live.venue.name.toLowerCase().includes(q) || q.includes('madison') || q.includes('garden')) {
            venues.push({
              identifier: live.venue.identifier,
              name: live.venue.name,
              city: cityLine(live.venue) || live.venue.city,
              image: live.venue.image,
            });
          }
          if (live.song.title.toLowerCase().includes(q) || q.includes('night')) {
            songs.push({
              slug: live.song.slug,
              title: live.song.title,
              artist_name: live.song.artistName,
            });
          }
          if (live.friend.display_name.toLowerCase().includes(q) || q.includes('rak')) {
            friends.push(live.friend);
          }
          if (!artists.length && !venues.length && !songs.length && !friends.length) {
            artists.push({
              identifier: live.artist.identifier,
              name: live.artist.name,
              image: live.artist.image,
            });
          }
        }
        return json(route, { artists, venues, shows: [], friends, songs });
      }

      if (path === '/api/discover/favorite-artist-feed' && method === 'GET') {
        const hasArtists = state.followedArtists.length > 0;
        const hasFollows =
          hasArtists ||
          state.followedVenues.length > 0 ||
          state.followedSongs.length > 0 ||
          state.followedUsers.length > 0;
        const clips = hasFollows ? live.clips.artist : [];
        return json(route, {
          hasFavoriteArtists: hasArtists,
          hasFollows,
          upcomingEvents: [],
          clips,
          hasMoreClips: false,
        });
      }

      if (path === '/api/clips/friends' && method === 'GET') {
        return json(route, {
          clips: state.followedUsers.length ? live.clips.friend : [],
          hasMore: false,
        });
      }

      if (path === '/api/clips/camera-venues' && method === 'POST') {
        return json(route, {
          venues: [cameraCandidate(live)],
          notice: null,
          meta: {
            matchSource: 'at_venue',
            rawEventCount: 1,
            mappedCandidateCount: 1,
            venueMatchCount: 1,
            lat: live.tonight.geo.latitude,
            lon: live.tonight.geo.longitude,
          },
        });
      }

      if (path === '/api/me/clips' && method === 'GET') {
        return json(route, { clips: state.myClips, hasMore: false });
      }

      if (path === '/api/users/me/saved-clips' && method === 'GET') {
        return json(route, { clips: state.savedClips });
      }

      if (path === '/api/users/me/saved-clip-ids' && method === 'GET') {
        return json(route, {
          clip_ids: state.savedClips.map((c) => c.id).filter((id) => Number.isFinite(id)),
        });
      }

      if (path === '/api/users/me/liked-clips' && method === 'GET') {
        return json(route, { clip_ids: [] });
      }

      if (path === '/api/personalization/concerts' && method === 'GET') {
        return json(route, {
          personalized: true,
          source: 'jambase',
          concerts: [],
          events: state.upcomingFavoriteEvents,
        });
      }

      if (path.endsWith('/attended-shows') && path.startsWith('/api/users/') && method === 'GET') {
        return json(route, { shows: state.attendedShows });
      }

      if (/^\/api\/users\/[^/]+\/stats$/.test(path) && method === 'GET') {
        const views = state.myClips.reduce((sum, c) => sum + (Number(c.views_count) || 0), 0);
        return json(route, {
          totalClipsPosted: state.myClips.length,
          totalViewsOnClips: views || 2480,
          userAverageClipRating: 4.6,
        });
      }

      if (/^\/api\/users\/[^/]+$/.test(path) && path !== '/api/users/me' && method === 'GET') {
        const likes = state.myClips.reduce((sum, c) => sum + (Number(c.likes_count) || 0), 0);
        const views = state.myClips.reduce((sum, c) => sum + (Number(c.views_count) || 0), 0);
        return json(route, {
          profile: state.user.profile,
          clips: state.myClips,
          stats: {
            totalClips: state.myClips.length,
            totalLikes: likes || 128,
            totalViews: views || 2480,
            followers: 42,
            following: 18,
          },
        });
      }

      if (path === '/api/users/me/show-marks' && method === 'GET') {
        const status = url.searchParams.get('status');
        const marks = status
          ? state.showMarks.filter((m) => m.status === status)
          : state.showMarks;
        return json(route, { marks, events: [] });
      }

      if (path === '/api/users/me/show-marks' && method === 'POST') {
        const body = req.postDataJSON() || {};
        const mark = {
          id: state.showMarks.length + 1,
          status: body.status || 'attended',
          jambase_event_id: body.jambase_event_id,
          jambase_venue_id: body.jambase_venue_id ?? null,
          jambase_artist_id: body.jambase_artist_id ?? null,
          event_title: body.event_title ?? null,
          artist_name: body.artist_name ?? null,
          venue_name: body.venue_name ?? null,
          venue_location: body.venue_location ?? null,
          venue_timezone: body.venue_timezone ?? 'America/New_York',
          start_date: body.start_date ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const idx = state.showMarks.findIndex((m) => m.jambase_event_id === mark.jambase_event_id);
        if (idx >= 0) state.showMarks[idx] = mark;
        else state.showMarks.push(mark);
        state.rating.canRate = mark.status === 'attended';
        return json(route, { mark });
      }

      if (/^\/api\/shows\/.+\/rating$/.test(path) && method === 'GET') {
        return json(route, state.rating);
      }

      if (/^\/api\/shows\/.+\/rate$/.test(path) && method === 'POST') {
        const body = req.postDataJSON() || {};
        const rating = Number(body.rating) || 5;
        state.rating.userRating = rating;
        state.rating.ratingCount += 1;
        state.rating.averageRating = Math.round(((state.rating.averageRating * (state.rating.ratingCount - 1) + rating) / state.rating.ratingCount) * 10) / 10;
        state.rating.canRate = true;
        return json(route, state.rating);
      }

      if (path.includes('/shows/') && path.endsWith('/clips') && method === 'GET') {
        const idParam = decodeURIComponent(path.split('/shows/')[1]?.replace(/\/clips$/, '') || '');
        const recordId = live.recordNight?.identifier;
        if (recordId && idParam === recordId && state.recordedClips?.length) {
          const upstream = await route.fetch();
          const data = await upstream.json();
          const existing = Array.isArray(data.clips) ? data.clips : [];
          data.clips = [...state.recordedClips, ...existing];
          return json(route, data);
        }
        const liveShow =
          (live.pastEvent?.identifier === idParam && live.pastEvent) ||
          (live.tonight?.identifier === idParam && live.tonight) ||
          live.pastEvent ||
          live.tonight;
        const sourceClips =
          liveShow === live.tonight ? [] : live.clips.artist.length ? live.clips.artist : live.clips.all;
        const clips = [
          ...(state.injectClip ? [state.injectClip] : []),
          ...sourceClips.slice(0, 8),
        ];
        return json(route, {
          clips,
          hasMore: false,
          show: liveShow?.raw
            ? { event: liveShow.raw, setlist: [], htmlChecked: true }
            : null,
          canonical_show_id: liveShow?.identifier || idParam,
        });
      }

      if (/^\/api\/uploads\/.+\/status$/.test(path) && method === 'GET') {
        const sessionId = path.split('/')[3];
        const session =
          state.uploadSessions.find((row) => row.sessionId === sessionId) ||
          state.uploadSessions[0];
        const clipId = session?.clipId || 900001;
        if (state.holdUploads) {
          const progress = Math.min(72, 28 + (session?.polls || 0) * 8);
          if (session) session.polls = (session.polls || 0) + 1;
          return json(route, {
            sessionId,
            clipId,
            sessionStatus: 'uploading',
            uploadStatus: 'uploading',
            completedParts: 1,
            totalParts: 1,
            progress,
            clipPublished: false,
            thumbnailUrl: live.recordNight?.clips?.[0]?.thumbnail_url || null,
            completedPartNumbers: [1],
          });
        }
        return json(route, {
          sessionId,
          clipId,
          sessionStatus: 'completed',
          uploadStatus: 'ready',
          completedParts: 1,
          totalParts: 1,
          progress: 100,
          clipPublished: true,
          thumbnailUrl: live.recordNight?.clips?.[0]?.thumbnail_url || live.clips.camera?.thumbnail_url || null,
          completedPartNumbers: [1],
        });
      }

      if (path === '/api/clips/resolve-show' && method === 'POST') {
        const show = live.pastEvent || live.tonight;
        return json(route, {
          match: 'single',
          candidates: [
            {
              jambase_event_id: show.identifier,
              jambase_artist_id: show.artistId,
              jambase_venue_id: show.venueId,
              artist_name: show.artistName,
              venue_name: show.venueName,
              location: show.city,
              event_title: show.name,
              startDate: show.startDate,
              distance_miles: 0.1,
            },
          ],
        });
      }

      if (
        (path.startsWith('/api/upload') ||
          path.startsWith('/api/uploads') ||
          path === '/api/clips' ||
          path === '/api/clips/classify-content' ||
          path.startsWith('/api/clips/identify')) &&
        method !== 'GET'
      ) {
        if (path === '/api/clips' && method === 'POST') {
          const show = live.pastEvent || live.tonight;
          state.injectClip = newClip(live, show);
        }
        if (path === '/api/uploads/init') {
          const n = state.uploadSessions.length + 1;
          const session = {
            sessionId: `demo-session-${n}`,
            clipId: 900000 + n,
            polls: 0,
          };
          state.uploadSessions.push(session);
          return json(
            route,
            {
              sessionId: session.sessionId,
              clipId: session.clipId,
              r2Key: `clips/demo/video/demo-${n}.mp4`,
              multipartUploadId: `demo-mpu-${n}`,
              partSize: 5 * 1024 * 1024,
              totalParts: 1,
              uploadMode: 'worker',
              expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            },
            201,
          );
        }
        if (path.includes('/parts/')) {
          return json(route, { etag: '"demo-etag"', ok: true });
        }
        if (path.endsWith('/complete')) {
          return json(route, { ok: true, clipId: 900001, status: 'completed' });
        }
        return json(route, { ok: true, id: 900001, clips: [] });
      }

      return route.continue();
    } catch (err) {
      console.warn('demo mock failed', path, err);
      return route.continue();
    }
  });
}

export { newClip, cameraCandidate };
