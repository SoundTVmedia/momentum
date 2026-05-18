## MOMENTUM - Where Live Music Lives Online

This app was created using https://getmocha.com.
Need help or want to join the community? Join our [Discord](https://discord.gg/shDEGBSe2d).

## Local setup

### 1) Use a supported Node.js version

This project uses Vite 7, which requires:

- `Node.js ^20.19.0` or `>=22.12.0`

### 2) Install dependencies

```bash
npm install
```

### 3) Run the dev server

```bash
npm run dev
```

`npm run dev` auto-detects unsupported older macOS versions (for Cloudflare's local worker runtime) and falls back to `frontend-only` mode. In that mode it **also starts `wrangler dev` on port 8787** so `/api/*` (favorites, notifications, clips) works — Vite proxies those requests to the worker.

If you see **`TypeError: Failed to fetch`** in the console for `/api/notifications` or saving favorite artists, the API worker is not running. Restart with `npm run dev`, or in a second terminal run `npm run dev:api` while Vite is up.

First time on a fresh clone, apply local D1 migrations:

```bash
npm run db:migrate:local
```

If you are on macOS `13.5+` (or Linux) and want full local worker emulation inside Vite, run:

```bash
npm run dev:worker
```

## DevContainer (Linux/glibc 2.35+) setup

For full local Cloudflare runtime parity (D1/DO/R2) use the included DevContainer docs:

- `.devcontainer/README.md`

