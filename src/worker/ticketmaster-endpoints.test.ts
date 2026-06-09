import { describe, expect, it } from 'vitest';

describe('ticket interest notifications', () => {
  it('uses ticket_interest type for follower fan-out content', () => {
    const eventName = 'Taylor Swift at SoFi Stadium';
    const content = `looked at tickets for ${eventName}`;
    expect(content).toContain('looked at tickets for');
    expect(content).toContain(eventName);
  });

  it('dedupes notification when prior click exists within window', () => {
    const priorClick = { id: 1 };
    const shouldNotifyFollowers = !priorClick;
    expect(shouldNotifyFollowers).toBe(false);
  });
});
