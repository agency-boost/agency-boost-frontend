import { screen } from '@testing-library/react';
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
  publishedAt: null, publishedVersion: null, officesBehind: 0,
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
  publishedAt: null, publishedVersion: null, officesBehind: 0,
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

describe('a company’s Company template (P4-T8)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lays the Owner’s Settings group out as tabs', async () => {
    // ADR-0018: each item of the Owner's Settings group is a tab here.
    render();
    for (const label of [
      'Activity types', 'Lead statuses', 'Activation checklist',
      'Training', 'Events', 'Campaigns', 'Products',
    ]) {
      expect(await screen.findByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('has no Branch info tab, because it is a fact about one office', async () => {
    render();
    await screen.findByLabelText('SELL_SUBMISSION');
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

  it('will not publish over unsaved edits', async () => {
    // The server publishes the *draft*, so publishing with unsaved changes would ship the
    // previous draft and look like the edit was lost.
    render();
    const label = await screen.findByLabelText('SELL_SUBMISSION');
    await userEvent.type(label, ' baru');

    expect(screen.getByRole('button', { name: /^Publish version/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
  });

  it('sends the whole payload, not a patch', async () => {
    const { calls } = render();
    const label = await screen.findByLabelText('SELL_SUBMISSION');
    await userEvent.clear(label);
    await userEvent.type(label, 'Closing');
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
    await screen.findByLabelText('SELL_SUBMISSION');
    const before = calls.length;

    await userEvent.click(screen.getByRole('link', { name: 'Training' }));

    expect(await screen.findByText(/Arrives in phase 5/)).toBeInTheDocument();
    expect(calls.length).toBe(before);
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

    await screen.findByLabelText('SELL_SUBMISSION');
    await userEvent.click(screen.getByRole('link', { name: 'Lead statuses' }));

    // It gets there, and it gets there with its own payload.
    expect(await screen.findByLabelText('PAID_AND_ISSUED')).toBeInTheDocument();
    expect(screen.queryByLabelText('SELL_SUBMISSION')).toBeNull();
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
    expect(await screen.findByLabelText('PAID_AND_ISSUED')).toBeInTheDocument();
    releaseSlow();

    // Still the pipeline. The late taxonomy is dropped rather than drawn.
    expect(await screen.findByLabelText('PAID_AND_ISSUED')).toBeInTheDocument();
    expect(screen.queryByLabelText('SELL_SUBMISSION')).toBeNull();
  });

});
