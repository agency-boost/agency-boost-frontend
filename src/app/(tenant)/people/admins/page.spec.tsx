import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import AdminsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/admins',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 2,
  },
  permissions: ['member:read_profile', 'kpm_admin:grant', 'kpm_admin:revoke', 'kpm_admin:list'],
});

const admin = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-admin', fullName: 'Maya Halim', initials: 'MH',
  agentCode: 'KPM0417-002', role: 'ab', grantedAt: '2026-01-14T00:00:00.000Z',
  grantedByName: 'Wilson Tanoto', canRevoke: true, ...over,
});

const node = (over: Record<string, unknown>) => ({
  fullName: 'Somebody', preferredName: null, initials: 'SB', agentCode: 'KPM0417-000',
  role: 'agent', depth: 0, layer: 1, leaderId: null, directCount: 0, subtreeCount: 0,
  isLeader: false, isSelf: false, ...over,
});

const OFFICE = {
  nodes: [
    node({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', role: 'ab' }),
    node({ membershipId: 'mem-admin', fullName: 'Maya Halim', role: 'ab' }),
    node({ membershipId: 'mem-agus', fullName: 'Agus Prasetyo', role: 'ab' }),
  ],
  leader: null, rootIds: ['mem-owner'], selfId: 'mem-owner',
  counts: { ab: 2, aab: 0, agent: 0, total: 2 },
};

function open(admins: Record<string, unknown>[] = [admin()], extra: Record<string, unknown> = {}) {
  const stub = stubFetch({
    '/members/admins': { body: admins },
    '/members/tree': { body: OFFICE },
    ...extra,
  });
  renderInLayout(TenantLayout, <AdminsPage />, { me: OWNER });
  return stub;
}

describe('manage KPM admins (P3-T10)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2: shows the hierarchy role beside the name, because the two are separate', async () => {
    // Both of the prototype's own seeded admins are ABs. Leaving the role off would
    // make "an AB who is also an Admin" read as a contradiction.
    open();
    const row = within(await screen.findByRole('table')).getByRole('row', { name: /Maya/ });
    expect(within(row).getByTitle('Agency Builder')).toBeInTheDocument();
  });

  it('AC-4: names the one thing an Admin does not get', async () => {
    open();
    const blurb = (await screen.findByText(/except one thing: grant or revoke admin access/))
      .closest('p')!;
    // Branch info and products left this list with ADR-0027, the Leader Forum with ADR-0028.
    expect(blurb).not.toHaveTextContent('Branch info');
    expect(blurb).not.toHaveTextContent('products');
    expect(blurb).not.toHaveTextContent('Leader Forum');
    // And the thing most likely to be misread — the <strong> splits the text node.
    expect(blurb).toHaveTextContent('Admin access is not a hierarchy role');
  });

  it('says when access was granted and by whom', async () => {
    open();
    const row = within(await screen.findByRole('table')).getByRole('row', { name: /Maya/ });
    expect(row).toHaveTextContent('Jan 2026');
    expect(row).toHaveTextContent('Wilson Tanoto');
  });

  it('offers only people who are not already admins', async () => {
    open();
    const picker = await screen.findByLabelText('Grant admin access to');
    expect(within(picker).getByRole('option', { name: 'Agus Prasetyo' })).toBeInTheDocument();
    expect(within(picker).queryByRole('option', { name: 'Maya Halim' })).not.toBeInTheDocument();
  });

  it('grants to the person picked', async () => {
    const { calls } = open();
    await userEvent.selectOptions(
      await screen.findByLabelText('Grant admin access to'),
      'mem-agus',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Grant access' }));

    const sent = calls.find((c) => c.init.method === 'POST')!;
    expect(sent.url).toContain('/members/mem-agus/admin');
  });

  it('will not grant until somebody is picked', async () => {
    open();
    expect(await screen.findByRole('button', { name: 'Grant access' })).toBeDisabled();
  });

  it('says what revoking does and does not do, and changes nothing until confirmed', async () => {
    const { calls } = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));

    expect(screen.getByText(/Take Maya Halim's admin access away\?/)).toBeInTheDocument();
    expect(screen.getByText(/keep their place in the office and their unit/)).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Revoke access' }));
    expect(calls.find((c) => c.init.method === 'DELETE')!.url).toContain('/members/mem-admin/admin');
  });

  it('offers no revoke on a row the server says is not revocable', async () => {
    // The Owner's own access comes from being the Owner, not from a grant. The server
    // decides that; the screen renders the answer.
    open([admin({ membershipId: 'mem-owner', fullName: 'Wilson Tanoto', canRevoke: false,
                  grantedByName: null, grantedAt: null })]);
    const row = within(await screen.findByRole('table')).getByRole('row', { name: /Wilson/ });
    expect(within(row).queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(row).toHaveTextContent('Yours');
  });

  it('has an empty state that says what to do', async () => {
    open([]);
    expect(await screen.findByText(/Nobody administers this office but you/)).toBeInTheDocument();
  });

  it('surfaces a refusal rather than looking like it worked', async () => {
    open([admin()], {
      '/members/mem-admin/admin': {
        status: 403,
        body: {
          error: {
            code: 'PERM_OWNER_ONLY',
            message: 'Only this office’s Owner can do that.',
            requestId: 'r-1',
          },
        },
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    await userEvent.click(screen.getByRole('button', { name: 'Revoke access' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only this office’s Owner can do that');
  });

  it('AC-1: never renders for an Admin, who lacks the grant permission', async () => {
    renderInLayout(TenantLayout, <AdminsPage />, {
      me: makeMe({
        membership: {
          membershipId: 'mem-admin', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
          isKpmOwner: false, isKpmAdmin: true, status: 'active', directCount: 0,
        },
        permissions: ['member:read_profile', 'kpm_admin:list'],
      }),
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    // The gate's code is on the refusal as data, and never in its words (P11-T6).
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'kpm_admin:grant');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
