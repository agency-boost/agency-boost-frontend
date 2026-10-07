import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch } from '@test/harness';
import CoachingPersonLayout from '../layout';
import CoacheeSummaryTab from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching/mem-rina/summary',
}));

const LEADER = makeMe({
  user: {
    id: 'u-agus', email: 'agus@kpm0417.test', fullName: 'Agus Santoso', preferredName: 'Agus',
    pronoun: 'he', initials: 'AS', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: ['coaching_session:read', 'personal_summary:read', 'goal:read', 'goal:update'],
});

const person = (pronoun: 'she' | 'he' | 'they', name = 'Rina Wijaya') => ({
  membershipId: 'mem-rina', name, pronoun, rung: { code: 'AGENT', label: 'Agent' },
  leader: { membershipId: 'mem-agus', name: 'Agus Santoso' }, direct: true, downline: { members: 0, leaders: 0 },
});

const M = 1_000_000 * 100;
const figures = (over: Record<string, unknown> = {}) => ({
  targetMinor: 75 * M, actualMinor: 30 * M, attainmentPct: 40, gapMinor: 45 * M, overMinor: 0,
  policiesNeeded: 3, targetMet: false, ...over,
});
const chip = (key: string, code: string, logged: number, target: number | null, attainmentPct: number | null) =>
  ({ key, code, logged, target, attainmentPct, targetMet: target !== null && logged >= target });
const activity = {
  from: '2026-09-01', to: '2026-09-14',
  targets: [
    chip('leads', 'LEADS_CONTACTED', 20, 57, 35),
    chip('appointments', 'SELL_PRESENTATION', 6, 17, 35),
    chip('closings', 'SELL_SUBMISSION', 2, 5, 40),
  ],
  total: 42,
  sections: [],
};
const lead = (over: Record<string, unknown>) => ({
  id: 'l-1', name: 'Desi Pratama', type: 'sales', statusCode: 'FOLLOW_UP', statusLabel: 'Follow-up',
  thisMonth: false, flags: [], overdueDays: null, nextActionDate: '2026-09-20', nextActionNote: null, ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({
  year: '2026', month: '2026-09', today: '2026-09-14',
  goal: { set: true, savedAt: '2026-09-01T02:00:00.000Z' }, caseSizeMinor: 18 * M,
  monthly: { ...figures(), source: { provenance: 'imported', month: '2026-09' } },
  yearly: { ...figures({ targetMinor: 500 * M }), source: { provenance: 'imported', month: '2026-09' } },
  pace: {
    closingTarget: 5, closingsLast30Days: 4, dayOfMonth: 14, daysInMonth: 30, weeksLeft: 3, policiesNeeded: 3,
    neededPerWeek: 1, targetMet: false,
  },
  activity: { monthly: activity, yearly: activity },
  leads: {
    rows: [
      lead({ thisMonth: true, flags: ['overdue'], overdueDays: 6, nextActionNote: 'Confirm submission paperwork' }),
      lead({ id: 'l-2', name: 'Alvin Sanjaya', type: null, statusCode: null, statusLabel: null, flags: ['no-next-action', 'no-remarks'], nextActionDate: null }),
    ],
    total: 2,
  },
  insights: [
    { rule: 'NOTHING_LOGGED', kind: 'action', facts: { windowDays: 7, lastLoggedOn: '2026-09-04' } },
    { rule: 'LEAD_OVERDUE', kind: 'action', facts: { leadId: 'l-1', name: 'Desi Pratama', overdueDays: 6, others: 2 } },
    {
      rule: 'RATIO_BELOW', kind: 'improve',
      facts: { code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', value: 0.09, benchmark: 0.15, displayUnit: 'percent' },
    },
  ],
  ...over,
});

const SHELL = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
};

const RATIOS = {
  membershipId: 'mem-rina', from: '2026-08-16', to: '2026-09-14', days: 30,
  ratios: [{
    code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', comparison: 'gte', displayUnit: 'percent', benchmark: 0.15,
    tag: null, sides: null, numerator: [], denominator: [], purpose: null, divergesFromStandard: false,
    value: 0.18, share: null, numeratorCount: 9, denominatorCount: 50, status: 'success',
  }],
};

const show = (body: unknown, who = person('she'), me = LEADER, ratios: { status?: number; body?: unknown } = { body: RATIOS }) => {
  const stub = stubFetch({ ...SHELL, '/coaching/coachees/': { body: who }, '/summary': { body }, '/activity/ratios': ratios });
  renderInLayout(
    AgentLayout,
    <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeSummaryTab /></CoachingPersonLayout>,
    { me },
  );
  return stub;
};
const card = (name: string | RegExp) => screen.findByRole('region', { name });

/** The six words coaching's own strings never use (ADR-0084). */
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

describe('a coachee’s Personal Summary tab (P11-T7 AC-4)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P11-T7 AC-4 reads the coachee’s Summary through GET /summary?for=, and her ratios through GET /activity/ratios?for= (P11-T8)', async () => {
    const { calls } = show(summary());
    await card('Goal vs. actual (APE)');

    const reads = calls.filter((c) => c.url.includes('/summary'));
    expect(reads.map((c) => c.url)).toEqual(['http://api.test/api/v1/summary?for=mem-rina']);
    // Her pulse is hers: the reader's own ratios, with no subject, would be the wrong person's.
    expect(calls.filter((c) => c.url.includes('/activity/ratios')).map((c) => c.url))
      .toEqual(['http://api.test/api/v1/activity/ratios?for=mem-rina']);
  });

  it('P11-T7 AC-4 writes the cards in her pronoun, as the prototype’s coaching tab does', async () => {
    show(summary());

    expect(await card('Her sales activity targets')).toHaveTextContent(
      'From Goal Settings — appointments and closings are her sales pipeline targets.',
    );
    expect(await card('Leads that need her')).toHaveTextContent('All active leads, nearest date first');
    expect(await card('The gap')).toHaveTextContent(
      'At her current pace, she’s tracking to close 4 policies this month against a target of 5. With 3 weeks left, she’d need to close roughly 1 policy/week to catch up.',
    );
    expect(await card('How she can improve')).toBeInTheDocument();
    expect(screen.getByRole('main').textContent).not.toMatch(/\byou\b|\byour\b/i);
  });

  it('P13.1-T5 AC-1 her gap is the same box as her own page: the danger box until her APE target is met, then green', async () => {
    show(summary());
    const behind = within(await card('The gap')).getByText(/tracking to close/).closest('p')!;
    expect(behind.className).toContain('bg-alert/[0.06]');
    expect(behind).toHaveTextContent('⚠️');
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show(summary({ pace: { closingTarget: 5, closingsLast30Days: 2, dayOfMonth: 20, daysInMonth: 30, weeksLeft: 2, policiesNeeded: 0, neededPerWeek: 0, targetMet: true } }));
    const met = within(await card('The gap')).getByText(/already reached/).closest('p')!;
    expect(met).toHaveTextContent('She’s already reached this month’s target — nice work. Keep the pace to stay ahead.');
    expect(met.className).toContain('bg-success/[0.06]');
  });

  it('P11-T7 AC-4 says him and his for a man, and them and their for somebody who chose neither', async () => {
    show(summary(), person('he', 'Fajar Hidayat'));
    expect(await card('His sales activity targets')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Leads that need him' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'How he can improve' })).toBeInTheDocument();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show(summary(), person('they', 'Melati Putri'));
    expect(await card('Their sales activity targets')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Leads that need them' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'How they can improve' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'The gap' })).toHaveTextContent('At their current pace, they’re tracking to close');
  });

  it('P11-T7 AC-4 shows the APE produced read-only, its source in her words', async () => {
    show(summary());
    const goal = await card('Goal vs. actual (APE)');

    expect(within(goal).getByText('Rp 30.000.000')).toBeInTheDocument();
    // Never the prototype's input (`#producedInput-cs`, contradiction #7).
    expect(within(goal).queryByRole('textbox')).not.toBeInTheDocument();
    const marker = within(goal).getByRole('button', { name: 'From the production upload, September 2026' });
    fireEvent.click(marker);
    expect(screen.getByText('From the production upload, September 2026', { selector: '[role="tooltip"]' })).toBeVisible();
  });

  it('P11-T7 AC-4 names her own figure as hers', async () => {
    show(summary({
      monthly: { ...figures(), source: { provenance: 'self_reported', month: null } },
    }));
    const goal = await card('Goal vs. actual (APE)');
    expect(within(goal).getByRole('button', { name: 'Her own figure, entered in Goal Settings' })).toBeInTheDocument();
  });

  it('P11-T7 AC-4 keeps the insight rules under the prototype’s AI-powered badge, in her words, linking nowhere', async () => {
    show(summary());

    const next = await card('What to do next');
    expect(within(next).getByText('AI-powered')).toBeInTheDocument();
    expect(next).toHaveTextContent(
      'Nothing logged in the last 7 days — her last entry was Sep 4. Every number on this page is made of what she logs.',
    );
    expect(next).toHaveTextContent(
      'Desi Pratama’s next action is 6 days overdue — reschedule it or set a new date this week. 2 more of her leads are overdue too.',
    );
    const improve = screen.getByRole('region', { name: 'How she can improve' });
    expect(within(improve).getByText('AI-powered')).toBeInTheDocument();
    expect(improve).toHaveTextContent('that step is where her activity is not yet converting.');
    expect(within(next).queryByRole('link')).not.toBeInTheDocument();
    expect(within(improve).queryByRole('link')).not.toBeInTheDocument();
  });

  it('P11-T8 draws her Activity pulse from her ratios on her rung', async () => {
    show(summary());
    await card('Goal vs. actual (APE)');

    const pulse = await card('Activity pulse');
    expect(pulse).toHaveTextContent('Last 30 days');
    expect(await within(pulse).findByText('18.0%')).toBeInTheDocument();
    expect(within(pulse).getByText('Selling success rate')).toBeInTheDocument();
    expect(within(pulse).queryByText('Upcoming')).not.toBeInTheDocument();
  });

  /*
   * P11-T7's review, ADR-0070 rule 2: `/summary` shows *Campaigns you're chasing* as an Upcoming sign in
   * its slot, so the coachee's page shows *Campaigns she's chasing* (`Overall.html:4124`) the same way.
   */
  it.each([
    ['she', "Campaigns she's chasing", 'The campaigns she chooses to chase from the Campaign list, and how close she is to each.'],
    ['he', "Campaigns he's chasing", 'The campaigns he chooses to chase from the Campaign list, and how close he is to each.'],
    ['they', "Campaigns they're chasing", 'The campaigns they choose to chase from the Campaign list, and how close they are to each.'],
  ] as const)('P11-T7 review shows the campaigns card as /summary does, a sign in its slot, in %s’s words', async (pronoun, title, what) => {
    const { calls } = show(summary(), person(pronoun));
    const sign = await card(`${title} Upcoming`);

    expect(within(sign).getByRole('heading', { level: 2 })).toHaveTextContent(title);
    expect(sign).toHaveTextContent(what);
    expect(sign).toHaveClass('print:hidden');
    expect(within(sign).queryByRole('link')).not.toBeInTheDocument();
    expect(calls.some((c) => /campaign/i.test(c.url))).toBe(false);
    expect(sign.textContent).not.toMatch(SIX_WORDS);
  });

  it('P11-T8 fails the pulse in its own card, and the Summary stands', async () => {
    show(summary(), person('she'), LEADER, { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } });
    const pulse = await card('Activity pulse');
    expect(await within(pulse).findByRole('alert')).toHaveTextContent('Not found');
    expect(screen.getByRole('region', { name: 'Goal vs. actual (APE)' })).toBeInTheDocument();
  });

  it('P11-T8 says when her role has no ratios, without ADR-0084’s six words', async () => {
    show(summary(), person('she'), LEADER, { body: { ...RATIOS, ratios: [] } });
    const pulse = await card('Activity pulse');
    expect(await within(pulse).findByText('There are no ratios for her role yet.')).toBeInTheDocument();
    expect(pulse.textContent).not.toMatch(SIX_WORDS);
  });

  it('P11-T7 AC-4 opens her Goal Setting tab where /summary links to the reader’s own Goal Settings, and links to no screen of the reader’s', async () => {
    show(summary());
    await card('Goal vs. actual (APE)');

    const links = within(screen.getByRole('main')).getAllByRole('link')
      .filter((a) => !a.closest('nav') && a.getAttribute('href') !== '/coaching');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Goal Settings', '/coaching/mem-rina/goal-setting'],
    ]);
  });

  it('P11-T7 AC-4 sends a coachee with no goal yet to her Goal Setting tab, in her words', async () => {
    show(summary({ goal: { set: false, savedAt: null } }));

    expect(await screen.findByText('She hasn’t set a goal for 2026 yet, so there is nothing to measure against.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set her goal' })).toHaveAttribute('href', '/coaching/mem-rina/goal-setting');
  });

  it('P11-T7 AC-4 says a lead with no type without a type, and an empty list in the prototype’s words', async () => {
    show(summary());
    const leads = await card('Leads that need her');
    expect(within(leads).getByText('No status yet')).toBeInTheDocument();
    expect(leads).not.toHaveTextContent(SIX_WORDS);
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show(summary({ leads: { rows: [], total: 0 } }));
    expect(await card('Leads that need her')).toHaveTextContent('No active leads.');
  });

  it('P11-T7 AC-4 uses none of ADR-0084’s six words anywhere on the tab, across both periods', async () => {
    show(summary({
      insights: [{ rule: 'NOTHING_LOGGED', kind: 'action', facts: { windowDays: 7, lastLoggedOn: null } }],
    }));
    await card('Goal vs. actual (APE)');
    expect(screen.getByRole('main').textContent).not.toMatch(SIX_WORDS);

    await userEvent.click(screen.getByRole('tab', { name: 'Yearly' }));
    expect(screen.getByRole('main').textContent).not.toMatch(SIX_WORDS);
    expect(screen.getByRole('main')).toHaveTextContent(
      'She hasn’t logged any activity yet — a few minutes each day is what every number on this page is made of.',
    );
  });

  it('P11-T7 AC-4 says so when nothing in her numbers asks for anything', async () => {
    show(summary({ insights: [] }));
    expect(await card('What to do next')).toHaveTextContent('Nothing in her numbers asks for anything right now.');
  });

  it('shows a skeleton in her words while the Summary is read, and the server’s refusal as an error', async () => {
    // The Summary is held until the skeleton has been seen: a read that answers at once can take the
    // skeleton away before the first look, now that the pulse is read beside it (P11-T8).
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const { mock } = stubFetch({ ...SHELL, '/coaching/coachees/': { body: person('she') }, '/summary': { body: summary() }, '/activity/ratios': { body: RATIOS } });
    const answer = mock.getMockImplementation()!;
    mock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/summary?')) await held;
      return answer(url, init);
    });
    renderInLayout(
      AgentLayout,
      <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeSummaryTab /></CoachingPersonLayout>,
      { me: LEADER },
    );
    expect(await screen.findByText('Putting her summary together…')).toBeInTheDocument();
    release();
    await card('Goal vs. actual (APE)');
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    stubFetch({
      ...SHELL,
      '/coaching/coachees/': { body: person('she') },
      '/summary': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'r-1' } } },
      '/activity/ratios': { body: RATIOS },
    });
    renderInLayout(
      AgentLayout,
      <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeSummaryTab /></CoachingPersonLayout>,
      { me: LEADER },
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found');
  });

  it('is refused, with no Summary read, to a reader without personal_summary:read', async () => {
    const { calls } = show(summary(), person('she'), { ...LEADER, permissions: ['coaching_session:read'] });
    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'personal_summary:read');
    expect(calls.some((c) => c.url.includes('/summary'))).toBe(false);
  });
});
