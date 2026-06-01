import { describe, expect, it } from 'vitest';
import {
  describeMusicRecognitionConfig,
  inferIdentifyFilename,
} from './music-recognition';

describe('describeMusicRecognitionConfig', () => {
  it('reports ACR ready when all three vars are set', () => {
    const s = describeMusicRecognitionConfig({
      ACRCLOUD_HOST: 'identify-us-west-2.acrcloud.com',
      ACRCLOUD_ACCESS_KEY: 'key',
      ACRCLOUD_ACCESS_SECRET: 'secret',
    });
    expect(s.activeProvider).toBe('acrcloud');
    expect(s.acrcloud.ready).toBe(true);
    expect(s.hint).toBeNull();
  });

  it('hints when host is set without secrets', () => {
    const s = describeMusicRecognitionConfig({
      ACRCLOUD_HOST: 'identify-us-west-2.acrcloud.com',
    });
    expect(s.acrcloud.ready).toBe(false);
    expect(s.activeProvider).toBe('none');
    expect(s.hint).toMatch(/access key or secret/i);
  });

  it('does not use AudD as active provider when only AUDD_API_TOKEN is set', () => {
    const s = describeMusicRecognitionConfig({
      AUDD_API_TOKEN: 'token',
    });
    expect(s.activeProvider).toBe('none');
  });
});

describe('inferIdentifyFilename', () => {
  it('maps blob MIME to extension for ACR', () => {
    expect(inferIdentifyFilename(new Blob([], { type: 'audio/webm' }))).toBe('snippet.webm');
    expect(inferIdentifyFilename(new Blob([], { type: 'video/mp4' }))).toBe('snippet.m4a');
  });
});
