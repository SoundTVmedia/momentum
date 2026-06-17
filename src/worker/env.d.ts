/**
 * Cloudflare Worker Environment Bindings
 */
interface Env {
  // Database
  DB: D1Database;
  
  // Object Storage
  R2_BUCKET: R2Bucket;
  R2_THUMBNAILS_BUCKET: R2Bucket;
  /** R2 S3 API — optional; enables presigned direct multipart uploads. */
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  
  // Mocha Users Service
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
  /** Optional default for OAuth redirect_base when the client does not send ?redirect_base= */
  MOCHA_OAUTH_REDIRECT_ORIGIN?: string;
  /** Optional full OAuth callback URL override (e.g. https://your-domain.com/auth/callback). */
  OAUTH_REDIRECT_URI?: string;

  /** Web origin for password-reset links when Origin header is absent (e.g. server-side or non-browser clients). */
  PUBLIC_APP_URL?: string;

  /** Static assets binding (Vite build output) — SPA shell + clip share OG injection. */
  ASSETS: { fetch: typeof fetch };
  RESEND_API_KEY?: string;
  TRANSACTIONAL_EMAIL_FROM?: string;
  
  // JamBase API
  JAMBASE_API_KEY: string;
  /** Used only when `JAMBASE_QUOTA_ENFORCEMENT` is `1` / `true` / `on`. Default 1000. */
  JAMBASE_QUOTA_MAX?: string;
  /** Set to `1` / `true` / `on` to enable D1 upstream cap (requires migration 42). If unset, no cap. */
  JAMBASE_QUOTA_ENFORCEMENT?: string;
  /** With enforcement on: `all` (default) = one lifetime counter; `month` = per UTC month (`jam:month:YYYY-MM`). */
  JAMBASE_QUOTA_WINDOW?: string;
  
  // Stripe Payment Processing
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  
  // Cloudflare Stream Video Processing
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_STREAM_API_TOKEN: string;
  
  // Ticketmaster API
  TICKETMASTER_API_KEY: string;
  
  // Google Maps API
  GOOGLE_MAPS_API_KEY: string;

  /** Direct Google OAuth (optional — used when Mocha Users Service key is not set). */
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;

  /** Optional — [ACRCloud](https://www.acrcloud.com/) music recognition (preferred when all three are set). */
  ACRCLOUD_HOST?: string;
  ACRCLOUD_ACCESS_KEY?: string;
  ACRCLOUD_ACCESS_SECRET?: string;

  /** Optional — [AudD](https://docs.audd.io/) fallback when ACRCloud is not configured */
  AUDD_API_TOKEN?: string;

  /** YouTube Data API v3 — favorite-artist video carousels (server-side only). */
  YOUTUBE_API_KEY?: string;
  /** Set to `1` / `true` / `on` to cap daily YouTube API units in D1 (requires migration 50). */
  YOUTUBE_QUOTA_ENFORCEMENT?: string;
  /** Max units per UTC day when enforcement is on (default 9500). Search costs 100 units each. */
  YOUTUBE_QUOTA_MAX?: string;
}
