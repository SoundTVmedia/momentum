## MOMENTUM - Where Live Music Lives Online

This app was created using https://getmocha.com.
Need help or want to join the community? Join our [Discord](https://discord.gg/shDEGBSe2d).

To run the devserver:
```
npm install
npm run dev
```

## DevContainer (Linux/glibc 2.35+) setup

This repo includes a DevContainer that runs on Debian Bookworm (glibc newer than 2.35), plus local `postgres` and `pgAdmin` services.

### 1) Start the DevContainer

1. Open this repo in Cursor/VS Code.
2. Run `Dev Containers: Reopen in Container`.
3. Wait for `postCreateCommand` to finish (`npm install` inside the container).

### 2) Run the app safely for local Durable Objects

Use local development mode so Durable Objects and D1 stay local to your machine:

```bash
npm run dev
```

Important safety notes:

- Do not use `wrangler dev --remote` for local-only testing.
- Keep local values in `.dev.vars` and do not copy production secrets into local files.
- Deploys (`wrangler deploy`) are the action that affects remote environments.

### 3) Local Postgres + pgAdmin

The DevContainer Compose stack includes:

- Postgres: `localhost:5432`
- pgAdmin: `http://localhost:5050`
- pgAdmin login: `dev@momentum.local` / `devpassword`

When adding a server in pgAdmin:

- Host: `postgres`
- Port: `5432`
- Username: `postgres`
- Password: `postgres`
- Database: `momentum`

### 4) Database connection string

Inside the container:

```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/momentum
```

From your host machine (outside container):

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/momentum
```
