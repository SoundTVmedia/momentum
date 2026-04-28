import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { mochaPlugins } from "@getmocha/vite-plugins";

const debugEndpoint = "http://127.0.0.1:7865/ingest/61fbf47c-8376-4796-b066-70be46d298e3";
const debugSessionId = "3caef0";
const debugRunId = `vite-config-${Date.now()}`;

// #region agent log
fetch(debugEndpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": debugSessionId,
  },
  body: JSON.stringify({
    sessionId: debugSessionId,
    runId: debugRunId,
    hypothesisId: "H1",
    location: "vite.config.ts:10",
    message: "Vite config runtime context",
    data: {
      platform: process.platform,
      nodeVersion: process.version,
      cwd: process.cwd(),
      enableCloudflareEnv: process.env.ENABLE_CLOUDFLARE_VITE ?? null,
      inContainerByDockerenv: process.platform === "linux",
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

// #region agent log
fetch(debugEndpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": debugSessionId,
  },
  body: JSON.stringify({
    sessionId: debugSessionId,
    runId: debugRunId,
    hypothesisId: "H2",
    location: "vite.config.ts:39",
    message: "Cloudflare vite plugin is currently unconditional",
    data: {
      cloudflarePluginConfigured: true,
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

const isLinux = process.platform === "linux";
const isMac = process.platform === "darwin";
const macVersionHint = process.env.MACOS_VERSION ?? null;
const enableCloudflareByEnv = process.env.ENABLE_CLOUDFLARE_VITE === "1";
const shouldEnableCloudflarePlugin = isLinux || enableCloudflareByEnv;

// #region agent log
fetch(debugEndpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": debugSessionId,
  },
  body: JSON.stringify({
    sessionId: debugSessionId,
    runId: debugRunId,
    hypothesisId: "H3",
    location: "vite.config.ts:45",
    message: "Cloudflare plugin gating decision",
    data: {
      isLinux,
      isMac,
      macVersionHint,
      enableCloudflareByEnv,
      shouldEnableCloudflarePlugin,
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [
    ...mochaPlugins(process.env as any),
    react(),
    ...(shouldEnableCloudflarePlugin ? [cloudflare()] : []),
  ],
  server: {
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 5000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
