import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, routeParams, stubFetch } from '../../../../../../test/harness';
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
  _id: 'kpm-1', code: '0417', branchName: 'BSD City Branch', ownerUserId: null,
  companyId: 'co-1', address: null, contactPhone: null, timezone: 'Asia/Jakarta',
  locale: 'id-ID', currency: 'IDR', status: 'active', suspendedAt: null,
  suspendedReason: null, createdAt: '2026-09-01T00:00:00.000Z', settings: {},
};

const params = routeParams({ kpmId: 'kpm-1' });

describe('assign owner', () => {
  afterEach(() => {
    push.mockClear();
    vi.unstubAllGlobals();
  });

  it('spells out what a transfer costs the outgoing owner', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: { ...KPM, ownerUserId: 'u-old' } } });
    renderWithSession(<AssignOwnerPage params={params} />, { me: SUPER_ADMIN });

    expect(await screen.findByRole('heading', { name: 'Transfer owner' })).toBeInTheDocument();
    expect(screen.getByText(/audited with both the outgoing and incoming/)).toBeInTheDocument();
    expect(screen.getByText('u-old')).toBeInTheDocument();
  });

  it('assigns and returns to the office', async () => {
    const { calls } = stubFetch({
      '/admin/tenants/kpm-1/owner': { body: {} },
      '/admin/tenants/kpm-1': { body: KPM },
    });
    renderWithSession(<AssignOwnerPage params={params} />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('User id'), '  u-new  ');
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));

    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    // Trimmed: a pasted id routinely carries whitespace, and the API would 404 on it.
    expect(JSON.parse(patch.init.body as string)).toEqual({ userId: 'u-new' });
    expect(push).toHaveBeenCalledWith('/admin/tenants/kpm-1');
  });

  it('marks the field invalid when the user does not exist', async () => {
    stubFetch({
      '/admin/tenants/kpm-1/owner': {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'User not found.', requestId: 'req-5' } },
      },
      '/admin/tenants/kpm-1': { body: KPM },
    });
    renderWithSession(<AssignOwnerPage params={params} />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('User id'), 'u-missing');
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('User not found.');
    expect(screen.getByLabelText('User id')).toHaveAttribute('aria-invalid', 'true');
    expect(push).not.toHaveBeenCalled();
  });
});
