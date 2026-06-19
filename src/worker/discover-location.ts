import type { Context } from 'hono';
import type { MochaUser } from '@/shared/mocha-user';
import { mochaUserIdKey } from './mocha-user-id';

export type DiscoverLocationSource = 'profile' | 'ip' | 'default' | 'device';

export type DiscoverLocation = {
  latitude: number;
  longitude: number;
  source: DiscoverLocationSource;
  label?: string;
};

const DEFAULT_LOCATION: DiscoverLocation = {
  latitude: 40.7505,
  longitude: -73.9934,
  source: 'default',
  label: 'New York, NY',
};

type CfGeo = {
  latitude?: number | string;
  longitude?: number | string;
  city?: string;
  region?: string;
  country?: string;
};

function parseCoord(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Logged-in users: `user_profiles.home_latitude` / `home_longitude`.
 * Query `latitude` / `longitude`: device GPS from the client (preferred for "near you").
 * Logged-out: Cloudflare `cf.latitude` / `cf.longitude` from the client IP.
 */
export async function resolveDiscoverLocation(
  c: Context<{ Bindings: Env }>,
  mochaUser?: MochaUser | null,
): Promise<DiscoverLocation> {
  const qLat = parseCoord(c.req.query('latitude'));
  const qLon = parseCoord(c.req.query('longitude'));
  if (qLat != null && qLon != null) {
    return { latitude: qLat, longitude: qLon, source: 'device' };
  }

  if (mochaUser) {
    const profile = await c.env.DB.prepare(
      `SELECT home_latitude, home_longitude, home_location
       FROM user_profiles
       WHERE mocha_user_id = ?`,
    )
      .bind(mochaUserIdKey(mochaUser))
      .first<{
        home_latitude: number | null;
        home_longitude: number | null;
        home_location: string | null;
      }>();

    const lat = parseCoord(profile?.home_latitude);
    const lon = parseCoord(profile?.home_longitude);
    if (lat != null && lon != null) {
      const label =
        typeof profile?.home_location === 'string' && profile.home_location.trim()
          ? profile.home_location.trim()
          : undefined;
      return { latitude: lat, longitude: lon, source: 'profile', label };
    }
  }

  const cf = (c.req.raw as Request & { cf?: CfGeo }).cf;
  const cfLat = parseCoord(cf?.latitude);
  const cfLon = parseCoord(cf?.longitude);
  if (cfLat != null && cfLon != null) {
    const label =
      [cf?.city, cf?.region].filter((p) => typeof p === 'string' && p.trim()).join(', ') ||
      undefined;
    return { latitude: cfLat, longitude: cfLon, source: 'ip', label };
  }

  return DEFAULT_LOCATION;
}
