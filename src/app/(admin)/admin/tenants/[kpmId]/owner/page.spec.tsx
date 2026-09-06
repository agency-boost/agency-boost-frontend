import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch } from '@test/harness';
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
    renderInLayout(AdminLayout, <AssignOwnerPage params={params} />, { me: SUPER_ADMIN });

    expect(await screen.findByRole('heading', { name: 'Transfer owner' })).toBeInTheDocument();
    expect(screen.getByText(/audited with both the outgoing and incoming/)).toBeInTheDocument();
    expect(screen.getByText('u-old')).toBeInTheDocument();
  });

  it('assigns by email and returns to the office', async () => {
    // Email, not a Mongo id: it is what a Super Admin knows, it is what §6.1 of
    // roles-and-permissions.md describes, and the console offers no way to learn an id.
    const { calls } = stubFetch({
      '/admin/tenants/kpm-1/owner': { body: {} },
      '/admin/tenants/kpm-1': { body: KPM },
    });
    renderInLayout(AdminLayout, <AssignOwnerPage params={params} />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Email'), '  owner@kpm0417.test  ');
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));

    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    // Trimmed: a pasted address routinely carries whitespace.
    expect(JSON.parse(patch.init.body as string)).toEqual({ email: 'owner@kpm0417.test' });
    expect(push).toHaveBeenCalledWith('/admin/tenants/kpm-1');
  });

  it('says plainly that no account uses that address', async () => {
    stubFetch({
      '/admin/tenants/kpm-1/owner': {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'User not found.', requestId: 'req-5' } },
      },
      '/admin/tenants/kpm-1': { body: KPM },
    });
    renderInLayout(AdminLayout, <AssignOwnerPage params={params} />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Email'), 'nobody@nowhere.test');
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));

    // Announced once, on the field it belongs to — not also as a banner, which a
    // screen reader would read as a second, separate failure.
    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('No account uses that address.');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(push).not.toHaveBeenCalled();
  });

  it('offers the way to create the account it needs', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderInLayout(AdminLayout, <AssignOwnerPage params={params} />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('link', { name: 'Create one' })).toHaveAttribute(
      'href',
      '/register',
    );
  });
});
