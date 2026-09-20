import { describe, expect, it } from 'vitest';
import { UPLOAD_RETRY_CONFIG } from './upload-retry-config';

describe('UPLOAD_RETRY_CONFIG', () => {
  it('lets a user queue 50 clips', () => {
    expect(UPLOAD_RETRY_CONFIG.maxQueueSize).toBe(50);
  });
});
