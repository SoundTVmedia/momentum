import { z } from 'zod';

export const ApplicationTypeSchema = z.enum(['ambassador', 'influencer', 'sponsor']);
export type ApplicationType = z.infer<typeof ApplicationTypeSchema>;

export const ApplicationStatusSchema = z.enum([
  'draft',
  'submitted',
  'needs_more_info',
  'under_review',
  'approved',
  'rejected',
  'archived',
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export type ReviewRecommendation =
  | 'fast_track'
  | 'manual_review'
  | 'needs_review_or_more_info'
  | 'reject_or_hold';

export function getReviewRecommendation(score: number): ReviewRecommendation {
  if (score >= 85) return 'fast_track';
  if (score >= 70) return 'manual_review';
  if (score >= 50) return 'needs_review_or_more_info';
  return 'reject_or_hold';
}

export const REVIEW_RECOMMENDATION_LABELS: Record<ReviewRecommendation, string> = {
  fast_track: 'Strong fit — fast-track review',
  manual_review: 'Promising — manual review recommended',
  needs_review_or_more_info: 'Weak fit — hold or request more info',
  reject_or_hold: 'Not a fit — reject or hold',
};

export const SOCIAL_PLATFORMS = [
  'instagram',
  'tiktok',
  'youtube',
  'twitter',
  'facebook',
  'snapchat',
  'other',
] as const;

export const MUSIC_GENRES = [
  'rock',
  'indie',
  'pop',
  'hip-hop',
  'r&b',
  'country',
  'electronic',
  'jazz',
  'metal',
  'punk',
  'folk',
  'latin',
  'other',
] as const;

export const SPONSOR_INDUSTRIES = [
  'beverage',
  'apparel',
  'tech',
  'beauty',
  'food',
  'automotive',
  'finance',
  'entertainment',
  'other',
] as const;

export const SPONSOR_PACKAGE_TYPES = [
  'single_show',
  'regional',
  'genre',
  'tour',
  'custom',
] as const;

export const BUDGET_TIERS = ['test', 'small', 'mid', 'large', 'enterprise'] as const;

export interface BaseApplication {
  id: string;
  userId?: string;
  type: ApplicationType;
  status: ApplicationStatus;
  submittedAt?: string;
  reviewedAt?: string;
  reviewerId?: string;
  confidenceScore?: number;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AmbassadorApplicationData {
  fullName: string;
  email: string;
  phone?: string;
  primaryCity: string;
  secondaryRegion?: string;
  socialLinks: string[];
  primaryPlatform: string;
  monthlyShows: number;
  genres: string[];
  lastFiveArtists: string[];
  localInfluenceCount: number;
  motivation: string;
  growthPlan: string;
  communityLeadership?: string;
  sampleLinks?: string[];
  availabilityPerMonth?: string;
  consent: boolean;
}

export interface InfluencerApplicationData {
  fullName: string;
  email: string;
  primaryMarket: string;
  secondaryMarkets?: string;
  socialLinks: string[];
  primaryPlatform: string;
  contentCategories: string[];
  monthlyShows: number;
  genres: string[];
  lastFiveArtists: string[];
  liveMusicLinks: string[];
  brandCampaignLinks?: string[];
  brandsWorkedWith?: string[];
  onCameraComfort: 'low' | 'medium' | 'high';
  turnaround?: '24h' | '48h' | '72h' | 'flexible';
  audienceSize?: number;
  engagementRate?: number;
  motivation: string;
  uniqueAngle?: string;
  consent: boolean;
}

export interface SponsorApplicationData {
  companyName: string;
  contactName: string;
  workEmail: string;
  website: string;
  category: string;
  campaignGoal: string;
  cta: string;
  campaignPriority?: string;
  packageType: 'single_show' | 'regional' | 'genre' | 'tour' | 'custom';
  targetMarkets?: string[];
  targetGenres?: string[];
  targetTour?: string;
  showCount?: number;
  budgetTier?: 'test' | 'small' | 'mid' | 'large' | 'enterprise';
  campaignWindowStart?: string;
  campaignWindowEnd?: string;
  logoUrl?: string;
  brandColors?: string;
  creativeRestrictions?: string;
  wantsCreators: boolean;
  creatorTypes?: string[];
  creatorNotes?: string;
  additionalNotes?: string;
  consent: boolean;
}

export function scoreAmbassador(app: AmbassadorApplicationData): number {
  let score = 0;
  if (app.primaryCity.trim()) score += 10;
  if (app.secondaryRegion?.trim()) score += 5;
  if (app.monthlyShows >= 6) score += 20;
  else if (app.monthlyShows >= 3) score += 14;
  else if (app.monthlyShows >= 1) score += 8;
  if (app.genres.length >= 2) score += 8;
  if (app.lastFiveArtists.length >= 5) score += 7;
  if (app.socialLinks.length >= 2) score += 10;
  if (app.localInfluenceCount >= 25) score += 20;
  else if (app.localInfluenceCount >= 10) score += 14;
  else if (app.localInfluenceCount >= 5) score += 8;
  if (app.motivation.trim().length >= 100) score += 5;
  if (app.growthPlan.trim().length >= 120) score += 5;
  if (app.communityLeadership?.trim()) score += 5;
  return Math.min(score, 100);
}

export function scoreInfluencer(app: InfluencerApplicationData): number {
  let score = 0;
  if (app.primaryMarket.trim()) score += 10;
  if (app.socialLinks.length >= 2) score += 8;
  if (app.liveMusicLinks.length >= 3) score += 20;
  else if (app.liveMusicLinks.length >= 1) score += 12;
  if (app.monthlyShows >= 4) score += 15;
  else if (app.monthlyShows >= 2) score += 10;
  else if (app.monthlyShows >= 1) score += 5;
  if (app.genres.length >= 2) score += 5;
  if (app.lastFiveArtists.length >= 5) score += 5;
  if ((app.brandCampaignLinks?.length || 0) >= 2) score += 10;
  if ((app.brandsWorkedWith?.length || 0) >= 2) score += 5;
  if ((app.audienceSize || 0) >= 100000) score += 12;
  else if ((app.audienceSize || 0) >= 25000) score += 9;
  else if ((app.audienceSize || 0) >= 10000) score += 6;
  else if ((app.audienceSize || 0) >= 5000) score += 3;
  if ((app.engagementRate || 0) >= 5) score += 8;
  else if ((app.engagementRate || 0) >= 3) score += 5;
  else if ((app.engagementRate || 0) >= 1.5) score += 3;
  if (app.onCameraComfort === 'high') score += 5;
  else if (app.onCameraComfort === 'medium') score += 3;
  if (app.turnaround === '24h') score += 3;
  else if (app.turnaround === '48h') score += 2;
  if (app.motivation.trim().length >= 100) score += 4;
  if (app.uniqueAngle?.trim()) score += 3;
  return Math.min(score, 100);
}

export function scoreSponsor(app: SponsorApplicationData): number {
  let score = 0;
  if (app.companyName.trim()) score += 10;
  if (app.website.trim()) score += 5;
  if (app.category.trim()) score += 10;
  if (app.campaignGoal.trim().length >= 80) score += 15;
  if (app.cta.trim().length >= 8) score += 5;
  if (app.packageType === 'single_show') score += 10;
  if (app.packageType === 'regional') score += 12;
  if (app.packageType === 'genre') score += 10;
  if (app.packageType === 'tour') score += 12;
  if (app.packageType === 'custom') score += 6;
  if (app.targetMarkets?.length) score += 5;
  if (app.targetGenres?.length) score += 5;
  if (app.targetTour?.trim()) score += 5;
  if (app.budgetTier === 'large' || app.budgetTier === 'enterprise') score += 20;
  else if (app.budgetTier === 'mid') score += 14;
  else if (app.budgetTier === 'small') score += 8;
  else if (app.budgetTier === 'test') score += 4;
  if (app.logoUrl?.trim()) score += 5;
  if (app.brandColors?.trim()) score += 5;
  if (app.wantsCreators) score += 6;
  if (app.creatorNotes?.trim()) score += 5;
  return Math.min(score, 100);
}

export function scoreApplication(
  type: ApplicationType,
  formData: AmbassadorApplicationData | InfluencerApplicationData | SponsorApplicationData,
): number {
  switch (type) {
    case 'ambassador':
      return scoreAmbassador(formData as AmbassadorApplicationData);
    case 'influencer':
      return scoreInfluencer(formData as InfluencerApplicationData);
    case 'sponsor':
      return scoreSponsor(formData as SponsorApplicationData);
  }
}

export const AmbassadorApplicationSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  primaryCity: z.string().min(1),
  secondaryRegion: z.string().optional(),
  socialLinks: z.array(z.string().url()).min(1),
  primaryPlatform: z.string().min(1),
  monthlyShows: z.number().min(0),
  genres: z.array(z.string()).min(1),
  lastFiveArtists: z.array(z.string()).min(1),
  localInfluenceCount: z.number().min(0),
  motivation: z.string().min(1),
  growthPlan: z.string().min(1),
  communityLeadership: z.string().optional(),
  sampleLinks: z.array(z.string().url()).optional(),
  availabilityPerMonth: z.string().optional(),
  consent: z.literal(true),
});

export const InfluencerApplicationSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  primaryMarket: z.string().min(1),
  secondaryMarkets: z.string().optional(),
  socialLinks: z.array(z.string().url()).min(1),
  primaryPlatform: z.string().min(1),
  contentCategories: z.array(z.string()).min(1),
  monthlyShows: z.number().min(0),
  genres: z.array(z.string()).min(1),
  lastFiveArtists: z.array(z.string()).min(1),
  liveMusicLinks: z.array(z.string().url()).min(1),
  brandCampaignLinks: z.array(z.string().url()).optional(),
  brandsWorkedWith: z.array(z.string()).optional(),
  onCameraComfort: z.enum(['low', 'medium', 'high']),
  turnaround: z.enum(['24h', '48h', '72h', 'flexible']).optional(),
  audienceSize: z.number().min(0).optional(),
  engagementRate: z.number().min(0).optional(),
  motivation: z.string().min(1),
  uniqueAngle: z.string().optional(),
  consent: z.literal(true),
});

