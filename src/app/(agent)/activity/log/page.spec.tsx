import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
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
        id: 't2', code: 'LEADS_CONTACTED', label: 'Menghubungi prospek yang sudah ada',
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
    { activityTypeId: 't2', activityTypeCode: 'LEADS_CONTACTED', label: 'Menghubungi prospek yang sudah ada', count: 2 },
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

/** The strip's tiles, label and value each, read off the page. */
function strip() {
  const row = screen.getByText(/^Total touches/).closest('[data-total]')!.parentElement!;
  return [...row.children].map((tile) => [tile.children[0].textContent, tile.children[1].textContent]);
}

describe('Log activity (P6-T2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders the office’s own sections and types, not a hardcoded twelve', async () => {
    // The prototype groups its items by hardcoded id ranges, so an office that adds a
    // thirteenth has nowhere to put it. These two sections come from the office's config.
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    expect(await screen.findByRole('heading', { name: 'Leads' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Selling' })).toBeInTheDocument();
    expect(screen.getByLabelText('Count for Submission polis')).toHaveValue(1);
    expect(screen.getByLabelText('Count for Menghubungi prospek yang sudah ada')).toHaveValue(2);
  });

  it('P13.2-T6 AC-8: an office started Empty logs against the three cascade types, and nothing else', async () => {
    // ADR-0115 §2: every office has them, in their platform sections, whatever it started from.
    const three = [
      {
        id: 'c1', code: 'LEADS_GENERATION', label: 'Leads Generation', description: null,
        appliesToOrgLevelCodes: [], displayOrder: 1, version: 1, status: 'active',
        types: [{
          id: 't1', code: 'LEADS_CONTACTED', label: 'Menghubungi prospek yang sudah ada',
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

    expect(await screen.findByLabelText('Date')).toHaveValue('2026-03-11');
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

  it('AC-10: says what to do when the office has no activity types yet, and draws no strip', async () => {
    stubFetch({
      ...base,
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/activity/log': { body: day({ entries: [], totalCount: 0 }) },
    });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    expect(await screen.findByText(/has not set up its activity types yet/)).toBeInTheDocument();
    expect(screen.queryByText('Total touches today')).toBeNull();
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

  it('AC-4: counts each tile and totals the day, live as you step', async () => {
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    // Neither section names a tile, so each has its own. Leads: 0 + 2. Selling: 1. Total: 3.
    await screen.findByRole('heading', { name: 'Leads' });
    expect(strip()).toEqual([['Leads', '2'], ['Selling', '1'], ['Total touches today', '3']]);

    await userEvent.click(screen.getByLabelText('Increase Submission polis'));
    expect(strip()).toEqual([['Leads', '2'], ['Selling', '2'], ['Total touches today', '4']]);
  });

  describe('P10.1-T5 AC-3, AC-4: the strip is the prototype’s, grouped by the office', () => {
    const seededDay = day({
      entries: SEEDED.map((c, i) => ({
        activityTypeId: `t${i}`, activityTypeCode: c.types[0].code, label: c.types[0].label, count: i + 1,
      })),
      totalCount: 15,
    });

    it('AC-3: the seed draws Leads Generation, Selling, Recruitment, Development and the total', async () => {
      stubFetch({
        ...base,
        '/kpm/config': { body: { activity: SEEDED, ratios: [], leadPipelines: [], version: 1 } },
        '/activity/log': { body: seededDay },
      });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Team Development' });

      // Development is Personal (4) and Team (5): the office's grouping, not a hardcoded merge.
      expect(strip()).toEqual([
        ['Leads Generation', '1'], ['Selling', '2'], ['Recruitment', '3'], ['Development', '9'],
        ['Total touches today', '15'],
      ]);
      // The sections below the strip do not change (I-97): five cards, as before.
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(5);
    });

    it('AC-3: the total is a white card whose number is amber-deep, with no tint (F-71)', async () => {
      stubFetch({
        ...base,
        '/kpm/config': { body: { activity: SEEDED, ratios: [], leadPipelines: [], version: 1 } },
        '/activity/log': { body: seededDay },
      });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Team Development' });

      const total = screen.getByText('Total touches today').closest('[data-total]')!;
      expect(total).toHaveClass('bg-card', 'rounded-lg');
      expect(total.className).not.toMatch(/amber/);
      expect(total.children[1]).toHaveClass('text-amber-deep', 'text-2xl');
      const plain = screen.getByText('Selling', { selector: 'span' }).parentElement!;
      expect(plain).toHaveClass('bg-card');
      expect(plain.children[1]).toHaveClass('text-navy');
    });

    it('AC-4: a section hidden from this rung drops out of its tile', async () => {
      const narrowed = SEEDED.map((c) => (c.code === 'TEAM_DEVELOPMENT'
        ? { ...c, appliesToOrgLevelCodes: ['AB'] }
        : c));
      stubFetch({
        ...base,
        '/kpm/config': { body: { activity: narrowed, ratios: [], leadPipelines: [], version: 1 } },
        '/activity/log': { body: seededDay },
      });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Personal Development' });

      expect(strip()[3]).toEqual(['Development', '4']);
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

  it('numbers each activity and counts the items in each card', async () => {
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    await screen.findByRole('heading', { name: 'Leads' });
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('shows an activity’s own description under its name', async () => {
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

    expect(await screen.findByText('Berkas lengkap masuk ke sistem.')).toBeInTheDocument();
  });

  describe('P10.1-T5 AC-8: the save status tells the truth', () => {
    const unsaved = (over: Record<string, unknown> = {}) => day({
      version: 0, totalCount: 0,
      entries: day().entries.map((e) => ({ ...e, count: 0 })),
      ...over,
    });

    it('AC-8: opens a saved day as saved, with the touches it was saved with', async () => {
      // It opened every day as *Not yet saved*: the status was a message Save set, and nothing
      // else ever did (`Overall.html:4937-4958` reads the day's own entry).
      stubFetch({ ...base, '/activity/log': { body: day({ totalCount: 3 }) } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      await screen.findByRole('heading', { name: 'Leads' });
      expect(screen.getByRole('status')).toHaveTextContent('Saved · 3 touches');
    });

    it('AC-8: opens a day with no entry as not yet saved', async () => {
      stubFetch({ ...base, '/activity/log': { body: unsaved() } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      await screen.findByRole('heading', { name: 'Leads' });
      expect(screen.getByRole('status')).toHaveTextContent('Not yet saved');
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
      expect(screen.getByRole('status')).toHaveTextContent('Not yet saved');
      await userEvent.click(screen.getByRole('button', { name: 'Save activity' }));
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved · 1 touches'));

      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-03-10' } });
      await waitFor(() => expect(screen.getByLabelText('Date')).toHaveValue('2026-03-10'));
      expect(screen.getByRole('status')).toHaveTextContent('Not yet saved');
    });

    it('AC-8: opens another saved day as saved, with that day’s touches', async () => {
      stubFetch({
        ...base,
        '/activity/log': { body: unsaved() },
        '/activity/log?date=2026-03-09': { body: day({ localDate: '2026-03-09', version: 2, totalCount: 7 }) },
      });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Leads' });

      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-03-09' } });

      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved · 7 touches'));
    });

    it('AC-8: sits under the date, as the prototype stacks them (`:2700-2704`)', async () => {
      stubFetch({ ...base, '/activity/log': { body: day() } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Leads' });

      const field = screen.getByLabelText('Date').parentElement!;
      expect(field.nextElementSibling).toBe(screen.getByRole('status'));
      expect(field.parentElement).toHaveClass('flex-col');
    });

    it('P10.1-T8: stands beside the title, top-aligned, so the title sits where Dashboard’s does', async () => {
      // The client, 2026-10-01: the Log title sat lower than the other tabs', *"mungkin karena ada
      // tanggal di sebelah kanannya"*. The row was bottom-aligned, so this block — taller than the
      // title and its sub-line — set the line. `Overall.html:839` top-aligns it.
      stubFetch({ ...base, '/activity/log': { body: day() } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });
      await screen.findByRole('heading', { name: 'Leads' });

      const row = screen.getByRole('heading', { name: 'Log Activity', level: 1 })
        .parentElement!.parentElement!;
      expect(row).toContainElement(screen.getByLabelText('Date'));
      expect(row).toContainElement(screen.getByRole('status'));
      expect(row).toHaveClass('items-start');
      expect(row).not.toHaveClass('items-end');
    });
  });

  it('AC-10: asks in the product’s own dialog before discarding a day’s typing', async () => {
    // It used to ask with `window.confirm`, whose buttons say OK and Cancel whatever the
    // question was, and which on a phone arrives as a system sheet over the app (I-95).
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    await userEvent.click(await screen.findByLabelText('Increase Submission polis'));
    await userEvent.clear(screen.getByLabelText('Date'));
    await userEvent.type(screen.getByLabelText('Date'), '2026-03-10');

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

    await userEvent.clear(screen.getByLabelText('Date'));
    await userEvent.type(screen.getByLabelText('Date'), '2026-03-10');
    // Scoped to the dialog: the page has its own Cancel, which a modal makes unreachable.
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Count for Submission polis')).toHaveValue(2);
  });
});
