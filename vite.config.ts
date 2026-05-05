import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { mochaPlugins } from "@getmocha/vite-plugins";

const isLinux = process.platform === "linux";
const enableCloudflareByEnv = process.env.ENABLE_CLOUDFLARE_VITE === "1";
const shouldEnableCloudflarePlugin = isLinux || enableCloudflareByEnv;

/**
 * Without the Cloudflare Vite plugin, the React dev server has no Worker — `/api/*` would
 * return HTML and JSON parsers throw "Unexpected token '<'".
 * Proxy to wrangler dev (run `npm run dev:api` in another terminal, default port 8787).
 */
const WRANGLER_DEV_DEFAULT = "http://127.0.0.1:8787";
const viteDisableApiProxy = process.env.VITE_DISABLE_API_PROXY === "1";
const apiProxyTarget =
  !shouldEnableCloudflarePlugin && !viteDisableApiProxy
    ? process.env.VITE_API_PROXY_TARGET || WRANGLER_DEV_DEFAULT
    : undefined;

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [
    ...mochaPlugins(process.env as any),
    react(),
    ...(shouldEnableCloudflarePlugin
      ? [
          cloudflare({
            // Same wrangler.json as `wrangler dev` / `wrangler d1 ... --local` (smooth path to prod D1).
            configPath: path.resolve(__dirname, "wrangler.json"),
            // Pin persistence so Vite + Wrangler CLI share one local SQLite (default is `.wrangler/state`).
            persistState: { path: path.resolve(__dirname, ".wrangler/state") },
            // Default true: can bind D1 remotely while migrations apply to local DB — list/delete then disagree.
            remoteBindings: false,
          }),
        ]
      : []),
  ],
  server: {
    allowedHosts: true,
    ...(process.env.VITE_DEV_SERVER_HOST
      ? { host: process.env.VITE_DEV_SERVER_HOST }
      : {}),
    ...(apiProxyTarget
      ? {
          proxy: {
            "/api": {
              target: apiProxyTarget,
              changeOrigin: true,
              secure: false,
            },
            "/realtime": {
              target: apiProxyTarget,
              changeOrigin: true,
              secure: false,
              ws: true,
            },
          },
        }
      : {}),
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
