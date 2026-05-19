import { describe, expect, it } from 'vitest';
import { isLocalDevAppOrigin } from './hybrid-auth';

describe('password reset dev detection', () => {
  it('treats localhost and LAN origins as local dev', () => {
    expect(isLocalDevAppOrigin('http://localhost:5173')).toBe(true);
    expect(isLocalDevAppOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isLocalDevAppOrigin('http://192.168.1.42:5173')).toBe(true);
  });

  it('does not treat production origins as local dev', () => {
    expect(
      isLocalDevAppOrigin('https://019aa38d-a318-7dee-9fdf-30039470c120.wes-6f3.workers.dev'),
    ).toBe(false);
  });
});
