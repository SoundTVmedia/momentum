/**
 * Cloudflare Worker Environment Bindings
 */
interface Env {
  // Database
  DB: D1Database;
  
  // Object Storage
  R2_BUCKET: R2Bucket;
  R2_THUMBNAILS_BUCKET: R2Bucket;
  
  // Mocha Users Service
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
  /** Optional default for OAuth redirect_base when the client does not send ?redirect_base= */
  MOCHA_OAUTH_REDIRECT_ORIGIN?: string;

  /** Web origin for password-reset links when Origin header is absent (e.g. server-side or non-browser clients). */
  PUBLIC_APP_URL?: string;
  RESEND_API_KEY?: string;
  TRANSACTIONAL_EMAIL_FROM?: string;
  
  // JamBase API
  JAMBASE_API_KEY: string;
  /** Max upstream JamBase calls (D1 `jambase_api_usage`, bucket `jam:upstream`). Default 1000. */
  JAMBASE_QUOTA_MAX?: string;
  /** Set to `0` / `false` / `off` to disable D1 quota enforcement (e.g. before migration 42). */
  JAMBASE_QUOTA_ENFORCEMENT?: string;
  
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
}
