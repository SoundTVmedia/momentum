import { Hono } from "hono";
import {
  exchangeCodeForSessionToken,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
  DEFAULT_MOCHA_USERS_SERVICE_API_URL,
} from "@getmocha/users-service/backend";
import {
  authMiddleware,
  EMAIL_SESSION_COOKIE_NAME,
  clearEmailSessionCookie,
  revokeEmailSession,
  isLocalDevHost,
} from "./hybrid-auth";
import { getCookie, setCookie } from "hono/cookie";
import { handleScheduled } from "./scheduled";
import * as moderation from "./moderation-endpoints";
import * as discovery from "./discovery-endpoints";
import * as jambase from "./jambase-endpoints";
import * as stripe from "./stripe-endpoints";
import { handleStripeWebhook } from "./stripe-webhooks";
import { createStreamService } from "./stream-service";
import * as stream from "./stream-endpoints";
import { createRealtimeService } from "./realtime-service";
import * as twoFactor from "./two-factor-endpoints";
import * as analytics from "./analytics-endpoints";
import * as collaboration from "./collaboration-endpoints";
import * as gamification from "./gamification-endpoints";
import * as livePolls from "./live-polls-endpoints";
import * as gdpr from "./gdpr-endpoints";
import * as ticketmaster from "./ticketmaster-endpoints";
import * as googleMaps from "./google-maps-endpoints";
import * as rating from "./rating-endpoints";
import * as favorite from "./favorite-endpoints";
import * as profile from "./profile-endpoints";
import * as discoverPrioritized from "./discover-prioritized-endpoints";
import * as deviceToken from "./device-token-endpoints";
import * as authEndpoints from "./auth-endpoints";
import * as personalization from "./personalization-endpoints";
import { rateLimiter, RateLimits } from "./rate-limiter";
import { PerformanceMonitor } from "./performance-utils";
import { handleResumableUpload } from "./resumable-upload-endpoints";
import { deleteOwnClip } from "./clip-endpoints";
export { RealtimeDurableObject } from "./realtime-durable-object";

const app = new Hono<{ Bindings: Env }>();

// Global rate limiting for general API endpoints
app.use('/api/*', rateLimiter(RateLimits.GENERAL));

// Performance monitoring middleware
app.use('*', async (c, next) => {
  const monitor = new PerformanceMonitor();
  await next();
  monitor.setHeaders(c);
});

const ALLOWED_OAUTH_PROVIDERS = new Set(['google', 'spotify']);

// OAuth redirect URL (Google, Spotify — proxied to Mocha Users Service when enabled there)
app.get('/api/oauth/:provider/redirect_url', async (c) => {
  const provider = c.req.param('provider');
  if (!ALLOWED_OAUTH_PROVIDERS.has(provider)) {
    return c.json({ error: 'Unsupported OAuth provider' }, 400);
  }

  const apiKey = c.env.MOCHA_USERS_SERVICE_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.trim() === '') {
    return c.json(
      {
        error:
          'OAuth is not configured. Set MOCHA_USERS_SERVICE_API_KEY in .dev.vars (local) or Worker secrets (Cloudflare).',
      },
      503
    );
  }

  const apiUrl =
    c.env.MOCHA_USERS_SERVICE_API_URL || DEFAULT_MOCHA_USERS_SERVICE_API_URL;

  const redirectBase =
    c.req.query('redirect_base')?.trim() ||
    (typeof c.env.MOCHA_OAUTH_REDIRECT_ORIGIN === 'string'
      ? c.env.MOCHA_OAUTH_REDIRECT_ORIGIN.trim()
      : '');
  const mochaParams = new URLSearchParams();
  if (redirectBase.length > 0) {
    mochaParams.set('redirect_base', redirectBase);
  }
  const qs = mochaParams.toString();
  const mochaRedirectUrl = `${apiUrl}/oauth/${provider}/redirect_url${qs ? `?${qs}` : ''}`;

  const response = await fetch(mochaRedirectUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('Mocha OAuth redirect error', provider, response.status, errBody);
    return c.json(
      {
        error:
          provider === 'spotify'
            ? 'Spotify sign-in is not available. Try Google or email, enable Spotify in your Mocha project, and allow this app origin as a redirect URL.'
            : 'Could not start Google sign-in. Check Mocha API URL and key, and register this app origin /auth/callback in your Mocha app settings.',
      },
      502
    );
  }

  const data = (await response.json()) as { redirect_url: string };
  return c.json({ redirectUrl: data.redirect_url }, 200);
});

// Exchange code for session token
app.post("/api/sessions", async (c) => {
  const body = await c.req.json();

  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }

  const apiKey = c.env.MOCHA_USERS_SERVICE_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.trim() === '') {
    return c.json(
      {
        error:
          'OAuth is not configured. Set MOCHA_USERS_SERVICE_API_KEY in .dev.vars or Worker secrets.',
      },
      503
    );
  }

  let sessionToken: string;
  try {
    sessionToken = await exchangeCodeForSessionToken(body.code, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey,
    });
  } catch (e) {
    console.error('exchangeCodeForSessionToken:', e);
    return c.json(
      {
        error:
          'Could not exchange OAuth code. Confirm Mocha credentials and that this deployment URL is allowed for OAuth return.',
      },
      502
    );
  }

  const local = isLocalDevHost(c);
  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: local ? "lax" : "none",
    secure: !local,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return c.json({ success: true }, 200);
});

// Get current user
app.get("/api/users/me", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  // Fetch user profile from database
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  return c.json({
    ...mochaUser,
    profile: profile || null,
  });
});

// Logout
app.get('/api/logout', async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === 'string') {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  const localLogout = isLocalDevHost(c);
  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: localLogout ? 'lax' : 'none',
    secure: !localLogout,
    maxAge: 0,
  });

  const emailToken = getCookie(c, EMAIL_SESSION_COOKIE_NAME);
  if (typeof emailToken === 'string' && emailToken.length > 0) {
    await revokeEmailSession(c.env.DB, emailToken);
  }
  clearEmailSessionCookie(c);

  return c.json({ success: true }, 200);
});

// Email/password registration and sign-in
app.post(
  "/api/auth/signup",
  rateLimiter(RateLimits.AUTH),
  authEndpoints.emailSignUp
);
app.post(
  "/api/auth/signin",
  rateLimiter(RateLimits.AUTH),
  authEndpoints.emailPasswordSignIn
);
app.post(
  "/api/auth/forgot-password",
  rateLimiter(RateLimits.AUTH),
  authEndpoints.requestPasswordReset
);
app.post(
  "/api/auth/reset-password",
  rateLimiter(RateLimits.AUTH),
  authEndpoints.confirmPasswordReset
);

// Device Token Endpoints for "Remember Me" functionality
app.post("/api/auth/create-device-token", authMiddleware, deviceToken.createDeviceToken);
app.post("/api/auth/verify-device-token", deviceToken.verifyDeviceToken);
app.get("/api/auth/device-tokens", authMiddleware, deviceToken.getDeviceTokens);
app.delete("/api/auth/device-tokens/:tokenId", authMiddleware, deviceToken.revokeDeviceToken);
app.delete("/api/auth/device-tokens", authMiddleware, deviceToken.revokeAllDeviceTokens);

// Personalization Endpoints
app.post("/api/personalization/update", authMiddleware, personalization.updatePersonalization);
app.get("/api/feed/personalized", authMiddleware, personalization.getPersonalizedFeed);
app.get("/api/personalization/concerts", authMiddleware, personalization.getPersonalizedConcerts);

