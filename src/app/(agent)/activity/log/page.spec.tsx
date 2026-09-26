import { screen, waitFor, within } from '@testing-library/react';
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

const base = {
  '/kpm/config': { body: { activity: TAXONOMY, ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
  '/activity/compliance': {
    body: { membershipId: 'mem-1', compliant7d: true, compliantMonth: true, lastLoggedOn: '2026-03-11', windowDays: 7 },
  },
  '/activity/summary': { body: { from: '2026-03-05', to: '2026-03-11', totals: [], daysLogged: 3, totalCount: 9 } },
};

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

  it('shows the agent their own standing beside the form', async () => {
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    expect(await screen.findByText('Logged')).toBeInTheDocument();
    expect(screen.getByText(/3 of the last 7 days/)).toBeInTheDocument();
    expect(screen.getByText(/9 touches this week/)).toBeInTheDocument();
  });

  describe('a day whose window has closed', () => {
    const frozen = day({ editable: false, frozenAt: '2026-03-08T00:00:00Z', correctionCount: 1 });

    it('asks for a reason and offers a correction rather than a save', async () => {
      stubFetch({ ...base, '/activity/log': { body: frozen } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      expect(await screen.findByText('Closed for editing')).toBeInTheDocument();
      expect(screen.getByLabelText('Why is this being corrected?')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save activity' })).toBeNull();
    });

    it('keeps the correction button disabled until there is a reason', async () => {
      stubFetch({ ...base, '/activity/log': { body: frozen } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      const save = await screen.findByRole('button', { name: 'Save the correction' });
      expect(save).toBeDisabled();

      await userEvent.type(screen.getByLabelText('Why is this being corrected?'), 'Wrong day.');
      expect(save).toBeEnabled();
    });

    it('says how many times it has already been corrected', async () => {
      stubFetch({ ...base, '/activity/log': { body: frozen } });
      renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

      expect(await screen.findByText(/Corrected once since/)).toBeInTheDocument();
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

  it('says what to do when the office has no activity types yet', async () => {
    stubFetch({
      ...base,
      '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
      '/activity/log': { body: day({ entries: [], totalCount: 0 }) },
    });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    expect(await screen.findByText(/has not set up its activity types yet/)).toBeInTheDocument();
  });

  it('shows the server’s refusal rather than swallowing it', async () => {
    stubFetch({
      ...base,
      '/activity/log': { status: 400, body: { error: { code: 'VALIDATION_FAILED', message: '2026-03-12 has not happened yet in this office.' } } },
    });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    expect(await screen.findByText(/has not happened yet/)).toBeInTheDocument();
  });
  it('reaches the other two views of the same data (L-32)', async () => {
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    const strip = await screen.findByRole('navigation', { name: 'Activity management' });
    expect(strip).toContainElement(screen.getByRole('link', { name: 'Activity Dashboard' }));
    expect(strip).toContainElement(screen.getByRole('link', { name: 'Activity Ratios' }));
    // The one you are on says so, rather than only looking different.
    expect(screen.getByRole('link', { name: 'Log Activity' })).toHaveAttribute('aria-current', 'page');
  });

  it('counts each category and totals the day, live as you step', async () => {
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    // Leads: 0 + 2. Selling: 1. Total: 3.
    await screen.findByRole('heading', { name: 'Leads' });
    expect(screen.getByText('Total touches today').parentElement).toHaveTextContent('3');

    await userEvent.click(screen.getByLabelText('Increase Submission polis'));
    expect(screen.getByText('Total touches today').parentElement).toHaveTextContent('4');
    expect(screen.getByText('Selling', { selector: 'span' }).parentElement).toHaveTextContent('2');
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

  it('says whether the day is saved, in one live region', async () => {
    stubFetch({ ...base, '/activity/log': { body: day() } });
    renderInLayout(AgentLayout, <LogActivityPage />, { me: AGENT });

    await screen.findByRole('heading', { name: 'Leads' });
    expect(screen.getByRole('status')).toHaveTextContent('Not yet saved');

    await userEvent.click(screen.getByRole('button', { name: 'Save activity' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved · 3 touches'));
  });

  it('asks in the product’s own dialog before discarding a day’s typing', async () => {
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
