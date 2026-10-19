import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import ProfilePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/profile',
}));

/**
 * `/profile` is gated on `profile:read_self` since it gained a shell — the matrix grants
 * it at `own` in all six columns, so it refuses nobody, but a fixture still has to hold it.
 */
const ME = makeMe({ permissions: ['profile:read_self'] });

describe('profile', () => {
  afterEach(() => vi.unstubAllGlobals());

  /*
   * No *Where you stand* card (P10.1-T2 AC-10, ADR-0062 §3). Until 2026-10-01 the page listed the
   * platform role, the raw office id and every permission code, for a Phase 2 reviewer who had no
   * other screen to see them on. None of them is a customer's word, so each is asserted absent on
   * the two readers who had the most to see: a member with admin rights, and a Super Admin.
   */
  it('shows no platform role, raw office id or permission code to a member', () => {
    renderWithSession(<ProfilePage />, {
      me: makeMe({
        membership: {
          membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
          isKpmOwner: false, isKpmAdmin: true, status: 'active', directCount: 0,
        },
        permissions: ['profile:read_self', 'activity_log:create_own', 'lead:create_own'],
      }),
    });
    expect(screen.queryByText('Where you stand')).not.toBeInTheDocument();
    expect(screen.queryByText('Platform role')).not.toBeInTheDocument();
    expect(screen.queryByText('kpm-1')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ granted/)).not.toBeInTheDocument();
    expect(screen.queryByText('activity_log:create_own')).not.toBeInTheDocument();
    expect(screen.queryByText('lead:create_own')).not.toBeInTheDocument();
    // The sidebar chip still says who they are — that is the shell's, and it stays.
    expect(screen.getByText('KPM Admin')).toBeInTheDocument();
  });

  it('shows a Super Admin neither their platform role nor a console link — the console is their sidebar', () => {
    renderWithSession(<ProfilePage />, {
      me: makeMe({
        user: {
          id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
          pronoun: 'they', initials: 'R', platformRole: 'super_admin',
        },
        membership: null,
        permissions: ['profile:read_self', 'kpm:list_all'],
      }),
    });
    expect(screen.queryByText('Where you stand')).not.toBeInTheDocument();
    expect(screen.queryByText('Platform role')).not.toBeInTheDocument();
    expect(screen.queryByText('Not in an office yet')).not.toBeInTheDocument();
    expect(screen.queryByText('kpm:list_all')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /platform console/ })).not.toBeInTheDocument();
  });

  it('keeps the password and the signed-in sessions — the account\'s security stays', () => {
    renderWithSession(<ProfilePage />, { me: ME });
    expect(screen.getByRole('heading', { name: 'Your details' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Password' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Where you are signed in' })).toBeInTheDocument();
  });

  it('saves the details and confirms it', async () => {
    const { calls } = stubFetch({ '/auth/me': { body: {} }, '/auth/sessions': { body: [] } });
    renderWithSession(<ProfilePage />, { me: ME });

    await userEvent.clear(screen.getByLabelText('Preferred name'));
    await userEvent.type(screen.getByLabelText('Preferred name'), 'Rin');
    await userEvent.selectOptions(screen.getByLabelText('Pronoun'), 'she');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(patch.init.body as string)).toMatchObject({
      preferredName: 'Rin',
      pronoun: 'she',
    });
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('signs out', async () => {
    const { session } = renderWithSession(<ProfilePage />, { me: ME });
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(session.signOut).toHaveBeenCalled();
  });

  it('surfaces a rejected profile save instead of a silent no-op', async () => {
    stubFetch({
      // The profile carries the session list (P4-T13); without this its own read fails
      // and its error banner becomes a second `role="alert"` on the page.
      '/auth/sessions': { body: [] },
      '/auth/me': {
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: 'Name is required.', requestId: 'req-12' } },
      },
    });
    renderWithSession(<ProfilePage />, { me: ME });

    await userEvent.type(screen.getByLabelText('Full name'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Name is required.');
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('clears both password fields once the change succeeds', async () => {
    // Leaving them filled invites a second submit that would now fail, because the
    // current password is no longer current.
    stubFetch({ '/auth/change-password': { body: { status: 'changed' } } });
    renderWithSession(<ProfilePage />, { me: ME });

    await userEvent.type(screen.getByLabelText('Current password'), 'old password');
    await userEvent.type(screen.getByLabelText('New password'), 'a long enough password');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'a long enough password');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText(/Password changed/)).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('New password')).toHaveValue('');
    expect(screen.getByLabelText('Confirm new password')).toHaveValue('');
  });

  it('says the current password was wrong rather than appearing to succeed', async () => {
    stubFetch({
      // The profile carries the session list (P4-T13); without this its own read fails
      // and its error banner becomes a second `role="alert"` on the page.
      '/auth/sessions': { body: [] },
      '/auth/change-password': {
        status: 401,
        body: { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'That is not your current password.', requestId: 'req-13' } },
      },
    });
    renderWithSession(<ProfilePage />, { me: ME });

    await userEvent.type(screen.getByLabelText('Current password'), 'wrong password');
    await userEvent.type(screen.getByLabelText('New password'), 'a long enough password');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'a long enough password');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('not your current password');
    expect(screen.queryByText(/Password changed/)).not.toBeInTheDocument();
  });

  it('warns that a password change signs out the other sessions', () => {
    renderWithSession(<ProfilePage />, { me: ME });
    expect(screen.getByText(/signs out your other sessions/)).toBeInTheDocument();
  });

  it('holds the password button until both fields are usable', async () => {
    renderWithSession(<ProfilePage />, { me: ME });
    const submit = screen.getByRole('button', { name: 'Change password' });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Current password'), 'old password');
    await userEvent.type(screen.getByLabelText('New password'), 'short');
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('New password'), ' but now long enough');
    // Long enough, but not confirmed: changing a password is an update, and an update
    // gets the second box for the same reason a create does.
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Confirm new password'), 'short but now long');
    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Confirm new password'));
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'short but now long enough');
    expect(screen.queryByText('The two passwords do not match.')).toBeNull();
    expect(submit).toBeEnabled();
  });

  it('sends the two fields the endpoint takes, and not the confirmation', async () => {
    // `ChangePasswordDto` has no field for it, and global validation rejects an unknown
    // one — so a correctly filled form would come back a 400.
    const { calls } = stubFetch({ '/auth/change-password': { body: { status: 'changed' } } });
    renderWithSession(<ProfilePage />, { me: ME });

    await userEvent.type(screen.getByLabelText('Current password'), 'old password');
    await userEvent.type(screen.getByLabelText('New password'), 'a long enough password');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'a long enough password');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));

    const change = await vi.waitFor(() => {
      const c = calls.find((x) => x.url.includes('/auth/change-password'));
      if (!c) throw new Error('no call yet');
      return c;
    });
    expect(JSON.parse(change.init.body as string)).toEqual({
      currentPassword: 'old password',
      newPassword: 'a long enough password',
    });
  });

  it('offers to show what was typed, on all three password boxes', async () => {
    renderWithSession(<ProfilePage />, { me: ME });
    expect(screen.getAllByRole('button', { name: 'Show password' })).toHaveLength(3);
  });
});
