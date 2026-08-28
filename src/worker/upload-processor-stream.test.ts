import { describe, expect, it } from 'vitest';
import {
  STALE_STREAM_PROCESSING_MINUTES,
  staleStreamProcessingPredicate,
} from './upload-processor';

describe('staleStreamProcessingPredicate', () => {
  it('targets processing rows with no Stream id after the timeout', () => {
    const sql = staleStreamProcessingPredicate();
    expect(sql).toContain("upload_status = 'processing'");
    expect(sql).toContain("stream_video_id IS NULL OR trim(stream_video_id) = ''");
    expect(sql).toContain(`datetime('now', '-${STALE_STREAM_PROCESSING_MINUTES} minutes')`);
  });

  it('clamps the timeout to a safe integer', () => {
    expect(staleStreamProcessingPredicate(2.9)).toContain("datetime('now', '-2 minutes')");
    expect(staleStreamProcessingPredicate(0)).toContain("datetime('now', '-1 minutes')");
    expect(staleStreamProcessingPredicate(999)).toContain("datetime('now', '-60 minutes')");
  });
});
