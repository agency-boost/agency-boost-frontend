import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import { detail, NONE_CHASED, RINA_CHASING, serverError, SPRINT } from '@test/campaigns-fixtures';
import PersonalSummaryPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => '/summary',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/** The address's query (`useQuery`, `lib/use-query.ts`): each test names its own, and starts from none. */
beforeEach(() => { nav.search = ''; });

const AGENT = makeMe({ permissions: ['personal_summary:read'] });
const M = 1_000_000 * 100;

const figures = (over: Record<string, unknown> = {}) => ({
  targetMinor: 75 * M, actualMinor: 30 * M, attainmentPct: 40, gapMinor: 45 * M, overMinor: 0,
  policiesNeeded: 3, targetMet: false, ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({
  year: '2026', month: '2026-09', today: '2026-09-14',
  period: { firstMonth: '2026-01', thisMonth: '2026-09', currentMonth: true, currentYear: true },
  goal: { set: true, savedAt: '2026-09-01T02:00:00.000Z' }, caseSizeMinor: 18 * M,
  monthly: { ...figures(), source: { provenance: 'imported', month: '2026-09' } },
  yearly: {
    ...figures({ targetMinor: 500 * M, actualMinor: 230 * M, attainmentPct: 46, gapMinor: 270 * M, policiesNeeded: 15 }),
    source: { provenance: 'imported', month: '2026-09' },
  },
  pace: {
    closingTarget: 5, closingsLast30Days: 4, dayOfMonth: 14, daysInMonth: 30, weeksLeft: 3, policiesNeeded: 3,
    neededPerWeek: 1, targetMet: false,
  },
  activity: { monthly: activity(), yearly: activity(YEAR) },
  leads: { rows: LEADS, total: LEADS.length },
  insights: [],
  ...over,
});

const openLead = (over: Record<string, unknown>) => ({
  id: 'l-1', name: 'Pak Hendro Gunawan', type: 'sales', statusCode: 'FOLLOW_UP', statusLabel: 'Follow-up',
  thisMonth: false, flags: [], overdueDays: null, nextActionDate: '2026-09-20', nextActionNote: null, ...over,
});
const LEADS = [
  openLead({ id: 'l-1', thisMonth: true, flags: ['overdue'], overdueDays: 6, nextActionDate: '2026-09-08', nextActionNote: 'Chase the illustration.' }),
  openLead({ id: 'l-2', name: 'Ibu Wulan Sari', statusLabel: 'Policy submitted', nextActionDate: '2026-09-16' }),
  openLead({ id: 'l-3', name: 'Pak Bambang', type: null, statusCode: null, statusLabel: null, flags: ['no-next-action'], nextActionDate: null }),
];

const chip = (key: string, code: string, logged: number, target: number | null, attainmentPct: number | null) =>
  ({ key, code, logged, target, attainmentPct, targetMet: target !== null && logged >= target });
function activity(over: Record<string, unknown> = {}) {
  return {
    from: '2026-09-01', to: '2026-09-14',
    targets: [
      chip('leads', 'LEADS_CONTACTED', 20, 57, 35),
      chip('appointments', 'SELL_PRESENTATION', 6, 17, 35),
      chip('closings', 'SELL_SUBMISSION', 2, 5, 40),
    ],
    total: 42,
    /*
     * The seed's two summary tiles, as the server groups them (ADR-0064): *Recruitment*, a section with
     * a tile of its own under its own code and label, and *Development*, the tile Personal Development
     * and Team Development share, under the group's code and label, its rows from both sections.
     */
    sections: [
      {
        code: 'RECRUITMENT', label: 'Recruitment', total: 6,
        rows: [
          { code: 'RECRUIT_PRESENTATION', label: 'Proses pendaftaran kode agen', count: 3 },
          { code: 'RECRUIT_FOLLOWUP', label: 'Follow up NBO', count: 2 },
          { code: 'RECRUIT_AGENT_CODE', label: 'NPA', count: 1 },
        ],
      },
      {
        code: 'DEVELOPMENT', label: 'Development', total: 7,
        rows: [
          { code: 'DEV_TRAINING_ATTEND', label: 'Menghadiri meeting atau training dari KPM atau Prudential', count: 2 },
          { code: 'DEV_COACHING_RECEIVED', label: '1-on-1 coaching dengan leader saya', count: 1 },
          { code: 'DEV_TEAM_ACTIVITY', label: 'Aktivitas team development', count: 4 },
        ],
      },
    ],
    ...over,
  };
}
const YEAR = {
  from: '2026-01-01',
  targets: [
    chip('leads', 'LEADS_CONTACTED', 120, 314, 38),
    chip('appointments', 'SELL_PRESENTATION', 36, 94, 38),
    chip('closings', 'SELL_SUBMISSION', 11, 28, 39),
  ],
  total: 310,
};

const ratio = (over: Record<string, unknown>) => ({
  code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', comparison: 'gte', displayUnit: 'percent',
  benchmark: 0.15, tag: null, sides: null, numerator: [], denominator: [], purpose: null, divergesFromStandard: false,
  value: 0.0909, share: null, numeratorCount: 1, denominatorCount: 11, status: 'alert', ...over,
});
const ratios = (list: unknown[]) => ({ membershipId: 'm-1', from: '2026-08-16', to: '2026-09-14', days: 30, ratios: list });
const AGENT_RATIOS = ratios([
  ratio({}),
  ratio({ code: 'LEADS_PER_ACTIVITY', label: 'Leads per activity', displayUnit: 'decimal', benchmark: 0.3, value: 0.375, status: 'success' }),
  ratio({ code: 'MEETING_PER_APPROACH', label: 'Meeting per approach', displayUnit: 'decimal', benchmark: 1.5, value: null, status: 'neutral' }),
]);

const show = (body: unknown, pulse: { status?: number; body: unknown } = { body: AGENT_RATIOS }) => {
  const stub = stubFetch({ '/summary': { body }, '/activity/ratios': pulse, 'GET /campaigns/chasing': { body: NONE_CHASED } });
  renderWithSession(<PersonalSummaryPage />, { me: AGENT });
  return stub;
};
const card = (name: string) => screen.findByRole('region', { name });

describe('the Personal Summary — goal versus actual, and the gap (P10-T4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1, P18.97-T3 AC-1: opens on this month — the produced figure, the target, the attainment whole and its bar', async () => {
    show(summary());
    const goal = await card('Goal vs. actual (APE)');

    expect(within(goal).getByText('IDR 30M')).toBeInTheDocument();
    expect(goal).toHaveTextContent('of IDR 75M target40%');
    expect(within(goal).getByText('This month')).toBeInTheDocument();
    expect(within(goal).getByRole('progressbar', { name: 'This month’s target' })).toHaveAttribute('aria-valuenow', '40');
    // The month the figures are for: the select names it on the screen (P18.8-T11), the line on paper.
    expect(screen.getByRole('combobox', { name: 'Month' })).toHaveDisplayValue('Sep 2026');
    expect(screen.getByText('Sep 2026', { selector: 'p' })).toHaveClass('hidden', 'print:block');
  });

  it('AC-1: switches to the year — the annual target against the year to date', async () => {
    show(summary());
    await card('Goal vs. actual (APE)');

    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));

    const goal = await card('Goal vs. actual (APE)');
    expect(within(goal).getByText('IDR 230M')).toBeInTheDocument();
    expect(goal).toHaveTextContent('of IDR 500M target46%');
    expect(within(goal).getByText('This year')).toBeInTheDocument();
    expect(await card('The gap')).toHaveTextContent('Remaining this yearIDR 270M');
  });

  it('AC-1: says this month is not uploaded yet — no zero, no attainment, no gap made up', async () => {
    show(summary({
      monthly: { ...figures({ actualMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }), source: null },
    }));
    const goal = await card('Goal vs. actual (APE)');

    expect(goal).toHaveTextContent('Not uploaded yetof IDR 75M target');
    expect(goal).not.toHaveTextContent('%');
    // No bar: an empty track under *Not uploaded yet* reads as zero.
    expect(within(goal).queryByRole('progressbar')).not.toBeInTheDocument();
    // Nothing produced, so nothing to mark: *Not uploaded yet* says it (P10.1-T6 AC-1). The one button is the
    // heading's *What is APE?* (P18.95-T9 AC-3).
    expect(within(goal).queryAllByRole('button').map((b) => b.textContent)).toEqual(['ⓘWhat is APE?']);
    const gap = await card('The gap');
    expect(gap).toHaveTextContent('Remaining this month—');
    expect(gap).not.toHaveTextContent('IDR 0');
  });

  it('AC-2: edits nothing — the figure is shown, and its marker says it is your own, from Goal Settings', async () => {
    show(summary({ yearly: { ...figures({ actualMinor: 120 * M }), source: { provenance: 'self_reported', month: null } } }));
    await card('Goal vs. actual (APE)');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));
    const goal = await card('Goal vs. actual (APE)');
    expect(within(goal).getByRole('button', { name: 'Your own figure, entered in Goal Settings' })).toBeInTheDocument();
  });

  it('AC-3: the gap in rupiah and in policies, one of which is singular', async () => {
    show(summary({ monthly: { ...figures({ policiesNeeded: 1 }), source: null } }));
    expect(await card('The gap')).toHaveTextContent('Remaining this monthIDR 45M≈ Policies still needed1 policy');
  });

  it('AC-3: a target reached says so, and asks for nothing (ADR-0047)', async () => {
    show(summary({
      monthly: { ...figures({ actualMinor: 95 * M, attainmentPct: 127, gapMinor: 0, overMinor: 20 * M, policiesNeeded: 0, targetMet: true }), source: null },
      pace: { closingTarget: 5, closingsLast30Days: 6, dayOfMonth: 20, daysInMonth: 30, weeksLeft: 2, policiesNeeded: 0, neededPerWeek: 0, targetMet: true },
    }));
    const gap = await card('The gap');
    expect(gap).toHaveTextContent('Reached — IDR 20M over');
    expect(gap).toHaveTextContent('≈ Policies still neededNone');
    expect(gap).toHaveTextContent('You’ve already reached this month’s target — nice work. Keep the pace to stay ahead.');
    // P13.1-T5 AC-1: the prototype's `.pace-note.on-track` (`Overall.html:1144`), with its ✅.
    const note = within(gap).getByText(/already reached/).closest('p')!;
    expect(note.className).toContain('bg-success/[0.06]');
    expect(note).toHaveTextContent('✅');
    expect(gap).not.toHaveTextContent('current pace');
  });

  /*
   * **P13.1-T5 (ADR-0109): the prototype's sentence, verbatim, on its danger box** (`Overall.html:3132-3135`,
   * `.pace-note` at `:1143`), every day of the month until the APE target is met. The server's four numbers
   * go in as they are: N the last 30 days' closings, M the closings target, W the weeks left, K a week.
   */
  it('P13.1-T5 AC-1 the client’s sentence: 21 closed against 10, two weeks left, 4 a week — on the danger box with ⚠️', async () => {
    show(summary({ pace: { closingTarget: 10, closingsLast30Days: 21, dayOfMonth: 17, daysInMonth: 30, weeksLeft: 2, policiesNeeded: 8, neededPerWeek: 4, targetMet: false } }));
    const gap = await card('The gap');
    expect(gap).toHaveTextContent(
      'At your current pace, you’re tracking to close 21 policies this month against a target of 10. With 2 weeks left, you’d need to close roughly 4 policies/week to catch up.',
    );
    const note = within(gap).getByText(/tracking to close/).closest('p')!;
    expect(note.className).toContain('bg-alert/[0.06]');
    expect(note.className).toContain('border-alert/20');
    expect(note).toHaveTextContent('⚠️');
    // The numbers are bold, as the prototype's `<strong>`s are.
    expect([...note.querySelectorAll('strong')].map((b) => b.textContent)).toEqual(['21 policies', '10', '4 policies/week']);
  });

  it('P13.1-T5 AC-1 on the 1st it is the same sentence and box: no grey first week, no count of the month so far', async () => {
    show(summary({ pace: { closingTarget: 5, closingsLast30Days: 3, dayOfMonth: 1, daysInMonth: 30, weeksLeft: 5, policiesNeeded: 5, neededPerWeek: 1, targetMet: false } }));
    const gap = await card('The gap');
    expect(gap).toHaveTextContent(
      'At your current pace, you’re tracking to close 3 policies this month against a target of 5. With 5 weeks left, you’d need to close roughly 1 policy/week to catch up.',
    );
    expect(gap).not.toHaveTextContent('You’ve closed');
    expect(within(gap).getByText(/tracking to close/).closest('p')!.className).not.toContain('bg-base');
  });

  it('P13.1-T5 AC-1 one is singular, as the prototype’s own *1 policy* is: the last week, one closing', async () => {
    show(summary({ pace: { closingTarget: 5, closingsLast30Days: 1, dayOfMonth: 30, daysInMonth: 30, weeksLeft: 1, policiesNeeded: 1, neededPerWeek: 1, targetMet: false } }));
    expect(await card('The gap')).toHaveTextContent(
      'At your current pace, you’re tracking to close 1 policy this month against a target of 5. With 1 week left, you’d need to close roughly 1 policy/week to catch up.',
    );
  });

  it('P13.1-T5 AC-1 closings at or past the target are still the danger box while the APE is short', async () => {
    show(summary({ pace: { closingTarget: 5, closingsLast30Days: 7, dayOfMonth: 14, daysInMonth: 30, weeksLeft: 3, policiesNeeded: 1, neededPerWeek: 1, targetMet: false } }));
    const note = within(await card('The gap')).getByText(/tracking to close/).closest('p')!;
    expect(note).toHaveTextContent('With 3 weeks left, you’d need to close roughly 1 policy/week to catch up.');
    expect(note.className).toContain('bg-alert/[0.06]');
    expect(note.className).not.toContain('bg-success');
  });

  it('AC-4: the pace is this month’s, so the year shows none', async () => {
    show(summary());
    await card('The gap');
    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));
    expect(await card('The gap')).not.toHaveTextContent('current pace');
  });

  it('AC-3: a year made before this month began leaves the month met and says so (ADR-0047)', async () => {
    show(summary({
      monthly: { targetMinor: 0, actualMinor: 30 * M, attainmentPct: null, gapMinor: 0, overMinor: 30 * M, policiesNeeded: 0, targetMet: true, source: { provenance: 'imported', month: '2026-09' } },
      pace: { closingTarget: 0, closingsLast30Days: 4, dayOfMonth: 14, daysInMonth: 30, weeksLeft: 3, policiesNeeded: 0, neededPerWeek: 0, targetMet: true },
    }));
    const goal = await card('Goal vs. actual (APE)');
    expect(goal).toHaveTextContent('Your year’s target was made before this month began — this month needs nothing more.');
    expect(goal).not.toHaveTextContent('of IDR 0 target');
    expect(await card('The gap')).toHaveTextContent('Reached — IDR 30M over');
  });

  it('AC-5: a saved goal with no APE target says so, rather than measuring against nothing', async () => {
    show(summary({
      monthly: { ...figures({ targetMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }), source: null },
      yearly: { ...figures({ targetMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }), source: { provenance: 'self_reported', month: null } },
      pace: null,
    }));
    expect(await screen.findByText('Your goal for 2026 has no APE target to measure against yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Goal Settings' })).toHaveAttribute('href', '/goals');
  });

  it('AC-5: no goal saved is no goal — nothing measured, and a way to set one', async () => {
    show(summary({ goal: { set: false, savedAt: null }, pace: null }));
    expect(await screen.findByText(/You haven’t set a goal for 2026 yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set your goal' })).toHaveAttribute('href', '/goals');
    // P18.95-T1 AC-10: a link on its own line is 44px tall on a phone (UI-029); wider, the inline block it was.
    expect(screen.getByRole('link', { name: 'Set your goal' })).toHaveClass('inline-block', 'max-md:inline-flex', 'max-md:min-h-11', 'max-md:items-center');
    expect(screen.queryByRole('region', { name: 'Goal vs. actual (APE)' })).not.toBeInTheDocument();
  });

  it('waits in the shape of cards, and says so when it fails', async () => {
    stubFetch({
      '/summary': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } } },
      '/activity/ratios': { body: AGENT_RATIOS },
    });
    renderWithSession(<PersonalSummaryPage />, { me: AGENT });
    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
  });
});

