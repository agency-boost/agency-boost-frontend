/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },

  /**
   * Every deployment but production asks not to be indexed (P18.7-T5, plan D9). Staging is public and
   * carries the seeded demo accounts' panel (ADR-0041), so a search result pointing at it would hand a
   * stranger the way in and present a test tenant as the product.
   *
   * Keyed on `NEXT_PUBLIC_APP_ENV` and failing closed, as the demo-accounts gate is: unset or misspelled
   * means noindex, and only the exact value `production` is indexable — which `scripts/vercel-build.mjs`
   * refuses a production build without. The variable is read when Next asks, at build time;
   * `next.config.spec.mjs` moves it and asks again.
   */
  async headers() {
    if (process.env.NEXT_PUBLIC_APP_ENV === 'production') return [];
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] }];
  },
};

export default nextConfig;
