import { describe, expect, it } from 'vitest';
import { isMobileViewportSize } from './useIsMobileViewport';

describe('isMobileViewportSize', () => {
  it('treats portrait phone dimensions as mobile', () => {
    expect(isMobileViewportSize(390, 844)).toBe(true);
  });

  it('treats landscape phone dimensions as mobile (shorter edge still phone-sized)', () => {
    expect(isMobileViewportSize(844, 390)).toBe(true);
  });

  it('treats tablet/desktop dimensions as non-mobile', () => {
    expect(isMobileViewportSize(1024, 768)).toBe(false);
  });
});