describe('the Personal Summary — activity targets, chips and the pulse (P10-T5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1: this month’s three counts against their targets, each with its bar, and where the targets come from', async () => {
    show(summary());
    const targets = await card('Your sales activity targets');

    expect(within(targets).getByText('This month')).toBeInTheDocument();
    // The cascade's words, as `/goals` names its stages (ADR-0160 §4).
    expect(targets).toHaveTextContent('Set appointment20 / 57');
    expect(targets).toHaveTextContent('Sales meeting6 / 17');
    expect(targets).toHaveTextContent('Submission polis2 / 5');
    expect(within(targets).getByRole('progressbar', { name: 'Submission polis against target' })).toHaveAttribute('aria-valuenow', '40');
    expect(within(targets).getByRole('progressbar', { name: 'Set appointment against target' })).toHaveAttribute('aria-valuetext', '20 of 57');
    expect(within(targets).getByRole('link', { name: 'Goal Settings' })).toHaveAttribute('href', '/goals');
    expect(targets).toHaveTextContent('42 activities this month');
    expect(targets).not.toHaveTextContent(/total activities logged|across all categories/);
    // P18.95-T7 AC-1 (grey text row 21): where the targets come from, from 768px; the client's *Remove* below it.
    expect(within(targets).getByRole('link', { name: 'Goal Settings' }).closest('p')).toHaveClass('max-md:hidden');
  });

  it('AC-1: the year to date against the year’s targets', async () => {
    show(summary());
    await card('Your sales activity targets');

    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));

    const targets = await card('Your sales activity targets');
    expect(within(targets).getByText('This year')).toBeInTheDocument();
    expect(targets).toHaveTextContent('Submission polis11 / 28');
    expect(targets).toHaveTextContent('310 activities this year');
  });

  it('AC-1: no goal is no target — the counts still show, and nothing is divided by zero (F-25)', async () => {
    const none = activity({
      targets: [chip('leads', 'LEADS_CONTACTED', 5, null, null), chip('appointments', 'SELL_PRESENTATION', 0, null, null), chip('closings', 'SELL_SUBMISSION', 1, null, null)],
    });
    show(summary({ goal: { set: false, savedAt: null }, pace: null, activity: { monthly: none, yearly: none } }));
    const targets = await card('Your sales activity targets');

    expect(targets).toHaveTextContent('Set appointment5No target yet');
    expect(within(targets).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(targets).not.toHaveTextContent('NaN');
    expect(targets).not.toHaveTextContent('/');
  });

  it('AC-1: a month whose year is already made needs nothing more — met, not a bar against 0', async () => {
    const made = activity({
      targets: [chip('leads', 'LEADS_CONTACTED', 3, 0, null), chip('appointments', 'SELL_PRESENTATION', 1, 0, null), chip('closings', 'SELL_SUBMISSION', 2, 0, null)],
    });
    show(summary({ activity: { monthly: made, yearly: activity(YEAR) } }));
    const targets = await card('Your sales activity targets');

    expect(targets).toHaveTextContent('Submission polis2Nothing more needed this month');
    expect(within(targets).queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('AC-2: a chip per summary tile, with its total and its rows', async () => {
    show(summary());
    const recruitment = await screen.findByRole('region', { name: 'Recruitment activities' });

    expect(recruitment).toHaveTextContent('Recruitment activities6');
    expect(within(recruitment).getAllByRole('listitem').map((li) => li.textContent))
      // Item 7 under its default label since P13.1-T3 (the client's item 7, 2026-10-07).
      .toEqual(['Proses pendaftaran kode agen3', 'Follow up NBO2', 'NPA1']);
    expect(screen.getByRole('region', { name: 'Development activities' })).toHaveTextContent('Development activities7');
  });

  it('AC-3: the pulse is the ratio screen’s answer — the rates only, each in words', async () => {
    const { calls } = show(summary());
    const pulse = await card('Activity pulse');

    expect(within(pulse).getByText('Last 30 days')).toBeInTheDocument();
    expect(await within(pulse).findByText('Selling success rate')).toBeInTheDocument();
    expect(pulse).toHaveTextContent('9.1%');
    expect(within(pulse).getByText('Below benchmark')).toBeInTheDocument();
    expect(pulse).toHaveTextContent('Leads per activity0.38');
    expect(within(pulse).getByText('Not enough data')).toBeInTheDocument();
    // Once, whichever period is showing.
    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));
    expect(calls.filter((c) => c.url.includes('/activity/ratios'))).toHaveLength(1);
  });

  it('AC-3: leaves the balance to the ratio screen', async () => {
    show(summary(), {
      body: ratios([
        ratio({}),
        ratio({ code: 'SELLING_VS_RECRUITMENT', label: 'Selling vs Recruitment', comparison: 'band', displayUnit: 'points', benchmark: 30, value: 24.4, share: 62.2, status: 'success' }),
      ]),
    });
    const pulse = await card('Activity pulse');

    await within(pulse).findByText('Selling success rate');
    expect(within(pulse).queryByText('Selling vs Recruitment')).not.toBeInTheDocument();
  });

  it('AC-3: an office with no ratios for the rung says so', async () => {
    show(summary(), { body: ratios([]) });
    expect(await screen.findByText('Your office has no ratios for your role yet.')).toBeInTheDocument();
  });

  it('AC-3: a failed ratio read stays inside its card, and the rest of the page stands', async () => {
    show(summary(), { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'The ratios could not be read.' } } });
    const pulse = await card('Activity pulse');

    expect(await within(pulse).findByText('The ratios could not be read.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your sales activity targets' })).toBeInTheDocument();
  });
});

