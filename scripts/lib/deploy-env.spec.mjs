import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertDeployEnv, DEMO_ACCOUNT_ENVS, DEPLOY_TARGETS, DeployEnvError, shouldScanForDemoCredentials,
} from './deploy-env.mjs';

/** The frontend root. `__dirname`, as the house's specs read files: under jsdom `import.meta.url` is no file URL. */
const ROOT = join(__dirname, '..', '..');

/**
 * P18.7-T5: the check `vercel-build.mjs` runs before `next build`. Each refusal here is a bundle that would
 * otherwise have been built with the wrong API inlined into it, and found only by its readers.
 */

const PRODUCTION = {
  VERCEL_ENV: 'production',
  NEXT_PUBLIC_APP_ENV: 'production',
  NEXT_PUBLIC_API_ORIGIN: 'https://api.agencyboost.id',
};
const STAGING = {
  VERCEL_ENV: 'preview',
  NEXT_PUBLIC_APP_ENV: 'staging',
  NEXT_PUBLIC_API_ORIGIN: 'https://staging-api.agencyboost.id',
};

/** The problems a refusal lists, or a failure if it was not refused. */
function refusal(env) {
  try {
    assertDeployEnv(env);
  } catch (err) {
    expect(err).toBeInstanceOf(DeployEnvError);
    return err;
  }
  throw new Error(`expected a refusal for ${JSON.stringify(env)}`);
}

describe('assertDeployEnv — the two deployments, and nothing else', () => {
  it('P18.7-T5 builds production with production’s values, and scans the output for seeded credentials', () => {
    expect(assertDeployEnv(PRODUCTION)).toEqual({
      name: 'production', appEnv: 'production', apiOrigin: 'https://api.agencyboost.id', scanForDemoCredentials: true,
    });
  });

  it('P18.7-T5 builds staging with staging’s values, and keeps its demo panel unscanned (ADR-0041)', () => {
    expect(assertDeployEnv(STAGING)).toEqual({
      name: 'staging', appEnv: 'staging', apiOrigin: 'https://staging-api.agencyboost.id', scanForDemoCredentials: false,
    });
  });

  it('P18.7-T5 treats the variables naming production as production, whatever VERCEL_ENV says', () => {
    const { VERCEL_ENV: _unset, ...local } = PRODUCTION;
    expect(assertDeployEnv(local).name).toBe('production');
    expect(refusal({ ...local, NEXT_PUBLIC_API_ORIGIN: 'https://staging-api.agencyboost.id' }).problems)
      .toEqual(['This is a production build, so NEXT_PUBLIC_API_ORIGIN must be "https://api.agencyboost.id"; '
        + 'it is "https://staging-api.agencyboost.id".']);
  });

  it('P18.7-T5 refuses a build with either variable unset or empty, naming each', () => {
    expect(refusal({ VERCEL_ENV: 'production' }).problems)
      .toEqual(['NEXT_PUBLIC_APP_ENV is not set.', 'NEXT_PUBLIC_API_ORIGIN is not set.']);
    expect(refusal({ ...STAGING, NEXT_PUBLIC_API_ORIGIN: '' }).problems).toEqual(['NEXT_PUBLIC_API_ORIGIN is not set.']);
    expect(refusal({ ...STAGING, NEXT_PUBLIC_APP_ENV: undefined }).problems).toEqual(['NEXT_PUBLIC_APP_ENV is not set.']);
  });

  it('P18.7-T5 refuses a Production scope holding staging’s values, both of them named', () => {
    expect(refusal({ ...STAGING, VERCEL_ENV: 'production' }).problems).toEqual([
      'This is a production build, so NEXT_PUBLIC_APP_ENV must be "production"; it is "staging".',
      'This is a production build, so NEXT_PUBLIC_API_ORIGIN must be "https://api.agencyboost.id"; '
        + 'it is "https://staging-api.agencyboost.id".',
    ]);
  });

  it('P18.7-T5 refuses staging pointed at production’s API, or at any other', () => {
    // The pairing the Origin guard exists for (plan T1): one site, so production's cookie would follow.
    for (const origin of ['https://api.agencyboost.id', 'http://localhost:3001', 'https://staging-api.agencyboost.id.evil.test']) {
      expect(refusal({ ...STAGING, NEXT_PUBLIC_API_ORIGIN: origin }).problems).toEqual([
        `This is a staging build, so NEXT_PUBLIC_API_ORIGIN must be "https://staging-api.agencyboost.id"; it is "${origin}".`,
      ]);
    }
  });

  it('P18.7-T5 compares exactly, so a pasted newline or a trailing slash is shown, not built', () => {
    const problems = refusal({ ...PRODUCTION, NEXT_PUBLIC_API_ORIGIN: 'https://api.agencyboost.id\n' }).problems;
    expect(problems[0]).toContain('it is "https://api.agencyboost.id\\n"');
    expect(refusal({ ...PRODUCTION, NEXT_PUBLIC_API_ORIGIN: 'https://api.agencyboost.id/' }).problems).toHaveLength(1);
    expect(refusal({ ...PRODUCTION, NEXT_PUBLIC_APP_ENV: 'Production' }).problems).toHaveLength(1);
  });

  it('P18.7-T5 refuses every other environment — development, demo, a typo — because none deploys here', () => {
    for (const appEnv of ['development', 'demo', 'prod', 'Staging', 'preview']) {
      const err = refusal({ VERCEL_ENV: 'preview', NEXT_PUBLIC_APP_ENV: appEnv, NEXT_PUBLIC_API_ORIGIN: 'https://staging-api.agencyboost.id' });
      expect(err.problems).toEqual([
        `NEXT_PUBLIC_APP_ENV is "${appEnv}". A Vercel build is production or staging, and nothing else deploys `
          + 'from this project (ADR-0154).',
      ]);
    }
  });

  it('P18.7-T5 says where to fix it, and that a fix needs a redeploy', () => {
    const { message } = refusal({ VERCEL_ENV: 'production' });
    expect(message).toMatch(/^vercel-build: refusing to build\./);
    expect(message).toContain('Settings → Environment Variables');
    expect(message).toContain('Preview scoped to the `development` branch');
    expect(message).toContain('needs a redeploy');
  });

  it('P18.7-T5 pins the two deployments to the domains the product owner fixed (plan D1)', () => {
    expect(DEPLOY_TARGETS).toEqual({
      production: { appEnv: 'production', apiOrigin: 'https://api.agencyboost.id' },
      staging: { appEnv: 'staging', apiOrigin: 'https://staging-api.agencyboost.id' },
    });
    expect(Object.isFrozen(DEPLOY_TARGETS.production)).toBe(true);
  });
});

