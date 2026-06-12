/**
 * Richmond Finance design tokens.
 *
 * Palette extracted from the live marketing site (richmond-afri.com)
 * CSS bundle: --primary / --ring are #8b1e24, with warm neutral surfaces
 * (#faf9f7 / #f3f1ed) used in its hero gradients. Every Tailwind class
 * consuming these lives in `apps/web/tailwind.config.ts` so a future
 * rebrand stays a one-file change.
 */

export const tokens = {
  colors: {
    richmond: {
      primary: '#8b1e24',
      'primary-dark': '#701820',
      'primary-light': '#a8252c',
      accent: '#0f1117',
    },
    surface: {
      base: '#faf9f7',
      raised: '#ffffff',
      muted: '#f3f1ed',
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