describe('the Personal Summary — leads that need you (P10-T6)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1: your open leads in the server’s order — the date and note, or no date set', async () => {
    show(summary());
    const leads = await card('Leads that need you');
    const rows = within(leads).getAllByRole('listitem');

    expect(rows.map((row) => within(row).getByText(/^(Pak|Ibu)/).textContent)).toEqual(['Pak Hendro Gunawan', 'Ibu Wulan Sari', 'Pak Bambang']);
    expect(rows[0]).toHaveTextContent('Sales · Follow-up');
    expect(rows[0]).toHaveTextContent('8 Sep — Chase the illustration.');
    expect(rows[1]).toHaveTextContent('Sales · Policy submitted');
    expect(rows[2]).toHaveTextContent('Unassigned · No status yet');
    expect(rows[2]).toHaveTextContent('No date set');
  });

  it('AC-1: the Leads screen’s flags, and a promise for this month hides none of them (I-103)', async () => {
    show(summary());
    const [late, , undated] = within(await card('Leads that need you')).getAllByRole('listitem');

    expect(within(late).getByText('Closes this month')).toBeInTheDocument();
    expect(within(late).getByText('Overdue 6 days')).toBeInTheDocument();
    expect(within(undated).getByText('No next action')).toBeInTheDocument();
  });

  it('AC-1: lists the rows the server sent, and no more (P10.1-T6 AC-4)', async () => {
    show(summary({ leads: { rows: LEADS, total: 14 } }));
    const leads = await card('Leads that need you');

    expect(within(leads).getAllByRole('listitem')).toHaveLength(3);
  });

  it('AC-1: no open leads says so, and where to add one', async () => {
    show(summary({ leads: { rows: [], total: 0 } }));
    const leads = await card('Leads that need you');

    expect(leads).toHaveTextContent('No active leads yet — add some in Leads Management.');
    expect(within(leads).queryByRole('list')).not.toBeInTheDocument();
  });

  /*
   * P18.8-T15 AC-4 (UI-002): the card counts the reader's own leads, and Leads Management shows a leader their unit's
   * too — so an AB with 71 there read *No active leads yet* here.
   */
  it('P18.8-T15 AC-4: a leader with no open leads of their own is told their unit’s are in Leads Management', async () => {
    show(summary({ leads: { rows: [], total: 0, unitOpen: 71 } }));
    const leads = await card('Leads that need you');

    expect(leads).toHaveTextContent('No open leads of your own — your unit’s are in Leads Management.');
    expect(leads).not.toHaveTextContent('No active leads yet');
    expect(within(leads).getByRole('link', { name: 'Leads Management' })).toHaveAttribute('href', '/leads');
  });

  it('P18.8-T15 AC-4: a reader with no open leads anywhere keeps the prototype’s sentence', async () => {
    show(summary({ leads: { rows: [], total: 0, unitOpen: 0 } }));
    const leads = await card('Leads that need you');

    expect(leads).toHaveTextContent('No active leads yet — add some in Leads Management.');
    expect(leads).not.toHaveTextContent('your unit’s');
  });
});

