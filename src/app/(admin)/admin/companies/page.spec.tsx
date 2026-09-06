import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import CompaniesPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'company:crud'],
});

const PRUDENTIAL = {
  _id: 'co-1', name: 'Prudential', slug: 'prudential',
  defaultCurrency: 'IDR', defaultTimezone: 'Asia/Jakarta', status: 'active',
};

describe('companies', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the defaults an office will inherit', async () => {
    stubFetch({ '/admin/companies': { body: [PRUDENTIAL] } });
    renderInLayout(AdminLayout, <CompaniesPage />, { me: SUPER_ADMIN });

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /Prudential/ });
    expect(within(row).getByText('IDR')).toBeInTheDocument();
    expect(within(row).getByText('Asia/Jakarta')).toBeInTheDocument();
  });

  it('rejects a slug the API would reject, before the round trip', async () => {
    stubFetch({ '/admin/companies': { body: [] } });
    renderInLayout(AdminLayout, <CompaniesPage />, { me: SUPER_ADMIN });

    await userEvent.type(screen.getByLabelText('Name'), 'Prudential');
    await userEvent.type(screen.getByLabelText('Slug'), 'Prudential Indonesia');
    expect(screen.getByText('Lower-case letters, digits and hyphens only.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add insurer' })).toBeDisabled();
  });

  it('adds the new insurer to the list without a reload, kept in name order', async () => {
    stubFetch({
      '/admin/companies': [
        { body: [{ ...PRUDENTIAL, _id: 'co-2', name: 'Zurich', slug: 'zurich' }] },
        { status: 201, body: PRUDENTIAL },
      ],
    });
    renderInLayout(AdminLayout, <CompaniesPage />, { me: SUPER_ADMIN });

    await screen.findByText('Zurich');
    await userEvent.type(screen.getByLabelText('Name'), 'Prudential');
    await userEvent.type(screen.getByLabelText('Slug'), 'prudential');
    await userEvent.click(screen.getByRole('button', { name: 'Add insurer' }));

    const rows = await screen.findAllByRole('row');
    expect(rows[1]).toHaveTextContent('Prudential');
    expect(rows[2]).toHaveTextContent('Zurich');
    // The form clears, so a second insurer does not inherit the first one's slug.
    expect(screen.getByLabelText('Slug')).toHaveValue('');
  });

  it('surfaces a duplicate slug rather than silently doing nothing', async () => {
    stubFetch({
      '/admin/companies': [
        { body: [] },
        {
          status: 409,
          body: { error: { code: 'CONFLICT', message: 'Slug already taken.', requestId: 'req-8' } },
        },
      ],
    });
    renderInLayout(AdminLayout, <CompaniesPage />, { me: SUPER_ADMIN });

    await userEvent.type(screen.getByLabelText('Name'), 'Prudential');
    await userEvent.type(screen.getByLabelText('Slug'), 'prudential');
    await userEvent.click(screen.getByRole('button', { name: 'Add insurer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Slug already taken.');
  });
});
