import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parse, renderable, sourceFiles, SRC } from '@test/copy-scan';

/**
 * **Training's own strings** (P18.5-T1 AC-10, T4 AC-2; the contract's *Module strings*): none of OD-39's
 * six words — *office*, *KPM*, *reports to*, *tagged to*, *untagged*, *unassigned* — no phase, and, per
 * OD-150 (ADR-0140), no promise of the reader's *Skill Tracker*, which the prototype's two footers made
 * (`Overall.html:3730`, `:3763`) and nothing keeps. The office's own words (a category's label and
 * description) arrive as data and are the office's.
 *
 * Read from the syntax tree, as the phase and permission scans are, so a comment never counts. A literal
 * with no space in it is a code, a path or a permission, not copy.
 */
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;
const PHASE = /\bphase\s*\{|\bphase\s+\d|\blater\s+phase\b/i;
const SKILL_TRACKER = /skill\s+tracker/i;

const MINE = [
  'components/training/',
  'lib/training.ts',
  'app/(agent)/training/',
  'app/(agent)/coaching/me/training/',
  'app/(agent)/coaching/[membershipId]/training/',
];

function offending(fileName: string, source: string, pattern: RegExp): string[] {
  const sf = parse(fileName, source);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const text = renderable(node);
    if (text !== null && /\s/.test(text.trim()) && pattern.test(text)) found.push(JSON.stringify(text.replace(/\s+/g, ' ').trim()));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('training’s own copy', () => {
  const files = sourceFiles().filter((f) => MINE.some((m) => f.startsWith(m)) && !/\.spec\.tsx?$/.test(f));

  it('finds the module’s files, so a silent zero cannot pass', () => {
    expect(files).toEqual(expect.arrayContaining([
      'components/training/training-catalog.tsx',
      'components/training/training-module.tsx',
      'components/training/training-parts.tsx',
      'components/training/person-training.tsx',
      'lib/training.ts',
      'app/(agent)/training/page.tsx',
      'app/(agent)/training/[categoryCode]/[moduleCode]/page.tsx',
      'app/(agent)/coaching/me/training/page.tsx',
    ]));
  });

  it('catches a sentence that names one, and lets a code through', () => {
    expect(offending('x.tsx', 'export const X = () => <p>Ask your office</p>;', SIX_WORDS)).toHaveLength(1);
    expect(offending('x.ts', "export const a = 'It will update your Skill Tracker.';", SKILL_TRACKER)).toHaveLength(1);
    expect(offending('x.ts', "export const a = api('/kpm/settings/training');", SIX_WORDS)).toEqual([]);
    expect(offending('x.ts', '// the office uploads\nexport const a = 1;', SIX_WORDS)).toEqual([]);
  });

  it.each([
    ['OD-39’s six words', SIX_WORDS],
    ['a phase', PHASE],
    ['the Skill Tracker (OD-150)', SKILL_TRACKER],
  ])('writes none of %s', (_, pattern) => {
    const offenders = files.flatMap((f) =>
      offending(f, readFileSync(join(SRC, f), 'utf8'), pattern).map((hit) => `src/${f}: ${hit}`));
    expect(offenders).toEqual([]);
  });
});

/**
 * P18.5-T1 AC-8, the settings leak closed: `GET /kpm/settings/training` and its module reads are the office's
 * administration's (`training_settings:read`), and **no field screen calls them** — the learner reads only
 * what is offered, through `/training/*`. The API refuses a field rung 403 whatever this finds.
 */
describe('no field screen calls the training settings reads (P18.5-T1 AC-8)', () => {
  const SETTINGS_READS = /\blistTraining\b|\breadModuleContent\b|\bmoduleContentUrl\b|\/kpm\/settings\/training/;
  const field = sourceFiles().filter((f) =>
    (f.startsWith('app/(agent)/') || f.startsWith('components/training/') || f === 'lib/training.ts') && !/\.spec\.tsx?$/.test(f));

  it('finds the field screens, so a silent zero cannot pass', () => {
    expect(field).toEqual(expect.arrayContaining(['app/(agent)/training/layout.tsx', 'lib/training.ts']));
  });

  it('none of them names a settings read', () => {
    expect(field.filter((f) => SETTINGS_READS.test(readFileSync(join(SRC, f), 'utf8')))).toEqual([]);
  });
});
