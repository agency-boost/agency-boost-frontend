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
  permissions: ['platform_template:read', 'platform_template:write'],
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

function render(body: unknown = TAXONOMY) {
  const stub = stubFetch({ '/admin/companies/c1/template': { body } });
  renderWithSession(
    <CompanyTemplatePage params={routeParams({ companyId: 'c1' })} />,
    { me: SUPER_ADMIN },
  );
  return stub;
}

describe('a company’s KPM template (P4-T8)', () => {
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
});
