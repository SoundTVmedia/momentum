import { Hono } from "hono";
import {
  exchangeCodeForSessionToken,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
  DEFAULT_MOCHA_USERS_SERVICE_API_URL,
} from "@getmocha/users-service/backend";
import {
  authMiddleware,
  optionalAuthMiddleware,
  EMAIL_SESSION_COOKIE_NAME,
  GOOGLE_SESSION_COOKIE_NAME,
  clearEmailSessionCookie,
  revokeEmailSession,
  revokeGoogleSession,
  isLocalDevHost,
  setEmailSessionCookie,
} from "./hybrid-auth";
import {
  buildGoogleOAuthRedirectUrl,
  exchangeGoogleOAuthCode,
  hasDirectGoogleOAuth,
  resolveOAuthCallbackUrl,
} from "./google-oauth";
import { mochaUserIdKey, parseD1LastRowId } from "./mocha-user-id";
import { isAdmin } from "./admin-auth";
import {
  isSameMochaUser,
  NOTIFICATIONS_LIST_FILTER_SQL,
  notificationRecipientKeys,
  notificationRecipientPlaceholders,
  notifyFollowers,
  notifyUser,
} from "./notification-utils";
import { getCookie, setCookie } from "hono/cookie";
import { handleScheduled } from "./scheduled";
import * as moderation from "./moderation-endpoints";
import * as discovery from "./discovery-endpoints";
import * as jambase from "./jambase-endpoints";
import * as artistVenuePages from "./artist-venue-pages";
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
import * as follow from "./follow-endpoints";
import * as profile from "./profile-endpoints";
import * as discoverPrioritized from "./discover-prioritized-endpoints";
import * as deviceToken from "./device-token-endpoints";
import * as authEndpoints from "./auth-endpoints";
import * as personalization from "./personalization-endpoints";
import * as youtube from "./youtube-endpoints";
import * as userRole from "./user-role-endpoints";
import * as superadminModeration from "./superadmin-moderation-endpoints";
import { rateLimiter, RateLimits } from "./rate-limiter";
import { jamBaseQuotaFromEnv } from "./jambase-client";
import { PerformanceMonitor, cacheJsonProxy } from "./performance-utils";
import { handleResumableUpload } from "./resumable-upload-endpoints";
import {
  deleteOwnClip,
  deleteOwnClipByBody,
  updateOwnClipByBody,
  getMyClipsFeed,
  postRecordClipView,
  getRelatedClipsForShare,
} from "./clip-endpoints";
import { postResolveShowForClip } from "./clips-resolve-show";
import * as showMarks from "./user-show-marks-endpoints";
import {
  getClipIdentifyMusicConfig,
  postClipIdentifyMusicAudD,
} from "./clip-audd-endpoints";
import {
  getContentFeedConfig,
  getFriendsPrePostFeed,
  loadValidClassification,
  postClassifyClipContent,
} from "./content-feed-endpoints";
import { mainFeedClipFilterSql } from "./content-feed-sql";
import {
  CONTENT_FEED_REJECTION_MESSAGES,
} from "../shared/content-feed";
import { headlinerMatchesAcrArtist } from "../shared/artist-name-match";
import { computeShowId } from "../shared/show-id";
import { resolveClipEventTitle } from "../shared/event-title";
import {
  clipShowFieldsForContentFeed,
  isPrePostContentFeed,
} from "../shared/pre-post-clip";
import { genreFieldsFromBody, songFieldsFromBody } from "./clip-tag-fields";
import { buildGenrePagePayload } from "./genre-page-endpoints";
import { buildGlobalSongPagePayload } from "./global-song-page-endpoints";
import { buildSongPagePayload } from "./song-page-endpoints";
import { normalizeClipApiRows } from "./clip-row-normalize";
import { r2ForClipObjectKey } from "./r2-clip-key";
import { serveR2ClipFile } from "./r2-serve";
import { maybeServeClipShareOgHtml } from "./clip-share-og";
export { RealtimeDurableObject } from "./realtime-durable-object";

const app = new Hono<{ Bindings: Env }>();

// Global rate limiting for general API endpoints
app.use('/api/*', rateLimiter(RateLimits.GENERAL));

// JamBase-backed routes: shared hourly bucket per user/IP (protects upstream quota)
app.use('/api/jambase/*', rateLimiter(RateLimits.JAMBASE_PROXY_HOURLY));
app.use('/api/youtube/*', rateLimiter(RateLimits.YOUTUBE_PROXY_HOURLY));
// Discover advanced search may call JamBase artists/venues/events per query
app.use('/api/search/advanced', rateLimiter(RateLimits.ADVANCED_SEARCH_HOURLY));

// Performance monitoring middleware
app.use('*', async (c, next) => {
  const monitor = new PerformanceMonitor();
  await next();
  monitor.setHeaders(c);
});

const ALLOWED_OAUTH_PROVIDERS = new Set(['google']);