// Submit verification request
app.post("/api/users/verification-request", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { full_name, reason, proof_url, social_links } = body;

  if (!full_name || !reason || !proof_url || !social_links) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // Check if user already has a pending request
  const existingRequest = await c.env.DB.prepare(
    "SELECT id FROM verification_requests WHERE mocha_user_id = ? AND status = 'pending'"
  )
    .bind(mochaUser.id)
    .first();

  if (existingRequest) {
    return c.json({ error: "You already have a pending verification request" }, 400);
  }

  // Create verification request
  await c.env.DB.prepare(
    `INSERT INTO verification_requests (mocha_user_id, full_name, reason, proof_url, social_links, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(mochaUser.id, full_name, reason, proof_url, social_links)
    .run();

  return c.json({ success: true }, 201);
});

// Admin: Get verification requests
app.get("/api/admin/verification-requests", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const statusFilter = c.req.query('status') || 'pending';

  let query = `
    SELECT 
      verification_requests.*,
      user_profiles.display_name,
      user_profiles.role,
      user_profiles.profile_image_url
    FROM verification_requests
    LEFT JOIN user_profiles ON verification_requests.mocha_user_id = user_profiles.mocha_user_id
  `;

  const bindings: any[] = [];

  if (statusFilter !== 'all') {
    query += ` WHERE verification_requests.status = ?`;
    bindings.push(statusFilter);
  }

  query += ` ORDER BY verification_requests.created_at DESC LIMIT 100`;

  const requests = await c.env.DB.prepare(query)
    .bind(...bindings)
    .all();

  return c.json({ requests: requests.results || [] });
});

// Admin: Review verification request
app.post("/api/admin/verification-requests/:requestId/review", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const requestId = c.req.param('requestId');
  const body = await c.req.json();
  const { action, rejection_reason } = body; // 'approve' or 'reject'

  if (!action || (action !== 'approve' && action !== 'reject')) {
    return c.json({ error: "Invalid action" }, 400);
  }

  // Get the request
  const request = await c.env.DB.prepare(
    "SELECT mocha_user_id FROM verification_requests WHERE id = ?"
  )
    .bind(requestId)
    .first();

  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }

  if (action === 'approve') {
    // Update user profile to verified
    await c.env.DB.prepare(
      "UPDATE user_profiles SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE mocha_user_id = ?"
    )
      .bind(request.mocha_user_id)
      .run();

    // Mark request as approved
    await c.env.DB.prepare(
      `UPDATE verification_requests 
       SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(mochaUser.id, requestId)
      .run();

    // Create notification
    await c.env.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, created_at)
       VALUES (?, 'verification', 'Your verification request has been approved! 🎉', CURRENT_TIMESTAMP)`
    )
      .bind(request.mocha_user_id)
      .run();
  } else {
    // Mark request as rejected
    await c.env.DB.prepare(
      `UPDATE verification_requests 
       SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(mochaUser.id, rejection_reason || null, requestId)
      .run();

    // Create notification
    await c.env.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, created_at)
       VALUES (?, 'verification', ?, CURRENT_TIMESTAMP)`
    )
      .bind(
        request.mocha_user_id,
        rejection_reason 
          ? `Your verification request was not approved. Reason: ${rejection_reason}` 
          : 'Your verification request was not approved.'
      )
      .run();
  }

  return c.json({ success: true });
});

// Create or update user profile
app.post("/api/users/profile", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const nullIfUndef = (v: unknown) => (v === undefined ? null : v);

  try {
    const body = await c.req.json();

    const {
      role,
      display_name,
      bio,
      location,
      profile_image_url,
      cover_image_url,
      city,
      genres,
      social_links,
    } = body;

    const roleVal =
      typeof role === "string" && role.trim() !== "" ? role : "fan";
    const genresJson = JSON.stringify(Array.isArray(genres) ? genres : []);
    const socialJson = JSON.stringify(
      social_links !== undefined &&
        social_links !== null &&
        typeof social_links === "object"
        ? social_links
        : {}
    );

    // Check if profile exists
    const existingProfile = await c.env.DB.prepare(
      "SELECT id FROM user_profiles WHERE mocha_user_id = ?"
    )
      .bind(mochaUser.id)
      .first();

    if (existingProfile) {
      // Update existing profile
      await c.env.DB.prepare(
        `UPDATE user_profiles 
       SET role = ?, display_name = ?, bio = ?, location = ?, 
           profile_image_url = ?, cover_image_url = ?, city = ?, 
           genres = ?, social_links = ?, updated_at = CURRENT_TIMESTAMP
       WHERE mocha_user_id = ?`
      )
        .bind(
          roleVal,
          nullIfUndef(display_name),
          nullIfUndef(bio),
          nullIfUndef(location),
          nullIfUndef(profile_image_url),
          nullIfUndef(cover_image_url),
          nullIfUndef(city),
          genresJson,
          socialJson,
          mochaUser.id
        )
        .run();
    } else {
      // Create new profile
      await c.env.DB.prepare(
        `INSERT INTO user_profiles 
       (mocha_user_id, role, display_name, bio, location, profile_image_url, 
        cover_image_url, city, genres, social_links, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
        .bind(
          mochaUser.id,
          roleVal,
          nullIfUndef(display_name),
          nullIfUndef(bio),
          nullIfUndef(location),
          nullIfUndef(profile_image_url),
          nullIfUndef(cover_image_url),
          nullIfUndef(city),
          genresJson,
          socialJson
        )
        .run();
    }

    // Fetch updated profile
    const updatedProfile = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE mocha_user_id = ?"
    )
      .bind(mochaUser.id)
      .first();

    return c.json(updatedProfile);
  } catch (e) {
    console.error("POST /api/users/profile:", e);
    return c.json({ error: "Could not save profile" }, 500);
  }
});

// Resumable upload endpoint for large files
app.post("/api/upload/resumable", authMiddleware, handleResumableUpload);

// Upload file to R2 or Cloudflare Stream (with stricter rate limit)
app.post("/api/upload", authMiddleware, rateLimiter(RateLimits.UPLOAD), async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string | null;

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  if (!type || (type !== 'video' && type !== 'thumbnail')) {
    return c.json({ error: "Invalid file type" }, 400);
  }

  try {
    // Handle video uploads via Cloudflare Stream
    if (type === 'video') {
      try {
        const streamService = createStreamService(c.env);
        const videoDetails = await streamService.uploadVideo(file, {
          name: file.name
        });

        return c.json({
          success: true,
          streamVideoId: videoDetails.uid,
          playbackUrl: videoDetails.playbackUrl,
          thumbnailUrl: videoDetails.thumbnail,
          status: videoDetails.status,
          readyToStream: videoDetails.readyToStream,
          duration: videoDetails.duration,
          type: 'stream'
        }, 201);
      } catch (streamError) {
        console.error('Stream upload failed, falling back to R2:', streamError);
        // Fall through to R2 upload as fallback
      }
    }

    // Upload to R2 (for thumbnails or as video fallback)
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `clips/${mochaUser.id}/${type}/${timestamp}_${sanitizedName}`;

    // Determine content type
    const contentType = file.type || (type === 'video' ? 'video/mp4' : 'image/jpeg');

    // Upload to R2
    await c.env.R2_BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: contentType,
      },
    });

    // Generate public URL
    const publicUrl = `/api/files/${encodeURIComponent(key)}`;

    return c.json({ 
      success: true,
      url: publicUrl,
      key: key,
      size: file.size,
      type: contentType
    }, 201);
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: "Failed to upload file" }, 500);
  }
});

