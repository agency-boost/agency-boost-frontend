import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { ACTION_BAR_PHONE, SEGMENT_WRAP_PHONE } from '@/components/ui/phone';
import { InLanguage, makeMe, renderInLayout, renderWithSession, stubFetch } from '@test/harness';
import GoalSettingsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/goals',
}));

const AGENT = makeMe({ permissions: ['goal:read', 'goal:update'] });

const PERIOD = String(new Date().getFullYear());

/**
 * The prototype's defaults over five months: 6 policies, 20 appointments, 67 leads — policies per week to one
 * decimal since ADR-0160 §5, as the server answers it.
 */
const projection = (over: Record<string, unknown> = {}) => ({
  annualApeTargetMinor: 500_000_000_00,
  apeAchievedMinor: 0,
  remainingApeMinor: 500_000_000_00,
  monthlyApeTargetMinor: 100_000_000_00,
  policiesPerMonth: 6,
  policiesPerWeek: 1.4,
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
  // No production held yet: the plan is measured against the agent's own figure (P9-T6).
  achieved: { minor: (over.apeAchievedMinor as number | undefined) ?? 0, provenance: 'self_reported', month: null },
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
  cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
  measured: { from: '2026-08-15', to: '2026-09-13', days: 30, leadToAppointmentRate: 0.25, closingRate: null },
  monthsLeftIsOverride: false,
  savedAt: '2026-09-13T04:00:00.000Z',
  savedByMembershipId: 'mem-1',
  ...over,
});

/** An activity type as the published configuration carries it; only its code, label and number matter here. */
const type = (code: string, categoryCode: string, label: string, displayOrder: number, over: Record<string, unknown> = {}) => ({
  id: `t-${code}`, code, categoryCode, label, description: null, appliesToOrgLevelCodes: [], displayOrder, version: 1,
  status: 'active', ...over,
});
const category = (code: string, label: string, displayOrder: number, types: unknown[]) => ({
  id: `c-${code}`, code, label, description: null, appliesToOrgLevelCodes: [], displayOrder, version: 1, status: 'active', types,
});
/** The seed's numbering: the cascade's three types are the prototype's #3, #4 and #6 (`Overall.html:3021`, `:3038`, `:3055`). */
const SEED_ACTIVITY = [
  category('LEADS_GENERATION', 'Leads Generation', 1, [
    type('LEADS_CONTACTED', 'LEADS_GENERATION', 'Set Appointment', 3),
  ]),
  category('SELLING', 'Selling', 2, [
    type('SELL_PRESENTATION', 'SELLING', 'Melakukan presentasi penjualan untuk calon atau existing nasabah', 4),
    type('SELL_FOLLOWUP', 'SELLING', 'Melakukan diskusi follow up dari presentasi penjualan sebelumnya', 5),
    type('SELL_SUBMISSION', 'SELLING', 'Submission polis', 6),
  ]),
];
const config = (activity: unknown[]) => ({ '/kpm/config': { body: { activity, ratios: [], leadPipelines: [], version: 1 } } });

const base = {
  ...config(SEED_ACTIVITY),
  '/kpm/org-levels': { body: [] },
};

/**
 * The chip over the cascade panel a stage label heads — the activities it counts (P18.95-T5 AC-5) — or `null` for a
 * panel with none.
 */
const chipOver = (label: string) => {
  const panel = [...document.querySelectorAll('[class*="text-center"]')]
    .find((p) => p.textContent?.includes('/month') && p.textContent.startsWith(label));
  if (!panel) throw new Error(`No cascade panel headed ${label}`);
  return panel.querySelector('[data-tone="navy"]')?.textContent ?? null;
};

const render = (routes: Record<string, unknown>, me = AGENT) => {
  const stub = stubFetch({ ...base, ...routes } as Parameters<typeof stubFetch>[0]);
  renderInLayout(AgentLayout, <GoalSettingsPage />, { me });
  return stub;
};

