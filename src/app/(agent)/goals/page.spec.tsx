import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import GoalSettingsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/goals',
}));

const AGENT = makeMe({ permissions: ['goal:read', 'goal:update'] });

const PERIOD = String(new Date().getFullYear());

const revision = (over: Record<string, unknown> = {}) => ({
  version: 1, at: '2026-01-13T04:00:00.000Z', byMembershipId: 'mem-1', byName: 'Rina Wijaya',
  mode: 'direct', annualApeTargetMinor: 300_000_000_00, savingsTargetMinor: 50_000_000_00,
  commissionRatePct: 10, monthsLeftOverride: null, apeAchievedMinor: 0,
  caseSizeMinor: 18_000_000_00, leadsToApptPct: 30, closingRatePct: 30,
  snapshot: {
    monthlyApeTargetMinor: 60_000_000_00,
    policiesPerMonth: 4, appointmentsPerMonth: 14, leadsPerMonth: 47,
  },
  ...over,
});

/** The prototype's defaults over five months: 6 policies, 20 appointments, 67 leads. */
const projection = (over: Record<string, unknown> = {}) => ({
  annualApeTargetMinor: 500_000_000_00,
  apeAchievedMinor: 0,
  remainingApeMinor: 500_000_000_00,
  monthlyApeTargetMinor: 100_000_000_00,
  policiesPerMonth: 6,
  policiesPerWeek: 2,
  appointmentsPerMonth: 20,
  appointmentsPerWeek: 5,
  leadsPerMonth: 67,
  leadsPerWeek: 16,
  targetMet: false,
  ...over,
});

const goal = (over: Record<string, unknown> = {}) => ({
  period: PERIOD,
  mode: 'direct',
  annualApeTargetMinor: 500_000_000_00,
  savingsTargetMinor: 50_000_000_00,
  commissionRatePct: 10,
  monthsLeft: 5,
  apeAchievedMinor: 0,
  caseSizeMinor: 18_000_000_00,
  leadsToApptPct: 30,
  closingRatePct: 30,
  snapshot: {
    monthlyApeTargetMinor: 100_000_000_00,
    policiesPerMonth: 6,
    appointmentsPerMonth: 20,
    leadsPerMonth: 67,
  },
  projected: projection(),
  cascadeMapping: {
    leadsCode: 'LEADS_CONTACTED',
    appointmentsCode: 'SELL_PRESENTATION',
    closingsCode: 'SELL_SUBMISSION',
  },
  monthsLeftIsOverride: false,
  savedAt: '2026-09-13T04:00:00.000Z',
  savedByMembershipId: 'mem-1',
  ...over,
});

const base = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
  // A reader who leads nobody. The picker only appears for somebody who does.
  '/members/my-team': { body: [] },
  // Keyed longer than `/goals`, so the stub matcher prefers it.
  '/goals/2026/history': { body: [] },
};

const teammate = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-rina', fullName: 'Rina Wijaya', initials: 'RW',
  agentCode: 'PRU-001', role: 'agent', directCount: 0, canChangeRole: false, ...over,
});

const render = (routes: Record<string, unknown>, me = AGENT) => {
  const stub = stubFetch({ ...base, ...routes } as Parameters<typeof stubFetch>[0]);
  renderInLayout(AgentLayout, <GoalSettingsPage />, { me });
  return stub;
};

