import { Context } from 'hono';

/**
 * Performance Optimization Utilities
 * Caching, compression, lazy loading helpers
 */

/**
 * Add aggressive caching headers for static assets
 */
export function cacheStatic(c: Context, maxAge: number = 31536000) {
  c.header('Cache-Control', `public, max-age=${maxAge}, immutable`);
  c.header('CDN-Cache-Control', `public, max-age=${maxAge}`);
}

/**
 * Add short-term caching for dynamic content
 */
export function cacheDynamic(c: Context, maxAge: number = 60, staleWhileRevalidate: number = 300) {
  c.header('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
}

/**
 * No cache for sensitive data
 */
export function noCache(c: Context) {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
}

/**
 * Add ETag for conditional requests
 */
export function setETag(c: Context, content: string): string {
  const hash = simpleHash(content);
  c.header('ETag', `"${hash}"`);
  return hash;
}

/**
 * Check if ETag matches (304 Not Modified)
 */
export function checkETag(c: Context, etag: string): boolean {
  const ifNoneMatch = c.req.header('If-None-Match');
  return ifNoneMatch === `"${etag}"`;
}

/**
 * Simple hash function for ETags
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Compress response if supported
 */
export function enableCompression(c: Context) {
  const acceptEncoding = c.req.header('Accept-Encoding') || '';
  
  if (acceptEncoding.includes('gzip')) {
    c.header('Content-Encoding', 'gzip');
  } else if (acceptEncoding.includes('deflate')) {
    c.header('Content-Encoding', 'deflate');
  } else if (acceptEncoding.includes('br')) {
    c.header('Content-Encoding', 'br');
  }
}

/**
 * Pagination helper for large datasets
 */
export interface PaginationParams {
  page: number;
  limit: number;
  maxLimit?: number;
}

export function getPaginationParams(c: Context, maxLimit: number = 100): PaginationParams {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(c.req.query('limit') || '20'))
  );
  
  return { page, limit, maxLimit };
}

export function getPaginationOffset(params: PaginationParams): number {
  return (params.page - 1) * params.limit;
}

/**
 * Batch database queries
 */
export async function batchQuery<T>(
  db: D1Database,
  queries: D1PreparedStatement[]
): Promise<T[]> {
  const results = await db.batch(queries);
  return results.map((r: any) => r.results || []).flat();
}

/**
 * Preload critical resources
 */
export function preloadResources(c: Context, resources: Array<{ url: string; type: string }>) {
  resources.forEach(({ url, type }) => {
    c.header('Link', `<${url}>; rel=preload; as=${type}`, { append: true });
  });
}

/**
 * Mobile detection
 */
export function isMobileRequest(c: Context): boolean {
  const userAgent = c.req.header('User-Agent') || '';
  return /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
}

/**
 * Optimize image URLs for mobile
 */
export function optimizeImageUrl(url: string, isMobile: boolean): string {
  if (!url) return url;
  
  // Add image optimization parameters
  const params = isMobile ? 'w=800&q=75' : 'w=1200&q=85';
  
  if (url.includes('?')) {
    return `${url}&${params}`;
  }
  return `${url}?${params}`;
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private startTime: number;
  private markers: Map<string, number>;

  constructor() {
    this.startTime = Date.now();
    this.markers = new Map();
  }

  mark(name: string) {
    this.markers.set(name, Date.now() - this.startTime);
  }

  getMetrics() {
    return {
      totalTime: Date.now() - this.startTime,
      markers: Object.fromEntries(this.markers),
    };
  }

  setHeaders(c: Context) {
    const metrics = this.getMetrics();
    c.header('Server-Timing', 
      Object.entries(metrics.markers)
        .map(([name, time]) => `${name};dur=${time}`)
        .join(', ')
    );
    c.header('X-Response-Time', `${metrics.totalTime}ms`);
  }
}
