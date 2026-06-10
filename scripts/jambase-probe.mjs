#!/usr/bin/env node
/**
 * Local JamBase connectivity check (reads JAMBASE_API_KEY from .dev.vars).
 * Usage: node scripts/jambase-probe.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadKey() {
  const path = resolve(process.cwd(), '.dev.vars');
  let raw = '';
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    console.error('No .dev.vars found. Add JAMBASE_API_KEY=... and retry.');
    process.exit(1);
  }
  const line = raw.split('\n').find((l) => l.startsWith('JAMBASE_API_KEY='));
  if (!line) {
    console.error('JAMBASE_API_KEY missing in .dev.vars');
    process.exit(1);
  }
  let key = line.slice('JAMBASE_API_KEY='.length).trim();
  if (key.toLowerCase().startsWith('bearer ')) key = key.slice(7).trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key;
}

const key = loadKey();
if (!key) {
  console.error('JAMBASE_API_KEY is empty in .dev.vars');
  process.exit(1);
}

const url =
  'https://api.data.jambase.com/v3/artists?artistName=taylor&perPage=2&page=1';
const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    'User-Agent': 'Feedback/1.0',
  },
});
const text = await res.text();
console.log('HTTP', res.status);
try {
  const json = JSON.parse(text);
  if (json.detail) console.log('detail:', json.detail);
  if (Array.isArray(json.artists)) console.log('artists:', json.artists.length);
  else console.log(text.slice(0, 500));
} catch {
  console.log(text.slice(0, 500));
}

process.exit(res.ok ? 0 : 1);