// Retrieve file from R2
app.get("/api/files/:key{.+}", async (c) => {
  const key = decodeURIComponent(c.req.param('key'));

  try {
    const object = await c.env.R2_BUCKET.get(key);

    if (!object) {
      return c.json({ error: "File not found" }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000");

    return c.body(object.body, { headers });
  } catch (error) {
    console.error('File retrieval error:', error);
    return c.json({ error: "Failed to retrieve file" }, 500);
  }
});

// Create a new clip
app.post("/api/clips", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const body = await c.req.json();
  const { 
    artist_name, 
    venue_name, 
    location, 
    timestamp, 
    content_description, 
    video_url, 
    thumbnail_url, 
    hashtags,
    stream_video_id,
    stream_playback_url,
    stream_thumbnail_url,
    video_status,
    video_duration,
    status,
    recording_orientation,
    video_resolution_w,
    video_resolution_h
  } = body;

  if (!video_url && !stream_video_id) {
    return c.json({ error: "video_url or stream_video_id is required" }, 400);
  }

  const { 
    geolocation_latitude, 
    geolocation_longitude, 
    geolocation_accuracy_radius 
  } = body;

  const result = await c.env.DB.prepare(
    `INSERT INTO clips 
     (mocha_user_id, artist_name, venue_name, location, timestamp, content_description, 
      video_url, thumbnail_url, hashtags, stream_video_id, stream_playback_url, 
      stream_thumbnail_url, video_status, video_duration, status, 
      geolocation_latitude, geolocation_longitude, geolocation_accuracy_radius, 
      recording_orientation, video_resolution_w, video_resolution_h,
      is_draft, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(
      mochaUser.id,
      artist_name || null,
      venue_name || null,
      location || null,
      timestamp || new Date().toISOString(),
      content_description || null,
      video_url || null,
      thumbnail_url || null,
      JSON.stringify(hashtags || []),
      stream_video_id || null,
      stream_playback_url || null,
      stream_thumbnail_url || null,
      video_status || 'ready',
      video_duration || null,
      status || 'published',
      geolocation_latitude || null,
      geolocation_longitude || null,
      geolocation_accuracy_radius || null,
      recording_orientation || null,
      video_resolution_w || null,
      video_resolution_h || null,
      (status === 'draft') ? 1 : 0
    )
    .run();

  const newClip = await c.env.DB.prepare(
    "SELECT * FROM clips WHERE id = ?"
  )
    .bind(result.meta.last_row_id)
    .first();

  // Award points for uploading a clip
  try {
    await gamification.awardPoints(c.env, mochaUser.id, 10, 'Uploaded a concert clip', result.meta.last_row_id as number);
  } catch (err) {
    console.error('Failed to award points:', err);
  }

  // Broadcast real-time feed update
  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastFeedUpdate(result.meta.last_row_id as number);
  } catch (err) {
    console.error('Failed to broadcast feed update:', err);
  }

  // Trigger personalization notifications for users who follow this artist or are near this location
  if (artist_name || (geolocation_latitude && geolocation_longitude)) {
    try {
      await personalization.triggerPersonalizationNotifications(c.env, {
        id: result.meta.last_row_id as number,
        artist_name,
        venue_name,
        location,
        latitude: geolocation_latitude,
        longitude: geolocation_longitude,
        type: 'clip'
      });
    } catch (err) {
      console.error('Failed to trigger personalization notifications:', err);
    }
  }

  return c.json(newClip, 201);
});

// Get clips feed (optimized with caching headers)
app.get("/api/clips", async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50); // Cap at 50
  const sortBy = c.req.query('sort_by') || 'latest';
  const artistName = c.req.query('artist_name');
  const venueName = c.req.query('venue_name');
  const userId = c.req.query('user_id');
  const since = c.req.query('since');
  
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      CASE WHEN live_featured_clips.id IS NOT NULL THEN 1 ELSE 0 END as momentum_live_featured
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    LEFT JOIN live_featured_clips ON clips.id = live_featured_clips.clip_id
    WHERE clips.is_hidden = 0
    AND clips.is_draft = 0
  `;
  
  const bindings: any[] = [];
  
  if (artistName) {
    query += ` AND clips.artist_name = ?`;
    bindings.push(artistName);
  }
  
  if (venueName) {
    query += ` AND clips.venue_name = ?`;
    bindings.push(venueName);
  }
  
  if (userId) {
    query += ` AND clips.mocha_user_id = ?`;
    bindings.push(userId);
  }
  
  if (since) {
    query += ` AND clips.created_at > ?`;
    bindings.push(since);
  }
  
  // Apply sorting with optimized indexes
  switch (sortBy) {
    case 'trending':
      // Use precomputed trending score or calculate efficiently
      query += ` ORDER BY clips.is_trending_score DESC, clips.created_at DESC`;
      break;
    case 'most_liked':
      query += ` ORDER BY clips.likes_count DESC, clips.created_at DESC`;
      break;
    case 'most_viewed':
      query += ` ORDER BY clips.views_count DESC, clips.created_at DESC`;
      break;
    case 'top_rated':
      query += ` ORDER BY clips.average_rating DESC, clips.rating_count DESC, clips.created_at DESC`;
      break;
    case 'latest':
    default:
      query += ` ORDER BY clips.created_at DESC`;
      break;
  }
  
  query += ` LIMIT ? OFFSET ?`;
  bindings.push(limit, offset);
  
  const clips = await c.env.DB.prepare(query)
    .bind(...bindings)
    .all();

  // Add cache headers for better performance
  c.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');

  return c.json({
    clips: clips.results || [],
    page,
    limit,
    hasMore: (clips.results || []).length === limit
  });
});

// Get single clip
app.get("/api/clips/:id", async (c) => {
  const clipId = c.req.param('id');
  
  const clip = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.id = ?`
  )
    .bind(clipId)
    .first();

  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }

  // Increment view count
  await c.env.DB.prepare(
    "UPDATE clips SET views_count = views_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  )
    .bind(clipId)
    .run();

  return c.json(clip);
});

// Like a clip
app.post("/api/clips/:id/like", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const clipId = c.req.param('id');
  
  // Check if clip exists
  const clip = await c.env.DB.prepare(
    "SELECT id, mocha_user_id FROM clips WHERE id = ?"
  )
    .bind(clipId)
    .first();

  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }

  // Check if user already liked this clip
  const existingLike = await c.env.DB.prepare(
    "SELECT id FROM clip_likes WHERE clip_id = ? AND mocha_user_id = ?"
  )
    .bind(clipId, mochaUser.id)
    .first();

  if (existingLike) {
    // Unlike - remove like and decrement count
    await c.env.DB.prepare(
      "DELETE FROM clip_likes WHERE clip_id = ? AND mocha_user_id = ?"
    )
      .bind(clipId, mochaUser.id)
      .run();

    await c.env.DB.prepare(
      "UPDATE clips SET likes_count = likes_count - 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
      .bind(clipId)
      .run();

    return c.json({ liked: false });
  } else {
    // Like - add like and increment count
    await c.env.DB.prepare(
      "INSERT INTO clip_likes (clip_id, mocha_user_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
    )
      .bind(clipId, mochaUser.id)
      .run();

    await c.env.DB.prepare(
      "UPDATE clips SET likes_count = likes_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
      .bind(clipId)
      .run();

    // Award points to the clip owner
    try {
      await gamification.awardPoints(c.env, clip.mocha_user_id as string, 2, 'Received a like', parseInt(clipId));
    } catch (err) {
      console.error('Failed to award points:', err);
    }

    // Award points to the liker
    try {
      await gamification.awardPoints(c.env, mochaUser.id, 1, 'Liked a clip', parseInt(clipId));
    } catch (err) {
      console.error('Failed to award points:', err);
    }

    // Create notification for clip owner (if not self-like)
    if (clip.mocha_user_id !== mochaUser.id) {
      // Check if clip has been featured on live show
      const featured = await c.env.DB.prepare(
        `SELECT id FROM live_featured_clips WHERE clip_id = ? LIMIT 1`
      )
        .bind(clipId)
        .first();

      const notificationContent = featured 
        ? 'liked your clip that was featured on Momentum Live'
        : 'liked your clip';

      const notificationResult = await c.env.DB.prepare(
        `INSERT INTO notifications (mocha_user_id, type, content, related_user_id, related_clip_id, created_at)
         VALUES (?, 'like', ?, ?, ?, CURRENT_TIMESTAMP)`
      )
        .bind(
          clip.mocha_user_id,
          notificationContent,
          mochaUser.id,
          clipId
        )
        .run();

      // Fetch the notification to broadcast
      const notification = await c.env.DB.prepare(
        `SELECT 
          notifications.*,
          user_profiles.display_name as user_display_name,
          user_profiles.profile_image_url as user_avatar
        FROM notifications
        LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
        WHERE notifications.id = ?`
      )
        .bind(notificationResult.meta.last_row_id)
        .first();

      // Broadcast real-time notification
      try {
        const realtime = createRealtimeService(c.env);
        await realtime.broadcastNotification(clip.mocha_user_id as string, notification);
      } catch (err) {
        console.error('Failed to broadcast notification:', err);
      }
    }

    return c.json({ liked: true });
  }
});

// Save/bookmark a clip
app.post("/api/clips/:id/save", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const clipId = c.req.param('id');
  
  // Check if clip exists
  const clip = await c.env.DB.prepare(
    "SELECT id FROM clips WHERE id = ?"
  )
    .bind(clipId)
    .first();

  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }

  // Check if already saved
  const existingSave = await c.env.DB.prepare(
    "SELECT id FROM saved_clips WHERE clip_id = ? AND mocha_user_id = ?"
  )
    .bind(clipId, mochaUser.id)
    .first();

  if (existingSave) {
    // Unsave
    await c.env.DB.prepare(
      "DELETE FROM saved_clips WHERE clip_id = ? AND mocha_user_id = ?"
    )
      .bind(clipId, mochaUser.id)
      .run();

    return c.json({ saved: false });
  } else {
    // Save
    await c.env.DB.prepare(
      "INSERT INTO saved_clips (clip_id, mocha_user_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
    )
      .bind(clipId, mochaUser.id)
      .run();

    return c.json({ saved: true });
  }
});

// Delete own clip (uploader only)
app.delete("/api/clips/:id", authMiddleware, deleteOwnClip);

// Get comments for a clip (optimized with pagination)
app.get("/api/clips/:id/comments", async (c) => {
  const clipId = c.req.param('id');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');
  
  const comments = await c.env.DB.prepare(
    `SELECT 
      comments.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM comments
    LEFT JOIN user_profiles ON comments.mocha_user_id = user_profiles.mocha_user_id
    WHERE comments.clip_id = ?
    ORDER BY comments.created_at DESC
    LIMIT ? OFFSET ?`
  )
    .bind(clipId, limit, offset)
    .all();

  // Cache comments briefly
  c.header('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');

  return c.json({ 
    comments: comments.results || [],
    hasMore: (comments.results || []).length === limit
  });
});

// Post a comment on a clip
app.post("/api/clips/:id/comments", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const clipId = c.req.param('id');
  const body = await c.req.json();
  const { content, parent_comment_id } = body;

  if (!content) {
    return c.json({ error: "Comment content is required" }, 400);
  }

  // Check if clip exists
  const clip = await c.env.DB.prepare(
    "SELECT id, mocha_user_id FROM clips WHERE id = ?"
  )
    .bind(clipId)
    .first();

  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }

  // Insert comment
  const result = await c.env.DB.prepare(
    `INSERT INTO comments (clip_id, mocha_user_id, parent_comment_id, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(clipId, mochaUser.id, parent_comment_id || null, content)
    .run();

  // Update comment count on clip
  await c.env.DB.prepare(
    "UPDATE clips SET comments_count = comments_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  )
    .bind(clipId)
    .run();

  // Create notification for clip owner (if not commenting on own clip)
  if (clip.mocha_user_id !== mochaUser.id) {
    const notificationResult = await c.env.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, related_user_id, related_clip_id, related_comment_id, created_at)
       VALUES (?, 'comment', ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(
        clip.mocha_user_id,
        'commented on your clip',
        mochaUser.id,
        clipId,
        result.meta.last_row_id
      )
      .run();

    // Fetch the notification to broadcast
    const notification = await c.env.DB.prepare(
      `SELECT 
        notifications.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM notifications
      LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
      WHERE notifications.id = ?`
    )
      .bind(notificationResult.meta.last_row_id)
      .first();

    // Broadcast real-time notification
    try {
      const realtime = createRealtimeService(c.env);
      await realtime.broadcastNotification(clip.mocha_user_id as string, notification);
    } catch (err) {
      console.error('Failed to broadcast notification:', err);
    }
  }

  // Award points for commenting
  try {
    await gamification.awardPoints(c.env, mochaUser.id, 3, 'Posted a comment', parseInt(clipId), result.meta.last_row_id as number);
  } catch (err) {
    console.error('Failed to award points:', err);
  }

  const newComment = await c.env.DB.prepare(
    `SELECT 
      comments.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM comments
    LEFT JOIN user_profiles ON comments.mocha_user_id = user_profiles.mocha_user_id
    WHERE comments.id = ?`
  )
    .bind(result.meta.last_row_id)
    .first();

  return c.json(newComment, 201);
});

// Follow a user
app.post("/api/users/:userId/follow", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const targetUserId = c.req.param('userId');

  if (targetUserId === mochaUser.id) {
    return c.json({ error: "Cannot follow yourself" }, 400);
  }

  // Check if already following
  const existingFollow = await c.env.DB.prepare(
    "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?"
  )
    .bind(mochaUser.id, targetUserId)
    .first();

  if (existingFollow) {
    // Unfollow
    await c.env.DB.prepare(
      "DELETE FROM follows WHERE follower_id = ? AND following_id = ?"
    )
      .bind(mochaUser.id, targetUserId)
      .run();

    return c.json({ following: false });
  } else {
    // Follow
    await c.env.DB.prepare(
      "INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
    )
      .bind(mochaUser.id, targetUserId)
      .run();

    // Create notification
    const notificationResult = await c.env.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, related_user_id, created_at)
       VALUES (?, 'follow', ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(targetUserId, 'started following you', mochaUser.id)
      .run();

    // Fetch the notification to broadcast
    const notification = await c.env.DB.prepare(
      `SELECT 
        notifications.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM notifications
      LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
      WHERE notifications.id = ?`
    )
      .bind(notificationResult.meta.last_row_id)
      .first();

    // Broadcast real-time notification
    try {
      const realtime = createRealtimeService(c.env);
      await realtime.broadcastNotification(targetUserId, notification);
    } catch (err) {
      console.error('Failed to broadcast notification:', err);
    }

    return c.json({ following: true });
  }
});

// Get user profile by ID
app.get("/api/users/:userId", async (c) => {
  const userId = c.req.param('userId');
  
  // Fetch user profile from database
  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(userId)
    .first();

  if (!profile) {
    return c.json({ error: "User not found" }, 404);
  }

  // Get user's clips
  const clips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.mocha_user_id = ? AND clips.is_hidden = 0
    ORDER BY clips.created_at DESC
    LIMIT 50`
  )
    .bind(userId)
    .all();

  // Get follower count
  const followerCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM follows WHERE following_id = ?"
  )
    .bind(userId)
    .first() as { count: number } | null;

  // Get following count
  const followingCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM follows WHERE follower_id = ?"
  )
    .bind(userId)
    .first() as { count: number } | null;

  // Calculate total stats from clips
  const totalLikes = clips.results?.reduce((sum: number, clip: any) => sum + (clip.likes_count || 0), 0) || 0;
  const totalViews = clips.results?.reduce((sum: number, clip: any) => sum + (clip.views_count || 0), 0) || 0;

  return c.json({
    profile,
    clips: clips.results || [],
    stats: {
      totalClips: clips.results?.length || 0,
      totalLikes,
      totalViews,
      followers: followerCount?.count || 0,
      following: followingCount?.count || 0,
    },
  });
});

// Get user's saved clips
app.get("/api/users/me/saved-clips", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const savedClips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM saved_clips
    JOIN clips ON saved_clips.clip_id = clips.id
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE saved_clips.mocha_user_id = ?
    ORDER BY saved_clips.created_at DESC`
  )
    .bind(mochaUser.id)
    .all();

  return c.json({ clips: savedClips.results || [] });
});

// Get user's notifications (optimized with limit on unread)
app.get("/api/notifications", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Fetch notifications efficiently - prioritize unread
  const notifications = await c.env.DB.prepare(
    `SELECT 
      notifications.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM notifications
    LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
    WHERE notifications.mocha_user_id = ?
    ORDER BY notifications.is_read ASC, notifications.created_at DESC
    LIMIT 50`
  )
    .bind(mochaUser.id)
    .all();

  // Don't cache notifications - always fresh
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');

  return c.json({ notifications: notifications.results || [] });
});

// Mark notification as read
app.post("/api/notifications/:id/read", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const notificationId = c.req.param('id');

  await c.env.DB.prepare(
    "UPDATE notifications SET is_read = 1 WHERE id = ? AND mocha_user_id = ?"
  )
    .bind(notificationId, mochaUser.id)
    .run();

  return c.json({ success: true });
});

