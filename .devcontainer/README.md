# Momentum — Dev Container (Linux)

Use this when **local Wrangler fails on macOS &lt; 13.5** (`workerd` needs Linux or macOS 13.5+). Inside the container you get a supported glibc + Node environment so **`npm run dev:api`** and **`npm run dev`** work.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose)
- **Cursor** or **VS Code** with the [**Dev Containers**](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension

## Open the project in the container

1. Clone the repo on your Mac and open the folder in Cursor/VS Code.
2. **Command Palette** → `Dev Containers: Reopen in Container` (or **Reopen in Container** from the notification when the folder contains `.devcontainer/`).
3. Wait for the image build and **post-create** (`npm install` + `npm run build`). First time can take several minutes.

Ports **5173** (Vite), **8787** (Wrangler if you use it), **5432** (Postgres), and **5050** (pgAdmin) are forwarded to your Mac automatically.

## Worker secrets (`.dev.vars`)

The repo root is mounted at `/workspace`. Put secrets in **`.dev.vars`** (same as on the host — copy from `.dev.vars.example`). For **Google OAuth via Mocha**, set **`MOCHA_USERS_SERVICE_API_URL`** and **`MOCHA_USERS_SERVICE_API_KEY`**. For **email/password sign-in only**, those can be empty once **local D1** has the auth tables (migrations).

## Cloudflare CLI (first time)

```bash
cd /workspace
npx wrangler login
```

## D1 (local database inside the dev environment)

```bash
cd /workspace
npm run db:migrate:local
```

(`db:migrate:local` runs `wrangler d1 migrations apply momentum-db --local`.) The dev container **post-create** already applies migrations once; run the command again after pulling new migration files. Use the D1 **database_name** from `wrangler.json` if yours differs. For **remote** D1 (deployed), use `npm run db:migrate:remote` after `wrangler login`.

## Run the app

Inside the container you are on **Linux**, so Vite enables the **@cloudflare/vite-plugin** and runs the **Worker and UI together** (no separate `workerd` macOS requirement):

```bash
cd /workspace
npm run dev
```

Open the **“Vite (app UI)”** forwarded port (usually `http://localhost:5173`).

**Optional:** To run **Wrangler’s dev server alone** (e.g. comparing behavior), use `npm run dev:api` in a terminal. Avoid also running `npm run dev` at the same time unless you know you need both — the Vite+Cloudflare setup already serves the Worker.

## Postgres + pgAdmin (optional)

These match `docker-compose.yml`: Postgres on **`localhost:5432`**, pgAdmin on **`http://localhost:5050`**. The main app API still uses **D1** via Wrangler, not `DATABASE_URL`, unless you change the code.

## Troubleshooting

- **`ECONNREFUSED 127.0.0.1:8787` from Vite** — That means Vite is using the **macOS/Windows path** (API **proxy** to Wrangler) instead of the **embedded Worker**. Fix:
  1. Confirm the window is **Remote — Dev Container** (or **Dev Container: momentum-devcontainer**), not a normal local folder window.
  2. Open a **new terminal in that remote window** (not your Mac’s default local terminal) and run `npm run dev` from `/workspace`.
  3. The dev container sets **`ENABLE_CLOUDFLARE_VITE=1`** so Vite loads the Cloudflare plugin and **does not** proxy `/api` to 8787. Rebuild the container (**Dev Containers: Rebuild Container**) after pulling if it still proxies.

- **`workerd` / Wrangler errors on the Mac** — Use the dev container; do not rely on `wrangler dev` on macOS &lt; 13.5.

- **Stale `node_modules`** — Rebuild the container or run `rm -rf node_modules && npm install` in `/workspace`.

- **Port already in use on the host** — Stop another service using the same port, or change `forwardPorts` / compose port mappings.
