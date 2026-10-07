import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { makeMe, renderWithSession, routeParams, stubFetch as stubRoutes } from '@test/harness';
import CompanyTemplatePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/template',
}));

/**
 * **The company's templates** (ADR-0115 §3): the picker's list, stubbed beneath every spec here so each
 * reads its kinds as the default template's — which is what the screen opens on.
 */
const TEMPLATES = [
  {
    id: 't-default', companyId: 'c1', name: 'Prudential template', isDefault: true, status: 'active',
    archivedAt: null, origin: { kind: 'migration' }, officeCount: 3,
    publishedVersions: {
      activity_taxonomy: 1, lead_pipeline: 1, ratio_set: 1, activation_checklist: 1,
      training_taxonomy: 1, capability_ladder: 1, event_types: 1,
    },
    createdAt: '2026-10-07T03:00:00.000Z', updatedAt: '2026-10-07T03:00:00.000Z',
  },
];
const stubFetch: typeof stubRoutes = (routes) => stubRoutes({
  '/admin/companies/c1/templates': { body: TEMPLATES },
  ...routes,
});

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['company_template:read', 'company_template:write'],
});

const TAXONOMY = {
  id: 'tpl-1', companyId: 'c1', kind: 'activity_taxonomy', version: 1, status: 'draft',
  publishedAt: null, publishedVersion: null, officesBehind: 0, officesUnrecorded: 0,
  payload: {
    categories: [{ code: 'SELLING', label: 'Selling', displayOrder: 1 }],
    types: [{
      code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis',
      description: null, displayOrder: 1,
    }],
  },
};

const PIPELINE = {
  id: 'tpl-2', companyId: 'c1', kind: 'lead_pipeline', version: 1, status: 'draft',
  publishedAt: null, publishedVersion: null, officesBehind: 0, officesUnrecorded: 0,
  payload: {
    statuses: [
      { pipeline: 'sales', code: 'NOT_YET_APPROACHED', label: 'Not yet approached', rank: 1, isTerminal: false },
      { pipeline: 'sales', code: 'PAID_AND_ISSUED', label: 'Paid and issued', rank: 2, isTerminal: true },
      { pipeline: 'recruitment', code: 'NOT_APPROACHED', label: 'Not approached', rank: 1, isTerminal: true },
    ],
  },
};

function render(body: unknown = TAXONOMY) {
  const stub = stubFetch({ '/admin/companies/c1/template': { body } });
  renderWithSession(
    <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
    { me: SUPER_ADMIN },
  );
  return stub;
}

/**
 * Open one row for editing and hand back its Name field.
 *
 * A row reads as text until **Edit** is pressed (P4-T24) — a template seeds every future
 * office of a company, and a live field meant a stray keystroke on a focused input changed
 * one, with the draft saving it before anybody noticed the field had been touched.
 */
async function openRow(
  name: string,
  /** For a name the screen uses twice — `Training` is a row here *and* one of the tabs. */
  scope?: ReturnType<typeof within>,
  /** The label of the field to hand back. Most rows call theirs `Name`. */
  field = 'Name',
) {
  /*
   * Found by the row's **name**, opened, and handed back by the field asked for.
   *
   * The rows stopped painting their codes when the client asked for quieter lists, so a name is
   * the only thing on screen to find one by — which is what a person uses anyway. The code used
   * to identify the returned field, as the input's description; it is a read-only field of its
   * own now, so the label is what names the one being edited.
   */
  // `li` or the ratio card — not the nearest `div`, which is EditableRow's own wrapper
  // for the read view and does not contain the Edit button beside it.
  const row = (scope ?? screen).getByText(name).closest('li, [data-row]')!;
  await userEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Edit' }));
  return within(row as HTMLElement).getByLabelText(field);
}

/** The two rows of tabs: the Owner Settings items, and the halves of the one in view. */
const sections = () => within(screen.getByRole('navigation', { name: 'Template sections' }));