// Mark all notifications as read
app.post("/api/notifications/read-all", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await c.env.DB.prepare(
    "UPDATE notifications SET is_read = 1 WHERE mocha_user_id = ? AND is_read = 0"
  )
    .bind(mochaUser.id)
    .run();

  return c.json({ success: true });
});

// Search clips (optimized with better indexing and rate limiting)
app.get("/api/search/clips", rateLimiter(RateLimits.SEARCH), async (c) => {
  const query = c.req.query('q') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50); // Cap at 50

  if (!query || query.length < 2) {
    return c.json({ clips: [] });
  }

  // Use LIKE with leading wildcard only when necessary for better index usage
  const searchTerm = `%${query}%`;
  
  const clips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      -- Rank results by relevance
      CASE 
        WHEN clips.artist_name LIKE ? THEN 3
        WHEN clips.venue_name LIKE ? THEN 2
        ELSE 1
      END as relevance
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.is_hidden = 0
    AND (clips.artist_name LIKE ? 
       OR clips.venue_name LIKE ?
       OR clips.location LIKE ?
       OR clips.content_description LIKE ?)
    ORDER BY relevance DESC, clips.created_at DESC
    LIMIT ?`
  )
    .bind(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, limit)
    .all();

  // Cache search results briefly
  c.header('Cache-Control', 'public, max-age=60');

  return c.json({ clips: clips.results || [] });
});

// Advanced search with filters
app.get("/api/search/advanced", discovery.advancedSearch);

// Get trending content
app.get("/api/discover/trending", discovery.getTrendingContent);

// JamBase API Integration Endpoints
app.get("/api/jambase/search/artists", jambase.searchArtists);
app.get("/api/jambase/search/venues", jambase.searchVenues);
app.get("/api/jambase/artist/:artistId/tourdates", jambase.getArtistTourDates);
app.get("/api/jambase/artist/:artistId", jambase.getArtistById);
app.get("/api/jambase/venue/:venueId", jambase.getVenueById);
app.get("/api/jambase/events/match", jambase.matchEventsByLocation);
app.get("/api/jambase/events/upcoming", jambase.getUpcomingEvents);

// Get artist by name
app.get("/api/artists/:artistName", async (c) => {
  const artistName = decodeURIComponent(c.req.param('artistName'));
  
  // Get or create artist record
  let artist = await c.env.DB.prepare(
    "SELECT * FROM artists WHERE name = ?"
  )
    .bind(artistName)
    .first();

  if (!artist) {
    // Auto-create artist if doesn't exist
    const result = await c.env.DB.prepare(
      "INSERT INTO artists (name, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    )
      .bind(artistName)
      .run();

    artist = await c.env.DB.prepare(
      "SELECT * FROM artists WHERE id = ?"
    )
      .bind(result.meta.last_row_id)
      .first();
  }

  // Get clips for this artist
  const clips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.artist_name = ? AND clips.is_hidden = 0
    ORDER BY clips.created_at DESC
    LIMIT 50`
  )
    .bind(artistName)
    .all();

  // Get tour dates for this artist
  const tourDates = await c.env.DB.prepare(
    `SELECT 
      artist_tour_dates.*,
      venues.name as venue_name,
      venues.location as venue_location
    FROM artist_tour_dates
    LEFT JOIN venues ON artist_tour_dates.venue_id = venues.id
    WHERE artist_tour_dates.artist_id = ?
    AND artist_tour_dates.date >= datetime('now')
    ORDER BY artist_tour_dates.date ASC`
  )
    .bind(artist?.id || 0)
    .all();

  return c.json({
    artist,
    clips: clips.results || [],
    tourDates: tourDates.results || [],
  });
});

