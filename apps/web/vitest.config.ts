import { defineConfig } from 'vitest/config';

// Vitest runs unit tests only. Playwright owns e2e/ — exclude it
// here so `pnpm test` doesn't double-collect the same files.
export default defineConfig({
  test: {
    exclude: ['e2e/**', 'node_modules/**', '.next/**', 'dist/**'],
  },
});
