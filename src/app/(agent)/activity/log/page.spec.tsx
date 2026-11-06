import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { FLOATING_BAR_ROOM } from '@/components/ui/floating-bar';
import { PHONE_QUERY } from '@/lib/use-phone';
import { makeMe, renderInLayout, stubFetch, wears } from '@test/harness';
import LogActivityPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/activity/log',
}));

const AGENT = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent',
    status: 'active', isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['activity_log:read_raw', 'activity_log:create', 'activity_log:update',
    'activity_ratios:read'],
});

/** The office's own taxonomy — two sections, three types. The screen renders whatever this is. */
const TAXONOMY = [
  {
    id: 'c1', code: 'LEADS', label: 'Leads', description: 'Finding people to talk to.',
    appliesToOrgLevelCodes: [], displayOrder: 1, version: 1, status: 'active',
    types: [
      {
        id: 't1', code: 'LEADS_GEN_ACTIVITY', label: 'Melakukan aktivitas leads generation',
        categoryCode: 'LEADS', description: null, displayOrder: 1, version: 1, status: 'active',
      },
      {
        id: 't2', code: 'LEADS_CONTACTED', label: 'Set Appointment',
        categoryCode: 'LEADS', description: null, displayOrder: 2, version: 1, status: 'active',
      },
    ],
  },
  {
    id: 'c2', code: 'SELLING', label: 'Selling', description: null,
    appliesToOrgLevelCodes: [], displayOrder: 2, version: 1, status: 'active',
    types: [
      {
        id: 't3', code: 'SELL_SUBMISSION', label: 'Submission polis',
        categoryCode: 'SELLING', description: null, displayOrder: 1, version: 1, status: 'active',
      },
    ],
  },
];

const day = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-1',
  localDate: '2026-03-11',
  entries: [
    { activityTypeId: 't1', activityTypeCode: 'LEADS_GEN_ACTIVITY', label: 'Melakukan aktivitas leads generation', count: 0 },
    { activityTypeId: 't2', activityTypeCode: 'LEADS_CONTACTED', label: 'Set Appointment', count: 2 },
    { activityTypeId: 't3', activityTypeCode: 'SELL_SUBMISSION', label: 'Submission polis', count: 1 },
  ],
  totalCount: 3,
  version: 1,
  frozenAt: null,
  editable: true,
  correctionCount: 0,
  ...over,
});

/*
 * No `/activity/compliance` or `/activity/summary`: the screen stopped asking for them with the
 * standing card (P10.1-T5 AC-1), and `stubFetch` throws on a request it has no answer for.
 */
const base = {
  '/kpm/config': { body: { activity: TAXONOMY, ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
};

/** Below 768px, as `usePhone` reads it: the media query answers. jsdom has none, so a spec says so. */
const asPhone = () => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
  media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
})));

/** The five seeded sections, grouped as the seed groups them (ADR-0064). */
const SEEDED = [
  ['LEADS_GENERATION', 'Leads Generation', 'LEADS_GENERATION', 'Leads Generation', 'LEADS_CONTACTED'],
  ['SELLING', 'Selling', 'SELLING', 'Selling', 'SELL_SUBMISSION'],
  ['RECRUITMENT', 'Recruitment', 'RECRUITMENT', 'Recruitment', 'RECRUIT_NBO_PRESENTATION'],
  ['PERSONAL_DEVELOPMENT', 'Personal Development', 'DEVELOPMENT', 'Development', 'DEV_TRAINING'],
  ['TEAM_DEVELOPMENT', 'Team Development', 'DEVELOPMENT', 'Development', 'DEV_TEAM_ACTIVITY'],
].map(([code, label, summaryGroupCode, summaryGroupLabel, typeCode], i) => ({
  id: `c${i}`, code, label, description: null, appliesToOrgLevelCodes: [] as string[],
  displayOrder: i + 1, version: 1, status: 'active', summaryGroupCode, summaryGroupLabel,
  types: [{
    id: `t${i}`, code: typeCode, label: `Item ${i + 1}`, categoryCode: code, description: null,
    displayOrder: i + 1, version: 1, status: 'active',
  }],
}));

/**
 * **The save state, the bar's at every size** (P19.1-T1 AC-1, AC-2): *Saved ✓* or *Not saved yet* in the floating pill.
 * Until P19.1-T1 it was stacked under the date field from 768px, *Saved · 3 activities*.
 */
const saveStatus = () => document.querySelector('[data-action-bar] [role="status"]')!;

/** The day's saved count beside the date pill: *Today: 3 activities*, or another day named. */
const dayCount = () => screen.getByRole('button', { name: 'What is an activity?' }).closest('p')!;

/** The day the date pill shows, and the field behind it. */
const dayField = () => screen.getByLabelText('Choose the day');

/** The shell's toast region: the status region that is neither the save status nor a skeleton. */
const toastText = () => screen.queryAllByRole('status').map((r) => r.textContent).join(' | ');

