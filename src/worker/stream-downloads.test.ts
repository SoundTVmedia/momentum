import { describe, expect, it } from 'vitest';
import { decideStreamMp4Step } from './stream-downloads';
import { parseStreamDownloadState } from './stream-service';

describe('decideStreamMp4Step', () => {
  it('waits while the Stream copy is still transcoding', () => {
    // Cloudflare rejects a downloads request before the video is ready to view.
    expect(decideStreamMp4Step({ readyToStream: false, download: null })).toEqual({
      action: 'wait',
      reason: 'video still transcoding',
    });
  });

  it('requests generation once the video is ready and nothing exists yet', () => {
    expect(decideStreamMp4Step({ readyToStream: true, download: null })).toEqual({
      action: 'request',
    });
  });

  it('keeps waiting while generation is in progress', () => {
    const step = decideStreamMp4Step({
      readyToStream: true,
      download: { status: 'inprogress', url: 'https://x/default.mp4', percentComplete: 75 },
    });
    expect(step).toEqual({ action: 'wait', reason: 'MP4 75% generated' });
  });

  it('promotes the URL Cloudflare reports once ready', () => {
    const step = decideStreamMp4Step({
      readyToStream: true,
      download: { status: 'ready', url: 'https://x/default.mp4', percentComplete: 100 },
    });
    expect(step).toEqual({ action: 'ready', url: 'https://x/default.mp4' });
  });

  it('stops retrying when Cloudflare reports a generation error', () => {
    const step = decideStreamMp4Step({
      readyToStream: true,
      download: { status: 'error', url: 'https://x/default.mp4', percentComplete: 0 },
    });
    expect(step.action).toBe('error');
  });
});

describe('parseStreamDownloadState', () => {
  const UID = 'a1b2c3d4e5f6789012345678abcdef01';
  const ORIGIN = 'https://videodelivery.net';

  it('keeps the customer-subdomain URL Cloudflare returns', () => {
    const state = parseStreamDownloadState(
      {
        status: 'ready',
        url: `https://customer-abc.cloudflarestream.com/${UID}/downloads/default.mp4`,
        percentComplete: 100,
      },
      UID,
      ORIGIN,
    );
    expect(state).toEqual({
      status: 'ready',
      url: `https://customer-abc.cloudflarestream.com/${UID}/downloads/default.mp4`,
      percentComplete: 100,
    });
  });

  it('falls back to the account-agnostic host when no URL is returned', () => {
    const state = parseStreamDownloadState({ status: 'inprogress', percentComplete: 40 }, UID, ORIGIN);
    expect(state?.url).toBe(`${ORIGIN}/${UID}/downloads/default.mp4`);
    expect(state?.status).toBe('inprogress');
  });

  it('treats an unknown status as still generating, never as ready', () => {
    const state = parseStreamDownloadState({ status: 'queued' }, UID, ORIGIN);
    expect(state?.status).toBe('inprogress');
  });

  it('returns null when the video has no download entry at all', () => {
    expect(parseStreamDownloadState(undefined, UID, ORIGIN)).toBeNull();
  });
});
