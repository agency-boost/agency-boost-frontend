import { DEPLOY_TARGETS } from './scripts/lib/deploy-env.mjs';

/** A Cloud Storage bucket's name: lower-case letters, digits, dots, dashes and underscores. Nothing else reaches a header. */
const BUCKET_NAME = /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/;

/**
 * **The bucket whose files the app may frame** (P19.6-T2, ADR-0217 §6): the deployment's own — production's or
 * staging's, by `NEXT_PUBLIC_APP_ENV`, from `DEPLOY_TARGETS` — and elsewhere `NEXT_PUBLIC_STORAGE_BUCKET`, a developer's
 * own bucket (`local-development.md`). `null` with neither, or with a value that is no bucket's name: local development
 * without storage (ADR-0153 §6), where nothing is framed.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string | null}
 */
export function storageBucketFor(env) {
  const target = Object.values(DEPLOY_TARGETS).find((t) => t.appEnv === env.NEXT_PUBLIC_APP_ENV);
  if (target) return target.storageBucket;
  const own = env.NEXT_PUBLIC_STORAGE_BUCKET?.trim() ?? '';
  return BUCKET_NAME.test(own) ? own : null;
}

/**
 * **The app's Content-Security-Policy** (P19.6-T2, ADR-0217 §6; `security-and-privacy.md`), on every path:
 *
 * - `frame-src` admits **this environment's bucket's path, not the bare host**, so a page frames this bucket's files —
 *   an HTML lesson or page, inside `SandboxedDocument`'s `sandbox="allow-scripts"` — and no other bucket on Google's
 *   shared host. With no bucket it is `'none'`.
 * - `object-src 'none'` and `base-uri 'self'`.
 * - **Nothing inline is allowed, and nothing is set for scripts or styles**: Next.js's bootstrap scripts are inline, so a
 *   strict `script-src` needs a nonce per request. That policy is P20-T3's. *"No `unsafe-inline`"* holds because no
 *   policy here names it.
 *
 * *Changed 2026-11-20 (P19.17-T3 AC-3; ADR-0269 §3):* `/panduan/*`'s own policy (ADR-0219 §3) went with the guides; this
 * is the one policy on every path again.
 *
 * @param {string | null} bucket
 */
export function contentSecurityPolicy(bucket) {
  const frames = bucket ? `https://storage.googleapis.com/${bucket}/` : "'none'";
  return `frame-src ${frames}; object-src 'none'; base-uri 'self'`;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },

  /**
   * **Every path's headers**: the Content-Security-Policy above, on every deployment, and — on every deployment but
   * production — a request not to be indexed (P18.4-T5, plan D9). Staging is public and carries the seeded demo
   * accounts' panel (ADR-0041), so a search result pointing at it would hand a stranger the way in and present a test
   * tenant as the product.
   *
   * Keyed on `NEXT_PUBLIC_APP_ENV` and failing closed, as the demo-accounts gate is: unset or misspelled
   * means noindex, and only the exact value `production` is indexable — which `scripts/vercel-build.mjs`
   * refuses a production build without. The variables are read when Next asks, at build time;
   * `next.config.spec.mjs` moves them and asks again.
   */
  async headers() {
    const everyPath = [{ key: 'Content-Security-Policy', value: contentSecurityPolicy(storageBucketFor(process.env)) }];
    if (process.env.NEXT_PUBLIC_APP_ENV !== 'production') everyPath.push({ key: 'X-Robots-Tag', value: 'noindex' });
    return [{ source: '/:path*', headers: everyPath }];
  },
};

export default nextConfig;
