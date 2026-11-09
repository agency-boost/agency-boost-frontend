import { configDefaults, defineConfig } from 'vitest/config';

/**
 * **The specs that drive a real Chrome run on their own** (`pnpm test:browser`, one file at a time; 2026-11-06). Beside
 * four hundred jsdom files on CI's two vCPUs, two Chromes starting at once missed the 30 s hook: each passed alone.
 * `pnpm test` and `pnpm test:coverage` leave them out; they measure a browser, not the source's coverage.
 */
const BROWSER_SPECS = '**/*.browser.spec.{ts,mjs}';
const browserRun = process.env.BROWSER_SPECS === '1';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      // Specs reached the harness by counting `../`, so every one broke when a route
      // group added a directory level. An alias makes the depth irrelevant.
      '@test': new URL('./test', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: browserRun ? [BROWSER_SPECS] : configDefaults.include,
    exclude: browserRun ? configDefaults.exclude : [...configDefaults.exclude, BROWSER_SPECS],
    setupFiles: ['./test/setup.ts'],
    /*
     * **Room on a CI runner, not on a laptop.** GitHub's runner took 366s for the suite that takes about a minute
     * here, and the heaviest tests — axe over a whole screen, a fake clock walked past midnight — missed vitest's
     * 5s there while taking under one locally (2026-10-26, 2026-10-27). `CI` is set by GitHub Actions. Locally the
     * defaults stand, so a test that has really slowed down still fails where it is written.
     */
    testTimeout: process.env.CI ? 20_000 : 5_000,
    hookTimeout: process.env.CI ? 30_000 : 10_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/app/layout.tsx', 'src/**/*.spec.{ts,tsx}'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