// Create or update artist profile
app.post("/api/artists", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if user is an artist
  const userProfile = await c.env.DB.prepare(
    "SELECT role FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || userProfile.role !== 'artist') {
    return c.json({ error: "Only artists can manage artist profiles" }, 403);
  }

  const body = await c.req.json();
  const { name, bio, image_url, social_links } = body;

  if (!name) {
    return c.json({ error: "Artist name is required" }, 400);
  }

  // Check if artist exists
  const existingArtist = await c.env.DB.prepare(
    "SELECT id FROM artists WHERE name = ?"
  )
    .bind(name)
    .first();

  if (existingArtist) {
    // Update existing artist
    await c.env.DB.prepare(
      `UPDATE artists 
       SET bio = ?, image_url = ?, social_links = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(
        bio || null,
        image_url || null,
        JSON.stringify(social_links || {}),
        existingArtist.id
      )
      .run();

    const updatedArtist = await c.env.DB.prepare(
      "SELECT * FROM artists WHERE id = ?"
    )
      .bind(existingArtist.id)
      .first();

    return c.json(updatedArtist);
  } else {
    // Create new artist
    const result = await c.env.DB.prepare(
      `INSERT INTO artists (name, bio, image_url, social_links, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(
        name,
        bio || null,
        image_url || null,
        JSON.stringify(social_links || {})
      )
      .run();

    const newArtist = await c.env.DB.prepare(
      "SELECT * FROM artists WHERE id = ?"
    )
      .bind(result.meta.last_row_id)
      .first();

    return c.json(newArtist, 201);
  }
});

// Get venue by name
app.get("/api/venues/:venueName", async (c) => {
  const venueName = decodeURIComponent(c.req.param('venueName'));
  
  // Get or create venue record
  let venue = await c.env.DB.prepare(
    "SELECT * FROM venues WHERE name = ?"
  )
    .bind(venueName)
    .first();

  if (!venue) {
    // Auto-create venue if doesn't exist
    const result = await c.env.DB.prepare(
      "INSERT INTO venues (name, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    )
      .bind(venueName)
      .run();

    venue = await c.env.DB.prepare(
      "SELECT * FROM venues WHERE id = ?"
    )
      .bind(result.meta.last_row_id)
      .first();
  }

  // Get clips for this venue
  const clips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.venue_name = ? AND clips.is_hidden = 0
    ORDER BY clips.created_at DESC
    LIMIT 50`
  )
    .bind(venueName)
    .all();

  // Get upcoming events at this venue
  const upcomingEvents = await c.env.DB.prepare(
    `SELECT 
      artist_tour_dates.*,
      artists.name as artist_name,
      artists.image_url as artist_image
    FROM artist_tour_dates
    LEFT JOIN artists ON artist_tour_dates.artist_id = artists.id
    WHERE artist_tour_dates.venue_id = ?
    AND artist_tour_dates.date >= datetime('now')
    ORDER BY artist_tour_dates.date ASC`
  )
    .bind(venue?.id || 0)
    .all();

  return c.json({
    venue,
    clips: clips.results || [],
    upcomingEvents: upcomingEvents.results || [],
  });
});

// Create or update venue profile
app.post("/api/venues", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if user is a venue
  const userProfile = await c.env.DB.prepare(
    "SELECT role FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || userProfile.role !== 'venue') {
    return c.json({ error: "Only venues can manage venue profiles" }, 403);
  }

  const body = await c.req.json();
  const { name, location, address, image_url, capacity } = body;

  if (!name) {
    return c.json({ error: "Venue name is required" }, 400);
  }

  // Check if venue exists
  const existingVenue = await c.env.DB.prepare(
    "SELECT id FROM venues WHERE name = ?"
  )
    .bind(name)
    .first();

  if (existingVenue) {
    // Update existing venue
    await c.env.DB.prepare(
      `UPDATE venues 
       SET location = ?, address = ?, image_url = ?, capacity = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(
        location || null,
        address || null,
        image_url || null,
        capacity || null,
        existingVenue.id
      )
      .run();

    const updatedVenue = await c.env.DB.prepare(
      "SELECT * FROM venues WHERE id = ?"
    )
      .bind(existingVenue.id)
      .first();

    return c.json(updatedVenue);
  } else {
    // Create new venue
    const result = await c.env.DB.prepare(
      `INSERT INTO venues (name, location, address, image_url, capacity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(
        name,
        location || null,
        address || null,
        image_url || null,
        capacity || null
      )
      .run();

    const newVenue = await c.env.DB.prepare(
      "SELECT * FROM venues WHERE id = ?"
    )
      .bind(result.meta.last_row_id)
      .first();

    return c.json(newVenue, 201);
  }
});

// Add tour date for artist
app.post("/api/artists/:artistId/tour-dates", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if user is an artist
  const userProfile = await c.env.DB.prepare(
    "SELECT role FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || userProfile.role !== 'artist') {
    return c.json({ error: "Only artists can add tour dates" }, 403);
  }

  const artistId = c.req.param('artistId');
  const body = await c.req.json();
  const { venue_id, date, city, country, ticket_url } = body;

  if (!date) {
    return c.json({ error: "Date is required" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO artist_tour_dates (artist_id, venue_id, date, city, country, ticket_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(
      artistId,
      venue_id || null,
      date,
      city || null,
      country || null,
      ticket_url || null
    )
    .run();

  const newTourDate = await c.env.DB.prepare(
    "SELECT * FROM artist_tour_dates WHERE id = ?"
  )
    .bind(result.meta.last_row_id)
    .first();

  return c.json(newTourDate, 201);
});

// Get current live session
app.get("/api/live/current", async (c) => {
  // Find active or upcoming live session
  const session = await c.env.DB.prepare(
    `SELECT * FROM live_sessions 
     WHERE status IN ('live', 'scheduled')
     AND start_time <= datetime('now', '+30 minutes')
     ORDER BY start_time ASC
     LIMIT 1`
  ).first();

  if (!session) {
    return c.json({ session: null, currentClip: null, viewerCount: 0 });
  }

  // Get current clip if session is live
  let currentClip = null;
  if (session.status === 'live' && session.current_clip_id) {
    currentClip = await c.env.DB.prepare(
      `SELECT 
        clips.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM clips
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      WHERE clips.id = ?`
    )
      .bind(session.current_clip_id)
      .first();
  }

  // Count active viewers (those with heartbeat in last 30 seconds)
  const viewerCount = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT mocha_user_id) as count 
     FROM live_session_viewers 
     WHERE live_session_id = ? 
     AND last_heartbeat >= datetime('now', '-30 seconds')`
  )
    .bind(session.id)
    .first() as { count: number } | null;

  return c.json({
    session,
    currentClip,
    viewerCount: viewerCount?.count || 0,
  });
});

// Get live session schedule
app.get("/api/live/schedule", async (c) => {
  const sessionId = c.req.query('session_id');
  
  if (!sessionId) {
    return c.json({ error: "session_id is required" }, 400);
  }

  const schedule = await c.env.DB.prepare(
    `SELECT 
      live_session_clips.*,
      clips.artist_name,
      clips.venue_name,
      clips.thumbnail_url,
      clips.content_description,
      user_profiles.display_name as user_display_name
    FROM live_session_clips
    LEFT JOIN clips ON live_session_clips.clip_id = clips.id
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE live_session_clips.live_session_id = ?
    ORDER BY live_session_clips.order_index ASC`
  )
    .bind(sessionId)
    .all();

  return c.json({ schedule: schedule.results || [] });
});

// Get live chat messages (optimized for real-time)
app.get("/api/live/:sessionId/chat", async (c) => {
  const sessionId = c.req.param('sessionId');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const since = c.req.query('since');
  
  let query = `
    SELECT 
      live_chat_messages.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM live_chat_messages
    LEFT JOIN user_profiles ON live_chat_messages.mocha_user_id = user_profiles.mocha_user_id
    WHERE live_chat_messages.live_session_id = ?
    AND live_chat_messages.is_deleted = 0
  `;
  
  const bindings: any[] = [sessionId];
  
  if (since) {
    query += ` AND live_chat_messages.created_at > ?`;
    bindings.push(since);
  }
  
  query += ` ORDER BY live_chat_messages.created_at DESC LIMIT ?`;
  bindings.push(limit);

  const messages = await c.env.DB.prepare(query)
    .bind(...bindings)
    .all();

  // Don't cache live chat - needs to be real-time
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');

  return c.json({ 
    messages: (messages.results || []).reverse() // Reverse to show oldest first
  });
});

// Post live chat message
app.post("/api/live/:sessionId/chat", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  const { content } = body;

  if (!content || !content.trim()) {
    return c.json({ error: "Message content is required" }, 400);
  }

  // Check if session exists and is live
  const session = await c.env.DB.prepare(
    "SELECT id, status FROM live_sessions WHERE id = ?"
  )
    .bind(sessionId)
    .first();

  if (!session) {
    return c.json({ error: "Live session not found" }, 404);
  }

  if (session.status !== 'live') {
    return c.json({ error: "Live session is not currently active" }, 400);
  }

  // Check if user is banned
  const ban = await c.env.DB.prepare(
    `SELECT id FROM live_chat_bans 
     WHERE live_session_id = ? 
     AND mocha_user_id = ?
     AND (expires_at IS NULL OR expires_at > datetime('now'))`
  )
    .bind(sessionId, mochaUser.id)
    .first();

  if (ban) {
    return c.json({ error: "You are banned from this chat" }, 403);
  }

  // Insert chat message
  const result = await c.env.DB.prepare(
    `INSERT INTO live_chat_messages (live_session_id, mocha_user_id, content, created_at, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(sessionId, mochaUser.id, content.trim())
    .run();

  // Fetch the new message with user info
  const newMessage = await c.env.DB.prepare(
    `SELECT 
      live_chat_messages.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM live_chat_messages
    LEFT JOIN user_profiles ON live_chat_messages.mocha_user_id = user_profiles.mocha_user_id
    WHERE live_chat_messages.id = ?`
  )
    .bind(result.meta.last_row_id)
    .first();

  // Broadcast chat message in real-time
  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastChatMessage(parseInt(sessionId), newMessage);
  } catch (err) {
    console.error('Failed to broadcast chat message:', err);
  }

  return c.json(newMessage, 201);
});

// Viewer heartbeat
app.post("/api/live/viewer-heartbeat", async (c) => {
  const body = await c.req.json();
  const { session_id, user_id } = body;

  if (!session_id) {
    return c.json({ error: "session_id is required" }, 400);
  }

  // Use user_id if provided (authenticated), otherwise use null for anonymous
  const userId = user_id || null;

  // Upsert viewer record
  await c.env.DB.prepare(
    `INSERT INTO live_session_viewers (live_session_id, mocha_user_id, last_heartbeat, created_at)
     VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(live_session_id, mocha_user_id) 
     DO UPDATE SET last_heartbeat = CURRENT_TIMESTAMP`
  )
    .bind(session_id, userId)
    .run();

  // Clean up old viewers (older than 1 minute)
  await c.env.DB.prepare(
    `DELETE FROM live_session_viewers 
     WHERE last_heartbeat < datetime('now', '-1 minute')`
  )
    .run();

  // Get current viewer count
  const viewerCount = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT mocha_user_id) as count 
     FROM live_session_viewers 
     WHERE live_session_id = ? 
     AND last_heartbeat >= datetime('now', '-30 seconds')`
  )
    .bind(session_id)
    .first();

  return c.json({ 
    success: true,
    viewerCount: (viewerCount as any)?.count || 0
  });
});

// Admin: Create live session
app.post("/api/admin/live/sessions", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if user is admin
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const body = await c.req.json();
  const { start_time, end_time, title, description } = body;

  if (!start_time || !end_time) {
    return c.json({ error: "start_time and end_time are required" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO live_sessions (start_time, end_time, title, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'scheduled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(start_time, end_time, title || null, description || null)
    .run();

  const newSession = await c.env.DB.prepare(
    "SELECT * FROM live_sessions WHERE id = ?"
  )
    .bind(result.meta.last_row_id)
    .first();

  return c.json(newSession, 201);
});

// Admin: Update live session
app.put("/api/admin/live/sessions/:sessionId", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  const { start_time, end_time, title, description, status, current_clip_id } = body;

  await c.env.DB.prepare(
    `UPDATE live_sessions 
     SET start_time = COALESCE(?, start_time),
         end_time = COALESCE(?, end_time),
         title = COALESCE(?, title),
         description = COALESCE(?, description),
         status = COALESCE(?, status),
         current_clip_id = COALESCE(?, current_clip_id),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  )
    .bind(start_time || null, end_time || null, title || null, description || null, status || null, current_clip_id || null, sessionId)
    .run();

  const updatedSession = await c.env.DB.prepare(
    "SELECT * FROM live_sessions WHERE id = ?"
  )
    .bind(sessionId)
    .first();

  return c.json(updatedSession);
});

// Admin: Delete live session
app.delete("/api/admin/live/sessions/:sessionId", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const sessionId = c.req.param('sessionId');

  // Delete associated data
  await c.env.DB.prepare("DELETE FROM live_session_clips WHERE live_session_id = ?").bind(sessionId).run();
  await c.env.DB.prepare("DELETE FROM live_chat_messages WHERE live_session_id = ?").bind(sessionId).run();
  await c.env.DB.prepare("DELETE FROM live_session_viewers WHERE live_session_id = ?").bind(sessionId).run();
  await c.env.DB.prepare("DELETE FROM live_chat_bans WHERE live_session_id = ?").bind(sessionId).run();
  await c.env.DB.prepare("DELETE FROM live_sessions WHERE id = ?").bind(sessionId).run();

  return c.json({ success: true });
});

// Admin: Get all live sessions
app.get("/api/admin/live/sessions", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const sessions = await c.env.DB.prepare(
    "SELECT * FROM live_sessions ORDER BY start_time DESC"
  ).all();

  return c.json({ sessions: sessions.results || [] });
});

// Admin: Add clip to session schedule
app.post("/api/admin/live/sessions/:sessionId/clips", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  const { clip_id, order_index, duration } = body;

  if (!clip_id) {
    return c.json({ error: "clip_id is required" }, 400);
  }

  // Get next order_index if not provided
  let finalOrderIndex = order_index;
  if (!finalOrderIndex) {
    const maxOrder = await c.env.DB.prepare(
      "SELECT MAX(order_index) as max_order FROM live_session_clips WHERE live_session_id = ?"
    )
      .bind(sessionId)
      .first() as { max_order: number | null } | null;
    finalOrderIndex = ((maxOrder?.max_order as number) || 0) + 1;
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO live_session_clips (live_session_id, clip_id, order_index, duration, created_at, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(sessionId, clip_id, finalOrderIndex, duration || null)
    .run();

  const newScheduleItem = await c.env.DB.prepare(
    "SELECT * FROM live_session_clips WHERE id = ?"
  )
    .bind(result.meta.last_row_id)
    .first();

  return c.json(newScheduleItem, 201);
});

// Admin: Remove clip from session schedule
app.delete("/api/admin/live/sessions/:sessionId/clips/:scheduleId", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const scheduleId = c.req.param('scheduleId');

  await c.env.DB.prepare(
    "DELETE FROM live_session_clips WHERE id = ?"
  )
    .bind(scheduleId)
    .run();

  return c.json({ success: true });
});

// Admin: Reorder session clips
app.put("/api/admin/live/sessions/:sessionId/clips/reorder", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  const { clip_orders } = body; // Array of { id, order_index }

  if (!clip_orders || !Array.isArray(clip_orders)) {
    return c.json({ error: "clip_orders array is required" }, 400);
  }

  // Update each clip's order_index
  for (const item of clip_orders) {
    await c.env.DB.prepare(
      "UPDATE live_session_clips SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND live_session_id = ?"
    )
      .bind(item.order_index, item.id, sessionId)
      .run();
  }

  return c.json({ success: true });
});

// Admin/Moderator: Delete chat message
app.delete("/api/admin/live/:sessionId/chat/:messageId", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || (!userProfile.is_admin && !userProfile.is_moderator)) {
    return c.json({ error: "Admin or moderator access required" }, 403);
  }

  const messageId = c.req.param('messageId');

  await c.env.DB.prepare(
    `UPDATE live_chat_messages 
     SET is_deleted = 1, deleted_by = ?, deleted_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  )
    .bind(mochaUser.id, messageId)
    .run();

  return c.json({ success: true });
});

// Admin/Moderator: Ban user from chat
app.post("/api/admin/live/:sessionId/ban", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || (!userProfile.is_admin && !userProfile.is_moderator)) {
    return c.json({ error: "Admin or moderator access required" }, 403);
  }

  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  const { user_id, reason, duration_minutes } = body;

  if (!user_id) {
    return c.json({ error: "user_id is required" }, 400);
  }

  let expiresAt = null;
  if (duration_minutes) {
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + duration_minutes);
    expiresAt = expires.toISOString();
  }

  await c.env.DB.prepare(
    `INSERT INTO live_chat_bans (live_session_id, mocha_user_id, banned_by, reason, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(live_session_id, mocha_user_id) 
     DO UPDATE SET banned_by = ?, reason = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP`
  )
    .bind(sessionId, user_id, mochaUser.id, reason || null, expiresAt, mochaUser.id, reason || null, expiresAt)
    .run();

  return c.json({ success: true });
});

