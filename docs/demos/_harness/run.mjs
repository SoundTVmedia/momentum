import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLiveDemoData } from './live-data.mjs';
import { ensureCameraFiles, openDemoApp, stampLibraryClip } from './session.mjs';
import { recordScreencast } from './record.mjs';
import { runQuickRecord, runPersonalizedFeed, runFindAShow, runProfile } from './flows.mjs';

const harnessRoot = path.dirname(fileURLToPath(import.meta.url));
const demosRoot = path.resolve(harnessRoot, '..');
const repoRoot = path.resolve(harnessRoot, '../../..');

const FLOWS = {
  'quickrecord-ios': {
    run: runQuickRecord,
    file: 'quickrecord-ios-demo.mp4',
  },
  'personalized-feed-ios': {
    run: runPersonalizedFeed,
    file: 'personalized-feed-ios-demo.mp4',
  },
  'find-a-show-ios': {
    run: runFindAShow,
    file: 'find-a-show-ios-demo.mp4',
  },
  'profile-ios': {
    run: runProfile,
    file: 'profile-ios-demo.mp4',
  },
};

export async function runDemo(id) {
  const spec = FLOWS[id];
  if (!spec) throw new Error(`unknown demo ${id}`);

  console.log('loading live JamBase + clip data…');
  const live = await loadLiveDemoData();
  console.log('tonight', live.tonight.name, live.tonight.startDate);
  console.log('artist', live.artist.name);
  console.log('past', live.pastEvent?.name, live.pastEvent?.identifier);

  if (id === 'quickrecord-ios') live.preferRecordNight = true;
  const assetsDir = path.join(harnessRoot, 'assets');
  const files = await ensureCameraFiles(
    id === 'quickrecord-ios' ? live : { ...live, recordNight: null },
    assetsDir,
  );
  const libraryMp4 = path.join(assetsDir, 'library.mp4');
  await stampLibraryClip(files.mp4, libraryMp4, {
    startDate: live.pastEvent?.startDate,
    geo: live.venue?.geo || live.pastEvent?.geo,
  });
  const { browser, page, state } = await openDemoApp({
    live,
    y4m: files.y4m,
    wav: files.wav,
  });
  state.libraryVideoPath = libraryMp4;

  const demoDir = path.join(demosRoot, id);
  const publicDir = path.join(repoRoot, 'public/demos', id);
  const recorder = await recordScreencast(page, {
    framesDir: path.join(demoDir, 'frames'),
    outMp4: path.join(demoDir, spec.file),
    posterPath: path.join(demoDir, 'poster.png'),
    publicMp4: path.join(publicDir, spec.file),
    publicPoster: path.join(publicDir, 'poster.png'),
    slow: id === 'quickrecord-ios' ? 1.35 : 1,
  });

  let flowError = null;
  try {
    await spec.run(page, state);
  } catch (err) {
    flowError = err;
    const failShot = path.join(demoDir, 'failure.png');
    await page.screenshot({ path: failShot, fullPage: false }).catch(() => {});
    console.error('flow failed', err);
    console.error('screenshot', failShot);
  }

  const result = await recorder.stop();
  await browser.close();
  console.log('done', result.outMp4);
  if (flowError) throw flowError;
  return result;
}

const isMain =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const requested = process.argv.slice(2);
  const ids = requested.length ? requested : Object.keys(FLOWS);
  for (const id of ids) {
    await runDemo(id);
  }
}
