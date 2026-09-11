import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import ActivityTypesPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/activity-types',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write'],
});

const AGENT = makeMe({
  membership: {
    membershipId: 'mem-9', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent',
    status: 'active', isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read'],
});

const type = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 't1', code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis',
  description: null, displayOrder: 2, version: 1, status: 'active', ...over,
});

const TAXONOMY = [{
  id: 'c1', code: 'SELLING', label: 'Selling', displayOrder: 1, version: 1, status: 'active',
  types: [
    type({ id: 't0', code: 'SELL_PRESENTATION', label: 'Presentasi penjualan', displayOrder: 1 }),
    type(),
  ],
}];

function render(me = OWNER, body: unknown = TAXONOMY) {
  const stub = stubFetch({ '/kpm/settings/activity-types': { body } });
  renderWithSession(<ActivityTypesPage />, { me });
  return stub;
}

describe('the office activity taxonomy (P4-T1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('groups the types into the cards the prototype draws', async () => {
    render();
    const heading = await screen.findByRole('heading', { name: 'Selling' });
    const card = heading.closest('div')!.parentElement!;
    expect(within(card).getByText(/2 items/)).toBeInTheDocument();
    expect(await screen.findByText('Submission polis')).toBeInTheDocument();
  });

  it('shows the code beside every row, because it is the part that does not move', async () => {
    /*
     * The prototype numbers its items 1–12 and binds its ratio formulas to those numbers.
     * Here the number is position and the code is identity — so the code is on screen,
     * next to the number that is about to change when somebody reorders.
     */
    render();
    expect(await screen.findByText('SELL_SUBMISSION')).toBeInTheDocument();
    expect(screen.getByText('SELLING')).toBeInTheDocument();
  });

  it('sends every id in the new order when one row moves', async () => {
    // Not a single move: two people dragging at once would otherwise interleave into an
    // order neither asked for.
    const { calls } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Move Submission polis up' }));

    const call = calls.find((c) => c.url.includes('/reorder'))!;
    expect(JSON.parse(call.init.body as string)).toEqual({ ids: ['t1', 't0'] });
  });

  it('cannot move the first row up or the last row down', async () => {
    render();
    await screen.findByText('Submission polis');
    expect(screen.getByRole('button', { name: 'Move Presentasi penjualan up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Submission polis down' })).toBeDisabled();
  });

  it('archives rather than deletes, and says so on the control', async () => {
    const { calls } = render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Archive' }))[0]);
    const call = calls.find((c) => c.init.method === 'DELETE')!;
    expect(call.url).toContain('/kpm/settings/activity-types/t0');
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('asks for the archived ones only when told to', async () => {
    const { calls } = render();
    await screen.findByText('Submission polis');
    expect(calls.some((c) => c.url.includes('includeArchived'))).toBe(false);

    await userEvent.click(screen.getByLabelText('Show archived'));
    expect(calls.some((c) => c.url.includes('includeArchived=true'))).toBe(true);
  });

  it('offers an archived row a way back', async () => {
    render(OWNER, [{
      ...TAXONOMY[0],
      types: [type({ status: 'archived' })],
    }]);
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });

  it('sends a new type under the category it was added to', async () => {
    const { calls } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Add to Selling' }));
    await userEvent.type(screen.getByLabelText('Code'), 'sell_referral');
    await userEvent.type(screen.getByLabelText('Label'), 'Referral masuk');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    const call = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(call.init.body as string)).toMatchObject({
      // Upper-cased as it is typed, so what is sent is what the person saw.
      code: 'SELL_REFERRAL', categoryCode: 'SELLING', label: 'Referral masuk',
    });
  });

  it('never offers to change a code, only a label', async () => {
    // A published code is what every activity log, ratio formula and goal target holds.
    render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    expect(screen.getByLabelText('Label')).toBeInTheDocument();
    expect(screen.queryByLabelText('Code')).toBeNull();
  });

  it('shows an agent the taxonomy and none of the controls', async () => {
    // The API refuses them too — this is convenience, not control.
    render(AGENT);
    expect(await screen.findByText('Submission polis')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add to/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('surfaces a refusal rather than appearing to succeed', async () => {
    const { calls } = render();
    await screen.findByText('Submission polis');
    void calls;
    stubFetch({
      '/kpm/settings/activity-types': { body: TAXONOMY },
      '/kpm/settings/activity-types/t0': {
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: 'Nothing to change.', requestId: 'r-1' } },
      },
    });
    await userEvent.click((await screen.findAllByRole('button', { name: 'Archive' }))[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing to change.');
  });
});