describe('Goal Settings (P8-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders five numbered cards and the commitment', async () => {
    render({ '/goals': { body: goal() } });

    expect(await screen.findByRole('heading', { name: /APE target this year/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Your current progress/ })).toBeInTheDocument();
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

      expect(await screen.findByText('67/month')).toBeInTheDocument();
      expect(screen.getByText('20/month')).toBeInTheDocument();
      expect(screen.getByText('≈ 16/week')).toBeInTheDocument();
    });

    it('P18.8-T10 AC-2 writes policies per week to one decimal, on step 3 and step 5 alike', async () => {
      render({ '/goals': { body: goal() } });

      // The server's 1.4, with a decimal point — not *≈ 2*.
      const tile = (await screen.findByText('Policies per week')).closest('[data-variant]')!;
      expect(tile).toHaveTextContent('≈ 1.4');
      const hero = document.querySelector('[data-hero="true"]')!;
      expect(hero).toHaveTextContent('6/month');
      expect(hero).toHaveTextContent('≈ 1.4/week');
      // The two counts to do stay whole.
      expect(screen.getByText('≈ 5/week')).toBeInTheDocument();
    });

    it('P18.8-T10 AC-2 writes a whole policies-per-week figure whole', async () => {
      render({ '/goals': { body: goal({ projected: projection({ policiesPerMonth: 13, policiesPerWeek: 3 }) }) } });

      const tile = (await screen.findByText('Policies per week')).closest('[data-variant]')!;
      expect(tile).toHaveTextContent('≈ 3');
      expect(tile).not.toHaveTextContent('3.0');
      expect(screen.getByText('≈ 3/week')).toBeInTheDocument();
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

      expect(await screen.findByText('157/month')).toBeInTheDocument();
      expect(screen.queryByText('67/month')).not.toBeInTheDocument();
    });

    it('sends the six inputs and renders what comes back', async () => {
      const { calls } = render({
        '/goals': [
          { body: goal() },
          { body: goal({ caseSizeMinor: 9_000_000_00, projected: projection({ policiesPerMonth: 11 }) }) },
        ],
      });

      const caseSize = await screen.findByLabelText('Average case size (APE per policy)');
      await userEvent.clear(caseSize);
      await userEvent.type(caseSize, '9000000');
      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PUT').at(-1);
        expect(JSON.parse(String(sent?.init.body))).toMatchObject({ caseSizeMinor: 9_000_000_00 });
      });
      // The Submission polis column and the policies-per-month figure both read it back.
      expect(await screen.findByText('11/month')).toBeInTheDocument();
    });
  });

  describe('money is typed in rupiah and sent in sen', () => {
    it('shows 500,000,000 where the record holds 50,000,000,000', async () => {
      render({ '/goals': { body: goal() } });

      // Grouped in the box as well as beside it: nine digits in a row is a figure you have to
      // count rather than read, and a number input cannot carry a separator at all.
      expect(await screen.findByLabelText('Annual APE target')).toHaveValue('500,000,000');
      // Beside the box the figure is compact (ADR-0167 §1): the remaining-needed tile and the commitment
      // sentence say *IDR 500M* (*Rp 500 jt* in Indonesian); the box itself keeps every digit.
      expect(screen.getAllByText('IDR 500M').length).toBeGreaterThan(0);
    });

    it('converts on the way out, so nobody types twelve digits for a nine-digit figure', async () => {
      const { calls } = render({
        '/goals': [{ body: goal() }, { body: goal() }],
      });

      const target = await screen.findByLabelText('Annual APE target');
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

      const type = async (label: string | RegExp, value: string) => {
        const field = await screen.findByLabelText(label);
        await userEvent.clear(field);
        await userEvent.type(field, value);
      };

      await type(/Months left this year/, '2.5');
      await type('APE already produced this year', '120000000');
      await type('Appointment to Sales meeting', '25');
      await type('Closing rate', '40');
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

    it('P18.95-T1 AC-3 takes a decimal typed with a comma, as every figure beside it is written', async () => {
      const { calls } = render({ '/goals': [{ body: goal() }, { body: goal() }] });
      const type = async (label: string | RegExp, value: string) => {
        const field = await screen.findByLabelText(label);
        await userEvent.clear(field);
        await userEvent.type(field, value);
      };

      await type(/Months left this year/, '2,5');
      await type('Appointment to Sales meeting', '27,5');
      await type('Closing rate', '33.5');
      // What was typed stays as typed: the comma is not taken out under the reader's cursor.
      expect(screen.getByLabelText(/Months left this year/)).toHaveValue('2,5');
      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PUT').at(-1);
        expect(JSON.parse(String(sent?.init.body))).toMatchObject({ monthsLeft: 2.5, leadsToApptPct: 27.5, closingRatePct: 33.5 });
      });
    });
  });

  describe('the two entry modes', () => {
    it('offers the savings pair when that is how the agent thinks', async () => {
      render({ '/goals': { body: goal({ mode: 'from_savings' }) } });

      expect(await screen.findByLabelText('Annual savings target')).toBeInTheDocument();
      expect(screen.getByLabelText('Commission rate')).toBeInTheDocument();
      expect(screen.queryByLabelText('Annual APE target')).not.toBeInTheDocument();
    });

    it('takes a decimal rate, which the prototype cannot (I-108)', async () => {
      const { calls } = render({
        '/goals': [{ body: goal({ mode: 'from_savings' }) }, { body: goal({ mode: 'from_savings' }) }],
      });

      const rate = await screen.findByLabelText('Commission rate');
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
      expect(screen.queryByText('Set appointment')).not.toBeInTheDocument();
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
      await screen.findByLabelText('Average case size (APE per policy)');

      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      expect(await screen.findByText(/case size must be above zero/)).toBeInTheDocument();
    });

    it('P18.95-T1 AC-6: a save that lands says Goal saved ✓, and keeps Saved beside the button', async () => {
      render({ '/goals': [{ body: goal({ savedAt: null, savedByMembershipId: null }) }, { body: goal() }] });
      await screen.findByRole('button', { name: 'Save goal' });
      expect(screen.queryByText('Goal saved ✓')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      const toast = await screen.findByText('Goal saved ✓');
      expect(toast.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
      const header = screen.getByRole('button', { name: 'Save goal' }).parentElement!;
      expect(within(header).getByRole('status')).toHaveTextContent('Saved');
    });

    it('P18.95-T1 AC-6: a refused save toasts nothing; its reason stays where it is shown', async () => {
      render({
        '/goals': [
          { body: goal() },
          { status: 422, body: { error: { code: 'GOAL_INVALID_ASSUMPTION', message: 'Average case size must be above zero.', requestId: 'r' } } },
        ],
      });
      await screen.findByRole('button', { name: 'Save goal' });

      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      expect(await screen.findByText('Average case size must be above zero.')).toBeInTheDocument();
      expect(screen.queryByText('Goal saved ✓')).not.toBeInTheDocument();
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

      expect(await screen.findByRole('alert')).toHaveTextContent('Not available to you');
      // The gate's code is on the refusal as data, and never in its words (P11-T6).
      expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'goal:read');
      expect(screen.queryByText('goal:read')).not.toBeInTheDocument();
    });
  });

  describe('what the prototype gets wrong and this does not', () => {
    it('dates the commitment from the goal, not from a string typed into the markup', async () => {
      // The prototype's header reads "as of 28 Agu 2026" and JS never updates it.
      render({ '/goals': { body: goal({ savedAt: '2026-09-13T04:00:00.000Z' }) } });

      expect(await screen.findByText(/13 Sep 2026/)).toBeInTheDocument();
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
      await screen.findByLabelText(/Months left this year/);

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
      const field = await screen.findByLabelText(/Months left this year/);
      // A text box with a decimal keypad, so a comma can be typed (ADR-0167 §1): empty is `''`.
      expect(field).toHaveValue('');
      expect(field).toHaveAttribute('placeholder', '3.1');
    });

    it('sends the number once the agent types over it', async () => {
      const { calls } = render({
        '/goals': [{ body: goal({ monthsLeft: 3.1, monthsLeftIsOverride: false }) }, { body: goal() }],
      });

      await userEvent.type(await screen.findByLabelText(/Months left this year/), '2');
      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PUT').at(-1);
        expect(JSON.parse(String(sent?.init.body)).monthsLeft).toBe(2);
      });
    });

    it('goes back to the office’s calendar when the box is cleared', async () => {
      const { calls } = render({
        '/goals': [{ body: goal({ monthsLeft: 2, monthsLeftIsOverride: true }) }, { body: goal() }],
      });

      await userEvent.clear(await screen.findByLabelText(/Months left this year/));
      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PUT').at(-1);
        expect(JSON.parse(String(sent?.init.body)).monthsLeft).toBeNull();
      });
    });
  });

  /*
   * *P8-T4 — setting somebody else’s plan* tested the *Whose plan* picker (L-30): its seven specs
   * went with it in P11-T7 (AC-6, D-picker). A leader sets a coachee's plan on that person's *Goal
   * Setting* tab, whose spec is `coaching/[membershipId]/goal-setting/page.spec.tsx`.
   */
  describe('P11-T7 AC-6 — the reader’s own plan, and nobody else’s', () => {
    it('P11-T7 AC-6 offers no Whose plan picker, even to somebody who leads people, and reads no team', async () => {
      const leader = makeMe({
        permissions: ['goal:read', 'goal:update'],
        membership: {
          membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
          isKpmOwner: false, isKpmAdmin: false, directCount: 3,
        },
      });
      const { calls } = render({ '/goals': { body: goal() } }, leader);
      await screen.findByRole('button', { name: 'Save goal' });

      expect(screen.queryByLabelText('Whose plan')).not.toBeInTheDocument();
      expect(screen.queryByText(/You are setting/)).not.toBeInTheDocument();
      expect(calls.some((c) => c.url.includes('/members/my-team'))).toBe(false);
      // Every read and the save are the reader's own: no `for=`.
      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));
      await waitFor(() => expect(calls.some((c) => c.init.method === 'PUT')).toBe(true));
      expect(calls.filter((c) => c.url.includes('/goals/')).every((c) => !c.url.includes('for='))).toBe(true);
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
  describe('the prototype’s own shape (third UI pass)', () => {
    it('offers both entry modes as visible segments, not behind a dropdown', async () => {
      render({ '/goals': { body: goal() } });

      await screen.findByRole('tab', { name: 'Set APE target directly' });
      expect(screen.getByRole('tab', { name: 'Calculate from savings target' })).toBeInTheDocument();
      // A dropdown hid the second mode from an agent who thinks in take-home pay.
      expect(screen.queryByRole('combobox', { name: /how you want/i })).not.toBeInTheDocument();
    });

    it('swaps the panel when the other mode is chosen', async () => {
      render({ '/goals': { body: goal() } });

      await userEvent.click(await screen.findByRole('tab', { name: 'Calculate from savings target' }));
      expect(screen.getByLabelText('Annual savings target')).toBeInTheDocument();
      expect(screen.queryByLabelText('Annual APE target')).not.toBeInTheDocument();
    });

    it('puts the unit inside the box rather than in the question', async () => {
      render({ '/goals': { body: goal() } });

      await screen.findByLabelText('Annual APE target');
      // Visible, and out of the accessible name — the label is the question. The language's mark: *IDR* in English,
      // *Rp* in Indonesian (P18.98-T3 AC-3).
      const prefix = screen.getAllByText('IDR').find((el) => el.getAttribute('aria-hidden') === 'true');
      expect(prefix).toBeDefined();
      expect(screen.getByText('months')).toHaveAttribute('aria-hidden', 'true');
    });

    it('says the months figure is automatic, and stops saying so once it is overridden', async () => {
      render({ '/goals': { body: goal() } });

      expect(await screen.findByText('auto')).toBeInTheDocument();
      await userEvent.type(await screen.findByLabelText(/Months left this year/), '3');
      expect(screen.queryByText('auto')).not.toBeInTheDocument();
    });

    it('marks this month’s target as the number the card is for', async () => {
      render({ '/goals': { body: goal() } });

      await screen.findByText("This month's APE target");
      const tile = screen.getByText("This month's APE target").closest('[data-variant]')!;
      expect(tile).toHaveAttribute('data-variant', 'insight');
      // The remainder beside it is plain; the *Already produced* echo of the field went (P18.95-T5 AC-5).
      expect(screen.getByText('Remaining needed').closest('[data-variant]'))
        .toHaveAttribute('data-variant', 'plain');
      expect(document.querySelectorAll('[data-variant]').length).toBeGreaterThan(2);
    });

    it('draws the cascade as a cascade — chips, hero and the rate between steps', async () => {
      render({ '/goals': { body: goal() } });

      await screen.findByText('Set appointment');
      // Each column names the activity it counts against, by its name on the log (P18.95-T5 AC-5) — where it was
      // *Activity #4* (P10.1-T6 AC-11); a name that only repeats its column's label is not printed twice.
      expect(await screen.findByText('Melakukan presentasi penjualan untuk calon atau existing nasabah')).toBeInTheDocument();
      expect(screen.queryByText(/^Activity #/)).not.toBeInTheDocument();
      // The submissions column is the hero.
      expect(document.querySelector('[data-hero="true"]')).toHaveTextContent('Submission polis');
      // And the arrow's percentage is spelled out, because the glyph is decorative.
      // The plan's own rate, as its field holds it (P18.97-T3 AC-2): an input's echo keeps its places, and no ,0.
      expect(screen.getByText('30% from set appointment to sales meeting')).toBeInTheDocument();
    });

    it('P18.8-T10 AC-3 names the cascade in the client’s words, each month above its week', async () => {
      render({ '/goals': { body: goal() } });

      await screen.findByText('Set appointment');
      expect(screen.getByText('Sales meeting')).toBeInTheDocument();
      expect(screen.getByLabelText('Appointment to Sales meeting')).toHaveValue('30');
      for (const old of ['Leads contacted', 'Appointments', 'Closings', 'Leads to Appointment']) {
        expect(screen.queryByText(old)).not.toBeInTheDocument();
      }
      // *n/month* above *≈ n/week*, in each of the three panels.
      const panels = [...document.querySelectorAll('[class*="text-center"]')].filter((p) => p.textContent?.includes('/month'));
      expect(panels.map((p) => p.textContent)).toEqual([
        expect.stringMatching(/Set appointment.*67\/month≈ 16\/week$/),
        expect.stringMatching(/Sales meeting.*20\/month≈ 5\/week$/),
        expect.stringMatching(/Submission polis.*6\/month≈ 1\.4\/week$/),
      ]);
    });

    it('inverts the commitment, and paints its figures amber', async () => {
      render({ '/goals': { body: goal() } });

      const heading = await screen.findByRole('heading', { name: /My commitment/ });
      expect(heading.parentElement!.className).toContain('bg-navy');
      // Every figure in the sentence is emphasised in amber — on navy, which is 6.3:1.
      const figure = screen.getByText('67 leads');
      expect(figure.tagName).toBe('STRONG');
      expect(figure.className).toContain('text-amber');
    });

    it('puts the save status beside the button, and has only one live region', async () => {
      render({ '/goals': { body: goal() } });

      // Wait for the plan: the loading skeleton is itself a live region, and the two never coexist —
      // which is why a screen gets exactly one `role="status"` and this query would otherwise read it.
      await screen.findByRole('heading', { name: /APE target this year/ });

      // A stored plan says so, with a green dot.
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Saved');
      expect(status.className).toContain('text-success');

      // Same header as the Save button, rather than 500px below it.
      const header = screen.getByRole('button', { name: 'Save goal' }).parentElement!;
      expect(header).toContainElement(status);
    });

    it('stops claiming to be saved the moment a number is changed', async () => {
      // The dot stayed green while the agent typed a new target, so the screen said *Saved* about
      // numbers nobody had saved. `refreshSaveStatus()` in the prototype reports from a dirty flag.
      render({ '/goals': { body: goal() } });
      await screen.findByRole('heading', { name: /APE target this year/ });
      expect(screen.getByRole('status')).toHaveTextContent('Saved');

      await userEvent.type(screen.getByLabelText('Annual APE target'), '1');
      expect(screen.getByRole('status')).toHaveTextContent('Not yet saved');
      expect(screen.getByRole('status').className).not.toContain('text-success');
    });

    it('groups a figure as it is typed, and sends the digits', async () => {
      const { calls } = render({ '/goals': [{ body: goal() }, { body: goal() }] });

      const field = await screen.findByLabelText('Annual APE target');
      await userEvent.clear(field);
      await userEvent.type(field, '750000000');
      expect(field).toHaveValue('750,000,000');

      await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));
      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PUT').at(-1);
        // Separators out, sen in: 750,000,000 rupiah is 75,000,000,000 sen.
        expect(JSON.parse(String(sent?.init.body))).toMatchObject({
          annualApeTargetMinor: 75_000_000_000,
        });
      });
    });

    it('leaves the unit in the affix rather than inside the value', async () => {
      // `Rp` is the field's prefix. Putting it in the value too would print it twice in one box.
      render({ '/goals': { body: goal() } });
      expect(await screen.findByLabelText('Annual APE target')).not.toHaveValue('IDR 500,000,000');
    });

    it('pads a field whose affix is on the other side', async () => {
      // `30 %` and `3.2 months` had the number hard against the left border: the affix supplies the
      // gap on its own side only.
      render({ '/goals': { body: goal() } });
      const pct = await screen.findByLabelText('Appointment to Sales meeting');
      expect(pct.className).toContain('pl-3');
      // And the side that does have one is not padded twice.
      expect(screen.getByLabelText('Annual APE target').className).not.toContain('pl-3');
    });

    it('holds every card on the screen to one width and one padding', async () => {
      // The banners were outside the measure at `p-6`, so the first card a reader saw was wider and
      // more thickly padded than the plan underneath. (It pinned the *Whose plan* picker's card until
      // the picker went in P11-T7, AC-6; the banner that stays is held to the same.)
      render({ '/goals': { body: goal({ savedByMembershipId: 'mem-leader' }) } });

      const picker = (await screen.findByText('Set by your leader')).closest('.rounded-lg')!;
      const step = screen.getByRole('heading', { name: /APE target this year/ }).closest('.rounded-lg')!;
      // One padding utility each, and the same one — not `p-6` plus an override whose winner depends
      // on the order Tailwind emits them in.
      expect(picker.className).toContain('px-5');
      expect(picker.className).not.toContain('p-6');
      expect(step.className).toContain('px-5');
      expect(step.className).not.toContain('p-6');
      // Same parent, so the same measure applies to both.
      expect(picker.parentElement).toBe(step.parentElement);
    });

    it('holds the plan to a readable measure', async () => {
      render({ '/goals': { body: goal() } });

      await screen.findByText('Set appointment');
      // 820px, as `.content` has it — five cards across a 1,600px window put a label a hand's
      // width from its input.
      expect(document.querySelector('[class*="max-w-"]')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /APE target this year/ }).closest('.mx-auto'))
        .toBeInTheDocument();
    });
  });
});