describe('Log activity (P6-T2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  /*
   * *Changed 2026-11-04 (P19.1-T1 AC-1; UI-112):* the sub-line is drawn at no size — it showed from 768px.
   */
  it('P18.7-T7 AC-1, P19.1-T1 AC-1 draws the sub-line at no size, loading or not (grey text row 25; UI-112)', async () => {
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
    expect(screen.getByText("Enter today's activities in 1 minute.")).toHaveClass('max-md:hidden', 'md:hidden');
    await screen.findByRole('heading', { name: 'Leads' });
    expect(screen.getByText("Enter today's activities in 1 minute.")).toHaveClass('max-md:hidden', 'md:hidden');
  });

  it('renders the office’s own sections and types, not a hardcoded twelve', async () => {
    // The prototype groups its items by hardcoded id ranges, so an office that adds a
    // thirteenth has nowhere to put it. These two sections come from the office's config.
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    expect(await screen.findByRole('heading', { name: 'Leads' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Selling' })).toBeInTheDocument();
    expect(screen.getByLabelText('Count for Submission polis')).toHaveValue(1);
    expect(screen.getByLabelText('Count for Set Appointment')).toHaveValue(2);
  });

  it('P13.2-T6 AC-8: an office started Empty logs against the three cascade types, and nothing else', async () => {
    // ADR-0115 §2: every office has them, in their platform sections, whatever it started from.
    const three = [
      {
        id: 'c1', code: 'LEADS_GENERATION', label: 'Leads Generation', description: null,
        appliesToOrgLevelCodes: [], displayOrder: 1, version: 1, status: 'active',
        types: [{
          id: 't1', code: 'LEADS_CONTACTED', label: 'Set Appointment',
          categoryCode: 'LEADS_GENERATION', description: null, displayOrder: 1, version: 1, status: 'active',
        }],
      },
      {
        id: 'c2', code: 'SELLING', label: 'Selling', description: null,
        appliesToOrgLevelCodes: [], displayOrder: 2, version: 1, status: 'active',
        types: [
          {
            id: 't2', code: 'SELL_PRESENTATION', label: 'Melakukan presentasi penjualan untuk calon atau existing nasabah',
            categoryCode: 'SELLING', description: null, displayOrder: 2, version: 1, status: 'active',
          },
          {
            id: 't3', code: 'SELL_SUBMISSION', label: 'Submission polis',
            categoryCode: 'SELLING', description: null, displayOrder: 3, version: 1, status: 'active',
          },
        ],
      },
    ];
    stubFetch({
      '/kpm/config': { body: { activity: three, ratios: [], leadPipelines: [], version: 1 } },
      '/kpm/org-levels': { body: [] },
      '/activity/log': { body: day({ entries: [], totalCount: 0 }) },
    });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    expect(await screen.findByRole('heading', { name: 'Leads Generation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Selling' })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Count for /)).toHaveLength(3);
    expect(screen.queryByText(/has not set up its activity types/)).not.toBeInTheDocument();
  });

  it('takes the day from the server, never from the browser’s clock', async () => {
    // The prototype derives every date key with `toISOString()`, which for a Jakarta agent
    // before 07:00 is yesterday. The date input shows what the office says today is.
    stubFetch({ ...base, '/activity/log': { body: day({ localDate: '2026-03-11' }) } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    await screen.findByRole('heading', { name: 'Leads' });
    expect(dayField()).toHaveValue('2026-03-11');
  });

  it('sends the whole day, keyed by code', async () => {
    const { calls } = stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    const field = await screen.findByLabelText('Count for Submission polis');
    await userEvent.clear(field);
    await userEvent.type(field, '4');
    await userEvent.click(screen.getByRole('button', { name: 'Save activity' }));

    await waitFor(() => {
      const sent = calls.filter((c) => c.init?.method === 'PUT').at(-1);
      expect(JSON.parse(String(sent?.init?.body))).toMatchObject({
        date: '2026-03-11',
        counts: { SELL_SUBMISSION: 4, LEADS_CONTACTED: 2, LEADS_GEN_ACTIVITY: 0 },
      });
    });
  });

  it('never offers a way to say whose day it is', async () => {
    // §3.5: no role logs on another person's behalf. The body carries no subject, because
    // the route has no such parameter — the screen cannot invent one.
    const { calls } = stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    await userEvent.click(await screen.findByRole('button', { name: 'Save activity' }));

    await waitFor(() => {
      const sent = calls.filter((c) => c.init?.method === 'PUT').at(-1);
      expect(JSON.parse(String(sent?.init?.body))).not.toHaveProperty('membershipId');
    });
  });

  describe('P10.1-T5 AC-1: what the client asked to have removed', () => {
    it('AC-1: shows no Logged / Missed card, and asks for neither read behind it', async () => {
      const { calls } = stubFetch({ ...base, '/activity/log': { body: day() } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Leads' });

      expect(screen.queryByText('Logged')).toBeNull();
      expect(screen.queryByText('Missed')).toBeNull();
      expect(screen.queryByText(/of the last 7 days/)).toBeNull();
      expect(calls.some((c) => c.url.includes('/activity/compliance'))).toBe(false);
      expect(calls.some((c) => c.url.includes('/activity/summary'))).toBe(false);
    });

    it('AC-1: shows no day-status card, on an open day or a closed one', async () => {
      stubFetch({ ...base, '/activity/log': { body: day({ correctionCount: 2 }) } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Leads' });

      expect(screen.queryByText('Open')).toBeNull();
      expect(screen.queryByText('Closed for editing')).toBeNull();
      // A corrected day that is open again says nothing: the log is where it is corrected.
      expect(screen.queryByText(/corrected/i)).toBeNull();
    });

    it('AC-1: shows no section description, only the prototype’s heading and count', async () => {
      stubFetch({ ...base, '/activity/log': { body: day() } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Leads' });

      expect(screen.queryByText('Finding people to talk to.')).toBeNull();
      expect(screen.getByText('2 items')).toBeInTheDocument();
    });
  });

  describe('a day whose window has closed', () => {
    const frozen = day({ editable: false, frozenAt: '2026-03-08T00:00:00Z', correctionCount: 1 });

    it('AC-2: asks for a reason and offers a correction rather than a save', async () => {
      stubFetch({ ...base, '/activity/log': { body: frozen } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      expect(await screen.findByLabelText('Why is this being corrected?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save the correction' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save activity' })).toBeNull();
    });

    it('AC-2: is one field with no card around it', async () => {
      stubFetch({ ...base, '/activity/log': { body: frozen } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      const field = await screen.findByLabelText('Why is this being corrected?');
      // `Card` and `SectionCard` are both `rounded-lg` with a hairline: neither holds the field.
      expect(field.closest('.rounded-lg')).toBeNull();
      expect(screen.getAllByRole('textbox')).toHaveLength(1);
    });

    it('AC-2: offers nothing on a closed day that was never logged — the API would refuse both', async () => {
      // No entry to correct, and the window closed for a save: the day is shown, and nothing asked
      // of the reader that can only be refused (found walking P10.1-T5, 2026-10-01).
      const never = day({
        editable: false, frozenAt: null, version: 0, totalCount: 0, correctionCount: 0,
        entries: day().entries.map((e) => ({ ...e, count: 0 })),
      });
      stubFetch({ ...base, '/activity/log': { body: never } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      expect(await screen.findByText('This day is closed, and nothing was logged for it.')).toBeInTheDocument();
      expect(screen.queryByLabelText('Why is this being corrected?')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Save the correction' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Save activity' })).toBeNull();
      const steppers = screen.getAllByRole('button', { name: /^(Increase|Decrease) / });
      expect(steppers.length).toBeGreaterThan(0);
      for (const button of steppers) expect(button).toBeDisabled();
      for (const count of screen.getAllByLabelText(/^Count for /)) expect(count).toBeDisabled();
    });

    it('AC-2: marks the reason required, and caps it where the API does', async () => {
      stubFetch({ ...base, '/activity/log': { body: frozen } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      const field = await screen.findByLabelText('Why is this being corrected?');
      expect(field).toBeRequired();
      expect(field).toHaveAttribute('maxLength', '500');
    });

    it('AC-2: shows no field on an open day', async () => {
      stubFetch({ ...base, '/activity/log': { body: day({ correctionCount: 1 }) } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Leads' });

      expect(screen.queryByLabelText('Why is this being corrected?')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Save the correction' })).toBeNull();
    });

    it('AC-2: says in the field’s hint that the day is closed, and nothing more when uncorrected', async () => {
      stubFetch({ ...base, '/activity/log': { body: { ...frozen, correctionCount: 0 } } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      const field = await screen.findByLabelText('Why is this being corrected?');
      expect(field).toHaveAccessibleDescription('This day is closed.');
    });

    it('keeps the correction button disabled until there is a reason', async () => {
      stubFetch({ ...base, '/activity/log': { body: frozen } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      const save = await screen.findByRole('button', { name: 'Save the correction' });
      expect(save).toBeDisabled();

      await userEvent.type(screen.getByLabelText('Why is this being corrected?'), 'Wrong day.');
      expect(save).toBeEnabled();
    });

    it('AC-2: says in the same sentence how many times it has been corrected', async () => {
      // ADR-0042: a screen showing a corrected record says so. One sentence, in the hint.
      stubFetch({ ...base, '/activity/log': { body: frozen } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      expect(await screen.findByLabelText('Why is this being corrected?'))
        .toHaveAccessibleDescription('This day is closed, and has been corrected once.');
    });

    it('AC-2: counts past one', async () => {
      stubFetch({ ...base, '/activity/log': { body: { ...frozen, correctionCount: 3 } } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      expect(await screen.findByLabelText('Why is this being corrected?'))
        .toHaveAccessibleDescription('This day is closed, and has been corrected 3 times.');
    });

    it('AC-2: sends the reason with the counts', async () => {
      const { calls } = stubFetch({ ...base, '/activity/log': { body: frozen } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      await userEvent.type(await screen.findByLabelText('Why is this being corrected?'), '  Wrong day. ');
      await userEvent.click(screen.getByRole('button', { name: 'Save the correction' }));

      await waitFor(() => {
        const sent = calls.find((c) => c.url.includes('/activity/log/correction'));
        expect(JSON.parse(String(sent?.init?.body))).toMatchObject({
          date: '2026-03-11', reason: 'Wrong day.', counts: { LEADS_CONTACTED: 2 },
        });
      });
    });
  });

  it('hides a section this rung is not shown (ADR-0020, P4-T18)', async () => {
    /*
     * `tenant-config.md`: every member receives the same rows and the same rule, and the client
     * hides what does not apply to the reader. Found missing at the Phase 6 exit review — the
     * screen showed every active section to everybody, and an office that had narrowed one was
     * offering rows its agents could not log.
     */
    const narrowed = [
      TAXONOMY[0],
      { ...TAXONOMY[1], appliesToOrgLevelCodes: ['AB'] },
    ];
    stubFetch({
      ...base,
      '/kpm/config': { body: { activity: narrowed, ratios: [], leadPipelines: [], version: 1 } },
      '/activity/log': { body: day() },
    });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    expect(await screen.findByRole('heading', { name: 'Leads' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Selling' })).toBeNull();
    expect(screen.queryByLabelText('Submission polis')).toBeNull();
  });

  it('shows it to a rung that is named', async () => {
    const narrowed = [
      TAXONOMY[0],
      { ...TAXONOMY[1], appliesToOrgLevelCodes: ['AB'] },
    ];
    const leader = makeMe({
      membership: {
        membershipId: 'mem-2', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
        status: 'active', isKpmOwner: false, isKpmAdmin: false, directCount: 2,
      },
      permissions: ['activity_log:read_raw', 'activity_log:create'],
    });
    stubFetch({
      ...base,
      '/kpm/config': { body: { activity: narrowed, ratios: [], leadPipelines: [], version: 1 } },
      '/activity/log': { body: day() },
    });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: leader });

    expect(await screen.findByRole('heading', { name: 'Selling' })).toBeInTheDocument();
  });

  it('AC-10: says what to do when the office has no activity types yet, and draws no count', async () => {
    stubFetch({
      ...base,
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/activity/log': { body: day({ entries: [], totalCount: 0 }) },
    });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    expect(await screen.findByText(/has not set up its activity types yet/)).toBeInTheDocument();
    expect(screen.queryByText('Total activities today')).toBeNull();
    expect(screen.queryByText(/^Today:/)).toBeNull();
  });

  it('shows the server’s refusal rather than swallowing it', async () => {
    stubFetch({
      ...base,
      '/activity/log': { status: 400, body: { error: { code: 'VALIDATION_FAILED', message: '2026-03-12 has not happened yet in this office.' } } },
    });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    expect(await screen.findByText(/has not happened yet/)).toBeInTheDocument();
  });
  it('AC-7: reaches the other two views of the same data, in the prototype’s words (L-32)', async () => {
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    // `Overall.html:2712-2716`: Log Activity · Dashboard · Ratio.
    const tabs = await screen.findByRole('navigation', { name: 'Activity management' });
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent))
      .toEqual(['Log Activity', 'Dashboard', 'Ratio']);
    expect(within(tabs).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/activity/dashboard');
    expect(within(tabs).getByRole('link', { name: 'Ratio' })).toHaveAttribute('href', '/activity/ratio');
    // The one you are on says so, rather than only looking different.
    expect(within(tabs).getByRole('link', { name: 'Log Activity' })).toHaveAttribute('aria-current', 'page');
  });

  /*
   * **Was AC-4** — *counts each tile and totals the day, live as you step*. Since P19.1-T1 (UI-113,
   * `activity-tablet-desktop`) a tablet and a laptop draw the phone's log: the day as saved beside the date pill, and the
   * taps not yet saved counted in the bar.
   */
  it('P19.1-T1 AC-2 counts the day as saved beside the date, and the new taps in the bar, live as you step', async () => {
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    await screen.findByRole('heading', { name: 'Leads' });
    expect(dayCount()).toHaveTextContent('Today: 3 activities');
    await userEvent.click(screen.getByLabelText('Increase Submission polis'));
    expect(dayCount()).toHaveTextContent('Today: 3 activities');
    const bar = document.querySelector('[data-action-bar]')!;
    expect(bar).toHaveTextContent('Not saved yet');
    expect(bar).toHaveTextContent('1 new activity');
  });

  /*
   * **Was P10.1-T5 AC-3, AC-4** — *the strip is the prototype's, grouped by the office* — and **P18.7-T5 AC-2**, *the
   * tiles are the sections below them, one each*. Since P19.1-T1 (UI-113, `activity-tablet-desktop`) a tablet and a
   * laptop draw no strip: the phone's cards, in two columns, are the groups.
   */
  describe('P19.1-T1 AC-2: the groups in two columns from 768px, the phone’s cards', () => {
    const seededDay = day({
      entries: SEEDED.map((c, i) => ({
        activityTypeId: `t${i}`, activityTypeCode: c.types[0].code, label: c.types[0].label, count: i + 1,
      })),
      totalCount: 15,
    });
    const seeded = (activity: unknown) => stubFetch({
      ...base,
      '/kpm/config': { body: { activity, ratios: [], leadPipelines: [], version: 1 } },
      '/activity/log': { body: seededDay },
    });

    it('P19.1-T1 AC-2 the seed’s five groups fill two columns, down the first and then the second, each card whole', async () => {
      seeded(SEEDED);
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Team Development' });
      const flow = document.querySelector('[data-column-flow]')!;
      expect(flow.className).toContain('md:columns-2');
      const cards = Array.from(flow.querySelectorAll('section[data-phone-section]'));
      expect(cards.map((c) => c.querySelector('h2')!.textContent)).toEqual([
        'Leads Generation', 'Selling', 'Recruitment', 'Personal Development', 'Team Development',
      ]);
      // The phone's card; the column's gap stands in for its 8px above, so the two columns' tops line up.
      for (const card of cards) expect(card).toHaveClass('mt-0', 'rounded-lg', 'bg-card');
      for (const wrapper of Array.from(flow.children)) expect(wrapper.className).toContain('md:break-inside-avoid');
      // No strip of tiles from 768px (the approved mockup draws none).
      expect(screen.queryByText('Total activities today')).not.toBeInTheDocument();
    });

    it('P18.7-T5 AC-2 a section reordered moves its card', async () => {
      seeded(SEEDED.map((c) => (c.code === 'TEAM_DEVELOPMENT' ? { ...c, displayOrder: 0 } : c)));
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Team Development' });
      expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('Team Development');
    });

    it('P18.7-T5 AC-2 a section hidden from this rung has no card', async () => {
      seeded(SEEDED.map((c) => (c.code === 'TEAM_DEVELOPMENT' ? { ...c, appliesToOrgLevelCodes: ['AB'] } : c)));
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Personal Development' });
      expect(screen.queryByRole('heading', { name: 'Team Development' })).not.toBeInTheDocument();
    });
  });

  /*
   * **Was P18.7-T5 AC-1** — *on a phone, one line and a bar fixed to the bottom*. UI V1 redraws the phone (UI-106, D-03):
   * the segmented views, the date pill with the day's saved count, a row per activity with − n + beside its name, and
   * the save bar held above the tab bar. From 768px nothing changes.
   */
  describe('UI-106: Log Activity on a phone', () => {
    const phoneDay = () => {
      asPhone();
      stubFetch({
        ...base,
        '/activity/log': { body: day() },
        '/activity/log?date=2026-03-10': { body: day({
          localDate: '2026-03-10', totalCount: 1,
          entries: day().entries.map((e) => ({ ...e, count: e.activityTypeCode === 'SELL_SUBMISSION' ? 1 : 0 })),
        }) },
      });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
    };

    it('UI-106 titles the page Activity, the three views one segmented control, and no strip', async () => {
      phoneDay();
      await screen.findByRole('heading', { name: 'Leads' });
      expect(screen.getByRole('heading', { level: 1, name: 'Activity' })).toBeInTheDocument();
      const views = screen.getByRole('navigation', { name: 'Activity management' });
      expect(views).toHaveAttribute('data-segmented');
      expect(within(views).getAllByRole('link').map((a) => a.textContent)).toEqual(['Log Activity', 'Dashboard', 'Ratio']);
      expect(within(views).getByRole('link', { name: 'Log Activity' })).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByText('Total activities today')).not.toBeInTheDocument();
      // The date is the pill's now, not the title row's.
      expect(screen.queryByLabelText('Date')).not.toBeInTheDocument();
    });

    it('UI-106 says Today: n activities beside the date pill — the day as saved, never sentuhan — with its ⓘ', async () => {
      phoneDay();
      await screen.findByRole('heading', { name: 'Leads' });
      const line = screen.getByText(/^Today:/).closest('p')!;
      expect(line).toHaveTextContent('Today: 3 activities');
      expect(within(line).getByRole('button', { name: 'What is an activity?' })).toBeInTheDocument();
      // A tap is not saved yet: the line keeps the saved day, the bar counts the new one.
      await userEvent.click(screen.getByLabelText('Increase Submission polis'));
      expect(line).toHaveTextContent('Today: 3 activities');
      const bar = document.querySelector('[data-action-bar]')!;
      expect(bar).toHaveTextContent('Not saved yet');
      expect(bar).toHaveTextContent('1 new activity');
    });

    it('UI-106 steps a day back from the pill, names that day, and holds › on today', async () => {
      phoneDay();
      await screen.findByRole('heading', { name: 'Leads' });
      const pill = document.querySelector('[data-day-pill]') as HTMLElement;
      expect(within(pill).getByRole('button', { name: 'Next day' })).toBeDisabled();
      expect(within(pill).getByLabelText('Choose the day')).toHaveValue('2026-03-11');
      await userEvent.click(within(pill).getByRole('button', { name: 'Previous day' }));
      await waitFor(() => expect(screen.getByText(/^10 Mar 2026:/).closest('p')).toHaveTextContent('10 Mar 2026: 1 activity'));
      expect(within(pill).getByRole('button', { name: 'Next day' })).toBeEnabled();
    });

    it('UI-106 draws each activity as one row: the name left, two lines at most, − n + on the right, no item number', async () => {
      phoneDay();
      await screen.findByRole('heading', { name: 'Leads' });
      const row = screen.getByText('Submission polis').closest('li')!;
      expect(row.querySelector('[data-activity-name]')).toHaveClass('line-clamp-2');
      const counter = within(row).getByRole('group', { name: 'Submission polis' });
      expect(within(counter).getByLabelText('Count for Submission polis')).toHaveValue(1);
      expect(within(counter).getByRole('button', { name: 'Decrease Submission polis' })).toBeInTheDocument();
      expect(within(counter).getByRole('button', { name: 'Increase Submission polis' })).toBeInTheDocument();
      // Each a 44px target around its 32px circle.
      expect(within(counter).getByRole('button', { name: 'Increase Submission polis' }).className).toContain('max-md:after:h-[max(100%,2.75rem)]');
      expect(row).toHaveClass('min-h-11');
      // No item numbers, and the section counts its items.
      expect(row).toHaveTextContent(/^Submission polis/);
      expect(screen.getByRole('heading', { name: 'Selling' }).parentElement).toHaveTextContent('Selling1 item');
    });

    it('UI-106 holds the save bar just above the tab bar at every scroll position, with Cancel and Save activity', async () => {
      phoneDay();
      await screen.findByRole('heading', { name: 'Leads' });
      const save = screen.getByRole('button', { name: 'Save activity' });
      const bar = save.closest('[data-floating-bar]') as HTMLElement;
      expect(bar).toHaveAttribute('data-action-bar');
      expect(save).toHaveClass('bg-primary', 'text-primary-contrast');
      expect(bar).toContainElement(screen.getByRole('button', { name: 'Cancel' }));
      // One save status on the screen, in the bar.
      const statuses = screen.getAllByRole('status').filter((r) => /saved/i.test(r.textContent ?? ''));
      expect(statuses).toHaveLength(1);
      expect(bar).toContainElement(statuses[0]);
      expect(statuses[0]).toHaveTextContent('Saved ✓');
      // Room under the cards, so the last row is never behind the bar: the floating bar's one room class.
      expect(screen.getByRole('heading', { name: 'Selling' }).closest('section')!.parentElement).toHaveClass(FLOATING_BAR_ROOM);
    });

    /*
     * **Goal Setting's pill, not a full-width strip** (the product owner's staging review, 2026-10-31: *"semua floating
     * tambahan itu bisa buat modelan kayak goal setting gini"*): 12px from the sides, 12px over the tab bar, round-ended,
     * the save the pill's 44px accent button.
     */
    it('UI-106 the save bar is the floating bar: the Goal Setting pill’s form, not the full-width strip', async () => {
      phoneDay();
      await screen.findByRole('heading', { name: 'Leads' });
      const save = screen.getByRole('button', { name: 'Save activity' });
      const bar = save.closest('[data-floating-bar]') as HTMLElement;
      expect(bar).toHaveClass('fixed', 'inset-x-3', 'bottom-[max(calc(var(--tab-bar-space)+0.75rem),calc(env(safe-area-inset-bottom)+0.75rem))]');
      expect(bar.className).not.toMatch(/inset-x-0|border-t/);
      const pill = save.parentElement!;
      expect(pill).toHaveAttribute('data-floating-bar-pill');
      expect(pill).toHaveClass('rounded-pill', 'bg-card', 'shadow-modal');
      expect(save).toHaveClass('min-h-11', 'rounded-pill', 'font-bold');
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('min-h-11', 'rounded-pill');
    });

    it('P19.1-T1 AC-7 a phone draws the log as UI-106 drew it: no control row, no columns, the views over the date row', async () => {
      phoneDay();
      await screen.findByRole('heading', { name: 'Leads' });
      expect(document.querySelector('[data-control-row]')).toBeNull();
      expect(document.querySelector('[data-column-flow]')).toBeNull();
      const views = screen.getByRole('navigation', { name: 'Activity management' });
      const pill = document.querySelector('[data-day-pill]') as HTMLElement;
      expect(views.compareDocumentPosition(pill) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(views).not.toContainElement(pill);
      // The phone's cards keep their 8px above, one column under the date row.
      for (const card of document.querySelectorAll('section[data-phone-section]')) expect(card).toHaveClass('mt-2');
      expect(wears(views, 375).split(' ')).toEqual(['mb-2.5', 'flex', 'rounded-pill', 'bg-card', 'p-[3px]']);
    });

    it('UI-106 keeps a closed day’s reason above the bar, and a closed day never logged has no bar', async () => {
      asPhone();
      stubFetch({ ...base, '/activity/log': { body: day({ editable: false, frozenAt: '2026-03-08T00:00:00Z' }) } });
      const { unmount } = renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      const reason = await screen.findByLabelText('Why is this being corrected?');
      expect(reason.closest('.max-w-xl')).toHaveClass(FLOATING_BAR_ROOM);
      expect(screen.getByRole('button', { name: 'Save the correction' }).closest('[data-floating-bar]')).toHaveAttribute('data-action-bar');
      unmount();

      stubFetch({ ...base, '/activity/log': { body: day({
        editable: false, frozenAt: '2026-03-08T00:00:00Z', version: 0, totalCount: 0,
      }) } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByText('This day is closed, and nothing was logged for it.');
      expect(document.querySelector('[data-action-bar]')).toBeNull();
    });

  });

  /*
   * **Was P18.7-T5 AC-1, *from 768px, as before*** — the status under the date, the bar a row of two buttons. Since
   * P19.1-T1 (UI-112, UI-113, `activity-tablet-desktop`) a tablet and a laptop draw the phone's log in two columns.
   */
  describe('P19.1-T1 from 768px: the phone’s log, in more columns (UI-112, UI-113)', () => {
    it('P19.1-T1 AC-1 one control row: the views, the date pill and Today: n — no Tanggal label, nothing stacked under the date', async () => {
      stubFetch({ ...base, '/activity/log': { body: day() } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Leads' });

      const row = document.querySelector('[data-control-row]') as HTMLElement;
      expect(row).toHaveClass('flex', 'items-center');
      const views = within(row).getByRole('navigation', { name: 'Activity management' });
      expect(views).toHaveAttribute('data-segmented');
      expect(row).toContainElement(document.querySelector('[data-day-pill]') as HTMLElement);
      expect(row).toContainElement(dayCount());
      expect(dayCount()).toHaveTextContent('Today: 3 activities');
      // No *Date* field with its label, and the save state is the bar's, not stacked under the date.
      expect(screen.queryByLabelText('Date')).not.toBeInTheDocument();
      expect(screen.queryByText('Date')).not.toBeInTheDocument();
      expect(row).not.toContainElement(saveStatus() as HTMLElement);
      // The title row holds the title and the avatar; the date is not beside the title any more.
      const title = screen.getByRole('heading', { level: 1, name: 'Activity' });
      expect(title.closest('[data-title-row]')).not.toContainElement(dayField());
    });

    it('P19.1-T1 AC-2 the save pill floats above the tab bar on a tablet and stands under the lists from 1024px', async () => {
      stubFetch({ ...base, '/activity/log': { body: day() } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Leads' });

      const save = screen.getByRole('button', { name: 'Save activity' });
      const bar = save.closest('[data-floating-bar]') as HTMLElement;
      expect(bar).toHaveAttribute('data-action-bar');
      expect(wears(bar, 768).split(' ')).toContain('fixed');
      expect(wears(bar, 768).split(' ')).not.toContain('static');
      expect(wears(bar, 1024).split(' ')).toContain('static');
      expect(wears(bar, 1024).split(' ')).not.toContain('hidden');
      expect(save).toHaveClass('bg-primary', 'text-primary-contrast', 'rounded-pill');
      expect(bar).toContainElement(screen.getByRole('button', { name: 'Cancel' }));
      expect(bar).toContainElement(saveStatus() as HTMLElement);
      expect(saveStatus()).toHaveTextContent('Saved ✓');
      // Room under the cards on a tablet, where the pill floats over the page's foot.
      expect(document.querySelector('[data-column-flow]')).toHaveClass(FLOATING_BAR_ROOM);
    });
  });

  describe('P18.7-T5 AC-3: the skeleton goes once the reads have answered', () => {
    it('P18.7-T5 AC-3: draws the day as soon as the configuration and the day answer — the ladder still on its way', async () => {
      // The log waited for `/kpm/org-levels` too, which it never draws: the provider's two reads were one.
      const { mock } = stubFetch({ ...base, '/activity/log': { body: day() } });
      vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => (
        url.includes('/kpm/org-levels') ? new Promise(() => {}) : mock(url, init))));
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      expect(await screen.findByRole('heading', { name: 'Leads' })).toBeInTheDocument();
      expect(screen.queryByText('Loading your day…')).not.toBeInTheDocument();
    });

    it('P18.7-T5 AC-3: draws an empty day — never logged, every count zero — once it answers', async () => {
      stubFetch({ ...base, '/activity/log': { body: day({
        version: 0, totalCount: 0, entries: day().entries.map((e) => ({ ...e, count: 0 })),
      }) } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      expect(await screen.findByRole('heading', { name: 'Leads' })).toBeInTheDocument();
      expect(screen.queryByText('Loading your day…')).not.toBeInTheDocument();
      expect(saveStatus()).toHaveTextContent('Not saved yet');
    });

    it('P18.7-T5 AC-3: a configuration that failed says so, and never that the office has nothing set up', async () => {
      stubFetch({
        ...base,
        '/kpm/config': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r' } } },
        '/activity/log': { body: day() },
      });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
      expect(screen.queryByText('Loading your day…')).not.toBeInTheDocument();
      expect(screen.queryByText(/has not set up its activity types/)).not.toBeInTheDocument();
    });
  });

  it('counts with buttons, not by typing a number', async () => {
    // The control an agent taps a dozen times a day on a phone (`Overall.html:129-145`).
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    await screen.findByRole('heading', { name: 'Leads' });
    expect(screen.getByLabelText('Increase Submission polis')).toBeInTheDocument();
    expect(screen.getByLabelText('Decrease Submission polis')).toBeInTheDocument();
  });

  it('counts the items in each card', async () => {
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    await screen.findByRole('heading', { name: 'Leads' });
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  /* *Changed 2026-11-04 (P19.1-T1 AC-2; `activity-tablet-desktop`: *examples behind ⓘ*):* under the name until then. */
  it('P19.1-T1 AC-2 puts an activity’s own description behind the ⓘ beside its name', async () => {
    const described = TAXONOMY.map((c) => ({
      ...c,
      types: c.types.map((ty) => (
        ty.code === 'SELL_SUBMISSION'
          ? { ...ty, description: 'Berkas lengkap masuk ke sistem.' }
          : ty
      )),
    }));
    stubFetch({
      ...base,
      '/kpm/config': { body: { activity: described, ratios: [], leadPipelines: [], version: 1 } },
      '/activity/log': { body: day() },
    });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    const glyph = await screen.findByRole('button', { name: 'Berkas lengkap masuk ke sistem.' });
    expect(glyph.closest('li')).toHaveTextContent(/^Submission polis/);
  });

  it('P18.5-T8 AC-1 centres every row, with a description and without, and gives a description no line of its own', async () => {
    // ADR-0161 §3, the client's request of 2026-10-26: the prototype tops its rows (`flex-start`).
    const described = TAXONOMY.map((c) => ({
      ...c,
      types: c.types.map((ty) => (ty.code === 'LEADS_CONTACTED' ? { ...ty, description: 'telepon, WhatsApp, tatap muka, dll' } : ty)),
    }));
    stubFetch({
      ...base,
      '/kpm/config': { body: { activity: described, ratios: [], leadPipelines: [], version: 1 } },
      '/activity/log': { body: day() },
    });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    const row = (label: string) => screen.getByLabelText(`Count for ${label}`).closest('li')!;
    await screen.findByRole('button', { name: 'telepon, WhatsApp, tatap muka, dll' });
    for (const label of ['Set Appointment', 'Melakukan aktivitas leads generation', 'Submission polis']) {
      expect(row(label).className).toContain('items-center');
      expect(row(label).className).not.toContain('items-start');
    }
    // The description is behind its ⓘ on the name's line, never a second line under it (P19.1-T1 AC-2).
    expect(within(row('Set Appointment')).getByRole('button', { name: 'telepon, WhatsApp, tatap muka, dll' })).toBeInTheDocument();
    expect(within(row('Submission polis')).queryByRole('button', { name: /dll/ })).toBeNull();
  });

  describe('P10.1-T5 AC-8: the save status tells the truth', () => {
    const unsaved = (over: Record<string, unknown> = {}) => day({
      version: 0, totalCount: 0,
      entries: day().entries.map((e) => ({ ...e, count: 0 })),
      ...over,
    });

    it('P18.7-T1 AC-6: a save that lands says Activity logged ✓, the bar Saved ✓ and the day its new count', async () => {
      stubFetch({
        ...base,
        '/activity/log': [
          { body: unsaved() },
          { body: day({ version: 1, totalCount: 1, entries: unsaved().entries.map((e) => (
            e.activityTypeCode === 'SELL_SUBMISSION' ? { ...e, count: 1 } : e)) }) },
        ],
      });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      await userEvent.click(await screen.findByLabelText('Increase Submission polis'));
      expect(toastText()).not.toContain('Activity logged ✓');
      await userEvent.click(screen.getByRole('button', { name: 'Save activity' }));

      await waitFor(() => expect(toastText()).toContain('Activity logged ✓'));
      expect(saveStatus()).toHaveTextContent('Saved ✓');
      expect(dayCount()).toHaveTextContent('Today: 1 activity');
    });

    it('P18.7-T1 AC-6: a refused save toasts nothing, and its reason stays in the banner', async () => {
      stubFetch({
        ...base,
        '/activity/log': [
          { body: unsaved() },
          { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r' } } },
        ],
      });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      await userEvent.click(await screen.findByLabelText('Increase Submission polis'));
      await userEvent.click(screen.getByRole('button', { name: 'Save activity' }));

      expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
      expect(toastText()).not.toContain('Activity logged ✓');
      expect(saveStatus()).toHaveTextContent('Not saved yet');
    });

    it('P18.7-T1 AC-6: a correction of a closed day is the log’s save too, and says Activity logged ✓', async () => {
      const closed = day({ editable: false, frozenAt: '2026-03-08T00:00:00Z', correctionCount: 0 });
      stubFetch({
        ...base,
        '/activity/log': { body: closed },
        '/activity/log/correction': { body: { ...closed, correctionCount: 1 } },
      });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      await userEvent.type(await screen.findByLabelText('Why is this being corrected?'), 'Forgot one');
      await userEvent.click(screen.getByRole('button', { name: 'Save the correction' }));

      await waitFor(() => expect(toastText()).toContain('Activity logged ✓'));
    });

    it('AC-8: opens a saved day as saved, with the touches it was saved with', async () => {
      // It opened every day as *Not yet saved*: the status was a message Save set, and nothing
      // else ever did (`Overall.html:4937-4958` reads the day's own entry).
      stubFetch({ ...base, '/activity/log': { body: day({ totalCount: 3 }) } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      await screen.findByRole('heading', { name: 'Leads' });
      expect(saveStatus()).toHaveTextContent('Saved ✓');
      expect(dayCount()).toHaveTextContent('Today: 3 activities');
    });

    it('AC-8: opens a day with no entry as not yet saved', async () => {
      stubFetch({ ...base, '/activity/log': { body: unsaved() } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      await screen.findByRole('heading', { name: 'Leads' });
      expect(saveStatus()).toHaveTextContent('Not saved yet');
    });

    it('AC-8: saves, then reads Not yet saved on a date that has no entry', async () => {
      // A save's message followed the reader to the next date (`log/page.tsx:183-189`).
      stubFetch({
        ...base,
        '/activity/log': [
          { body: unsaved() },
          { body: day({ version: 1, totalCount: 1, entries: unsaved().entries.map((e) => (
            e.activityTypeCode === 'SELL_SUBMISSION' ? { ...e, count: 1 } : e)) }) },
        ],
        '/activity/log?date=2026-03-10': { body: unsaved({ localDate: '2026-03-10' }) },
      });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      await userEvent.click(await screen.findByLabelText('Increase Submission polis'));
      expect(saveStatus()).toHaveTextContent('Not saved yet');
      await userEvent.click(screen.getByRole('button', { name: 'Save activity' }));
      await waitFor(() => expect(saveStatus()).toHaveTextContent('Saved ✓'));

      await userEvent.click(screen.getByRole('button', { name: 'Previous day' }));
      await waitFor(() => expect(dayField()).toHaveValue('2026-03-10'));
      // The day named, never *today*, written as the app writes a day.
      expect(dayCount()).toHaveTextContent('10 Mar 2026: 0 activities');
      expect(saveStatus()).toHaveTextContent('Not saved yet');
    });

    it('AC-8: opens another saved day as saved, with that day’s touches', async () => {
      stubFetch({
        ...base,
        '/activity/log': { body: unsaved() },
        '/activity/log?date=2026-03-09': { body: day({ localDate: '2026-03-09', version: 2, totalCount: 7 }) },
      });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Leads' });

      fireEvent.change(dayField(), { target: { value: '2026-03-09' } });

      await waitFor(() => expect(dayCount()).toHaveTextContent('9 Mar 2026: 7 activities'));
      expect(saveStatus()).toHaveTextContent('Saved ✓');
    });

    /*
     * **Was AC-8, *sits under the date*, and P10.1-T8, *stands beside the title*.** Since P19.1-T1 (UI-112: *"Tanggal"
     * label + "Belum disimpan" stacked under the date* is the finding) the state is the bar's, one live region, and the
     * title row holds the title alone with the avatar — so the title sits where Dashboard's does by construction.
     */
    it('P19.1-T1 AC-1 one save state on the screen, the bar’s; the title row holds no date', async () => {
      stubFetch({ ...base, '/activity/log': { body: day() } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Leads' });

      const states = screen.getAllByRole('status').filter((r) => /saved/i.test(r.textContent ?? ''));
      expect(states).toEqual([saveStatus()]);
      const row = screen.getByRole('heading', { name: 'Activity', level: 1 }).closest('[data-title-row]') as HTMLElement;
      expect(row).not.toContainElement(saveStatus() as HTMLElement);
      expect(within(row).queryByRole('textbox')).toBeNull();
    });
  });

  it('AC-10: asks in the product’s own dialog before discarding a day’s typing', async () => {
    // It used to ask with `window.confirm`, whose buttons say OK and Cancel whatever the
    // question was, and which on a phone arrives as a system sheet over the app (I-95).
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    await userEvent.click(await screen.findByLabelText('Increase Submission polis'));
    await userEvent.click(screen.getByRole('button', { name: 'Previous day' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('You have unsaved counts');
    expect(screen.getByRole('button', { name: 'Discard counts' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument();
  });

  it('keeps what was typed when the discard is refused', async () => {
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    await userEvent.click(await screen.findByLabelText('Increase Submission polis'));
    expect(screen.getByLabelText('Count for Submission polis')).toHaveValue(2);

    await userEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    // Scoped to the dialog: the page has its own Cancel, which a modal makes unreachable.
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Count for Submission polis')).toHaveValue(2);
  });
});

describe('Log Activity — names and terms (P18.7-T9)', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Item 9 and item 12 in the seed's words: *Proses NPA*, and a note naming *JFW* — each twice over the screen. */
  const WORDED = [{
    ...TAXONOMY[0],
    types: [
      { ...TAXONOMY[0].types[0], code: 'RECRUIT_AGENT_CODE', label: 'Proses NPA', description: null },
      { ...TAXONOMY[0].types[1], code: 'DEV_TEAM_ACTIVITY', label: 'Aktivitas team development', description: '1-on-1 coaching, unit meeting, role-play, JFW, memberikan training' },
    ],
  }, {
    ...TAXONOMY[1],
    types: [{ ...TAXONOMY[1].types[0], label: 'Proses NPA lanjutan', description: 'JFW kedua' }],
  }];
  const worded = { ...base, '/kpm/config': { body: { activity: WORDED, ratios: [], leadPipelines: [], version: 1 } } };

  /* *Changed 2026-11-04 (P19.1-T1 AC-1; UI-112: each page's title is its phone title):* it was *Activity Management*. */
  it('P18.7-T9 AC-2, P19.1-T1 AC-1 is titled Activity, the tab bar’s word, over the Log Activity view', async () => {
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
    expect(await screen.findByRole('heading', { level: 1, name: 'Activity' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Activity Management' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Log Activity' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log Activity' })).toHaveAttribute('aria-current', 'page');
  });

  it('P18.7-T9 AC-3, UI-106 says what an activity counts once, beside the day’s count, in the one-line definition', async () => {
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
    await screen.findByRole('heading', { name: 'Leads' });
    const tips = screen.getAllByRole('button', { name: 'What is an activity?' });
    // Beside *Today: n activities* at every size since P19.1-T1 (it was the strip's total from 768px).
    expect(tips).toHaveLength(1);
    expect(tips[0].closest('[data-control-row]')).not.toBeNull();
    expect(tips[0]).toHaveAccessibleDescription('One activity is one count you log: each one you add on Log Activity counts once.');
  });

  it('P18.7-T9 AC-3 gives a term in the office’s words an ⓘ the first time it appears, and only then', async () => {
    stubFetch({ ...worded, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
    await screen.findByRole('heading', { name: 'Leads' });
    const npa = screen.getAllByRole('button', { name: 'What is NPA?' });
    expect(npa).toHaveLength(1);
    expect(npa[0].closest('[data-activity-name]')).toHaveTextContent(/^Proses NPA ⓘ/);
    // A term inside the office's examples is read in them, behind the row's ⓘ (P19.1-T1 AC-2, as on a phone).
    expect(screen.getByRole('button', { name: '1-on-1 coaching, unit meeting, role-play, JFW, memberikan training' }))
      .toBeInTheDocument();
    // The label is still the office's, whole: the stepper is named by it.
    expect(screen.getByLabelText('Increase Proses NPA')).toBeInTheDocument();
  });
});
