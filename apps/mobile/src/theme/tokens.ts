/** Nightstage / Magenta tokens — mirrored from src/react-app/index.css (do not invent a new brand). */
export const colors = {
  ember: '#FF2E88',
  flare: '#FF2E88',
  rose: '#7566E8',
  copper: '#2A1024',
  glacier: '#F6F2FA',
  gold: '#D6A84B',
  ink: '#0B0711',
  smoke: '#160E1C',
  shellBg: '#0B0711',
  shellBgMid: '#120C1A',
  shellBgDeep: '#1A1324',
  shellBorder: 'rgba(255, 255, 255, 0.1)',
  textBody: '#F6F2FA',
  textSecondary: '#d4d4d4',
  textMuted: '#b0b0b0',
  textSubtle: '#8a8a8a',
  iconMuted: '#c4c4c4',
  glassBg: 'rgba(255, 255, 255, 0.04)',
  glassBgStrong: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.11)',
  glassBorderAccent: 'rgba(255, 46, 136, 0.32)',
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
