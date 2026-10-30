import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { FLOATING_SAVE_ROOM } from '@/components/ui/save-state';
import { SEGMENT_WRAP_PHONE } from '@/components/ui/phone';
import { atWidth, InLanguage, makeMe, renderInLayout, renderWithSession, stubFetch, wears } from '@test/harness';
import GoalSettingsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/goals',
}));

/**
 * **Goal Settings** (P8-T3), as UI V1 draws it (P18.99-T5; the report's UI-014 to UI-022, `goals-mobile` and
 * `goals-desktop`). jsdom has no width, so a spec reads the desktop unless it says otherwise (`atWidth`).
 */

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
  snapshot: { monthlyApeTargetMinor: 100_000_000_00, policiesPerMonth: 6, appointmentsPerMonth: 20, leadsPerMonth: 67 },
  projected: projection(),
  cascadeMapping: { leadsCode: 'LEADS_CONTACTED', appointmentsCode: 'SELL_PRESENTATION', closingsCode: 'SELL_SUBMISSION' },
  cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
  measured: { from: '2026-08-15', to: '2026-09-13', days: 30, leadToAppointmentRate: 0.25, closingRate: null },
  monthsLeftIsOverride: false,
  savedAt: '2026-09-13T04:00:00.000Z',
  savedByMembershipId: 'mem-1',
  ...over,
});

/** `POST /goals/:period/preview`'s answer (P18.99-T5): the plan the inputs on screen would make, saved nowhere. */
const previewOf = (over: Record<string, unknown> = {}) => ({
  period: PERIOD,
  monthsLeft: 5,
  monthsLeftIsOverride: false,
  achieved: { minor: 0, provenance: 'self_reported', month: null },
  projected: projection(),
  ...over,
});
const PREVIEW = `POST /goals/${PERIOD}/preview`;

/** An activity type as the published configuration carries it; only its code, label and number matter here. */
const type = (code: string, categoryCode: string, label: string, displayOrder: number, over: Record<string, unknown> = {}) => ({
  id: `t-${code}`, code, categoryCode, label, description: null, appliesToOrgLevelCodes: [], displayOrder, version: 1,
  status: 'active', ...over,
});
const category = (code: string, label: string, displayOrder: number, types: unknown[]) => ({
  id: `c-${code}`, code, label, description: null, appliesToOrgLevelCodes: [], displayOrder, version: 1, status: 'active', types,
});
/** The seed's numbering: the cascade's three types are the prototype's #3, #4 and #6. */
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
  [PREVIEW]: { body: previewOf() },
};

const render = (routes: Record<string, unknown>, me = AGENT) => {
  const stub = stubFetch({ ...base, ...routes } as Parameters<typeof stubFetch>[0]);
  renderInLayout(AgentLayout, <GoalSettingsPage />, { me });
  return stub;
};

/** The orange result card (UI-014), once it is drawn. */
const resultCard = async () => (await screen.findByRole('region', { name: 'Monthly activity target' }));
/** One of its three tiles, by the stage it names. */
const tile = (card: HTMLElement, label: string) =>
  [...card.querySelectorAll('[data-result-tile]')].find((t) => t.textContent?.includes(label)) as HTMLElement;
/** The desktop's right column (UI-022). */
const aside = () => document.querySelector('[data-goal-aside]') as HTMLElement;
/** The save status, wherever the size puts it: the right column on a desktop, the floating pill below 1024px. */
const status = () => within((document.querySelector('[data-floating-save]') ?? aside()) as HTMLElement).getByRole('status');
const sent = (calls: { url: string; init: RequestInit }[], method: string) =>
  calls.filter((c) => c.init.method === method).map((c) => JSON.parse(String(c.init.body)));
const commitmentSentence = async () => (await screen.findByText(/^This month, APE/)).closest('p')!;
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

afterEach(() => vi.unstubAllGlobals());