export const SponsorApplicationSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().min(1),
  workEmail: z.string().email(),
  website: z.string().url(),
  category: z.string().min(1),
  campaignGoal: z.string().min(1),
  cta: z.string().min(1),
  campaignPriority: z.string().optional(),
  packageType: z.enum(['single_show', 'regional', 'genre', 'tour', 'custom']),
  targetMarkets: z.array(z.string()).optional(),
  targetGenres: z.array(z.string()).optional(),
  targetTour: z.string().optional(),
  showCount: z.number().min(0).optional(),
  budgetTier: z.enum(['test', 'small', 'mid', 'large', 'enterprise']).optional(),
  campaignWindowStart: z.string().optional(),
  campaignWindowEnd: z.string().optional(),
  logoUrl: z.string().optional(),
  brandColors: z.string().optional(),
  creativeRestrictions: z.string().optional(),
  wantsCreators: z.boolean(),
  creatorTypes: z.array(z.string()).optional(),
  creatorNotes: z.string().optional(),
  additionalNotes: z.string().optional(),
  consent: z.literal(true),
});

export const CREATOR_AVAILABILITY_STATUSES = ['going', 'available', 'confirmed'] as const;

export interface CreatorAvailability {
  id: string;
  userId: string;
  showId?: string;
  city?: string;
  region?: string;
  genre?: string;
  artistName?: string;
  status: (typeof CREATOR_AVAILABILITY_STATUSES)[number];
  notes?: string;
  createdAt: string;
}

export interface SponsorCampaignInterest {
  id: string;
  sponsorId: string;
  packageType: (typeof SPONSOR_PACKAGE_TYPES)[number];
  showId?: string;
  city?: string;
  region?: string;
  genre?: string;
  artistName?: string;
  cta: string;
  notes?: string;
  createdAt: string;
}

export const APPLICATION_TYPE_LABELS: Record<ApplicationType, string> = {
  ambassador: 'Ambassador',
  influencer: 'Influencer',
  sponsor: 'Sponsor',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  needs_more_info: 'Needs More Info',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  archived: 'Archived',
};
