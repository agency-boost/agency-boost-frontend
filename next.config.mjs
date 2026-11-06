import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
 * `/panduan/*` sends a policy of its own (ADR-0219 §3), in a later entry of `headers()`, which replaces this one there.
 *
 * @param {string | null} bucket
 */
export function contentSecurityPolicy(bucket) {
  const frames = bucket ? `https://storage.googleapis.com/${bucket}/` : "'none'";
  return `frame-src ${frames}; object-src 'none'; base-uri 'self'`;
}

/**
 * **Where the two public guides are served from** (P19.6-T5; ADR-0219 §1): `public/panduan/agent-leader.html` and
 * `kpm-owner-admin.html`, each with its PDF beside it, copied byte for byte from the owner's delivery by the
 * superproject's `scripts/sync-guides.py`. The Super Admin's guide is never here: it lives in the API alone.
 */
export const GUIDES_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), 'public', 'panduan');

/** A CSP source for one piece of inline code: its SHA-256, base64, quoted as the policy writes it. */
const sha256Source = (code) => `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`;

/** The few entities an attribute's value may carry, decoded as the browser does before it hashes the value. */
function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&(quot|apos|lt|gt|amp);/g, (_, name) => ({ quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' })[name]);
}

/**
 * **Every piece of inline code a guide carries** (ADR-0219 §3): the text of each `<script>` without a `src` and of each
 * `<style>`, and the value of each `on…` handler and each `style` attribute. Line endings are made `\n` first, as the
 * browser's parser makes them before it hashes anything; the attributes are read from the markup outside the scripts
 * and styles, so a string inside a script is never taken for one.
 *
 * @param {string} html
 */
export function inlineCodeOf(html) {
  const text = html.replace(/\r\n?/g, '\n');
  const scripts = [...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(([, attributes]) => !/\bsrc\s*=/i.test(attributes))
    .map(([, , code]) => code);
  const styles = [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(([, code]) => code);
  const markup = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  const attribute = (name) => [...markup.matchAll(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'gi'))]
    .map(([, double, single]) => decodeEntities(double ?? single));
  return { scripts, styles, handlers: attribute('on[a-z]+'), styleAttributes: attribute('style') };
}

/**
 * **A guide's own policy** (P19.6-T5 AC-5; ADR-0219 §3; `security-and-privacy.md`), written whole for its path, since a
 * later entry of `headers()` for the same key replaces the every-path one there:
 *
 * - **`sandbox allow-scripts allow-modals`**: the guide runs with an opaque origin on our own host, so its scripts reach
 *   no cookie, storage or tab of the app's, whatever a later version does; `allow-modals` is what *Simpan PDF / Cetak*'s
 *   `window.print()` needs. No same origin, no top navigation, no popups, no forms.
 * - **Its inline code by hash and nothing else**: each script and style block, and — under `'unsafe-hashes'`, which
 *   admits only the hashes listed — its one handler and its one style attribute. **Never `unsafe-inline`.**
 * - **Google Fonts, on this path alone** (the app's pages keep their self-hosted Inter, UI-008); `data:` images; no
 *   connection, no base, no form, and no page may frame it.
 *
 * @param {string} html
 */
export function guidePolicy(html) {
  const code = inlineCodeOf(html);
  const hashes = (list) => [...new Set(list.map(sha256Source))];
  const withAttributes = (blocks, attributes) => [
    ...hashes(blocks), ...(attributes.length > 0 ? ["'unsafe-hashes'", ...hashes(attributes)] : []),
  ];
  const scriptSrc = withAttributes(code.scripts, code.handlers);
  const styleSrc = [...withAttributes(code.styles, code.styleAttributes), 'https://fonts.googleapis.com'];
  return [
    'sandbox allow-scripts allow-modals',
    "default-src 'none'",
    `script-src ${scriptSrc.length > 0 ? scriptSrc.join(' ') : "'none'"}`,
    `style-src ${styleSrc.join(' ')}`,
    'font-src https://fonts.gstatic.com',
    'img-src data:',
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * **One `headers()` entry per served guide** (P19.6-T5 AC-5): its exact path — `/panduan/agent-leader.html`,
 * `/panduan/kpm-owner-admin.html` — and its own policy, **computed at build from the file served**, never written by
 * hand, so a refresh of a guide brings its hashes with it. Each guide admits its own code and no other's. The PDFs keep
 * the every-path policy; nothing else under `/panduan/` exists. No folder (a checkout without the guides): no entry.
 *
 * @param {string} directory
 */
export function guideHeaders(directory = GUIDES_DIRECTORY) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith('.html'))
    .sort()
    .map((name) => ({
      source: `/panduan/${name}`,
      headers: [{ key: 'Content-Security-Policy', value: guidePolicy(readFileSync(join(directory, name), 'utf8')) }],
    }));
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
   *
   * **Then each public guide's own policy** (P19.6-T5; ADR-0219 §3), **after** the every-path entry, so on a guide's path
   * its `Content-Security-Policy` replaces the every-path one; the robots header still reaches it.
   */
  async headers() {
    const everyPath = [{ key: 'Content-Security-Policy', value: contentSecurityPolicy(storageBucketFor(process.env)) }];
    if (process.env.NEXT_PUBLIC_APP_ENV !== 'production') everyPath.push({ key: 'X-Robots-Tag', value: 'noindex' });
    return [{ source: '/:path*', headers: everyPath }, ...guideHeaders()];
  },
};

export default nextConfig;
