import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch, type StubResponse } from '@test/harness';
import CoachingPersonLayout from '../layout';
import CoacheeGoalSettingTab from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching/mem-rina/goal-setting',
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

/**
 * The office's calendar says 2026 although the browser may say otherwise — on New Year's Eve in
 * another zone, say. The tab's period is the office's year, from the person read's `today`.
 */
const RINA = {
  membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
  leader: { membershipId: 'mem-agus', name: 'Agus Santoso' }, direct: true, downline: { members: 0, leaders: 0 },
  today: '2026-10-02',
};


const projection = (over: Record<string, unknown> = {}) => ({
  annualApeTargetMinor: 500_000_000_00, apeAchievedMinor: 0, remainingApeMinor: 500_000_000_00,
  monthlyApeTargetMinor: 100_000_000_00, policiesPerMonth: 6, policiesPerWeek: 2, appointmentsPerMonth: 20,
  appointmentsPerWeek: 5, leadsPerMonth: 67, leadsPerWeek: 16, targetMet: false, ...over,
});
const goal = (over: Record<string, unknown> = {}) => ({
  period: '2026', mode: 'direct', annualApeTargetMinor: 500_000_000_00, savingsTargetMinor: 50_000_000_00,
  commissionRatePct: 10, monthsLeft: 3, apeAchievedMinor: 0,
  achieved: { minor: 0, provenance: 'self_reported', month: null },
  caseSizeMinor: 18_000_000_00, leadsToApptPct: 30, closingRatePct: 30,
  snapshot: { monthlyApeTargetMinor: 100_000_000_00, policiesPerMonth: 6, appointmentsPerMonth: 20, leadsPerMonth: 67 },
  projected: projection(),
  cascadeMapping: { leadsCode: 'LEADS_CONTACTED', appointmentsCode: 'SELL_PRESENTATION', closingsCode: 'SELL_SUBMISSION' },
  cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
  // A subject's read carries no measured rates (D-rates, P11-T7 AC-10).
  measured: null,
  monthsLeftIsOverride: false,
  savedAt: '2026-09-13T04:00:00.000Z',
  // The coachee saved it themselves: on their own `/goals` that is no banner, and here it is none either.
  savedByMembershipId: 'mem-someone-else',
  ...over,
});

const SHELL = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
};

const show = (goals: StubResponse | StubResponse[] = { body: goal() }, me = LEADER, who: Record<string, unknown> = RINA) => {
  const stub = stubFetch({ ...SHELL, '/coaching/coachees/': { body: who }, '/goals/': goals });
  renderInLayout(
    AgentLayout,
    <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeGoalSettingTab /></CoachingPersonLayout>,
    { me },
  );
  return stub;
};

const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

