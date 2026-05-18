import { describe, expect, it } from 'vitest';
import { normalizeClipApiRows } from './clip-row-normalize';

describe('normalizeClipApiRows', () => {
  it('fills created_at from timestamp when created_at is missing', () => {
    const [row] = normalizeClipApiRows([
      {
        _clipRowId: 1,
        id: 1,
        timestamp: '2024-06-01T12:00:00.000Z',
      },
    ]);
    expect(row.created_at).toBe('2024-06-01T12:00:00.000Z');
  });

  it('keeps valid created_at over timestamp', () => {
    const [row] = normalizeClipApiRows([
      {
        _clipRowId: 2,
        id: 2,
        created_at: '2025-01-01T00:00:00.000Z',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    ]);
    expect(row.created_at).toBe('2025-01-01T00:00:00.000Z');
  });
});
