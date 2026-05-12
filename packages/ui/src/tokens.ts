/**
 * Richmond Finance design tokens.
 *
 * Palette derived from the existing Richmond corporate red (logo + legacy
 * Netlify site + previous SkyGuard tracker). Hexes can be replaced if a
 * pixel-perfect brand sheet is supplied later — every Tailwind class consuming
 * them lives in `apps/web/tailwind.config.ts` so the change is one file.
 */

export const tokens = {
  colors: {
    richmond: {
      primary: '#c0392b',
      'primary-dark': '#a13224',
      'primary-light': '#e74c3c',
      accent: '#0f1117',
    },
    surface: {
      base: '#f8fafc',
      raised: '#ffffff',
      muted: '#f1f5f9',
    },
    ink: {
      base: '#0f172a',
      muted: '#64748b',
    },
    status: {
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
      info: '#2563eb',
    },
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
  },
  spacing: {
    page: '1.5rem',
  },
  typography: {
    fontFamily: ['Inter', 'system-ui', 'sans-serif'].join(','),
  },
} as const;

export type Tokens = typeof tokens;