// ── P9-T6: the figure the plan is measured against, and whose it is ─────────────────────────

describe('Goal settings — the APE already produced, once the office holds production (P9-T6)', () => {
  const imported = (over: Record<string, unknown> = {}) => goal({
    apeAchievedMinor: 50_000_000_00,
    achieved: { minor: 120_000_000_00, provenance: 'imported', month: '2026-08' },
    projected: projection({ apeAchievedMinor: 120_000_000_00, remainingApeMinor: 380_000_000_00 }),
    ...over,
  });

  it('shows the carrier’s figure in place of the box, read-only, with its marker and no sentence', async () => {
    render({ '/goals': { body: imported() } });

    const shown = (await screen.findByText('APE already produced this year')).closest('dl')!;
    // The label, its marker (on the field since P18.95-T5 AC-5), and the figure.
    expect(shown).toHaveTextContent(/^APE already produced this year.*IDR 120,000,000$/);
    // The reason sentence went in P10.1-T6: whose figure it is, is the marker's to say.
    expect(shown.querySelectorAll('dd')).toHaveLength(1);
    expect(screen.queryByText(/typed on this plan is kept/)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'APE already produced this year' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'As of Aug 2026' })).toBeInTheDocument();
  });

  it('keeps the marker, on the field, when the plan cannot be worked out and there is no tile to carry it', async () => {
    render({ '/goals': { body: imported({ projected: null }) } });
    await screen.findByText(/cannot be worked out/);

    const marker = screen.getByRole('button', { name: 'As of Aug 2026' });
    expect(marker.closest('dl')).toHaveTextContent('APE already produced this year');
    // Once: the tile it would otherwise sit on is not drawn.
    expect(screen.getAllByRole('button', { name: /^As of Aug 2026$/ })).toHaveLength(1);
  });

  /* **Was** *marks the figure once, on the tile*: the *Already produced* tile carried it, and went (P18.95-T5 AC-5). */
  it('P18.95-T5 AC-5: marks the figure once, on the field — the one place it is shown — when the plan is worked out', async () => {
    render({ '/goals': { body: imported() } });
    await screen.findByText('APE already produced this year');
    expect(screen.getAllByRole('button', { name: /^As of Aug 2026$/ })).toHaveLength(1);
    expect(screen.getByText('APE already produced this year').closest('dl')!.querySelector('button')).not.toBeNull();
  });

  it('P18.95-T5 AC-5: shows the produced figure once — no Already produced tile repeating the field', async () => {
    render({ '/goals': { body: imported() } });
    await screen.findByText('Remaining needed');
    expect(screen.queryByText('Already produced')).not.toBeInTheDocument();
    // IDR 120,000,000 in the field, and nowhere else: not again as *IDR 120M* in a tile beneath it (the specs read
    // English, P18.98-T3: *Rp 120.000.000* and *Rp 120 jt* in Indonesian).
    expect(screen.getAllByText(/^IDR 120(,000,000|M)$/)).toHaveLength(1);
    expect(screen.getByText('Remaining needed').closest('[data-variant]')).toHaveTextContent('IDR 380M');
  });

  it('P18.97-T3 AC-3: keeps the figure that stands in a field in full, and writes every other sum compact', async () => {
    // An input and what it echoes is where precision matters (ADR-0174 §4): the read-only *APE already produced this
    // year* stands in the box, so it reads to the rupiah; the tile beside the plan is a summary, so it is short.
    render({ '/goals': { body: imported() } });
    await screen.findByText('Remaining needed');
    expect(screen.getByText('IDR 120,000,000')).toBeInTheDocument();
    expect(screen.getByText('Remaining needed').closest('[data-variant]')).toHaveTextContent('IDR 380M');
    expect(screen.getByText('Remaining needed').closest('[data-variant]')).not.toHaveTextContent('IDR 380,000,000');
  });

  it('says so when the office corrected it by hand', async () => {
    render({ '/goals': { body: imported({ achieved: { minor: 120_000_000_00, provenance: 'corrected', month: '2026-08' } }) } });
    await screen.findByText('APE already produced this year');
    expect(screen.getByRole('button', { name: 'Corrected by hand, year to date as of Aug 2026' })).toBeInTheDocument();
  });

  it('keeps the typed figure on save, untouched — it is the agent’s own', async () => {
    const { calls } = render({ '/goals': [{ body: imported() }, { body: imported() }] });
    await screen.findByText('APE already produced this year');
    await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PUT')).toBe(true));
    const sent = JSON.parse(calls.find((c) => c.init.method === 'PUT')!.init.body as string);
    expect(sent.apeAchievedMinor).toBe(50_000_000_00);
  });

  /*
   * **Was** *… and marks it as theirs*: the *Already produced* tile beneath the box said *Your own figure, entered in
   * Goal Settings*. The tile went (P18.95-T5 AC-5), and the box the agent types into needs no marker to say so.
   */
  it('leaves the box for the agent’s own figure until production arrives, with no tile repeating it', async () => {
    render({ '/goals': { body: goal() } });
    const box = await screen.findByRole('textbox', { name: 'APE already produced this year' });
    expect(box).not.toHaveAccessibleDescription();
    expect(screen.queryByText('Already produced')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Your own figure, entered in Goal Settings' })).not.toBeInTheDocument();
  });

  it('sits beside the months as a field and takes the rest of the row, as the prototype’s does (P10.1-T8)', async () => {
    // The client, 2026-10-01: the office's figure looked lopsided beside the months box.
    render({ '/goals': { body: imported() } });
    const label = await screen.findByText('APE already produced this year');
    const field = label.closest('dl')!;
    const months = screen.getByText(/Months left this year/).closest('label')!;

    // One row, the two labels on its label line: the office's figure is not a box with its label inside.
    expect(field.parentElement).toBe(months.parentElement!.parentElement);
    expect(field).toHaveClass('grow', 'basis-56');
    expect(field).not.toHaveClass('p-3');
    expect(within(field).getByText('IDR 120,000,000')).toHaveClass('h-10');
    // The auto badge gives back its padding, so the months label is no taller than this one.
    expect(within(months).getByText('auto')).toHaveClass('-my-0.5');
  });

  it('gives the agent’s own box the rest of the row too', async () => {
    render({ '/goals': { body: goal() } });
    const box = await screen.findByRole('textbox', { name: 'APE already produced this year' });
    expect(box.closest('.flex-col')).toHaveClass('grow', 'basis-56');
  });
});


