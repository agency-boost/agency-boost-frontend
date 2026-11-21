import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import PlatformTeamPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/platform/team',
  useSearchParams: () => new URLSearchParams(),
}));

const ME = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.id', fullName: 'PLATFORM OPERATOR', preferredName: null,
    pronoun: 'they', initials: 'PO', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'super_admin:read', 'super_admin:grant', 'super_admin:revoke'],
});

const OPERATOR = { userId: 'u-root', fullName: 'PLATFORM OPERATOR', email: 'superadmin@agencyboost.id', status: 'active', isYou: true };
const DINA = { userId: 'u-dina', fullName: 'Dina Kusuma', email: 'dina@agencyboost.id', status: 'active', isYou: false };
const RUDI = { userId: 'u-rudi', fullName: 'Rudi Hartono', email: 'rudi@agencyboost.id', status: 'active', isYou: false };

describe('Platform › Tim Super Admin (P19.23-T6 AC-2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.23-T6 AC-2 lists each Super Admin, the reader marked You with no Revoke, and the note', async () => {
    stubFetch({ '/admin/platform/team': { body: [DINA, OPERATOR] } });
    renderWithSession(<PlatformTeamPage />, { me: ME });

    const list = await screen.findByRole('list', { name: 'Super Admins' });
    const [dina, me] = within(list).getAllByRole('listitem');
    expect(dina).toHaveTextContent('Dina Kusuma');
    expect(dina).toHaveTextContent('dina@agencyboost.id');
    expect(within(dina).getByRole('button', { name: 'Revoke Dina Kusuma' })).toBeInTheDocument();
    expect(me).toHaveTextContent('You');
    expect(within(me).queryByRole('button')).toBeNull();
    expect(screen.getByText('AgencyBoost staff only')).toBeInTheDocument();
  });

  it('P19.23-T6 AC-2 adds a Super Admin by email, and draws the team the server answers', async () => {
    const stub = stubFetch({
      'GET /admin/platform/team': { body: [OPERATOR] },
      'POST /admin/platform/team': { body: [OPERATOR, RUDI] },
    });
    renderWithSession(<PlatformTeamPage />, { me: ME });

    await userEvent.click(await screen.findByRole('button', { name: 'Add Super Admin' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'rudi@agencyboost.id');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Rudi Hartono')).toBeInTheDocument();
    const post = stub.calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(String(post.init.body))).toEqual({ email: 'rudi@agencyboost.id' });
  });

  it('P19.23-T6 AC-2 says under the field why the server refused the email', async () => {
    stubFetch({
      'GET /admin/platform/team': { body: [OPERATOR] },
      'POST /admin/platform/team': {
        status: 409,
        body: { error: { code: 'SUPER_ADMIN_HAS_MEMBERSHIP', message: 'This account is a member of a KPM.', requestId: 'r-1', details: { field: 'email' } } },
      },
    });
    renderWithSession(<PlatformTeamPage />, { me: ME });

    await userEvent.click(await screen.findByRole('button', { name: 'Add Super Admin' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'owner@kpm.test');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await within(dialog).findByText('This account is a member of a KPM.')).toBeInTheDocument();
  });

  it('P19.23-T6 AC-2 revokes after a confirmation, and the row goes', async () => {
    const stub = stubFetch({
      'GET /admin/platform/team': { body: [DINA, OPERATOR] },
      'DELETE /admin/platform/team/u-dina': { body: [OPERATOR] },
    });
    renderWithSession(<PlatformTeamPage />, { me: ME });

    await userEvent.click(await screen.findByRole('button', { name: 'Revoke Dina Kusuma' }));
    const dialog = screen.getByRole('dialog', { name: /Revoke Dina Kusuma’s Super Admin role/ });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await vi.waitFor(() => expect(screen.queryByText('dina@agencyboost.id')).toBeNull());
    expect(stub.calls.some((c) => c.init.method === 'DELETE' && c.url.includes('/admin/platform/team/u-dina'))).toBe(true);
  });

  it('shows the read’s failure with Try again', async () => {
    stubFetch({ '/admin/platform/team': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r-9' } } } });
    renderWithSession(<PlatformTeamPage />, { me: ME });
    expect(await screen.findByText('This could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
