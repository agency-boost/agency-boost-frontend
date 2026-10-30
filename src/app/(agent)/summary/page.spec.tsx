import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, stubFetch, wears, type StubReply } from '@test/harness';
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
  policies: { source: 'activity_log', codes: ['SELL_SUBMISSION'] },
  uploadedOn: { month: '2026-09-12', year: '2026-09-12' },
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
    // UI-052 (c): the server's total is the sum of the rows the page shows — 20 + 6 + 2 + 6 + 7.
    total: 41,
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
  total: 180,
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

const show = (body: unknown, pulse: { status?: number; body: unknown } = { body: AGENT_RATIOS }, chasing: unknown = NONE_CHASED) => {
  const stub = stubFetch({ '/summary': { body }, '/activity/ratios': pulse, 'GET /campaigns/chasing': { body: chasing } });
  renderWithSession(<PersonalSummaryPage />, { me: AGENT });
  return stub;
};
const card = (name: string) => screen.findByRole('region', { name });
/** *Yearly*, the switch's second toggle (UI-051). */
const yearly = () => userEvent.click(screen.getByRole('button', { name: 'Yearly' }));
/** *Unduh*: the title row's from 1024px, and the control row's icon button below it — both in the document. */
const downloads = () => screen.getAllByRole('button', { name: 'Download' });
const dateHeader = async () => (await card('Goal vs. actual (APE)')).querySelector('[data-date-header]')!;

