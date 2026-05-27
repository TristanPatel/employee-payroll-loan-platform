// Shared design tokens for the mobile app (parity with the web Tailwind
// theme in apps/web/tailwind.config.ts).

export const colors = {
  richmondRed: '#c0392b',
  richmondRedDark: '#962d22',
  surfaceBase: '#f8fafc',
  white: '#ffffff',
  inkBase: '#0f172a',
  inkMuted: '#64748b',
  inkSubtle: '#94a3b8',
  divider: '#e2e8f0',
  success: '#15803d',
  warning: '#b45309',
  danger: '#b91c1c',
  info: '#1d4ed8',
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32,
};

export const radii = { sm: 6, md: 10, lg: 14, full: 999 };

export const text = {
  h1: { fontSize: 22, fontWeight: '700' as const, color: colors.inkBase },
  h2: { fontSize: 18, fontWeight: '600' as const, color: colors.inkBase },
  body: { fontSize: 14, color: colors.inkBase },
  muted: { fontSize: 13, color: colors.inkMuted },
  micro: { fontSize: 11, color: colors.inkSubtle, letterSpacing: 0.4, textTransform: 'uppercase' as const },
};
