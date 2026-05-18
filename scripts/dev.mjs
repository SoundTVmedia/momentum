import { spawn } from "node:child_process";
import os from "node:os";

const [major, minor] = os
  .release()
  .split(".")
  .map((value) => Number.parseInt(value, 10));

const isMac = process.platform === "darwin";
const forceFrontendOnly = process.env.FORCE_FRONTEND_ONLY_DEV === "1";
const supportsCloudflareRuntime =
  !forceFrontendOnly &&
  (!isMac ||
    Number.isNaN(major) ||
    Number.isNaN(minor) ||
    major > 22 ||
    (major === 22 && minor >= 6));

const viteArgs = supportsCloudflareRuntime ? [] : ["--mode", "frontend-only"];
const WRANGLER_PORT = process.env.WRANGLER_DEV_PORT || "8787";

/** @type {import('node:child_process').ChildProcess | null} */
let apiChild = null;

if (!supportsCloudflareRuntime) {
  console.log(
    forceFrontendOnly
      ? "FORCE_FRONTEND_ONLY_DEV=1 detected; starting frontend-only mode."
      : "Detected macOS < 13.5; starting frontend-only mode (Cloudflare runtime disabled in Vite).",
  );
  console.log(
    `Starting API worker on http://127.0.0.1:${WRANGLER_PORT} (Vite proxies /api → worker).`,
  );
  console.log(
    "First time? Run `npm run db:migrate:local` if favorites or profile saves fail with SQL errors.",
  );

  apiChild = spawn("npx", ["wrangler", "dev", "--port", WRANGLER_PORT], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  apiChild.on("error", (err) => {
    console.error("Failed to start wrangler dev:", err);
    console.error("Start the API manually: npm run dev:api");
  });
}

const viteChild = spawn("vite", viteArgs, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

function shutdown(signal) {
  if (apiChild && !apiChild.killed) {
    apiChild.kill("SIGTERM");
  }
  if (viteChild && !viteChild.killed) {
    viteChild.kill(signal ?? "SIGTERM");
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

viteChild.on("exit", (code, signal) => {
  shutdown();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
