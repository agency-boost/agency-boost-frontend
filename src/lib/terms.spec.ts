import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  activityTermMentions, CONTENT_TERM_KEYS, firstMentions, termAt, termQuestion, TERM_KEYS, TERMS,
} from './terms';

/**
 * **P18.95-T9 AC-3: one line per term, each from the glossary** (ADR-0167 §10, OD-205; the client's UI review,
 * UI-028). The glossary is read, as the docs gates read it, so a term whose row is renamed or removed fails here
 * rather than going on explaining a word the documentation no longer defines.
 *
 * **Where the superproject is beside this checkout** — a laptop, the superproject's cross-repo job. This
 * repository's own CI checks out the backend beside it and not the docs, so there these cases are skipped, and
 * the same pin runs in `scripts/check-docs.py` (6c), which cannot be skipped.
 */
const GLOSSARY_PATH = join(__dirname, '..', '..', '..', 'docs', '00-product', 'glossary.md');
const HAS_GLOSSARY = existsSync(GLOSSARY_PATH);
const GLOSSARY = HAS_GLOSSARY ? readFileSync(GLOSSARY_PATH, 'utf8') : '';

/** Every row's *Term* cell: the first cell of a table row, its markdown stripped. */
const GLOSSARY_TERMS = new Set(
  GLOSSARY.split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| Term ') && !line.startsWith('|---'))
    .map((line) => line.split('|')[1].trim().replace(/\*/g, '')),
);

describe.skipIf(!HAS_GLOSSARY)('P18.95-T9 AC-3 the terms and the glossary', () => {
  it('reads the glossary’s rows at all, so a silent zero cannot pass', () => {
    expect(GLOSSARY_TERMS.size).toBeGreaterThan(200);
    expect(GLOSSARY_TERMS.has('APE')).toBe(true);
  });

  it.each(TERM_KEYS)('P18.95-T9 AC-3 %s is written from a row the glossary has', (key) => {
    expect(GLOSSARY_TERMS.has(TERMS[key].glossary)).toBe(true);
  });
});

describe('P18.95-T9 AC-3 the terms', () => {
  it('P18.95-T9 AC-3, P18.97-T3 AC-8 holds the eleven the client named, and MOC and the three clubs (UI-021)', () => {
    expect(TERM_KEYS).toEqual([
      'APE', 'MDRT', 'AAB', 'NBO', 'NPA', 'BOP', 'JFW', 'TOUCHES', 'CI_PREMIUM_WAIVER', 'AS_BILLED', 'POTENTIAL_MAA',
      'MOC', 'STAR_CLUB', 'ELITE_CLUB', 'CHAIRMANS_CLUB',
    ]);
  });

  it('P18.97-T3 AC-8 names each club’s ⓘ for the club, and states no threshold: each company sets its own', () => {
    expect(termQuestion('MOC')).toBe('What is MOC?');
    expect(termQuestion('STAR_CLUB')).toBe('What is Star Club?');
    expect(termQuestion('CHAIRMANS_CLUB')).toBe('What is Chairman’s Club?');
    for (const key of ['MOC', 'STAR_CLUB', 'ELITE_CLUB', 'CHAIRMANS_CLUB'] as const) {
      expect(TERMS[key].definition).not.toMatch(/Rp|\d/);
    }
    expect(termAt("Chairman's Club", 'CHAIRMANS_CLUB')).toEqual([0, 15]);
    expect(termAt('Chairman’s Club', 'CHAIRMANS_CLUB')).toEqual([0, 15]);
    expect(termAt('STAR CLUB', 'STAR_CLUB')).toEqual([0, 9]);
  });

  it.each(TERM_KEYS)('P18.95-T9 AC-3 gives %s one plain line', (key) => {
    const { definition } = TERMS[key];
    expect(definition).not.toMatch(/\n/);
    expect(definition.length).toBeLessThanOrEqual(160);
    expect(definition).toMatch(/\.$/);
    // A definition, not a pointer: no code, no route, no phase.
    expect(definition).not.toMatch(/[A-Z]{3,}_|\/[a-z]|phase \d/);
  });
});