// Admin/Moderator: Unban user from chat
app.delete("/api/admin/live/:sessionId/ban/:userId", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || (!userProfile.is_admin && !userProfile.is_moderator)) {
    return c.json({ error: "Admin or moderator access required" }, 403);
  }

  const sessionId = c.req.param('sessionId');
  const userId = c.req.param('userId');

  await c.env.DB.prepare(
    "DELETE FROM live_chat_bans WHERE live_session_id = ? AND mocha_user_id = ?"
  )
    .bind(sessionId, userId)
    .run();

  return c.json({ success: true });
});

// Admin/Moderator: Get banned users
app.get("/api/admin/live/:sessionId/bans", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || (!userProfile.is_admin && !userProfile.is_moderator)) {
    return c.json({ error: "Admin or moderator access required" }, 403);
  }

  const sessionId = c.req.param('sessionId');

  const bans = await c.env.DB.prepare(
    `SELECT 
      live_chat_bans.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      moderator.display_name as banned_by_display_name
    FROM live_chat_bans
    LEFT JOIN user_profiles ON live_chat_bans.mocha_user_id = user_profiles.mocha_user_id
    LEFT JOIN user_profiles AS moderator ON live_chat_bans.banned_by = moderator.mocha_user_id
    WHERE live_chat_bans.live_session_id = ?
    AND (live_chat_bans.expires_at IS NULL OR live_chat_bans.expires_at > datetime('now'))
    ORDER BY live_chat_bans.created_at DESC`
  )
    .bind(sessionId)
    .all();

  return c.json({ bans: bans.results || [] });
});

