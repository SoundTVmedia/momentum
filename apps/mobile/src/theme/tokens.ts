/** Feedback dark ambient tokens — mirrored from src/react-app/index.css (do not invent a new brand). */
export const colors = {
  ember: '#22d3ee',
  flare: '#3b82f6',
  rose: '#6366f1',
  copper: '#1e3a5f',
  glacier: '#67e8f9',
  ink: '#030712',
  smoke: '#0f172a',
  shellBg: '#030712',
  shellBgMid: '#0a1224',
  shellBgDeep: '#0e1a33',
  shellBorder: 'rgba(255, 255, 255, 0.1)',
  textBody: '#e8edf4',
  textSecondary: '#c5d0de',
  textMuted: '#a8b8c8',
  textSubtle: '#8fa3b8',
  iconMuted: '#b8c5d4',
  glassBg: 'rgba(255, 255, 255, 0.04)',
  glassBgStrong: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.11)',
  glassBorderAccent: 'rgba(59, 130, 246, 0.32)',
  danger: '#f87171',
  success: '#34d399',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  brand: {
    fontSize: 40,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    color: colors.textBody,
  },
  title: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: colors.textBody,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: colors.textSubtle,
  },
  label: {
    fontSize: 12,
    fontWeight: '500' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: colors.textSubtle,
  },
  mono: {
    fontSize: 13,
    fontFamily: 'Menlo',
    color: colors.textSecondary,
  },
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;
