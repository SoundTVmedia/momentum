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

`npm run dev` auto-detects unsupported older macOS versions (for Cloudflare's local worker runtime) and falls back to `frontend-only` mode so the React app still runs.

If you are on macOS `13.5+` (or Linux) and want full local worker emulation, run:

```bash
npm run dev:worker
```

## DevContainer (Linux/glibc 2.35+) setup

For full local Cloudflare runtime parity (D1/DO/R2) use the included DevContainer docs:

- `.devcontainer/README.md`

