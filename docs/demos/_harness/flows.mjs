import { callout, tap, typeInto, waitHomeReady, markInjectedClip, markRecordedClips, captureButton } from './session.mjs';

async function waitCameraHudReady(page, show) {
  const tapToStart = page.getByRole('button', { name: /Tap to start camera preview/i });
  if (await tapToStart.isVisible().catch(() => false)) {
    await tap(page, tapToStart);
  }
  await page.getByText(show.name, { exact: false }).first().waitFor({ timeout: 18_000 });
  await page
    .waitForFunction(
      () => {
        const video = document.querySelector('.native-capture-preview video');
        const btn = document.querySelector(
          '[title="Start capturing your moment (up to 60 seconds)"]',
        );
        const videoOk = Boolean(video && video.readyState >= 2 && video.videoWidth > 0);
        const btnOk = btn instanceof HTMLButtonElement && !btn.disabled;
        return videoOk && btnOk;
      },
      { timeout: 20_000 },
    )
    .catch(() => {});
}

async function recordOneTake(page, label) {
  const captureBtn = page.getByTitle('Start capturing your moment (up to 60 seconds)');
  await captureBtn.waitFor({ state: 'visible' });
  await tap(page, captureBtn);
  await callout(page, label);
  await page.waitForSelector('text=REC', { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(3200);
  const stopBtn = page.getByTitle('Stop recording and save your moment');
  if (await stopBtn.isVisible().catch(() => false)) {
    await tap(page, stopBtn);
  }
  await page.waitForTimeout(900);
}

export async function runQuickRecord(page, state) {
  const live = state.live;
  const show = live.recordNight;
  if (!show?.href) throw new Error('No record-night show for the quick record demo');
  markRecordedClips(state, show);
  await waitHomeReady(page);
  await callout(page, 'Quick Record on iOS');
  await page.waitForTimeout(2200);

  await tap(page, captureButton(page));
  const continueBtn = page.getByRole('button', { name: 'Continue' });
  if (await continueBtn.isVisible().catch(() => false)) {
    await callout(page, 'Location and camera');
    await page.waitForTimeout(700);
    await tap(page, continueBtn);
  }

  await callout(page, 'Matching the show from GPS');
  await waitCameraHudReady(page, show);
  await page.waitForTimeout(1400);
  await callout(page, `${show.artistName} at ${show.venueName}`);
  await page.waitForTimeout(2600);

  await recordOneTake(page, 'Recording the clip');
  const resumePreview = page.getByRole('button', { name: /Tap to resume camera/i });
  if (await resumePreview.isVisible().catch(() => false)) {
    await tap(page, resumePreview);
  }
  const queueLine = page.getByText(/1 in queue/);
  await queueLine.waitFor({ state: 'visible', timeout: 12_000 });
  await callout(page, '');
  await page.waitForTimeout(2600);
  await recordOneTake(page, 'Second clip, same show');
  await callout(page, 'Both clips upload in the background');
  await page.waitForTimeout(2000);

  const closeBtn = page.locator('.native-capture-modal button', { hasText: '✕' }).first();
  if (await closeBtn.isVisible().catch(() => false)) {
    await tap(page, closeBtn);
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(600);

  await tap(page, page.locator('ion-tab-button[tab="queue"]').first());
  await page.getByRole('heading', { name: 'Upload Queue' }).waitFor({ timeout: 12_000 });
  await page.getByText(/Uploading|Finishing upload|Processing|Identifying/i).first().waitFor({
    timeout: 12_000,
  }).catch(() => {});
  await callout(page, 'Upload queue');
  await page.waitForTimeout(4000);
  state.holdUploads = false;

  await page.goto(`${live.origin}/artists/phish`, { waitUntil: 'domcontentloaded' });
  await callout(page, 'Phish');
  await page.getByRole('heading', { name: 'Past Shows' }).waitFor({ timeout: 15_000 });
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll('h2')].find((el) =>
      /Past Shows/i.test(el.textContent || ''),
    );
    if (!heading) return;
    const header = document.querySelector('ion-header, header');
    const headerBottom = header ? header.getBoundingClientRect().bottom : 88;
    const y = heading.getBoundingClientRect().top + window.scrollY - headerBottom - 12;
    window.scrollTo({ top: Math.max(0, y) });
  });
  await page.waitForTimeout(900);
  await callout(page, 'Past shows');
  await page.waitForTimeout(2400);

  const showCard = page.locator('article').filter({ hasText: /Jul 25, 2026/ }).first();
  await showCard.waitFor({ state: 'visible', timeout: 12_000 });
  await showCard.scrollIntoViewIfNeeded();
  await tap(page, showCard.getByRole('button', { name: 'View Show Clips' }));
  await page.waitForURL(/\/shows\/.*\/clips/, { timeout: 15_000 });
  const recorded = page.locator('.glass-panel').filter({ hasText: 'Recorded live' }).first();
  await recorded.waitFor({ state: 'visible', timeout: 15_000 });
  await recorded.evaluate((el) => {
    const header = document.querySelector('ion-header, header');
    const headerBottom = header ? header.getBoundingClientRect().bottom : 88;
    const y = el.getBoundingClientRect().top + window.scrollY - headerBottom - 16;
    window.scrollTo({ top: Math.max(0, y) });
  });
  await page.waitForTimeout(500);
  await callout(page, 'Clips from the show');
  await page.waitForTimeout(2600);

  await tap(page, recorded);
  await page.locator('.glass-modal-overlay').waitFor({ timeout: 12_000 });
  await callout(page, 'Clip player');
  await page.waitForTimeout(4000);
  await callout(page, '');
}