describe('a company’s Company template (P4-T8)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lays the Owner’s Settings group out as tabs', async () => {
    // ADR-0018: each **item** of the Owner's Settings group is a tab here — and an item
    // split across routes contributes one tab, not two. `Activity types` also appears in
    // the row below it, which is what the Owner's own screen does.
    render();
    await screen.findByText('Submission polis');
    for (const label of [
      'Activity types', 'Lead statuses', 'Activation checklist',
      'Training', 'Events', 'Campaigns', 'Products',
    ]) {
      expect(sections().getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(sections().queryByRole('link', { name: 'Ratio benchmarks' })).not.toBeInTheDocument();
  });

  it('has no Branch info tab, because it is a fact about one office', async () => {
    render();
    await screen.findByText('Submission polis');
    expect(screen.queryByRole('link', { name: 'Branch info' })).toBeNull();
  });

  it('says what new offices start from when nothing is published', async () => {
    /*
     * The normal state of a new insurer. Saying so is what stops a Super Admin wondering
     * whether the defaults on screen are already live.
     */
    // ADR-0115 §1: no fallback — an office made from the template gets none of a kind it never published.
    render();
    expect(await screen.findByText(/Nothing is published yet/)).toBeInTheDocument();
    expect(screen.getByText(/an office made from Prudential template starts with none of it/)).toBeInTheDocument();
  });

  it('says publishing does not reach offices that already exist', async () => {
    // Copy-on-provision means copy once. A Super Admin finding that out from an office
    // that did not change is the failure this sentence prevents.
    render({ ...TAXONOMY, status: 'published', publishedVersion: 1, officesBehind: 6 });
    expect(await screen.findByText(/6 offices are/)).toBeInTheDocument();
    expect(screen.getByText(/Publishing does not change them/)).toBeInTheDocument();
  });

  it('P5-T12: never calls an unrecorded office behind', async () => {
    /*
     * An office created before its record for this kind existed may be current. Folding it
     * into "running something older" would have told a Super Admin that every existing office
     * was behind on the Lead statuses and Ratio benchmarks tabs.
     */
    render({ ...TAXONOMY, status: 'published', publishedVersion: 2, officesBehind: 0, officesUnrecorded: 4 });

    expect(await screen.findByText(/4 offices were created before the version of this template/))
      .toBeInTheDocument();
    expect(screen.queryByText(/running something older/)).not.toBeInTheDocument();
    expect(screen.getByText(/Publishing does not change them/)).toBeInTheDocument();
  });

  it('P5-T12: states both, when some offices are behind and others unrecorded', async () => {
    render({ ...TAXONOMY, status: 'published', publishedVersion: 2, officesBehind: 1, officesUnrecorded: 1 });

    expect(await screen.findByText(/1 office is running something older/)).toBeInTheDocument();
    expect(screen.getByText(/1 office was created before/)).toBeInTheDocument();
  });

  it('will not publish over unsaved edits', async () => {
    // The server publishes the *draft*, so publishing with unsaved changes would ship the
    // previous draft and look like the edit was lost.
    render();
    await screen.findByText('Submission polis');
    const label = await openRow('Submission polis');
    await userEvent.type(label, ' baru');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('button', { name: /^Publish version/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
  });

  it('sends the whole payload, not a patch', async () => {
    const { calls } = render();
    await screen.findByText('Submission polis');
    const label = await openRow('Submission polis');
    await userEvent.clear(label);
    await userEvent.type(label, 'Closing');
    // The row's own Save closes the panel; Save draft is the request.
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    const call = calls.find((c) => c.init.method === 'PUT')!;
    const body = JSON.parse(call.init.body as string);
    expect(body.payload.categories).toHaveLength(1);
    expect(body.payload.types[0].label).toBe('Closing');
    // The code is untouched, which is the whole contract of a template.
    expect(body.payload.types[0].code).toBe('SELL_SUBMISSION');
  });

  it('P10.1-T5 AC-4, AC-5: saves the summary tile with the draft, and shows a refused one', async () => {
    // Both fields ride in the payload; the server keeps one label per tile, and says so when a
    // draft breaks that — in the screen's own banner, with nothing saved.
    const { calls } = stubFetch({
      '/admin/companies/c1/template': [
        { body: TAXONOMY },
        {
          status: 422,
          body: {
            error: {
              code: 'CONFIG_SUMMARY_GROUP_LABEL_MISMATCH',
              message: 'The sections in summary tile SELLING must share one label.',
              requestId: 'r-7',
              details: { summaryGroupCode: 'SELLING', labels: ['Selling', 'Sales'] },
            },
          },
        },
      ],
    });
    renderWithSession(
      <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
      { me: SUPER_ADMIN },
    );
    await screen.findByText('Submission polis');
    // The section's head, not its card: the card holds every one of its types' Edit buttons too.
    const head = screen.getByRole('heading', { name: 'Selling' }).closest('.flex') as HTMLElement;
    await userEvent.click(within(head).getByRole('button', { name: 'Edit' }));
    await userEvent.type(within(head).getByLabelText('Summary tile'), 'Selling');
    await userEvent.click(within(head).getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    const put = calls.find((c) => c.init.method === 'PUT')!;
    // The section's own name is a tile of its own (OD-101): both fields ride, as null.
    expect(JSON.parse(put.init.body as string).payload.categories[0]).toMatchObject({
      code: 'SELLING', summaryGroupCode: null, summaryGroupLabel: null,
    });
    const alerts = await screen.findAllByRole('alert');
    const banner = alerts.find((a) => a.textContent?.includes('One summary tile, two names'));
    expect(banner).toHaveTextContent('One summary tile, two names: “Selling” and “Sales”. Give every section in it the same tile name.');
    expect(banner).toHaveTextContent('CONFIG_SUMMARY_GROUP_LABEL_MISMATCH · r-7');
    // Still held, so the Super Admin can correct it rather than type it again.
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
  });

  /**
   * The three tabs P5-T9 finished (AC-4).
   *
   * Two of them — Events and Campaigns — were `ComingInPhase` signs until the template kinds
   * ADR-0034 named existed, which is why they looked unfinished beside the Products tab. The
   * third, Capability Mapping, had validation and a provisioning reader since P5-T8 and no way
   * for anybody to edit one.
   */
  describe('the Phase 5 tabs (P5-T9)', () => {
    const EVENT_TYPES = {
      id: 'tpl-4', companyId: 'c1', kind: 'event_types', version: 1, status: 'draft',
      publishedAt: null, publishedVersion: null, officesBehind: 0, officesUnrecorded: 0,
      payload: {
        types: [
          { code: 'TRAINING', label: 'Training', description: null, emoji: '📚', color: '#2D9CDB' },
          { code: 'RECOGNITION', label: 'Recognition', description: null, emoji: '🏆', color: null },
        ],
      },
    };

    const CAMPAIGN_KINDS = {
      id: 'tpl-5', companyId: 'c1', kind: 'campaign_kinds', version: 1, status: 'draft',
      publishedAt: null, publishedVersion: null, officesBehind: 0, officesUnrecorded: 0,
      payload: {
        rules: [{
          kind: 'production_club', code: 'STAR_CLUB', name: 'Star Club', rank: 1,
          reward: 'Promotion bonus', groupMode: 'all',
          criteriaGroups: [{
            mode: 'all',
            criteria: [{ metricKey: 'APE_ACHIEVED', comparator: 'gte', value: 120000000000 }],
          }],
        }],
      },
    };

    const CAPABILITY = {
      id: 'tpl-6', companyId: 'c1', kind: 'capability_ladder', version: 1, status: 'draft',
      publishedAt: null, publishedVersion: null, officesBehind: 0, officesUnrecorded: 0,
      payload: {
        stages: [{
          code: 'COMPETENT', label: 'Competent producer',
          requiredMilestoneCodes: ['SELLS'], stageOrder: 1,
        }],
        milestones: [{ code: 'SELLS', label: 'Sells independently' }],
        grids: [{
          code: 'PERSONAL', label: 'Personal selling', requiresDownline: false,
          items: [{ code: 'APPROACH', label: 'Approach' }],
        }],
      },
    };

    const openTab = async (body: unknown, label: string) => {
      const stub = stubFetch({
        '/admin/companies/c1/template': { body },
        '/metrics': {
          body: [
            { key: 'APE_ACHIEVED', name: 'APE achieved', unit: 'idr_minor', phase: 9, computed: true },
            { key: 'NET_APE', name: 'Net APE', unit: 'idr_minor', phase: 9, computed: true },
          ],
        },
      });
      renderWithSession(
        <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
        { me: SUPER_ADMIN },
      );
      await userEvent.click(await screen.findByRole('link', { name: label }));
      return stub;
    };

    it('edits an event type without touching its code', async () => {
      const stub = await openTab(EVENT_TYPES, 'Events');
      // `Training` is also one of this screen's tabs, so the row is found in the list itself.
      const list = within(await screen.findByRole('list'));
      const row = list.getByText('Training').closest('li')! as HTMLElement;
      const field = await openRow('Training', list);
      await userEvent.clear(field);
      await userEvent.type(field, 'Pelatihan');
      await userEvent.click(within(row).getByRole('button', { name: 'Save' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

      const sent = stub.calls.find((c) => c.init.method === 'PUT')!;
      const body = JSON.parse(String(sent.init.body));
      expect(body.payload.types[0].label).toBe('Pelatihan');
      // The code is untouched, which is the whole contract of a template.
      expect(body.payload.types[0].code).toBe('TRAINING');
    });

    it('shows a colour as a swatch, and its value where it is set', async () => {
      /*
       * **This test used to assert the opposite**, and the client's reason for the change is
       * the better one: `#2D9CDB` beside a row tells a reader nothing the swatch does not.
       *
       * It does not weaken *"colour is never the only cue"* — that rule is about colour carrying
       * status, and the row's name is right there carrying it. The swatch is `aria-hidden`, so
       * a screen reader used to announce *"Training 📚 #2D9CDB"* with the hex as pure noise.
       */
      await openTab(EVENT_TYPES, 'Events');
      await screen.findByRole('list');

      expect(screen.queryByText('#2D9CDB')).not.toBeInTheDocument();
      // A type with no colour simply has no swatch; nothing is invented for it.
      expect(screen.getByText('Recognition')).toBeInTheDocument();

      await openRow('Training', within(screen.getByRole('list')));
      expect(screen.getByLabelText('Color')).toHaveValue('#2D9CDB');
    });

    it('names a metric from the registry rather than a list of its own', async () => {
      // The campaigns screen carried five metrics hard-coded in a `<select>` — a second
      // definition of the product's vocabulary, and unable to name the other thirty.
      const stub = await openTab(CAMPAIGN_KINDS, 'Campaigns');

      expect(await screen.findByText(/APE achieved/)).toBeInTheDocument();
      expect(stub.calls.some((c) => c.url.includes('/metrics'))).toBe(true);
    });

    it('says publishing carrier rules reaches the offices that already exist', async () => {
      // Unlike every other kind: the rules are the company's and are read live, so this is not
      // a preset a future office is seeded from.
      await openTab(CAMPAIGN_KINDS, 'Campaigns');

      expect(await screen.findByText(/reaches the offices that already exist/))
        .toBeInTheDocument();
    });

    it('gives every capability row a code, shown where it is edited', async () => {
      // The claim was never that a list paints codes — it is that every row *has* one, so a
      // rename cannot orphan a tick. Two of the prototype's four grids have none at all.
      await openTab(CAPABILITY, 'Capability Mapping');
      // The grids are the `Skills` half; `Ladder` holds the milestones and the stages.
      await userEvent.click(await screen.findByRole('link', { name: 'Skills' }));
      await screen.findByText('Approach');

      expect(screen.queryByText('APPROACH')).not.toBeInTheDocument();
      expect(screen.queryByText('SELLS')).not.toBeInTheDocument();

      const row = screen.getByText('Approach').closest('li')!;
      await userEvent.click(within(row).getByRole('button', { name: 'Edit' }));
      expect(within(row).getByLabelText('Code')).toHaveValue('APPROACH');
    });

    it('says a stage’s seniority is its rank, not its position', async () => {
      // The prototype computes it from the array index, so tidying the ladder moves everybody.
      await openTab(CAPABILITY, 'Capability Mapping');

      expect(await screen.findByText(/Seniority is the rank, not the position/))
        .toBeInTheDocument();
      expect(screen.getByText('Rank 1')).toBeInTheDocument();
    });
  });
  it('P5-T1: edits the training taxonomy on its own tab, through its own editor', async () => {
    const TRAINING = {
      id: 'tpl-3', companyId: 'c1', kind: 'training_taxonomy', version: 1, status: 'draft',
      publishedAt: null, publishedVersion: null, officesBehind: 0, officesUnrecorded: 0,
      payload: {
        categories: [{ code: 'SALES', label: 'Sales', description: null }],
        skills: [{ code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting' }],
        modules: [{ code: 'PROSPECT_LIST', skillCode: 'PROSPECTING', title: 'Building Your Prospect List', publishState: 'published' }],
      },
    };
    const { calls } = stubFetch({
      '/admin/companies/c1/template/activity_taxonomy': { body: TAXONOMY },
      '/admin/companies/c1/template/training_taxonomy': { body: TRAINING },
    });
    renderWithSession(<CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
    await screen.findByText('Submission polis');

    await userEvent.click(sections().getByRole('link', { name: 'Training' }));

    expect(await screen.findByText('1 skill · 1 module published')).toBeInTheDocument();
    expect(screen.queryByText(/Arrives in phase 5/)).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/template/training_taxonomy'))).toBe(true);
  });

  it('P5-T3: edits the activation checklist on its own tab, offering this company’s modules', async () => {
    const CHECKLIST = {
      id: 'tpl-4', companyId: 'c1', kind: 'activation_checklist', version: 1, status: 'draft',
      publishedAt: null, publishedVersion: null, officesBehind: 0, officesUnrecorded: 0,
      payload: {
        aspects: [{
          code: 'INTRODUCTION',
          label: '1. Introduction',
          items: [{ code: 'INSURANCE_BASICS', label: 'Learn insurance basics', autoLink: null }],
        }],
      },
    };
    const TRAINING = {
      id: 'tpl-3', companyId: 'c1', kind: 'training_taxonomy', version: 1, status: 'draft',
      publishedAt: null, publishedVersion: null, officesBehind: 0, officesUnrecorded: 0,
      payload: {
        categories: [{ code: 'SALES', label: 'Sales', description: null }],
        skills: [{ code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting' }],
        modules: [{ code: 'PROSPECT_LIST', skillCode: 'PROSPECTING', title: 'Building Your Prospect List', publishState: 'published' }],
      },
    };
    stubFetch({
      '/admin/companies/c1/template/activity_taxonomy': { body: TAXONOMY },
      '/admin/companies/c1/template/activation_checklist': { body: CHECKLIST },
      '/admin/companies/c1/template/training_taxonomy': { body: TRAINING },
    });
    renderWithSession(<CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
    await screen.findByText('Submission polis');

    await userEvent.click(sections().getByRole('link', { name: 'Activation checklist' }));
    await screen.findByText('1 item across 1 aspect');
    expect(screen.queryByText(/Arrives in phase 5/)).not.toBeInTheDocument();

    // The link picker offers the company's own training modules, read from the tab next door.
    // The aspect head has an Edit of its own since it became renameable, so the item's row is
    // named rather than taking whichever Edit came first.
    const itemRow = screen.getByText('Learn insurance basics').closest('li')!;
    await userEvent.click(within(itemRow).getByRole('button', { name: 'Edit' }));
    expect(within(screen.getByLabelText('Completes from')).getAllByRole('option').map((o) => o.textContent))
      .toContain('Training · Building Your Prospect List');
  });

  it('switches to another kind without rendering it against the previous payload', async () => {
    /*
     * The crash this fixes: *Cannot read properties of undefined (reading 'filter')*.
     *
     * The loaded template and the selected tab were two pieces of state, cleared by the
     * effect that reloads — and an effect runs **after** the render that changed the tab.
     * So moving from Activity types to Lead statuses produced one render holding the new
     * kind and the old payload, and the pipeline editor read `payload.statuses` off a
     * taxonomy.
     *
     * They are one piece of state now, tagged with the kind they are, and nothing renders
     * unless the two agree.
     */
    stubFetch({
      '/admin/companies/c1/template/activity_taxonomy': { body: TAXONOMY },
      '/admin/companies/c1/template/lead_pipeline': { body: PIPELINE },
    });
    renderWithSession(
      <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
      { me: SUPER_ADMIN },
    );

    await screen.findByText('Submission polis');
    await userEvent.click(screen.getByRole('link', { name: 'Lead statuses' }));

    // It gets there, and it gets there with its own payload.
    expect(await screen.findByText('Paid and issued')).toBeInTheDocument();
    expect(screen.queryByText('Submission polis')).toBeNull();
  });

  it('ignores a late answer for a tab the reader has left', async () => {
    /*
     * Two loads in flight had no ordering guard, so a slow answer for the tab you left
     * could land last and be rendered under the tab you are on — the same mismatch by a
     * different route, and the one that only shows up on a bad connection.
     *
     * The stub answers in the harness's own shape; what it adds is a held promise on the
     * taxonomy, released after the reader has moved on.
     */
    let releaseSlow!: () => void;
    const slow = new Promise<void>((resolve) => { releaseSlow = resolve; });

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const list = String(url).includes('/templates');
      const pipeline = String(url).includes('lead_pipeline');
      if (!pipeline && !list) await slow;
      return {
        ok: true,
        status: 200,
        json: async () => (list ? TEMPLATES : pipeline ? PIPELINE : TAXONOMY),
      } as Response;
    }));

    renderWithSession(
      <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
      { me: SUPER_ADMIN },
    );

    // Leave for Lead statuses before the taxonomy answers, then let it answer.
    await userEvent.click(await screen.findByRole('link', { name: 'Lead statuses' }));
    expect(await screen.findByText('Paid and issued')).toBeInTheDocument();
    releaseSlow();

    // Still the pipeline. The late taxonomy is dropped rather than drawn.
    expect(await screen.findByText('Paid and issued')).toBeInTheDocument();
    expect(screen.queryByText('Submission polis')).toBeNull();
  });


  describe('ratio benchmarks, as a subtab of Activity types (P4-T20)', () => {
    it('offers it beside Activity types, as ADR-0018’s own table says', async () => {
      render();
      /*
       * A **subtab**, not a seventh item. `under` carried this grouping from the day the
       * ratio tab landed and nothing read it, so both halves rendered side by side in the
       * top row — and the first version of this test only checked that both links existed,
       * which is exactly why it passed over the gap.
       */
      await screen.findByText('Submission polis');
      expect(sections().queryByRole('link', { name: 'Ratio benchmarks' })).not.toBeInTheDocument();
      expect(sections().getByRole('link', { name: 'Activity types' })).toBeInTheDocument();

      const row = screen.getByRole('navigation', { name: 'Activity types sections' });
      expect(within(row).getByRole('link', { name: 'Ratio benchmarks' })).toBeInTheDocument();
      expect(within(row).getByRole('link', { name: 'Activity types' })).toBeInTheDocument();
    });

    it('renders the ratio payload through its own editor, not the pipeline one', async () => {
      /*
       * The dispatch was `activity_taxonomy ? Taxonomy : Pipeline`, so a ratio payload
       * went to `PipelineEditor` and crashed on `payload.statuses.filter`. It is an
       * exhaustive switch now, with a default that says a kind has no editor rather than
       * taking the screen down.
       */
      stubFetch({
        '/admin/companies/c1/template/ratio_set': {
          body: {
            id: 'tpl-r', companyId: 'c1', kind: 'ratio_set', version: 1, status: 'draft',
            payload: {
              ratios: [{
                code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate',
                numerator: ['SELL_SUBMISSION'], denominator: ['SELL_PRESENTATION'],
                benchmark: 0.15, comparison: 'gte', displayUnit: 'percent', displayOrder: 1,
              }],
            },
            publishedAt: null, publishedVersion: 0, officesBehind: 0, officesUnrecorded: 0,
          },
        },
        '/admin/companies/c1/template': { body: TAXONOMY },
      });
      renderWithSession(
        <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
        { me: SUPER_ADMIN },
      );

      await userEvent.click(await screen.findByRole('link', { name: 'Ratio benchmarks' }));
      await screen.findByText('Selling success rate');
      expect(await openRow('Selling success rate')).toBeInTheDocument();
      /*
       * The formula IS a control here, and that is the correction. It was read-only on
       * the reasoning that an office may not change a platform ratio's formula — which
       * had the dependency backwards: an office's copy is immutable *because the company
       * defines it upstream*, and if this screen cannot define it, nothing can.
       */
      expect(screen.getByRole('group', { name: 'Counts' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Out of' })).toBeInTheDocument();
      expect(screen.getByText(/what a comparison across offices is computed with/))
        .toBeInTheDocument();
    });
  });

  describe('the ratio editor edits and adds (P4-T22)', () => {
    function ratioTab() {
      stubFetch({
        '/admin/companies/c1/template/ratio_set': {
          body: {
            id: 'tpl-r', companyId: 'c1', kind: 'ratio_set', version: 1, status: 'draft',
            payload: {
              ratios: [{
                code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate',
                numerator: ['SELL_SUBMISSION'], denominator: ['SELL_SUBMISSION'],
                benchmark: 0.15, comparison: 'gte', displayUnit: 'percent', displayOrder: 1,
              }],
            },
            publishedAt: null, publishedVersion: 0, officesBehind: 0, officesUnrecorded: 0,
          },
        },
        '/admin/companies/c1/template': { body: TAXONOMY },
      });
      renderWithSession(
        <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
        { me: SUPER_ADMIN },
      );
    }

    it('offers the company’s own activity types as the formula, by name', async () => {
      ratioTab();
      await userEvent.click(await screen.findByRole('link', { name: 'Ratio benchmarks' }));
      const counts = await screen.findByRole('group', { name: 'Counts' });
      // Checkboxes over the taxonomy, not free text: a typed code is one that can be
      // typed wrong, and publishing would refuse it at the wrong moment.
      expect(within(counts).getByLabelText('Submission polis')).toBeInTheDocument();
    });

    it('adds a ratio, which the tab could not do at all', async () => {
      ratioTab();
      await userEvent.click(await screen.findByRole('link', { name: 'Ratio benchmarks' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Add a ratio' }));

      const form = screen.getByLabelText('Code').closest('div')!.parentElement!;
      await userEvent.type(within(form).getByLabelText('Code'), 'referral_rate');
      await userEvent.type(within(form).getByLabelText('Name'), 'Referral rate');
      await userEvent.click(within(form).getByRole('button', { name: 'Add' }));

      // It reads as text until Edit — so the new row shows its name, not a field.
      expect(await screen.findByText('Referral rate')).toBeInTheDocument();
    });
  });

  describe('adding to a template (P4-T20)', () => {
    it('offers an Add control the screen never had', async () => {
      render();
      await screen.findByText('Submission polis');
      expect(screen.getAllByRole('button', { name: /^Add an activity type$/ }).length)
        .toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Add a section' })).toBeInTheDocument();
    });

    it('appends a type to the section it was added under', async () => {
      const { calls } = render();
      await screen.findByText('Submission polis');
      await userEvent.click(screen.getAllByRole('button', { name: /^Add an activity type$/ })[0]);
      // Scoped to the add form — every existing row carries a Name field too, and only
      // the add form has a Code one.
      const form = screen.getByLabelText('Code').closest('div')!.parentElement!;
      await userEvent.type(within(form).getByLabelText('Code'), 'sell_referral');
      await userEvent.type(within(form).getByLabelText('Name'), 'Referral masuk');
      await userEvent.click(within(form).getByRole('button', { name: 'Add' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

      const put = calls.find((c) => c.init.method === 'PUT')!;
      const { payload } = JSON.parse(put.init.body as string);
      expect(payload.types.at(-1)).toMatchObject({
        code: 'SELL_REFERRAL', categoryCode: 'SELLING', label: 'Referral masuk',
      });
    });
  });

  describe('unsaved edits are named before they are lost (P4-T21)', () => {
    it('asks before a tab switch discards a draft', async () => {
      /*
       * Switching tabs reloads and `load` resets `dirty`, so a draft somebody had typed
       * vanished with nothing said. `dirty` was tracked and already gated both buttons;
       * the one place it was not consulted was the one place a change could disappear.
       */
      render();
      await screen.findByText('Submission polis');
      await userEvent.type(await openRow('Submission polis'), 'x');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      await userEvent.click(screen.getByRole('link', { name: 'Lead statuses' }));

      expect(await screen.findByText(/edits here that are not saved/)).toBeInTheDocument();
      // And it stayed put.
      expect(screen.getByText(/Submission polis/)).toBeInTheDocument();
    });

    it('stays when asked to stay', async () => {
      render();
      await screen.findByText('Submission polis');
      await userEvent.type(await openRow('Submission polis'), 'x');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      await userEvent.click(screen.getByRole('link', { name: 'Lead statuses' }));
      await userEvent.click(screen.getByRole('button', { name: 'Stay here' }));

      expect(screen.queryByText(/edits here that are not saved/)).not.toBeInTheDocument();
      expect(screen.getByText(/Submission polis/)).toBeInTheDocument();
    });

    it('switches freely when nothing is held', async () => {
      render();
      await screen.findByText('Submission polis');
      await userEvent.click(screen.getByRole('link', { name: 'Lead statuses' }));
      expect(screen.queryByText(/edits here that are not saved/)).not.toBeInTheDocument();
    });
  });

  describe('where the tabs are, and where they stay (client feedback, 2026-09-24)', () => {
    const LADDER = {
      id: 'tpl-6', companyId: 'c1', kind: 'capability_ladder', version: 1, status: 'draft',
      publishedAt: null, publishedVersion: null, officesBehind: 0, officesUnrecorded: 0,
      payload: {
        stages: [{
          code: 'COMPETENT', label: 'Competent producer',
          requiredMilestoneCodes: ['SELLS'], stageOrder: 1,
        }],
        milestones: [{ code: 'SELLS', label: 'Sells independently' }],
        grids: [{
          code: 'PERSONAL', label: 'Personal selling', requiresDownline: false,
          items: [{ code: 'APPROACH', label: 'Approach' }],
        }],
      },
    };

    const open = (body: unknown, hash = '') => {
      window.location.hash = hash;
      const stub = stubFetch({
        '/admin/companies/c1/template': { body },
        '/metrics': { body: [] },
      });
      renderWithSession(
        <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
        { me: SUPER_ADMIN },
      );
      return stub;
    };

    afterEach(() => { window.location.hash = ''; });

    it('lands on the tab the address bar names, not on the first one', async () => {
      // It was `useState(TABS[0])`, so every reload and every pasted link went back to
      // Activity types — including the reload that follows a publish.
      open(PIPELINE, '#leads-recruitment');

      expect(await screen.findByText('Not approached')).toBeInTheDocument();
      expect(screen.queryByText('Not yet approached')).toBeNull();
    });

    it('puts the tab in the address bar when it changes, so a refresh stays put', async () => {
      open(TAXONOMY);
      await userEvent.click(await screen.findByRole('link', { name: 'Ratio benchmarks' }));

      expect(window.location.hash).toBe('#ratios');
    });

    it('draws every subtab in the same row, above the Save button', async () => {
      /*
       * Three editors used to draw their own subtabs *below* the Save card while the
       * Activity types group drew its two above it — so the same control sat on either
       * side of the same button depending on which tab you were on. A reader cannot learn
       * a layout that moves.
       */
      open(PIPELINE, '#leads-sales');
      const subtabs = await screen.findByRole('navigation', { name: 'Lead statuses sections' });

      expect(within(subtabs).getAllByRole('link').map((l) => l.textContent))
        .toEqual(['Sales', 'Recruitment']);
      // The kind loads once the company's templates are in, so the Save card arrives a moment later.
      expect(subtabs.compareDocumentPosition(await screen.findByRole('button', { name: 'Save draft' })))
        // 4 = DOCUMENT_POSITION_FOLLOWING: the Save button comes after the subtab row.
        .toBe(4);
    });

    it('switches ladder without refetching, so an unsaved draft survives it', async () => {
      // A section change draws a different part of the payload already in hand. Reloading
      // would throw the draft away for a change that touched no data.
      const stub = open(PIPELINE, '#leads-sales');
      await screen.findByText('Not yet approached');
      const before = stub.calls.filter((c) => String(c.url).includes('/template')).length;

      await userEvent.click(screen.getByRole('link', { name: 'Recruitment' }));

      expect(await screen.findByText('Not approached')).toBeInTheDocument();
      expect(stub.calls.filter((c) => String(c.url).includes('/template'))).toHaveLength(before);
    });

    it('splits the capability ladder from the grids it is assessed against', async () => {
      open(LADDER, '#capability-ladder');
      const subtabs = await screen.findByRole('navigation', { name: 'Capability Mapping sections' });

      expect(within(subtabs).getAllByRole('link').map((l) => l.textContent))
        .toEqual(['Ladder', 'Skills']);
      expect(await screen.findByRole('heading', { name: 'Milestones' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Stages' })).toBeInTheDocument();
    });
  });

  /*
   * **P13.2-T6 AC-6: the company's named templates** (ADR-0115 §3, §7). The picker at the screen's head,
   * New template, Rename, Make default and Archive, each kind read and written for the template shown,
   * and the two tabs every template shares saying so.
   */
  describe('named templates (P13.2-T6)', () => {
    const SECOND = {
      ...TEMPLATES[0], id: 't-second', name: 'Jakarta branches', isDefault: false, officeCount: 1,
      origin: { kind: 'empty' },
    };
    const ARCHIVED = { ...SECOND, id: 't-old', name: 'Old settings', status: 'archived', archivedAt: '2026-10-01T00:00:00.000Z' };

    const mount = (routes: Parameters<typeof stubRoutes>[0] = {}) => {
      const stub = stubRoutes({
        '/admin/companies/c1/templates': { body: [TEMPLATES[0], SECOND, ARCHIVED] },
        '/admin/companies/c1/template': { body: TAXONOMY },
        ...routes,
      });
      renderWithSession(<CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
      return stub;
    };
    const picker = () => screen.findByRole('combobox', { name: 'Template' });

    it('opens on the default, marked, with the offices it answers for, and the archived ones apart', async () => {
      const { calls } = mount();
      const select = await picker();
      expect(select).toHaveDisplayValue('Prudential template · Default');
      expect(within(select).getAllByRole('option').map((o) => o.textContent))
        .toEqual(['Prudential template · Default', 'Jakarta branches', 'Old settings']);
      expect(within(select).getByRole('group', { name: 'Archived' })).toBeInTheDocument();
      expect(await screen.findByText('3 offices')).toBeInTheDocument();
      await screen.findByText('Submission polis');
      expect(calls.map((c) => c.url)).toContainEqual(expect.stringContaining('/template/activity_taxonomy?templateId=t-default'));
    });

    it('reads and writes the template picked', async () => {
      const { calls } = mount();
      await screen.findByText('Submission polis');
      await userEvent.selectOptions(await picker(), 't-second');
      expect(await screen.findByText('1 office')).toBeInTheDocument();
      await screen.findByText('Submission polis');
      expect(calls.at(-1)!.url).toContain('/template/activity_taxonomy?templateId=t-second');
      expect(screen.getByText(/an office made from Jakarta branches starts with none of it/)).toBeInTheDocument();
    });

    it('keeps an archived template readable and not editable', async () => {
      mount();
      await userEvent.selectOptions(await picker(), 't-old');
      expect(await screen.findByText('Archived · 1 office')).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Save draft' })).toBeDisabled();
    });

    it('makes a new template, empty or from the defaults, and shows it', async () => {
      const made = { ...SECOND, id: 't-new', name: 'Surabaya', origin: { kind: 'defaults' }, officeCount: 0 };
      const { calls } = mount({
        'POST /admin/companies/c1/templates': { status: 201, body: made },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'New template' }));
      const dialog = screen.getByRole('dialog', { name: 'New template' });
      await userEvent.type(within(dialog).getByLabelText('Name'), 'Surabaya');
      await userEvent.click(within(dialog).getByRole('radio', { name: /AgencyBoost defaults/ }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Create template' }));

      const post = calls.find((c) => c.init.method === 'POST')!;
      expect(JSON.parse(post.init.body as string)).toEqual({ name: 'Surabaya', from: 'defaults' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('says a taken name under the name, and keeps the dialog open', async () => {
      mount({
        'POST /admin/companies/c1/templates': {
          status: 409,
          body: { error: { code: 'TEMPLATE_NAME_TAKEN', message: 'This company already has a template called Jakarta branches. Choose another name.', requestId: 'r-1', details: { name: 'Jakarta branches' } } },
        },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'New template' }));
      const dialog = screen.getByRole('dialog', { name: 'New template' });
      await userEvent.type(within(dialog).getByLabelText('Name'), 'Jakarta branches');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Create template' }));

      expect(await within(dialog).findByText(/already has a template called Jakarta branches/)).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    });

    it('asks before Make default, then moves it', async () => {
      const { calls } = mount({
        'PATCH /admin/companies/c1/templates/t-second': { body: { ...SECOND, isDefault: true } },
      });
      await userEvent.selectOptions(await picker(), 't-second');
      await userEvent.click(screen.getByRole('button', { name: 'Actions for Jakarta branches' }));
      await userEvent.click(screen.getByRole('menuitem', { name: /Make default/ }));
      const question = screen.getByRole('dialog', { name: /Make Jakarta branches the default\?/ });
      await userEvent.click(within(question).getByRole('button', { name: 'Make default' }));

      const patch = calls.find((c) => c.init.method === 'PATCH')!;
      expect(patch.url).toContain('/admin/companies/c1/templates/t-second');
      expect(JSON.parse(patch.init.body as string)).toEqual({ isDefault: true });
    });

    it('never offers to archive the default, and says why; archives another after asking', async () => {
      const { calls } = mount({
        'POST /admin/companies/c1/templates/t-second/archive': { body: { ...SECOND, status: 'archived' } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Actions for Prudential template' }));
      const archive = screen.getByRole('menuitem', { name: /Archive/ });
      expect(archive).toHaveAttribute('aria-disabled', 'true');
      expect(archive).toHaveTextContent('The default cannot be archived. Make another template the default first.');
      await userEvent.keyboard('{Escape}');

      await userEvent.selectOptions(await picker(), 't-second');
      await userEvent.click(screen.getByRole('button', { name: 'Actions for Jakarta branches' }));
      await userEvent.click(screen.getByRole('menuitem', { name: /Archive/ }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive template' }));
      expect(calls.some((c) => c.url.endsWith('/templates/t-second/archive') && c.init.method === 'POST')).toBe(true);
    });

    it('asks before another template discards unsaved edits', async () => {
      mount();
      await screen.findByText('Submission polis');
      await userEvent.type(await openRow('Submission polis'), ' baru');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      await userEvent.selectOptions(await picker(), 't-second');
      expect(await screen.findByText(/Opening Jakarta branches discards them/)).toBeInTheDocument();
      expect(await picker()).toHaveDisplayValue('Prudential template · Default');
    });

    it('exit review, finding 6: a template just made asks before it discards unsaved edits — Stay keeps them', async () => {
      const made = { ...SECOND, id: 't-new', name: 'Surabaya', officeCount: 0 };
      const { calls } = mount({ 'POST /admin/companies/c1/templates': { status: 201, body: made } });
      await screen.findByText('Submission polis');
      await userEvent.type(await openRow('Submission polis'), ' baru');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      await userEvent.click(screen.getByRole('button', { name: 'New template' }));
      const dialog = screen.getByRole('dialog', { name: 'New template' });
      await userEvent.type(within(dialog).getByLabelText('Name'), 'Surabaya');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Create template' }));

      // Made, but not opened over the draft: the same question a pick asks.
      expect(await screen.findByText(/Opening Surabaya discards them/)).toBeInTheDocument();
      expect(await picker()).toHaveDisplayValue('Prudential template · Default');
      await userEvent.click(screen.getByRole('button', { name: 'Stay here' }));
      expect(screen.getByText('Submission polis baru')).toBeInTheDocument();
      expect(calls.some((c) => c.url.includes('templateId=t-new'))).toBe(false);
    });

    it('exit review, finding 6: Discard and open opens the template just made', async () => {
      const made = { ...SECOND, id: 't-new', name: 'Surabaya', officeCount: 0 };
      const { calls } = mount({ 'POST /admin/companies/c1/templates': { status: 201, body: made } });
      await screen.findByText('Submission polis');
      await userEvent.type(await openRow('Submission polis'), ' baru');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      await userEvent.click(screen.getByRole('button', { name: 'New template' }));
      const dialog = screen.getByRole('dialog', { name: 'New template' });
      await userEvent.type(within(dialog).getByLabelText('Name'), 'Surabaya');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Create template' }));

      await userEvent.click(await screen.findByRole('button', { name: 'Discard and open Surabaya' }));
      await vi.waitFor(() => expect(calls.some((c) => c.url.includes('/template/activity_taxonomy?templateId=t-new'))).toBe(true));
    });

    it('exit review, finding 6: an archived template cannot be published, as it cannot be saved', async () => {
      mount({ '/admin/companies/c1/template': { body: { ...TAXONOMY, status: 'draft', version: 2, publishedVersion: 1 } } });
      await userEvent.selectOptions(await picker(), 't-old');
      const publish = await screen.findByRole('button', { name: 'Publish version 2' });
      expect(publish).toBeDisabled();
      expect(publish).toHaveAttribute('title', 'An archived template is kept as it is.');
      expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    });

    it('has no axe violations: the picker, and the New template dialog open', async () => {
      mount();
      await screen.findByText('Submission polis');
      // The page is rendered without its layout here, so `region` — content outside a landmark — is the harness's.
      const rules = { 'color-contrast': { enabled: false }, region: { enabled: false } };
      expect((await axe(document.body, { rules })).violations ?? []).toHaveLength(0);
      await userEvent.click(screen.getByRole('button', { name: 'New template' }));
      const dialog = screen.getByRole('dialog', { name: 'New template' });
      expect((await axe(dialog, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toHaveLength(0);
    });

    it('says, on the Campaigns and Products tabs, that they are the company’s, shared by every template', async () => {
      mount();
      await screen.findByText('Submission polis');
      expect(sections().getByRole('link', { name: 'Campaigns' }))
        .toHaveAccessibleDescription('Campaigns are the company’s, shared by every template.');
      expect(sections().getByRole('link', { name: 'Products' }))
        .toHaveAttribute('title', 'Products are the company’s, shared by every template.');
      expect(sections().getByRole('link', { name: 'Events' })).not.toHaveAttribute('title');
    });
  });

  /**
   * **P13.2-T7 AC-7: the copies** (ADR-0115 §5, §6) — *New template*'s *Copy of* the template shown, and
   * *Import from another company*: its fields, states and refusals.
   */
  describe('copies (P13.2-T7)', () => {
    const COMPANIES = [
      { _id: 'c1', name: 'Prudential', slug: 'prudential', status: 'active', usesPlatformDefaults: true },
      { _id: 'c2', name: 'Allianz Life', slug: 'allianz-life', status: 'active', usesPlatformDefaults: true },
    ];
    const THEIRS = [
      { ...TEMPLATES[0], id: 'a-default', companyId: 'c2', name: 'Allianz Life template' },
      { ...TEMPLATES[0], id: 'a-second', companyId: 'c2', name: 'Allianz Jakarta', isDefault: false },
      { ...TEMPLATES[0], id: 'a-old', companyId: 'c2', name: 'Allianz old', isDefault: false, status: 'archived' },
    ];
    const IMPORTED = {
      ...TEMPLATES[0], id: 't-imported', name: 'Allianz Life template', isDefault: false,
      origin: { kind: 'import', templateId: 'a-default', companyId: 'c2' }, officeCount: 0,
    };

    const mount = (routes: Parameters<typeof stubRoutes>[0] = {}) => {
      const stub = stubRoutes({
        '/admin/companies/c1/templates': { body: TEMPLATES },
        '/admin/companies/c1/template': { body: TAXONOMY },
        '/admin/companies/c2/templates': { body: THEIRS },
        '/admin/companies': { body: COMPANIES },
        ...routes,
      });
      renderWithSession(<CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />, { me: SUPER_ADMIN });
      return stub;
    };
    const openImport = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Import from another company' }));
      return screen.getByRole('dialog', { name: 'Import from another company' });
    };

    it('AC-1: New template copies the template shown, as Copy of {name}', async () => {
      const made = { ...IMPORTED, id: 't-copy', name: 'Jakarta copy', origin: { kind: 'copy', templateId: 't-default' } };
      const { calls } = mount({ 'POST /admin/companies/c1/templates': { status: 201, body: made } });
      await userEvent.click(await screen.findByRole('button', { name: 'New template' }));
      const dialog = screen.getByRole('dialog', { name: 'New template' });
      const copy = within(dialog).getByRole('radio', { name: /Copy of Prudential template/ });
      expect(copy).toHaveAccessibleDescription(/Unpublished drafts are not copied/);
      await userEvent.type(within(dialog).getByLabelText('Name'), 'Jakarta copy');
      await userEvent.click(copy);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Create template' }));

      const post = calls.find((c) => c.init.method === 'POST')!;
      expect(JSON.parse(post.init.body as string)).toEqual({ name: 'Jakarta copy', from: { templateId: 't-default' } });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('AC-4: imports one of another company’s active templates, its default chosen and its name offered', async () => {
      const { calls } = mount({ 'POST /admin/companies/c1/templates/import': { status: 201, body: IMPORTED } });
      const dialog = await openImport();
      const company = await within(dialog).findByRole('combobox', { name: 'Company' });
      // Never this company itself.
      expect(within(company).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose a company', 'Allianz Life']);
      await userEvent.selectOptions(company, 'c2');

      const template = await within(dialog).findByRole('combobox', { name: 'Template' });
      // Active ones only, the default first and chosen.
      expect(within(template).getAllByRole('option').map((o) => o.textContent))
        .toEqual(['Allianz Life template · Default', 'Allianz Jakarta']);
      expect(template).toHaveDisplayValue('Allianz Life template · Default');
      expect(within(dialog).getByLabelText('Name')).toHaveValue('Allianz Life template');
      // The name follows the source until it is typed.
      await userEvent.selectOptions(template, 'a-second');
      expect(within(dialog).getByLabelText('Name')).toHaveValue('Allianz Jakarta');
      await userEvent.clear(within(dialog).getByLabelText('Name'));
      await userEvent.type(within(dialog).getByLabelText('Name'), 'Dari Allianz');
      await userEvent.selectOptions(template, 'a-default');
      expect(within(dialog).getByLabelText('Name')).toHaveValue('Dari Allianz');

      await userEvent.click(within(dialog).getByRole('button', { name: 'Import template' }));
      const post = calls.find((c) => c.init.method === 'POST')!;
      expect(post.url).toContain('/admin/companies/c1/templates/import');
      expect(JSON.parse(post.init.body as string)).toEqual({ fromCompanyId: 'c2', templateId: 'a-default', name: 'Dari Allianz' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('AC-4: says, in its words, that this company’s ladder lacks a role — and stays open', async () => {
      mount({
        'POST /admin/companies/c1/templates/import': {
          status: 409,
          body: { error: {
            code: 'TEMPLATE_RUNG_UNKNOWN', requestId: 'r-2', details: { codes: ['SM'] },
            message: 'This company’s role ladder has no SM, and the settings being copied show ratios or activity sections to that role. Add it to the company’s ladder first, or copy other settings.',
          } },
        },
      });
      const dialog = await openImport();
      await userEvent.selectOptions(await within(dialog).findByRole('combobox', { name: 'Company' }), 'c2');
      await within(dialog).findByRole('combobox', { name: 'Template' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Import template' }));
      expect(await within(dialog).findByText(/role ladder has no SM/)).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Import from another company' })).toBeInTheDocument();
    });

    it('says a taken name under the name', async () => {
      mount({
        'POST /admin/companies/c1/templates/import': {
          status: 409,
          body: { error: { code: 'TEMPLATE_NAME_TAKEN', message: 'This company already has a template called Allianz Life template. Choose another name.', requestId: 'r-3', details: { name: 'Allianz Life template' } } },
        },
      });
      const dialog = await openImport();
      await userEvent.selectOptions(await within(dialog).findByRole('combobox', { name: 'Company' }), 'c2');
      await within(dialog).findByRole('combobox', { name: 'Template' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Import template' }));
      expect(await within(dialog).findByText(/already has a template called Allianz Life template/)).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    });

    it('waits for the companies with a skeleton, and says when there is no other company', async () => {
      let release: () => void = () => undefined;
      const pending = new Promise<void>((resolve) => { release = resolve; });
      mount({
        '/admin/companies': () => ({ body: [COMPANIES[0]] }),
      });
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      const real = fetchMock.getMockImplementation()! as (url: string, init?: RequestInit) => Promise<Response>;
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/admin/companies')) await pending;
        return real(url, init);
      });
      const dialog = await openImport();
      expect(within(dialog).getByRole('status')).toHaveTextContent('Loading companies…');
      release();
      expect(await within(dialog).findByText('There is no other company to import from.')).toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: 'Import template' })).not.toBeInTheDocument();
    });

    it('exit review, finding 6: Import asks before a draft is discarded for the template it made', async () => {
      mount({ 'POST /admin/companies/c1/templates/import': { status: 201, body: IMPORTED } });
      await screen.findByText('Submission polis');
      await userEvent.type(await openRow('Submission polis'), ' baru');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      const dialog = await openImport();
      await userEvent.selectOptions(await within(dialog).findByRole('combobox', { name: 'Company' }), 'c2');
      await within(dialog).findByRole('combobox', { name: 'Template' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Import template' }));
      expect(await screen.findByText(/Opening Allianz Life template discards them/)).toBeInTheDocument();
      expect(screen.getByText('Submission polis baru')).toBeInTheDocument();
    });

    it('exit review, finding 8: a company with no active template says so, and offers nothing to import', async () => {
      mount({
        '/admin/companies': { body: [...COMPANIES, { _id: 'c3', name: 'Blank Co', slug: 'blank-co', status: 'active', usesPlatformDefaults: false }] },
        '/admin/companies/c3/templates': { body: [{ ...THEIRS[2], companyId: 'c3' }] },
      });
      const dialog = await openImport();
      await userEvent.selectOptions(await within(dialog).findByRole('combobox', { name: 'Company' }), 'c3');
      expect(await within(dialog).findByText('Blank Co has no active template to import.')).toBeInTheDocument();
      expect(within(dialog).queryByRole('combobox', { name: 'Template' })).not.toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Import template' })).toBeDisabled();
    });

    it('exit review, finding 8: what was said of one company is cleared when another is chosen', async () => {
      mount({
        '/admin/companies': { body: [...COMPANIES, { _id: 'c3', name: 'Blank Co', slug: 'blank-co', status: 'active', usesPlatformDefaults: false }] },
        '/admin/companies/c3/templates': {
          status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Their templates could not be read.', requestId: 'r-5' } },
        },
      });
      const dialog = await openImport();
      const company = await within(dialog).findByRole('combobox', { name: 'Company' });
      await userEvent.selectOptions(company, 'c3');
      expect(await within(dialog).findByText('Their templates could not be read.')).toBeInTheDocument();

      await userEvent.selectOptions(company, 'c2');
      await within(dialog).findByRole('combobox', { name: 'Template' });
      expect(within(dialog).queryByText('Their templates could not be read.')).not.toBeInTheDocument();
    });

    it('shows a failed read of the companies as the API said it', async () => {
      mount({
        '/admin/companies': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.', requestId: 'r-4' } } },
      });
      const dialog = await openImport();
      expect(await within(dialog).findByText('Something went wrong on our side.')).toBeInTheDocument();
    });

    it('has no axe violations with the Import dialog open and filled', async () => {
      mount();
      const dialog = await openImport();
      await userEvent.selectOptions(await within(dialog).findByRole('combobox', { name: 'Company' }), 'c2');
      await within(dialog).findByRole('combobox', { name: 'Template' });
      expect((await axe(dialog, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toHaveLength(0);
    });
  });
});
