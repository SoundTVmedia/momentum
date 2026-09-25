import { chromium, devices } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
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

const CAMERA_SCALE =
  'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280';

async function downloadClip(url, dest) {
  console.log('downloading concert clip', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`clip download ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

export async function ensureCameraFiles(live, assetsDir) {
  await mkdir(assetsDir, { recursive: true });
  const mp4 = path.join(assetsDir, 'concert-clip.mp4');
  const y4m = path.join(assetsDir, 'camera.y4m');
  const wav = path.join(assetsDir, 'camera.wav');
  const markerPath = path.join(assetsDir, 'camera-source.txt');
  const sources = (live.recordNight?.clips || [])
    .map((clip) => clip.video_url)
    .filter(Boolean)
    .slice(0, 2);
  const sourceKey = (sources.length ? sources : [live.cameraVideoUrl]).filter(Boolean).join('\n');
  let cached = '';
  try {
    cached = await readFile(markerPath, 'utf8');
  } catch {
    cached = '';
  }
  if (cached === sourceKey && sourceKey) {
    try {
      await access(y4m);
      await access(wav);
      return { mp4, y4m, wav };
    } catch {
      /* regenerate */
    }
  }

  if (!sourceKey) throw new Error('No live clip URL for camera preview');
  const urls = sourceKey.split('\n');
  // First segment stays on screen through the opening take; the second clip
  // starts in time for the follow-up recording.
  const durations = urls.length > 1 ? [18, 12] : [8];
  const segments = [];
  const audioParts = [];
  for (let i = 0; i < urls.length; i += 1) {
    const src = path.join(assetsDir, `camera-src-${i}.mp4`);
    const seg = path.join(assetsDir, `camera-seg-${i}.y4m`);
    const audio = path.join(assetsDir, `camera-seg-${i}.wav`);
    await downloadClip(urls[i], src);
    if (i === 0) await writeFile(mp4, await readFile(src));
    await run('ffmpeg', [
      '-y',
      '-stream_loop',
      '-1',
      '-i',
      src,
      '-t',
      String(durations[i] || 8),
      '-an',
      '-vf',
      CAMERA_SCALE,
      '-pix_fmt',
      'yuv420p',
      '-r',
      '30',
      seg,
    ]);
    await run('ffmpeg', [
      '-y',
      '-stream_loop',
      '-1',
      '-i',
      src,
      '-t',
      String(durations[i] || 8),
      '-vn',
      '-ac',
      '1',
      '-ar',
      '44100',
      audio,
    ]);
    segments.push(seg);
    audioParts.push(audio);
  }

  if (segments.length === 1) {
    await run('ffmpeg', ['-y', '-i', segments[0], '-c', 'copy', y4m]);
    await run('ffmpeg', ['-y', '-i', audioParts[0], '-c', 'copy', wav]);
  } else {
    const videoList = path.join(assetsDir, 'camera-video.txt');
    const audioList = path.join(assetsDir, 'camera-audio.txt');
    await writeFile(videoList, segments.map((file) => `file '${file}'`).join('\n'));
    await writeFile(audioList, audioParts.map((file) => `file '${file}'`).join('\n'));
    await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', videoList, '-c', 'copy', y4m]);
    await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', audioList, '-c', 'copy', wav]);
  }
  await writeFile(markerPath, sourceKey);
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
  const geo =
    (live.preferRecordNight && live.recordNight?.geo) || live.tonight.geo;
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
    timezoneId: live.preferRecordNight ? 'America/New_York' : undefined,
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

export function markRecordedClips(state, show) {
  const sources = state.live.recordNight?.clips || [];
  state.recordedClips = (sources.length ? sources : [state.live.clips.camera]).filter(Boolean).map(
    (src, index) => newClip(state.live, show, src, 900001 + index),
  );
  state.injectClip = state.recordedClips[0] || null;
  state.holdUploads = true;
}

export { newClip };