async function scrollFollowModuleIntoView(page) {
  await page.evaluate(() => {
    const section = document.getElementById('favorite-artist-clips');
    if (!section) return;
    const header = document.querySelector('ion-header, header');
    const headerBottom = header ? header.getBoundingClientRect().bottom : 88;
    const y = section.getBoundingClientRect().top + window.scrollY - headerBottom - 8;
    window.scrollTo({ top: Math.max(0, y) });
  });
  await page.waitForTimeout(280);
}

async function keepLocatorAboveTabBar(page, locator) {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) return;
  const tab = await page.locator('ion-tab-bar').first().boundingBox().catch(() => null);
  const reserve = (tab?.height ?? 84) + 16;
  const overflow = box.y + box.height - (viewport.height - reserve);
  if (overflow > 0) {
    await page.evaluate((delta) => window.scrollBy(0, delta), overflow);
    await page.waitForTimeout(200);
  }
}

async function openFollowSearch(page) {
  await page.keyboard.press('Escape').catch(() => {});
  const search = page.getByPlaceholder('Search artists, friends, venues, songs, or shows');
  if (await search.isVisible().catch(() => false)) {
    await scrollFollowModuleIntoView(page);
    return search;
  }

  const followBtn = page.getByRole('button', {
    name: /Follow artists, friends, venues, songs, or shows/i,
  });
  await followBtn.scrollIntoViewIfNeeded();
  await tap(page, followBtn);
  try {
    await search.waitFor({ state: 'visible', timeout: 8_000 });
  } catch {
    await tap(page, followBtn);
    await search.waitFor({ state: 'visible', timeout: 8_000 });
  }
  await scrollFollowModuleIntoView(page);
  return search;
}

async function followSearchHit(page, search, query, name, label) {
  await typeInto(page, search, query);
  await page.getByText('Searching…').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(350);
  const hit = page
    .locator('button')
    .filter({ hasText: name })
    .filter({ hasText: /Follow|Unfollow/ })
    .first();
  await hit.waitFor({ state: 'visible', timeout: 8_000 });
  await scrollFollowModuleIntoView(page);
  await keepLocatorAboveTabBar(page, hit);
  await callout(page, label);
  await tap(page, hit);
  await page.waitForTimeout(700);
}

