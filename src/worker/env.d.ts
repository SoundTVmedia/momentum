/**
 * Cloudflare Worker Environment Bindings
 */
interface Env {
  // Database
  DB: D1Database;
  
  // Object Storage
  R2_BUCKET: R2Bucket;
  
  // Mocha Users Service
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
  
  // JamBase API
  JAMBASE_API_KEY: string;
  
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
