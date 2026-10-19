import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parse, renderable, sourceFiles, SRC } from '@test/copy-scan';
import { APE, campaign, CHALLENGE, chased, LIST, MDRT, NEW_HIRE, PERSISTENCY, PROMO_AGENT, PUSH, SPRINT } from '@test/campaigns-fixtures';
import {
  chasedToast, figureWords, kindLabel, POSTER_COLORS, progressWords, requirementsLine, requirementWords, rowSubline,
  seasonalSections, statusWords, structuralSections, unchasedToast,
} from './campaigns';

describe('a campaign in words (P18.5-T7 AC-3, P18.5-T8 AC-6)', () => {
  it('P18.5-T7 AC-3 money is rupiah from sen, never raw sen (invariant §9, X-68’s rule)', () => {
    expect(figureWords(50_000_000_000, 'idr_minor')).toBe('Rp 500.000.000');
    expect(figureWords(90, 'percentage')).toBe('90%');
    expect(figureWords(3, 'count')).toBe('3');
    expect(figureWords(0.15, 'ratio')).toBe('0.15');
  });

  it('P18.5-T7 AC-3 the card’s line is each requirement in words, joined by " | " (`:8031-8034`)', () => {
    expect(requirementsLine([APE(500), NEW_HIRE(1)])).toBe('APE achieved Rp 500.000.000 | New Hire 1');
    expect(requirementWords(PERSISTENCY)).toBe('Rolling persistency 90%');
    expect(requirementWords({ ...NEW_HIRE(2), comparator: 'lt' })).toBe('New Hire under 2');
    expect(requirementsLine([])).toBe('');
  });

  it('P18.5-T7 AC-3 the status tag: the phase for a seasonal campaign, Ongoing for a structural one', () => {
    expect(statusWords(SPRINT)).toBe('Running');
    expect(statusWords(CHALLENGE)).toBe('Upcoming');
    expect(statusWords(PUSH)).toBe('Ended');
    expect(statusWords(MDRT)).toBe('Ongoing');
  });

  it('P18.5-T7 AC-6 the Summary row’s kindLabel and sub-line (`:6233-6243`)', () => {
    expect(kindLabel(SPRINT)).toBe('Running');
    expect(kindLabel(CHALLENGE)).toBe('Upcoming');
    expect(kindLabel(PROMO_AGENT)).toBe('Promotion path');
    expect(kindLabel(MDRT)).toBe('Ongoing incentive');
    expect(rowSubline(chased(SPRINT))).toBe('Running · Oct 1 – Dec 31, 2026');
  });

  it('P18.5-T7 AC-5 the two toasts, verbatim (`:8144`)', () => {
    expect(chasedToast('Q4 APE Sprint')).toBe('Now chasing "Q4 APE Sprint"');
    expect(unchasedToast('Q4 APE Sprint')).toBe('Removed "Q4 APE Sprint" from your chase list');
  });

  it('P18.5-T8 AC-6 progress: "{current} of {target}", met only when met, and never ✕ for a month not held', () => {
    const row = { metricKey: 'APE_ACHIEVED', current: 62_000_000_000, target: 50_000_000_000, unit: 'idr_minor' };
    expect(progressWords({ ...row, state: 'met' })).toEqual({ text: 'Rp 620.000.000 of Rp 500.000.000', met: true, figure: true });
    expect(progressWords({ ...row, state: 'in_progress' })).toEqual({ text: 'Rp 620.000.000 of Rp 500.000.000', met: false, figure: true });
    expect(progressWords({ ...row, state: 'not_met' })?.met).toBe(false);
    expect(progressWords({ ...row, current: null, state: 'not_uploaded' })).toEqual({ text: 'Not uploaded yet', met: false, figure: false });
    expect(progressWords({ ...row, current: null, state: 'not_measured' })).toEqual({ text: 'Not measured yet', met: false, figure: false });
    // An activity reading with nothing logged is not a file awaited (the review, item 6).
    expect(progressWords({ ...row, unit: 'ratio', current: null, state: 'nothing_logged' })).toEqual({ text: 'Nothing logged yet', met: false, figure: false });
    // A row with no figure the server did not explain is still not ✕: it is a month not held.
    expect(progressWords({ ...row, current: null, state: 'in_progress' })?.text).toBe('Not uploaded yet');
    expect(progressWords(undefined)).toBeNull();
  });
});

