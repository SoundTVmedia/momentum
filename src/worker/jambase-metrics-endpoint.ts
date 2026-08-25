import type { Context } from 'hono';
import { getStaffProfile, isAdmin } from './admin-auth';
import { mochaUserIdKey } from './mocha-user-id';
import { loadJamBaseCacheMetrics } from './jambase-cache';
import { noCache } from './performance-utils';

export async function getJamBaseCacheMetrics(c: Context) {
  const mochaUser = c.get('user');
  if (!mochaUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const profile = await getStaffProfile(c.env.DB, mochaUserIdKey(mochaUser));
  if (!isAdmin(profile)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  noCache(c);
  const daysRaw = Number.parseInt(c.req.query('days') || '14', 10);
  const days = Number.isFinite(daysRaw) ? Math.min(90, Math.max(1, daysRaw)) : 14;
  const metrics = await loadJamBaseCacheMetrics(c.env.DB, days);
  const todayTotal = metrics.todayUpstream + metrics.todayHits;
  const hitRate =
    todayTotal > 0 ? Math.round((metrics.todayHits / todayTotal) * 1000) / 10 : null;

  return c.json({
    days,
    targetUpstreamPerDay: 50,
    today: {
      upstream_calls: metrics.todayUpstream,
      cache_hits: metrics.todayHits,
      hit_rate_pct: hitRate,
      under_target: metrics.todayUpstream < 50,
    },
    window: {
      upstream_calls: metrics.windowUpstream,
      cache_hits: metrics.windowHits,
    },
    rows: metrics.rows,
  });
}