// OAuth redirect URL (Google via Mocha Users Service or direct Google OAuth credentials)
app.get('/api/oauth/:provider/redirect_url', async (c) => {
  const provider = c.req.param('provider');
  if (!ALLOWED_OAUTH_PROVIDERS.has(provider)) {
    return c.json({ error: 'Unsupported OAuth provider' }, 400);
  }

  const callbackUrl = resolveOAuthCallbackUrl(c);
  const mochaApiKey =
    typeof c.env.MOCHA_USERS_SERVICE_API_KEY === 'string'
      ? c.env.MOCHA_USERS_SERVICE_API_KEY.trim()
      : '';

  if (provider === 'google' && !mochaApiKey && hasDirectGoogleOAuth(c.env)) {
    try {
      const redirectUrl = buildGoogleOAuthRedirectUrl(c, callbackUrl);
      return c.json({ redirectUrl, callbackUrl }, 200);
    } catch (e) {
      console.error('Direct Google OAuth redirect error', e);
      return c.json({ error: 'Could not start Google sign-in.' }, 500);
    }
  }

  const apiKey = c.env.MOCHA_USERS_SERVICE_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.trim() === '') {
    return c.json(
      {
        error:
          provider === 'google'
            ? 'Google sign-in is not configured. Set MOCHA_USERS_SERVICE_API_KEY (Mocha) or GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET in .dev.vars / Worker secrets.'
            : 'OAuth is not configured. Set MOCHA_USERS_SERVICE_API_KEY in .dev.vars (local) or Worker secrets (Cloudflare).',
        callbackUrl,
      },
      503
    );
  }

  const apiUrl =
    c.env.MOCHA_USERS_SERVICE_API_URL || DEFAULT_MOCHA_USERS_SERVICE_API_URL;

  const mochaParams = new URLSearchParams();
  mochaParams.set('redirect_base', callbackUrl);
  const qs = mochaParams.toString();
  const mochaRedirectUrl = `${apiUrl}/oauth/${provider}/redirect_url?${qs}`;

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
        error: `Could not start Google sign-in. Register ${callbackUrl} as an allowed redirect URL in your Mocha app settings and verify MOCHA_USERS_SERVICE_API_KEY.`,
      },
      502
    );
  }

  const data = (await response.json()) as { redirect_url: string };
  return c.json({ redirectUrl: data.redirect_url }, 200);
});

// Exchange code for session token
app.post("/api/sessions", async (c) => {
  const body = (await c.req.json()) as { code?: string; state?: string };

  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }

  const local = isLocalDevHost(c);
  const cookieBase = {
    httpOnly: true,
    path: "/",
    sameSite: local ? ("lax" as const) : ("none" as const),
    secure: !local,
    maxAge: 30 * 24 * 60 * 60,
  };

  if (hasDirectGoogleOAuth(c.env)) {
    const stateCookie = getCookie(c, 'google_oauth_state');
    if (stateCookie) {
      try {
        const signIn = await exchangeGoogleOAuthCode(
          c,
          body.code,
          body.state ?? null,
        );
        if (signIn.sessionType === 'email') {
          setEmailSessionCookie(c, signIn.sessionToken);
        } else {
          setCookie(c, GOOGLE_SESSION_COOKIE_NAME, signIn.sessionToken, cookieBase);
        }
        setCookie(c, 'google_oauth_state', '', { ...cookieBase, maxAge: 0 });
        return c.json(
          { success: true, provider: signIn.sessionType === 'email' ? 'email' : 'google' },
          200,
        );
      } catch (e) {
        console.error('exchangeGoogleOAuthCode:', e);
        return c.json(
          {
            error:
              e instanceof Error
                ? e.message
                : 'Google sign-in could not be completed.',
          },
          502,
        );
      }
    }
  }

  const apiKey = c.env.MOCHA_USERS_SERVICE_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.trim() === '') {
    return c.json(
      {
        error:
          'OAuth is not configured. Set MOCHA_USERS_SERVICE_API_KEY or Google OAuth credentials.',
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
          'Could not exchange OAuth code. Confirm Mocha credentials and that /auth/callback is allowed for OAuth return.',
      },
      502
    );
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, cookieBase);

  return c.json({ success: true, provider: 'mocha' }, 200);
});

