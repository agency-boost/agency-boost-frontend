import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import PersonalSummaryPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/summary',
}));

const AGENT = makeMe({ permissions: ['personal_summary:read'] });
const M = 1_000_000 * 100;

const figures = (over: Record<string, unknown> = {}) => ({
  targetMinor: 75 * M, actualMinor: 30 * M, attainmentPct: 40, gapMinor: 45 * M, overMinor: 0,
  policiesNeeded: 3, targetMet: false, ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({
  year: '2026', month: '2026-09', today: '2026-09-14',
  goal: { set: true, savedAt: '2026-09-01T02:00:00.000Z' }, caseSizeMinor: 18 * M,
  monthly: { ...figures(), source: { provenance: 'imported', month: '2026-09' } },
  yearly: {
    ...figures({ targetMinor: 500 * M, actualMinor: 230 * M, attainmentPct: 46, gapMinor: 270 * M, policiesNeeded: 15 }),
    source: { provenance: 'imported', month: '2026-09' },
  },
  pace: {
    closingTarget: 5, closingsLogged: 2, dayOfMonth: 14, daysInMonth: 30, projected: 4, weeksLeft: 3,
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
          { code: 'RECRUIT_PRESENTATION', label: 'Presentasi NBO', count: 3 },
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
  const stub = stubFetch({ '/summary': { body }, '/activity/ratios': pulse });
  renderWithSession(<PersonalSummaryPage />, { me: AGENT });
  return stub;
};
const card = (name: string) => screen.findByRole('region', { name });

describe('the Personal Summary — goal versus actual, and the gap (P10-T4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1: opens on this month — the produced figure, the target, the attainment and its bar', async () => {
    show(summary());
    const goal = await card('Goal vs. actual (APE)');

    expect(within(goal).getByText('Rp 30.000.000')).toBeInTheDocument();
    expect(goal).toHaveTextContent('of Rp 75.000.000 target40%');
    expect(within(goal).getByText('This month')).toBeInTheDocument();
    expect(within(goal).getByRole('progressbar', { name: 'This month’s target' })).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText('September 2026')).toBeInTheDocument();
  });

  it('AC-1: switches to the year — the annual target against the year to date', async () => {
    show(summary());
    await card('Goal vs. actual (APE)');

    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));

    const goal = await card('Goal vs. actual (APE)');
    expect(within(goal).getByText('Rp 230.000.000')).toBeInTheDocument();
    expect(goal).toHaveTextContent('of Rp 500.000.000 target46%');
    expect(within(goal).getByText('This year')).toBeInTheDocument();
    expect(await card('The gap')).toHaveTextContent('Remaining this yearRp 270.000.000');
  });

  it('AC-1: says this month is not uploaded yet — no zero, no attainment, no gap made up', async () => {
    show(summary({
      monthly: { ...figures({ actualMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }), source: null },
    }));
    const goal = await card('Goal vs. actual (APE)');

    expect(goal).toHaveTextContent('Not uploaded yetof Rp 75.000.000 target');
    expect(goal).not.toHaveTextContent('%');
    // No bar: an empty track under *Not uploaded yet* reads as zero.
    expect(within(goal).queryByRole('progressbar')).not.toBeInTheDocument();
    // Nothing produced, so nothing to mark: *Not uploaded yet* says it (P10.1-T6 AC-1).
    expect(within(goal).queryByRole('button')).not.toBeInTheDocument();
    const gap = await card('The gap');
    expect(gap).toHaveTextContent('Remaining this month—');
    expect(gap).not.toHaveTextContent('Rp 0');
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
    expect(await card('The gap')).toHaveTextContent('Remaining this monthRp 45.000.000≈ Policies still needed1 policy');
  });

  it('AC-3: a target reached says so, and asks for nothing (ADR-0047)', async () => {
    show(summary({
      monthly: { ...figures({ actualMinor: 95 * M, attainmentPct: 127, gapMinor: 0, overMinor: 20 * M, policiesNeeded: 0, targetMet: true }), source: null },
      pace: { closingTarget: 5, closingsLogged: 6, dayOfMonth: 20, daysInMonth: 30, projected: 9, weeksLeft: 2, neededPerWeek: 0, targetMet: true },
    }));
    const gap = await card('The gap');
    expect(gap).toHaveTextContent('Reached — Rp 20.000.000 over');
    expect(gap).toHaveTextContent('≈ Policies still neededNone');
    expect(gap).toHaveTextContent('You’ve already reached this month’s target — nice work. Keep the pace to stay ahead.');
  });

  it('AC-4: a projection, and what each week left needs to catch up', async () => {
    show(summary({ pace: { closingTarget: 6, closingsLogged: 2, dayOfMonth: 14, daysInMonth: 30, projected: 4, weeksLeft: 3, neededPerWeek: 2, targetMet: false } }));
    expect(await card('The gap')).toHaveTextContent(
      'At your current pace, you’re tracking to close 4 policies this month against a target of 6. With 3 weeks left, you’d need to close roughly 2 policies/week to catch up.',
    );
  });

  it('AC-4: before the 7th it only counts, and on pace it says so without a warning', async () => {
    show(summary({ pace: { closingTarget: 6, closingsLogged: 1, dayOfMonth: 3, daysInMonth: 30, projected: null, weeksLeft: 4, neededPerWeek: 2, targetMet: false } }));
    const gap = await card('The gap');
    expect(gap).toHaveTextContent('You’ve closed 1 policy of 6 this month.');
    expect(gap).not.toHaveTextContent('current pace');
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
      pace: { closingTarget: 0, closingsLogged: 2, dayOfMonth: 14, daysInMonth: 30, projected: 4, weeksLeft: 3, neededPerWeek: 0, targetMet: true },
    }));
    const goal = await card('Goal vs. actual (APE)');
    expect(goal).toHaveTextContent('Your year’s target was made before this month began — this month needs nothing more.');
    expect(goal).not.toHaveTextContent('of Rp 0 target');
    expect(await card('The gap')).toHaveTextContent('Reached — Rp 30.000.000 over');
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
    expect(targets).toHaveTextContent('Leads contacted20 / 57');
    expect(targets).toHaveTextContent('Appointments6 / 17');
    expect(targets).toHaveTextContent('Closings2 / 5');
    expect(within(targets).getByRole('progressbar', { name: 'Closings against target' })).toHaveAttribute('aria-valuenow', '40');
    expect(within(targets).getByRole('progressbar', { name: 'Leads contacted against target' })).toHaveAttribute('aria-valuetext', '20 of 57');
    expect(within(targets).getByRole('link', { name: 'Goal Settings' })).toHaveAttribute('href', '/goals');
    expect(targets).toHaveTextContent('42 total activities logged this month across all categories.');
  });

  it('AC-1: the year to date against the year’s targets', async () => {
    show(summary());
    await card('Your sales activity targets');

    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));

    const targets = await card('Your sales activity targets');
    expect(within(targets).getByText('This year')).toBeInTheDocument();
    expect(targets).toHaveTextContent('Closings11 / 28');
    expect(targets).toHaveTextContent('310 total activities logged this year across all categories.');
  });

  it('AC-1: no goal is no target — the counts still show, and nothing is divided by zero (F-25)', async () => {
    const none = activity({
      targets: [chip('leads', 'LEADS_CONTACTED', 5, null, null), chip('appointments', 'SELL_PRESENTATION', 0, null, null), chip('closings', 'SELL_SUBMISSION', 1, null, null)],
    });
    show(summary({ goal: { set: false, savedAt: null }, pace: null, activity: { monthly: none, yearly: none } }));
    const targets = await card('Your sales activity targets');

    expect(targets).toHaveTextContent('Leads contacted5No target yet');
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

    expect(targets).toHaveTextContent('Closings2Nothing more needed this month');
    expect(within(targets).queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('AC-2: a chip per summary tile, with its total and its rows', async () => {
    show(summary());
    const recruitment = await screen.findByRole('region', { name: 'Recruitment activities' });

    expect(recruitment).toHaveTextContent('Recruitment activities6');
    expect(within(recruitment).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['Presentasi NBO3', 'Follow up NBO2', 'NPA1']);
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
    expect(rows[0]).toHaveTextContent('Sep 8 — Chase the illustration.');
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
});

describe('the Personal Summary — insight cards, named rules over your own numbers (P10-T7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const INSIGHTS = [
    { rule: 'BEHIND_PACE', kind: 'action', facts: { projected: 2, closingTarget: 5, neededPerWeek: 1, weeksLeft: 3 } },
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

  it('AC-1: a ratio below its benchmark goes on the improvement card, written as the ratio screen writes it', async () => {
    show(summary({ insights: INSIGHTS }));
    const improve = await card('How you can improve your performance');

    expect(improve).toHaveTextContent('Selling success rate is 9.1% over the last 30 days, below its benchmark of 15.0%');
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
    expect(next).toHaveTextContent('Nothing logged in the last 7 days — your last entry was Sep 1.');
    expect(within(next).getByRole('link', { name: 'Log Activity' })).toHaveAttribute('href', '/activity/log');
    expect(await card('How you can improve your performance')).toHaveTextContent(
      'Leads per activity is a genuine strength — 0.60 over the last 30 days, well above its benchmark of 0.30.',
    );
  });

  it('AC-1: the month’s last week is the week left, not “the 1 week left”', async () => {
    show(summary({ insights: [{ rule: 'BEHIND_PACE', kind: 'action', facts: { projected: 0, closingTarget: 3, neededPerWeek: 3, weeksLeft: 1 } }] }));
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

    expect(titles).toEqual(['Personal Summary – September 2026']);
    // Until the print window closes, the title stays the period's.
    expect(document.title).toBe('Personal Summary – September 2026');
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

    expect(titles).toEqual(['Personal Summary – September 2026']);
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
    expect(document.title).toBe('Personal Summary – September 2026');
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

      const marker = within(goal).getByRole('button', { name: 'From your office’s upload, September 2026' });
      expect(marker.querySelector('[aria-hidden="true"]')).toHaveTextContent('ⓘ');
      // The words show on focus and on a tap, not only to a mouse — and are said once, by the name.
      const tip = within(goal).getByText('From your office’s upload, September 2026', { selector: '[role="tooltip"]' });
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
      expect(within(goal).getByRole('button', { name: 'Corrected by your office, year to date as of August 2026' }))
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
    expect(await card('Your sales activity targets')).toHaveTextContent('42 total activities logged this month across all categories.');
  });

  /*
   * *Amended 2026-10-01 (P10.1-T8, ADR-0069):* the badge is the prototype's *AI-powered*, at the client's
   * request, where T6 had *Rules, not AI*. Once per card is unchanged, and so is what stays out: the
   * *Rule:* lines, and the prototype's footnotes, whose learning claims the fixed rules cannot keep.
   */
  it('AC-3: one AI-powered per card, in the badge — no Rule line under an item, and no footnote', async () => {
    show(summary({
      insights: [
        { rule: 'BEHIND_PACE', kind: 'action', facts: { projected: 2, closingTarget: 5, neededPerWeek: 1, weeksLeft: 3 } },
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

    expect(screen.getByText('Your goals, activity and leads — on one page.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Print' })).not.toBeInTheDocument();
  });
});
