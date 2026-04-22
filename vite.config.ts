import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { mochaPlugins } from "@getmocha/vite-plugins";

export default defineConfig(({ mode }) => {
  const enableCloudflareRuntime = mode !== "frontend-only";

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugins: [
      ...mochaPlugins(process.env as any),
      react(),
      ...(enableCloudflareRuntime ? [cloudflare()] : []),
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
  };
});