// ── P10.1-T6: the prototype's screen, and what a requirement keeps beside it (ADR-0063) ──────────

describe('Goal Settings, trimmed to the prototype (P10.1-T6)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-7: the prototype’s title and subtitle, loading and loaded', async () => {
    render({ '/goals': { body: goal() } });

    expect(screen.getByRole('heading', { level: 1, name: 'Goal Settings' })).toBeInTheDocument();
    expect(screen.getByText('Turn your annual target into this month\'s activity numbers.')).toBeInTheDocument();
    await screen.findByRole('button', { name: 'Save goal' });
    expect(screen.getByRole('heading', { level: 1, name: 'Goal Settings' })).toBeInTheDocument();
    expect(screen.getByText('Turn your annual target into this month\'s activity numbers.')).toBeInTheDocument();
  });

  describe('AC-8 — the hints go, the behaviours stay', () => {
    it('AC-8: no sentence under the months or under the APE already produced', async () => {
      render({ '/goals': { body: goal({ monthsLeft: 3.1, monthsLeftIsOverride: false }) } });

      const months = await screen.findByLabelText(/Months left this year/);
      expect(months).not.toHaveAccessibleDescription();
      expect(screen.getByRole('textbox', { name: 'APE already produced this year' })).not.toHaveAccessibleDescription();
      expect(screen.queryByText(/office’s calendar says/)).not.toBeInTheDocument();
      expect(screen.queryByText(/By your own count/)).not.toBeInTheDocument();
      // The override still works: the office's figure in the placeholder, the auto badge beside the name.
      expect(months).toHaveAttribute('placeholder', '3.1');
      expect(screen.getByText('auto')).toBeInTheDocument();
    });

    it('AC-8, P18.95-T5 AC-5: the produced figure carries the marker — the Summary’s glyph, its words on a tap', async () => {
      render({
        '/goals': {
          body: goal({
            achieved: { minor: 120_000_000_00, provenance: 'imported', month: '2026-08' },
            projected: projection({ apeAchievedMinor: 120_000_000_00, remainingApeMinor: 380_000_000_00 }),
          }),
        },
      });

      const marker = await screen.findByRole('button', { name: 'As of Aug 2026' });
      // On the field, since its tile went (P18.95-T5 AC-5).
      const field = marker.closest('dl')!;
      expect(field).toHaveTextContent('APE already produced this year');
      expect(field).toHaveTextContent('IDR 120,000,000');
      const tip = screen.getByText('As of Aug 2026', { selector: '[role="tooltip"]' });
      fireEvent.click(marker);
      expect(tip).toBeVisible();
    });

  });

  it('AC-9: the measured rates leave the screen', async () => {
    render({ '/goals': { body: goal() } });

    expect(await screen.findByLabelText('Appointment to Sales meeting')).toBeInTheDocument();
    expect(screen.queryByText(/logged rate/)).not.toBeInTheDocument();
  });

  it('P18.8-T10 AC-4 draws no 💡 tip, and no helper line under the two percentages', async () => {
    // The client's request of 2026-10-26 (ADR-0160 §4): both tips and both `.field-sub` lines went.
    render({ '/goals': { body: goal() } });

    expect(await screen.findByLabelText('Appointment to Sales meeting')).not.toHaveAccessibleDescription();
    expect(screen.getByLabelText('Closing rate')).not.toHaveAccessibleDescription();
    expect(screen.queryByText('% of contacted leads that become an appointment')).not.toBeInTheDocument();
    expect(screen.queryByText('% of appointments that become a closing')).not.toBeInTheDocument();
    expect(screen.queryByText('Use your real conversion ratios for accuracy.')).not.toBeInTheDocument();
    expect(screen.queryByText('💡')).not.toBeInTheDocument();
    // P18.95-T7 AC-1 (grey text row 15): step 3's sentence is in an ⓘ beside the case size on a phone, and nowhere else.
    const tip = screen.getByRole('button', { name: 'APE per closing. Increase if one appointment often yields multiple policies.' });
    expect(tip.parentElement).toHaveClass('md:hidden');
    expect(screen.getAllByText(/APE per closing/).every((el) => el.closest('.md\\:hidden'))).toBe(true);
    // P18.95-T7 AC-1 (grey text row 17): the 🔗 footnote reads as before from 768px, and is not drawn on a phone.
    expect(screen.getByText('Maps to activities #3, #4, #6 in Activity Management.').closest('p')).toHaveClass('max-md:hidden');
  });

  it('AC-10: no history card, and nothing asks for the retired history', async () => {
    const { calls } = render({ '/goals': [{ body: goal() }, { body: goal() }] });
    await screen.findByRole('button', { name: 'Save goal' });
    await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PUT')).toBe(true));

    expect(screen.queryByText('What this plan has been')).not.toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/history'))).toHaveLength(0);
  });

  /*
   * **Was** *AC-11 — the cascade chips show what the prototype shows*, *Activity #3, #4, #6*. The client asked for the
   * activities' names (2026-10-26, UI-018): the chips read the office's label for each bound code (P18.95-T5 AC-5).
   * The 🔗 tip keeps the numbers, the prototype's sentence.
   */
  describe('P18.95-T5 AC-5 — the cascade chips name the activities', () => {
    it('P18.95-T5 AC-5: names each stage’s activity as the log does — never a number, never the code', async () => {
      render({ '/goals': { body: goal() } });

      await screen.findByText('Maps to activities #3, #4, #6 in Activity Management.');
      // *Set Appointment* and *Submission polis* are their columns' own labels, so no chip repeats them.
      expect(chipOver('Set appointment')).toBeNull();
      expect(chipOver('Sales meeting')).toBe('Melakukan presentasi penjualan untuk calon atau existing nasabah');
      expect(chipOver('Submission polis')).toBeNull();
      expect(screen.queryByText(/^Activity #/)).not.toBeInTheDocument();
      expect(screen.queryByText(/LEADS_CONTACTED|SELL_PRESENTATION|SELL_SUBMISSION/)).not.toBeInTheDocument();
    });

    it('P18.95-T5 AC-5: an office that renamed its activities is named in its own words, on every chip', async () => {
      const renamed = [
        category('LEADS_GENERATION', 'Leads Generation', 1, [
          type('LEADS_CONTACTED', 'LEADS_GENERATION', 'Menghubungi prospek yang sudah ada', 3),
        ]),
        category('SELLING', 'Selling', 2, [
          type('SELL_PRESENTATION', 'SELLING', 'Presentasi penjualan', 4),
          type('SELL_SUBMISSION', 'SELLING', 'Closing polis', 6),
        ]),
      ];
      render({ '/goals': { body: goal() }, ...config(renamed) });

      await screen.findByText('Maps to activities #3, #4, #6 in Activity Management.');
      expect(chipOver('Set appointment')).toBe('Menghubungi prospek yang sudah ada');
      expect(chipOver('Sales meeting')).toBe('Presentasi penjualan');
      expect(chipOver('Submission polis')).toBe('Closing polis');
    });

    it('P18.95-T5 AC-5: lets a long name wrap inside its panel rather than run out of it', async () => {
      render({ '/goals': { body: goal() } });
      const chip = await screen.findByText('Melakukan presentasi penjualan untuk calon atau existing nasabah');
      expect(chip).toHaveClass('whitespace-normal', 'max-w-full', 'normal-case');
      expect(chip).not.toHaveClass('whitespace-nowrap');
    });

    it('AC-11: follows the office’s order — a type dragged elsewhere renumbers the tip, and the plan still binds by code', async () => {
      const reordered = [
        category('SELLING', 'Selling', 1, [
          type('SELL_SUBMISSION', 'SELLING', 'Submission polis', 1),
          type('SELL_PRESENTATION', 'SELLING', 'Melakukan presentasi penjualan untuk calon atau existing nasabah', 2),
        ]),
        category('LEADS_GENERATION', 'Leads Generation', 2, [
          type('LEADS_CONTACTED', 'LEADS_GENERATION', 'Set Appointment', 7),
        ]),
      ];
      render({ '/goals': { body: goal() }, ...config(reordered) });

      expect(await screen.findByText('Maps to activities #7, #2, #1 in Activity Management.')).toBeInTheDocument();
      const hero = document.querySelector('[data-hero="true"]')!;
      expect(hero).toHaveTextContent('Submission polis');
      // Its chip is its name, which no reorder moves (P18.95-T5 AC-5); the tip carries the new number.
      expect(hero).not.toHaveTextContent('Activity #');
      expect(chipOver('Sales meeting')).toBe('Melakukan presentasi penjualan untuk calon atau existing nasabah');
    });

    it('AC-11, P18.95-T5 AC-5: a type the configuration holds no live row for gets no chip and no tip — never a code', async () => {
      const archived = [
        category('LEADS_GENERATION', 'Leads Generation', 1, [
          type('LEADS_CONTACTED', 'LEADS_GENERATION', 'Set Appointment', 3),
        ]),
        category('SELLING', 'Selling', 2, [
          type('SELL_PRESENTATION', 'SELLING', 'Melakukan presentasi penjualan', 4, { status: 'archived' }),
          type('SELL_SUBMISSION', 'SELLING', 'Submission polis', 6),
        ]),
      ];
      render({ '/goals': { body: goal() }, ...config(archived) });

      await screen.findByText('Sales meeting');
      expect(chipOver('Sales meeting')).toBeNull();
      expect(screen.queryByText('Melakukan presentasi penjualan')).not.toBeInTheDocument();
      expect(screen.queryByText(/Maps to activities/)).not.toBeInTheDocument();
      expect(screen.queryByText('SELL_PRESENTATION')).not.toBeInTheDocument();
    });

    it('P18.9-T2 AC-2, P18.95-T5 AC-5: a stage bound to a replaced activity and its replacement names both, from the API’s binding', async () => {
      const replaced = [
        category('LEADS_GENERATION', 'Leads Generation', 1, [
          type('LEADS_CONTACTED', 'LEADS_GENERATION', 'Set Appointment', 3),
        ]),
        category('SELLING', 'Selling', 2, [
          type('SELL_PRESENTATION', 'SELLING', 'Presentasi', 4),
          type('SELL_SUBMISSION', 'SELLING', 'Submission polis', 6),
          type('SALES_MEETING', 'SELLING', 'Sales meeting baru', 13),
        ]),
      ];
      const rebound = goal({
        cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION', 'SALES_MEETING'], closings: ['SELL_SUBMISSION'] },
      });
      render({ '/goals': { body: rebound }, ...config(replaced) });

      expect(await screen.findByText('Presentasi + Sales meeting baru')).toBeInTheDocument();
      expect(screen.getByText('Maps to activities #3, #4, #13, #6 in Activity Management.')).toBeInTheDocument();
      // The stored record is not what the chips read: it still names the old code alone.
      expect(rebound.cascadeMapping).toMatchObject({ appointmentsCode: 'SELL_PRESENTATION' });
    });

    it('AC-11, P18.95-T5 AC-5: an archived section names none of its types', async () => {
      const retired = [
        category('LEADS_GENERATION', 'Leads Generation', 1, [
          type('LEADS_CONTACTED', 'LEADS_GENERATION', 'Set Appointment', 3),
        ]),
        { ...category('SELLING', 'Selling', 2, [type('SELL_PRESENTATION', 'SELLING', 'Presentasi', 4), type('SELL_SUBMISSION', 'SELLING', 'Submission polis', 6)]), status: 'archived' },
      ];
      render({ '/goals': { body: goal() }, ...config(retired) });

      await screen.findByText('Sales meeting');
      expect(chipOver('Sales meeting')).toBeNull();
      expect(chipOver('Submission polis')).toBeNull();
      expect(screen.queryByText('Presentasi')).not.toBeInTheDocument();
    });
  });

  describe('AC-12 — what a requirement keeps', () => {
    it('AC-12: Set by your leader on the day, the disclaimer, and the target-passed state', async () => {
      render({
        '/goals': {
          body: goal({
            savedByMembershipId: 'mem-leader',
            projected: projection({
              targetMet: true, remainingApeMinor: 0, monthlyApeTargetMinor: 0,
              policiesPerMonth: 0, appointmentsPerMonth: 0, leadsPerMonth: 0,
            }),
          }),
        },
      });

      expect((await screen.findByText('Set by your leader')).parentElement).toHaveTextContent(/^Set by your leader on .+2026\. You can change it — it is your plan\.$/);
      expect(screen.getByText('Estimates for personal planning — assumptions vary per individual.')).toBeInTheDocument();
      expect(screen.getByText('You have passed your annual target.')).toBeInTheDocument();
    });
  });
});

