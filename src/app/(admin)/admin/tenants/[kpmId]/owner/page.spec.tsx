import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInLayout, routeParams, stubFetch } from '@test/harness';
import AssignOwnerPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/admin/tenants/kpm-1/owner',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:read_profile', 'kpm:assign_owner'],
});

const KPM = {
  _id: 'kpm-1', code: '1001', branchName: 'stellar', ownerUserId: null,
  ownerName: null, ownerEmail: null, companyName: 'Manulife',
  companyId: 'co-manulife', address: null, contactPhone: null, timezone: 'Asia/Jakarta',
  locale: 'id-ID', currency: 'IDR', status: 'active', suspendedAt: null,
  suspendedReason: null, createdAt: '2026-09-01T00:00:00.000Z', settings: {},
};

/** An account as `GET /admin/accounts` answers it. */
const account = (over: Record<string, unknown> = {}) => ({
  userId: 'u-victor', fullName: 'Victor Gunawan', email: 'victor@example.test', phone: null,
  companyId: 'co-manulife', companyName: 'Manulife', hasAgentCode: true, emailVerified: true, status: 'active',
  offices: [], ...over,
});

const params = routeParams({ kpmId: 'kpm-1' });

describe('assign owner', () => {
  afterEach(() => {
    push.mockClear();
    vi.unstubAllGlobals();
  });

  it('spells out what a change of Owner costs the outgoing one', async () => {
    stubFetch({
      '/admin/tenants/kpm-1': {
        body: { ...KPM, ownerUserId: 'u-old', ownerName: 'Budi Santoso', ownerEmail: 'budi@kpm0417.test' },
      },
    });
    renderInLayout(AdminLayout, <AssignOwnerPage params={params} />, { me: SUPER_ADMIN });

    // UI-168 point 4: *Ganti Owner*.
    expect(await screen.findByRole('heading', { name: 'Change owner' })).toBeInTheDocument();
    expect(screen.getByText(/audited with both the outgoing and incoming/)).toBeInTheDocument();
    // P3.1-T14 AC-7: an English sentence whose subject was a hex string now names them.
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText(/budi@kpm0417.test/)).toBeInTheDocument();
    expect(screen.queryByText('u-old')).not.toBeInTheDocument();
  });

  it('P19-T3 AC-5 picks an existing account by name, showing what it already owns or belongs to, and assigns it', async () => {
    const { calls } = stubFetch({
      '/admin/accounts': { body: [account({
        offices: [{ kpmId: 'k-9', code: '0555', branchName: 'Kelapa Gading', companyName: 'Manulife', isOwner: false, membershipStatus: 'active' }],
      })] },
      '/admin/tenants/kpm-1/owner': { body: {} },
      '/admin/tenants/kpm-1': { body: KPM },
    });
    renderInLayout(AdminLayout, <AssignOwnerPage params={params} />, { me: SUPER_ADMIN });

    const assign = await screen.findByRole('button', { name: 'Assign' });
    expect(assign).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Find the account'), 'vic');
    const choice = await screen.findByRole('button', { name: 'Choose Victor Gunawan' });
    expect(choice).toHaveTextContent('victor@example.test · Manulife');
    expect(choice).toHaveTextContent('Member · KPM 0555 · Kelapa Gading (Manulife)');
    await userEvent.click(choice);
    expect(screen.getByRole('button', { name: 'Victor Gunawan chosen' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(assign);

    expect(calls.some((c) => c.url.includes('/admin/accounts?q=vic'))).toBe(true);
    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(patch.init.body as string)).toEqual({ userId: 'u-victor' });
    expect(push).toHaveBeenCalledWith('/admin/tenants/kpm-1');
  });

  it('P19-T3 AC-5 shows who already owns an office, and says why an account cannot own this one', async () => {
    stubFetch({
      '/admin/accounts': { body: [
        account({ offices: [{ kpmId: 'k-1', code: '0417', branchName: 'BSD', companyName: 'Manulife', isOwner: true, membershipStatus: 'active' }] }),
        account({ userId: 'u-rina', fullName: 'Rina Wijaya', email: 'rina@example.test', companyId: 'co-pru', companyName: 'Prudential' }),
        account({ userId: 'u-dewi', fullName: 'Dewi Lestari', email: 'dewi@example.test', emailVerified: false }),
      ] },
      '/admin/tenants/kpm-1': { body: KPM },
    });
    renderInLayout(AdminLayout, <AssignOwnerPage params={params} />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Find the account'), 'ex');
    expect(await screen.findByText('Owner · KPM 0417 · BSD (Manulife)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Rina Wijaya' })).toBeDisabled();
    expect(screen.getByText('Signed up with Prudential, not this office’s company')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Dewi Lestari' })).toBeDisabled();
    expect(screen.getByText('Email address not verified: cannot own an office yet')).toBeInTheDocument();
  });

  it.each([375, 1280])('P19.4-T3 AC-6 at %ipx, with no account at a typed address, makes them the Owner and invites them by email (ADR-0212 §3)', async (px) => {
    atWidth(px);
    const { calls } = stubFetch({
      '/admin/accounts': { body: [] },
      '/admin/tenants/kpm-1/owner': { body: { ...KPM, ownerUserId: 'u-new', ownerName: 'Victor Gunawan', ownerState: 'invited' } },
      '/admin/tenants/kpm-1': { body: KPM },
    });
    renderInLayout(AdminLayout, <AssignOwnerPage params={params} />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Find the account'), 'Victor@Example.test');
    expect(await screen.findByText('No account uses that address.')).toBeInTheDocument();
    // The `mailto:` that asked them to register is gone: the API invites them.
    expect(screen.queryByRole('link', { name: 'Send an invitation' })).toBeNull();
    const submit = screen.getByRole('button', { name: 'Make owner and invite' });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Name'), 'Victor Gunawan');
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '0812 1100 2200');
    await userEvent.type(screen.getByLabelText('Owner’s agent code'), '70011223');
    expect(screen.getByRole('checkbox', { name: 'Send the invitation by email' })).toBeChecked();
    await userEvent.click(submit);

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/admin/tenants/kpm-1'));
    expect(JSON.parse(calls.find((c) => c.init.method === 'PATCH')!.init.body as string)).toEqual({
      owner: { fullName: 'Victor Gunawan', phone: '0812 1100 2200', email: 'victor@example.test', agentCode: '70011223' },
      sendInvitation: true,
    });
    // The toast is drawn after the navigation is asked for, a tick later under load: wait for it, as for the push.
    await vi.waitFor(() => expect(
      screen.getAllByRole('status').some((r) => r.textContent?.includes('Owner set. Invitation sent.')),
    ).toBe(true));
  });

  it('P19.4-T3 AC-6 names a pending Owner — named at KPM baru with no email — and fills in what is known of them', async () => {
    stubFetch({
      '/admin/accounts': { body: [] },
      '/admin/tenants/kpm-1': {
        body: { ...KPM, ownerState: 'not_invited', pendingOwner: { fullName: 'Wulan Kartika', phone: '+6281277006020', agentCode: '70045001' } },
      },
    });
    renderInLayout(AdminLayout, <AssignOwnerPage params={params} />, { me: SUPER_ADMIN });
    expect(await screen.findByText(/Wulan Kartika is named as this KPM’s owner but has no email yet/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Find the account'), 'wulan@bandung.test');
    expect(await screen.findByLabelText('Name')).toHaveValue('Wulan Kartika');
    expect(screen.getByLabelText('WhatsApp number')).toHaveValue('+6281277006020');
    expect(screen.getByLabelText('Owner’s agent code')).toHaveValue('70045001');
    expect(screen.getByRole('button', { name: 'Make owner and invite' })).toBeEnabled();
  });

  it('P19-T3 AC-5 says plainly when nothing matches a name', async () => {
    stubFetch({ '/admin/accounts': { body: [] }, '/admin/tenants/kpm-1': { body: KPM } });
    renderInLayout(AdminLayout, <AssignOwnerPage params={params} />, { me: SUPER_ADMIN });
    await userEvent.type(await screen.findByLabelText('Find the account'), 'zzz');
    expect(await screen.findByText('No account matches that.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Send an invitation' })).toBeNull();
  });

  it('P19-T3 AC-5 shows the API refusing an account of another company, as the API words it', async () => {
    stubFetch({
      '/admin/accounts': { body: [account()] },
      '/admin/tenants/kpm-1/owner': {
        status: 409,
        body: { error: { code: 'TENANT_COMPANY_MISMATCH', message: 'Victor Gunawan signed up with Manulife, and this office is Prudential\'s.', requestId: 'r-9' } },
      },
      '/admin/tenants/kpm-1': { body: KPM },
    });
    renderInLayout(AdminLayout, <AssignOwnerPage params={params} />, { me: SUPER_ADMIN });
    await userEvent.type(await screen.findByLabelText('Find the account'), 'victor');
    await userEvent.click(await screen.findByRole('button', { name: 'Choose Victor Gunawan' }));
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('signed up with Manulife');
    expect(push).not.toHaveBeenCalled();
  });

  it('P13.2-T4 AC-5: says an office at its leader limit cannot take a new Owner, and where to raise it', async () => {
    stubFetch({
      '/admin/accounts': { body: [account()] },
      '/admin/tenants/kpm-1/owner': {
        status: 409,
        body: { error: { code: 'LEADER_LIMIT_REACHED', message: 'x', details: { maxLeaders: 2, leadersUsed: 2 }, requestId: 'r' } },
      },
      '/admin/tenants/kpm-1': { body: KPM },
    });
    renderInLayout(AdminLayout, <AssignOwnerPage params={params} />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Find the account'), 'victor');
    await userEvent.click(await screen.findByRole('button', { name: 'Choose Victor Gunawan' }));
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This office has reached its limit of 2 leaders, so its new Owner cannot be added as an AB.');
    expect(alert).toHaveTextContent('Raise it with Edit subscription on the offices list first, then try again.');
    expect(alert).not.toHaveTextContent('LEADER_LIMIT_REACHED');
    expect(push).not.toHaveBeenCalled();
  });

  it('has no axe violations with the picker open', async () => {
    stubFetch({ '/admin/accounts': { body: [account()] }, '/admin/tenants/kpm-1': { body: KPM } });
    const { container } = renderInLayout(AdminLayout, <AssignOwnerPage params={params} />, { me: SUPER_ADMIN });
    await userEvent.type(await screen.findByLabelText('Find the account'), 'victor');
    await screen.findByRole('button', { name: 'Choose Victor Gunawan' });
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toHaveLength(0);
  });
});
