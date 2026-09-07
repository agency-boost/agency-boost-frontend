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

  it('P3.5-T14 AC-7: fills the slug in from the name', async () => {
    stubFetch({ '/admin/companies': { body: [] } });
    renderInLayout(AdminLayout, <CompaniesPage />, { me: SUPER_ADMIN });

    await userEvent.type(screen.getByLabelText('Name'), 'Chubb Life & General');
    expect(screen.getByLabelText('Slug')).toHaveValue('chubb-life-general');
  });

  it('P3.5-T14 AC-7: stops deriving the moment the slug is edited', async () => {
    // Without the latch a hand-made slug is silently overwritten by the next keystroke
    // in the name — which is the worst of both, since the field still looks editable.
    stubFetch({ '/admin/companies': { body: [] } });
    renderInLayout(AdminLayout, <CompaniesPage />, { me: SUPER_ADMIN });

    await userEvent.type(screen.getByLabelText('Name'), 'Prudential');
    await userEvent.clear(screen.getByLabelText('Slug'));
    await userEvent.type(screen.getByLabelText('Slug'), 'pru-id');
    await userEvent.type(screen.getByLabelText('Name'), ' Indonesia');

    expect(screen.getByLabelText('Slug')).toHaveValue('pru-id');
  });

  it('rejects a slug the API would reject, before the round trip', async () => {
    stubFetch({ '/admin/companies': { body: [] } });
    renderInLayout(AdminLayout, <CompaniesPage />, { me: SUPER_ADMIN });

    await userEvent.type(screen.getByLabelText('Name'), 'Prudential');
    await userEvent.clear(screen.getByLabelText('Slug'));
    await userEvent.type(screen.getByLabelText('Slug'), 'Prudential Indonesia');
    expect(
      screen.getByText('Lower-case letters and digits, separated by single hyphens.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add company' })).toBeDisabled();
  });

  it('P3.5-T14: refuses a shape derivation never produces, matching the server', async () => {
    // `--a--` passed the old rule and no derived slug could ever be it. The two halves
    // now hold the same pattern, so the form cannot offer what the API will refuse.
    stubFetch({ '/admin/companies': { body: [] } });
    renderInLayout(AdminLayout, <CompaniesPage />, { me: SUPER_ADMIN });

    await userEvent.type(screen.getByLabelText('Name'), 'Prudential');
    await userEvent.clear(screen.getByLabelText('Slug'));
    await userEvent.type(screen.getByLabelText('Slug'), 'a--b');
    expect(screen.getByRole('button', { name: 'Add company' })).toBeDisabled();
  });

  it('adds the new company to the list without a reload, kept in name order', async () => {
    stubFetch({
      '/admin/companies': [
        { body: [{ ...PRUDENTIAL, _id: 'co-2', name: 'Zurich', slug: 'zurich' }] },
        { status: 201, body: PRUDENTIAL },
      ],
    });
    renderInLayout(AdminLayout, <CompaniesPage />, { me: SUPER_ADMIN });

    await screen.findByText('Zurich');
    await userEvent.type(screen.getByLabelText('Name'), 'Prudential');
    await userEvent.click(screen.getByRole('button', { name: 'Add company' }));

    const rows = await screen.findAllByRole('row');
    expect(rows[1]).toHaveTextContent('Prudential');
    expect(rows[2]).toHaveTextContent('Zurich');
    // The form clears — and so does the touched latch, or the next company's slug would
    // stop deriving for no reason the reader can see.
    expect(screen.getByLabelText('Slug')).toHaveValue('');
    await userEvent.type(screen.getByLabelText('Name'), 'Allianz');
    expect(screen.getByLabelText('Slug')).toHaveValue('allianz');
  });

  it('P3.5-T14 AC-7: puts a taken slug on the slug field, naming the incumbent', async () => {
    // This test used to stub a `CONFLICT` code the API could not produce — it passed
    // because it stubs fetch, while a real duplicate returned 500 INTERNAL_ERROR. The
    // code is real now, and so is the message.
    stubFetch({
      '/admin/companies': [
        { body: [] },
        {
          status: 409,
          body: {
            error: {
              code: 'COMPANY_SLUG_TAKEN',
              message: 'The slug "prudential" already belongs to Prudential. Edit the slug to something unique.',
              requestId: 'req-8',
            },
          },
        },
      ],
    });
    renderInLayout(AdminLayout, <CompaniesPage />, { me: SUPER_ADMIN });

    await userEvent.type(screen.getByLabelText('Name'), 'Prudential');
    await userEvent.click(screen.getByRole('button', { name: 'Add company' }));

    // On the field that caused it, not only in a banner above the form — and it names
    // the company they collided with, because the reader never chose the slug.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('already belongs to Prudential');
    expect(screen.getByLabelText('Slug')).toHaveAttribute('aria-invalid', 'true');
  });
});