describe('Goal settings (P8-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders five numbered cards and the commitment', async () => {
    render({ '/goals': { body: goal() } });

    expect(await screen.findByRole('heading', { name: /Annual APE target/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Current progress/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /From APE to policy count/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Conversion assumptions/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Monthly activity target/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /My commitment/ })).toBeInTheDocument();
  });

  describe('AC-2 — the server is the only source of the numbers', () => {
    it('renders the cascade it was given, not one it worked out', async () => {
      // The prototype's markup says 80 leads and its calculator says 67. The screen holds no
      // copy of the formula, so there is nothing here that could disagree with the server.
      render({ '/goals': { body: goal() } });

      expect(await screen.findByText('67')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('≈ 16/week')).toBeInTheDocument();
    });

    it('AC-2b: shows the recomputed figure, not the stored snapshot', async () => {
      /*
       * Moved here from P8-T1's AC-4. A plan agreed in January with five months left, read in
       * October with two, is a different monthly target — and the screen has to show the second
       * one or it is describing a year that no longer exists (client PRD §17).
       */
      render({
        '/goals': {
          body: goal({
            snapshot: {
              monthlyApeTargetMinor: 100_000_000_00,
              policiesPerMonth: 6, appointmentsPerMonth: 20, leadsPerMonth: 67,
            },
            projected: projection({
              monthlyApeTargetMinor: 250_000_000_00,
              policiesPerMonth: 14, appointmentsPerMonth: 47, leadsPerMonth: 157,
            }),
          }),
        },
      });

      expect(await screen.findByText('157')).toBeInTheDocument();
      expect(screen.queryByText('67')).not.toBeInTheDocument();
    });

    it('sends the six inputs and renders what comes back', async () => {
      const { calls } = render({
        '/goals': [
          { body: goal() },
          { body: goal({ caseSizeMinor: 9_000_000_00, projected: projection({ policiesPerMonth: 11 }) }) },
        ],
      });

      const caseSize = await screen.findByLabelText('Average case size (Rp)');
      await userEvent.clear(caseSize);
      await userEvent.type(caseSize, '9000000');
      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PUT').at(-1);
        expect(JSON.parse(String(sent?.init.body))).toMatchObject({ caseSizeMinor: 9_000_000_00 });
      });
      // The Closings column and the policies-per-month figure both read it back.
      expect((await screen.findAllByText('11')).length).toBeGreaterThan(0);
    });
  });

  describe('money is typed in rupiah and sent in sen', () => {
    it('shows 500,000,000 where the record holds 50,000,000,000', async () => {
      render({ '/goals': { body: goal() } });

      expect(await screen.findByLabelText('Annual APE target (Rp)')).toHaveValue(500_000_000);
      // Indonesian grouping, which the prototype's `toLocaleString('en-US')` gets wrong for its
      // own audience. It appears in the remaining-needed figure and in the commitment sentence.
      expect(screen.getAllByText('Rp 500.000.000').length).toBeGreaterThan(0);
    });

    it('converts on the way out, so nobody types twelve digits for a nine-digit figure', async () => {
      const { calls } = render({
        '/goals': [{ body: goal() }, { body: goal() }],
      });

      const target = await screen.findByLabelText('Annual APE target (Rp)');
      await userEvent.clear(target);
      await userEvent.type(target, '300000000');
      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PUT').at(-1);
        expect(JSON.parse(String(sent?.init.body)).annualApeTargetMinor).toBe(300_000_000_00);
      });
    });
  });

  describe('every field reaches the server', () => {
    it('sends all six inputs, including the ones the defaults already fill', async () => {
      /*
       * A field nobody types into is a field nobody has proved is wired. Each of these moves a
       * number the cascade divides by, so a control that silently does not reach the server would
       * show the agent a plan they did not set.
       */
      const { calls } = render({ '/goals': [{ body: goal() }, { body: goal() }] });

      const type = async (label: string, value: string) => {
        const field = await screen.findByLabelText(label);
        await userEvent.clear(field);
        await userEvent.type(field, value);
      };

      await type('Months left', '2.5');
      await type('APE produced so far (Rp)', '120000000');
      await type('Contacted leads that become an appointment (%)', '25');
      await type('Appointments that become a closing (%)', '40');
      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PUT').at(-1);
        expect(JSON.parse(String(sent?.init.body))).toMatchObject({
          monthsLeft: 2.5,
          apeAchievedMinor: 120_000_000_00,
          leadsToApptPct: 25,
          closingRatePct: 40,
        });
      });
    });
  });

  describe('the two entry modes', () => {
    it('offers the savings pair when that is how the agent thinks', async () => {
      render({ '/goals': { body: goal({ mode: 'from_savings' }) } });

      expect(await screen.findByLabelText('Annual savings target (Rp)')).toBeInTheDocument();
      expect(screen.getByLabelText('Commission rate (%)')).toBeInTheDocument();
      expect(screen.queryByLabelText('Annual APE target (Rp)')).not.toBeInTheDocument();
    });

    it('takes a decimal rate, which the prototype cannot (I-108)', async () => {
      const { calls } = render({
        '/goals': [{ body: goal({ mode: 'from_savings' }) }, { body: goal({ mode: 'from_savings' }) }],
      });

      const rate = await screen.findByLabelText('Commission rate (%)');
      await userEvent.clear(rate);
      await userEvent.type(rate, '12.5');
      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PUT').at(-1);
        expect(JSON.parse(String(sent?.init.body)).commissionRatePct).toBe(12.5);
      });
    });
  });

  describe('AC-6 and the states a plan can be in', () => {
    it('replaces the cascade with a sentence when the target is met (ADR-0047)', async () => {
      // Not *contact 0 leads*, printed to the best producer in the office.
      render({
        '/goals': {
          body: goal({
            projected: projection({
              targetMet: true, remainingApeMinor: 0, monthlyApeTargetMinor: 0,
              policiesPerMonth: 0, appointmentsPerMonth: 0, leadsPerMonth: 0,
            }),
          }),
        },
      });

      expect(await screen.findByText(/passed your annual target/)).toBeInTheDocument();
      expect(screen.queryByText('Leads contacted')).not.toBeInTheDocument();
    });

    it('says which numbers it cannot work from, rather than showing nothing', async () => {
      render({ '/goals': { body: goal({ projected: null }) } });

      expect(await screen.findByText(/cannot be worked out/)).toBeInTheDocument();
      expect(screen.getByText(/case size and the two/)).toBeInTheDocument();
    });

    it('shows the server’s refusal of an unusable assumption', async () => {
      render({
        '/goals': [
          { body: goal() },
          {
            status: 422,
            body: {
              error: {
                code: 'GOAL_INVALID_ASSUMPTION',
                message: 'Average case size must be above zero: it is what a policy is worth.',
                requestId: 'req-1',
              },
            },
          },
        ],
      });
      await screen.findByLabelText('Average case size (Rp)');

      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      expect(await screen.findByText(/case size must be above zero/)).toBeInTheDocument();
    });

    it('shows a skeleton while it loads, and an error instead of an empty form', async () => {
      render({
        '/goals': {
          status: 500,
          body: { error: { code: 'INTERNAL_ERROR', message: 'Nope.', requestId: 'r' } },
        },
      });

      expect(await screen.findByText('Nope.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save goal' })).not.toBeInTheDocument();
    });

    it('refuses the screen to somebody without goal:read', async () => {
      render({ '/goals': { body: goal() } }, makeMe({ permissions: [] }));

      expect(await screen.findByText(/needs the/)).toBeInTheDocument();
      expect(screen.getByText('goal:read')).toBeInTheDocument();
    });
  });

  describe('what the prototype gets wrong and this does not', () => {
    it('dates the commitment from the goal, not from a string typed into the markup', async () => {
      // The prototype's header reads "as of Aug 28, 2026" and JS never updates it.
      render({ '/goals': { body: goal({ savedAt: '2026-09-13T04:00:00.000Z' }) } });

      expect(await screen.findByText(/13 Sept 2026/)).toBeInTheDocument();
    });

    it('keeps the disclaimer the retired section files carried (L-29)', async () => {
      render({ '/goals': { body: goal() } });

      expect(await screen.findByText(/Estimates for personal planning/)).toBeInTheDocument();
    });

    it('says saved when it is saved, rather than on every recalculation', async () => {
      // The prototype marks the goal unsaved on page load and on any cross-tab read.
      render({ '/goals': { body: goal() } });
      // The loading skeleton is also a `status`, so wait for the form before asking.
      await screen.findByRole('button', { name: 'Save goal' });

      expect(screen.getByRole('status')).toHaveTextContent('Saved');
    });

    it('says not yet saved when there is no goal to have saved', async () => {
      render({ '/goals': { body: goal({ savedAt: null, savedByMembershipId: null }) } });
      await screen.findByRole('button', { name: 'Save goal' });

      expect(screen.getByRole('status')).toHaveTextContent('Not yet saved');
    });

    it('names the activity codes the cascade counts against, never #3 #4 #6', async () => {
      render({ '/goals': { body: goal() } });

      expect(await screen.findByText(/LEADS_CONTACTED/)).toBeInTheDocument();
      expect(screen.queryByText(/#3/)).not.toBeInTheDocument();
    });
  });

  describe('P8-T6 — what this plan has been', () => {
    const history = (entries: unknown[]) => ({ '/goals/2026/history': { body: entries } });

    it('says nothing when the plan has only ever been one thing', async () => {
      render({ '/goals': { body: goal() }, ...history([revision({ version: 1 })]) });
      await screen.findByRole('button', { name: 'Save goal' });

      expect(screen.queryByText('What this plan has been')).not.toBeInTheDocument();
    });

    it('AC-3: lists every version, newest first, with who agreed it', async () => {
      render({
        '/goals': { body: goal() },
        ...history([
          revision({ version: 2, annualApeTargetMinor: 500_000_000_00, byName: 'Ibu Sari' }),
          revision({ version: 1, annualApeTargetMinor: 300_000_000_00 }),
        ]),
      });

      expect(await screen.findByText('What this plan has been')).toBeInTheDocument();
      expect(screen.getByText('Now')).toBeInTheDocument();
      expect(screen.getByText('Version 1')).toBeInTheDocument();
      expect(screen.getByText(/Ibu Sari/)).toBeInTheDocument();
    });

    it('AC-3: says what changed, worked out from two whole states', async () => {
      render({
        '/goals': { body: goal() },
        ...history([
          revision({ version: 2, annualApeTargetMinor: 500_000_000_00, caseSizeMinor: 9_000_000_00 }),
          revision({ version: 1, annualApeTargetMinor: 300_000_000_00, caseSizeMinor: 18_000_000_00 }),
        ]),
      });

      // Scoped to the panel: the field's own label appears on its card as well, which is the
      // point — the history names a change in the words the card uses.
      const panel = within((await screen.findByText('What this plan has been')).closest('div')!);
      expect(panel.getByText('Annual APE target')).toBeInTheDocument();
      expect(panel.getByText(/Rp 300\.000\.000 →/)).toBeInTheDocument();
      expect(panel.getByText('Rp 500.000.000')).toBeInTheDocument();
      expect(panel.getByText('Average case size')).toBeInTheDocument();
    });

    it('calls the oldest one the first plan rather than saying nothing changed', async () => {
      render({
        '/goals': { body: goal() },
        ...history([revision({ version: 2 }), revision({ version: 1 })]),
      });

      expect(await screen.findByText('The first plan for this year.')).toBeInTheDocument();
    });

    it('renders the plan even when the history cannot be read', async () => {
      render({
        '/goals': { body: goal() },
        '/goals/2026/history': {
          status: 500,
          body: { error: { code: 'INTERNAL_ERROR', message: 'Nope.', requestId: 'r' } },
        },
      });

      expect(await screen.findByRole('button', { name: 'Save goal' })).toBeInTheDocument();
      expect(screen.queryByText('What this plan has been')).not.toBeInTheDocument();
    });
  });

  describe('P8-T5 — the divisor the office works out, and the one you choose', () => {
    it('sends null when the figure is the office’s, so nothing stale is stored', async () => {
      /*
       * The defect this closes: a plan saved in January with 11.9 months left, stored and served
       * back, still claimed 11.9 in October — and a monthly target a fifth of the truth
       * (client PRD §17).
       */
      const { calls } = render({
        '/goals': [{ body: goal({ monthsLeft: 3.1, monthsLeftIsOverride: false }) }, { body: goal() }],
      });
      await screen.findByLabelText('Months left');

      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PUT').at(-1);
        expect(JSON.parse(String(sent?.init.body)).monthsLeft).toBeNull();
      });
    });

    it('shows the figure in force even while it sends null', async () => {
      render({ '/goals': { body: goal({ monthsLeft: 3.1, monthsLeftIsOverride: false }) } });

      // Empty, with the office's figure as the placeholder: prefilling it meant clearing the box
      // refilled it, so typing over the number appended to it.
      const field = await screen.findByLabelText('Months left');
      expect(field).toHaveValue(null);
      expect(field).toHaveAttribute('placeholder', '3.1');
      expect(screen.getByText(/office’s calendar says 3.1/)).toBeInTheDocument();
    });

    it('sends the number once the agent types over it', async () => {
      const { calls } = render({
        '/goals': [{ body: goal({ monthsLeft: 3.1, monthsLeftIsOverride: false }) }, { body: goal() }],
      });

      await userEvent.type(await screen.findByLabelText('Months left'), '2');
      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PUT').at(-1);
        expect(JSON.parse(String(sent?.init.body)).monthsLeft).toBe(2);
      });
    });

    it('says whose figure it is, and how to go back to the office’s', async () => {
      render({ '/goals': { body: goal({ monthsLeft: 2, monthsLeftIsOverride: true }) } });

      expect(await screen.findByText(/Your own figure/)).toBeInTheDocument();
      expect(screen.getByText(/Empty the box/)).toBeInTheDocument();
    });

    it('goes back to the office’s calendar when the box is cleared', async () => {
      const { calls } = render({
        '/goals': [{ body: goal({ monthsLeft: 2, monthsLeftIsOverride: true }) }, { body: goal() }],
      });

      await userEvent.clear(await screen.findByLabelText('Months left'));
      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PUT').at(-1);
        expect(JSON.parse(String(sent?.init.body)).monthsLeft).toBeNull();
      });
    });
  });

  describe('P8-T4 — setting somebody else’s plan', () => {
    it('offers no picker to somebody who leads nobody', async () => {
      render({ '/goals': { body: goal() } });
      await screen.findByRole('button', { name: 'Save goal' });

      expect(screen.queryByLabelText('Whose plan')).not.toBeInTheDocument();
    });

    it('offers the people you lead, and opens on your own', async () => {
      render({ '/goals': { body: goal() }, '/members/my-team': { body: [teammate()] } });

      const picker = await screen.findByLabelText('Whose plan');
      expect(picker).toHaveValue('');
      expect(screen.getByRole('option', { name: 'Rina Wijaya' })).toBeInTheDocument();
    });

    it('reads their plan when you pick them', async () => {
      const { calls } = render({
        '/goals': { body: goal() },
        '/members/my-team': { body: [teammate()] },
      });

      await userEvent.selectOptions(await screen.findByLabelText('Whose plan'), 'mem-rina');

      await waitFor(() => {
        expect(calls.some((c) => c.url.includes('for=mem-rina') && (c.init.method ?? 'GET') === 'GET'))
          .toBe(true);
      });
      expect(screen.getByText(/becomes their goal as soon as you save/)).toBeInTheDocument();
      // Named in the banner as well as in the option, so the reader is never guessing whose
      // numbers are on screen.
      expect(screen.getAllByText('Rina Wijaya').length).toBeGreaterThan(1);
    });

    it('says what saving somebody else’s does, before it is saved', async () => {
      // There is no acceptance step (ADR-0046), so the screen owes them the consequence up front.
      render({ '/goals': { body: goal() }, '/members/my-team': { body: [teammate()] } });
      await userEvent.selectOptions(await screen.findByLabelText('Whose plan'), 'mem-rina');

      expect(screen.getByText(/becomes their goal as soon as you save/)).toBeInTheDocument();
      expect(screen.getByText(/they will be told/)).toBeInTheDocument();
    });

    it('AC-4: writes nothing until Save is pressed', async () => {
      /*
       * The prototype writes into shared state on **every input event**, so a leader who opened
       * somebody's plan and typed a digit had already changed it. This is the divergence.
       */
      const { calls } = render({
        '/goals': { body: goal() },
        '/members/my-team': { body: [teammate()] },
      });
      await userEvent.selectOptions(await screen.findByLabelText('Whose plan'), 'mem-rina');

      const target = screen.getByLabelText('Annual APE target (Rp)');
      await userEvent.clear(target);
      await userEvent.type(target, '900000000');

      expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(0);
    });

    it('sends their membership on save', async () => {
      const { calls } = render({
        '/goals': [{ body: goal() }, { body: goal() }, { body: goal() }],
        '/members/my-team': { body: [teammate()] },
      });
      await userEvent.selectOptions(await screen.findByLabelText('Whose plan'), 'mem-rina');

      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PUT').at(-1);
        expect(sent?.url).toContain('for=mem-rina');
      });
    });

    it('does not tell a leader their own goal was set by somebody else', async () => {
      // The *Set by your leader* banner is for the agent reading their own plan. On somebody
      // else's it would be describing the reader to themselves.
      render({
        '/goals': { body: goal({ savedByMembershipId: 'mem-leader' }) },
        '/members/my-team': { body: [teammate()] },
      });
      await userEvent.selectOptions(await screen.findByLabelText('Whose plan'), 'mem-rina');

      expect(screen.queryByText('Set by your leader')).not.toBeInTheDocument();
    });
  });

  describe('a goal somebody else set (ADR-0046)', () => {
    it('names the leader who set it, on the agent’s own screen', async () => {
      render({ '/goals': { body: goal({ savedByMembershipId: 'mem-leader' }) } });

      expect(await screen.findByText('Set by your leader')).toBeInTheDocument();
      expect(screen.getByText(/it is your plan/)).toBeInTheDocument();
    });

    it('says nothing when the agent set it themselves', async () => {
      render({ '/goals': { body: goal({ savedByMembershipId: 'mem-1' }) } });
      await screen.findByRole('heading', { name: /My commitment/ });

      expect(screen.queryByText('Set by your leader')).not.toBeInTheDocument();
    });
  });
});
