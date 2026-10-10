import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import CampaignsSettingsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/campaigns',
}));

const member = {
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({ membership: member, permissions: ['tenant_config:read', 'tenant_config:write', 'campaign_settings:read'] });
const READER = makeMe({ membership: member, permissions: ['tenant_config:read', 'campaign_settings:read'] });

const campaign = (over: Record<string, unknown> = {}) => ({
  id: 'c1', code: 'YEAR_END_DRIVE', title: 'Year-End Star Club Drive',
  description: 'Push to Star Club before the year closes.',
  startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-12-31T16:59:59.000Z',
  phase: 'running',
  requirements: [{
    metricKey: 'APE_ACHIEVED', metricName: 'APE achieved', comparator: 'gte',
    value: 50_000_000_000, unit: 'idr_minor', measured: true,
  }],
  reward: 'Extra unit budget', status: 'active', version: 1,
  // D-fields (P18.5-T7 AC-9).
  kind: 'seasonal', subtype: null, window: 'campaign_dates', appliesToOrgLevelCodes: [],
  poster: { emoji: '⭐', color: 'amber' }, blurb: 'The last push of the year.',
  ...over,
});

const tier = (over: Record<string, unknown> = {}) => ({
  id: 't1', kind: 'production_club', code: 'STAR_CLUB', name: 'Star Club',
  appliesToOrgLevelCodes: [],
  criteriaGroups: [{
    mode: 'all',
    criteria: [{
      metricKey: 'APE_ACHIEVED', metricName: 'APE achieved', comparator: 'gte',
      value: 120_000_000_000, unit: 'idr_minor',
    }],
  }],
  groupMode: 'all', reward: 'Promotion bonus', rank: 1, waitingOnMetrics: [], ...over,
});

const moc = () => ({
  id: 'm1', kind: 'moc', code: 'MOC_AB', name: 'Maintenance of Contract — AB',
  appliesToOrgLevelCodes: ['AB'],
  criteriaGroups: [
    {
      mode: 'all',
      criteria: [{
        metricKey: 'NET_APE', metricName: 'NET_APE', comparator: 'gte',
        value: 60_000_000_000, unit: 'idr_minor',
      }],
    },
    {
      mode: 'all',
      criteria: [{
        metricKey: 'DIRECT_AB_COUNT', metricName: 'DIRECT_AB_COUNT', comparator: 'gte',
        value: 5, unit: 'count',
      }],
    },
  ],
  groupMode: 'any', reward: '', rank: 1,
  waitingOnMetrics: ['NET_APE', 'DIRECT_AB_COUNT'],
});

function render(
  campaigns: unknown[] = [campaign()], rules: unknown[] = [tier(), moc()], me = OWNER,
) {
  const stub = stubFetch({
    '/kpm/settings/campaigns/rules': { body: rules },
    '/kpm/settings/campaigns': { body: campaigns },
    // The metric vocabulary is served, not listed in the screen (P5-T9, invariant 7).
    '/metrics': {
      body: [
        { key: 'APE_ACHIEVED', name: 'APE achieved', unit: 'idr_minor', phase: 9, computed: true, campaign: true },
        {
          key: 'SELLING_SUCCESS_RATE', name: 'Selling success rate', unit: 'percentage',
          phase: 9, computed: true, campaign: true,
        },
        { key: 'NEW_HIRES', name: 'New Hire', unit: 'count', phase: 18.5, computed: true, campaign: true },
        // Measured, but nothing a member achieves over a window (D-evaluable): not offered.
        { key: 'TRAINING_COMPLETION_PCT', name: 'Training completion', unit: 'percentage', phase: 18.5, computed: true, campaign: false },
        { key: 'GOAL_PACE_STATUS', name: 'Goal pace status', unit: 'enum', phase: 11, computed: true, campaign: false },
        // Not measured by the time campaigns are evaluated: it must not be offered. A stand-in:
        // since the 2026-10-08 re-plan campaigns are evaluated after every metric registered
        // today, so the server answers `computed: false` for none. Coaching coverage stood here
        // until coaching moved ahead of campaigns, and Event NPS until that re-plan.
        { key: 'LATER_METRIC', name: 'A metric measured later', unit: 'count', phase: 19, computed: false, campaign: false },
      ],
    },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
  });
  renderWithSession(<CampaignsSettingsPage />, { me });
  return stub;
}

const openTiers = async () => {
  await screen.findByRole('checkbox', { name: 'Show archived' });
  await userEvent.click(screen.getByRole('link', { name: 'Production club tiers' }));
};

/**
 * Campaigns, and the carrier rules (P5-T7, ADR-0026).
 *
 * The thing this screen exists to make visible: **two rows that look alike behave differently.**
 * The office's campaign is editable; the insurer's tier is not, and the reason is on the card
 * rather than left as inert controls beside live ones.
 */
describe('the office’s Campaigns screen', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads a money requirement as rupiah, from integer sen', async () => {
    // The prototype stores "Rp 600,000,000" as a display string and one campaign's reward in pesos.
    render();

    expect(await screen.findByText(/APE achieved at least Rp 500\.000\.000/)).toBeInTheDocument();
  });

  it('shows the phase worked out from the dates', async () => {
    render([campaign(), campaign({ id: 'c2', code: 'OLD', title: 'Last year', phase: 'ended' })]);

    expect(await screen.findByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  it('marks the office’s own campaign as the office’s', async () => {
    render();

    expect(await screen.findByText('Your office’s')).toBeInTheDocument();
  });

  it('shows the tiers read-only, with the reason rather than inert controls', async () => {
    render();
    await openTiers();

    expect(await screen.findByText('Star Club')).toBeInTheDocument();
    expect(screen.getByText(/These are your insurer’s, not your office’s/)).toBeInTheDocument();
    // Parity I-76: the prototype gives each tier Edit and a red Delete.
    expect(screen.queryByRole('button', { name: /edit|delete|archive/i })).not.toBeInTheDocument();
  });

  it('says a rule cannot be worked out yet, naming what it is waiting on', async () => {
    // The prototype fabricates the inputs. A rule whose inputs do not exist can never pass, and
    // showing it as ordinary would tell somebody they failed something nothing measures.
    render();
    await openTiers();

    expect(await screen.findByText('Not measured yet')).toBeInTheDocument();
    const why = screen.getByText(
      'Nothing measures NET_APE, DIRECT_AB_COUNT yet, so this rule cannot be worked out. Nothing here guesses them.',
    );
    // The state and what it waits on, and no timing: no phase, no date, no "until … arrive" (ADR-0070).
    expect(why.textContent).not.toMatch(/until|arrive|phase/i);
  });

  it('reads MOC’s two groups as an "or", as the carrier states it', async () => {
    render();
    await openTiers();

    // Net APE **or** five direct ABs — the carrier's own "or", which the prototype flattens.
    expect(await screen.findByText('Maintenance of Contract — AB')).toBeInTheDocument();
    expect(screen.getByText(/^or\s*$/)).toBeInTheDocument();
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('sends a money target as integer sen, never as rupiah', async () => {
    const stub = render([]);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a campaign' }));

    await userEvent.type(screen.getByLabelText('Title'), 'Push to Star');
    await userEvent.type(screen.getByLabelText('Starts'), '2026-10-01');
    await userEvent.type(screen.getByLabelText('Ends'), '2026-12-31');
    await userEvent.click(screen.getByRole('button', { name: '+ Add requirement' }));
    await userEvent.selectOptions(screen.getByLabelText('Requirement 1'), 'APE_ACHIEVED');
    await userEvent.type(screen.getByLabelText('Requirement 1 Target (Rp)'), '500000000');
    await userEvent.click(screen.getByRole('button', { name: 'Add the campaign' }));

    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(true));
    const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'POST')!.init.body));
    expect(sent.requirements).toEqual([
      { metricKey: 'APE_ACHIEVED', comparator: 'gte', value: 50_000_000_000 },
    ]);
  });

  it('offers only metrics this product measures', async () => {
    // A target nothing computes could never be reached, and the API refuses it anyway — so the
    // screen does not offer it in the first place.
    render([]);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a campaign' }));
    await userEvent.click(screen.getByRole('button', { name: '+ Add requirement' }));

    const options = Array.from(
      screen.getByLabelText('Requirement 1').querySelectorAll('option'),
    ).map((o) => (o as HTMLOptionElement).value);
    expect(options).not.toContain('NET_APE');
    expect(options).toContain('APE_ACHIEVED');
  });

  it('edits a campaign without ever sending its code', async () => {
    const stub = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    expect(screen.getByLabelText('Code')).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'Renamed drive');
    await userEvent.click(screen.getByRole('button', { name: 'Save the campaign' }));

    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)))
      .not.toHaveProperty('code');
  });

  it('archives and restores a campaign, and never deletes one', async () => {
    const stub = render([campaign({ status: 'archived' })]);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show archived' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(stub.calls.some((c) => c.url.includes('/c1/restore'))).toBe(true));
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('offers only metrics the product computes, from the registry (P5-T9)', async () => {
    // Five were listed in the screen by hand — a second definition of the product's vocabulary,
    // and unable to name the other thirty. A metric no phase computes by the time campaigns are
    // evaluated is left out: a target nothing computes could never be reached.
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Add a campaign' }));
    await userEvent.click(screen.getByRole('button', { name: '+ Add requirement' }));

    const select = screen.getByLabelText('Requirement 1');
    expect(within(select).getByRole('option', { name: 'APE achieved' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'A metric measured later' })).not.toBeInTheDocument();
  });

  it('shows a reader who cannot write without a control to change anything', async () => {
    render([campaign()], [tier()], READER);
    await screen.findByText('Year-End Star Club Drive');

    expect(screen.queryByRole('button', { name: 'Add a campaign' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  describe('the fields the agent’s card draws (P18.5-T7 AC-9, D-fields)', () => {
    it('P18.5-T7 AC-9 a seasonal campaign: its poster, line, description and who it is for, its days as the office’s instants', async () => {
      const stub = render([]);
      await userEvent.click(await screen.findByRole('button', { name: 'Add a campaign' }));
      expect(screen.getByLabelText('Kind')).toHaveValue('seasonal');
      expect(screen.queryByLabelText('Section')).not.toBeInTheDocument();

      await userEvent.type(screen.getByLabelText('Title'), 'Q4 APE Sprint');
      await userEvent.type(screen.getByLabelText('Starts'), '2026-10-01');
      await userEvent.type(screen.getByLabelText('Ends'), '2026-12-31');
      await userEvent.clear(screen.getByLabelText('Poster emoji'));
      await userEvent.type(screen.getByLabelText('Poster emoji'), '🚀');
      await userEvent.selectOptions(screen.getByLabelText('Poster colour'), 'amber');
      expect(document.querySelector('[data-poster-preview]')).toHaveClass('bg-amber');
      await userEvent.type(screen.getByLabelText('Card line'), 'Push for APE this quarter.');
      await userEvent.type(screen.getByLabelText('Description'), 'All qualifiers get a bonus.');
      await userEvent.click(screen.getByRole('checkbox', { name: 'Agent' }));
      await userEvent.click(screen.getByRole('button', { name: 'Add the campaign' }));

      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(true));
      const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'POST')!.init.body));
      expect(sent).toMatchObject({
        title: 'Q4 APE Sprint', code: 'Q4_APE_SPRINT', kind: 'seasonal', subtype: null, window: 'campaign_dates',
        appliesToOrgLevelCodes: ['AGENT'], poster: { emoji: '🚀', color: 'amber' },
        blurb: 'Push for APE this quarter.', description: 'All qualifiers get a bonus.',
        // 00:00 on the 1st and the last moment of the 31st in Jakarta: whole office months (D-windows).
        startsAt: '2026-09-30T17:00:00.000Z', endsAt: '2026-12-31T16:59:59.999Z',
      });
    });

    it('P18.5-T7 AC-9 a structural campaign: its section and its window, and no end', async () => {
      const stub = render([]);
      await userEvent.click(await screen.findByRole('button', { name: 'Add a campaign' }));
      await userEvent.type(screen.getByLabelText('Title'), 'MDRT Qualification');
      await userEvent.selectOptions(screen.getByLabelText('Kind'), 'structural');
      expect(screen.queryByLabelText('Ends')).not.toBeInTheDocument();
      await userEvent.selectOptions(screen.getByLabelText('Section'), 'ongoing');
      await userEvent.selectOptions(screen.getByLabelText('Read over'), 'calendar_year');
      await userEvent.type(screen.getByLabelText('Starts'), '2026-01-01');
      await userEvent.click(screen.getByRole('button', { name: 'Add the campaign' }));

      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(true));
      const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'POST')!.init.body));
      expect(sent).toMatchObject({
        kind: 'structural', subtype: 'ongoing', window: 'calendar_year', endsAt: null,
        startsAt: '2025-12-31T17:00:00.000Z', appliesToOrgLevelCodes: [],
      });
    });

    it('P18.5-T7 AC-9 the server’s refusal is named on the screen, in its words', async () => {
      const stub = stubFetch({
        '/kpm/settings/campaigns/rules': { body: [] },
        'GET /kpm/settings/campaigns': { body: [] },
        'POST /kpm/settings/campaigns': {
          status: 400,
          body: {
            error: {
              code: 'VALIDATION_FAILED', requestId: 'r-1',
              message: 'A campaign asking for figures from the monthly production file runs in whole months: start it on the 1st and end it on the last day of a month.',
              details: { violations: ['A campaign asking for figures from the monthly production file runs in whole months: start it on the 1st and end it on the last day of a month.'] },
            },
          },
        },
        '/metrics': { body: [{ key: 'APE_ACHIEVED', name: 'APE achieved', unit: 'idr_minor', phase: 9, computed: true, campaign: true }] },
        '/kpm/settings/publish-state': { body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null } },
      });
      renderWithSession(<CampaignsSettingsPage />, { me: OWNER });
      await userEvent.click(await screen.findByRole('button', { name: 'Add a campaign' }));
      await userEvent.type(screen.getByLabelText('Title'), 'Mid-month');
      await userEvent.type(screen.getByLabelText('Starts'), '2026-10-15');
      await userEvent.type(screen.getByLabelText('Ends'), '2026-11-15');
      await userEvent.click(screen.getByRole('button', { name: 'Add the campaign' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('runs in whole months: start it on the 1st');
      expect(stub.calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
    });

    it('P18.5-T8 AC-1 the picker offers only what a campaign can measure', async () => {
      render([]);
      await userEvent.click(await screen.findByRole('button', { name: 'Add a campaign' }));
      await userEvent.click(screen.getByRole('button', { name: '+ Add requirement' }));
      const values = Array.from(screen.getByLabelText('Requirement 1').querySelectorAll('option'))
        .map((o) => (o as HTMLOptionElement).value);
      expect(values).toEqual(['', 'APE_ACHIEVED', 'SELLING_SUCCESS_RATE', 'NEW_HIRES']);
    });

    it('P18.5-T8 AC-1 a stored requirement a campaign cannot measure reads Not measured yet, and editing sends it back unchanged', async () => {
      const old = campaign({
        requirements: [{
          metricKey: 'TRAINING_COMPLETION_PCT', metricName: 'Training completion', comparator: 'gt', value: 80, unit: 'percentage', measured: false,
        }],
      });
      const stub = render([old]);
      const row = (await screen.findByText(/Training completion more than 80%/)).closest('li')!;
      expect(within(row).getByText('Not measured yet')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
      const select = screen.getByLabelText('Requirement 1');
      expect(select).toHaveValue('TRAINING_COMPLETION_PCT');
      expect(within(select).getByRole('option', { name: 'Training completion (not measured yet)' })).toBeInTheDocument();
      await userEvent.clear(screen.getByLabelText('Title'));
      await userEvent.type(screen.getByLabelText('Title'), 'Renamed');
      await userEvent.click(screen.getByRole('button', { name: 'Save the campaign' }));
      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
      expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)).requirements)
        .toEqual([{ metricKey: 'TRAINING_COMPLETION_PCT', comparator: 'gt', value: 80 }]);
    });

    /** The seed's *APE Sprint*: two requirements, one of them not *at least*. */
    const sprint = () => campaign({
      id: 'c-sprint', code: 'APE_SPRINT', title: 'Q4 APE Sprint', blurb: 'Push for APE this quarter.',
      requirements: [
        { metricKey: 'APE_ACHIEVED', metricName: 'APE achieved', comparator: 'gte', value: 50_000_000_000, unit: 'idr_minor', measured: true },
        { metricKey: 'NEW_HIRES', metricName: 'New Hire', comparator: 'gt', value: 1, unit: 'count', measured: true },
      ],
    });

    it('P18.5-T7 AC-9 editing a two-requirement campaign’s line sends both requirements back, each with its comparator', async () => {
      const stub = render([sprint()]);
      await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
      expect(screen.getByLabelText('Requirement 1')).toHaveValue('APE_ACHIEVED');
      expect(screen.getByLabelText('Requirement 1 Comparison')).toHaveValue('gte');
      expect(screen.getByLabelText('Requirement 1 Target (Rp)')).toHaveValue(500000000);
      expect(screen.getByLabelText('Requirement 2')).toHaveValue('NEW_HIRES');
      expect(screen.getByLabelText('Requirement 2 Comparison')).toHaveValue('gt');
      expect(screen.getByLabelText('Requirement 2 Target')).toHaveValue(1);
      await userEvent.clear(screen.getByLabelText('Card line'));
      await userEvent.type(screen.getByLabelText('Card line'), 'A new line.');
      await userEvent.click(screen.getByRole('button', { name: 'Save the campaign' }));

      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
      const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body));
      expect(sent.blurb).toBe('A new line.');
      expect(sent.requirements).toEqual([
        { metricKey: 'APE_ACHIEVED', comparator: 'gte', value: 50_000_000_000 },
        { metricKey: 'NEW_HIRES', comparator: 'gt', value: 1 },
      ]);
    });

    it('P18.5-T7 AC-9 a row is added and removed, the metric another row names not offered twice', async () => {
      const stub = render([sprint()]);
      await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
      await userEvent.click(screen.getByRole('button', { name: '+ Add requirement' }));
      const third = screen.getByLabelText('Requirement 3');
      expect(within(third).getByRole('option', { name: 'APE achieved' })).toBeDisabled();
      expect(within(third).getByRole('option', { name: 'New Hire' })).toBeDisabled();
      // A row without a metric and a target cannot be saved.
      expect(screen.getByRole('button', { name: 'Save the campaign' })).toBeDisabled();
      await userEvent.selectOptions(third, 'SELLING_SUCCESS_RATE');
      await userEvent.selectOptions(screen.getByLabelText('Requirement 3 Comparison'), 'lte');
      await userEvent.type(screen.getByLabelText('Requirement 3 Target'), '40');
      await userEvent.click(screen.getByRole('button', { name: 'Remove requirement 1' }));
      expect(screen.getAllByRole('button', { name: /^Remove requirement/ })).toHaveLength(2);
      expect(screen.getByLabelText('Requirement 1')).toHaveValue('NEW_HIRES');
      await userEvent.click(screen.getByRole('button', { name: 'Save the campaign' }));

      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
      expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)).requirements).toEqual([
        { metricKey: 'NEW_HIRES', comparator: 'gt', value: 1 },
        { metricKey: 'SELLING_SUCCESS_RATE', comparator: 'lte', value: 40 },
      ]);
    });

    it('P18.5-T7 AC-9 removing every row saves a campaign that measures nothing', async () => {
      const stub = render([sprint()]);
      await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
      await userEvent.click(screen.getByRole('button', { name: 'Remove requirement 2' }));
      await userEvent.click(screen.getByRole('button', { name: 'Remove requirement 1' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save the campaign' }));
      await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
      expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)).requirements).toEqual([]);
    });

    it('P18.5-T7 AC-9 editing reads back the office’s days and the fields as stored', async () => {
      render([campaign({ startsAt: '2026-09-30T17:00:00.000Z', endsAt: '2026-12-31T16:59:59.999Z', appliesToOrgLevelCodes: ['AGENT'] })]);
      await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
      // It read the UTC day of the instant: Sep 30 for a campaign that starts on Oct 1 in Jakarta.
      expect(screen.getByLabelText('Starts')).toHaveValue('2026-10-01');
      expect(screen.getByLabelText('Ends')).toHaveValue('2026-12-31');
      expect(screen.getByLabelText('Poster emoji')).toHaveValue('⭐');
      expect(screen.getByLabelText('Poster colour')).toHaveValue('amber');
      expect(screen.getByLabelText('Card line')).toHaveValue('The last push of the year.');
      expect(screen.getByRole('checkbox', { name: 'Agent' })).toBeChecked();
    });

    it('P18.5-T7 AC-9 the settings list is otherwise unchanged: no kind, poster or line on the row', async () => {
      render();
      const title = await screen.findByText('Year-End Star Club Drive');
      const row = title.closest('li')!;
      expect(row).not.toHaveTextContent('The last push of the year.');
      expect(row).not.toHaveTextContent(/Seasonal|⭐/);
    });
  });
});