// ── P18.95-T5: the client's UI review of 2026-10-26 (UI-018) ─────────────────────────────────────

describe('Goal Settings on the client’s UI review (P18.95-T5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Every class an element wears at 768px and wider: the phone's own are `max-md:`. */
  const wider = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => c && !c.startsWith('max-md:'));

  it('P18.95-T5 AC-4: on a phone, Save goal and its status are a bar fixed to the bottom — one of each, not two', async () => {
    render({ '/goals': { body: goal() } });
    await screen.findByRole('heading', { name: /My commitment/ });

    const save = screen.getAllByRole('button', { name: 'Save goal' });
    expect(save).toHaveLength(1);
    const bar = save[0].parentElement!;
    expect(bar).toHaveAttribute('data-action-bar');
    for (const cls of ACTION_BAR_PHONE.split(' ')) expect(bar).toHaveClass(cls);
    expect(bar).toContainElement(screen.getByRole('status'));
    // At 768px and wider it is step 1's header row, as it was (ADR-0167 §12).
    expect(wider(bar)).toEqual(['flex', 'items-center', 'gap-3']);
    // The page leaves room under the commitment, so its last line is never behind the bar.
    expect(screen.getByRole('heading', { name: /My commitment/ }).closest('.max-w-\\[51\\.25rem\\]')).toHaveClass('max-md:pb-24');
  });

  it('P18.95-T5 AC-4: the bar still saves, and still says so', async () => {
    const { calls } = render({ '/goals': [{ body: goal() }, { body: goal() }] });
    await screen.findByRole('heading', { name: /My commitment/ });
    await userEvent.type(screen.getByLabelText('Annual APE target'), '1');
    expect(screen.getByRole('status')).toHaveTextContent('Not yet saved');
    await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PUT')).toBe(true));
    await waitFor(() => expect(screen.getAllByRole('status').map((r) => r.textContent).join(' ')).toContain('Goal saved ✓'));
  });

  it('P18.95-T5 AC-5: writes the months left in words — about 2 months — where it wrote 2.2 months', async () => {
    render({ '/goals': { body: goal({ monthsLeft: 2.2 }) } });
    const sentence = (await screen.findByText(/To reach APE/)).closest('p')!;
    expect(sentence).toHaveTextContent('(about 2 months left)');
    expect(sentence).not.toHaveTextContent(/2[.,]2 months/);
    // The box keeps the figure the plan divides by: it is an input, and it is what is used.
    expect(screen.getByLabelText(/Months left this year/)).toHaveAttribute('placeholder', '2.2');
  });

  it.each([
    [0.3, '(less than a month left)'],
    [0.6, '(about 1 month left)'],
    [11.9, '(about 12 months left)'],
  ])('P18.95-T5 AC-5: %s months left reads %s', async (monthsLeft, words) => {
    render({ '/goals': { body: goal({ monthsLeft }) } });
    expect((await screen.findByText(/To reach APE/)).closest('p')).toHaveTextContent(words);
  });

  it('P18.95-T5 AC-7: the two ways to set it share the track on a phone, their words wrapping — neither scrolls away', async () => {
    render({ '/goals': { body: goal() } });
    const list = await screen.findByRole('tablist', { name: 'How you want to set it' });
    // No scrolling track below 768px …
    expect(list.className).not.toContain('max-md:overflow-x-auto');
    // … and two equal halves whose words may take a second line, where each kept its words on one and scrolled.
    const tabs = within(list).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Set APE target directly', 'Calculate from savings target']);
    for (const tab of tabs) {
      for (const cls of SEGMENT_WRAP_PHONE.split(' ')) expect(tab).toHaveClass(cls);
      expect(tab).toHaveClass('flex-1');
      expect(tab).not.toHaveClass('max-md:min-w-max');
    }
    // The words are the same at every size: nothing shortened for a phone.
    expect(wider(list)).toEqual(['flex', 'w-full', 'rounded-lg', 'border', 'border-hairline', 'bg-base', 'p-[3px]']);
  });
});