describe('the Personal Summary — insight cards, named rules over your own numbers (P10-T7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const INSIGHTS = [
    { rule: 'BEHIND_PACE', kind: 'action', facts: { closingsLast30Days: 2, closingTarget: 5, neededPerWeek: 1, weeksLeft: 3 } },
    { rule: 'LEAD_OVERDUE', kind: 'action', facts: { leadId: 'l-1', name: 'Pak Heri', overdueDays: 8, others: 2 } },
    { rule: 'LEAD_NEGLECTED', kind: 'action', facts: { leadId: 'l-2', name: 'Pak Alvin', others: 0 } },
    {
      rule: 'RATIO_BELOW', kind: 'improve',
      facts: { code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', value: 0.0909, benchmark: 0.15, displayUnit: 'percent' },
    },
  ];

  it('AC-1, AC-2: each card says what its rule found, under the prototype’s AI-powered badge (ADR-0069)', async () => {
    show(summary({ insights: INSIGHTS }));
    const next = await card('What to do next');
    const items = within(next).getAllByRole('listitem');

    expect(items.map((li) => li.textContent?.slice(0, 1))).toEqual(['1', '2', '3']);
    expect(items[0]).toHaveTextContent('You’re behind pace — at this rate you’ll close 2 of 5 this month. About 1 policy a week for the 3 weeks left would catch up.');
    expect(items[1]).toHaveTextContent('Pak Heri’s next action is 8 days overdue — reschedule it or set a new date this week in Leads Management. 2 more of your leads are overdue too.');
    expect(items[2]).toHaveTextContent('Pak Alvin has no next action and no remarks — follow up and log what happened so this lead doesn’t stall.');
    expect(items[2]).not.toHaveTextContent('neither');

    expect(within(next).getByText('AI-powered')).toBeInTheDocument();
    expect(screen.queryByText(/rules, not AI/i)).not.toBeInTheDocument();
  });

  it('AC-1, P18.97-T3 AC-2: a ratio below its benchmark goes on the improvement card, written as the ratio screen writes it — its tenth, the benchmark as typed', async () => {
    show(summary({ insights: INSIGHTS }));
    const improve = await card('How you can improve your performance');

    expect(improve).toHaveTextContent('Selling success rate is 9.1% over the last 30 days, below its benchmark of 15%');
    expect(within(improve).getByRole('link', { name: 'Activity Ratios' })).toHaveAttribute('href', '/activity/ratio');
  });

  it('AC-1: a strength, and silence in the logging window, each in their own words', async () => {
    show(summary({
      insights: [
        { rule: 'NOTHING_LOGGED', kind: 'action', facts: { windowDays: 7, lastLoggedOn: '2026-09-01' } },
        {
          rule: 'RATIO_STRENGTH', kind: 'improve',
          facts: { code: 'LEADS_PER_ACTIVITY', label: 'Leads per activity', value: 0.6, benchmark: 0.3, displayUnit: 'decimal' },
        },
      ],
    }));

    const next = await card('What to do next');
    expect(next).toHaveTextContent('Nothing logged in the last 7 days — your last entry was 1 Sep.');
    expect(within(next).getByRole('link', { name: 'Log Activity' })).toHaveAttribute('href', '/activity/log');
    expect(await card('How you can improve your performance')).toHaveTextContent(
      'Leads per activity is a genuine strength — 0.60 over the last 30 days, well above its benchmark of 0.30.',
    );
  });

  it('AC-1: the month’s last week is the week left, not “the 1 week left”', async () => {
    show(summary({ insights: [{ rule: 'BEHIND_PACE', kind: 'action', facts: { closingsLast30Days: 0, closingTarget: 3, neededPerWeek: 3, weeksLeft: 1 } }] }));
    expect(await card('What to do next')).toHaveTextContent('About 3 policies in the week left would catch up.');
  });

  it('AC-1: somebody who never logged is told where to start', async () => {
    show(summary({ insights: [{ rule: 'NOTHING_LOGGED', kind: 'action', facts: { windowDays: 7, lastLoggedOn: null } }] }));
    expect(await card('What to do next')).toHaveTextContent('You haven’t logged any activity yet');
    expect(screen.queryByRole('region', { name: 'How you can improve your performance' })).not.toBeInTheDocument();
  });

  it('AC-3: no rule fired says so, rather than going quiet — and draws no improvement card', async () => {
    show(summary({ insights: [] }));
    expect(await card('What to do next')).toHaveTextContent('Nothing in your numbers asks for anything right now');
    expect(screen.queryByRole('region', { name: 'How you can improve your performance' })).not.toBeInTheDocument();
  });

  it('AC-3: only improvements draws only that card', async () => {
    show(summary({ insights: [INSIGHTS[3]] }));
    await card('How you can improve your performance');
    expect(screen.queryByRole('region', { name: 'What to do next' })).not.toBeInTheDocument();
  });
});

