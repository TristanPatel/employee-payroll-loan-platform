import type { Config } from 'tailwindcss';
import { tokens } from '@eplp/ui';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        richmond: tokens.colors.richmond,
        surface: tokens.colors.surface,
        ink: tokens.colors.ink,
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: tokens.radius,
    },
  },
  plugins: [],
};

export default config;
