import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The Swift plugin cannot be compiled or exercised in CI (no Xcode, no
 * ShazamKit), so these assert the source-level invariants that the clip-player
 * scan depends on. Each one maps to a failure mode that shipped.
 */
const source = readFileSync(
  resolve(
    process.cwd(),
    'packages/shazamkit/ios/Sources/ShazamKitPlugin/ShazamKitPlugin.swift',
  ),
  'utf8',
);

describe('ShazamKitPlugin window scan', () => {
  it('reuses one SHSession instead of building one per window', () => {
    // A fresh SHSession per window made Shazam throttle the burst with 202s,
    // and reassigning the property tore down the in-flight request.
    expect(source).toContain('private func currentSession() -> SHSession');
    expect(source.match(/SHSession\(\)/g) ?? []).toHaveLength(1);
  });

  it('never rejects the whole call because one window failed to match', () => {
    const didNotFind = source.slice(
      source.indexOf('func session(_ session: SHSession, didNotFindMatchFor'),
      source.indexOf('private static func isTransientMatchError'),
    );
    expect(didNotFind).not.toContain('reject(');
    expect(didNotFind).toContain('advanceToNextWindowOrResolveNoMatch()');
  });

  it('resolves rather than rejects when no window reached the catalog', () => {
    // Rejecting here skipped both the ACRCloud fallback and manual entry.
    const resolveNoMatch = source.slice(
      source.indexOf('private func resolveNoMatch()'),
      source.indexOf('private func advanceToNextWindowOrResolveNoMatch()'),
    );
    expect(resolveNoMatch).not.toContain('reject(');
    expect(resolveNoMatch).toContain('matchUnavailable');
  });

  it('builds each window signature lazily, not all of them up front', () => {
    expect(source).not.toContain('preparedSignatures');
    const runFile = source.slice(
      source.indexOf('private func runFile('),
      source.indexOf('static func scanWindowStarts'),
    );
    expect(runFile).not.toContain('makeSignature');
  });

  it('caps every signature at 11s, under Apple\'s 12.000s limit', () => {
    expect(source).toContain('signatureAppendCapSeconds: Double = min(11, maxSignatureSeconds)');
  });

  it('retries a transient 202 with backoff before moving on', () => {
    expect(source).toContain('maxWindowRetries = 2');
    expect(source).toContain('let delay = 1.2 * Double(windowRetryCount)');
  });

  it('logs each window so device logs show where a scan stalled', () => {
    expect(source).toContain('[shazamkit] scan start');
    expect(source).toContain('[shazamkit] window ');
    expect(source).toContain('[shazamkit] resolve nomatch');
    expect(source).toContain('[shazamkit] MATCH');
  });
});