/*
 * *Amended 2026-10-01 (P10.1-T8, ADR-0068):* the button is the prototype's *⬇ Download* again, at the
 * client's request — label and glyph — and still the browser's print, as the prototype's handler is. What
 * is new is the document's title while the print window is open, which names the PDF it saves.
 */
describe('the Personal Summary — Download (P10-T8, ADR-0061; P10.1-T8, ADR-0068)', () => {
  const ORIGINAL_TITLE = 'AgencyBoost';
  afterEach(() => {
    vi.unstubAllGlobals();
    document.title = ORIGINAL_TITLE;
  });

  /** A `print` that notes the title the browser would name its PDF after, at the moment it is called. */
  const stubPrint = () => {
    const titles: string[] = [];
    const print = vi.fn(() => { titles.push(document.title); });
    vi.stubGlobal('print', print);
    document.title = ORIGINAL_TITLE;
    return { print, titles };
  };

  it('says Download, with the prototype’s glyph out of its name, and prints the page — nothing is asked of the server', async () => {
    const { print } = stubPrint();
    const { calls } = show(summary());
    await card('Goal vs. actual (APE)');
    const before = calls.length;

    const download = screen.getByRole('button', { name: 'Download' });
    expect(download).toHaveTextContent('⬇Download');
    expect(download.querySelector('[aria-hidden="true"]')).toHaveTextContent('⬇');
    expect(download).toHaveClass('gap-1');
    await userEvent.click(download);

    expect(print).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(before);
    expect(screen.queryByRole('button', { name: /print/i })).not.toBeInTheDocument();
  });

  it('titles the page for its month while printing, so the PDF is named for it — and puts the title back after', async () => {
    const { titles } = stubPrint();
    show(summary());
    await card('Goal vs. actual (APE)');

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(titles).toEqual(['Personal Summary – Sep 2026']);
    // Until the print window closes, the title stays the period's.
    expect(document.title).toBe('Personal Summary – Sep 2026');
    window.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe(ORIGINAL_TITLE);
    // Once: a later print elsewhere does not put back a title from this one.
    document.title = 'Something else';
    window.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe('Something else');
  });

  it('puts the title back when the browser fires afterprint inside print() — the listener is there first', async () => {
    // Chrome and Firefox: print() blocks, and the window closing fires afterprint before it returns.
    const titles: string[] = [];
    vi.stubGlobal('print', vi.fn(() => { titles.push(document.title); window.dispatchEvent(new Event('afterprint')); }));
    document.title = ORIGINAL_TITLE;
    show(summary());
    await card('Goal vs. actual (APE)');

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(titles).toEqual(['Personal Summary – Sep 2026']);
    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  it('keeps the page’s own title to put back when Download is pressed twice before the window closes', async () => {
    const { titles } = stubPrint();
    show(summary());
    await card('Goal vs. actual (APE)');

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    window.dispatchEvent(new Event('afterprint'));

    expect(titles).toHaveLength(2);
    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  it('puts the title back when the page goes, for a browser that never fires afterprint', async () => {
    stubPrint();
    stubFetch({ '/summary': { body: summary() }, '/activity/ratios': { body: AGENT_RATIOS } });
    const { unmount } = renderWithSession(<PersonalSummaryPage />, { me: AGENT });
    await card('Goal vs. actual (APE)');

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(document.title).toBe('Personal Summary – Sep 2026');
    unmount();

    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  it('titles it for the year on the Yearly view', async () => {
    const { titles } = stubPrint();
    show(summary());
    await card('Goal vs. actual (APE)');

    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    window.dispatchEvent(new Event('afterprint'));

    expect(titles).toEqual(['Personal Summary – 2026']);
    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  it('AC-3: keeps the button and the period switch off the paper, and each card whole on it', async () => {
    show(summary());
    await card('Goal vs. actual (APE)');

    expect(screen.getByRole('button', { name: 'Download' })).toHaveClass('print:hidden');
    expect(screen.getByRole('tablist')).toHaveClass('print:hidden');
    expect(await card('The gap')).toHaveClass('print:break-inside-avoid');
  });

  it('offers no Download before there is anything to download', async () => {
    stubFetch({
      '/summary': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } } },
      '/activity/ratios': { body: AGENT_RATIOS },
    });
    renderWithSession(<PersonalSummaryPage />, { me: AGENT });
    await screen.findByText('Something went wrong.');
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
  });
});

describe('the Personal Summary, trimmed to the prototype (P10.1-T6, ADR-0063)', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('AC-1 — provenance is a marker, not a sentence', () => {
    it('AC-1: marks the month’s figure as the office’s upload, and names the month', async () => {
      show(summary());
      const goal = await card('Goal vs. actual (APE)');

      const marker = within(goal).getByRole('button', { name: 'From your office’s upload, Sep 2026' });
      expect(marker.querySelector('[aria-hidden="true"]')).toHaveTextContent('ⓘ');
      // The words show on focus and on a tap, not only to a mouse — and are said once, by the name.
      const tip = within(goal).getByText('From your office’s upload, Sep 2026', { selector: '[role="tooltip"]' });
      expect(tip).not.toBeVisible();
      fireEvent.click(marker);
      expect(tip).toBeVisible();
      expect(tip).toHaveAttribute('aria-hidden', 'true');
      // The sentence is gone, and the figure is still not an input (ADR-0058).
      expect(goal).not.toHaveTextContent('carrier');
      expect(within(goal).queryByRole('link')).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('AC-1: marks a correction by the office, and the year to date as of its month', async () => {
      show(summary({
        yearly: {
          ...figures({ targetMinor: 500 * M, actualMinor: 230 * M, attainmentPct: 46 }),
          source: { provenance: 'corrected', month: '2026-08' },
        },
      }));
      await card('Goal vs. actual (APE)');
      await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));

      const goal = await card('Goal vs. actual (APE)');
      expect(within(goal).getByRole('button', { name: 'Corrected by hand, year to date as of Aug 2026' }))
        .toBeInTheDocument();
    });

    it('P15-T3 AC-1 (F-156): names who corrected the figure — a leader on the Unit Dashboard, or the office', async () => {
      show(summary({
        yearly: {
          ...figures({ targetMinor: 500 * M, actualMinor: 230 * M, attainmentPct: 46 }),
          source: {
            provenance: 'corrected', month: '2026-10',
            correctedBy: { membershipId: 'mem-sari', name: 'Sari Puspita' }, correctedAt: '2026-10-08T03:00:00.000Z',
          },
        },
      }));
      await card('Goal vs. actual (APE)');
      await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));

      const goal = await card('Goal vs. actual (APE)');
      expect(within(goal).getByRole('button', { name: 'Corrected by Sari Puspita, year to date as of Oct 2026' }))
        .toBeInTheDocument();
    });

    it('AC-1: marks the agent’s own figure, which has no month', async () => {
      show(summary({ yearly: { ...figures({ actualMinor: 120 * M }), source: { provenance: 'self_reported', month: null } } }));
      await card('Goal vs. actual (APE)');
      await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));

      expect(within(await card('Goal vs. actual (APE)')).getByRole('button', { name: 'Your own figure, entered in Goal Settings' }))
        .toBeInTheDocument();
    });
  });

  it('AC-2: the footnotes go — the gap note, the Dashboard and ratio links, and the leads footer', async () => {
    show(summary({
      monthly: { ...figures({ actualMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }), source: null },
      leads: { rows: LEADS, total: 14 },
    }));
    await card('The gap');
    await within(await card('Activity pulse')).findByText('Selling success rate');

    expect(screen.queryByText(/worked out once this month’s APE is uploaded/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Day by day/)).not.toBeInTheDocument();
    expect(screen.queryByText(/how each ratio is worked out/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nearest of your/)).not.toBeInTheDocument();
    // What links remain is the prototype's: *From Goal Settings — …* under the targets' title.
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/goals']);
    expect(await card('Your sales activity targets')).toHaveTextContent('42 activities this month');
  });

  /*
   * *Amended 2026-10-01 (P10.1-T8, ADR-0069):* the badge is the prototype's *AI-powered*, at the client's
   * request, where T6 had *Rules, not AI*. Once per card is unchanged, and so is what stays out: the
   * *Rule:* lines, and the prototype's footnotes, whose learning claims the fixed rules cannot keep.
   */
  it('AC-3: one AI-powered per card, in the badge — no Rule line under an item, and no footnote', async () => {
    show(summary({
      insights: [
        { rule: 'BEHIND_PACE', kind: 'action', facts: { closingsLast30Days: 2, closingTarget: 5, neededPerWeek: 1, weeksLeft: 3 } },
        { rule: 'LEAD_NEGLECTED', kind: 'action', facts: { leadId: 'l-2', name: 'Pak Alvin', others: 0 } },
        {
          rule: 'RATIO_STRENGTH', kind: 'improve',
          facts: { code: 'LEADS_PER_ACTIVITY', label: 'Leads per activity', value: 0.6, benchmark: 0.3, displayUnit: 'decimal' },
        },
      ],
    }));

    for (const name of ['What to do next', 'How you can improve your performance']) {
      const region = await card(name);
      expect(within(region).getAllByText(/AI-powered/i)).toHaveLength(1);
      expect(within(region).getByText('AI-powered')).toBeInTheDocument();
      expect(region).not.toHaveTextContent(/rules, not AI/i);
      expect(region).not.toHaveTextContent('Rule:');
      // The prototype's footnotes (`Overall.html:3246`, `:3261`) promise learning the rules do not do.
      expect(region).not.toHaveTextContent(/sharper|Generated automatically|Pattern-based/i);
    }
    expect(screen.queryByText(/Suggestions from your numbers/)).not.toBeInTheDocument();
  });

  it('AC-4: Leads that need you keeps its ten and its flags', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => openLead({ id: `l-${i}`, name: `Pak Lead ${i}`, flags: i === 0 ? ['overdue'] : [], overdueDays: i === 0 ? 3 : null }));
    show(summary({ leads: { rows: ten, total: 12 } }));
    const leads = await card('Leads that need you');

    expect(within(leads).getAllByRole('listitem')).toHaveLength(10);
    expect(within(leads).getByText('Overdue 3 days')).toBeInTheDocument();
  });

  describe('AC-5 — the section chips follow the summary tiles (ADR-0064)', () => {
    it('AC-5: on the seed, the prototype’s two — Recruitment activities and Development activities', async () => {
      show(summary());
      const targets = await card('Your sales activity targets');

      const chips = within(targets).getAllByRole('region');
      expect(chips.map((chip) => chip.getAttribute('aria-labelledby'))).toEqual(['summary-section-RECRUITMENT', 'summary-section-DEVELOPMENT']);
      expect(within(targets).getByRole('region', { name: 'Development activities' })).toHaveTextContent('Development activities7');
      expect(within(within(targets).getByRole('region', { name: 'Development activities' })).getAllByRole('listitem')).toHaveLength(3);
      expect(within(targets).queryByRole('region', { name: /Team Development/ })).not.toBeInTheDocument();
    });

    it('AC-5: draws the chips as the server sends them, and regroups nothing itself', async () => {
      // An office whose two development sections each keep a tile of their own gets two chips for them.
      const ungrouped = activity({
        sections: [
          { code: 'PERSONAL_DEVELOPMENT', label: 'Personal Development', total: 3, rows: [{ code: 'DEV_TRAINING_ATTEND', label: 'Training', count: 3 }] },
          { code: 'TEAM_DEVELOPMENT', label: 'Team Development', total: 4, rows: [{ code: 'DEV_TEAM_ACTIVITY', label: 'Aktivitas team development', count: 4 }] },
        ],
      });
      show(summary({ activity: { monthly: ungrouped, yearly: activity(YEAR) } }));
      const targets = await card('Your sales activity targets');

      expect(within(targets).getByRole('region', { name: 'Personal Development activities' })).toHaveTextContent('3');
      expect(within(targets).getByRole('region', { name: 'Team Development activities' })).toHaveTextContent('4');
      expect(within(targets).queryByRole('region', { name: 'Development activities' })).not.toBeInTheDocument();
    });
  });

  // *Amended 2026-10-01 (P10.1-T8, ADR-0068):* T6 kept the button as *Print*; it is *Download* again.
  it('AC-6: the subtitle and the button stay — the button as the prototype’s Download', async () => {
    show(summary());
    await card('Goal vs. actual (APE)');

    // P18.95-T7 AC-1 (grey text row 25): from 768px; the client's *Remove* below it.
    expect(screen.getByText('Your goals, activity and leads — on one page.')).toHaveClass('max-md:hidden');
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Print' })).not.toBeInTheDocument();
  });
});

