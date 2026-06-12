import { describe, expect, it } from 'vitest';
import {
  getReviewRecommendation,
  scoreAmbassador,
  scoreInfluencer,
  scoreSponsor,
} from './program-applications';

describe('getReviewRecommendation', () => {
  it('maps score buckets to recommendations', () => {
    expect(getReviewRecommendation(90)).toBe('fast_track');
    expect(getReviewRecommendation(75)).toBe('manual_review');
    expect(getReviewRecommendation(55)).toBe('needs_review_or_more_info');
    expect(getReviewRecommendation(30)).toBe('reject_or_hold');
  });
});

describe('scoreAmbassador', () => {
  it('caps at 100 for strong applications', () => {
    const score = scoreAmbassador({
      fullName: 'Test',
      email: 'test@example.com',
      primaryCity: 'Austin',
      secondaryRegion: 'Central TX',
      socialLinks: ['https://instagram.com/a', 'https://tiktok.com/b'],
      primaryPlatform: 'instagram',
      monthlyShows: 8,
      genres: ['rock', 'indie'],
      lastFiveArtists: ['A', 'B', 'C', 'D', 'E'],
      localInfluenceCount: 30,
      motivation: 'x'.repeat(100),
      growthPlan: 'y'.repeat(120),
      communityLeadership: 'Led a fan group',
      consent: true,
    });
    expect(score).toBeGreaterThanOrEqual(85);
  });
});

describe('scoreInfluencer', () => {
  it('rewards content proof and audience size', () => {
    const score = scoreInfluencer({
      fullName: 'Creator',
      email: 'creator@example.com',
      primaryMarket: 'NYC',
      socialLinks: ['https://instagram.com/a', 'https://youtube.com/b'],
      primaryPlatform: 'instagram',
      contentCategories: ['live-music'],
      monthlyShows: 5,
      genres: ['rock', 'pop'],
      lastFiveArtists: ['A', 'B', 'C', 'D', 'E'],
      liveMusicLinks: ['https://example.com/1', 'https://example.com/2', 'https://example.com/3'],
      brandCampaignLinks: ['https://example.com/c1', 'https://example.com/c2'],
      brandsWorkedWith: ['Brand A', 'Brand B'],
      onCameraComfort: 'high',
      turnaround: '24h',
      audienceSize: 120000,
      engagementRate: 6,
      motivation: 'x'.repeat(100),
      uniqueAngle: 'Scene-first storytelling',
      consent: true,
    });
    expect(score).toBeGreaterThanOrEqual(85);
  });
});

describe('scoreSponsor', () => {
  it('rewards clear campaigns and budget tier', () => {
    const score = scoreSponsor({
      companyName: 'Acme',
      contactName: 'Jane',
      workEmail: 'jane@acme.com',
      website: 'https://acme.com',
      category: 'beverage',
      campaignGoal: 'x'.repeat(80),
      cta: 'Try Acme tonight',
      packageType: 'regional',
      targetMarkets: ['NYC'],
      targetGenres: ['rock'],
      budgetTier: 'large',
      logoUrl: 'https://acme.com/logo.png',
      brandColors: '#ff0000',
      wantsCreators: true,
      creatorNotes: 'Looking for creators at rock shows',
      consent: true,
    });
    expect(score).toBeGreaterThanOrEqual(70);
  });
});
