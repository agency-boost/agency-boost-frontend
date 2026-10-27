import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parse, renderable, sourceFiles, SRC } from '@test/copy-scan';
import { APE, campaign, CHALLENGE, chased, LIST, MDRT, NEW_HIRE, PERSISTENCY, PROMO_AGENT, PUSH, SPRINT } from '@test/campaigns-fixtures';
import {
  chasedToast, figureWords, kindLabel, OWN_COPY, POSTER_COLORS, progressWords, requirementsLine, requirementWords, rowSubline,
  seasonalSections, showsChase, statusWords, structuralSections, unchasedToast,
} from './campaigns';

describe('a campaign in words (P18.5-T7 AC-3, P18.5-T8 AC-6)', () => {
  it('P18.5-T7 AC-3 money is rupiah from sen, never raw sen (invariant §9, X-68’s rule)', () => {
    expect(figureWords(50_000_000_000, 'idr_minor')).toBe('Rp 500 jt');
    expect(figureWords(90, 'percentage')).toBe('90,0%');
    expect(figureWords(3, 'count')).toBe('3');
    expect(figureWords(0.15, 'ratio')).toBe('0,15');
  });

  it('P18.95-T1 AC-2, AC-3 a requirement is compact, never rounded into another rule, and in id-ID', () => {
    // Rp 2,45 M would round to Rp 2,5 M: a different requirement. It is written in full instead.
    expect(figureWords(245_000_000_000, 'idr_minor')).toBe('Rp 2.450.000.000');
    expect(figureWords(240_000_000_000, 'idr_minor')).toBe('Rp 2,4 M');
    expect(figureWords(92.5, 'percentage')).toBe('92,5%');
    expect(figureWords(1_250, 'count')).toBe('1.250');
  });

  it('P18.95-T10 AC-3 the client’s line: Needs: Rp 16 jt APE + 3 new hires', () => {
    expect(OWN_COPY.needs).toBe('Needs:');
    expect(`${OWN_COPY.needs} ${requirementsLine([APE(16), NEW_HIRE(3)])}`).toBe('Needs: Rp 16 jt APE + 3 new hires');
  });

  it('P18.95-T10 AC-3 APE only, new hires only, both: each its own words, the figure first, joined by " + "', () => {
    expect(requirementsLine([APE(500)])).toBe('Rp 500 jt APE');
    expect(requirementsLine([NEW_HIRE(3)])).toBe('3 new hires');
    expect(requirementsLine([NEW_HIRE(1)])).toBe('1 new hire');
    expect(requirementsLine([APE(1200), NEW_HIRE(6)])).toBe('Rp 1,2 M APE + 6 new hires');
    expect(requirementsLine([])).toBe('');
  });

  it('P18.95-T10 AC-3 a threshold compact writing would round is written in full, never as another rule', () => {
    // Rp 16,25 jt would read Rp 16,3 jt — a different requirement.
    expect(requirementsLine([APE(16.25), NEW_HIRE(3)])).toBe('Rp 16.250.000 APE + 3 new hires');
    expect(requirementWords(APE(2450))).toBe('Rp 2.450.000.000 APE');
  });

  it('P18.95-T10 AC-3 every campaign-evaluable count has its noun; a comparison other than at least is said', () => {
    const count = (metricKey: string, value: number) => ({ ...NEW_HIRE(value), metricKey, metricName: metricKey });
    expect(requirementWords(count('NEW_ACTIVE_AGENTS', 2))).toBe('2 new active agents');
    expect(requirementWords(count('MAA_COUNT_IN_UNIT', 5))).toBe('5 active agents in unit');
    expect(requirementWords(count('MAA_COUNT_IN_UNIT', 1))).toBe('1 active agent in unit');
    expect(requirementWords(count('CASCADE_ACTIVITY_TOUCHES', 40))).toBe('40 goal activities');
    expect(requirementWords(PERSISTENCY)).toBe('90,0% rolling persistency');
    expect(requirementWords({ ...NEW_HIRE(2), comparator: 'lt' })).toBe('under 2 new hires');
    expect(requirementWords({ ...NEW_HIRE(2), comparator: 'gt' })).toBe('more than 2 new hires');
    expect(requirementWords({ ...APE(500), comparator: 'lte' })).toBe('at most Rp 500 jt APE');
    expect(requirementWords({ ...NEW_HIRE(3), comparator: 'eq' })).toBe('exactly 3 new hires');
  });

  it('P18.95-T10 AC-3 a ratio, the balance and a metric with no noun keep "{name} {target}"', () => {
    const ratio = { ...PERSISTENCY, metricKey: 'SELLING_SUCCESS_RATE', metricName: 'Selling success rate', value: 0.15, unit: 'ratio' };
    const balance = {
      ...PERSISTENCY, metricKey: 'SELLING_RECRUITMENT_BALANCE', metricName: 'Selling vs Recruitment balance', comparator: 'lte' as const,
      value: 30, unit: 'percentage_points',
    };
    expect(requirementWords(ratio)).toBe('Selling success rate 0,15');
    expect(requirementWords(balance)).toBe('Selling vs Recruitment balance at most ±30 points');
    expect(requirementWords(APE(600, { metricKey: 'NET_APE', metricName: 'Net APE', measured: false }))).toBe('Net APE Rp 600 jt');
    expect(requirementsLine([APE(16), ratio])).toBe('Rp 16 jt APE + Selling success rate 0,15');
  });

  it('P18.95-T10 AC-2 the chase is drawn only while the campaign has not ended, and only where the reader may chase', () => {
    expect(showsChase(SPRINT, { chase: true })).toBe(true);
    expect(showsChase(CHALLENGE, { chase: true })).toBe(true);
    expect(showsChase(PUSH, { chase: true })).toBe(false);
    expect(showsChase({ chaseBlocked: 'not_eligible' }, { chase: true })).toBe(true);
    expect(showsChase(SPRINT, { chase: false })).toBe(false);
  });

  it('P18.5-T7 AC-3 the status tag: the phase for a seasonal campaign, Ongoing for a structural one', () => {
    expect(statusWords(SPRINT)).toBe('Running');
    expect(statusWords(CHALLENGE)).toBe('Upcoming');
    expect(statusWords(PUSH)).toBe('Ended');
    expect(statusWords(MDRT)).toBe('Ongoing');
  });

  it('P18.5-T7 AC-6 the Summary row’s kindLabel (`:6233-6235`)', () => {
    expect(kindLabel(SPRINT)).toBe('Running');
    expect(kindLabel(CHALLENGE)).toBe('Upcoming');
    expect(kindLabel(PROMO_AGENT)).toBe('Promotion path');
    expect(kindLabel(MDRT)).toBe('Ongoing incentive');
  });

  it('P18.95-T7 AC-1 the Summary row’s sub-line is the months it runs, as the server composes them (grey text row 23)', () => {
    expect(rowSubline(chased(SPRINT))).toBe('Runs Okt – Des 2026');
    expect(rowSubline(chased(MDRT))).toBe('Runs Jan – Des');
    expect(rowSubline(chased(PROMO_AGENT))).toBe('Runs over the last 12 months');
    expect(rowSubline({ ...chased(MDRT), runs: 'Runs Feb – Mar 2027' })).toBe('Runs Feb – Mar 2027');
  });

  it('P18.5-T7 AC-5 the two toasts, verbatim (`:8144`)', () => {
    expect(chasedToast('Q4 APE Sprint')).toBe('Now chasing "Q4 APE Sprint"');
    expect(unchasedToast('Q4 APE Sprint')).toBe('Removed "Q4 APE Sprint" from your chase list');
  });

  it('P18.5-T8 AC-6 progress: "{current} of {target}", met only when met, and never ✕ for a month not held', () => {
    const row = { metricKey: 'APE_ACHIEVED', current: 62_000_000_000, target: 50_000_000_000, unit: 'idr_minor' };
    expect(progressWords({ ...row, state: 'met' })).toEqual({ text: 'Rp 620 jt of Rp 500 jt', met: true, figure: true });
    expect(progressWords({ ...row, state: 'in_progress' })).toEqual({ text: 'Rp 620 jt of Rp 500 jt', met: false, figure: true });
    // A current figure compact writing would round is written in full, so it never reads as the target it misses.
    expect(progressWords({ ...row, current: 49_996_000_000, state: 'in_progress' })?.text).toBe('Rp 499.960.000 of Rp 500 jt');
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
  // The prototype's sub-line, saying *tap any card* where it said *click into any card* (P18.95-T9 AC-5).
  JSON.stringify("Company and KPM campaigns — mark the ones you're chasing, tap any card for full requirements."),
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
    expect(sixWords('x.ts', 'export const a = "Company and KPM campaigns — mark the ones you\'re chasing, tap any card for full requirements.";')).toEqual([]);
    expect(sixWords('x.ts', "export const a = 'KPM';")).toEqual([]);
  });

  it('writes none of OD-39’s six words beyond the prototype’s own', () => {
    const offenders = files.flatMap((f) => sixWords(f, readFileSync(join(SRC, f), 'utf8')).map((hit) => `src/${f}: ${hit}`));
    expect(offenders).toEqual([]);
  });
});
