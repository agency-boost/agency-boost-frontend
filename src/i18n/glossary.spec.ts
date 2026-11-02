import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KEPT_ELSEWHERE, KEPT_ENGLISH, SAME_IN_INDONESIAN } from './glossary';
import { isKept, kept, type Kept } from './kept';

const KEPT_TERMS: ReadonlySet<string> = new Set(Object.values(KEPT_ENGLISH).flat());

/**
 * **P18.98-T1 AC-7: the approved kept-English list is one list in the catalogue** (OD-237; the glossary for approval's
 * §A), and a kept term reads the same in both languages and is marked.
 */
describe('P18.98-T1 AC-7 the kept-English list', () => {
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
    expect(names).toHaveLength(79);
    expect([...KEPT_ENGLISH.metrics].sort()).toEqual([...names].sort());
  });

  it('holds the words the glossary writes alike in both languages apart from the kept ones', () => {
    expect(SAME_IN_INDONESIAN.filter((word) => KEPT_TERMS.has(word))).toEqual([]);
  });

  it('P18.98-T4 lists as kept elsewhere only words a part of §A keeps, so a translated homonym is one by name', () => {
    expect(KEPT_ELSEWHERE.filter((word) => !KEPT_TERMS.has(word))).toEqual([]);
  });
});

describe('P18.98-T1 AC-7 kept()', () => {
  it('reads the same in both languages: it is the term itself', () => {
    const term: string = kept('Leads management');
    expect(term).toBe('Leads management');
  });

  it('marks what it names, so that ID mode can give it lang="en" (P18.98-T7)', () => {
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
