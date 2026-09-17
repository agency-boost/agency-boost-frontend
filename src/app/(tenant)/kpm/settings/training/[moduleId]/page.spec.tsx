import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, routeParams, stubFetch } from '@test/harness';
import TrainingModulePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/training/m-list',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write'],
});

const READER = makeMe({ ...OWNER, permissions: ['tenant_config:read'] });

const moduleRow = (over: Record<string, unknown>) => ({
  id: 'm-x', code: 'X', skillCode: 'PROSPECTING', title: 'X', publishState: 'published',
  displayOrder: 1, version: 1, status: 'active', ...over,
});

const TREE = [
  {
    id: 'c-sales', code: 'SALES', label: 'Sales', description: null, displayOrder: 1, version: 1, status: 'active',
    skills: [
      {
        id: 's-prospecting', code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting',
        displayOrder: 1, version: 1, status: 'active',
        modules: [
          moduleRow({ id: 'm-list', code: 'PROSPECT_LIST', title: 'Building Your Prospect List', version: 6 }),
          moduleRow({ id: 'm-gone', code: 'GONE', title: 'Retired module', status: 'archived' }),
        ],
      },
      {
        id: 's-closing', code: 'CLOSING', categoryCode: 'SALES', label: 'Closing', displayOrder: 2, version: 1,
        status: 'active', modules: [],
      },
    ],
  },
  {
    id: 'c-product', code: 'PRODUCT', label: 'Product', description: null, displayOrder: 2, version: 1,
    status: 'active',
    skills: [{
      id: 's-features', code: 'FEATURES', categoryCode: 'PRODUCT', label: 'Features', displayOrder: 1,
      version: 1, status: 'active', modules: [],
    }],
  },
  {
    id: 'c-empty', code: 'EMPTY', label: 'Soft skills', description: null, displayOrder: 3, version: 1,
    status: 'active', skills: [],
  },
];

function render(moduleId = 'm-list', me = OWNER, changes: { status?: number; body?: unknown } = { body: {} }) {
  const stub = stubFetch({
    '/kpm/settings/training': { body: TREE },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
    '/kpm/settings/changes': changes,
  });
  renderWithSession(<TrainingModulePage params={routeParams({ moduleId })} />, { me });
  return stub;
}

const batch = (calls: { url: string; init: RequestInit }[]) =>
  JSON.parse(calls.find((c) => c.url.includes('/kpm/settings/changes'))!.init.body as string).ops;

describe('a training module’s page (P5-T1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('titles the page with the module, and says where it sits', async () => {
    render();

    expect(await screen.findByRole('heading', { name: 'Building Your Prospect List' })).toBeInTheDocument();
    expect(screen.getByText('Sales › Prospecting')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Training' })).toHaveAttribute('href', '/kpm/settings/training#modules');
  });

  it('shows the code it can never change', async () => {
    render();
    await screen.findByLabelText('Title');

    expect(screen.getByText('PROSPECT_LIST')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Code' })).not.toBeInTheDocument();
  });

  it('holds Save until something has changed', async () => {
    render();

    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Title'), '!');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('saves the title and the publish state as one batch, sending only what changed', async () => {
    const { calls } = render();
    const title = await screen.findByLabelText('Title');
    await userEvent.clear(title);
    await userEvent.type(title, 'Your prospect list');
    await userEvent.click(screen.getByRole('switch', { name: 'Published' }));
    expect(screen.getByText('A draft. No agent is offered it.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Saved to your office.')).toBeInTheDocument();
    expect(batch(calls)).toEqual([{
      op: 'trainingModule.update',
      id: 'm-list',
      expectedVersion: 6,
      body: { title: 'Your prospect list', publishState: 'draft' },
    }]);
  });

  it('offers the chosen category’s skills, and moves the module by its skill (AC-2, F-13)', async () => {
    const { calls } = render();
    await screen.findByLabelText('Title');
    expect(screen.getByLabelText('Skill')).toHaveValue('PROSPECTING');

    await userEvent.selectOptions(screen.getByLabelText('Category'), 'PRODUCT');
    expect(screen.getByLabelText('Skill')).toHaveValue('FEATURES');
    expect(screen.queryByRole('option', { name: 'Closing' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Saved to your office.');
    // The category is not sent: a module's category is its skill's.
    expect(batch(calls)[0].body).toEqual({ skillCode: 'FEATURES' });
  });

  it('will not save into a category with no skills, and says what to do', async () => {
    render();
    await screen.findByLabelText('Title');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'EMPTY');

    expect(screen.getByText('This category has no skills yet. Add one on Training first.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('shows what the server refused, and keeps what was typed', async () => {
    render('m-list', OWNER, {
      status: 409,
      body: { error: { code: 'VERSION_CONFLICT', message: 'PROSPECT_LIST changed while you were editing.', requestId: 'r' } },
    });
    const title = await screen.findByLabelText('Title');
    await userEvent.type(title, ' again');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('PROSPECT_LIST changed while you were editing.')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Building Your Prospect List again');
  });

  it('renders an archived module read-only, and says where it comes back from', async () => {
    render('m-gone');

    expect(await screen.findByText('This module is archived.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  it('gives a reader without write permission the module and none of the controls', async () => {
    render('m-list', READER);

    expect(await screen.findByText('Building Your Prospect List', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('answers a module that is not this office’s as not found — another office’s included', async () => {
    render('m-somebody-elses');

    expect(await screen.findByText('This module is not in your office\'s training catalog.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Training module' })).toBeInTheDocument();
  });

  it('says what files, videos and links will be, rather than drawing sections that do nothing', async () => {
    render();
    await screen.findByLabelText('Title');

    expect(screen.getByText(/Arrives in phase 5/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add file|Add video|Add link/ })).not.toBeInTheDocument();
  });
});