// Track clip share
app.post("/api/clips/:id/share", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const clipId = c.req.param('id');
  const body = await c.req.json();
  const { platform } = body; // e.g., 'twitter', 'facebook', 'copy_link', etc.

  // Check if clip exists
  const clip = await c.env.DB.prepare(
    "SELECT id, mocha_user_id FROM clips WHERE id = ?"
  )
    .bind(clipId)
    .first();

  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }

  // Track share
  await c.env.DB.prepare(
    `INSERT INTO clip_shares (clip_id, shared_by, platform, created_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(clipId, mochaUser.id, platform || 'unknown')
    .run();

  // Award points to sharer
  try {
    await gamification.awardPoints(c.env, mochaUser.id, 5, 'Shared a clip', parseInt(clipId));
  } catch (err) {
    console.error('Failed to award points:', err);
  }

  // Award points to clip owner
  try {
    await gamification.awardPoints(c.env, clip.mocha_user_id as string, 3, 'Clip was shared', parseInt(clipId));
  } catch (err) {
    console.error('Failed to award points:', err);
  }

  // Create notification for clip owner (if not self-share)
  if (clip.mocha_user_id !== mochaUser.id) {
    const notificationResult = await c.env.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, related_user_id, related_clip_id, created_at)
       VALUES (?, 'share', ?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(
        clip.mocha_user_id,
        'shared your clip',
        mochaUser.id,
        clipId
      )
      .run();

    // Fetch the notification to broadcast
    const notification = await c.env.DB.prepare(
      `SELECT 
        notifications.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM notifications
      LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
      WHERE notifications.id = ?`
    )
      .bind(notificationResult.meta.last_row_id)
      .first();

    // Broadcast real-time notification
    try {
      const realtime = createRealtimeService(c.env);
      await realtime.broadcastNotification(clip.mocha_user_id as string, notification);
    } catch (err) {
      console.error('Failed to broadcast notification:', err);
    }
  }

  return c.json({ success: true });
});

// Admin: Feature clip on Momentum Live
app.post("/api/admin/live/sessions/:sessionId/feature-clip/:clipId", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const sessionId = c.req.param('sessionId');
  const clipId = c.req.param('clipId');

  // Get clip details
  const clip = await c.env.DB.prepare(
    "SELECT id, mocha_user_id, artist_name FROM clips WHERE id = ?"
  )
    .bind(clipId)
    .first();

  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }

  // Mark as featured
  await c.env.DB.prepare(
    `INSERT INTO live_featured_clips (clip_id, live_session_id, featured_at, created_at)
     VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  )
    .bind(clipId, sessionId)
    .run();

  // Create notification for clip owner
  const notificationResult = await c.env.DB.prepare(
    `INSERT INTO notifications (mocha_user_id, type, content, related_clip_id, created_at)
     VALUES (?, 'live', ?, ?, CURRENT_TIMESTAMP)`
  )
    .bind(
      clip.mocha_user_id,
      `🎬 Your moment is on Momentum Live right now!`,
      clipId
    )
    .run();

  // Fetch the notification to broadcast
  const notification = await c.env.DB.prepare(
    `SELECT 
      notifications.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM notifications
    LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
    WHERE notifications.id = ?`
  )
    .bind(notificationResult.meta.last_row_id)
    .first();

  // Broadcast real-time notification
  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastNotification(clip.mocha_user_id as string, notification);
  } catch (err) {
    console.error('Failed to broadcast notification:', err);
  }

  // Award bonus points for being featured
  try {
    await gamification.awardPoints(c.env, clip.mocha_user_id as string, 100, 'Featured on Momentum Live', parseInt(clipId));
  } catch (err) {
    console.error('Failed to award points:', err);
  }

  return c.json({ success: true });
});

// Admin: Manually advance to next clip
app.post("/api/admin/live/sessions/:sessionId/advance", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const sessionId = c.req.param('sessionId');

  // Get current session
  const session = await c.env.DB.prepare(
    "SELECT id, current_clip_id FROM live_sessions WHERE id = ? AND status = 'live'"
  )
    .bind(sessionId)
    .first();

  if (!session) {
    return c.json({ error: "Live session not found or not active" }, 404);
  }

  // Mark current clip as played if exists
  if (session.current_clip_id) {
    await c.env.DB.prepare(
      `UPDATE live_session_clips 
       SET played_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE live_session_id = ? AND clip_id = ?`
    )
      .bind(sessionId, session.current_clip_id)
      .run();
  }

  // Get next unplayed clip
  const nextClip = await c.env.DB.prepare(
    `SELECT id, clip_id 
     FROM live_session_clips 
     WHERE live_session_id = ? AND played_at IS NULL 
     ORDER BY order_index ASC 
     LIMIT 1`
  )
    .bind(sessionId)
    .first();

  if (!nextClip) {
    // No more clips, end session
    await c.env.DB.prepare(
      `UPDATE live_sessions 
       SET status = 'ended', current_clip_id = NULL, current_clip_started_at = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    )
      .bind(sessionId)
      .run();
    
    return c.json({ message: "Session ended - no more clips" });
  }

  // Update session with next clip
  await c.env.DB.prepare(
    `UPDATE live_sessions 
     SET current_clip_id = ?, current_clip_started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  )
    .bind((nextClip as any).clip_id, sessionId)
    .run();

  return c.json({ success: true, nextClipId: (nextClip as any).clip_id });
});

