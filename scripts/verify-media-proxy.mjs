#!/usr/bin/env node
/**
 * Post-deploy check: media proxy health + MIME sniff on live JamBase show images.
 * Usage: node scripts/verify-media-proxy.mjs [origin]
 */
const origin = (
  process.argv[2] ||
  'https://019aa38d-a318-7dee-9fdf-30039470c120.wes-6f3.workers.dev'
).replace(/\/$/, '');

function sniff(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'avif/heic';
  }
  if (bytes[0] === 0x3c) return 'html';
  return 'unknown';
}

function okMime(headerCt, kind) {
  if (kind === 'jpeg') return headerCt.includes('jpeg');
  if (kind === 'png') return headerCt.includes('png');
  if (kind === 'webp') return headerCt.includes('webp');
  if (kind === 'avif/heic') return headerCt.includes('avif') || headerCt.includes('heic');
  return false;
}

const healthRes = await fetch(`${origin}/api/media/proxy/health`);
const healthCt = healthRes.headers.get('content-type') || '';
if (!healthCt.includes('application/json')) {
  console.error('FAIL: /api/media/proxy/health did not return JSON (is latest worker deployed?)');
  console.error(`  status=${healthRes.status} content-type=${healthCt}`);
  process.exit(1);
}
const health = await healthRes.json();
console.log('health', health);
if (!health?.mimeSniff || !String(health?.pathPrefix || '').includes('/v2/')) {
  console.error('FAIL: health payload missing mimeSniff/v2 pathPrefix');
  process.exit(1);
}

const nearbyRes = await fetch(`${origin}/api/shows/nearby`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
});
const nearby = await nearbyRes.json();
const urls = [];
for (const ev of nearby.events || []) {
  if (typeof ev.image === 'string' && ev.image) urls.push(ev.image);
  const loc = ev.location || {};
  if (typeof loc.image === 'string' && loc.image) urls.push(loc.image);
  for (const p of ev.performer || []) {
    if (p && typeof p.image === 'string' && p.image) urls.push(p.image);
  }
}
const unique = [...new Set(urls)].slice(0, 12);
if (unique.length === 0) {
  console.error('FAIL: no show images found from /api/shows/nearby');
  process.exit(1);
}

let mismatches = 0;
for (const url of unique) {
  const res = await fetch(url);
  const buf = new Uint8Array(await res.arrayBuffer());
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const kind = sniff(buf);
  const version = res.headers.get('x-media-proxy-version');
  const pass = res.ok && okMime(ct, kind);
  if (!pass) {
    mismatches += 1;
    console.error(`MISMATCH ${ct} vs ${kind} version=${version} ${url.slice(0, 120)}`);
  } else {
    console.log(`ok ${ct} (${kind}) v=${version || '?'} ${url.includes('/v2/') ? 'v2' : 'legacy'}`);
  }
}

if (mismatches > 0) {
  console.error(`FAIL: ${mismatches}/${unique.length} images have Content-Type/body mismatches`);
  process.exit(1);
}
console.log(`PASS: ${unique.length} proxied show images have matching MIME types`);
