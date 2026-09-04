#!/usr/bin/env node
/**
 * Enforce the First Load JS budget from docs/02-specs/nfr/performance-and-scale.md.
 *
 * "First Load JS" is Next's own figure: the *gzipped* size of the *shared* chunks a
 * visitor actually downloads on first paint. It is not the size of .next/static/chunks,
 * which is uncompressed, includes every route's chunk, and includes polyfills only
 * legacy browsers ever fetch — measuring that reported 766 kB against a 200 kB budget
 * for a page whose real cost is 102 kB.
 *
 * Usage: pnpm build | node scripts/check-bundle-size.mjs
 *        node scripts/check-bundle-size.mjs --budget 200 < build.log
 */
import { readFileSync } from 'node:fs';

const BUDGET_KB = Number(
  process.argv.includes('--budget')
    ? process.argv[process.argv.indexOf('--budget') + 1]
    : (process.env.FIRST_LOAD_JS_BUDGET_KB ?? 200),
);

const input = readFileSync(0, 'utf8');

/** Next prints e.g. `+ First Load JS shared by all             102 kB`. */
const SHARED = /First Load JS shared by all\s+([\d.]+)\s*(kB|MB|B)\b/;
/**
 * And per route, e.g. `┌ ○ /    123 B    103 kB` — note the *route size* is two
 * tokens ("123 B"), so a single \S+ swallows only the number and leaves the unit
 * where the First Load figure is expected.
 */
const ROUTE = /^[┌├└]\s+\S+\s+\S+\s+[\d.]+\s*(?:B|kB|MB)\s+([\d.]+)\s*(kB|MB|B)\s*$/gm;

function toKb(value, unit) {
  const n = Number(value);
  if (unit === 'MB') return n * 1024;
  if (unit === 'B') return n / 1024;
  return n;
}

const shared = input.match(SHARED);
if (!shared) {
  console.error(
    'Could not find "First Load JS shared by all" in the build output.\n' +
      'This check must fail rather than pass silently — a budget that cannot read the\n' +
      'number it guards is worse than no budget. If the Next.js output format changed,\n' +
      'update scripts/check-bundle-size.mjs.',
  );
  process.exit(1);
}

const sharedKb = toKb(shared[1], shared[2]);

/** The heaviest single route, which is what a first-time visitor to it pays. */
let worstRouteKb = 0;
for (const m of input.matchAll(ROUTE)) {
  worstRouteKb = Math.max(worstRouteKb, toKb(m[1], m[2]));
}

const measured = Math.max(sharedKb, worstRouteKb);
const verdict = measured <= BUDGET_KB ? 'within' : 'OVER';

console.log(`First Load JS (shared):     ${sharedKb.toFixed(1)} kB`);
console.log(`First Load JS (worst route): ${worstRouteKb.toFixed(1)} kB`);
console.log(`Budget:                     ${BUDGET_KB} kB  — ${verdict}`);

if (measured > BUDGET_KB) {
  console.error(
    `::error::First Load JS is ${measured.toFixed(1)} kB against a ${BUDGET_KB} kB budget. ` +
      `The agent's daily loop runs on a mid-range Android over 4G — see ` +
      `docs/02-specs/nfr/performance-and-scale.md before raising this.`,
  );
  process.exit(1);
}
