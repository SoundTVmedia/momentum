#!/usr/bin/env node
/**
 * Fail the sync when webDir has no entry point. `cap sync` copies webDir as-is and exits 0
 * even with no index.html, so a Cloudflare-layout build (`dist/client/index.html`) produces
 * an iOS bundle that loads a blank page. That stays hidden while capacitor.config.ts sets
 * `server.url`, then ships broken in the first archive built without it.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const capacitorConfig = fs.readFileSync(path.join(root, 'capacitor.config.ts'), 'utf8');
const webDir = capacitorConfig.match(/webDir:\s*['"]([^'"]+)['"]/)?.[1];

if (!webDir) {
  console.error('[cap:sync] Could not read webDir from capacitor.config.ts.');
  process.exit(1);
}

const webDirPath = path.join(root, webDir);
if (fs.existsSync(path.join(webDirPath, 'index.html'))) {
  process.exit(0);
}

console.error(`[cap:sync] ${webDir}/index.html is missing — refusing to sync a bundle that cannot boot.`);

if (fs.existsSync(path.join(webDirPath, 'client', 'index.html'))) {
  console.error(
    `[cap:sync] ${webDir}/ holds a Cloudflare Worker build (${webDir}/client/index.html). Rebuild with: npm run build:app`,
  );
} else {
  console.error('[cap:sync] Build the native web bundle first: npm run build:app');
}

process.exit(1);
