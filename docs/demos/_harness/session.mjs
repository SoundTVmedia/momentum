import { chromium, devices } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { installDemoOverlay } from './overlay-install.mjs';
import { installDemoMocks, createDemoState, newClip } from './mock-api.mjs';

const harnessRoot = path.dirname(fileURLToPath(import.meta.url));
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const iPhone = devices['iPhone 14 Pro'];

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${code}`))));
  });
}

export async function ensureCameraFiles(live, assetsDir) {
  await mkdir(assetsDir, { recursive: true });
  const mp4 = path.join(assetsDir, 'concert-clip.mp4');
  const y4m = path.join(assetsDir, 'camera.y4m');
  const wav = path.join(assetsDir, 'camera.wav');
  try {
    await access(mp4);
    await access(y4m);
    await access(wav);
    return { mp4, y4m, wav };
  } catch {
    /* generate */
  }

  if (!live.cameraVideoUrl) throw new Error('No live clip URL for camera preview');
  console.log('downloading concert clip', live.cameraVideoUrl);
  const res = await fetch(live.cameraVideoUrl);
  if (!res.ok) throw new Error(`clip download ${res.status}`);
  await writeFile(mp4, Buffer.from(await res.arrayBuffer()));

  await run('ffmpeg', [
    '-y',
    '-i',
    mp4,
    '-t',
    '8',
    '-an',
    '-vf',
    'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    y4m,
  ]);
  await run('ffmpeg', [
    '-y',
    '-i',
    mp4,
    '-t',
    '8',
    '-vn',
    '-ac',
    '1',
    '-ar',
    '44100',
    wav,
  ]);
  return { mp4, y4m, wav };
}

export async function stampLibraryClip(srcMp4, destMp4, show) {
  const raw = String(show?.startDate || '2026-07-27T23:00:00');
  const iso = raw.includes('T') ? `${raw.replace(/Z$/, '')}Z` : `${raw}T23:00:00Z`;
  const lat = Number(show?.geo?.latitude ?? 40.7505);
  const lon = Number(show?.geo?.longitude ?? -73.9934);
  const loc = `${lat >= 0 ? '+' : ''}${lat.toFixed(4)}${lon >= 0 ? '+' : ''}${lon.toFixed(4)}/`;
  const comment = `creation_time=${iso} com.apple.quicktime.location.ISO6709=${loc}`;
  await run('ffmpeg', [
    '-y',
    '-i',
    srcMp4,
    '-t',
    '6',
    '-an',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-metadata',
    `creation_time=${iso}`,
    '-metadata',
    `comment=${comment}`,
    destMp4,
  ]);
  return destMp4;
}

export async function openDemoApp({ live, y4m, wav }) {
  const state = createDemoState(live);
  const geo = live.tonight.geo;
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--disable-gpu',
      '--hide-scrollbars',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${y4m}`,
      `--use-file-for-fake-audio-capture=${wav}`,
    ],
  });
  const context = await browser.newContext({
    ...iPhone,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    geolocation: {
      latitude: geo.latitude,
      longitude: geo.longitude,
      accuracy: 12,
    },
    permissions: ['geolocation', 'camera', 'microphone'],
    locale: 'en-US',
    colorScheme: 'dark',
  });
  await context.grantPermissions(['geolocation', 'camera', 'microphone'], {
    origin: live.origin,
  });
  await context.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    const hideSplash = () => document.getElementById('app-splash')?.remove();
    hideSplash();
    document.addEventListener('DOMContentLoaded', hideSplash);
  });

  const page = await context.newPage();
  page.on('pageerror', (err) => console.warn('pageerror', err.message));
  await installDemoMocks(page, state);
  page.setDefaultTimeout(20_000);
  await page.goto(`${live.origin}/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.evaluate(installDemoOverlay);
  await page.evaluate(() => document.getElementById('app-splash')?.remove());
  await page.waitForFunction(() => typeof window.__demoCallout === 'function');
  await page.waitForSelector('text=FEED', { timeout: 20_000 });
  await page.waitForTimeout(800);
  return { browser, context, page, state };
}

export async function ensureOverlay(page) {
  const ready = await page.evaluate(() => typeof window.__demoCallout === 'function');
  if (ready) return;
  await page.evaluate(installDemoOverlay);
  await page.waitForFunction(() => typeof window.__demoCallout === 'function');
}

export async function callout(page, text) {
  await ensureOverlay(page);
  await page.evaluate((value) => window.__demoCallout(value), text || '');
}

export async function tap(page, locator) {
  const handle = typeof locator === 'string' ? page.locator(locator).first() : locator;
  await handle.waitFor({ state: 'visible', timeout: 15_000 });
  const box = await handle.boundingBox();
  if (!box) {
    await handle.click();
    return;
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await ensureOverlay(page);
  await page.evaluate(({ x: fx, y: fy }) => window.__demoFingerShow(fx, fy), { x, y });
  await page.waitForTimeout(260);
  await page.evaluate(() => window.__demoFingerDown());
  await page.mouse.click(x, y);
  await page.waitForTimeout(140);
  await page.evaluate(() => window.__demoFingerUp());
  await page.waitForTimeout(80);
  await page.evaluate(() => window.__demoFingerHide());
}

export async function typeInto(page, locator, text) {
  const handle = typeof locator === 'string' ? page.locator(locator).first() : locator;
  await handle.waitFor({ state: 'visible' });
  await tap(page, handle);
  await handle.fill('');
  await handle.pressSequentially(text, { delay: 40 });
}

export async function waitHomeReady(page) {
  await page.locator('ion-tab-button.app-tab-capture, ion-tab-button[tab="capture"]').first().waitFor({
    state: 'visible',
    timeout: 20_000,
  });
  await page.waitForTimeout(500);
}

export function captureButton(page) {
  return page.locator('ion-tab-button.app-tab-capture, ion-tab-button[tab="capture"]').first();
}

export function markInjectedClip(state, show) {
  state.injectClip = newClip(state.live, show);
}

export { newClip };
