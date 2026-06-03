import { describe, expect, it } from 'vitest';
import {
  findEmbeddedGps,
  findEmbeddedRecordedAt,
  findMvhdCreationDate,
  mp4EpochSecondsToDate,
  parseIso6709Location,
} from './extractVideoFileMetadata';

describe('parseIso6709Location', () => {
  it('parses standard ISO6709 strings', () => {
    expect(parseIso6709Location('+37.7749-122.4194/')).toEqual({
      latitude: 37.7749,
      longitude: -122.4194,
    });
  });

  it('rejects out-of-range coordinates', () => {
    expect(parseIso6709Location('+91.0-122.4194/')).toBeNull();
  });
});

describe('mp4EpochSecondsToDate', () => {
  it('converts MP4 epoch seconds', () => {
    // 2024-01-01T00:00:00Z ≈ 3786912000 seconds since 1904
    const d = mp4EpochSecondsToDate(3786912000);
    expect(d?.getUTCFullYear()).toBe(2024);
  });
});

describe('findEmbeddedRecordedAt', () => {
  it('finds creation_time strings', () => {
    const bytes = new TextEncoder().encode(
      'foo creation_time=2024-06-15T20:30:00.000000Z bar',
    );
    const d = findEmbeddedRecordedAt(bytes);
    expect(d?.getUTCFullYear()).toBe(2024);
    expect(d?.getUTCMonth()).toBe(5);
  });

  it('finds mvhd creation time', () => {
    const buf = new Uint8Array(32);
    buf.set([0x6d, 0x76, 0x68, 0x64]); // mvhd at 0
    buf[8] = 0; // version 0
    const view = new DataView(buf.buffer);
    view.setUint32(12, 3786912000, false);
    const d = findMvhdCreationDate(buf);
    expect(d?.getUTCFullYear()).toBe(2024);
  });
});

describe('findEmbeddedGps', () => {
  it('finds QuickTime ISO6709 location key', () => {
    const bytes = new TextEncoder().encode(
      'com.apple.quicktime.location.ISO6709+40.7505-73.9934/',
    );
    expect(findEmbeddedGps(bytes)).toEqual({
      latitude: 40.7505,
      longitude: -73.9934,
    });
  });
});
