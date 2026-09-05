#!/usr/bin/env node
/**
 * The seeded development credentials must never reach a built bundle.
 *
 * They are offered on the sign-in screen to make review easier, which is safe only
 * while it is true in `next dev` and nowhere else. A runtime guard is not enough: an
 * earlier version hid the panel correctly and still shipped the strings, because the
 * constant was bundled whether or not anything rendered it. `DEMO_ACCOUNTS` now folds
 * to `[]` under `NODE_ENV=production`, and this checks that it actually did.
 *
 * Usage: pnpm build && node scripts/check-no-demo-credentials.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What actually ships. `.next/cache` is deliberately excluded: it is webpack's
 * incremental build cache, it holds module sources for every branch the compiler saw
 * including the ones it then eliminated, and it is not deployed. Scanning it would
 * report a leak that does not exist and train everyone to ignore this check.
 */
const SHIPPED = ['.next/static', '.next/server', '.next/standalone'];

/** Read from the source of truth, so a new demo account is covered without editing this. */
const source = readFileSync('src/lib/demo-accounts.ts', 'utf8');
const secrets = [...source.matchAll(/(?:email|password):\s*'([^']+)'/g)].map((m) => m[1]);

if (secrets.length === 0) {
  console.error(
    'Found no credentials in src/lib/demo-accounts.ts to check for.\n' +
      'Either the file moved or its shape changed — this check must not pass by\n' +
      'having nothing to look for. Update scripts/check-no-demo-credentials.mjs.',
  );
  process.exit(1);
}

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

const present = SHIPPED.filter((d) => {
  try {
    return statSync(d).isDirectory();
  } catch {
    return false;
  }
});

// `.next/standalone` only exists under `output: 'standalone'`, so its absence is fine —
// but if none of them exist there was no build, and passing would mean nothing.
if (present.length === 0) {
  console.error(
    `None of ${SHIPPED.join(', ')} exist. Run \`pnpm build\` first — this check must
` +
      'not pass by having nothing to scan.',
  );
  process.exit(1);
}

const hits = [];
for (const file of present.flatMap((d) => [...files(d)])) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // binary or unreadable — nothing to match
  }
  for (const secret of secrets) {
    if (text.includes(secret)) hits.push({ file, secret });
  }
}

console.log(`checked ${present.join(', ')} for ${secrets.length} seeded credential(s)`);

if (hits.length > 0) {
  console.error('\n::error::Development credentials reached the build output:');
  for (const { file, secret } of hits) console.error(`  ${file} contains "${secret}"`);
  console.error(
    '\nTwo build-time gates keep these out, and either one alone is enough — so both\n' +
      'have been removed or defeated:\n' +
      '  1. DEMO_ACCOUNTS folds to [] under NODE_ENV=production (src/lib/demo-accounts.ts)\n' +
      '  2. DemoAccountsPanel returns null when showDemoAccounts() is false\n' +
      'Both rely on `process.env.NODE_ENV` being statically replaceable. Reading it\n' +
      'through a variable, or behind a dynamic import, defeats the fold.',
  );
  process.exit(1);
}

console.log('none present — the panel exists in `next dev` only');
