#!/usr/bin/env node
/**
 * **Vercel's build command** (`vercel.json`, P18.7-T5, ADR-0152, ADR-0154). Three steps, each of which
 * fails the deployment:
 *
 * 1. the environment must name one of the two deployments exactly (`lib/deploy-env.mjs`, which has the
 *    rules and the spec), because the values are inlined into the bundle and cannot be fixed afterwards;
 * 2. `next build`;
 * 3. `check-no-demo-credentials.mjs` against what was built — skipped only for an environment that
 *    keeps the seeded accounts on purpose (ADR-0041), where the scan would fail on the panel it is
 *    meant to have.
 *
 * The bundle-size budget is not here: it stays in GitHub CI, which builds every pull request.
 *
 * Usage: node scripts/vercel-build.mjs   (it runs a real `next build`; nothing here is a dry run)
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { assertDeployEnv, DeployEnvError } from './lib/deploy-env.mjs';

/** The frontend root, so the check's relative paths hold whatever directory this was started from. */
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Run a Node entrypoint with this Node, inheriting stdio; a non-zero exit fails the build with it. */
function run(label, script, args = []) {
  console.log(`\nvercel-build: ${label}`);
  const { status, signal, error } = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, stdio: 'inherit' });
  if (error) throw error;
  if (status !== 0) {
    console.error(`vercel-build: ${label} failed (${signal ?? `exit ${status}`}).`);
    process.exit(status || 1);
  }
}

let target;
try {
  target = assertDeployEnv(process.env);
} catch (err) {
  if (!(err instanceof DeployEnvError)) throw err;
  console.error(err.message);
  process.exit(1);
}
console.log(
  `vercel-build: ${target.name} — NEXT_PUBLIC_APP_ENV=${target.appEnv}, NEXT_PUBLIC_API_ORIGIN=${target.apiOrigin}`,
);

// Next's own bin, resolved rather than looked up on PATH: a custom build command is not an npm script,
// so node_modules/.bin is not promised to be on it.
run('next build', createRequire(import.meta.url).resolve('next/dist/bin/next'), ['build']);

if (target.scanForDemoCredentials) {
  run('no development credentials in the build output', 'scripts/check-no-demo-credentials.mjs');
} else {
  console.log(`\nvercel-build: ${target.appEnv} keeps the demo-accounts panel by design (ADR-0041); no scan.`);
}
