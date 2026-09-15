import { describe, expect, it } from 'vitest';
import {
  jamBaseShowPageUrl,
  parseJamBaseShowHtmlSetlist,
} from './jambase-show-html-setlist';

const FIXTURE = `
<div class="jb-floating-panel setlistfm-setlist">
  <div class="jb-setlist-fm-set-name-wrap"> <label class="jb-setlist-fm-name">Set 1</label></div>
  <ul class="list-unstyled jb-setlist-fm-songlist">
    <li class="song-wrap song-no-segue"> <span class="song"> <span class="song-name">Back in the U.S.S.R. </span> </span></li>
    <li class="song-wrap song-no-segue"> <span class="song"> <span class="song-name">Wolfman&#039;s Brother </span> </span></li>
  </ul>
  <div class="jb-setlist-fm-set-name-wrap"> <label class="jb-setlist-fm-name">Encore</label></div>
  <ul class="list-unstyled jb-setlist-fm-songlist">
    <li class="song-wrap song-no-segue"> <span class="song"> <span class="song-name">Tweezer Reprise </span> </span></li>
  </ul>
</div>
`;

describe('parseJamBaseShowHtmlSetlist', () => {
  it('reads song names from a JamBase show page', () => {
    expect(parseJamBaseShowHtmlSetlist(FIXTURE).map((s) => s.title)).toEqual([
      'Back in the U.S.S.R.',
      "Wolfman's Brother",
      'Tweezer Reprise',
    ]);
  });

  it('returns an empty list when the page has no setlist block', () => {
    expect(parseJamBaseShowHtmlSetlist('<html><body>Phish at MSG</body></html>')).toEqual([]);
  });
});

describe('jamBaseShowPageUrl', () => {
  it('keeps JamBase /show/ URLs', () => {
    expect(
      jamBaseShowPageUrl({ url: 'https://www.jambase.com/show/phish-madison-square-garden-20260725?ref=1' }),
    ).toBe('https://www.jambase.com/show/phish-madison-square-garden-20260725');
  });

  it('rejects off-site URLs', () => {
    expect(jamBaseShowPageUrl({ url: 'https://www.setlist.fm/setlist/phish/2026/msg.html' })).toBeNull();
  });
});
