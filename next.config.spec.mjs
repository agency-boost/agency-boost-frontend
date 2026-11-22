import { afterEach, describe, expect, it } from 'vitest';
import nextConfig, { contentSecurityPolicy, storageBucketFor } from './next.config.mjs';

/**
 * P18.4-T5: the noindex header. Inverted, it would take production out of search and leave staging — the
 * one with the seeded accounts on its sign-in screen — in it, so the direction is pinned here.
 *
 * P19.6-T2 (ADR-0217 §6): the app's Content-Security-Policy, on every path of every deployment.
 */
const ORIGINAL = process.env.NEXT_PUBLIC_APP_ENV;
const ORIGINAL_BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET;

async function headersFor(appEnv, bucket) {
  if (appEnv === undefined) delete process.env.NEXT_PUBLIC_APP_ENV;
  else process.env.NEXT_PUBLIC_APP_ENV = appEnv;
  if (bucket === undefined) delete process.env.NEXT_PUBLIC_STORAGE_BUCKET;
  else process.env.NEXT_PUBLIC_STORAGE_BUCKET = bucket;
  return nextConfig.headers();
}

/** The value of one header on every path, or `undefined`. */
const header = (entries, key) => entries.find((e) => e.source === '/:path*')?.headers.find((h) => h.key === key)?.value;

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL;
  if (ORIGINAL_BUCKET === undefined) delete process.env.NEXT_PUBLIC_STORAGE_BUCKET;
  else process.env.NEXT_PUBLIC_STORAGE_BUCKET = ORIGINAL_BUCKET;
});

describe('next.config — X-Robots-Tag', () => {
  it('P18.4-T5 asks every path of every non-production deployment not to be indexed', async () => {
    for (const appEnv of ['staging', 'development', 'demo']) {
      const entries = await headersFor(appEnv);
      // P19.17-T3 (ADR-0269 §3): one entry, every path — the guides' own policies (ADR-0219 §3) went with the guides.
      expect(entries.map((e) => e.source)).toEqual(['/:path*']);
      expect(header(entries, 'X-Robots-Tag')).toBe('noindex');
    }
  });

  it('P18.4-T5 fails closed: unset or misspelled is noindex too', async () => {
    for (const appEnv of [undefined, '', 'Production', 'prod']) {
      expect(header(await headersFor(appEnv), 'X-Robots-Tag')).toBe('noindex');
    }
  });

  it('P18.4-T5 sends no robots header from production', async () => {
    expect(header(await headersFor('production'), 'X-Robots-Tag')).toBeUndefined();
  });

  it('P18.4-T5 keeps the settings it had', () => {
    expect(nextConfig).toMatchObject({
      reactStrictMode: true,
      poweredByHeader: false,
      eslint: { ignoreDuringBuilds: false },
      typescript: { ignoreBuildErrors: false },
    });
  });
});

describe('next.config — the Content-Security-Policy (P19.6-T2, ADR-0217 §6)', () => {
  it('P19.6-T2 AC-5 frames production’s bucket alone, by its path, on every path of production', async () => {
    expect(header(await headersFor('production'), 'Content-Security-Policy')).toBe(
      "frame-src https://storage.googleapis.com/agencyboost-prod-assets/; object-src 'none'; base-uri 'self'",
    );
  });

  it('P19.6-T2 AC-5 frames staging’s bucket alone on staging, whatever a stray variable says', async () => {
    expect(header(await headersFor('staging', 'somebody-elses-bucket'), 'Content-Security-Policy')).toBe(
      "frame-src https://storage.googleapis.com/agencyboost-staging-assets/; object-src 'none'; base-uri 'self'",
    );
  });

  it('P19.6-T2 AC-5 frames nothing without a bucket — local development without storage, CI, a misspelled name', async () => {
    for (const appEnv of ['development', 'test', 'demo', undefined, 'prod']) {
      expect(header(await headersFor(appEnv), 'Content-Security-Policy'))
        .toBe("frame-src 'none'; object-src 'none'; base-uri 'self'");
    }
  });

  it('P19.6-T2 AC-5 frames a developer’s own bucket, and refuses a value that is no bucket’s name', async () => {
    expect(header(await headersFor('development', 'dev-zul-assets'), 'Content-Security-Policy'))
      .toBe("frame-src https://storage.googleapis.com/dev-zul-assets/; object-src 'none'; base-uri 'self'");
    for (const bad of ['', ' ', 'x; script-src *', 'UPPER', "a' 'unsafe-inline"]) {
      expect(storageBucketFor({ NEXT_PUBLIC_APP_ENV: 'development', NEXT_PUBLIC_STORAGE_BUCKET: bad })).toBeNull();
    }
  });

  it('P19.6-T2 AC-5 never names unsafe-inline, a bare host, a script or a style source', async () => {
    for (const bucket of [null, 'agencyboost-prod-assets']) {
      const policy = contentSecurityPolicy(bucket);
      expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|script-src|style-src|default-src/);
      expect(policy).not.toMatch(/storage\.googleapis\.com(?!\/)/);
      expect(policy.split('; ').map((d) => d.split(' ')[0])).toEqual(['frame-src', 'object-src', 'base-uri']);
    }
  });
});