// Get current user (200 when logged out — AuthProvider probes this on every page load)
app.get("/api/users/me", optionalAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");

  if (!mochaUser) {
    /** JSON `null` — AuthProvider treats as logged out (object payloads would be truthy in JS). */
    return c.json(null, 200);
  }

  const profile = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUserIdKey(mochaUser))
    .first();

  return c.json({
    ...mochaUser,
    authenticated: true,
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

  const googleToken = getCookie(c, GOOGLE_SESSION_COOKIE_NAME);
  if (typeof googleToken === 'string' && googleToken.length > 0) {
    await revokeGoogleSession(c.env.DB, googleToken);
  }
  setCookie(c, GOOGLE_SESSION_COOKIE_NAME, '', {
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
app.get(
  "/api/youtube/favorite-artist-videos",
  authMiddleware,
  youtube.getFavoriteArtistYoutubeVideos,
);
app.get(
  "/api/youtube/artist/:artistName/videos",
  optionalAuthMiddleware,
  youtube.getArtistYoutubeVideos,
);
app.get(
  "/api/youtube/trending-music",
  optionalAuthMiddleware,
  youtube.getTrendingMusicYoutube,
);

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
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
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
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
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
      display_name,
      bio,
      location,
      profile_image_url,
      cover_image_url,
      city,
      genres,
      social_links,
    } = body;

    const genresJson = JSON.stringify(Array.isArray(genres) ? genres : []);
    const socialJson = JSON.stringify(
      social_links !== undefined &&
        social_links !== null &&
        typeof social_links === "object"
        ? social_links
        : {}
    );

    const uid = mochaUserIdKey(mochaUser);

    // Check if profile exists
    const existingProfile = await c.env.DB.prepare(
      "SELECT id, role FROM user_profiles WHERE mocha_user_id = ?"
    )
      .bind(uid)
      .first<{ id: number; role: string }>();

    // New users always start as fans; existing users keep their assigned role.
    const roleVal = existingProfile?.role ?? "fan";

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
          uid
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
          uid,
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
      .bind(uid)
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
          mp4PlaybackUrl: videoDetails.mp4Url,
          thumbnailUrl: videoDetails.thumbnail,
          status: videoDetails.status,
          readyToStream: videoDetails.readyToStream,
          duration: videoDetails.duration,
          type: 'stream',
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

    const r2 = r2ForClipObjectKey(c.env, key);
    await r2.put(key, file.stream(), {
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

// Retrieve file from R2 (supports Range requests for video seeking / fast start)
app.get("/api/files/:key{.+}", serveR2ClipFile);

// Match clip time + location to JamBase shows (personalized radius)
app.post("/api/clips/resolve-show", authMiddleware, rateLimiter(RateLimits.API), postResolveShowForClip);
app.get(
  "/api/clips/identify-music/config",
  authMiddleware,
  rateLimiter(RateLimits.IDENTIFY_MUSIC),
  getClipIdentifyMusicConfig
);
app.post(
  "/api/clips/identify-music",
  authMiddleware,
  rateLimiter(RateLimits.IDENTIFY_MUSIC),
  postClipIdentifyMusicAudD
);
app.get(
  "/api/clips/classify-content/config",
  authMiddleware,
  rateLimiter(RateLimits.IDENTIFY_MUSIC),
  getContentFeedConfig
);
app.post(
  "/api/clips/classify-content",
  authMiddleware,
  rateLimiter(RateLimits.IDENTIFY_MUSIC),
  postClassifyClipContent
);
app.get(
  "/api/clips/friends",
  authMiddleware,
  rateLimiter(RateLimits.API),
  getFriendsPrePostFeed
);
app.get(
  "/api/clips/friends-prepost",
  authMiddleware,
  rateLimiter(RateLimits.API),
  getFriendsPrePostFeed
);

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
    stream_video_id,
    stream_playback_url,
    stream_thumbnail_url,
    video_status,
    video_duration,
    status,
    recording_orientation,
    video_resolution_w,
    video_resolution_h,
    jambase_event_id,
    jambase_artist_id,
    jambase_venue_id,
    event_title: bodyEventTitle,
    classification_id,
  } = body;

  if (!video_url && !stream_video_id) {
    return c.json({ error: "video_url or stream_video_id is required" }, 400);
  }

  const uid = mochaUserIdKey(mochaUser);
  const isDraft = status === 'draft';

  let classification: {
    content_feed: string;
    acr_matched: number;
    has_speech: number;
    headliner_matched: number;
    acr_artist: string | null;
    acr_title: string | null;
  } | null = null;
  let classificationId = '';

  if (!isDraft) {
    classificationId =
      typeof classification_id === 'string' ? classification_id.trim() : '';
    if (!classificationId) {
      return c.json(
        {
          error:
            'Content classification is required. Run classify-content on your clip audio before posting.',
        },
        422,
      );
    }

    classification = await loadValidClassification(c.env.DB, classificationId, uid);
    if (!classification) {
      return c.json(
        {
          error:
            'Classification expired or invalid. Re-check your clip on the caption screen before posting.',
        },
        422,
      );
    }
    if (classification.content_feed === 'rejected') {
      return c.json(
        { error: 'This clip cannot be posted to either feed based on music and speech detection.' },
        422,
      );
    }
    if (classification.content_feed !== 'main' && classification.content_feed !== 'pre_post') {
      return c.json({ error: 'Invalid content feed classification.' }, 422);
    }
  }

  const postedArtistName =
    typeof artist_name === 'string' ? artist_name.trim() : '';

  if (
    !isDraft &&
    classification?.content_feed === 'main' &&
    classification.acr_matched
  ) {
    const acrArtist = classification.acr_artist?.trim() ?? '';
    if (!acrArtist) {
      return c.json(
        { error: 'Music was identified but artist data is missing. Re-check your clip and try again.' },
        422,
      );
    }
    if (!postedArtistName) {
      return c.json(
        { error: CONTENT_FEED_REJECTION_MESSAGES.missing_headliner },
        422,
      );
    }
    if (!headlinerMatchesAcrArtist(acrArtist, postedArtistName)) {
      return c.json(
        { error: CONTENT_FEED_REJECTION_MESSAGES.acr_no_headliner_match },
        422,
      );
    }
  }

  const { 
    geolocation_latitude, 
    geolocation_longitude, 
    geolocation_accuracy_radius 
  } = body;

  // `clips.video_url` is NOT NULL; allow Stream-only payloads where playback URL carries the link.
  const resolvedVideoUrl = (video_url || stream_playback_url || "") as string;
  const resolvedTimestamp = timestamp || new Date().toISOString();
  const contentFeed = classification?.content_feed ?? 'main';
  const showFields = clipShowFieldsForContentFeed(contentFeed, {
    artist_name: typeof artist_name === 'string' ? artist_name : '',
    venue_name: typeof venue_name === 'string' ? venue_name : '',
    location: typeof location === 'string' ? location : '',
    song_title:
      typeof (body as Record<string, unknown>).song_title === 'string'
        ? String((body as Record<string, unknown>).song_title)
        : typeof (body as Record<string, unknown>).songTitle === 'string'
          ? String((body as Record<string, unknown>).songTitle)
          : '',
    genre_name:
      typeof (body as Record<string, unknown>).genre_name === 'string'
        ? String((body as Record<string, unknown>).genre_name)
        : typeof (body as Record<string, unknown>).genreName === 'string'
          ? String((body as Record<string, unknown>).genreName)
          : '',
    hashtagsInput: (() => {
      const raw = (body as Record<string, unknown>).hashtags;
      if (typeof raw === 'string') return raw;
      if (Array.isArray(raw)) {
        return raw.map((t) => `#${String(t).replace(/^#+/, '')}`).join(' ');
      }
      return '';
    })(),
    jambaseLink: {
      event: typeof jambase_event_id === 'string' ? jambase_event_id : null,
      artist: typeof jambase_artist_id === 'string' ? jambase_artist_id : null,
      venue: typeof jambase_venue_id === 'string' ? jambase_venue_id : null,
      eventTitle: typeof bodyEventTitle === 'string' ? bodyEventTitle : null,
    },
    eventTitleFallback: resolveClipEventTitle({
      event_title: typeof bodyEventTitle === 'string' ? bodyEventTitle : null,
      artist_name: typeof artist_name === 'string' ? artist_name : null,
      venue_name: typeof venue_name === 'string' ? venue_name : null,
    }),
  });

  const resolvedArtist = showFields.artist_name;
  const resolvedVenue = showFields.venue_name;
  const resolvedLocation = showFields.location;
  const resolvedSongTitle = showFields.song_title;
  const resolvedGenreName = showFields.genre_name;
  const resolvedJambaseEventId = showFields.jambase_event_id;
  const resolvedJambaseArtistId = showFields.jambase_artist_id;
  const resolvedJambaseVenueId = showFields.jambase_venue_id;
  const resolvedEventTitle = showFields.event_title;
  const hashtagList = showFields.hashtags;

  const song_slug = resolvedSongTitle ? songFieldsFromBody({ song_title: resolvedSongTitle }).song_slug : null;
  const genre_slug = resolvedGenreName
    ? genreFieldsFromBody({ genre_name: resolvedGenreName }).genre_slug
    : null;

  const showId = isPrePostContentFeed(contentFeed)
    ? null
    : computeShowId({
        jambase_event_id: resolvedJambaseEventId,
        artist_name: resolvedArtist,
        venue_name: resolvedVenue,
        timestamp: resolvedTimestamp,
      });

  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO clips 
       (mocha_user_id, artist_name, venue_name, location, timestamp, content_description, 
        video_url, thumbnail_url, hashtags, song_title, song_slug, genre_name, genre_slug,
        stream_video_id, stream_playback_url, 
        stream_thumbnail_url, video_status, video_duration, status, 
        geolocation_latitude, geolocation_longitude, geolocation_accuracy_radius, 
        recording_orientation, video_resolution_w, video_resolution_h,
        jambase_event_id, jambase_artist_id, jambase_venue_id, show_id, event_title,
        content_feed, acr_matched, has_speech, headliner_matched,
        is_draft, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(
        uid,
        resolvedArtist,
        resolvedVenue,
        resolvedLocation,
        resolvedTimestamp,
        content_description || null,
        resolvedVideoUrl,
        thumbnail_url || null,
        JSON.stringify(hashtagList),
        resolvedSongTitle,
        song_slug,
        resolvedGenreName,
        genre_slug,
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
        resolvedJambaseEventId,
        resolvedJambaseArtistId,
        resolvedJambaseVenueId,
        showId,
        resolvedEventTitle,
        classification?.content_feed ?? 'main',
        classification?.acr_matched ? 1 : 0,
        classification?.has_speech ? 1 : 0,
        classification?.headliner_matched ? 1 : 0,
        isDraft ? 1 : 0
      )
      .run();

    if (classificationId) {
      try {
        await c.env.DB.prepare(
          'DELETE FROM clip_content_classifications WHERE id = ?',
        )
          .bind(classificationId)
          .run();
      } catch (err) {
        console.error('Failed to delete used classification:', err);
      }
    }

    // Some local schemas have nullable `clips.id`; ensure canonical numeric id is present.
    await c.env.DB.prepare(
      `UPDATE clips
       SET id = COALESCE(id, ?)
       WHERE rowid = ?`
    )
      .bind(result.meta.last_row_id, result.meta.last_row_id)
      .run();

    const newClip = await c.env.DB.prepare(
      "SELECT * FROM clips WHERE rowid = ?"
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

    const publishedClipId =
      parseD1LastRowId((newClip as { id?: unknown } | null)?.id) ??
      parseD1LastRowId(result.meta.last_row_id);

    if (publishedClipId != null && (status || 'published') !== 'draft') {
      try {
        await notifyFollowers(c.env, mochaUser, {
          type: 'clip',
          content: 'posted a new clip',
          related_clip_id: publishedClipId,
        });
      } catch (err) {
        console.error('Failed to notify followers of new clip:', err);
      }
    }

    return c.json(newClip, 201);
  } catch (err) {
    console.error('POST /api/clips:', err);
    const message = err instanceof Error ? err.message : 'Failed to create clip';
    return c.json({ error: message }, 500);
  }
});

// Delete own clip (uploader only) — register before GET /api/clips/:id so :clipId is not shadowed
app.delete("/api/clips/:clipId", authMiddleware, deleteOwnClip);
app.post("/api/clips/delete-own", authMiddleware, deleteOwnClipByBody);
app.post("/api/clips/update-own", authMiddleware, updateOwnClipByBody);
app.get("/api/me/clips", authMiddleware, getMyClipsFeed);

// Get clips feed (optimized with caching headers)
app.get("/api/clips", async (c) => {
  try {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50); // Cap at 50
  const sortBy = c.req.query('sort_by') || 'latest';
  const artistName = c.req.query('artist_name');
  const venueName = c.req.query('venue_name');
  const songSlug = c.req.query('song_slug');
  const genreSlug = c.req.query('genre_slug');
  const userId = c.req.query('user_id');
  const since = c.req.query('since');
  const feedScope = c.req.query('feed_scope') || 'main';
  
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT 
      clips.rowid AS _clipRowId,
      clips.id AS clip_primary_id,
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

  // Public discovery feeds show performance clips only; profile pages show all lanes.
  if (!userId && feedScope !== 'all') {
    const mainFeedFilter = await mainFeedClipFilterSql(c.env.DB);
    query += ` AND ${mainFeedFilter}`;
  }
  
  if (artistName) {
    query += ` AND clips.artist_name = ?`;
    bindings.push(artistName);
  }
  
  if (venueName) {
    query += ` AND clips.venue_name = ?`;
    bindings.push(venueName);
  }

  if (songSlug) {
    query += ` AND clips.song_slug = ?`;
    bindings.push(songSlug.trim().toLowerCase());
  }

  if (genreSlug) {
    query += ` AND clips.genre_slug = ?`;
    bindings.push(genreSlug.trim().toLowerCase());
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
      query += ` ORDER BY clips.likes_count DESC, clips.views_count DESC, clips.created_at DESC`;
      break;
    case 'most_liked':
      query += ` ORDER BY clips.likes_count DESC, clips.created_at DESC`;
      break;
    case 'most_viewed':
      query += ` ORDER BY clips.views_count DESC, clips.created_at DESC`;
      break;
    case 'top_rated':
      // Legacy: star ratings retired from feeds — treat as most liked
      query += ` ORDER BY clips.likes_count DESC, clips.created_at DESC`;
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

  // User-scoped or filtered feeds must not be cached publicly — stale JSON causes "My clips"
  // to show rows that no longer exist locally, so delete/update then return 404 Clip not found.
  const scopedFeed = Boolean(userId || since || artistName || venueName || songSlug);
  if (scopedFeed) {
    c.header('Cache-Control', 'private, no-store, must-revalidate');
    c.header('Pragma', 'no-cache');
  } else {
    c.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  }

  return c.json({
    clips: normalizeClipApiRows((clips.results || []) as Record<string, unknown>[]),
    page,
    limit,
    hasMore: (clips.results || []).length === limit
  });
  } catch (err) {
    console.error('GET /api/clips:', err);
    const message = err instanceof Error ? err.message : 'Failed to load clips feed';
    return c.json({ error: message }, 500);
  }
});

app.get("/api/clips/:id/related-clips", getRelatedClipsForShare);

// Get single clip
app.get("/api/clips/:id", async (c) => {
  const clipId = c.req.param('id');
  
  const clip = await c.env.DB.prepare(
    `SELECT 
      clips.rowid AS _clipRowId,
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

  const [normalizedClip] = normalizeClipApiRows([clip as Record<string, unknown>]);
  return c.json(normalizedClip);
});

app.post("/api/clips/:id/view", postRecordClipView);

// Clip ids the signed-in user has liked (for consistent heart UI)
app.get("/api/users/me/liked-clips", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const uid = mochaUserIdKey(mochaUser);
  const rows = await c.env.DB.prepare(
    "SELECT clip_id FROM clip_likes WHERE mocha_user_id = ?",
  )
    .bind(uid)
    .all();
  const clip_ids = (rows.results ?? [])
    .map((r) => Number((r as { clip_id: unknown }).clip_id))
    .filter((id) => Number.isFinite(id));
  return c.json({ clip_ids });
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

    if (!isSameMochaUser(clip.mocha_user_id, mochaUser)) {
      try {
        const featured = await c.env.DB.prepare(
          `SELECT id FROM live_featured_clips WHERE clip_id = ? LIMIT 1`,
        )
          .bind(clipId)
          .first();

        const likeContent = featured
          ? 'liked your clip that was featured on Feedback Live'
          : 'liked your clip';

        await notifyUser(c.env, mochaUserIdKey({ id: clip.mocha_user_id }), {
          type: 'like',
          content: likeContent,
          related_user_id: mochaUserIdKey(mochaUser),
          related_clip_id: Number(clipId),
        });
      } catch (err) {
        console.error('Failed to create like notification:', err);
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
  const uid = mochaUserIdKey(mochaUser);
  
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
    .bind(clipId, uid)
    .first();

  if (existingSave) {
    // Unsave
    await c.env.DB.prepare(
      "DELETE FROM saved_clips WHERE clip_id = ? AND mocha_user_id = ?"
    )
      .bind(clipId, uid)
      .run();

    return c.json({ saved: false });
  } else {
    // Save
    await c.env.DB.prepare(
      "INSERT INTO saved_clips (clip_id, mocha_user_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
    )
      .bind(clipId, uid)
      .run();

    return c.json({ saved: true });
  }
});

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
  const uid = mochaUserIdKey(mochaUser);

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
    .bind(clipId, uid, parent_comment_id || null, content)
    .run();

  const commentRowId = parseD1LastRowId(result.meta.last_row_id);
  if (commentRowId == null) {
    return c.json({ error: "Failed to create comment" }, 500);
  }

  // Update comment count on clip
  await c.env.DB.prepare(
    "UPDATE clips SET comments_count = comments_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  )
    .bind(clipId)
    .run();

  const clipOwnerKey = mochaUserIdKey({ id: clip.mocha_user_id });
  if (!isSameMochaUser(clipOwnerKey, mochaUser)) {
    try {
      await notifyUser(c.env, clipOwnerKey, {
        type: 'comment',
        content: 'commented on your clip',
        related_user_id: uid,
        related_clip_id: Number(clipId),
        related_comment_id: commentRowId,
      });
    } catch (err) {
      console.error('Failed to create comment notification:', err);
    }
  }

  // Award points for commenting (non-blocking for the client)
  try {
    await gamification.awardPoints(
      c.env,
      uid,
      3,
      'Posted a comment',
      parseInt(clipId, 10),
      commentRowId,
    );
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
    .bind(commentRowId)
    .first();

  if (!newComment) {
    return c.json({ error: "Comment created but could not be loaded" }, 500);
  }

  return c.json(newComment, 201);
});

app.get("/api/users/me/following", authMiddleware, follow.getMyFollowing);
app.get("/api/users/me/following/users", authMiddleware, follow.getMyFollowingUsers);
app.get("/api/users/me/following/list", authMiddleware, follow.getMyFollowingList);
app.post("/api/users/:userId/follow", authMiddleware, follow.toggleFollow);

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
      clips.rowid AS _clipRowId,
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
    clips: normalizeClipApiRows((clips.results || []) as Record<string, unknown>[]),
    stats: {
      totalClips: clips.results?.length || 0,
      totalLikes,
      totalViews,
      followers: followerCount?.count || 0,
      following: followingCount?.count || 0,
    },
  });
});

// Clip ids the signed-in user has saved (for bookmark UI)
app.get("/api/users/me/saved-clip-ids", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const uid = mochaUserIdKey(mochaUser);
  const rows = await c.env.DB.prepare(
    "SELECT clip_id FROM saved_clips WHERE mocha_user_id = ?",
  )
    .bind(uid)
    .all();
  const clip_ids = (rows.results ?? [])
    .map((r) => Number((r as { clip_id: unknown }).clip_id))
    .filter((id) => Number.isFinite(id));
  return c.json({ clip_ids });
});

// Get user's saved clips (full rows for profile / saved page)
app.get("/api/users/me/saved-clips", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const uid = mochaUserIdKey(mochaUser);
  const savedClips = await c.env.DB.prepare(
    `SELECT 
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM saved_clips
    JOIN clips ON saved_clips.clip_id = clips.id
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE saved_clips.mocha_user_id = ?
      AND clips.is_hidden = 0
    ORDER BY saved_clips.created_at DESC`
  )
    .bind(uid)
    .all();

  return c.json({
    clips: normalizeClipApiRows((savedClips.results || []) as Record<string, unknown>[]),
  });
});

// Clips the signed-in user has liked (full rows for liked-clips page)
app.get("/api/users/me/liked-clips-feed", authMiddleware, async (c) => {
  const mochaUser = c.get("user");

  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const uid = mochaUserIdKey(mochaUser);
  const likedClips = await c.env.DB.prepare(
    `SELECT
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clip_likes
    JOIN clips ON clip_likes.clip_id = clips.id
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clip_likes.mocha_user_id = ?
      AND clips.is_hidden = 0
    ORDER BY clip_likes.created_at DESC`,
  )
    .bind(uid)
    .all();

  return c.json({
    clips: normalizeClipApiRows((likedClips.results || []) as Record<string, unknown>[]),
  });
});

// Get user's notifications (social activity from followed users only)
app.get("/api/notifications", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const uid = mochaUserIdKey(mochaUser);
  const recipientKeys = notificationRecipientKeys(mochaUser);
  const inList = notificationRecipientPlaceholders(recipientKeys.length);

  const notifications = await c.env.DB.prepare(
    `SELECT 
      notifications.id AS notification_id,
      notifications.*,
      notifications.rowid AS _notification_rowid,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM notifications
    LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
    WHERE notifications.mocha_user_id IN (${inList})
      AND (${NOTIFICATIONS_LIST_FILTER_SQL})
    ORDER BY notifications.is_read ASC, notifications.created_at DESC
    LIMIT 50`
  )
    .bind(...recipientKeys, uid)
    .all();

  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');

  const rows = (notifications.results || []) as { is_read?: unknown }[];
  const unread_count = rows.filter((r) => {
    const read = (r as { is_read?: unknown }).is_read;
    return read === 0 || read === false || read == null;
  }).length;

  return c.json({ notifications: rows, unread_count });
});

// Mark all notifications as read (register before :id/read so "read-all" is not captured as an id)
app.post("/api/notifications/read-all", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const uid = mochaUserIdKey(mochaUser);
  const recipientKeys = notificationRecipientKeys(mochaUser);
  const inList = notificationRecipientPlaceholders(recipientKeys.length);

  await c.env.DB.prepare(
    `UPDATE notifications SET is_read = 1
     WHERE mocha_user_id IN (${inList})
       AND (is_read = 0 OR is_read IS NULL OR is_read = false)
       AND (${NOTIFICATIONS_LIST_FILTER_SQL})`,
  )
    .bind(...recipientKeys, uid)
    .run();

  return c.json({ success: true, unread_count: 0 });
});

// Mark notification as read
app.post("/api/notifications/:id/read", authMiddleware, async (c) => {
  const mochaUser = c.get("user");

  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const notificationId = Number.parseInt(c.req.param('id') ?? '', 10);
  if (!Number.isFinite(notificationId) || notificationId <= 0) {
    return c.json({ error: 'Invalid notification id' }, 400);
  }

  const uid = mochaUserIdKey(mochaUser);
  const recipientKeys = notificationRecipientKeys(mochaUser);
  const inList = notificationRecipientPlaceholders(recipientKeys.length);

  const update = await c.env.DB.prepare(
    `UPDATE notifications SET is_read = 1
     WHERE (id = ? OR rowid = ?) AND mocha_user_id IN (${inList})`,
  )
    .bind(notificationId, notificationId, ...recipientKeys)
    .run();

  const changes = Number(update.meta?.changes ?? 0);

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM notifications
     WHERE mocha_user_id IN (${inList})
       AND (is_read = 0 OR is_read IS NULL OR is_read = false)
       AND (${NOTIFICATIONS_LIST_FILTER_SQL})`,
  )
    .bind(...recipientKeys, uid)
    .first() as { count?: number } | null;

  return c.json({
    success: true,
    updated: changes > 0,
    unread_count: Number(countRow?.count ?? 0),
  });
});

// Search clips (optimized with better indexing and rate limiting)
app.get("/api/search/clips", rateLimiter(RateLimits.SEARCH), async (c) => {
  const query = c.req.query('q') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50); // Cap at 50

  if (!query || query.length < 2) {
    cacheJsonProxy(c, { browserMaxAge: 30, cdnMaxAge: 120 });
    return c.json({ clips: [] });
  }

  // Use LIKE with leading wildcard only when necessary for better index usage
  const searchTerm = `%${query}%`;
  
  const clips = await c.env.DB.prepare(
    `SELECT 
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      -- Rank results by relevance
      CASE 
        WHEN clips.artist_name LIKE ? THEN 3
        WHEN clips.venue_name LIKE ? THEN 2
        WHEN clips.hashtags LIKE ? THEN 2
        ELSE 1
      END as relevance
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.is_hidden = 0
    AND (clips.artist_name LIKE ? 
       OR clips.venue_name LIKE ?
       OR clips.location LIKE ?
       OR clips.content_description LIKE ?
       OR clips.hashtags LIKE ?)
    ORDER BY relevance DESC, clips.created_at DESC
    LIMIT ?`
  )
    .bind(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, limit)
    .all();

  cacheJsonProxy(c, { browserMaxAge: 60, cdnMaxAge: 300, staleWhileRevalidate: 600 });

  return c.json({
    clips: normalizeClipApiRows((clips.results || []) as Record<string, unknown>[]),
  });
});

// Advanced search with filters
app.get("/api/search/advanced", optionalAuthMiddleware, discovery.advancedSearch);

// Get trending content
app.get("/api/discover/trending", discovery.getTrendingContent);
app.get("/api/discover/feed", optionalAuthMiddleware, discovery.getDiscoverFeed);
app.get("/api/shows/nearby", optionalAuthMiddleware, discovery.getNearbyShows);

// JamBase API Integration Endpoints
app.get("/api/jambase/status", jambase.getJamBaseStatus);
app.get("/api/jambase/connection-test", authMiddleware, jambase.connectionTest);
app.get("/api/jambase/search/artists", jambase.searchArtists);
app.get("/api/jambase/search/venues", jambase.searchVenues);
app.get("/api/jambase/artist/:artistId/tourdates", jambase.getArtistTourDates);
app.get("/api/jambase/artist/:artistId", jambase.getArtistById);
app.get("/api/jambase/venue/:venueId", jambase.getVenueById);
app.get("/api/jambase/events/match", jambase.matchEventsByLocation);
app.get("/api/jambase/events/upcoming", jambase.getUpcomingEvents);
app.get("/api/jambase/events/live-tab", jambase.getLiveTabEvents);
app.get("/api/jambase/events/by-artist-name", jambase.getEventsByArtistName);
app.get("/api/jambase/events/by-venue-name", jambase.getEventsByVenueName);
app.get("/api/jambase/search/events", jambase.searchEvents);

// Get artist by slug (hyphenated name) — enriched with JamBase when JAMBASE_API_KEY is set
app.get("/api/artists/:artistName", async (c) => {
  try {
    const payload = await artistVenuePages.buildArtistPagePayload(c);
    return c.json(payload);
  } catch (err) {
    console.error("Get artist page error:", err);
    return c.json({ error: "Failed to load artist" }, 500);
  }
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

// Get venue by slug (hyphenated name) — enriched with JamBase when JAMBASE_API_KEY is set
app.get("/api/venues/:venueName", async (c) => {
  try {
    const payload = await artistVenuePages.buildVenuePagePayload(c);
    return c.json(payload);
  } catch (err) {
    console.error("Get venue page error:", err);
    return c.json({ error: "Failed to load venue" }, 500);
  }
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
    const rawClip = await c.env.DB.prepare(
      `SELECT 
        clips.rowid AS _clipRowId,
        clips.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM clips
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      WHERE clips.id = ?`
    )
      .bind(session.current_clip_id)
      .first();
    if (rawClip) {
      const [n] = normalizeClipApiRows([rawClip as Record<string, unknown>]);
      currentClip = n;
    }
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
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
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
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
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
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
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
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
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
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
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
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
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
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
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
    "SELECT is_admin, is_superadmin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || (!isAdmin(userProfile) && !userProfile.is_moderator)) {
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
    "SELECT is_admin, is_superadmin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || (!isAdmin(userProfile) && !userProfile.is_moderator)) {
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
    "SELECT is_admin, is_superadmin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || (!isAdmin(userProfile) && !userProfile.is_moderator)) {
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
    "SELECT is_admin, is_superadmin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || (!isAdmin(userProfile) && !userProfile.is_moderator)) {
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
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
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
      `🎬 Your moment is on Feedback Live right now!`,
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
    await gamification.awardPoints(c.env, clip.mocha_user_id as string, 100, 'Featured on Feedback Live', parseInt(clipId));
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
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
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
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
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
    "SELECT is_admin, is_superadmin FROM user_profiles WHERE mocha_user_id = ?"
  )
    .bind(mochaUser.id)
    .first();

  if (!userProfile || !isAdmin(userProfile)) {
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
      clips.rowid AS _clipRowId,
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
    topClips: normalizeClipApiRows((topClips.results || []) as Record<string, unknown>[]),
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
app.get("/api/admin/users/search", authMiddleware, userRole.searchUsersForRoleAdmin);
app.patch("/api/admin/users/:userId/role", authMiddleware, userRole.updateUserRole);
app.post("/api/admin/users/:userId/suspend", authMiddleware, superadminModeration.suspendUserAccount);
app.post("/api/admin/users/:userId/unsuspend", authMiddleware, superadminModeration.unsuspendUserAccount);
app.delete("/api/admin/users/:userId", authMiddleware, superadminModeration.deleteUserAccount);
app.get("/api/admin/clips/search", authMiddleware, superadminModeration.searchClipsForModeration);
app.get("/api/admin/super/users/by-role", authMiddleware, superadminModeration.listUsersByRole);
app.get("/api/admin/super/users/:userId/moderation", authMiddleware, superadminModeration.getUserModerationStatus);
app.post("/api/admin/users/:userId/flag", authMiddleware, superadminModeration.flagUserAccount);
app.post("/api/admin/users/:userId/unflag", authMiddleware, superadminModeration.unflagUserAccount);

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
app.post(
  "/api/ticketmaster/track-purchase",
  authMiddleware,
  ticketmaster.createTicketPurchase,
);

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
app.get("/api/users/me/show-marks", authMiddleware, showMarks.getMyShowMarks);
app.post("/api/users/me/show-marks", authMiddleware, showMarks.upsertMyShowMark);
app.delete("/api/users/me/show-marks/:jambaseEventId", authMiddleware, showMarks.deleteMyShowMark);

app.get("/api/users/me/favorite-artists", authMiddleware, favorite.getFavoriteArtists);
app.post("/api/users/favorite-artist", authMiddleware, favorite.toggleFavoriteArtist);
app.post("/api/users/favorite-artists/sync-by-name", authMiddleware, favorite.syncFavoriteArtistsByName);
app.post("/api/clips/:id/favorite", authMiddleware, favorite.favoriteClip);
app.get("/api/clips/:id/favorited", authMiddleware, favorite.checkClipFavorited);
app.get("/api/users/me/favorite-clips-by-artist", authMiddleware, favorite.getFavoriteClipsByArtist);

// Enhanced Profile Endpoints
app.get("/api/users/:userId/stats", profile.getUserStats);
app.get("/api/users/:userId/favorite-artists-with-clips", profile.getUserFavoriteArtistsWithClips);

// Prioritized Discovery Endpoints
app.get("/api/discover/prioritized-shows", discoverPrioritized.getPrioritizedShows);
app.get(
  "/api/discover/favorite-artist-feed",
  authMiddleware,
  rateLimiter(RateLimits.API),
  discoverPrioritized.getFavoriteArtistFeed,
);
app.get("/api/artists/:artistName/songs/:songSlug", buildSongPagePayload);
app.get("/api/songs/:songSlug", buildGlobalSongPagePayload);
app.get("/api/genres/:genreSlug", buildGenrePagePayload);
app.get("/api/artists/:artistName/shows/:showId/clips", discoverPrioritized.getShowClips);
app.get("/api/event-clips/:eventTitle/clips", discoverPrioritized.getEventClips);
app.get("/api/venues/:venueName/archive", discoverPrioritized.getVenueArchive);

// Artist Live Status
app.get("/api/artists/:artistName/live-status", async (c) => {
  const artistName = await artistVenuePages.resolveArtistNameForClipsQuery(
    c.env.DB,
    c.env.JAMBASE_API_KEY,
    c.req.param("artistName"),
    jamBaseQuotaFromEnv(c.env)
  );

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
  const artistName = await artistVenuePages.resolveArtistNameForClipsQuery(
    c.env.DB,
    c.env.JAMBASE_API_KEY,
    c.req.param("artistName"),
    jamBaseQuotaFromEnv(c.env)
  );
  const limit = Math.min(parseInt(c.req.query('limit') || '12'), 48);

  try {
    const previousShows = await c.env.DB.prepare(
      `SELECT 
        clips.event_title,
        clips.artist_name,
        MIN(clips.timestamp) as show_date,
        clips.venue_name,
        COUNT(DISTINCT clips.id) as clip_count,
        AVG(clips.average_rating) as average_show_rating,
        MAX(clips.thumbnail_url) as thumbnail_url
      FROM clips
      WHERE clips.artist_name = ?
      AND clips.is_hidden = 0
      AND clips.is_draft = 0
      AND clips.event_title IS NOT NULL
      AND TRIM(clips.event_title) != ''
      GROUP BY clips.event_title, clips.artist_name, clips.venue_name
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

/** SPA shell + static files — registered last so /api/* routes win. */
app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const ogHtml = await maybeServeClipShareOgHtml(
      request,
      env as Env & { ASSETS: { fetch: typeof fetch } },
    );
    if (ogHtml) return ogHtml;

    return app.fetch(request, env, ctx);
  },
  scheduled: async (_controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(handleScheduled(env));
  }
};
