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

if (!supportsCloudflareRuntime) {
  console.log(
    forceFrontendOnly
      ? "FORCE_FRONTEND_ONLY_DEV=1 detected; starting frontend-only mode."
      : "Detected macOS < 13.5; starting frontend-only mode (Cloudflare runtime disabled).",
  );
  console.log(
    "Use `npm run dev:worker` on macOS 13.5+ or Linux for full worker emulation.",
  );
}

const child = spawn("vite", viteArgs, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
