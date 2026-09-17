import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, routeParams, stubFetch } from '@test/harness';
import CompanyTemplatePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/c1/template',
}));

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
async function openRow(code: string) {
  // `li` or the ratio card — not the nearest `div`, which is EditableRow's own wrapper
  // for the read view and does not contain the Edit button beside it.
  const row = screen.getByText(code).closest('li, [data-row]')!;
  await userEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Edit' }));
  return screen.getByRole('textbox', { description: code });
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
    await screen.findByText('SELL_SUBMISSION');
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
    await screen.findByText('SELL_SUBMISSION');
    expect(screen.queryByRole('link', { name: 'Branch info' })).toBeNull();
  });

  it('says what new offices start from when nothing is published', async () => {
    /*
     * The normal state of a new insurer. Saying so is what stops a Super Admin wondering
     * whether the defaults on screen are already live.
     */
    render();
    expect(await screen.findByText(/Nothing is published yet/)).toBeInTheDocument();
    expect(screen.getByText(/start from the\s+AgencyBoost defaults/)).toBeInTheDocument();
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
    await screen.findByText('SELL_SUBMISSION');
    const label = await openRow('SELL_SUBMISSION');
    await userEvent.type(label, ' baru');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('button', { name: /^Publish version/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
  });

  it('sends the whole payload, not a patch', async () => {
    const { calls } = render();
    await screen.findByText('SELL_SUBMISSION');
    const label = await openRow('SELL_SUBMISSION');
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

  it('shows a Phase 5 tab as a signpost, with no data and no request', async () => {
    const { calls } = render();
    await screen.findByText('SELL_SUBMISSION');
    const before = calls.length;

    // Events: Training has had its editor since P5-T1.
    await userEvent.click(screen.getByRole('link', { name: 'Events' }));

    expect(await screen.findByText(/Arrives in phase 5/)).toBeInTheDocument();
    expect(calls.length).toBe(before);
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
    await screen.findByText('SELL_SUBMISSION');

    await userEvent.click(sections().getByRole('link', { name: 'Training' }));

    expect(await screen.findByText('1 skill · 1 module published')).toBeInTheDocument();
    expect(screen.queryByText(/Arrives in phase 5/)).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/template/training_taxonomy'))).toBe(true);
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

    await screen.findByText('SELL_SUBMISSION');
    await userEvent.click(screen.getByRole('link', { name: 'Lead statuses' }));

    // It gets there, and it gets there with its own payload.
    expect(await screen.findByText('PAID_AND_ISSUED')).toBeInTheDocument();
    expect(screen.queryByText('SELL_SUBMISSION')).toBeNull();
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
      const pipeline = String(url).includes('lead_pipeline');
      if (!pipeline) await slow;
      return {
        ok: true,
        status: 200,
        json: async () => (pipeline ? PIPELINE : TAXONOMY),
      } as Response;
    }));

    renderWithSession(
      <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
      { me: SUPER_ADMIN },
    );

    // Leave for Lead statuses before the taxonomy answers, then let it answer.
    await userEvent.click(await screen.findByRole('link', { name: 'Lead statuses' }));
    expect(await screen.findByText('PAID_AND_ISSUED')).toBeInTheDocument();
    releaseSlow();

    // Still the pipeline. The late taxonomy is dropped rather than drawn.
    expect(await screen.findByText('PAID_AND_ISSUED')).toBeInTheDocument();
    expect(screen.queryByText('SELL_SUBMISSION')).toBeNull();
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
      await screen.findByText('SELL_SUBMISSION');
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
      await screen.findByText('SELLING_SUCCESS_RATE');
      expect(await openRow('SELLING_SUCCESS_RATE')).toBeInTheDocument();
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
      await screen.findByText('SELL_SUBMISSION');
      expect(screen.getAllByRole('button', { name: /^Add an activity type$/ }).length)
        .toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Add a section' })).toBeInTheDocument();
    });

    it('appends a type to the section it was added under', async () => {
      const { calls } = render();
      await screen.findByText('SELL_SUBMISSION');
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
      await screen.findByText('SELL_SUBMISSION');
      await userEvent.type(await openRow('SELL_SUBMISSION'), 'x');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      await userEvent.click(screen.getByRole('link', { name: 'Lead statuses' }));

      expect(await screen.findByText(/edits here that are not saved/)).toBeInTheDocument();
      // And it stayed put.
      expect(screen.getByText('SELL_SUBMISSION')).toBeInTheDocument();
    });

    it('stays when asked to stay', async () => {
      render();
      await screen.findByText('SELL_SUBMISSION');
      await userEvent.type(await openRow('SELL_SUBMISSION'), 'x');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      await userEvent.click(screen.getByRole('link', { name: 'Lead statuses' }));
      await userEvent.click(screen.getByRole('button', { name: 'Stay here' }));

      expect(screen.queryByText(/edits here that are not saved/)).not.toBeInTheDocument();
      expect(screen.getByText('SELL_SUBMISSION')).toBeInTheDocument();
    });

    it('switches freely when nothing is held', async () => {
      render();
      await screen.findByText('SELL_SUBMISSION');
      await userEvent.click(screen.getByRole('link', { name: 'Lead statuses' }));
      expect(screen.queryByText(/edits here that are not saved/)).not.toBeInTheDocument();
    });
  });
});
