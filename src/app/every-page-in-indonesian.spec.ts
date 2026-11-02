import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **P18.98-T7 AC-1: every page is rendered in ID mode somewhere, and read for English left.** Two kinds of case count:
 *
 * - **`screens.a11y.spec.tsx`'s cases in Indonesian** — a case named `(id)`, `(…, id)` or *in Indonesian* — whose
 *   `expectClean` reads the screen for a message missing and for any area's English the glossary does not keep, then
 *   runs axe with the kept terms marked `lang="en"`. Its name begins with the route.
 * - **A module's own Indonesian spec** that imports the page and reads it with `englishShown` (`test/english-left.ts`),
 *   which reports a missing message too.
 *
 * Every `page.tsx` is found by reading `src/app`, so a route added without a case in Indonesian fails here.
 */
const SRC = resolve(__dirname, '..');
const APP = join(SRC, 'app');
const files = readdirSync(SRC, { encoding: 'utf8', recursive: true });

/** `(agent)/coaching/[membershipId]/page.tsx` → `/coaching/[membershipId]`: route groups are not in the address. */
const routeOf = (file: string) =>
  `/${relative(APP, file).replace(/(^|\/)page\.tsx$/, '').split('/').filter((s) => s && !/^\(.*\)$/.test(s)).join('/')}`;

const PAGES = new Map(
  files.filter((f) => (f.startsWith('app/') && f.endsWith('/page.tsx')) || f === 'app/page.tsx')
    .map((f) => [routeOf(join(SRC, f)), join(SRC, f).replace(/\.tsx$/, '')] as const),
);

/** The routes `screens.a11y.spec.tsx` renders in Indonesian, read off its cases' names. */
const IN_INDONESIAN = /(?:\(|, )id[,)]|Indonesian/;
const a11y = readFileSync(join(APP, 'screens.a11y.spec.tsx'), 'utf8');
const A11Y_ROUTES = new Set(
  [...a11y.matchAll(/expectClean\((['`])([^'`]*)\1/g)]
    .map((m) => m[2])
    .filter((name) => IN_INDONESIAN.test(name))
    .map((name) => `/${(/^[\w\-/[\]]*/.exec(name)?.[0] ?? '').replace(/^\//, '')}`),
);

/** Each page a module's Indonesian spec imports and reads with `englishShown`. */
const SPEC_ROUTES = new Map<string, string[]>();
for (const file of files.filter((f) => /\.spec\.tsx?$/.test(f))) {
  const path = join(SRC, file);
  const text = readFileSync(path, 'utf8');
  if (!text.includes('englishShown(')) continue;
  for (const [, from] of text.matchAll(/from '([^']+)'/g)) {
    const target = from.startsWith('@/') ? join(SRC, from.slice(2)) : from.startsWith('.') ? resolve(dirname(path), from) : null;
    const route = [...PAGES].find(([, page]) => page === target?.replace(/\.tsx?$/, ''))?.[0];
    if (route) SPEC_ROUTES.set(route, [...(SPEC_ROUTES.get(route) ?? []), file]);
  }
}

describe('P18.98-T7 AC-1 every page is read in ID mode', () => {
  it('finds the pages and the cases at all, so a silent zero cannot pass', () => {
    expect(PAGES.size).toBeGreaterThan(90);
    expect(A11Y_ROUTES.size).toBeGreaterThan(80);
    expect(SPEC_ROUTES.size).toBeGreaterThan(50);
  });

  it('renders every route in Indonesian, in the screens’ axe cases or in its module’s own Indonesian spec', () => {
    const uncovered = [...PAGES.keys()].filter((route) => !A11Y_ROUTES.has(route) && !SPEC_ROUTES.has(route)).sort();
    expect(uncovered).toEqual([]);
  });
});
