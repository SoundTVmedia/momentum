# Staging Merge Checklist (Vercel + Cloudflare Worker/D1/R2)

This repo runs API/storage on Cloudflare (Worker + D1 + R2) and the web app can be hosted on Vercel.
To keep upload/edit/delete behavior identical after merge, wire environments in this order.

## 1) Create/confirm Cloudflare staging resources

Run these once for staging (skip if already created):

```bash
# D1
wrangler d1 create momentum-db-staging

# R2
wrangler r2 bucket create momentum-videos-staging
```

Record the returned `database_id` and bucket name.

## 2) Configure Worker staging bindings

In `wrangler.json`, add/update an `env.staging` block so staging uses staging resources:

- `d1_databases[0].binding = "DB"`
- `d1_databases[0].database_name = "momentum-db-staging"`
- `d1_databases[0].database_id = "<staging-d1-id>"`
- `r2_buckets[0].binding = "R2_BUCKET"`
- `r2_buckets[0].bucket_name = "momentum-videos-staging"`

Keep production/default bindings untouched.

## 3) Set Worker staging secrets/vars

Set all runtime secrets on Cloudflare for **staging**:

```bash
wrangler secret put MOCHA_USERS_SERVICE_API_KEY --env staging
wrangler secret put CLOUDFLARE_STREAM_API_TOKEN --env staging
wrangler secret put STRIPE_SECRET_KEY --env staging
wrangler secret put STRIPE_WEBHOOK_SECRET --env staging
wrangler secret put JAMBASE_API_KEY --env staging
wrangler secret put TICKETMASTER_API_KEY --env staging
wrangler secret put GOOGLE_MAPS_API_KEY --env staging
```

Set non-secret vars either in `wrangler.json` (`env.staging.vars`) or via dashboard:

- `MOCHA_USERS_SERVICE_API_URL`
- `MOCHA_OAUTH_REDIRECT_ORIGIN` (staging web origin)
- `CLOUDFLARE_ACCOUNT_ID`
- `PUBLIC_APP_URL` (staging web origin)
- `TRANSACTIONAL_EMAIL_FROM` (if email reset used)

## 4) Apply DB migrations to staging D1

```bash
npm run db:migrate:remote -- --env staging
```

Validate `clips.id` is clean after migration:

```bash
wrangler d1 execute momentum-db-staging --remote --command "SELECT COUNT(*) AS null_ids FROM clips WHERE id IS NULL;" --env staging
```

Expected: `0`.

## 5) Deploy Worker staging API

```bash
wrangler deploy --env staging
```

Save the deployed Worker URL, for example:

- `https://momentum-api-staging.<subdomain>.workers.dev`

## 6) Connect Vercel frontend to Worker API

Because frontend code calls relative `/api/*`, configure Vercel rewrites:

- `/api/:path*` -> `https://<worker-staging-domain>/api/:path*`
- `/realtime` -> `https://<worker-staging-domain>/realtime`

You can do this in `vercel.json` or Vercel project settings.

## 7) OAuth callback allowlist

In Mocha provider settings (Google/Spotify), allow staging callback URLs:

- `https://<vercel-staging-domain>/auth/callback`
- `https://<vercel-staging-domain>/auth` (if used by your flow)

## 8) Functional parity checks (must pass)

Run these in staging web app:

1. Upload clip from file -> clip appears in feed and My Clips.
2. Upload clip from URL -> clip appears in feed and My Clips.
3. Edit clip metadata -> artist/venue/description update persists.
4. Delete clip from My Clips -> row removed and does not reappear after refresh.
5. Hard-refresh dashboard and feed -> no stale/deleted clips.
6. Open another account -> deleted clip is not visible.

## 9) Quick API spot checks

Replace `<worker-staging-domain>` and run:

```bash
curl -i "https://<worker-staging-domain>/api/clips?page=1&limit=5"
curl -i "https://<worker-staging-domain>/api/live/current"
```

If auth endpoints fail, verify cookies + same-site settings and Vercel rewrite host behavior.

## 10) Merge gate

Merge to staging only when:

- Staging Worker points to staging D1/R2
- `clips.id` is non-null for all rows
- Upload/edit/delete checks all pass
- OAuth callbacks are green on staging domain