/**
 * **P18.98-T3: the screen's figures follow the reader's language** (AC-1, AC-3). Every spec above reads English, the
 * harness's default (ADR-0179 §9); an Indonesian reader sees the same figures in Indonesian, the field's prefix *Rp*.
 */
describe('P18.98-T3 Goal Settings in each language', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.98-T3 AC-3 in Indonesian: the field’s prefix is Rp, its digits 500.000.000, and the sums in juta', async () => {
    stubFetch({ ...base, '/goals': { body: goal() } } as Parameters<typeof stubFetch>[0]);
    renderWithSession(<InLanguage language="id"><AgentLayout><GoalSettingsPage /></AgentLayout></InLanguage>, { me: AGENT });

    expect(await screen.findByLabelText('Annual APE target')).toHaveValue('500.000.000');
    expect(screen.getAllByText('Rp').find((el) => el.getAttribute('aria-hidden') === 'true')).toBeDefined();
    expect(screen.queryAllByText('IDR')).toHaveLength(0);
    expect(screen.getAllByText('Rp 500 jt').length).toBeGreaterThan(0);
    expect((await screen.findByText('Policies per week')).closest('[data-variant]')).toHaveTextContent('≈ 1,4');
  });

  it('P18.98-T3 AC-3 in English: the field’s prefix is IDR, its digits 500,000,000, and the sums in millions', async () => {
    render({ '/goals': { body: goal() } });

    expect(await screen.findByLabelText('Annual APE target')).toHaveValue('500,000,000');
    expect(screen.getAllByText('IDR').find((el) => el.getAttribute('aria-hidden') === 'true')).toBeDefined();
    expect(screen.queryAllByText('Rp')).toHaveLength(0);
    expect(screen.getAllByText('IDR 500M').length).toBeGreaterThan(0);
  });
});
