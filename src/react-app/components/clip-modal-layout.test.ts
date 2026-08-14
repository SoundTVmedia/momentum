import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('clip player modal layout', () => {
  it('uses an opaque full-viewport shell so the feed cannot show through', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/react-app/components/ClipModal.tsx'),
      'utf8',
    );
    expect(src).toContain('fixed inset-0 z-[250]');
    expect(src).toContain('overflow-hidden bg-black');
    expect(src).toContain('coverViewport');
    expect(src).not.toMatch(
      /fixed inset-0 z-\[250\][\s\S]{0,80}glass-modal-overlay/,
    );
  });
});
