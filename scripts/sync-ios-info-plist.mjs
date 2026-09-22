#!/usr/bin/env node
/**
 * Apply `ios.infoPlist` from capacitor.config.ts to ios/App/App/Info.plist.
 *
 * Capacitor's CLI has no `ios.infoPlist` option: `cap sync` bakes the whole config
 * object into ios/App/App/capacitor.config.json and otherwise ignores the key. The
 * usage strings, UIBackgroundModes, GIDClientID, and CFBundleURLTypes declared there
 * were therefore never reaching the binary — GoogleSignIn raises an NSException when
 * its reversed-client-id URL scheme is missing, which is why native Google sign-in
 * must stay off until this file has run.
 *
 * Runs after `npx cap sync` (so the baked JSON is fresh). Keys the config declares
 * win; GIDClientID is removed when the config no longer sets it so a stale client id
 * cannot re-enable the SDK path on a binary built without GOOGLE_IOS_OAUTH_CLIENT_ID.
 */
import fs from 'node:fs';
import path from 'node:path';
import plist from 'plist';

const root = path.resolve(import.meta.dirname, '..');
const bakedConfigPath = path.join(root, 'ios/App/App/capacitor.config.json');
const infoPlistPath = path.join(root, 'ios/App/App/Info.plist');

/** Keys we own even when the config omits them (absence means "remove"). */
const MANAGED_WHEN_ABSENT = ['GIDClientID'];

export function mergeInfoPlist(current, desired) {
  const next = { ...current };
  const changed = [];
  for (const [key, value] of Object.entries(desired ?? {})) {
    if (JSON.stringify(next[key]) !== JSON.stringify(value)) {
      next[key] = value;
      changed.push(key);
    }
  }
  for (const key of MANAGED_WHEN_ABSENT) {
    if (!(key in (desired ?? {})) && key in next) {
      delete next[key];
      changed.push(key);
    }
  }
  return { plist: next, changed };
}

/** `plist.build` indents the root <dict> one level; Xcode writes it at column 0. */
export function formatXcodePlist(xml) {
  const lines = xml.split('\n');
  const start = lines.findIndex((line) => line.startsWith('<plist'));
  const end = lines.findIndex((line) => line.startsWith('</plist>'));
  if (start === -1 || end === -1) return xml;
  return lines
    .map((line, index) =>
      index > start && index < end && line.startsWith('\t') ? line.slice(1) : line,
    )
    .join('\n');
}

function main() {
  if (!fs.existsSync(infoPlistPath)) {
    console.warn(`[cap:sync] ${path.relative(root, infoPlistPath)} not found — skipping Info.plist sync.`);
    return 0;
  }
  if (!fs.existsSync(bakedConfigPath)) {
    console.error(
      `[cap:sync] ${path.relative(root, bakedConfigPath)} is missing. Run "npx cap sync ios" first — it bakes capacitor.config.ts into JSON for this step.`,
    );
    return 1;
  }

  const baked = JSON.parse(fs.readFileSync(bakedConfigPath, 'utf8'));
  const desired = baked?.ios?.infoPlist;
  if (!desired || typeof desired !== 'object') {
    console.log('[cap:sync] capacitor.config.ts declares no ios.infoPlist — nothing to apply.');
    return 0;
  }

  const current = plist.parse(fs.readFileSync(infoPlistPath, 'utf8'));
  const { plist: merged, changed } = mergeInfoPlist(current, desired);
  if (changed.length === 0) {
    console.log('[cap:sync] Info.plist already matches capacitor.config.ts ios.infoPlist.');
  } else {
    fs.writeFileSync(infoPlistPath, formatXcodePlist(plist.build(merged, { indent: '\t' })) + '\n');
    console.log(`[cap:sync] Info.plist updated from ios.infoPlist: ${changed.join(', ')}`);
  }

  const clientId = typeof merged.GIDClientID === 'string' ? merged.GIDClientID : null;
  const schemes = (merged.CFBundleURLTypes ?? []).flatMap((t) => t?.CFBundleURLSchemes ?? []);
  if (clientId) {
    const scheme = `com.googleusercontent.apps.${clientId.replace(/\.apps\.googleusercontent\.com$/, '')}`;
    if (!schemes.includes(scheme)) {
      console.error(
        `[cap:sync] GIDClientID is set but URL scheme ${scheme} is missing from CFBundleURLTypes — GoogleSignIn would crash. Check capacitor.config.ts.`,
      );
      return 1;
    }
    console.log('[cap:sync] Native Google Sign-In is compiled in (GIDClientID + URL scheme present).');
  } else {
    console.log('[cap:sync] No GIDClientID in Info.plist — iOS uses browser Google sign-in.');
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  process.exit(main());
}