describe('the Personal Summary — the date header and the goal card (P10-T4; UI-054)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1, UI-054: opens on this month — the produced figure, the target, the attainment whole and its bar', async () => {
    show(summary());
    const goal = await card('Goal vs. actual (APE)');

    expect(within(goal).getByText('IDR 30M')).toBeInTheDocument();
    expect(goal).toHaveTextContent('of IDR 75M target');
    expect(within(goal).getByText('40%')).toBeInTheDocument();
    expect(within(goal).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    expect(within(goal).getByRole('heading', { level: 2 })).toHaveTextContent(/^Goal vs\. actual \(APE\)$/);
    // The month the figures are for: the pill names it on the screen (UI-051), the line on paper.
    expect(screen.getByRole('button', { name: 'Month: Sep 2026' })).toBeInTheDocument();
    expect(screen.getByText('Sep 2026', { selector: 'p' })).toHaveClass('hidden', 'print:block');
  });

  it('UI-054 the date header: the day the APE is valid for — the upload’s — and the days left after today', async () => {
    show(summary());
    const header = await dateHeader();

    expect(header).toHaveTextContent('12 Sep 2026');
    expect(header).toHaveTextContent('16 days left this month');
    expect(header.querySelector('svg')).toBeInTheDocument();
    // Outside and above the orange card.
    const hero = (await card('Goal vs. actual (APE)')).querySelector('[data-goal-hero]')!;
    expect(hero.contains(header)).toBe(false);
    expect(header.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('UI-054 the date header on the last day of the month says so, and on the first counts the rest', async () => {
    show(summary({ today: '2026-09-30', uploadedOn: { month: '2026-09-30', year: '2026-09-30' } }));
    expect(await dateHeader()).toHaveTextContent('30 Sep 2026last day of the month');
  });

  it('UI-054 the date header on the first day of the month, before its file: the month by name, 29 days left', async () => {
    show(summary({
      today: '2026-09-01', uploadedOn: { month: null, year: '2026-08-31' },
      monthly: { ...figures({ actualMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }), source: null },
    }));
    expect(await dateHeader()).toHaveTextContent('Sep 202629 days left this month');
  });

  it('UI-054 the date header on Yearly: the year’s latest upload, and the days left this year', async () => {
    show(summary({ uploadedOn: { month: null, year: '2026-09-03' } }));
    await card('Goal vs. actual (APE)');
    await yearly();
    expect(await dateHeader()).toHaveTextContent('3 Sep 2026108 days left this year');
  });

  it('AC-1: switches to the year — the annual target against the year to date, the gap inside the card', async () => {
    show(summary());
    await card('Goal vs. actual (APE)');

    await yearly();

    const goal = await card('Goal vs. actual (APE)');
    expect(within(goal).getByText('IDR 230M')).toBeInTheDocument();
    expect(goal).toHaveTextContent('of IDR 500M target');
    expect(within(goal).getByText('46%')).toBeInTheDocument();
    expect(goal).toHaveTextContent('Remaining this yearIDR 270M');
    expect(screen.getByRole('button', { name: 'Yearly' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC-1: says this month is not uploaded yet — no zero, no attainment, no gap made up', async () => {
    show(summary({
      monthly: { ...figures({ actualMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }), source: null },
      uploadedOn: { month: null, year: '2026-08-31' },
    }));
    const goal = await card('Goal vs. actual (APE)');

    expect(goal).toHaveTextContent('Not uploaded yet of IDR 75M target');
    expect(goal).not.toHaveTextContent('%');
    // Nothing produced, so nothing to mark: *Not uploaded yet* says it (P10.1-T6 AC-1). The one button is the
    // heading's *What is APE?* (P18.95-T9 AC-3).
    expect(within(goal).queryAllByRole('button').map((b) => b.textContent)).toEqual(['ⓘWhat is APE?']);
    expect(goal).toHaveTextContent('Remaining this month—');
    expect(goal).not.toHaveTextContent('IDR 0');
  });

  it('AC-2: edits nothing — the figure is shown, and its marker says it is your own, from Goal Settings', async () => {
    show(summary({ yearly: { ...figures({ actualMinor: 120 * M }), source: { provenance: 'self_reported', month: null } } }));
    await card('Goal vs. actual (APE)');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();

    await yearly();
    const goal = await card('Goal vs. actual (APE)');
    expect(within(goal).getByRole('button', { name: 'Your own figure, entered in Goal Settings' })).toBeInTheDocument();
  });

  it('UI-054, UI-006: the gap is the card’s foot — Remaining this month | Policies needed ± n', async () => {
    show(summary({ monthly: { ...figures({ policiesNeeded: 1 }), source: null } }));
    const foot = (await card('Goal vs. actual (APE)')).querySelector('dl')!;
    expect([...foot.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(['Remaining this month', 'Policies needed']);
    expect([...foot.querySelectorAll('dd')].map((dd) => dd.textContent)).toEqual(['IDR 45M', '± 1 policy']);
    // No separate *The gap* card, and no week count (UI-054).
    expect(screen.queryByRole('region', { name: 'The gap' })).not.toBeInTheDocument();
    expect(screen.queryByText(/week/)).not.toBeInTheDocument();
  });

  it('AC-3, UI-102: a target reached says so, asks for nothing, and Boost celebrates', async () => {
    show(summary({
      monthly: { ...figures({ actualMinor: 95 * M, attainmentPct: 127, gapMinor: 0, overMinor: 20 * M, policiesNeeded: 0, targetMet: true }), source: null },
      pace: { closingTarget: 5, closingsLast30Days: 6, dayOfMonth: 20, daysInMonth: 30, weeksLeft: 2, policiesNeeded: 0, neededPerWeek: 0, targetMet: true },
    }));
    const goal = await card('Goal vs. actual (APE)');
    expect(goal).toHaveTextContent('Reached — IDR 20M over');
    expect(goal).toHaveTextContent('Policies neededNone');
    expect(within(goal).getByText('127%')).toBeInTheDocument();
    const boost = goal.querySelector('img[data-boost]')!;
    expect(boost).toHaveAttribute('data-boost', 'celebrating');
    expect(boost).toHaveAttribute('alt', '');
  });

  it('UI-102: Boost celebrates at 100% and not below it', async () => {
    show(summary({ monthly: { ...figures({ attainmentPct: 99 }), source: null } }));
    expect((await card('Goal vs. actual (APE)')).querySelector('img[data-boost]')).toBeNull();
  });

  /*
   * **UI-054: the behind-pace message once.** The ⚠️ box under *The gap* repeated the *Langkah berikutnya* card's
   * `BEHIND_PACE`; the box went, so the sentence is the card's alone, and no ⚠️ or ✅ is drawn.
   */
  it('UI-054 the behind-pace message appears once — in the AI card — and no pace box is drawn', async () => {
    show(summary({
      pace: { closingTarget: 10, closingsLast30Days: 21, dayOfMonth: 17, daysInMonth: 30, weeksLeft: 2, policiesNeeded: 8, neededPerWeek: 4, targetMet: false },
      insights: [{ rule: 'BEHIND_PACE', kind: 'action', facts: { closingsLast30Days: 2, closingTarget: 5, neededPerWeek: 1, weeksLeft: 3 } }],
    }));
    const next = await card('What to do next');
    expect(next).toHaveTextContent('You’re behind pace');
    expect(screen.getAllByText(/behind pace|tracking to close|current pace/)).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/⚠️|✅/u);
  });

  it('AC-3: a year made before this month began leaves the month met and says so (ADR-0047)', async () => {
    show(summary({
      monthly: { targetMinor: 0, actualMinor: 30 * M, attainmentPct: null, gapMinor: 0, overMinor: 30 * M, policiesNeeded: 0, targetMet: true, source: { provenance: 'imported', month: '2026-09' } },
      pace: { closingTarget: 0, closingsLast30Days: 4, dayOfMonth: 14, daysInMonth: 30, weeksLeft: 3, policiesNeeded: 0, neededPerWeek: 0, targetMet: true },
    }));
    const goal = await card('Goal vs. actual (APE)');
    expect(goal).toHaveTextContent('Your year’s target was made before this month began — this month needs nothing more.');
    expect(goal).not.toHaveTextContent('of IDR 0 target');
    expect(goal).toHaveTextContent('Reached — IDR 30M over');
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

describe('the Personal Summary — Target aktivitas, one card (P10-T5; UI-050, UI-052)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1, UI-050: this month’s three counts against their targets in three columns, each with its bar', async () => {
    show(summary());
    const targets = await card('Your sales activity targets');

    // The cascade's words, as `/goals` names its stages (ADR-0160 §4), each a column.
    expect([...targets.querySelectorAll('[data-target]')].map((c) => c.textContent)).toEqual([
      'Set appointment20 / 57', 'Sales meeting6 / 17', 'Submission polis2 / 5',
    ]);
    expect(within(targets).getByRole('progressbar', { name: 'Submission polis against target' })).toHaveAttribute('aria-valuenow', '40');
    expect(within(targets).getByRole('progressbar', { name: 'Set appointment against target' })).toHaveAttribute('aria-valuetext', '20 of 57');
    // Appendix A: *From Goal Settings — …* shows on a desktop only (a tablet's is behind the ⓘ).
    const from = within(targets).getByRole('link', { name: 'Goal Settings' });
    expect(from).toHaveAttribute('href', '/goals');
    expect(from.closest('p')).toHaveClass('max-lg:hidden');
    // One white card under a heading outside it (UI-050).
    expect(within(targets).getByRole('heading', { level: 2 }).closest('.rounded-lg')).toBeNull();
  });

  it('UI-052 (c): n activities is the server’s total — the sum of the rows the card shows', async () => {
    show(summary());
    const targets = await card('Your sales activity targets');
    const total = targets.querySelector('[data-activity-total]')!;

    expect(total).toHaveTextContent('41 activities this month');
    const shown = [...targets.querySelectorAll('[data-target]')].map((c) => Number(c.querySelector('p')!.firstChild!.textContent))
      .concat([...targets.querySelectorAll('[data-breakdown="wide"] h3')].map((h) => Number(h.lastElementChild!.textContent)));
    expect(shown.reduce((a, b) => a + b, 0)).toBe(41);
  });

  it('UI-052 (a): the heading’s ⓘ says where the policies come from — the log, and APE from the upload', async () => {
    show(summary());
    const targets = await card('Your sales activity targets');
    const source = 'Submission polis counts the policies you log in Log Activity; APE comes from the production upload.';
    expect(within(targets).getByRole('button', { name: source })).toBeInTheDocument();
    // Beside the heading, not inside it: the region's name stays its words.
    expect(within(targets).getByRole('heading', { level: 2 })).toHaveTextContent(/^Your sales activity targets$/);
  });

  it('UI-052 (a), Appendix A: on a tablet the ⓘ also says where the targets come from', async () => {
    atWidth(800);
    show(summary());
    const targets = await card('Your sales activity targets');
    expect(await within(targets).findByRole('button', {
      name: /^From Goal Settings — appointments and closings are your Sales pipeline targets\. Submission polis counts/,
    })).toBeInTheDocument();
  });

  it('AC-1: the year to date against the year’s targets', async () => {
    show(summary());
    await card('Your sales activity targets');

    await yearly();

    const targets = await card('Your sales activity targets');
    expect(targets).toHaveTextContent('Submission polis11 / 28');
    expect(targets).toHaveTextContent('180 activities this year');
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

  it('UI-050 on a phone the tiles are one split row, each opening its activities in a sheet', async () => {
    show(summary());
    const targets = await card('Your sales activity targets');
    const row = targets.querySelector('[data-breakdown="phone"]')!;

    expect(row).toHaveClass('md:hidden');
    const buttons = within(row as HTMLElement).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Recruitment activities6', 'Development activities7']);
    expect(buttons[0].querySelector('svg')).toBeInTheDocument();

    await userEvent.click(buttons[0]);
    const sheet = await screen.findByRole('dialog', { name: 'Recruitment activities' });
    expect(within(sheet).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['Proses pendaftaran kode agen3', 'Follow up NBO2', 'NPA1']);
  });

  it('UI-056, Appendix A: from 768px the lists side by side, every row shown', async () => {
    show(summary());
    const targets = await card('Your sales activity targets');
    const wide = targets.querySelector('[data-breakdown="wide"]')!;

    expect(wide).toHaveClass('max-md:hidden', 'md:grid-cols-2');
    expect([...wide.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Recruitment activities6', 'Development activities7']);
    expect(within(wide as HTMLElement).getAllByRole('listitem')).toHaveLength(6);
  });

  it('AC-5: draws the tiles as the server sends them, and regroups nothing itself (ADR-0064)', async () => {
    const ungrouped = activity({
      sections: [
        { code: 'PERSONAL_DEVELOPMENT', label: 'Personal Development', total: 3, rows: [{ code: 'DEV_TRAINING_ATTEND', label: 'Training', count: 3 }] },
        { code: 'TEAM_DEVELOPMENT', label: 'Team Development', total: 4, rows: [{ code: 'DEV_TEAM_ACTIVITY', label: 'Aktivitas team development', count: 4 }] },
      ],
    });
    show(summary({ activity: { monthly: ungrouped, yearly: activity(YEAR) } }));
    const targets = await card('Your sales activity targets');

    expect([...targets.querySelectorAll('[data-breakdown="wide"] h3')].map((h) => h.textContent))
      .toEqual(['Personal Development activities3', 'Team Development activities4']);
    expect(targets).not.toHaveTextContent(/^Development activities/);
  });
});

describe('the Personal Summary — the ratio card (P10-T5; UI-053)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-053 the shared card, its header inside it: every ratio a row, its value and target, the read once', async () => {
    const { calls } = show(summary());
    const ratiosCard = await card('Ratio · last 30 days');

    expect(ratiosCard).toHaveAttribute('data-ratio-card');
    expect(await within(ratiosCard).findByText('Selling success rate')).toBeInTheDocument();
    expect(ratiosCard.querySelector('[data-ratio="SELLING_SUCCESS_RATE"]')).toHaveTextContent('Selling success rateTarget 15%9%');
    expect(ratiosCard.querySelector('[data-ratio="LEADS_PER_ACTIVITY"]')).toHaveTextContent('0.38');
    expect(ratiosCard.querySelector('[data-ratio="MEETING_PER_APPROACH"] [data-status]')).toHaveAttribute('data-status', 'none');
    // No pills or verdict words — *–* is heard as *Not enough data* — and no heading outside the card (UI-053).
    expect(ratiosCard).not.toHaveTextContent(/Below benchmark|On target|Above benchmark/);
    expect(screen.queryByRole('region', { name: 'Activity ratios' })).not.toBeInTheDocument();
    // Once, whichever period is showing.
    await yearly();
    expect(calls.filter((c) => c.url.includes('/activity/ratios'))).toHaveLength(1);
  });

  it('UI-053 all five: the balance is the split bar, as on the Ratio page', async () => {
    show(summary(), {
      body: ratios([
        ratio({}),
        ratio({
          code: 'SELLING_VS_RECRUITMENT', label: 'Selling vs Recruitment', comparison: 'band', displayUnit: 'points', benchmark: 30,
          value: 24.4, share: 62.2, status: 'success', sides: { first: 'Selling', second: 'Recruitment' },
        }),
      ]),
    });
    const ratiosCard = await card('Ratio · last 30 days');
    expect(await within(ratiosCard).findByText('Selling vs Recruitment')).toBeInTheDocument();
    expect(ratiosCard.querySelector('[data-split-bar]')).toBeInTheDocument();
  });

  it('AC-3: an office with no ratios for the rung says so', async () => {
    show(summary(), { body: ratios([]) });
    expect(await screen.findByText('No ratio applies here yet.')).toBeInTheDocument();
  });

  it('AC-3: a failed ratio read stays inside its card, and the rest of the page stands', async () => {
    show(summary(), { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'The ratios could not be read.' } } });
    const ratiosCard = await card('Ratio · last 30 days');

    expect(await within(ratiosCard).findByText('The ratios could not be read.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your sales activity targets' })).toBeInTheDocument();
  });
});

describe('the Personal Summary — leads that need you (P10-T6; UI-055)', () => {
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

  it('AC-1, P10.1-T6 AC-4: lists the rows the server sent — its ten — and no more', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => openLead({ id: `l-${i}`, name: `Pak Lead ${i}`, flags: i === 0 ? ['overdue'] : [], overdueDays: i === 0 ? 3 : null }));
    show(summary({ leads: { rows: ten, total: 12 } }));
    const leads = await card('Leads that need you');

    expect(within(leads).getAllByRole('listitem')).toHaveLength(10);
    expect(within(leads).getByText('Overdue 3 days')).toBeInTheDocument();
  });

  it('UI-055 with open leads the card shows at every size; its tag on a desktop only (Appendix A)', async () => {
    show(summary());
    const leads = await card('Leads that need you');
    expect(wears(leads, 375)).not.toMatch(/\bhidden\b/);
    const tag = within(leads).getByText('Your open leads, nearest date first');
    expect(wears(tag, 375)).toMatch(/\bhidden\b/);
    expect(wears(tag, 768)).toMatch(/\bhidden\b/);
    expect(wears(tag, 1280)).not.toMatch(/\bhidden\b/);
  });

  it('UI-055 no open leads: hidden at 375, there at 768 and 1280, saying so and where to add one', async () => {
    show(summary({ leads: { rows: [], total: 0 } }));
    const leads = await card('Leads that need you');

    expect(wears(leads, 375)).toMatch(/\bhidden\b/);
    expect(wears(leads, 768)).not.toMatch(/\bhidden\b/);
    expect(wears(leads, 1280)).not.toMatch(/\bhidden\b/);
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

    // UI-050: the badge on the heading's row, outside the card, in sentence case.
    const badge = within(next).getByText('AI-powered');
    expect(badge).not.toHaveClass('uppercase');
    expect(screen.queryByText(/rules, not AI/i)).not.toBeInTheDocument();
  });

  it('UI-050: one action is a sentence, not a list of one', async () => {
    show(summary({ insights: [INSIGHTS[0]] }));
    const next = await card('What to do next');
    expect(within(next).queryByRole('list')).not.toBeInTheDocument();
    expect(next).toHaveTextContent('What to do nextAI-poweredYou’re behind pace');
  });

  it('AC-1, P18.97-T3 AC-2: a ratio below its benchmark goes on the improvement card, written as the ratio screen writes it', async () => {
    show(summary({ insights: INSIGHTS }));
    const improve = await card('How you can improve your performance');

    expect(improve).toHaveTextContent('Selling success rate is 9% over the last 30 days, below its benchmark of 15%');
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

  /*
   * *Amended 2026-10-01 (P10.1-T8, ADR-0069):* the badge is the prototype's *AI-powered*, at the client's
   * request. Once per card, and what stays out: the *Rule:* lines, and the prototype's learning footnotes.
   */
  it('P10.1-T6 AC-3: one AI-powered per card — no Rule line under an item, and no footnote', async () => {
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
      expect(region).not.toHaveTextContent('Rule:');
      expect(region).not.toHaveTextContent(/sharper|Generated automatically|Pattern-based/i);
    }
  });
});

/*
 * *Unduh* (P10-T8, ADR-0061; P10.1-T8, ADR-0068; UI-051, UI-057): still the browser's print, as the prototype's
 * handler is, under a title that names the PDF. UI V1 moves it: below 1024px a 44px icon button at the control row's
 * end, from 1024px the title row's secondary button — both in the document, CSS showing one.
 */
describe('the Personal Summary — Download (P10-T8, ADR-0068; UI-051)', () => {
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

  it('UI-051, UI-057: from 1024px a secondary button with a line icon; below it a 44px icon button — each prints the page', async () => {
    const { print } = stubPrint();
    const { calls } = show(summary());
    await card('Goal vs. actual (APE)');
    const before = calls.length;

    const [wide, compact] = downloads();
    expect(wide).toHaveTextContent(/^Download$/);
    expect(wide.querySelector('svg')).toBeInTheDocument();
    expect(wide).toHaveClass('border-navy');
    expect(wide).not.toHaveClass('bg-amber');
    expect(compact).toHaveAttribute('data-download', 'compact');
    expect(compact).toHaveClass('h-11', 'w-11', 'lg:hidden');
    expect(compact.textContent).toBe('');

    await userEvent.click(wide);
    await userEvent.click(compact);

    expect(print).toHaveBeenCalledTimes(2);
    expect(calls).toHaveLength(before);
    expect(screen.queryByRole('button', { name: /print/i })).not.toBeInTheDocument();
  });

  it('titles the page for its month while printing, so the PDF is named for it — and puts the title back after', async () => {
    const { titles } = stubPrint();
    show(summary());
    await card('Goal vs. actual (APE)');

    await userEvent.click(downloads()[0]);

    expect(titles).toEqual(['Personal Summary – Sep 2026']);
    expect(document.title).toBe('Personal Summary – Sep 2026');
    window.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe(ORIGINAL_TITLE);
    document.title = 'Something else';
    window.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe('Something else');
  });

  it('puts the title back when the browser fires afterprint inside print() — the listener is there first', async () => {
    const titles: string[] = [];
    vi.stubGlobal('print', vi.fn(() => { titles.push(document.title); window.dispatchEvent(new Event('afterprint')); }));
    document.title = ORIGINAL_TITLE;
    show(summary());
    await card('Goal vs. actual (APE)');

    await userEvent.click(downloads()[1]);

    expect(titles).toEqual(['Personal Summary – Sep 2026']);
    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  it('keeps the page’s own title to put back when Download is pressed twice before the window closes', async () => {
    const { titles } = stubPrint();
    show(summary());
    await card('Goal vs. actual (APE)');

    await userEvent.click(downloads()[0]);
    await userEvent.click(downloads()[0]);
    window.dispatchEvent(new Event('afterprint'));

    expect(titles).toHaveLength(2);
    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  it('puts the title back when the page goes, for a browser that never fires afterprint', async () => {
    stubPrint();
    stubFetch({ '/summary': { body: summary() }, '/activity/ratios': { body: AGENT_RATIOS } });
    const { unmount } = renderWithSession(<PersonalSummaryPage />, { me: AGENT });
    await card('Goal vs. actual (APE)');

    await userEvent.click(downloads()[0]);
    expect(document.title).toBe('Personal Summary – Sep 2026');
    unmount();

    expect(document.title).toBe(ORIGINAL_TITLE);
  });

  it('titles it for the year on the Yearly view', async () => {
    const { titles } = stubPrint();
    show(summary());
    await card('Goal vs. actual (APE)');

    await yearly();
    await userEvent.click(downloads()[0]);
    window.dispatchEvent(new Event('afterprint'));

    expect(titles).toEqual(['Personal Summary – 2026']);
  });

  it('AC-3: keeps the buttons and the period controls off the paper, and each section whole on it', async () => {
    show(summary());
    await card('Goal vs. actual (APE)');

    expect(downloads()[0]).toHaveClass('print:hidden');
    expect(document.querySelector('[data-summary-controls]')).toHaveClass('print:hidden');
    for (const name of ['Goal vs. actual (APE)', 'Your sales activity targets', 'Ratio · last 30 days', 'Leads that need you']) {
      expect(await card(name)).toHaveClass('print:break-inside-avoid');
    }
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

describe('the Personal Summary — one control row, two columns, line icons (UI-051, UI-056, UI-057)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-051: one control row — Monthly | Yearly, the month pill and the download — and no native select', async () => {
    show(summary());
    await card('Goal vs. actual (APE)');
    const row = document.querySelector('[data-summary-controls]') as HTMLElement;

    const switcher = within(row).getByRole('group', { name: 'Period' });
    expect(within(switcher).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')]))
      .toEqual([['Monthly', 'true'], ['Yearly', 'false']]);
    expect(within(row).getByRole('button', { name: 'Month: Sep 2026' })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(within(row).getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    // 44px targets below 1024px (UI-010).
    for (const b of within(row).getAllByRole('button')) expect(wears(b, 375)).toMatch(/\b(min-h-11|h-11)\b/);
    // The goal card follows the row directly: the first thing under it (≤ ~130px at 375, UI-051).
    expect(row.nextElementSibling?.querySelector('[data-goal-hero]')).toBeInTheDocument();
  });

  it('Appendix A: the line under the title is gone at every size', async () => {
    show(summary());
    await card('Goal vs. actual (APE)');
    expect(screen.queryByText(/on one page/)).not.toBeInTheDocument();
  });

  it('UI-056: two columns from 1024px — goal and targets left, the rest right — and the cards’ edge is the title’s', async () => {
    show(summary(), undefined, RINA_CHASING);
    const goal = await card('Goal vs. actual (APE)');
    const grid = goal.parentElement!.parentElement!;

    expect(wears(grid, 1280)).toContain('grid-cols-[minmax(0,3fr)_minmax(0,2fr)]');
    expect(wears(grid, 768)).not.toContain('grid-cols-');
    const [left, right] = [...grid.children].filter((c) => c.tagName === 'DIV');
    expect(left).toContainElement(goal);
    expect(left).toContainElement(await card('Your sales activity targets'));
    for (const name of ['Ratio · last 30 days', "Campaigns you're chasing", 'What to do next', 'Leads that need you']) {
      expect(right).toContainElement(await card(name));
    }
    // Not centred (UI-056: the title at x292, the cards at x329).
    expect(grid.parentElement!.className).not.toContain('mx-auto');
  });

  it('UI-050: every section has its heading outside its card', async () => {
    show(summary({ insights: [{ rule: 'LEAD_NEGLECTED', kind: 'action', facts: { leadId: 'l-2', name: 'Pak Alvin', others: 0 } }] }));
    for (const name of ['Your sales activity targets', "Campaigns you're chasing", 'What to do next', 'Leads that need you']) {
      const section = await card(name);
      const heading = within(section).getByRole('heading', { level: 2 });
      expect(heading.closest('.bg-card')).toBeNull();
      expect(section.querySelector('.bg-card')).toBeInTheDocument();
    }
  });

  it('UI-057: no emoji renders on /summary — download, trophy, calendar and ⓘ are line icons', async () => {
    show(summary({
      monthly: { ...figures({ actualMinor: 95 * M, attainmentPct: 127, targetMet: true, gapMinor: 0, overMinor: 20 * M }), source: null },
      insights: [{ rule: 'BEHIND_PACE', kind: 'action', facts: { closingsLast30Days: 2, closingTarget: 5, neededPerWeek: 1, weeksLeft: 3 } }],
    }), undefined, RINA_CHASING);
    const campaigns = await card("Campaigns you're chasing");
    await within(campaigns).findByText('MDRT Qualification');

    expect(document.body.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(within(campaigns).getAllByRole('listitem')[0].querySelector('svg')).toBeInTheDocument();
  });
});

describe('the Personal Summary — provenance is a marker, not a sentence (P10.1-T6, ADR-0063)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1: marks the month’s figure as the office’s upload, and names the month', async () => {
    show(summary());
    const goal = await card('Goal vs. actual (APE)');

    const marker = within(goal).getByRole('button', { name: 'From your office’s upload, Sep 2026' });
    expect(marker.querySelector('svg')).toBeInTheDocument();
    // The words show on focus and on a tap, not only to a mouse — and are said once, by the name.
    const tip = within(goal).getByText('From your office’s upload, Sep 2026', { selector: '[role="tooltip"]' });
    expect(tip).not.toBeVisible();
    fireEvent.click(marker);
    expect(tip).toBeVisible();
    expect(tip).toHaveAttribute('aria-hidden', 'true');
    expect(within(goal).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('AC-1: marks a correction by the office, and the year to date as of its month', async () => {
    show(summary({
      yearly: { ...figures({ targetMinor: 500 * M, actualMinor: 230 * M, attainmentPct: 46 }), source: { provenance: 'corrected', month: '2026-08' } },
    }));
    await card('Goal vs. actual (APE)');
    await yearly();

    expect(within(await card('Goal vs. actual (APE)')).getByRole('button', { name: 'Corrected by hand, year to date as of Aug 2026' }))
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
    await yearly();

    expect(within(await card('Goal vs. actual (APE)')).getByRole('button', { name: 'Corrected by Sari Puspita, year to date as of Oct 2026' }))
      .toBeInTheDocument();
  });

  it('AC-2: the footnotes stay gone — the one link left is From Goal Settings', async () => {
    show(summary({
      monthly: { ...figures({ actualMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }), source: null },
      leads: { rows: LEADS, total: 14 },
    }));
    await within(await card('Ratio · last 30 days')).findByText('Selling success rate');

    expect(screen.queryByText(/worked out once this month’s APE is uploaded/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Day by day/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nearest of your/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/goals']);
  });
});

/*
 * *Campaign yang Anda kejar* (`Overall.html:3225-3232`, `:6221-6253`; P18.5-T7 AC-6; UI-006, UI-050, UI-057).
 */
describe('Campaigns you’re chasing (P18.5-T7 AC-6; UI-050)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const campaigns = () => card("Campaigns you're chasing");
  const showWith = (routes: Record<string, StubReply | StubReply[]>) => {
    const stub = stubFetch({ '/summary': { body: summary() }, '/activity/ratios': { body: AGENT_RATIOS }, ...routes });
    renderWithSession(<PersonalSummaryPage />, { me: AGENT });
    return stub;
  };

  it('P18.5-T7 AC-6, UI-050: its heading outside the card, From the Campaign list on a desktop, after the ratios and before the next steps', async () => {
    showWith({ 'GET /campaigns/chasing': { body: RINA_CHASING } });
    const section = await campaigns();
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(/^Campaigns you're chasing$/);
    const from = within(section).getByText('From the Campaign list');
    expect(wears(from, 1280)).not.toMatch(/\bhidden\b/);
    expect(wears(from, 768)).toMatch(/\bhidden\b/);
    const ratiosCard = await card('Ratio · last 30 days');
    const next = await card('What to do next');
    expect(ratiosCard.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('P18.5-T7 AC-6, UI-057 a row per chase: a trophy line icon, its title, the months it runs and View →, read with no for', async () => {
    const { calls } = showWith({ 'GET /campaigns/chasing': { body: RINA_CHASING } });
    const section = await campaigns();
    const rows = await within(section).findAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      'Q4 APE SprintRuns Okt – Des 2026View →',
      'MDRT QualificationRuns Jan – DesView →',
    ]);
    for (const row of rows) expect(row.querySelector('svg')).toBeInTheDocument();
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
    await userEvent.click(within(dialog).getByRole('button', { name: 'Chasing' }));
    expect(await screen.findByText('Removed "Q4 APE Sprint" from your chase list')).toBeInTheDocument();
    await waitFor(() => expect([...section.querySelectorAll(':scope > div > ul > li')].map((li) => li.textContent))
      .toEqual(['MDRT QualificationRuns Jan – DesView →']));
    expect(calls.filter((c) => c.init.method === 'DELETE')).toHaveLength(1);
  });

  it('P18.5-T7 AC-6 is there whatever the period, read once', async () => {
    const { calls } = showWith({ 'GET /campaigns/chasing': { body: RINA_CHASING } });
    await within(await campaigns()).findByText('Q4 APE Sprint');
    await yearly();
    expect(await within(await campaigns()).findByText('Q4 APE Sprint')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/campaigns/chasing'))).toHaveLength(1);
  });
});

/**
 * **An earlier month or year** (P18.8-T11, ADR-0161 §4; UI-051's pill and sheet): the office's months under
 * *Monthly* and its years under *Yearly*, the choice in the address; a closed period shows its final figures, and the
 * gap and the days left only for the current one.
 */
describe('the Personal Summary — an earlier month or year (P18.8-T11; UI-051)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    nav.replace.mockClear();
  });

  const OPENED = { firstMonth: '2025-11', thisMonth: '2026-09', currentMonth: true, currentYear: true };
  /** August, read whole: a month that has ended, so no pace. */
  const AUGUST = summary({
    month: '2026-08', pace: null, period: { ...OPENED, currentMonth: false }, uploadedOn: { month: '2026-09-03', year: '2026-09-03' },
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
  /** The pill's sheet: its choices, in order, and the one ticked. */
  const openSheet = async (pill: RegExp) => {
    await userEvent.click(await screen.findByRole('button', { name: pill }));
    const sheet = await screen.findByRole('dialog');
    const list = within(sheet).getByRole('list');
    return { sheet, list, options: within(list).getAllByRole('button').map((b) => b.textContent) };
  };

  it('P18.8-T11 AC-2, UI-051 the month pill opens a sheet of the office’s months, newest first, this one ticked', async () => {
    open(summaries());
    const { sheet, list, options } = await openSheet(/^Month: Sep 2026$/);

    expect(sheet).toHaveAccessibleName('Month');
    expect(options).toEqual([
      'Sep 2026', 'Aug 2026', 'Jul 2026', 'Jun 2026', 'May 2026', 'Apr 2026', 'Mar 2026',
      'Feb 2026', 'Jan 2026', 'Dec 2025', 'Nov 2025',
    ]);
    expect(within(list).getByRole('button', { name: 'Sep 2026' })).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('P18.8-T11 AC-2 a year pill under Yearly, the office’s years newest first', async () => {
    open(summaries());
    await screen.findByRole('button', { name: 'Month: Sep 2026' });
    await yearly();

    const { options } = await openSheet(/^Year: 2026$/);
    expect(options).toEqual(['2026', '2025']);
    expect(screen.queryByRole('button', { name: /^Month:/ })).not.toBeInTheDocument();
  });

  it('P18.8-T11 AC-2 choosing a month reads it and puts it in the address, the pill holding it meanwhile', async () => {
    const { calls } = open(summaries({ '/summary?month=2026-08': { body: AUGUST } }));
    const { sheet } = await openSheet(/^Month: Sep 2026$/);

    await userEvent.click(within(sheet).getByRole('button', { name: 'Aug 2026' }));

    expect(nav.replace).toHaveBeenCalledWith('/summary?month=2026-08', { scroll: false });
    expect(screen.getByRole('button', { name: 'Month: Aug 2026' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText(/activities in Aug 2026/)).toBeInTheDocument();
    expect(summaryReads(calls)).toEqual(['', '?month=2026-08']);
  });

  it('P18.8-T11 AC-2 the address’s month opens the page on it, and the current month clears the address', async () => {
    const { calls } = open(summaries({ '/summary?month=2026-08': { body: AUGUST } }), { month: '2026-08' });
    await screen.findByText('Aug 2026', { selector: 'p' });
    const { sheet } = await openSheet(/^Month: Aug 2026$/);

    await userEvent.click(within(sheet).getByRole('button', { name: 'Sep 2026' }));

    expect(nav.replace).toHaveBeenLastCalledWith('/summary', { scroll: false });
    await waitFor(() => expect(summaryReads(calls)).toEqual(['?month=2026-08', '']));
  });

  it('P18.8-T11 AC-2 ?year= opens on Yearly with that year chosen, and reads it', async () => {
    const LAST_YEAR = summary({
      year: '2025', month: '2025-12', pace: null, period: { ...OPENED, currentMonth: false, currentYear: false },
    });
    const { calls } = open(summaries({ '/summary?year=2025': { body: LAST_YEAR } }), { year: '2025' });

    expect(await screen.findByRole('button', { name: 'Year: 2025' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yearly' })).toHaveAttribute('aria-pressed', 'true');
    expect(summaryReads(calls)).toEqual(['?year=2025']);
  });

  it('P18.8-T11 AC-2 switching views returns to now: Yearly from August reads this year, the address cleared', async () => {
    const { calls } = open(summaries({ '/summary?month=2026-08': { body: AUGUST } }), { month: '2026-08' });
    await screen.findByText('Aug 2026', { selector: 'p' });

    await yearly();

    expect(nav.replace).toHaveBeenCalledWith('/summary', { scroll: false });
    expect(await screen.findByRole('button', { name: 'Year: 2026' })).toBeInTheDocument();
    await waitFor(() => expect(summaryReads(calls)).toEqual(['?month=2026-08', '']));
  });

  it('P18.8-T11 AC-2 a malformed month in the address is not sent: the page is this month’s', async () => {
    const { calls } = open(summaries(), { month: '2026-13' });
    expect(await screen.findByRole('button', { name: 'Month: Sep 2026' })).toBeInTheDocument();
    expect(summaryReads(calls)).toEqual(['']);
  });

  it('P18.8-T11 AC-3, UI-054 a month that has ended: its final figures, the date only, no gap', async () => {
    open(summaries({ '/summary?month=2026-08': { body: AUGUST } }), { month: '2026-08' });
    const goal = await card('Goal vs. actual (APE)');

    expect(goal.querySelector('[data-date-header]')!.textContent).toBe('3 Sep 2026');
    expect(goal.querySelector('dl')).toBeNull();
    expect(goal).not.toHaveTextContent('Remaining');
    const targets = await card('Your sales activity targets');
    expect(targets).toHaveTextContent('37 activities in Aug 2026');
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

    await userEvent.click(downloads()[0]);

    expect(titles).toEqual(['Personal Summary – Aug 2026']);
    print.mockRestore();
  });
});
