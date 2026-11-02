/**
 * **What a Vercel build must be told before it may build** (P18.7-T5, ADR-0152, ADR-0154).
 *
 * Exactly two deployments build on Vercel — `main` as production and `development` as staging — and each
 * has exactly one right pair of values. Both are `NEXT_PUBLIC_*`, so `next build` inlines them into the
 * client bundle: a wrong one is not a setting to correct at runtime but a bundle to throw away, and the
 * error a reader meets is CORS refusing every call. So the build checks them first and refuses to start.
 *
 * Pure on purpose: it reads the environment it is handed and throws, and `vercel-build.mjs` does the
 * exiting. That is what lets a spec walk every case without running a build.
 */

/** The two deployments, and the only values each may be built with. Domains: plan D1, ADR-0152. */
export const DEPLOY_TARGETS = Object.freeze({
  production: Object.freeze({ appEnv: 'production', apiOrigin: 'https://api.agencyboost.id' }),
  staging: Object.freeze({ appEnv: 'staging', apiOrigin: 'https://staging-api.agencyboost.id' }),
});

/**
 * The environments whose build keeps the seeded development accounts (ADR-0041) — the list
 * `src/lib/demo-accounts.ts` folds on. A build for one of them carries the strings by design, so
 * `check-no-demo-credentials.mjs` would fail it for being what it is meant to be.
 *
 * Repeated here, not imported: that file is TypeScript compiled by Next, and this one runs under bare
 * Node before Next has run. The spec pins the two lists against each other.
 */
export const DEMO_ACCOUNT_ENVS = Object.freeze(['development', 'staging']);

export class DeployEnvError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(
      'vercel-build: refusing to build.\n'
        + problems.map((p) => `  - ${p}`).join('\n')
        + '\n\nSet them in Vercel → Project → Settings → Environment Variables: Production for `main`, '
        + 'Preview scoped to the `development` branch for staging (frontend/README.md, Deployment). '
        + 'NEXT_PUBLIC_* values are inlined at build time, so changing one needs a redeploy.',
    );
    this.name = 'DeployEnvError';
    this.problems = problems;
  }
}

/** JSON-quoted, so a trailing newline from a pasted value shows instead of looking right. */
const shown = (value) => JSON.stringify(value);

/**
 * Which deployment this build is, or a `DeployEnvError` naming everything wrong with it.
 *
 * Production is either Vercel saying so (`VERCEL_ENV=production`) or the variables saying so: whichever
 * claims it, both values must be production's, so a Production scope holding staging's values is
 * refused, and so is a scope mixing the two. Anything that is neither production nor `staging` —
 * `development`, `demo`, a typo — is refused too: no other deployment builds here.
 *
 * Compared exactly, with no trimming: a stray newline from a pasted value would survive into every URL
 * `src/lib/api.ts` builds, so it is refused here rather than discovered there.
 *
 * @param {Record<string, string | undefined>} env usually `process.env`
 * @returns {{ name: 'production' | 'staging', appEnv: string, apiOrigin: string, scanForDemoCredentials: boolean }}
 */
export function assertDeployEnv(env) {
  const appEnv = env.NEXT_PUBLIC_APP_ENV;
  const apiOrigin = env.NEXT_PUBLIC_API_ORIGIN;

  const missing = [
    ['NEXT_PUBLIC_APP_ENV', appEnv],
    ['NEXT_PUBLIC_API_ORIGIN', apiOrigin],
  ].filter(([, value]) => !value).map(([name]) => `${name} is not set.`);
  if (missing.length > 0) throw new DeployEnvError(missing);

  const name = env.VERCEL_ENV === 'production' || appEnv === 'production'
    ? 'production'
    : appEnv === 'staging' ? 'staging' : null;

  if (name === null) {
    throw new DeployEnvError([
      `NEXT_PUBLIC_APP_ENV is ${shown(appEnv)}. A Vercel build is production or staging, and nothing `
        + 'else deploys from this project (ADR-0154).',
    ]);
  }

  const want = DEPLOY_TARGETS[name];
  const problems = [];
  if (appEnv !== want.appEnv) {
    problems.push(`This is a ${name} build, so NEXT_PUBLIC_APP_ENV must be ${shown(want.appEnv)}; it is ${shown(appEnv)}.`);
  }
  if (apiOrigin !== want.apiOrigin) {
    problems.push(
      `This is a ${name} build, so NEXT_PUBLIC_API_ORIGIN must be ${shown(want.apiOrigin)}; it is ${shown(apiOrigin)}.`,
    );
  }
  if (problems.length > 0) throw new DeployEnvError(problems);

  return { name, appEnv, apiOrigin, scanForDemoCredentials: shouldScanForDemoCredentials(appEnv) };
}

/**
 * Whether the build output is scanned for the seeded credentials: every build except one for an
 * environment that keeps them on purpose (ADR-0041). Fails closed — unset or unknown means scan.
 *
 * @param {string | undefined} appEnv
 */
export function shouldScanForDemoCredentials(appEnv) {
  return !DEMO_ACCOUNT_ENVS.includes(appEnv ?? '');
}
