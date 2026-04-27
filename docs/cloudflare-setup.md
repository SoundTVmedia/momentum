# Cloudflare Environment Wiring (Step-by-Step)

This guide walks through exactly what to create in Cloudflare and how it maps to this repo.

## 1) Install and authenticate Wrangler

1. Install Wrangler (if needed):
   - `npm install -g wrangler`
2. Log in:
   - `wrangler login`
3. Verify auth:
   - `wrangler whoami`

## 2) Create (or identify) Cloudflare resources

From your repo root:

1. Create D1 DB (or note an existing DB name/id):
   - `wrangler d1 create momentum-db`
2. Create R2 bucket (or note an existing bucket name):
   - `wrangler r2 bucket create momentum-videos`

Capture the returned D1 `database_id` and names for both resources.

## 3) Wire repo config (`wrangler.json`)

This repo now includes:

- D1 binding: `DB`
- R2 binding: `R2_BUCKET`
- Durable Object namespace binding: `REALTIME`
- Durable Object migration and class:
  - class name: `RealtimeDurableObject`

Update these values in `wrangler.json` to match your account:

- `d1_databases[0].database_name`
- `d1_databases[0].database_id`
- `r2_buckets[0].bucket_name`

## 4) Configure Worker variables and secrets

### Non-secret vars (put in `wrangler.json` under `vars`)

- `MOCHA_USERS_SERVICE_API_URL`
- `CLOUDFLARE_ACCOUNT_ID`

### Secrets (set via Wrangler)

Run each command and paste the value when prompted:

- `wrangler secret put MOCHA_USERS_SERVICE_API_KEY`
- `wrangler secret put JAMBASE_API_KEY`
- `wrangler secret put STRIPE_SECRET_KEY`
- `wrangler secret put STRIPE_WEBHOOK_SECRET`
- `wrangler secret put CLOUDFLARE_STREAM_API_TOKEN`
- `wrangler secret put TICKETMASTER_API_KEY`
- `wrangler secret put GOOGLE_MAPS_API_KEY`

Optional / later integrations:

- `wrangler secret put FIREBASE_SERVER_KEY`
- `wrangler secret put SENDGRID_API_KEY`

For local development, copy `.dev.vars.example` to `.dev.vars` and fill values:

- `cp .dev.vars.example .dev.vars`

## 5) Apply DB migrations

Apply all SQL migrations to local DB:

- `for f in migrations/*.sql; do wrangler d1 execute momentum-db --local --file "$f"; done`

Apply all migrations to remote DB:

- `for f in migrations/*.sql; do wrangler d1 execute momentum-db --remote --file "$f"; done`

If your DB name differs from `momentum-db`, replace it in the commands.

## 6) Validate wiring end-to-end

1. Start local worker:
   - `wrangler dev`
2. In a separate terminal:
   - `curl -i http://127.0.0.1:8787/api/users/me`
     - Expected without auth cookie: `401` (proves Worker + bindings boot)
3. Validate Durable Object endpoint:
   - `curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" "http://127.0.0.1:8787/api/realtime/connect?user_id=test"`
     - Expected: `101 Switching Protocols`

## 7) Deploy

- `wrangler deploy`

Then sanity check:

- `curl -i https://<your-worker-url>/api/users/me`

## Common gotchas

- `REALTIME` binding missing -> runtime errors on realtime endpoints.
- DB mismatches -> onboarding/profile save failures.
- Missing `MOCHA_USERS_SERVICE_API_*` -> auth and current-user endpoints fail.
- Missing Stripe/JamBase/Ticketmaster/Google secrets -> related feature endpoints fail.
