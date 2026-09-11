import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import LeadStatusesPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/lead-statuses',
}));

const membership = {
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({ membership, permissions: ['tenant_config:read', 'tenant_config:write'] });
const AGENT = makeMe({
  membership: { ...membership, orgLevelCode: 'AGENT', hierarchyRole: 'agent' as const, isKpmOwner: false },
  permissions: ['tenant_config:read'],
});

const stage = (over: Record<string, unknown> = {}) => ({
  id: 's1', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Follow-up', rank: 2,
  isTerminal: false, version: 1, status: 'active', ...over,
});

const PIPELINES = [
  {
    pipeline: 'sales',
    statuses: [
      stage({ id: 's0', code: 'NOT_YET_APPROACHED', label: 'Not yet approached', rank: 1 }),
      stage(),
      stage({ id: 's2', code: 'PAID_AND_ISSUED', label: 'Paid and issued', rank: 3, isTerminal: true }),
    ],
  },
  { pipeline: 'recruitment', statuses: [stage({ id: 'r0', pipeline: 'recruitment', code: 'NOT_APPROACHED', label: 'Not approached', rank: 1, isTerminal: true })] },
];

function render(me = OWNER, body: unknown = PIPELINES) {
  const stub = stubFetch({ '/kpm/settings/lead-statuses': { body } });
  renderWithSession(<LeadStatusesPage />, { me });
  return stub;
}

describe('the office lead pipelines (P4-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows both ladders', async () => {
    render();
    expect(await screen.findByRole('heading', { name: 'Sales' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recruitment' })).toBeInTheDocument();
    expect(screen.getByText('Paid and issued')).toBeInTheDocument();
  });

  it('marks the stage that closes a pipeline, rather than leaving it implied', async () => {
    /*
     * The prototype gates *mark successful* on the last element of a hardcoded array, so
     * adding a stage after the end would silently move the gate. Here it is a badge on
     * one stage, and moving it is a deliberate act.
     */
    render();
    expect(await screen.findAllByText('Closes the pipeline')).toHaveLength(2);
  });

  it('shows the code beside every stage, because a lead holds the code', async () => {
    render();
    expect(await screen.findByText('PAID_AND_ISSUED')).toBeInTheDocument();
  });

  it('will not archive the stage that closes a pipeline', async () => {
    // Leads would have no way to be marked successful, and the leads screen would not say
    // why the tick stopped working. The server refuses it too.
    render();
    await screen.findByText('Paid and issued');
    const archives = screen.getAllByRole('button', { name: 'Archive' });
    // The terminal stage is the third row of sales; its Archive is disabled.
    expect(archives[2]).toBeDisabled();
    expect(archives[0]).toBeEnabled();
  });

  it('offers to move the closing stage only to one that is not already it', async () => {
    render();
    await screen.findByText('Paid and issued');
    expect(screen.getAllByRole('button', { name: 'Make this close the pipeline' }))
      .toHaveLength(2);
  });

  it('sends the whole pipeline when a stage moves, and only that pipeline', async () => {
    const { calls } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Move Follow-up up' }));

    const call = calls.find((c) => c.url.includes('/reorder'))!;
    expect(JSON.parse(call.init.body as string)).toEqual({
      pipeline: 'sales', ids: ['s1', 's0', 's2'],
    });
  });

  it('adds a stage to the pipeline it was added under', async () => {
    const { calls } = render();
    await userEvent.click(await screen.findByRole('button', { name: 'Add a recruitment stage' }));
    await userEvent.type(screen.getByLabelText('Code'), 'aaji_pending');
    await userEvent.type(screen.getByLabelText('Label'), 'AAJI pending');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    const call = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(call.init.body as string)).toEqual({
      pipeline: 'recruitment', code: 'AAJI_PENDING', label: 'AAJI pending',
    });
  });

  it('never offers to change a code', async () => {
    render();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    expect(screen.getByLabelText('Label')).toBeInTheDocument();
    expect(screen.queryByLabelText('Code')).toBeNull();
  });

  it('shows an agent the ladders and none of the controls', async () => {
    render(AGENT);
    expect(await screen.findByText('Paid and issued')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add a/ })).toBeNull();
  });
});
