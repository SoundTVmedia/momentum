import { describe, expect, it } from 'vitest';
import {
  buildClipShareMeta,
  buildMinimalClipShareOgHtml,
  injectClipShareMetaIntoHtml,
  isSocialShareCrawler,
  toAbsoluteAssetUrl,
} from './clip-share-meta';

describe('clip-share-meta', () => {
  it('builds absolute thumbnail URL for share previews', () => {
    const meta = buildClipShareMeta(
      {
        artist_name: 'Phish',
        venue_name: 'MSG',
        thumbnail_url: '/api/files/thumb.jpg',
      },
      42,
      'https://feedback.example.com',
    );

    expect(meta.image).toBe('https://feedback.example.com/api/files/thumb.jpg');
    expect(meta.url).toBe('https://feedback.example.com/?clip=42');
    expect(meta.title).toContain('Phish');
  });

  it('injects clip meta into index.html including multiline og:url', () => {
    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta property="og:title" content="FEEDBACK - Where live music lives." />
    <meta property="og:description" content="Default description" />
    <meta property="og:image" content="/og-feedback.png" />
    <meta
      property="og:url"
      content="#"
    />
    <meta property="twitter:title" content="FEEDBACK - Where live music lives." />
    <meta property="twitter:description" content="Default description" />
    <meta property="twitter:image" content="/og-feedback.png" />
    <title>FEEDBACK - Where live music lives.</title>
  </head>
</html>`;

    const out = injectClipShareMetaIntoHtml(html, {
      title: 'Phish at MSG on FEEDBACK',
      description: 'Watch this moment',
      image: 'https://feedback.example.com/thumb.jpg',
      url: 'https://feedback.example.com/?clip=7',
    });

    expect(out).toContain('property="og:image" content="https://feedback.example.com/thumb.jpg"');
    expect(out).toContain('property="og:url" content="https://feedback.example.com/?clip=7"');
    expect(out).toContain('<title>Phish at MSG on FEEDBACK</title>');
    expect(out).not.toContain('/og-feedback.png');
  });

  it('falls back to site OG image when thumbnail is missing', () => {
    expect(toAbsoluteAssetUrl('https://feedback.example.com', '')).toBe(
      'https://feedback.example.com/og-feedback.png',
    );
  });

  it('builds minimal crawler HTML with clip thumbnail', () => {
    const html = buildMinimalClipShareOgHtml({
      title: 'Phish at MSG on FEEDBACK',
      description: 'Watch this moment',
      image: 'https://videodelivery.net/abc/thumbnails/thumbnail.jpg',
      url: 'https://feedback.example.com/?clip=7',
    });
    expect(html).toContain('property="og:image" content="https://videodelivery.net/abc/thumbnails/thumbnail.jpg"');
    expect(html).not.toContain('og-feedback.png');
  });

  it('detects social crawlers', () => {
    expect(isSocialShareCrawler('facebookexternalhit/1.1')).toBe(true);
    expect(isSocialShareCrawler('Mozilla/5.0 (iPhone)')).toBe(false);
  });
});