describe('the list’s sections (P18.5-T7 AC-2, D-lists)', () => {
  it('P18.5-T7 AC-2 Running, Upcoming, Ended for the seasonal view, the filter keeping one', () => {
    const all = seasonalSections(LIST.campaigns, 'all');
    expect(all.map((s) => [s.heading, s.items.map((c) => c.code)])).toEqual([
      ['Running', ['APE_SPRINT', 'NEW_HIRE_BLITZ']],
      ['Upcoming', ['APE_CHALLENGE_NEXT']],
      ['Ended', ['PERSISTENCY_PUSH']],
    ]);
    expect(seasonalSections(LIST.campaigns, 'upcoming').map((s) => s.heading)).toEqual(['Upcoming']);
    expect(all.map((s) => s.empty)).toEqual(['No running campaigns right now.', 'No upcoming campaigns.', 'No ended campaigns to show.']);
  });

  it('P18.5-T7 AC-2 Promotion Criteria and Production Clubs for the structural view, a running structural one never seasonal', () => {
    const sections = structuralSections(LIST.campaigns);
    expect(sections.map((s) => [s.heading, s.items.map((c) => c.code)])).toEqual([
      ['Promotion Criteria', ['PROMOTION_AGENT_AAB', 'PROMOTION_AAB_AB']],
      ['Production Clubs', ['MDRT_QUALIFICATION']],
    ]);
    expect(seasonalSections([MDRT], 'all').every((s) => s.items.length === 0)).toBe(true);
    expect(sections.map((s) => s.empty)).toEqual(['No promotion criteria published yet.', 'No ongoing incentives right now.']);
  });

  it('D-lists: the server’s order is kept, not re-sorted', () => {
    const z = campaign({ code: 'Z', title: 'Zeta' });
    const a = campaign({ code: 'A', title: 'Alpha' });
    expect(seasonalSections([z, a], 'running')[0].items.map((c) => c.code)).toEqual(['Z', 'A']);
  });

  it('row 44: the poster palette is the contract’s seven token names', () => {
    expect(POSTER_COLORS).toEqual(['amber', 'amber-dark', 'navy', 'navy-soft', 'muted', 'success', 'gold']);
  });
});

/**
 * The campaigns module's own strings use none of OD-39's six words, no phase and no code (the build contract,
 * *Module strings*): *office*, *KPM*, *reports to*, *tagged to*, *untagged*, *unassigned*. The prototype's
 * verbatim words that carry one go to the client with OD-39 — the sub-line, and the *KPM* tag, a word alone —
 * and are named here, so a new one cannot slip in beside them.
 */
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;
const VERBATIM = new Set([
  JSON.stringify("Company and KPM campaigns — mark the ones you're chasing, click into any card for full requirements."),
]);
const MINE = ['components/campaigns/', 'lib/campaigns.ts', 'app/(agent)/campaigns/'];

function sixWords(fileName: string, source: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const text = renderable(node);
    if (text !== null && /\s/.test(text.trim()) && SIX_WORDS.test(text)) {
      const hit = JSON.stringify(text.replace(/\s+/g, ' ').trim());
      if (!VERBATIM.has(hit)) found.push(hit);
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(fileName, source));
  return found;
}

describe('the campaigns module’s own copy', () => {
  const files = sourceFiles().filter((f) => MINE.some((m) => f.startsWith(m)));

  it('finds the module’s files, so a silent zero cannot pass', () => {
    expect(files).toEqual(expect.arrayContaining([
      'components/campaigns/campaign-list.tsx',
      'components/campaigns/campaign-dialog.tsx',
      'components/campaigns/campaign-parts.tsx',
      'components/campaigns/chasing-card.tsx',
      'lib/campaigns.ts',
      'app/(agent)/campaigns/layout.tsx',
    ]));
  });

  it('catches a sentence that names one, and lets the verbatim sub-line through', () => {
    expect(sixWords('x.tsx', 'export const X = () => <p>Ask your office</p>;')).toHaveLength(1);
    expect(sixWords('x.ts', 'export const a = "Company and KPM campaigns — mark the ones you\'re chasing, click into any card for full requirements.";')).toEqual([]);
    expect(sixWords('x.ts', "export const a = 'KPM';")).toEqual([]);
  });

  it('writes none of OD-39’s six words beyond the prototype’s own', () => {
    const offenders = files.flatMap((f) => sixWords(f, readFileSync(join(SRC, f), 'utf8')).map((hit) => `src/${f}: ${hit}`));
    expect(offenders).toEqual([]);
  });
});
