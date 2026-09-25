import path from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { copyFile } from 'node:fs/promises';

export async function recordScreencast(page, { framesDir, outMp4, posterPath, publicMp4, publicPoster, slow = 1 }) {
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

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
    quality: 84,
    maxWidth: 1170,
    maxHeight: 2532,
    everyNthFrame: 2,
  });

  return {
    async stop() {
      await page.waitForTimeout(350);
      await client.send('Page.stopScreencast');
      await Promise.all(writes);
      const elapsed = (Date.now() - started) / 1000;
      const fps = Math.max(8, Math.min(30, n / Math.max(elapsed, 0.5)));
      console.log(`captured ${n} frames in ${elapsed.toFixed(2)}s → ${fps.toFixed(2)} fps`);
      if (n < 10) throw new Error('too few frames');

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
            `${slow > 1 ? `setpts=${slow}*PTS,` : ''}scale=1080:1920:flags=lanczos:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2`,
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

      const posterAt = Math.min(0.2, Math.max(0, elapsed * 0.12));
      await new Promise((resolve, reject) => {
        const ff = spawn(
          'ffmpeg',
          ['-y', '-ss', String(posterAt), '-i', outMp4, '-frames:v', '1', '-update', '1', posterPath],
          { stdio: 'inherit' },
        );
        ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`poster ${code}`))));
      });

      if (publicMp4) {
        await mkdir(path.dirname(publicMp4), { recursive: true });
        await copyFile(outMp4, publicMp4);
      }
      if (publicPoster) {
        try {
          await mkdir(path.dirname(publicPoster), { recursive: true });
          await copyFile(posterPath, publicPoster);
        } catch (err) {
          console.warn('poster copy skipped', err.message);
        }
      }

      return { frames: n, elapsed, fps, outMp4, posterPath };
    },
  };
}
