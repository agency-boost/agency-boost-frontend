import { afterEach, describe, expect, it } from 'vitest';
import nextConfig from './next.config.mjs';

/**
 * P18.7-T5: the noindex header. Inverted, it would take production out of search and leave staging — the
 * one with the seeded accounts on its sign-in screen — in it, so the direction is pinned here.
 */
const ORIGINAL = process.env.NEXT_PUBLIC_APP_ENV;

async function headersFor(appEnv) {
  if (appEnv === undefined) delete process.env.NEXT_PUBLIC_APP_ENV;
  else process.env.NEXT_PUBLIC_APP_ENV = appEnv;
  return nextConfig.headers();
}

describe('next.config — X-Robots-Tag', () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL;
  });

  it('P18.7-T5 asks every path of every non-production deployment not to be indexed', async () => {
    for (const appEnv of ['staging', 'development', 'demo']) {
      expect(await headersFor(appEnv)).toEqual([
        { source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
      ]);
    }
  });

  it('P18.7-T5 fails closed: unset or misspelled is noindex too', async () => {
    for (const appEnv of [undefined, '', 'Production', 'prod']) {
      expect(await headersFor(appEnv)).toHaveLength(1);
    }
  });

  it('P18.7-T5 sends no robots header from production', async () => {
    expect(await headersFor('production')).toEqual([]);
  });

  it('P18.7-T5 keeps the settings it had', () => {
    expect(nextConfig).toMatchObject({
      reactStrictMode: true,
      poweredByHeader: false,
      eslint: { ignoreDuringBuilds: false },
      typescript: { ignoreBuildErrors: false },
    });
  });
});
