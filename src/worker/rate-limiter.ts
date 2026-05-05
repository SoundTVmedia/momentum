import { Context } from 'hono';

/**
 * Rate Limiter Middleware
 * Prevents API abuse with configurable limits per endpoint
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
  /**
   * If set, all routes using the same bucket name share one counter per client
   * (e.g. every `/api/jambase/*` path counts toward the same hourly cap).
   */
  sharedBucket?: string;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory store for rate limits (production should use KV or D1)
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Create rate limiter middleware
 */
export function rateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    sharedBucket,
  } = config;

  return async (c: Context, next: () => Promise<void>) => {
    const identifier = getIdentifier(c);
    const key = sharedBucket
      ? `shared:${sharedBucket}:${identifier}`
      : `${c.req.path}:${identifier}`;
    const now = Date.now();

    // Get or create rate limit record
    let record = rateLimitStore.get(key);

    // Reset if window expired
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    // Increment request count
    record.count++;
    rateLimitStore.set(key, record);

    // Check if limit exceeded
    if (record.count > maxRequests) {
      const resetIn = Math.ceil((record.resetTime - now) / 1000);
      c.header('Retry-After', resetIn.toString());
      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', record.resetTime.toString());
      
      return c.json({ error: message, retryAfter: resetIn }, 429);
    }

    // Set rate limit headers
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', (maxRequests - record.count).toString());
    c.header('X-RateLimit-Reset', record.resetTime.toString());

    await next();
  };
}

/**
 * Get unique identifier for rate limiting
 * Uses user ID if authenticated, otherwise IP address
 */
function getIdentifier(c: Context): string {
  const user = c.get('user');
  if (user?.id) {
    return `user:${user.id}`;
  }

  // Try to get real IP from headers (Cloudflare)
  const cfConnectingIp = c.req.header('CF-Connecting-IP');
  if (cfConnectingIp) {
    return `ip:${cfConnectingIp}`;
  }

  const xForwardedFor = c.req.header('X-Forwarded-For');
  if (xForwardedFor) {
    return `ip:${xForwardedFor.split(',')[0].trim()}`;
  }

  return 'ip:unknown';
}

/**
 * Cleanup expired rate limit records
 * Should be called periodically (e.g., via scheduled worker)
 */
export function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Preset rate limit configurations
 */
export const RateLimits = {
  // Very strict - for sensitive operations
  STRICT: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 per 15 minutes
  
  // Auth operations
  AUTH: { windowMs: 15 * 60 * 1000, maxRequests: 10 }, // 10 per 15 minutes
  
  // Upload operations
  UPLOAD: { windowMs: 60 * 60 * 1000, maxRequests: 20 }, // 20 per hour
  
  // API calls
  API: { windowMs: 15 * 60 * 1000, maxRequests: 100 }, // 100 per 15 minutes
  
  // Search operations
  SEARCH: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 per minute
  
  // General requests
  GENERAL: { windowMs: 60 * 1000, maxRequests: 60 }, // 60 per minute

  /**
   * Shared bucket for all `/api/jambase/*` handlers (per user/IP, rolling hour).
   * Keeps browser abuse from burning JamBase quota (20k/mo, 7200/hr at JamBase).
   */
  JAMBASE_PROXY_HOURLY: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 240,
    sharedBucket: 'jambase-proxy',
    message:
      'Too many live-music lookups this hour. Please wait a bit or narrow your search.',
  },

  /**
   * Advanced discover search can trigger several JamBase calls per request when `q` is set.
   */
  ADVANCED_SEARCH_HOURLY: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 90,
    sharedBucket: 'advanced-search',
    message: 'Too many searches this hour. Please try again later.',
  },
};