export async function runPersonalizedFeed(page, state) {
  const live = state.live;
  await waitHomeReady(page);
  await callout(page, 'Personalized feed on iOS');
  await page.waitForTimeout(1400);

  const followBtn = page.getByRole('button', {
    name: /Follow artists, friends, venues, songs, or shows/i,
  });
  await followBtn.scrollIntoViewIfNeeded();
  await tap(page, followBtn);
  await callout(page, 'Open Follow to search');
  const search = await openFollowSearch(page);
  await scrollFollowModuleIntoView(page);
  await page.waitForTimeout(700);

  await followSearchHit(page, search, live.artist.name, live.artist.name, 'Search an artist');
  await callout(page, 'Tap the artist to follow');
  await page.waitForTimeout(900);

  await followSearchHit(page, search, live.venue.name, live.venue.name, 'Same flow for a venue');
  await followSearchHit(page, search, live.song.title, live.song.title, 'Follow a song');
  await followSearchHit(
    page,
    search,
    live.friend.display_name.split(' ')[0],
    live.friend.display_name,
    'Follow a friend',
  );

  await tap(page, page.getByRole('button', { name: 'Close follow' }));
  await callout(page, 'Feed fills with their clips');
  await page.evaluate(() => {
    const el = document.getElementById('favorite-artist-clips');
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top: Math.max(0, y) });
  });
  await page.locator('#favorite-artist-clips img').first().waitFor({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(2400);
  await callout(page, 'One follow module personalizes everything');
  await page.waitForTimeout(2000);
  await callout(page, '');
}

export async function runFindAShow(page, state) {
  const live = state.live;
  const show = live.pastEvent;
  if (!show) throw new Error('No past JamBase event with clips');

  await waitHomeReady(page);
  const heroHome = page.getByRole('button', { name: 'Show Where Live Music Lives' });
  if (await heroHome.isVisible().catch(() => false)) {
    await heroHome.click();
    await page.waitForTimeout(400);
  }

  await callout(page, 'Find a Show in the home carousel');
  await page.waitForTimeout(1600);
  await tap(page, page.getByRole('button', { name: 'Find a Show' }));
  await callout(page, 'Search a past show to add a clip');
  await page.waitForTimeout(1200);

  const search = page.getByPlaceholder('Artist, venue, or show name');
  await typeInto(page, search, show.artistName);
  await page.waitForTimeout(900);
  await page.getByText('Searching shows…').waitFor({ state: 'hidden', timeout: 12_000 }).catch(() => {});
  const hit = page.locator('button').filter({ hasText: /Past/i }).first();
  await hit.waitFor({ state: 'visible', timeout: 12_000 });
  await tap(page, hit);
  await callout(page, 'The show page — clips already in setlist order');
  await page.waitForURL(/\/shows\//, { timeout: 15_000 });
  const went = page.getByRole('button', { name: /I went/i }).first();
  await went.waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(1800);

  await tap(page, went);
  await callout(page, 'I went unlocks Upload clip');
  const uploadBtn = page.getByRole('button', { name: /Upload clip/i });
  await uploadBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(900);

  await callout(page, 'Rate the show you actually attended');
  const fiveStars = page.getByRole('button', { name: 'Rate 5 stars' });
  await fiveStars.waitFor({ state: 'visible', timeout: 8_000 });
  await tap(page, fiveStars);
  await page.waitForTimeout(1200);

  await tap(page, uploadBtn);
  await page.waitForURL(/\/upload/, { timeout: 12_000 });
  await callout(page, 'Pick a clip from that night');
  const libraryBtn = page.getByRole('button', { name: /Choose a clip from your library/i });
  await libraryBtn.waitFor({ state: 'visible', timeout: 12_000 });
  await page.waitForTimeout(1400);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 10_000 }),
    tap(page, libraryBtn),
  ]);
  await chooser.setFiles(state.libraryVideoPath);
  await page.waitForTimeout(1600);

  const matched = page.getByText(/Matching show|Date and GPS|Madison Square Garden|proof you were there/i);
  if (await matched.first().isVisible().catch(() => false)) {
    await callout(page, 'Date and GPS match — proof you were there');
    await page.waitForTimeout(1600);
  }

  const post = page.getByRole('button', { name: /Share your moment|Share talking moment/i }).first();
  if (await post.isVisible().catch(() => false)) {
    await tap(page, post);
    await page.waitForTimeout(800);
  }

  markInjectedClip(state, show);
  await page.goto(`${live.origin}${show.href}`, { waitUntil: 'domcontentloaded' });
  await callout(page, 'Your clip inserts by recorded time — oldest to newest');
  await page.getByText(show.artistName, { exact: false }).first().waitFor({ timeout: 12_000 }).catch(() => {});
  await page.getByText(/moments/i).first().waitFor({ timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(3200);
  await callout(page, '');
}

async function scrollHeadingIntoView(page, title) {
  await page.evaluate((text) => {
    const heading = [...document.querySelectorAll('h2')].find((el) =>
      (el.textContent || '').includes(text),
    );
    if (!heading) return;
    const header = document.querySelector('ion-header, header');
    const headerBottom = header ? header.getBoundingClientRect().bottom : 88;
    const y = heading.getBoundingClientRect().top + window.scrollY - headerBottom - 12;
    window.scrollTo({ top: Math.max(0, y) });
  }, title);
  await page.waitForTimeout(400);
}

async function applyFavoriteShowsSubtitle(page) {
  await page.evaluate(() => {
    const wanted = 'Upcoming shows from your favorite artists.';
    const title = [...document.querySelectorAll('h2')].find((el) =>
      /Shows from Your Favorite Artists/i.test(el.textContent || ''),
    );
    if (!title) return;
    const block = title.closest('div')?.parentElement;
    const sub = block?.querySelector('p');
    if (sub) sub.textContent = wanted;
  });
}

export async function runProfile(page) {
  await waitHomeReady(page);
  await callout(page, 'Your profile on iOS');
  await page.waitForTimeout(1200);

  await tap(page, page.locator('ion-tab-button[tab="profile"]').first());
  await page.getByRole('heading', { name: 'Alex Rivera' }).waitFor({ timeout: 15_000 });
  await page
    .getByRole('heading', { name: 'Shows from Your Favorite Artists' })
    .waitFor({ state: 'attached', timeout: 12_000 })
    .catch(() => {});
  await applyFavoriteShowsSubtitle(page);
  await page.waitForTimeout(900);
  await callout(page, 'Stats, clips, and the shows you follow');
  await page.waitForTimeout(2000);

  const pastShows = page.getByRole('heading', { name: 'My Past Shows' });
  await pastShows.waitFor({ state: 'visible', timeout: 12_000 });
  await callout(page, '');
  await scrollHeadingIntoView(page, 'My Past Shows');
  await callout(page, 'Archive of every show you marked I went');
  await page.waitForTimeout(2400);

  await callout(page, '');
  await scrollHeadingIntoView(page, 'My Clips');
  await page.getByRole('heading', { name: 'My Clips' }).waitFor({ state: 'visible', timeout: 8_000 });
  await callout(page, 'Every clip you have posted');
  await page.waitForTimeout(2400);

  await callout(page, '');
  await scrollHeadingIntoView(page, 'Saved Clips');
  await page.getByRole('heading', { name: 'Saved Clips' }).waitFor({ state: 'visible', timeout: 8_000 });
  await callout(page, 'Clips you saved from the feed');
  await page.waitForTimeout(2400);

  await callout(page, '');
  await scrollHeadingIntoView(page, 'Shows from Your Favorite Artists');
  await applyFavoriteShowsSubtitle(page);
  await page
    .getByRole('heading', { name: 'Shows from Your Favorite Artists' })
    .waitFor({ state: 'visible', timeout: 8_000 });
  await callout(page, 'Upcoming shows from your favorite artists');
  await page.waitForTimeout(2800);
  await callout(page, 'Your whole concert life in one place');
  await page.waitForTimeout(2000);
  await callout(page, '');
}
