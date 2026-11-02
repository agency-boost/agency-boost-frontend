import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **A card never pulls a screen** (P18.98-T4, the bundle, 2026-10-29). `SummaryCard` and `SectionChips` moved out of
 * `personal-summary.tsx` because importing a card from there loaded the whole Summary — its cards, its catalogue in both
 * languages, the campaigns' chasing card — onto every coaching route, and three of them passed their 200 kB budget.
 * Only the two Summary pages draw the Summary; everything else draws the card from `summary-card.tsx`.
 */
describe('the Summary is imported by the Summary only (P18.98-T4, the bundle)', () => {
  const SRC = join(__dirname, '..');
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/\.spec\./.test(e.name) ? [join(dir, e.name)] : []);
  const ALLOWED = [
    join('app', '(agent)', 'summary', 'page.tsx'),
    join('app', '(agent)', 'coaching', '[membershipId]', 'summary', 'page.tsx'),
  ];

  it('no other module imports a value from personal-summary', () => {
    const offenders = files(SRC)
      .filter((f) => !ALLOWED.some((a) => f.endsWith(a)))
      .filter((f) => /^import \{[^}]*\} from '@\/components\/personal-summary';$/m.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });
});