describe.skipIf(!HAS_GLOSSARY)('P18.95-T9 AC-3 the terms against the glossary’s Gloss column', () => {
  it('P18.95-T9 AC-3 spells out each acronym as the glossary’s Gloss column does', () => {
    const gloss = (term: string) => GLOSSARY.split('\n').find((line) => line.startsWith(`| ${term} |`))!.split('|')[3].trim();
    for (const key of ['APE', 'MDRT', 'AAB', 'NBO', 'BOP', 'MOC'] as const) {
      expect(TERMS[key].definition.startsWith(`${gloss(TERMS[key].glossary)}:`)).toBe(true);
    }
  });
});

describe('P18.95-T9 AC-3 each ⓘ’s name and line', () => {
  it('P18.95-T9 AC-3 names each ⓘ What is {term}?', () => {
    expect(termQuestion('APE')).toBe('What is APE?');
    expect(termQuestion('TOUCHES')).toBe('What is a touch?');
    expect(termQuestion('AS_BILLED')).toBe('What is as-billed?');
  });

  it('P18.95-T9 AC-4 defines Potential MAA as a projection, never as the active-agent count (invariant §8)', () => {
    expect(TERMS.POTENTIAL_MAA.definition).toMatch(/pacing/);
    expect(TERMS.POTENTIAL_MAA.definition).toMatch(/projection, not a sale/);
    expect(TERMS.POTENTIAL_MAA.definition).not.toMatch(/active this month/i);
  });
});

describe('P18.95-T9 AC-3 finding a term in somebody else’s words', () => {
  it('finds a term where it stands, whole words only', () => {
    expect(termAt('Proses NPA', 'NPA')).toEqual([7, 10]);
    expect(termAt('optional CI premium waiver.', 'CI_PREMIUM_WAIVER')).toEqual([9, 26]);
    expect(termAt('As-billed inpatient reimbursement.', 'AS_BILLED')).toEqual([0, 9]);
    expect(termAt('NPAX', 'NPA')).toBeNull();
    expect(termAt('3 touches', 'TOUCHES')).toEqual([2, 9]);
  });

  it('marks each term on the first text that names it, in reading order, and never again', () => {
    expect(firstMentions(['Proses NPA', 'NPA lagi, JFW', null, 'JFW'], ['NPA', 'JFW'])).toEqual([['NPA'], ['JFW'], [], []]);
    expect(firstMentions(['APE and MDRT'], ['APE', 'MDRT'])).toEqual([['APE', 'MDRT']]);
    // A term the screen explains elsewhere, above these, is not marked again.
    expect(firstMentions(['Total touches'], ['TOUCHES'], ['TOUCHES'])).toEqual([[]]);
  });

  it('never looks for touch or Potential MAA in content: a personal touch is not a logged one', () => {
    expect(CONTENT_TERM_KEYS).not.toContain('TOUCHES');
    expect(CONTENT_TERM_KEYS).not.toContain('POTENTIAL_MAA');
    expect(firstMentions(['A personal touch, every call'], CONTENT_TERM_KEYS)).toEqual([[]]);
  });

  it('P18.97-T3 AC-8 never looks for MOC or a club in content: the Year-End Star Club Drive is a campaign, not the tier', () => {
    for (const key of ['MOC', 'STAR_CLUB', 'ELITE_CLUB', 'CHAIRMANS_CLUB'] as const) expect(CONTENT_TERM_KEYS).not.toContain(key);
    expect(firstMentions(['Year-End Star Club Drive'], CONTENT_TERM_KEYS)).toEqual([[]]);
  });

  it('reads an office’s activities section by section, each label before its note, archived ones left out', () => {
    const found = activityTermMentions([
      {
        code: 'RECRUITMENT',
        types: [
          { code: 'OLD', label: 'Proses NPA lama', status: 'archived' },
          { code: 'RECRUIT_AGENT_CODE', label: 'Proses NPA', description: null, status: 'active' },
        ],
      },
      {
        code: 'TEAM',
        types: [{ code: 'DEV_TEAM_ACTIVITY', label: 'Aktivitas team', description: 'role-play, JFW, NPA', status: 'active' }],
      },
    ]);
    expect(found.get('RECRUITMENT')).toEqual(new Map([['RECRUIT_AGENT_CODE:label', ['NPA']]]));
    expect(found.get('TEAM')).toEqual(new Map([['DEV_TEAM_ACTIVITY:description', ['JFW']]]));
  });
});
