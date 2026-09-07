import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import NewTenantPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/admin/tenants/new',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:create'],
});

const COMPANIES = [{ _id: 'co-1', name: 'Prudential', slug: 'prudential' }];

describe('new tenant', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends users to create an insurer first when there is none', async () => {
    // An office belongs to exactly one insurer, so the form is unusable without one.
    stubFetch({ '/admin/companies': { body: [] } });
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

    expect(await screen.findByRole('link', { name: 'Create a company first' })).toHaveAttribute(
      'href',
      '/admin/companies',
    );
    expect(screen.queryByLabelText('Office code')).not.toBeInTheDocument();
  });

  it('rejects a code the API would reject, before the round trip', async () => {
    stubFetch({ '/admin/companies': { body: COMPANIES } });
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Office code'), 'has space');
    expect(screen.getByText('2–16 characters: letters, digits and hyphens.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create office' })).toBeDisabled();
  });

  it('omits blank optional fields instead of sending empty strings', async () => {
    const { calls } = stubFetch({
      '/admin/companies': { body: COMPANIES },
      '/admin/tenants': { status: 201, body: { _id: 'kpm-9' } },
    });
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Office code'), '0417');
    await userEvent.type(screen.getByLabelText('Branch name'), 'BSD City Branch');
    await userEvent.click(screen.getByRole('button', { name: 'Create office' }));

    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(post.init.body as string)).toEqual({
      companyId: 'co-1',
      code: '0417',
      branchName: 'BSD City Branch',
    });
    expect(push).toHaveBeenCalledWith('/admin/tenants/kpm-9');
  });

  it('surfaces a duplicate code as the server explains it', async () => {
    stubFetch({
      '/admin/companies': { body: COMPANIES },
      '/admin/tenants': {
        status: 409,
        body: {
          error: {
            code: 'TENANT_CODE_TAKEN',
            message: 'KPM code 0417 is already used by Prudential.',
            requestId: 'req-4',
          },
        },
      },
    });
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Office code'), '0417');
    await userEvent.type(screen.getByLabelText('Branch name'), 'BSD City Branch');
    await userEvent.click(screen.getByRole('button', { name: 'Create office' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already used by Prudential');
    expect(push).not.toHaveBeenCalledWith('/admin/tenants/kpm-9');
  });

  it('P3.5-T14 AC-7: shows the time zone and refuses to let anybody type one', async () => {
    // This asserted "Blank inherits the insurer's" — a hint on a free-text box that
    // accepted `Asia/Jakata` in both halves and broke every day boundary in that office
    // for ever, silently. The requirement it protected survives: the value is explained
    // rather than left a mystery. What changed is that it is no longer a control.
    stubFetch({ '/admin/companies': { body: COMPANIES } });
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Asia/Jakarta')).toBeInTheDocument();
    expect(screen.getByText(/v1 runs every office on Jakarta time/)).toBeInTheDocument();
    // Not a disabled input either: disabled reads as "not available right now", and this
    // is a permanent product decision (ADR-0016).
    expect(screen.queryByLabelText('Time zone')).not.toBeInTheDocument();
  });
});
