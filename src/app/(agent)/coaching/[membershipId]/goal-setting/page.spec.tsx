import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { atWidth, makeMe, renderInLayout, routeParams, stubFetch, type StubResponse } from '@test/harness';
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

/** `POST /goals/:period/preview?for=` (P18.11-T5): the plan the tab's inputs would make, saved nowhere. */
const PREVIEW = 'POST /goals/2026/preview';
const previewed = (over: Record<string, unknown> = {}) => ({
  body: {
    period: '2026', monthsLeft: 3, monthsLeftIsOverride: false, achieved: { minor: 0, provenance: 'self_reported', month: null },
    projected: projection(), ...over,
  },
});

const show = (goals: StubResponse | StubResponse[] = { body: goal() }, me = LEADER, who: Record<string, unknown> = RINA) => {
  const stub = stubFetch({ ...SHELL, '/coaching/coachees/': { body: who }, '/goals/': goals, [PREVIEW]: previewed() });
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
    // UI-017: the report's sentence names no one, so a coachee's reads as the reader's own does.
    expect(screen.getByText(/^This month, APE/).closest('p')).toHaveTextContent(
      'This month, APE IDR 100M (on the way to IDR 500M this year): 67 Set appointment, 20 Sales meeting, 6 Submission polis.',
    );
    expect(screen.queryByText(/My commitment/)).not.toBeInTheDocument();
  });

  it('P11-T7 AC-5 carries the prototype’s footer, verbatim', async () => {
    show();
    expect(await screen.findByText(
      'Changes here update instantly in Personal Summary and Coaching Session — all three stay in sync.',
    )).toBeInTheDocument();
  });

  it('P11-T7 AC-5 saves her plan through PUT /goals/:period?for=, once, when Save is pressed', async () => {
    const { calls } = show([{ body: goal() }, { body: goal({ annualApeTargetMinor: 900_000_000_00 }) }]);
    fireEvent.change(await screen.findByRole('slider', { name: 'Annual APE target' }), { target: { value: '900000000' } });
    // P18.11-T5 UI-014: the result moves through the preview, about her, and nothing is saved yet.
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1));
    expect(calls.find((c) => c.init.method === 'POST')!.url).toBe('http://api.test/api/v1/goals/2026/preview?for=mem-rina');
    expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));

    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1));
    const put = calls.find((c) => c.init.method === 'PUT')!;
    expect(put.url).toBe('http://api.test/api/v1/goals/2026?for=mem-rina');
    expect(JSON.parse(String(put.init.body))).toMatchObject({ annualApeTargetMinor: 900_000_000_00 });
    /*
     * S1 (the T17–T20 permission review): the leader changed the target and not her APE produced, so the figure is left
     * out of the save — and of the preview — and the server keeps hers, a newer one she typed since this read included.
     */
    expect(JSON.parse(String(put.init.body))).not.toHaveProperty('apeAchievedMinor');
    expect(JSON.parse(String(calls.find((c) => c.init.method === 'POST')!.init.body))).not.toHaveProperty('apeAchievedMinor');
    await waitFor(() => expect(within(document.querySelector('[data-goal-aside]') as HTMLElement).getByRole('status'))
      .toHaveTextContent('Saved ✓'));
  });

  it('P18.11-T5 UI-015 on a phone the tab’s save floats above the tab bar, as /goals’ does', async () => {
    atWidth(375);
    show();
    await screen.findByRole('heading', { name: /What's their APE target this year\?/ });

    const pill = document.querySelector('[data-floating-save]') as HTMLElement;
    expect(pill).toContainElement(screen.getByRole('button', { name: 'Save goal' }));
    expect(within(pill).getByRole('status')).toHaveTextContent('Saved ✓');
  });

  it('P11-T7 AC-5 works on a read with no measured rates, and draws none (D-rates)', async () => {
    show();
    await screen.findByRole('button', { name: 'Save goal' });
    expect(screen.queryByText(/logged rate|measured/i)).not.toBeInTheDocument();
    // The same calculator as `/goals`, so the same screen: no 💡 tip since ADR-0160 §4 (P18.5-T10 AC-4).
    expect(screen.queryByText('Use your real conversion ratios for accuracy.')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Appointment to meeting' })).toBeInTheDocument();
  });

  it('P11-T7 AC-5 never tells the leader a goal was set by somebody else: that banner is the coachee’s own', async () => {
    show();
    await screen.findByRole('button', { name: 'Save goal' });
    expect(screen.queryByText('Set by your leader')).not.toBeInTheDocument();
  });

  /*
   * ADR-0183 (OD-242; the owner's staging review SR-07, P18.11-T17), partly reversing ADR-0075: while the office holds
   * no figure for her, her leader types her APE produced here, and the save stores it (`typedApeOf`).
   */
  it('ADR-0183, P19.1-T4 AC-1 her leader types her APE produced while the office holds none: tapping the pill focuses it, the figure selected', async () => {
    const { calls } = show([{ body: goal() }, { body: goal({ apeAchievedMinor: 75_000_000_00 }) }]);
    await screen.findByRole('button', { name: 'Save goal' });
    const field = screen.getByRole('textbox', { name: 'APE already produced this year' }) as HTMLInputElement;
    // The full figure since ADR-0230 §2, its currency mark beside it.
    expect(field).toHaveValue('0');
    expect(field.previousElementSibling).toHaveTextContent('IDR');
    // The whole pill is the target — no ✎ since UI-122 — and the figure is selected, so typing replaces it.
    const pill = field.closest('label')!;
    expect(pill).toHaveAttribute('for', field.id);
    expect(pill.querySelector('svg')).toBeNull();
    await userEvent.click(pill);
    expect(field).toHaveFocus();
    await waitFor(() => expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]));
    await userEvent.keyboard('75000000');
    expect(field).toHaveValue('75,000,000');
    // UI-020: an edit marks the plan unsaved.
    await waitFor(() => expect(within(document.querySelector('[data-goal-aside]') as HTMLElement).getByRole('status'))
      .toHaveTextContent('Not saved yet'));

    await userEvent.click(screen.getByRole('button', { name: 'Save goal' }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1));
    const put = calls.find((c) => c.init.method === 'PUT')!;
    expect(put.url).toBe('http://api.test/api/v1/goals/2026?for=mem-rina');
    expect(JSON.parse(String(put.init.body))).toMatchObject({ apeAchievedMinor: 75_000_000_00 });
  });

  it('P19.1-T4 AC-12, P19.8-T5 AC-5 the member’s own estimate, read by her coach, is labelled as hers', async () => {
    show([{ body: goal({ apeAchievedMinor: 120_000_000_00, achieved: { minor: 120_000_000_00, provenance: 'self_reported', month: null } }) }]);
    await screen.findByRole('button', { name: 'Save goal' });
    const field = screen.getByRole('textbox', { name: 'APE already produced this year' });
    expect(field).toHaveAccessibleDescription(/^(Her|Their|His) own estimate, not uploaded$/);
    expect(field).toHaveValue('120,000,000');
  });

  it('P19.8-T5 AC-5, AC-7 typed by her over an upload: her coach reads it plain, labelled hers — no field, nothing to put back', async () => {
    show([{ body: goal({
      apeAchievedMinor: 120_000_000_00,
      achieved: { minor: 120_000_000_00, provenance: 'self_reported', month: null },
      official: { minor: 67_000_000_00, provenance: 'imported', month: '2026-10' },
    }) }]);
    await screen.findByRole('button', { name: 'Save goal' });
    // ADR-0183, kept by ADR-0230 §7: the office holds a figure, so a coach types nothing over it.
    expect(screen.queryByRole('textbox', { name: 'APE already produced this year' })).not.toBeInTheDocument();
    const shown = screen.getByText('APE already produced this year').closest('dl')!;
    expect(shown.querySelector('dd')).toHaveTextContent(/^IDR 120,000,000$/);
    expect(shown.querySelector('[data-figure-line="estimate"]')).toHaveTextContent(/^(Her|Their|His) own estimate, not uploaded$/);
    expect(screen.queryByRole('button', { name: /^Use automatic/ })).not.toBeInTheDocument();
  });

  it('P11-T7 AC-5 an upload is hers and nobody’s to type: plain figures, no field, ⚡ and ⓘ, and no ADR-0084 six words', async () => {
    show({ body: goal({ achieved: { minor: 120_000_000_00, provenance: 'corrected', month: '2026-08' } }) });
    await screen.findByRole('button', { name: 'Save goal' });
    expect(screen.queryByRole('textbox', { name: 'APE already produced this year' })).not.toBeInTheDocument();
    // The staging review of 2026-10-31: no pill frame, so it no longer looks like a field.
    const figure = screen.getByText('APE already produced this year').closest('dl')!.querySelector('dd')!;
    expect(figure).toHaveAttribute('data-read-only');
    expect(figure.className).not.toMatch(/\b(rounded-pill|border-line|bg-card)\b/);
    // UI-020: the upload's figure is automatic, ⚡, and its ⓘ says whose.
    expect(await screen.findByRole('button', { name: 'Why APE already produced this year is automatic' }))
      .toHaveAccessibleDescription('Corrected after the production upload, year to date as of Aug 2026');
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
    expect(screen.getByRole('group', { name: 'Commission rate' })).toBeInTheDocument();
    expect(screen.getAllByText('% of APE that becomes income / savings').some((el) => el.tagName === 'P')).toBe(true);
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
