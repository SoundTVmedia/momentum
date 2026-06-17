import { describe, expect, it } from 'vitest';
import { resolveEnqueueClassification } from './enqueue-classification';

describe('resolveEnqueueClassification', () => {
  it('uses manual artist and venue without pending classify', () => {
    const result = resolveEnqueueClassification({
      uploadMethod: 'file',
      form: { artist_name: 'Artist', venue_name: 'Venue', location: 'NYC' },
      storedClassificationId: null,
      classifyResult: null,
    });
    expect(result).toEqual({
      ok: true,
      classificationId: '',
      contentFeed: 'main',
      classificationPending: false,
    });
  });

  it('queues file upload offline-first when not classified', () => {
    const result = resolveEnqueueClassification({
      uploadMethod: 'file',
      form: { artist_name: '', venue_name: '', location: '' },
      storedClassificationId: null,
      classifyResult: null,
    });
    expect(result).toEqual({
      ok: true,
      classificationId: '',
      contentFeed: 'main',
      classificationPending: true,
    });
  });

  it('rejects URL upload without manual tags or prior classification', () => {
    const result = resolveEnqueueClassification({
      uploadMethod: 'url',
      form: { artist_name: '', venue_name: '', location: '' },
      storedClassificationId: null,
      classifyResult: null,
    });
    expect(result.ok).toBe(false);
  });
});
