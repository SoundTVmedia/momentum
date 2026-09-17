import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = urlPath === '/' ? '/index.html' : urlPath;
  try {
    const buf = await readFile(path.join(root, file));
    const ext = path.extname(file);
    res.writeHead(200, { 'content-type': mime[ext] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;
console.log('serving', origin);

const framesDir = path.join(root, 'frames');
await rm(framesDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
});
await page.goto(origin + '/', { waitUntil: 'load', timeout: 20_000 });
await page.waitForFunction(() => window.__demoReady === true, null, { timeout: 10_000 });
console.log('screencast start');

const client = await page.context().newCDPSession(page);
let n = 0;
const writes = [];
client.on('Page.screencastFrame', async (frame) => {
  try {
    await client.send('Page.screencastFrameAck', { sessionId: frame.sessionId });
  } catch {
    return;
  }
  const idx = n;
  n += 1;
  writes.push(
    writeFile(path.join(framesDir, `${String(idx).padStart(4, '0')}.jpg`), Buffer.from(frame.data, 'base64')),
  );
});
const started = Date.now();
await client.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 82,
  maxWidth: 1170,
  maxHeight: 2532,
  everyNthFrame: 1,
});

await page.waitForFunction(() => window.__demoDone === true, null, { timeout: 90_000 });
await page.waitForTimeout(400);
await client.send('Page.stopScreencast');
await Promise.all(writes);
const elapsed = (Date.now() - started) / 1000;
const fps = Math.max(8, Math.min(30, n / elapsed));
console.log(`captured ${n} frames in ${elapsed.toFixed(2)}s → ${fps.toFixed(2)} fps`);

await browser.close();
server.close();

if (n < 10) throw new Error('too few frames');

const outMp4 = path.join(root, 'find-a-show-ios-demo.mp4');
console.log('encoding', outMp4);
await new Promise((resolve, reject) => {
  const ff = spawn(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      fps.toFixed(3),
      '-i',
      path.join(framesDir, '%04d.jpg'),
      '-vf',
      'scale=1080:1920:flags=lanczos:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '18',
      '-movflags',
      '+faststart',
      outMp4,
    ],
    { stdio: 'inherit' },
  );
  ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
});
console.log('done', outMp4);