describe('shouldScanForDemoCredentials — check:secrets after the build', () => {
  it('P18.7-T5 skips the scan for development and staging only, whose builds keep the panel by design', () => {
    expect(shouldScanForDemoCredentials('development')).toBe(false);
    expect(shouldScanForDemoCredentials('staging')).toBe(false);
  });

  it('P18.7-T5 scans everything else, and fails closed on unset or unknown', () => {
    for (const appEnv of ['production', 'demo', 'Staging', '', undefined]) {
      expect(shouldScanForDemoCredentials(appEnv)).toBe(true);
    }
  });

  it('P18.7-T5 skips exactly the environments src/lib/demo-accounts.ts compiles the accounts into', () => {
    // Two copies of one list, across a TypeScript/bare-Node boundary: this is what keeps them one list. A
    // value added there and not here would fail the staging build on its own panel; one added here and
    // not there would skip the scan on a build that should have had it.
    const source = readFileSync(join(ROOT, 'src/lib/demo-accounts.ts'), 'utf8');
    const gate = /const IS_DEMO_BUILD =([^;]+);/.exec(source);
    expect(gate).not.toBeNull();
    const compiledIn = [...gate[1].matchAll(/NEXT_PUBLIC_APP_ENV === '([^']+)'/g)].map((m) => m[1]);
    expect([...DEMO_ACCOUNT_ENVS].sort()).toEqual(compiledIn.sort());
  });
});

describe('vercel.json and package.json — what hands a deployment to this check', () => {
  const read = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));

  it('P18.7-T5 builds through vercel-build.mjs, from the lockfile as committed', () => {
    const vercel = read('vercel.json');
    expect(vercel).toMatchObject({
      framework: 'nextjs',
      installCommand: 'pnpm install --frozen-lockfile',
      buildCommand: 'node scripts/vercel-build.mjs',
    });
    expect(read('package.json').scripts['vercel-build']).toBe('node scripts/vercel-build.mjs');
  });

  it('P18.7-T5 deploys main and development and no other branch (ADR-0154)', () => {
    // `**`, not `*`: Vercel matches with minimatch, where `*` stops at a slash, so `*: false` would let
    // every `phase-NN/…` branch through. A branch matching several rules deploys if any is true, which
    // is what lets the two named ones out from under `**`.
    expect(read('vercel.json').git).toEqual({ deploymentEnabled: { '**': false, main: true, development: true } });
  });

  it('P18.7-T5 pins pnpm and Node for CI and Vercel alike (plan D7)', () => {
    const pkg = read('package.json');
    expect(pkg.packageManager).toBe('pnpm@10.33.0');
    expect(pkg.engines).toEqual({ node: '24.x' });
  });
});