describe('a coachee’s Goal Setting tab (P11-T7 AC-5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P11-T7 AC-5 reads her plan for the office’s year through GET /goals/:period?for=', async () => {
    const { calls } = show();
    await screen.findByRole('button', { name: 'Save goal' });

    const reads = calls.filter((c) => c.url.includes('/goals/'));
    expect(reads.map((c) => [c.init.method ?? 'GET', c.url])).toEqual([
      ['GET', 'http://api.test/api/v1/goals/2026?for=mem-rina'],
    ]);
    // The year is the person read's `today`, the office's calendar, which the shell already holds:
    // the roster is not read for it.
    expect(calls.some((c) => c.url.endsWith('/coaching/coachees'))).toBe(false);
  });

  it('P11-T7 review takes the year from the person read alone: the office’s today on New Year’s Eve', async () => {
    const { calls } = show({ body: goal({ period: '2025' }) }, LEADER, { ...RINA, today: '2025-12-31' });
    await screen.findByRole('button', { name: 'Save goal' });
    expect(calls.filter((c) => c.url.includes('/goals/')).map((c) => c.url)).toEqual(['http://api.test/api/v1/goals/2025?for=mem-rina']);
  });

  it('P11-T7 AC-5 is the /goals calculator in the coaching tool’s words, with her pronoun', async () => {
    show();

    expect(await screen.findByRole('heading', { name: /What's their APE target this year\?/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Current progress$/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /From APE to policy count/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Conversion assumptions/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Monthly activity target/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Commitment/ })).toBeInTheDocument();
    expect(screen.getByText(/— she will contact/)).toBeInTheDocument();
    expect(screen.queryByText(/My commitment|I will contact/)).not.toBeInTheDocument();
  });

  it('P11-T7 AC-5 carries the prototype’s footer, verbatim', async () => {
    show();
    expect(await screen.findByText(
      'Changes here update instantly in Personal Summary and Coaching Session — all three stay in sync.',
    )).toBeInTheDocument();
  });

  it('P11-T7 AC-5 saves her plan through PUT /goals/:period?for=, once, when Save is pressed', async () => {
    const { calls } = show([{ body: goal() }, { body: goal({ annualApeTargetMinor: 900_000_000_00 }) }]);
    const target = await screen.findByLabelText('Annual APE target');
    await userEvent.clear(target);
    await userEvent.type(target, '900000000');
    expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1));
    const put = calls.find((c) => c.init.method === 'PUT')!;
    expect(put.url).toBe('http://api.test/api/v1/goals/2026?for=mem-rina');
    expect(JSON.parse(String(put.init.body))).toMatchObject({ annualApeTargetMinor: 900_000_000_00 });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('P11-T7 AC-5 works on a read with no measured rates, and draws none (D-rates)', async () => {
    show();
    await screen.findByRole('button', { name: 'Save goal' });
    expect(screen.queryByText(/logged rate|measured/i)).not.toBeInTheDocument();
    // The same calculator as `/goals`, so the same screen: no 💡 tip since ADR-0160 §4 (P18.8-T10 AC-4).
    expect(screen.queryByText('Use your real conversion ratios for accuracy.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Appointment to Sales meeting')).toBeInTheDocument();
  });

  it('P11-T7 AC-5 never tells the leader a goal was set by somebody else: that banner is the coachee’s own', async () => {
    show();
    await screen.findByRole('button', { name: 'Save goal' });
    expect(screen.queryByText('Set by your leader')).not.toBeInTheDocument();
  });

  it('P11-T7 AC-5 names her own figure as hers, and an upload without ADR-0084’s six words', async () => {
    show();
    await screen.findByRole('button', { name: 'Save goal' });
    // ADR-0075 / ADR-0058 (exit review B2): a leader reads her production and never types it.
    expect(screen.getByText('APE already produced this year')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'APE already produced this year' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Her own figure, entered in Goal Settings' })).toBeInTheDocument();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show({ body: goal({ achieved: { minor: 120_000_000_00, provenance: 'corrected', month: '2026-08' } }) });
    expect(await screen.findByRole('button', { name: 'Corrected after the production upload, year to date as of Agu 2026' }))
      .toBeInTheDocument();
    expect(screen.getByRole('main').textContent).not.toMatch(SIX_WORDS);
  });

  it('P11-T7 AC-5 says she has passed her target, rather than printing zeroes (ADR-0047)', async () => {
    show({
      body: goal({
        projected: projection({
          targetMet: true, remainingApeMinor: 0, monthlyApeTargetMinor: 0, policiesPerMonth: 0, appointmentsPerMonth: 0, leadsPerMonth: 0,
        }),
      }),
    });
    expect(await screen.findByText('She has passed her annual target.')).toBeInTheDocument();
    expect(screen.getByText(/nothing left for this plan to ask of her\./)).toBeInTheDocument();
  });

  it('P11-T7 AC-11 keeps step 1’s savings copy as /goals has it', async () => {
    show();
    await userEvent.click(await screen.findByRole('tab', { name: 'Calculate from savings target' }));
    expect(screen.getByLabelText('Commission rate')).toHaveAccessibleDescription('% of APE that becomes income / savings');
    expect(screen.getByText('That is an APE target of')).toBeInTheDocument();
  });

  it('P11-T7 AC-5 uses none of ADR-0084’s six words', async () => {
    show();
    await screen.findByRole('button', { name: 'Save goal' });
    expect(screen.getByRole('main').textContent).not.toMatch(SIX_WORDS);
  });

  it('is refused, with no goal read, to a reader without goal:read', async () => {
    const { calls } = show({ body: goal() }, { ...LEADER, permissions: ['coaching_session:read'] });
    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'goal:read');
    expect(calls.some((c) => c.url.includes('/goals/'))).toBe(false);
  });
});
