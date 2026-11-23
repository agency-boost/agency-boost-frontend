import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KEPT_ELSEWHERE, KEPT_ENGLISH, SAME_IN_INDONESIAN } from './glossary';
import { isKept, kept, type Kept } from './kept';

const KEPT_TERMS: ReadonlySet<string> = new Set(Object.values(KEPT_ENGLISH).flat());

/**
 * **P18.10-T1 AC-7: the approved kept-English list is one list in the catalogue** (OD-237; the glossary for approval's
 * §A), and a kept term reads the same in both languages and is marked.
 */
describe('P18.10-T1 AC-7 the kept-English list', () => {
  it.each(Object.entries(KEPT_ENGLISH))('lists each term of §A’s %s once, as it is drawn', (_, terms) => {
    const list = terms as readonly string[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.filter((term, i) => list.indexOf(term) !== i)).toEqual([]);
    expect(list.filter((term) => term !== term.trim() || term === '' || /\s{2}/.test(term))).toEqual([]);
  });

  it('keeps every name in the metric registry, and only those, under metrics (§A.4)', () => {
    const registry = readFileSync(
      join(__dirname, '..', '..', '..', 'backend', 'src', 'domain', 'constants', 'metrics.ts'), 'utf8',
    );
    const names = [...registry.matchAll(/\{ key: '[A-Z0-9_]+', name: '([^']+)'/g)].map((m) => m[1]);
    // 82 since P19.1-T6: the *Potensi* tab's three (ADR-0193). 84 since P19.3-T1: two retired (`NET_APE`,
    // `ACTIVITY_LOGGED_THIS_MONTH`) and four registered (`MOC_APE` and the data sources' three; ADR-0200 to ADR-0203).
    // 90 since P19.5-T4: the surveys' six (ADR-0216 §4). 92 since P19.5-T2: the Data upload's two (ADR-0214 §10, §11).
    // 112 on 2026-11-06: P19.7-T2's `PROPOSALS_MADE` (ADR-0221 §6) and P19.5-T3's advanced analytics' nineteen.
    // 113 since P19.8-T2: Home's `OWN_OPEN_LEADS` (ADR-0228 §4, OD-283). 114 since P19.12-T6:
    // `ABS_NOT_IN_INFORMAL_GROUP` (ADR-0249 §4). 120 since P19.17-T1: the 19 November definitions' six (ADR-0267). 119 on
    // 2026-11-20: P19.19-T3's `MANAGED_LEADS_RATE` (ADR-0272 §6) in, P19.18's `AA_THIS_MONTH` and `REKRUT_THIS_MONTH` out.
    // 121 since P19.22-T6, T7: `NPS_KPM_OVERALL` and `QUAL_PERSON_ISSUE_ITEMS` (ADR-0276 §1, §5). 122 since P19.25-T4:
    // `TRAINING_MODULE_DONE_COUNT` (ADR-0282 §2). 123 since P19.25: `EVENT_KEHADIRAN` (ADR-0281). 124 since P19.26-T1:
    // `COUNTED_MEMBERS` (ADR-0284 §1).
    expect(names).toHaveLength(124);
    expect([...KEPT_ENGLISH.metrics].sort()).toEqual([...names].sort());
  });

  it('holds the words the glossary writes alike in both languages apart from the kept ones', () => {
    expect(SAME_IN_INDONESIAN.filter((word) => KEPT_TERMS.has(word))).toEqual([]);
  });

  it('P18.10-T4 lists as kept elsewhere only words a part of §A keeps, so a translated homonym is one by name', () => {
    expect(KEPT_ELSEWHERE.filter((word) => !KEPT_TERMS.has(word))).toEqual([]);
  });
});

describe('P18.10-T1 AC-7 kept()', () => {
  it('reads the same in both languages: it is the term itself', () => {
    const term: string = kept('Leads management');
    expect(term).toBe('Leads management');
  });

  it('marks what it names, so that ID mode can give it lang="en" (P18.10-T7)', () => {
    expect(isKept('Strategic Leader Forum')).toBe(false);
    kept('Strategic Leader Forum');
    expect(isKept('Strategic Leader Forum')).toBe(true);
    // Words that are not a kept term, and what is not words at all, are not marked.
    expect(isKept('Simpan')).toBe(false);
    expect(isKept(undefined)).toBe(false);
  });

  it('accepts only a term the approved glossary keeps, spelled as it keeps it: anything else fails tsc', () => {
    // @ts-expect-error — not on §A's list: a translated word cannot be passed off as a kept one
    const notKept = kept('Simpan');
    // @ts-expect-error — the list's term is *Leads management*: a misspelling fails
    const misspelt = kept('Lead management');
    const typed: Kept<'Leads management'> = kept('Leads management');
    // @ts-expect-error — a plain string is not a kept term
    const passedOff: Kept<'Leads management'> = 'Leads management';
    expect([notKept, misspelt, typed, passedOff]).toHaveLength(4);
  });
});