describe('Goal Settings (P8-T3) as UI V1 draws it (P18.99-T5)', () => {
  describe('UI-014 — the result first', () => {
    it('UI-014 puts the result card above four numbered steps, and the commitment after them — no step 5', async () => {
      atWidth(375);
      render({ '/goals': { body: goal() } });
      const card = await resultCard();

      // The ordinal's disc is drawn, and hidden from a screen reader: the names are the questions.
      const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent!.replace(/^\d/, ''));
      expect(headings).toEqual([
        'Monthly activity target', "What's your APE target this year?", 'Your current progress',
        'From APE to policy count', 'Conversion assumptions', `My commitment (as of 13 Sep 2026)`,
      ]);
      expect(card.compareDocumentPosition(screen.getByRole('heading', { name: /APE target this year/ })))
        .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('UI-014 the card: this month’s APE in its pill, a month’s count over its week, Submission polis on navy', async () => {
      render({ '/goals': { body: goal() } });
      const card = await resultCard();

      expect(card).toHaveTextContent(/^Monthly activity targetIDR 100M/);
      expect(tile(card, 'Set appointment')).toHaveTextContent(/^67Set appointment≈ 16\/week$/);
      expect(tile(card, 'Sales meeting')).toHaveTextContent(/^20Sales meeting.*≈ 5\/week$/);
      const hero = tile(card, 'Submission polis');
      expect(hero).toHaveTextContent(/^6Submission polis≈ 1\.4\/week$/);
      expect(hero).toHaveAttribute('data-hero', 'true');
      expect(hero).toHaveClass('bg-navy');
      expect(hero.firstElementChild).toHaveClass('text-amber');
      // The accent's words are navy, never white (parity I-542).
      expect(card).toHaveClass('bg-amber');
      expect(within(card).getByRole('heading')).toHaveClass('text-navy');
    });

    it('UI-014 AC-2 renders what the server answered — the recomputed figure, not the stored snapshot', async () => {
      render({
        '/goals': {
          body: goal({
            projected: projection({ monthlyApeTargetMinor: 250_000_000_00, policiesPerMonth: 14, appointmentsPerMonth: 47, leadsPerMonth: 157 }),
          }),
        },
      });
      const card = await resultCard();
      expect(tile(card, 'Set appointment')).toHaveTextContent(/^157/);
      expect(card).not.toHaveTextContent(/^67/);
    });

    it('UI-014 moving the APE target changes the three figures at once, from the server’s preview, and saves nothing', async () => {
      const moved = previewOf({
        projected: projection({
          annualApeTargetMinor: 600_000_000_00, remainingApeMinor: 600_000_000_00, monthlyApeTargetMinor: 120_000_000_00,
          policiesPerMonth: 7, appointmentsPerMonth: 24, leadsPerMonth: 80,
        }),
      });
      const { calls } = render({ '/goals': { body: goal() }, [PREVIEW]: { body: moved } });
      const card = await resultCard();

      fireEvent.change(screen.getByRole('slider', { name: 'Annual APE target' }), { target: { value: '600000000' } });

      await waitFor(() => expect(tile(card, 'Set appointment')).toHaveTextContent(/^80/));
      expect(tile(card, 'Submission polis')).toHaveTextContent(/^7/);
      expect(card).toHaveTextContent('IDR 120M');
      expect(sent(calls, 'POST').at(-1)).toMatchObject({ annualApeTargetMinor: 600_000_000_00, caseSizeMinor: 18_000_000_00 });
      expect(calls.find((c) => c.init.method === 'POST')!.url).toContain(`/goals/${PERIOD}/preview`);
      expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
    });

    it('UI-014 moving the case size changes them too', async () => {
      const { calls } = render({
        '/goals': { body: goal() },
        [PREVIEW]: { body: previewOf({ projected: projection({ policiesPerMonth: 12, appointmentsPerMonth: 40, leadsPerMonth: 134 }) }) },
      });
      const card = await resultCard();

      fireEvent.change(screen.getByRole('slider', { name: /^Average case size/ }), { target: { value: '9000000' } });

      await waitFor(() => expect(tile(card, 'Submission polis')).toHaveTextContent(/^12/));
      expect(sent(calls, 'POST').at(-1)).toMatchObject({ caseSizeMinor: 9_000_000_00 });
    });

    it('UI-014 says the plan cannot be worked out when the preview cannot take a figure', async () => {
      render({
        '/goals': { body: goal() },
        [PREVIEW]: { status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'monthsLeft is out of range.', requestId: 'r' } } },
      });
      const card = await resultCard();

      fireEvent.change(screen.getByRole('slider', { name: 'Annual APE target' }), { target: { value: '600000000' } });

      expect(await within(card).findByText(/cannot be worked out/)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('UI-014 a preview that never arrived is a banner, and the figures stay as they were', async () => {
      render({
        '/goals': { body: goal() },
        [PREVIEW]: { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Nope.', requestId: 'r' } } },
      });
      const card = await resultCard();

      fireEvent.change(screen.getByRole('slider', { name: 'Annual APE target' }), { target: { value: '600000000' } });

      expect(await screen.findByText('Nope.')).toBeInTheDocument();
      expect(tile(card, 'Set appointment')).toHaveTextContent(/^67/);
    });
  });

  describe('UI-016 — sliders and steppers', () => {
    it('UI-016 sets all four values without a keyboard, and saves them', async () => {
      const { calls } = render({ '/goals': [{ body: goal() }, { body: goal() }] });
      await resultCard();

      fireEvent.change(screen.getByRole('slider', { name: 'Annual APE target' }), { target: { value: '700000000' } });
      fireEvent.change(screen.getByRole('slider', { name: /^Average case size/ }), { target: { value: '20000000' } });
      await userEvent.click(screen.getByRole('button', { name: 'Increase Appointment to meeting' }));
      await userEvent.click(screen.getByRole('button', { name: 'Decrease Closing rate' }));
      expect(within(screen.getByRole('group', { name: 'Appointment to meeting' })).getByText('35%')).toBeInTheDocument();
      expect(within(screen.getByRole('group', { name: 'Closing rate' })).getByText('25%')).toBeInTheDocument();

      await save();

      await waitFor(() => expect(sent(calls, 'PUT')).toHaveLength(1));
      expect(sent(calls, 'PUT')[0]).toMatchObject({
        annualApeTargetMinor: 700_000_000_00, caseSizeMinor: 20_000_000_00, leadsToApptPct: 35, closingRatePct: 25,
      });
    });

    it('UI-016 still takes an exact amount, typed — past the track’s end too', async () => {
      const { calls } = render({ '/goals': [{ body: goal() }, { body: goal() }] });
      await resultCard();

      await userEvent.click(screen.getByRole('button', { name: 'Type an exact amount for Annual APE target' }));
      const field = screen.getByRole('textbox', { name: 'Type an exact amount for Annual APE target' });
      await userEvent.clear(field);
      await userEvent.type(field, '1500000000{Enter}');
      await save();

      await waitFor(() => expect(sent(calls, 'PUT')).toHaveLength(1));
      expect(sent(calls, 'PUT')[0].annualApeTargetMinor).toBe(1_500_000_000_00);
    });

    it('UI-016 shows each value large beside its label: the target and the case size compact, the rates whole', async () => {
      render({ '/goals': { body: goal({ leadsToApptPct: 50 }) } });
      await resultCard();

      expect(screen.getByRole('button', { name: 'Type an exact amount for Annual APE target' })).toHaveTextContent('IDR 500M');
      expect(screen.getByRole('slider', { name: 'Annual APE target' })).toHaveAttribute('aria-valuetext', 'IDR 500M');
      expect(screen.getByRole('slider', { name: /^Average case size/ })).toHaveAttribute('aria-valuetext', 'IDR 18M');
      expect(within(screen.getByRole('group', { name: 'Appointment to meeting' })).getByText('50%')).toBeInTheDocument();
    });

    it('UI-016 saving and reloading shows the same values', async () => {
      const after = goal({ leadsToApptPct: 55, closingRatePct: 35, annualApeTargetMinor: 800_000_000_00 });
      render({ '/goals': [{ body: goal() }, { body: after }] });
      await resultCard();
      await save();

      await waitFor(() => expect(status()).toHaveTextContent('Saved ✓'));
      expect(within(screen.getByRole('group', { name: 'Appointment to meeting' })).getByText('55%')).toBeInTheDocument();
      expect(within(screen.getByRole('group', { name: 'Closing rate' })).getByText('35%')).toBeInTheDocument();
      expect(screen.getByRole('slider', { name: 'Annual APE target' })).toHaveAttribute('aria-valuetext', 'IDR 800M');
    });

    it('UI-016 calls the first rate Appointment to meeting, the owner’s name, and steps both by 5 between 5 and 100', async () => {
      render({ '/goals': { body: goal({ leadsToApptPct: 5, closingRatePct: 100 }) } });
      await resultCard();

      expect(screen.queryByText('Appointment to Sales meeting')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Decrease Appointment to meeting' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Increase Closing rate' })).toBeDisabled();
    });

    it('UI-016 the savings mode: its target on a slider, the commission on − / +, the hint and the APE target it makes', async () => {
      const { calls } = render({ '/goals': [{ body: goal() }, { body: goal() }] });
      await userEvent.click(await screen.findByRole('tab', { name: 'Calculate from savings target' }));

      expect(screen.getByRole('slider', { name: 'Annual savings target' })).toHaveAttribute('aria-valuetext', 'IDR 50M');
      await userEvent.click(screen.getByRole('button', { name: 'Increase Commission rate' }));
      expect(within(screen.getByRole('group', { name: 'Commission rate' })).getByText('15%')).toBeInTheDocument();
      // The hint: a line under the row from 768px, an ⓘ beside the label on a phone (the report's Appendix A).
      const hint = screen.getAllByText('% of APE that becomes income / savings').find((el) => el.tagName === 'P')!;
      expect(wears(hint, 375)).toContain('hidden');
      expect(screen.getByRole('button', { name: '% of APE that becomes income / savings' }).parentElement).toHaveClass('md:hidden');
      expect(screen.getByText('That is an APE target of').closest('[data-variant]')).toHaveTextContent('IDR 500M');

      await save();
      await waitFor(() => expect(sent(calls, 'PUT')).toHaveLength(1));
      expect(sent(calls, 'PUT')[0]).toMatchObject({ mode: 'from_savings', commissionRatePct: 15, savingsTargetMinor: 50_000_000_00 });
    });

    it('UI-016 the step tiles: the figure 22px/800 under a 13px label, this month’s target in the accent', async () => {
      render({ '/goals': { body: goal() } });
      await resultCard();

      const monthly = screen.getByText("This month's APE target").closest('[data-variant]')!;
      expect(monthly).toHaveAttribute('data-variant', 'insight');
      expect(monthly).toHaveTextContent('IDR 100M');
      expect(monthly.lastElementChild).toHaveClass('text-[1.375rem]', 'font-extrabold', 'text-amber-deep');
      expect(screen.getByText('Remaining needed')).toHaveClass('text-base', 'font-medium');
      expect(screen.getByText('Policies per month').closest('[data-variant]')).toHaveTextContent('6policies');
      // One decimal (ADR-0160 §5).
      expect(screen.getByText('Policies per week').closest('[data-variant]')).toHaveTextContent('≈ 1.4');
    });
  });

  describe('UI-017 — one commitment, in the result card’s words', () => {
    it('UI-017 says the three activities with the same numbers as the result card, each figure amber', async () => {
      render({ '/goals': { body: goal() } });

      const sentence = await commitmentSentence();
      expect(sentence).toHaveTextContent(
        'This month, APE IDR 100M (on the way to IDR 500M this year): 67 Set appointment, 20 Sales meeting, 6 Submission polis.',
      );
      expect([...sentence.querySelectorAll('strong')].map((s) => s.textContent))
        .toEqual(['IDR 100M', 'IDR 500M', '67 Set appointment', '20 Sales meeting', '6 Submission polis']);
      for (const strong of sentence.querySelectorAll('strong')) expect(strong).toHaveClass('text-amber');
      expect(screen.queryByText(/will contact|appointments, and close/)).not.toBeInTheDocument();
    });

    it('UI-017 changing an input updates the result card and the commitment together', async () => {
      render({
        '/goals': { body: goal() },
        [PREVIEW]: { body: previewOf({ projected: projection({ policiesPerMonth: 7, appointmentsPerMonth: 24, leadsPerMonth: 80 }) }) },
      });
      const card = await resultCard();

      await userEvent.click(screen.getByRole('button', { name: 'Increase Closing rate' }));

      await waitFor(() => expect(tile(card, 'Set appointment')).toHaveTextContent(/^80/));
      expect(await commitmentSentence()).toHaveTextContent('80 Set appointment, 24 Sales meeting, 7 Submission polis.');
    });

    it('UI-017 dates the commitment from the goal, and keeps the disclaimer (L-29)', async () => {
      render({ '/goals': { body: goal({ savedAt: '2026-09-13T04:00:00.000Z' }) } });

      expect(await screen.findByRole('heading', { name: 'My commitment (as of 13 Sep 2026)' })).toHaveClass('text-amber', 'uppercase');
      expect(screen.getByText('Estimates for personal planning — assumptions vary per individual.')).toBeInTheDocument();
    });
  });

  describe('UI-015, UI-018, UI-022 — where the save is, and the two columns', () => {
    it('UI-022 a desktop: the steps left, and the result, the commitment and the save in a sticky right column', async () => {
      render({ '/goals': { body: goal() } });
      const card = await resultCard();

      const right = aside();
      expect(right).toHaveClass('sticky', 'top-6');
      expect(right.parentElement).toHaveClass('grid', 'grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]');
      expect(right).toContainElement(card);
      expect(right).toContainElement(screen.getByRole('heading', { name: /My commitment/ }));
      expect(right).toContainElement(screen.getByRole('button', { name: 'Save goal' }));
      expect(within(right).getByRole('status')).toHaveTextContent('Saved ✓');
      expect(right).not.toContainElement(screen.getByRole('heading', { name: /APE target this year/ }));
      // No floating pill, and no centred measure: the title's left edge is the cards'.
      expect(document.querySelector('[data-floating-save]')).toBeNull();
      expect(right.closest('.max-w-\\[51\\.25rem\\]')).toBeNull();
      // The 🔗 line under the result card, a desktop's alone.
      expect(right).toContainElement(screen.getByText('Maps to activities #3, #4, #6 in Activity Management.'));
    });

    it.each([375, 768])('UI-015 UI-018 at %ipx the save floats above the tab bar, and step 1 has none', async (px) => {
      atWidth(px);
      render({ '/goals': { body: goal() } });
      await resultCard();

      const pill = document.querySelector('[data-floating-save]') as HTMLElement;
      expect(screen.getAllByRole('button', { name: 'Save goal' })).toHaveLength(1);
      expect(pill).toContainElement(screen.getByRole('button', { name: 'Save goal' }));
      expect(within(pill).getByRole('status')).toHaveTextContent('Saved ✓');
      expect(pill).toHaveClass('fixed');
      expect(pill.className).toContain('var(--tab-bar-space)');
      // Room under the last line, so the commitment is never behind the pill.
      expect(screen.getByRole('heading', { name: /My commitment/ }).closest(`.${FLOATING_SAVE_ROOM.replace(':', '\\:')}`)).not.toBeNull();
      expect(aside()).toBeNull();
      // Nothing of a desktop's below 1024px: the 🔗 line goes (the report's Appendix A).
      expect(screen.queryByText(/Maps to activities/)).not.toBeInTheDocument();
    });

    it('UI-015 the floating pill saves, and says so', async () => {
      atWidth(375);
      const { calls } = render({ '/goals': [{ body: goal() }, { body: goal() }] });
      await resultCard();

      await userEvent.click(screen.getByRole('button', { name: 'Increase Closing rate' }));
      expect(status()).toHaveTextContent('Not saved yet');
      await save();

      await waitFor(() => expect(sent(calls, 'PUT')).toHaveLength(1));
      await waitFor(() => expect(status()).toHaveTextContent('Saved ✓'));
      expect(await screen.findByText('Goal saved ✓')).toBeInTheDocument();
      // The pill lifts the shell's toast above it on a phone.
      expect(document.querySelector('[data-floating-save]')!.parentElement).toHaveAttribute('data-action-bar');
    });

    it('UI-022 the disclaimer: a footnote on a desktop, an ⓘ in the commitment’s header on a tablet, nothing on a phone', async () => {
      atWidth(768);
      render({ '/goals': { body: goal() } });
      await resultCard();

      const info = screen.getByRole('button', { name: 'Estimates for personal planning — assumptions vary per individual.' });
      expect(info.closest('[class*="max-md:hidden"]')).not.toBeNull();
      // In the ⓘ alone: no footnote under the sentence at this size.
      expect(screen.getAllByText('Estimates for personal planning — assumptions vary per individual.')
        .every((el) => el.closest('[role="tooltip"]') !== null || el.classList.contains('sr-only'))).toBe(true);
    });

    it('UI-015 a phone is about 1.8 screens: two rows in step 2, both rates stacked, the tiles two up', async () => {
      atWidth(375);
      render({ '/goals': { body: goal() } });
      await resultCard();

      // Each prefilled figure is one 56px row, its label on the left.
      const months = screen.getByRole('textbox', { name: 'Months left this year' });
      expect(months.closest('.min-h-14')).not.toBeNull();
      expect(screen.getByText('Remaining needed').closest('.grid')).toHaveClass('grid-cols-2');
      expect(screen.getByText('Policies per month').closest('.grid')).toHaveClass('grid-cols-2');
      expect(screen.getByRole('group', { name: 'Closing rate' }).parentElement).not.toHaveClass('grid-cols-2');
    });

    it('UI-022 a desktop lays step 2 out four across and step 4’s two rates side by side', async () => {
      render({ '/goals': { body: goal() } });
      await resultCard();

      expect(screen.getByText('Remaining needed').closest('.grid')).toHaveClass('grid-cols-4');
      expect(screen.getByRole('group', { name: 'Closing rate' }).parentElement).toHaveClass('grid-cols-2');
    });
  });

  describe('UI-019 — the save state compares what is on screen with what was saved', () => {
    it('UI-019 switching the mode and back reads Saved again', async () => {
      render({ '/goals': { body: goal() } });
      await resultCard();

      await userEvent.click(screen.getByRole('tab', { name: 'Calculate from savings target' }));
      expect(status()).toHaveTextContent('Not saved yet');
      await userEvent.click(screen.getByRole('tab', { name: 'Set APE target directly' }));
      expect(status()).toHaveTextContent('Saved ✓');
    });

    it('UI-019 a value changed and changed back reads Saved again, and shows the read’s figures again', async () => {
      const { calls } = render({ '/goals': { body: goal() } });
      const card = await resultCard();

      await userEvent.click(screen.getByRole('button', { name: 'Increase Closing rate' }));
      expect(status()).toHaveTextContent('Not saved yet');
      await userEvent.click(screen.getByRole('button', { name: 'Decrease Closing rate' }));
      expect(status()).toHaveTextContent('Saved ✓');
      expect(tile(card, 'Set appointment')).toHaveTextContent(/^67/);
      // Back at the saved plan within the pause, nothing was asked.
      await new Promise((r) => setTimeout(r, 300));
      expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    });

    it('UI-019 a plan nobody has saved says not saved yet, though nothing was changed', async () => {
      render({ '/goals': { body: goal({ savedAt: null, savedByMembershipId: null }) } });
      await resultCard();

      expect(status()).toHaveTextContent('Not saved yet');
    });

    it('UI-019 a save that lands says Goal saved ✓ and Saved; a refused one toasts nothing and shows its reason', async () => {
      render({
        '/goals': [
          { body: goal({ savedAt: null, savedByMembershipId: null }) },
          { status: 422, body: { error: { code: 'GOAL_INVALID_ASSUMPTION', message: 'Average case size must be above zero.', requestId: 'r' } } },
          { body: goal() },
        ],
      });
      await resultCard();

      await save();
      expect(await screen.findByText('Average case size must be above zero.')).toBeInTheDocument();
      expect(screen.queryByText('Goal saved ✓')).not.toBeInTheDocument();
      expect(status()).toHaveTextContent('Not saved yet');

      await save();
      expect(await screen.findByText('Goal saved ✓')).toBeInTheDocument();
      expect(status()).toHaveTextContent('Saved ✓');
    });
  });

  describe('UI-020 — the two prefilled figures look alike, and editable', () => {
    it('UI-020 both in one white pill, the figure in normal ink with ✎; the months the office’s, marked ⚡', async () => {
      render({ '/goals': { body: goal({ apeAchievedMinor: 290_000_000_00, monthsLeft: 2.1 }) } });
      await resultCard();

      const months = screen.getByRole('textbox', { name: 'Months left this year' });
      const produced = screen.getByRole('textbox', { name: 'APE already produced this year' });
      // A real value, not a placeholder; short until tapped.
      expect(months).toHaveValue('2.1');
      expect(months).not.toHaveAttribute('placeholder');
      expect(produced).toHaveValue('IDR 290M');
      for (const field of [months, produced]) {
        expect(field).toHaveClass('text-ink', 'font-bold');
        expect(field.parentElement).toHaveClass('h-12', 'rounded-pill', 'border-[1.5px]', 'bg-card');
      }
      expect(months.parentElement).toHaveTextContent('months');
      // The ⚡ while the figure fills itself in (D-25), no *OTOMATIS* chip; none on the agent's own typed figure.
      const monthsLabel = screen.getByText('Months left this year').parentElement!;
      expect(monthsLabel.querySelector('[data-auto-marker]')).not.toBeNull();
      expect(screen.queryByText(/^auto$|^OTOMATIS$/i)).not.toBeInTheDocument();
      expect(screen.getByText('APE already produced this year').parentElement!.querySelector('[data-auto-marker]')).toBeNull();
    });

    it('UI-020 the months: null while the office’s, the typed figure once overridden, null again once cleared', async () => {
      const { calls } = render({ '/goals': [{ body: goal() }, { body: goal() }, { body: goal() }] });
      await resultCard();
      const months = screen.getByRole('textbox', { name: 'Months left this year' });

      await save();
      await waitFor(() => expect(sent(calls, 'PUT')).toHaveLength(1));
      expect(sent(calls, 'PUT')[0].monthsLeft).toBeNull();

      await userEvent.clear(months);
      await userEvent.type(months, '2,5');
      expect(months).toHaveValue('2,5');
      expect(status()).toHaveTextContent('Not saved yet');
      // The ⚡ goes once the figure is the reader's.
      expect(screen.getByText('Months left this year').parentElement!.querySelector('[data-auto-marker]')).toBeNull();
      await save();
      await waitFor(() => expect(sent(calls, 'PUT')).toHaveLength(2));
      expect(sent(calls, 'PUT')[1].monthsLeft).toBe(2.5);

      await userEvent.clear(months);
      await save();
      await waitFor(() => expect(sent(calls, 'PUT')).toHaveLength(3));
      expect(sent(calls, 'PUT')[2].monthsLeft).toBeNull();
    });

    it('UI-020 the agent’s own APE: every digit once tapped, grouped as typed, sent in sen — and short again after', async () => {
      const { calls } = render({ '/goals': [{ body: goal() }, { body: goal() }] });
      await resultCard();
      const produced = screen.getByRole('textbox', { name: 'APE already produced this year' });

      await userEvent.clear(produced);
      await userEvent.type(produced, '120000000');
      expect(produced).toHaveValue('120,000,000');
      expect(status()).toHaveTextContent('Not saved yet');
      await userEvent.tab();
      expect(produced).toHaveValue('IDR 120M');

      await save();
      await waitFor(() => expect(sent(calls, 'PUT')).toHaveLength(1));
      expect(sent(calls, 'PUT')[0].apeAchievedMinor).toBe(120_000_000_00);
    });
  });

  describe('UI-021 — no description pill under Sales meeting', () => {
    it('UI-021 an ⓘ beside Sales meeting names the office’s activity from 768px; nothing on a phone, no pill anywhere', async () => {
      render({ '/goals': { body: goal() } });
      const card = await resultCard();

      const info = within(tile(card, 'Sales meeting')).getByRole('button', {
        name: 'Melakukan presentasi penjualan untuk calon atau existing nasabah',
      });
      expect(info.parentElement).toHaveClass('max-md:hidden');
      // Its words are the ⓘ's bubble alone: no pill under the tile.
      expect(screen.getAllByText('Melakukan presentasi penjualan untuk calon atau existing nasabah')
        .every((el) => el.closest('[role="tooltip"]') !== null || el.classList.contains('sr-only'))).toBe(true);
      // *Set Appointment* and *Submission polis* are their tiles' own names, so nothing repeats them.
      expect(within(tile(card, 'Set appointment')).queryByRole('button')).toBeNull();
      expect(within(tile(card, 'Submission polis')).queryByRole('button')).toBeNull();
      expect(screen.queryByText(/LEADS_CONTACTED|SELL_PRESENTATION|SELL_SUBMISSION|^Activity #/)).not.toBeInTheDocument();
    });

    it('UI-021 an office that renamed its activities is named in its own words, on every tile', async () => {
      const renamed = [
        category('LEADS_GENERATION', 'Leads Generation', 1, [type('LEADS_CONTACTED', 'LEADS_GENERATION', 'Menghubungi prospek', 3)]),
        category('SELLING', 'Selling', 2, [
          type('SELL_PRESENTATION', 'SELLING', 'Presentasi penjualan', 4),
          type('SELL_SUBMISSION', 'SELLING', 'Closing polis', 6),
        ]),
      ];
      render({ '/goals': { body: goal() }, ...config(renamed) });
      const card = await resultCard();

      await waitFor(() => expect(within(tile(card, 'Set appointment')).getByRole('button', { name: 'Menghubungi prospek' })).toBeInTheDocument());
      expect(within(tile(card, 'Sales meeting')).getByRole('button', { name: 'Presentasi penjualan' })).toBeInTheDocument();
      expect(within(tile(card, 'Submission polis')).getByRole('button', { name: 'Closing polis' })).toBeInTheDocument();
    });

    it('UI-021 P18.9-T2 a stage bound to a replaced activity and its replacement names both, from the API’s binding', async () => {
      const replaced = [
        category('LEADS_GENERATION', 'Leads Generation', 1, [type('LEADS_CONTACTED', 'LEADS_GENERATION', 'Set Appointment', 3)]),
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

      expect(await screen.findByRole('button', { name: 'Presentasi + Sales meeting baru' })).toBeInTheDocument();
      expect(screen.getByText('Maps to activities #3, #4, #13, #6 in Activity Management.')).toBeInTheDocument();
    });

    it('UI-021 AC-11 a type with no live row, or an archived section, names nothing and numbers nothing — never a code', async () => {
      const archived = [
        category('LEADS_GENERATION', 'Leads Generation', 1, [type('LEADS_CONTACTED', 'LEADS_GENERATION', 'Set Appointment', 3)]),
        category('SELLING', 'Selling', 2, [
          type('SELL_PRESENTATION', 'SELLING', 'Melakukan presentasi penjualan', 4, { status: 'archived' }),
          type('SELL_SUBMISSION', 'SELLING', 'Submission polis', 6),
        ]),
      ];
      render({ '/goals': { body: goal() }, ...config(archived) });
      const card = await resultCard();

      expect(within(tile(card, 'Sales meeting')).queryByRole('button')).toBeNull();
      expect(screen.queryByText(/Maps to activities/)).not.toBeInTheDocument();
      expect(screen.queryByText('SELL_PRESENTATION')).not.toBeInTheDocument();
    });

    it('AC-11 the 🔗 line follows the office’s order: a type dragged elsewhere renumbers it, and the plan still binds by code', async () => {
      const reordered = [
        category('SELLING', 'Selling', 1, [
          type('SELL_SUBMISSION', 'SELLING', 'Submission polis', 1),
          type('SELL_PRESENTATION', 'SELLING', 'Melakukan presentasi penjualan untuk calon atau existing nasabah', 2),
        ]),
        category('LEADS_GENERATION', 'Leads Generation', 2, [type('LEADS_CONTACTED', 'LEADS_GENERATION', 'Set Appointment', 7)]),
      ];
      render({ '/goals': { body: goal() }, ...config(reordered) });

      expect(await screen.findByText('Maps to activities #7, #2, #1 in Activity Management.')).toBeInTheDocument();
      expect(document.querySelector('[data-hero="true"]')).toHaveTextContent('Submission polis');
    });
  });

  describe('UI-004 and the report’s Appendix A — the title row', () => {
    it('Appendix A keeps the prototype’s title and line, the line on a desktop alone', async () => {
      render({ '/goals': { body: goal() } });

      expect(screen.getByRole('heading', { level: 1, name: 'Goal Settings' })).toBeInTheDocument();
      const line = screen.getByText('Turn your annual target into this month\'s activity numbers.');
      expect(wears(line, 375)).toContain('hidden');
      expect(wears(line, 768)).toContain('hidden');
      expect(wears(line, 1024)).not.toContain('hidden');
      await resultCard();
    });
  });
});

describe('Goal Settings — what a requirement keeps', () => {
  it('ADR-0047 replaces the three counts with a sentence when the target is met, and says no pledge', async () => {
    render({
      '/goals': {
        body: goal({
          projected: projection({
            targetMet: true, remainingApeMinor: 0, monthlyApeTargetMinor: 0, policiesPerMonth: 0, appointmentsPerMonth: 0, leadsPerMonth: 0,
          }),
        }),
      },
    });
    const card = await resultCard();

    expect(within(card).getByText('You have passed your annual target.')).toBeInTheDocument();
    expect(card.querySelectorAll('[data-result-tile]')).toHaveLength(0);
    expect(screen.queryByText(/^This month, APE/)).not.toBeInTheDocument();
  });

  it('says which numbers it cannot work from, rather than showing nothing', async () => {
    render({ '/goals': { body: goal({ projected: null }) } });
    const card = await resultCard();

    expect(within(card).getByText(/cannot be worked out/)).toHaveTextContent(/case size and the two/);
  });

  it('shows a skeleton while it loads, and an error instead of an empty form', async () => {
    render({ '/goals': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Nope.', requestId: 'r' } } } });

    expect(await screen.findByText('Nope.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save goal' })).not.toBeInTheDocument();
  });

  it('refuses the screen to somebody without goal:read', async () => {
    render({ '/goals': { body: goal() } }, makeMe({ permissions: [] }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Not available to you');
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'goal:read');
  });

  it('ADR-0046 names the leader who set it, on the day, on the agent’s own screen; nothing when they set it themselves', async () => {
    render({ '/goals': { body: goal({ savedByMembershipId: 'mem-leader' }) } });

    expect((await screen.findByText('Set by your leader')).parentElement)
      .toHaveTextContent(/^Set by your leader on .+2026\. You can change it — it is your plan\.$/);
    document.body.innerHTML = '';
    render({ '/goals': { body: goal({ savedByMembershipId: 'mem-1' }) } });
    await resultCard();
    expect(screen.queryByText('Set by your leader')).not.toBeInTheDocument();
  });

  it('P11-T7 AC-6 offers no Whose plan picker, reads no team, and sends no for=', async () => {
    const leader = makeMe({
      permissions: ['goal:read', 'goal:update'],
      membership: {
        membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 3,
      },
    });
    const { calls } = render({ '/goals': [{ body: goal() }, { body: goal() }] }, leader);
    await resultCard();

    expect(screen.queryByLabelText('Whose plan')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Increase Closing rate' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'POST')).toBe(true));
    await save();
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PUT')).toBe(true));
    expect(calls.some((c) => c.url.includes('/members/my-team'))).toBe(false);
    expect(calls.filter((c) => c.url.includes('/goals/')).every((c) => !c.url.includes('for='))).toBe(true);
  });

  it('P10.1-T6 no measured rates, no 💡 tip, no helper line under a rate, no history — the case size’s tip behind an ⓘ', async () => {
    const { calls } = render({ '/goals': [{ body: goal() }, { body: goal() }] });
    await resultCard();

    expect(screen.queryByText(/logged rate/)).not.toBeInTheDocument();
    expect(screen.queryByText('% of contacted leads that become an appointment')).not.toBeInTheDocument();
    expect(screen.queryByText('💡')).not.toBeInTheDocument();
    // Both mockups draw the case size's ⓘ at every size (UI V1).
    const tip = screen.getByRole('button', { name: 'APE per closing. Increase if one appointment often yields multiple policies.' });
    expect(tip.closest('.md\\:hidden')).toBeNull();
    await save();
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PUT')).toBe(true));
    expect(calls.filter((c) => c.url.includes('/history'))).toHaveLength(0);
  });

  it('P18.95-T5 AC-7 the two ways to set it share the track on a phone, their words wrapping', async () => {
    render({ '/goals': { body: goal() } });
    const list = await screen.findByRole('tablist', { name: 'How you want to set it' });
    for (const tab of within(list).getAllByRole('tab')) {
      for (const cls of SEGMENT_WRAP_PHONE.split(' ')) expect(tab).toHaveClass(cls);
    }
  });
});

describe('Goal Settings — the APE already produced, once the office holds production (P9-T6)', () => {
  const imported = (over: Record<string, unknown> = {}) => goal({
    apeAchievedMinor: 50_000_000_00,
    achieved: { minor: 120_000_000_00, provenance: 'imported', month: '2026-08' },
    projected: projection({ apeAchievedMinor: 120_000_000_00, remainingApeMinor: 380_000_000_00 }),
    ...over,
  });

  it('UI-020 P9-T6 the office’s figure wears the same pill, short and in normal ink, with no ✎ and no field: ⚡, and ⓘ says whose', async () => {
    render({ '/goals': { body: imported() } });
    await resultCard();

    const shown = screen.getByText('APE already produced this year').closest('dl')!;
    expect(shown.querySelector('dd')).toHaveTextContent(/^IDR 120M$/);
    expect(shown.querySelector('dd')).toHaveClass('h-12', 'rounded-pill', 'text-ink');
    expect(screen.queryByRole('textbox', { name: 'APE already produced this year' })).not.toBeInTheDocument();
    expect(shown.querySelector('[data-auto-marker]')).not.toBeNull();
    await userEvent.click(within(shown).getByRole('button', { name: 'Why APE already produced this year is automatic' }));
    expect(await screen.findByText('As of Aug 2026')).toBeInTheDocument();
  });

  it('says so when the office corrected it by hand', async () => {
    render({ '/goals': { body: imported({ achieved: { minor: 120_000_000_00, provenance: 'corrected', month: '2026-08' } }) } });
    await resultCard();

    await userEvent.click(screen.getByRole('button', { name: 'Why APE already produced this year is automatic' }));
    expect(await screen.findByText('Corrected by hand, year to date as of Aug 2026')).toBeInTheDocument();
  });

  it('keeps the typed figure on save, untouched — it is the agent’s own', async () => {
    const { calls } = render({ '/goals': [{ body: imported() }, { body: imported() }] });
    await resultCard();
    await save();

    await waitFor(() => expect(sent(calls, 'PUT')).toHaveLength(1));
    expect(sent(calls, 'PUT')[0].apeAchievedMinor).toBe(50_000_000_00);
  });
});

/**
 * **P18.98-T3: the screen's figures follow the reader's language** (AC-1, AC-3). Every spec above reads English, the
 * harness's default (ADR-0179 §9); an Indonesian reader sees the same figures in Indonesian, the field's prefix *Rp*.
 */
describe('P18.98-T3 Goal Settings in each language', () => {
  it('P18.98-T3 AC-3 in Indonesian: the sums in juta, a typed figure’s prefix Rp and its digits 120.000.000', async () => {
    stubFetch({ ...base, '/goals': { body: goal() } } as Parameters<typeof stubFetch>[0]);
    renderWithSession(<InLanguage language="id"><AgentLayout><GoalSettingsPage /></AgentLayout></InLanguage>, { me: AGENT });

    const produced = await screen.findByRole('textbox', { name: 'APE yang sudah dicapai tahun ini' });
    expect(screen.getByRole('slider', { name: 'Target APE tahunan' })).toHaveAttribute('aria-valuetext', 'Rp 500 jt');
    await userEvent.clear(produced);
    await userEvent.type(produced, '120000000');
    expect(produced).toHaveValue('120.000.000');
    expect(produced.previousElementSibling).toHaveTextContent('Rp');
    expect((await screen.findByText('Polis per minggu')).closest('[data-variant]')).toHaveTextContent('≈ 1,4');
  });

  it('P18.98-T3 AC-3 in English: the sums in millions, a typed figure’s prefix IDR and its digits 120,000,000', async () => {
    stubFetch({ ...base, '/goals': { body: goal() } } as Parameters<typeof stubFetch>[0]);
    renderWithSession(<InLanguage language="en"><AgentLayout><GoalSettingsPage /></AgentLayout></InLanguage>, { me: AGENT });

    const produced = await screen.findByRole('textbox', { name: 'APE already produced this year' });
    await userEvent.clear(produced);
    await userEvent.type(produced, '120000000');
    expect(produced).toHaveValue('120,000,000');
    expect(produced.previousElementSibling).toHaveTextContent('IDR');
  });
});