/*
 * *Campaigns you're chasing* (`Overall.html:3225-3232`, `:6221-6253`; P18.5-T7 AC-6): the card the sign of
 * P10.1-T2 stood in for, now that a chase is made on the Campaign list.
 */
describe('Campaigns you’re chasing (P18.5-T7 AC-6)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const campaigns = () => card("Campaigns you're chasing");
  const showWith = (routes: Record<string, StubReply | StubReply[]>) => {
    const stub = stubFetch({ '/summary': { body: summary() }, '/activity/ratios': { body: AGENT_RATIOS }, ...routes });
    renderWithSession(<PersonalSummaryPage />, { me: AGENT });
    return stub;
  };

  it('P18.5-T7 AC-6 is drawn where the prototype draws it, titled verbatim with the bolt and From the Campaign list', async () => {
    showWith({ 'GET /campaigns/chasing': { body: RINA_CHASING } });
    const section = await campaigns();
    const heading = within(section).getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent(/^Campaigns you're chasing$/);
    expect(heading.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(within(section).getByText('From the Campaign list')).toBeInTheDocument();
    expect(within(section).queryByText('Upcoming')).not.toBeInTheDocument();
    // Card 6 of the prototype's order, after the leads and before the insights.
    const leads = await card('Leads that need you');
    const next = await card('What to do next');
    expect(leads.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('P18.5-T7 AC-6, P18.95-T7 AC-1 a row per chase: its emoji, its title, the months it runs and View →, read with no for', async () => {
    const { calls } = showWith({ 'GET /campaigns/chasing': { body: RINA_CHASING } });
    const section = await campaigns();
    const rows = await within(section).findAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      // Grey text row 23: the server's *Runs …*, where it read *"Ongoing incentive · Standing — evaluated per calendar year …"*.
      '🚀Q4 APE SprintRuns Okt – Des 2026View →',
      '🏆MDRT QualificationRuns Jan – DesView →',
    ]);
    expect(calls.filter((c) => c.url.includes('/campaigns')).map((c) => c.url))
      .toEqual(['http://api.test/api/v1/campaigns/chasing']);
  });

  it('P18.5-T7 AC-6 says the prototype’s sentence when nothing is chased', async () => {
    showWith({ 'GET /campaigns/chasing': { body: NONE_CHASED } });
    const section = await campaigns();
    expect(await within(section).findByText("You're not chasing any campaigns yet — check the Campaign list to opt in.")).toBeInTheDocument();
  });

  it('P18.5-T7 AC-6 its own read fails on its own card, with a retry, and the Summary stands', async () => {
    showWith({ 'GET /campaigns/chasing': [serverError, { body: RINA_CHASING }] });
    const section = await campaigns();
    expect(await within(section).findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(await card('Goal vs. actual (APE)')).toBeInTheDocument();
    await userEvent.click(within(section).getByRole('button', { name: 'Try again' }));
    expect(await within(section).findByText('Q4 APE Sprint')).toBeInTheDocument();
  });

  it('P18.5-T7 AC-6 View → opens the campaign’s dialog in place, and a chase there updates the card', async () => {
    const { calls } = showWith({
      'GET /campaigns/chasing': [{ body: RINA_CHASING }, { body: { membershipId: 'mem-rina', campaigns: [RINA_CHASING.campaigns[1]] } }],
      'GET /campaigns/APE_SPRINT': { body: detail() },
      'DELETE /campaigns/APE_SPRINT/chase': { body: { ...SPRINT, chasing: false } },
    });
    const section = await campaigns();
    await userEvent.click(await within(section).findByRole('button', { name: /Q4 APE Sprint/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Q4 APE Sprint' });
    expect(window.location.pathname).not.toBe('/campaigns/APE_SPRINT');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Chasing' }));
    expect(await screen.findByText('Removed "Q4 APE Sprint" from your chase list')).toBeInTheDocument();
    // The card's own rows: the dialog, drawn over it, keeps its requirement rows inside the same section.
    await waitFor(() => expect([...section.querySelectorAll(':scope > ul > li')].map((li) => li.textContent))
      .toEqual(['🏆MDRT QualificationRuns Jan – DesView →']));
    expect(calls.filter((c) => c.init.method === 'DELETE')).toHaveLength(1);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('P18.5-T7 AC-6 is on paper with the rest, its View → cue off it', async () => {
    showWith({ 'GET /campaigns/chasing': { body: RINA_CHASING } });
    const section = await campaigns();
    expect(section).not.toHaveClass('print:hidden');
    expect(await within(section).findAllByText('View →')).toHaveLength(2);
    for (const cue of within(section).getAllByText('View →')) expect(cue).toHaveClass('print:hidden');
  });

  it('P18.5-T7 AC-6 is there whatever the period, read once', async () => {
    const { calls } = showWith({ 'GET /campaigns/chasing': { body: RINA_CHASING } });
    await within(await campaigns()).findByText('Q4 APE Sprint');
    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));
    expect(await within(await campaigns()).findByText('Q4 APE Sprint')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/campaigns/chasing'))).toHaveLength(1);
  });
});

/**
 * **An earlier month or year** (P18.8-T11, ADR-0161 §4): a month select under *Monthly* and a year select under
 * *Yearly*, from the office's first month to this one, the choice in the address; a closed period shows its final
 * figures, and the pace sentence and *The gap* only the current one.
 */
describe('the Personal Summary — an earlier month or year (P18.8-T11)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    nav.replace.mockClear();
  });

  const OPENED = { firstMonth: '2025-11', thisMonth: '2026-09', currentMonth: true, currentYear: true };
  /** August, read whole: a month that has ended, so no pace. */
  const AUGUST = summary({
    month: '2026-08', pace: null, period: { ...OPENED, currentMonth: false },
    activity: { monthly: activity({ from: '2026-08-01', to: '2026-08-31', total: 37 }), yearly: activity(YEAR) },
  });
  const summaries = (at: Record<string, unknown> = {}) => ({
    '/summary': { body: summary({ period: OPENED }) },
    '/activity/ratios': { body: AGENT_RATIOS },
    'GET /campaigns/chasing': { body: NONE_CHASED },
    ...at,
  });
  const open = (routes: Record<string, StubReply | StubReply[]>, query: Record<string, string> = {}) => {
    const stub = stubFetch(routes);
    nav.search = new URLSearchParams(query).toString();
    renderWithSession(<PersonalSummaryPage />, { me: AGENT });
    return stub;
  };
  const summaryReads = (calls: { url: string }[]) =>
    calls.map((c) => new URL(c.url)).filter((u) => u.pathname.endsWith('/summary')).map((u) => u.search);
  const options = (select: HTMLElement) => within(select).getAllByRole('option').map((o) => o.textContent);

  it('P18.8-T11 AC-2 a month select under Monthly, the office’s months newest first, this one chosen', async () => {
    open(summaries());
    const select = await screen.findByRole('combobox', { name: 'Month' });

    expect(options(select)).toEqual([
      'Sep 2026', 'Aug 2026', 'Jul 2026', 'Jun 2026', 'May 2026', 'Apr 2026', 'Mar 2026',
      'Feb 2026', 'Jan 2026', 'Dec 2025', 'Nov 2025',
    ]);
    expect(select).toHaveDisplayValue('Sep 2026');
    expect(select).toHaveClass('print:hidden');
    // It stands in the panel the switch controls, beneath it.
    expect(screen.getByRole('tabpanel')).toContainElement(select);
  });

  it('P18.8-T11 AC-2 a year select under Yearly, the office’s years newest first', async () => {
    open(summaries());
    await screen.findByRole('combobox', { name: 'Month' });
    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));

    const select = screen.getByRole('combobox', { name: 'Year' });
    expect(options(select)).toEqual(['2026', '2025']);
    expect(select).toHaveDisplayValue('2026');
    expect(screen.queryByRole('combobox', { name: 'Month' })).not.toBeInTheDocument();
  });

  it('P18.8-T11 AC-2 choosing a month reads it and puts it in the address, the select holding it meanwhile', async () => {
    const { calls } = open(summaries({ '/summary?month=2026-08': { body: AUGUST } }));
    const select = await screen.findByRole('combobox', { name: 'Month' });

    await userEvent.selectOptions(select, 'Aug 2026');

    expect(nav.replace).toHaveBeenCalledWith('/summary?month=2026-08', { scroll: false });
    expect(screen.getByRole('combobox', { name: 'Month' })).toHaveDisplayValue('Aug 2026');
    expect(await screen.findByText(/activities in Aug 2026/)).toBeInTheDocument();
    expect(summaryReads(calls)).toEqual(['', '?month=2026-08']);
  });

  it('P18.8-T11 AC-2 the address’s month opens the page on it, and the current month clears the address', async () => {
    const { calls } = open(summaries({ '/summary?month=2026-08': { body: AUGUST } }), { month: '2026-08' });
    const select = await screen.findByRole('combobox', { name: 'Month' });
    await waitFor(() => expect(select).toHaveDisplayValue('Aug 2026'));
    await screen.findByText('Aug 2026', { selector: 'p' });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Month' }), 'Sep 2026');

    expect(nav.replace).toHaveBeenLastCalledWith('/summary', { scroll: false });
    await waitFor(() => expect(summaryReads(calls)).toEqual(['?month=2026-08', '']));
  });

  it('P18.8-T11 AC-2 ?year= opens on Yearly with that year chosen, and reads it', async () => {
    const LAST_YEAR = summary({
      year: '2025', month: '2025-12', pace: null, period: { ...OPENED, currentMonth: false, currentYear: false },
    });
    const { calls } = open(summaries({ '/summary?year=2025': { body: LAST_YEAR } }), { year: '2025' });

    const select = await screen.findByRole('combobox', { name: 'Year' });
    expect(select).toHaveDisplayValue('2025');
    expect(screen.getByRole('tab', { name: 'Yearly' })).toHaveAttribute('aria-selected', 'true');
    expect(summaryReads(calls)).toEqual(['?year=2025']);
  });

  it('P18.8-T11 AC-2 switching views returns to now: Yearly from August reads this year, the address cleared', async () => {
    const { calls } = open(summaries({ '/summary?month=2026-08': { body: AUGUST } }), { month: '2026-08' });
    await screen.findByText('Aug 2026', { selector: 'p' });

    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));

    expect(nav.replace).toHaveBeenCalledWith('/summary', { scroll: false });
    expect(await screen.findByRole('combobox', { name: 'Year' })).toHaveDisplayValue('2026');
    await waitFor(() => expect(summaryReads(calls)).toEqual(['?month=2026-08', '']));
  });

  it('P18.8-T11 AC-2 a malformed month in the address is not sent: the page is this month’s', async () => {
    const { calls } = open(summaries(), { month: '2026-13' });
    expect(await screen.findByRole('combobox', { name: 'Month' })).toHaveDisplayValue('Sep 2026');
    expect(summaryReads(calls)).toEqual(['']);
  });

  it('P18.8-T11 AC-3 a month that has ended: its final figures by name, no pace sentence and no The gap', async () => {
    open(summaries({ '/summary?month=2026-08': { body: AUGUST } }), { month: '2026-08' });
    const goal = await card('Goal vs. actual (APE)');

    expect(within(goal).getByText('Aug 2026')).toBeInTheDocument();
    expect(within(goal).getByRole('progressbar', { name: 'Aug 2026’s target' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'The gap' })).not.toBeInTheDocument();
    expect(screen.queryByText(/current pace/)).not.toBeInTheDocument();
    const targets = await card('Your sales activity targets');
    expect(within(targets).getByText('Aug 2026')).toBeInTheDocument();
    expect(targets).toHaveTextContent('37 activities in Aug 2026');
  });

  it('P18.8-T11 AC-3 the current month still has its pace and its gap, under This month', async () => {
    open(summaries());
    expect(await card('The gap')).toBeInTheDocument();
    expect(screen.getByText(/current pace/)).toBeInTheDocument();
    expect(within(await card('Goal vs. actual (APE)')).getByText('This month')).toBeInTheDocument();
  });

  it('P18.8-T11 AC-3 a year that has ended with no goal says so, and offers no goal to set', async () => {
    const NO_GOAL = summary({
      year: '2025', month: '2025-12', pace: null, goal: { set: false, savedAt: null },
      period: { ...OPENED, currentMonth: false, currentYear: false },
    });
    open(summaries({ '/summary?year=2025': { body: NO_GOAL } }), { year: '2025' });

    expect(await screen.findByText('You didn’t set a goal for 2025, so there is nothing to measure against.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Set your goal' })).not.toBeInTheDocument();
  });

  it('P18.8-T11 AC-3 a month that has ended prints and downloads under its own name', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const titles: string[] = [];
    print.mockImplementation(() => { titles.push(document.title); });
    open(summaries({ '/summary?month=2026-08': { body: AUGUST } }), { month: '2026-08' });
    await card('Goal vs. actual (APE)');

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(titles).toEqual(['Personal Summary – Aug 2026']);
    print.mockRestore();
  });
});
