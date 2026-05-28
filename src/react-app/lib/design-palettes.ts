/**
 * Brand palette registry — log iterations here; switch active palette in
 * tailwind.config.js + index.css :root (search ACTIVE_PALETTE).
 *
 * Cool-tone (Arctic Pulse) was explored and rejected — not listed below.
 */

export type DesignPaletteId =
  | 'orange-version'
  | 'green-option-1'
  | 'green-option-2'
  | 'neon-blue';

export type DesignPalette = {
  id: DesignPaletteId;
  label: string;
  description: string;
  /** Tailwind arbitrary-style gradient for reference */
  tailwindGradient: string;
  /** CSS linear-gradient for --momentum-grad / CTAs */
  momentumGrad: string;
  tokens: {
    ember: string;
    flare: string;
    rose: string;
    glacier: string;
    copper: string;
    ink: string;
    smoke: string;
  };
};

/** First styling iteration — warm Spotlight (coral + gold). */
export const ORANGE_VERSION: DesignPalette = {
  id: 'orange-version',
  label: 'Orange version',
  description: 'Warm stage ember + golden flare. First liquid-glass palette iteration.',
  tailwindGradient: 'bg-gradient-to-r from-[#FF5349] via-[#FFB020] to-[#FF5349]',
  momentumGrad:
    'linear-gradient(to right, #FF5349 0%, #FFB020 51%, #FF5349 100%)',
  tokens: {
    ember: '#FF5349',
    flare: '#FFB020',
    rose: '#C73E6D',
    glacier: '#FFD166',
    copper: '#B86B4D',
    ink: '#0C0A0B',
    smoke: '#1A1517',
  },
};

/** Citron → lime → forest (horizontal). */
export const GREEN_OPTION_1: DesignPalette = {
  id: 'green-option-1',
  label: 'Green option 1',
  description: 'Yellow-lime opening into forest green (user reference gradient).',
  tailwindGradient:
    'bg-gradient-to-r from-[#fef08a] via-[#84cc16] to-[#16a34a]',
  momentumGrad:
    'linear-gradient(to right, #fef08a 0%, #84cc16 50%, #16a34a 100%)',
  tokens: {
    ember: '#FEF08A',
    flare: '#84CC16',
    rose: '#16A34A',
    glacier: '#A3E635',
    copper: '#3F6212',
    ink: '#060A08',
    smoke: '#0C140C',
  },
};

/** Lime → forest → teal (bottom-left). ACTIVE. */
export const GREEN_OPTION_2: DesignPalette = {
  id: 'green-option-2',
  label: 'Green option 2',
  description: 'Lime into forest, resolving to deep teal (bottom-left flow).',
  tailwindGradient:
    'bg-gradient-to-bl from-[#84cc16] via-[#16a34a] to-[#0f766e]',
  momentumGrad:
    'linear-gradient(to bottom left, #84cc16 0%, #16a34a 50%, #0f766e 100%)',
  tokens: {
    ember: '#84CC16',
    flare: '#16A34A',
    rose: '#0F766E',
    glacier: '#2DD4BF',
    copper: '#134E4A',
    ink: '#041210',
    smoke: '#0A1F1C',
  },
};

/** Neon cyan → electric blue → indigo (ACTIVE). */
export const NEON_BLUE: DesignPalette = {
  id: 'neon-blue',
  label: 'Neon blue',
  description: 'Neon cyan into electric blue, resolving to deep indigo.',
  tailwindGradient:
    'bg-gradient-to-bl from-[#22d3ee] via-[#3b82f6] to-[#6366f1]',
  momentumGrad:
    'linear-gradient(to bottom left, #22d3ee 0%, #3b82f6 50%, #6366f1 100%)',
  tokens: {
    ember: '#22D3EE',
    flare: '#3B82F6',
    rose: '#6366F1',
    glacier: '#67E8F9',
    copper: '#1E3A5F',
    ink: '#030712',
    smoke: '#0F172A',
  },
};

export const DESIGN_PALETTES: Record<DesignPaletteId, DesignPalette> = {
  'orange-version': ORANGE_VERSION,
  'green-option-1': GREEN_OPTION_1,
  'green-option-2': GREEN_OPTION_2,
  'neon-blue': NEON_BLUE,
};

/** Palette currently wired in tailwind.config.js + index.css */
export const ACTIVE_PALETTE_ID: DesignPaletteId = 'neon-blue';

export const ACTIVE_PALETTE = DESIGN_PALETTES[ACTIVE_PALETTE_ID];