// Admin: Set clip duration in schedule
app.put("/api/admin/live/sessions/:sessionId/clips/:scheduleId/duration", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const scheduleId = c.req.param('scheduleId');
  const body = await c.req.json();
  const { duration } = body;

  if (typeof duration !== 'number' || duration <= 0) {
    return c.json({ error: "Valid duration in seconds is required" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE live_session_clips 
     SET duration = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  )
    .bind(duration, scheduleId)
    .run();

  return c.json({ success: true });
});

// Admin: Get analytics data
app.get("/api/admin/analytics", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const range = c.req.query('range') || '30d';
  let daysBack = 30;
  
  switch (range) {
    case '7d':
      daysBack = 7;
      break;
    case '90d':
      daysBack = 90;
      break;
    default:
      daysBack = 30;
  }

  // Platform Stats
  const totalUsers = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM user_profiles"
  ).first() as { count: number } | null;

  const totalClips = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM clips"
  ).first() as { count: number } | null;

  const totalViewsLikes = await c.env.DB.prepare(
    "SELECT SUM(views_count) as views, SUM(likes_count) as likes FROM clips"
  ).first() as { views: number; likes: number } | null;

  const activeSessions = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM live_sessions WHERE status = 'live'"
  ).first() as { count: number } | null;

  const totalSessions = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM live_sessions"
  ).first() as { count: number } | null;

  // Growth Data - daily stats for the time range
  const growthData = await c.env.DB.prepare(
    `WITH RECURSIVE dates(date) AS (
      SELECT date('now', '-' || ? || ' days')
      UNION ALL
      SELECT date(date, '+1 day')
      FROM dates
      WHERE date < date('now')
    )
    SELECT 
      dates.date,
      COALESCE(COUNT(DISTINCT user_profiles.id), 0) as users,
      COALESCE(COUNT(DISTINCT clips.id), 0) as clips,
      COALESCE(SUM(clips.views_count), 0) as views
    FROM dates
    LEFT JOIN user_profiles ON date(user_profiles.created_at) = dates.date
    LEFT JOIN clips ON date(clips.created_at) = dates.date
    GROUP BY dates.date
    ORDER BY dates.date ASC`
  )
    .bind(daysBack)
    .all();

  // Top Clips by engagement
  const topClips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.created_at >= date('now', '-' || ? || ' days')
    ORDER BY (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) DESC
    LIMIT 10`
  )
    .bind(daysBack)
    .all();

  // Top Users by contribution
  const topUsers = await c.env.DB.prepare(
    `SELECT 
      user_profiles.mocha_user_id,
      user_profiles.display_name,
      user_profiles.profile_image_url,
      COUNT(clips.id) as total_clips,
      SUM(clips.likes_count) as total_likes,
      SUM(clips.views_count) as total_views
    FROM user_profiles
    JOIN clips ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.created_at >= date('now', '-' || ? || ' days')
    GROUP BY user_profiles.mocha_user_id
    ORDER BY total_clips DESC, total_likes DESC
    LIMIT 10`
  )
    .bind(daysBack)
    .all();

  return c.json({
    platformStats: {
      totalUsers: totalUsers?.count || 0,
      totalClips: totalClips?.count || 0,
      totalViews: totalViewsLikes?.views || 0,
      totalLikes: totalViewsLikes?.likes || 0,
      activeSessions: activeSessions?.count || 0,
      totalSessions: totalSessions?.count || 0,
    },
    growthData: growthData.results || [],
    topClips: topClips.results || [],
    topUsers: topUsers.results || [],
  });
});

// Content Moderation Endpoints
app.post("/api/clips/:clipId/report", authMiddleware, moderation.reportClip);
app.get("/api/admin/moderation/clips", authMiddleware, moderation.getFlaggedClips);
app.post("/api/admin/moderation/clips/:flagId/review", authMiddleware, moderation.reviewFlaggedClip);
app.delete("/api/admin/clips/:clipId", authMiddleware, moderation.deleteClip);
app.get("/api/admin/moderation/users", authMiddleware, moderation.getFlaggedUsers);
app.post("/api/admin/users/:userId/ban", authMiddleware, moderation.banUser);
app.post("/api/admin/users/:userId/unban", authMiddleware, moderation.unbanUser);

// Stripe Payment Integration Endpoints
app.post("/api/stripe/checkout/premium", authMiddleware, stripe.createPremiumCheckoutSession);
app.post("/api/stripe/checkout/tickets", authMiddleware, stripe.createAffiliateCheckoutSession);
app.get("/api/stripe/subscription", authMiddleware, stripe.getSubscriptionStatus);
app.post("/api/stripe/subscription/cancel", authMiddleware, stripe.cancelSubscription);
app.get("/api/stripe/earnings", authMiddleware, stripe.getEarnings);
app.post("/api/stripe/payout/request", authMiddleware, stripe.requestPayout);
app.post("/api/stripe/connect/account-link", authMiddleware, stripe.createConnectAccountLink);
app.get("/api/admin/stripe/payouts", authMiddleware, stripe.getPendingPayouts);
app.post("/api/admin/stripe/payouts/:payoutId/process", authMiddleware, stripe.processPayout);

// Stripe Webhook Handler
app.post("/api/stripe/webhook", handleStripeWebhook);

// WebSocket endpoint for real-time features
app.get("/realtime", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected WebSocket", 426);
  }

  const id = c.env.REALTIME.idFromName("global");
  const stub = c.env.REALTIME.get(id);
  
  return stub.fetch(c.req.raw);
});

// Two-Factor Authentication Endpoints
app.post("/api/auth/2fa/setup", authMiddleware, twoFactor.setupTwoFactor);
app.post("/api/auth/2fa/verify-enable", authMiddleware, twoFactor.verifyAndEnableTwoFactor);
app.post("/api/auth/2fa/disable", authMiddleware, twoFactor.disableTwoFactor);
app.get("/api/auth/2fa/status", authMiddleware, twoFactor.getTwoFactorStatus);
app.post("/api/auth/2fa/verify-login", authMiddleware, twoFactor.verifyTwoFactorLogin);

// Cloudflare Stream Video Processing Endpoints
app.post("/api/stream/upload-from-url", authMiddleware, stream.uploadFromUrl);
app.get("/api/stream/video/:videoId/status", stream.getVideoStatus);
app.delete("/api/stream/video/:videoId", authMiddleware, stream.deleteVideo);
app.get("/api/stream/video/:videoId/thumbnail", stream.getThumbnail);

// Analytics & Reporting Endpoints
app.get("/api/analytics/platform", authMiddleware, analytics.getPlatformAnalytics);
app.get("/api/analytics/user", authMiddleware, analytics.getUserAnalytics);
app.get("/api/analytics/ambassador", authMiddleware, analytics.getAmbassadorAnalytics);
app.get("/api/analytics/trends", analytics.getTrendAnalysis);
app.get("/api/analytics/clip/:clipId", analytics.getClipAnalytics);
app.post("/api/analytics/profile-view/:userId", analytics.trackProfileView);
app.post("/api/analytics/clip-share", authMiddleware, analytics.trackClipShare);

// Collaboration Endpoints
app.post("/api/collaborations", authMiddleware, collaboration.createCollaborationRequest);
app.get("/api/collaborations", authMiddleware, collaboration.getCollaborationRequests);
app.post("/api/collaborations/:requestId/accept", authMiddleware, collaboration.acceptCollaborationRequest);
app.post("/api/collaborations/:requestId/reject", authMiddleware, collaboration.rejectCollaborationRequest);
app.post("/api/artists/me/pinned-clips/:clipId", authMiddleware, collaboration.pinClipToArtist);
app.delete("/api/artists/me/pinned-clips/:clipId", authMiddleware, collaboration.unpinClipFromArtist);
app.get("/api/artists/me/pinned-clips", authMiddleware, collaboration.getPinnedClips);

// Gamification Endpoints
app.get("/api/gamification/points", authMiddleware, gamification.getUserPoints);
app.get("/api/gamification/badges", authMiddleware, gamification.getUserBadges);
app.get("/api/gamification/leaderboard", gamification.getLeaderboard);
app.post("/api/admin/gamification/badges/initialize", authMiddleware, gamification.initializeDefaultBadges);

// Live Polls Endpoints
app.post("/api/live/:sessionId/polls", authMiddleware, livePolls.createLivePoll);
app.post("/api/live/polls/:pollId/vote", livePolls.voteOnPoll);
app.get("/api/live/polls/:pollId/results", livePolls.getLivePollResults);
app.get("/api/live/:sessionId/polls/active", livePolls.getActivePoll);
app.post("/api/live/polls/:pollId/end", authMiddleware, livePolls.endLivePoll);

// GDPR Compliance Endpoints
app.get("/api/gdpr/export", authMiddleware, gdpr.exportUserData);
app.post("/api/gdpr/delete-request", authMiddleware, rateLimiter(RateLimits.STRICT), gdpr.requestAccountDeletion);
app.get("/api/privacy/settings", authMiddleware, gdpr.getPrivacySettings);
app.post("/api/privacy/settings", authMiddleware, gdpr.updatePrivacySettings);
app.get("/api/admin/gdpr/deletion-requests", authMiddleware, gdpr.getDeletionRequests);
app.post("/api/admin/gdpr/deletion-requests/:requestId/process", authMiddleware, gdpr.processAccountDeletion);

// Ticketmaster API Integration Endpoints
app.get("/api/ticketmaster/events/search", rateLimiter(RateLimits.SEARCH), ticketmaster.searchEvents);
app.get("/api/ticketmaster/events/:eventId", ticketmaster.getEventById);
app.get("/api/ticketmaster/venues/:venueId", ticketmaster.getVenueById);
app.get("/api/ticketmaster/attractions/search", rateLimiter(RateLimits.SEARCH), ticketmaster.searchAttractions);
app.post("/api/ticketmaster/purchase", authMiddleware, ticketmaster.createTicketPurchase);

// Google Maps API Integration Endpoints
app.get("/api/maps/geocode", rateLimiter(RateLimits.API), googleMaps.geocodeAddress);
app.get("/api/maps/reverse-geocode", rateLimiter(RateLimits.API), googleMaps.reverseGeocode);
app.get("/api/maps/nearby-venues", rateLimiter(RateLimits.SEARCH), googleMaps.searchNearbyVenues);
app.get("/api/maps/place-details", rateLimiter(RateLimits.API), googleMaps.getPlaceDetails);
app.get("/api/maps/distance", rateLimiter(RateLimits.API), googleMaps.calculateDistance);
app.get("/api/maps/autocomplete", rateLimiter(RateLimits.SEARCH), googleMaps.autocompleteVenue);

// Clip Rating Endpoints
app.post("/api/clips/:id/rate", authMiddleware, rating.rateClip);
app.get("/api/clips/:id/rating", authMiddleware, rating.getUserClipRating);

// Favorite Artists & Clips Endpoints
app.get("/api/users/me/favorite-artists", authMiddleware, favorite.getFavoriteArtists);
app.post("/api/users/favorite-artist", authMiddleware, favorite.toggleFavoriteArtist);
app.post("/api/clips/:id/favorite", authMiddleware, favorite.favoriteClip);
app.get("/api/clips/:id/favorited", authMiddleware, favorite.checkClipFavorited);
app.get("/api/users/me/favorite-clips-by-artist", authMiddleware, favorite.getFavoriteClipsByArtist);

// Enhanced Profile Endpoints
app.get("/api/users/:userId/stats", profile.getUserStats);
app.get("/api/users/:userId/favorite-artists-with-clips", profile.getUserFavoriteArtistsWithClips);

// Prioritized Discovery Endpoints
app.get("/api/discover/prioritized-shows", discoverPrioritized.getPrioritizedShows);
app.get("/api/artists/:artistName/shows/:showId/clips", discoverPrioritized.getShowClips);
app.get("/api/venues/:venueName/archive", discoverPrioritized.getVenueArchive);

// Artist Live Status
app.get("/api/artists/:artistName/live-status", async (c) => {
  const artistName = decodeURIComponent(c.req.param('artistName'));

  try {
    // Check if artist is currently performing live
    const liveSession = await c.env.DB.prepare(
      `SELECT 
        live_sessions.id as session_id,
        clips.venue_name,
        clips.location as venue_location,
        COUNT(DISTINCT clips.id) as moments_count,
        MAX(clips.thumbnail_url) as thumbnail_url
      FROM live_sessions
      LEFT JOIN live_session_clips ON live_sessions.id = live_session_clips.live_session_id
      LEFT JOIN clips ON live_session_clips.clip_id = clips.id
      WHERE live_sessions.status = 'live'
      AND clips.artist_name = ?
      AND clips.created_at >= datetime('now', '-2 hours')
      GROUP BY live_sessions.id, clips.venue_name, clips.location
      LIMIT 1`
    )
      .bind(artistName)
      .first();

    if (liveSession) {
      return c.json({
        isLive: true,
        liveShow: liveSession
      });
    }

    return c.json({ isLive: false });
  } catch (error) {
    console.error('Get artist live status error:', error);
    return c.json({ error: 'Failed to get live status' }, 500);
  }
});

// Artist Previous Shows
app.get("/api/artists/:artistName/previous-shows", async (c) => {
  const artistName = decodeURIComponent(c.req.param('artistName'));
  const limit = Math.min(parseInt(c.req.query('limit') || '8'), 20);

  try {
    const previousShows = await c.env.DB.prepare(
      `SELECT 
        clips.show_id,
        clips.artist_name,
        MIN(clips.timestamp) as show_date,
        clips.venue_name,
        COUNT(DISTINCT clips.id) as clip_count,
        AVG(clips.average_rating) as average_show_rating,
        MAX(clips.thumbnail_url) as thumbnail_url
      FROM clips
      WHERE clips.artist_name = ?
      AND clips.is_hidden = 0
      AND clips.show_id IS NOT NULL
      GROUP BY clips.show_id, clips.artist_name, clips.venue_name
      ORDER BY show_date DESC
      LIMIT ?`
    )
      .bind(artistName, limit)
      .all();

    return c.json({ shows: previousShows.results || [] });
  } catch (error) {
    console.error('Get artist previous shows error:', error);
    return c.json({ error: 'Failed to get previous shows' }, 500);
  }
});

export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(handleScheduled(env));
  }
};
