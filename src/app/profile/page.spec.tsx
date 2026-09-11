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

  it('shows the permissions the server resolved, not a guess from the role', async () => {
    renderWithSession(<ProfilePage />, {
      me: makeMe({ permissions: ['profile:read_self', 'activity_log:create_own', 'lead:create_own'] }),
    });
    await userEvent.click(screen.getByText('3 granted'));
    expect(screen.getByText('activity_log:create_own')).toBeInTheDocument();
  });

  it('names a person without a KPM honestly instead of showing a blank office', () => {
    renderWithSession(<ProfilePage />, { me: makeMe({ membership: null, permissions: ['profile:read_self'] }) });
    expect(screen.getByText('Not in an office yet')).toBeInTheDocument();
  });

  it('shows tenant-admin rights alongside the hierarchy role, not instead of it', () => {
    // The two are orthogonal: a person can be an AB and a KPM Admin at once.
    renderWithSession(<ProfilePage />, {
      me: makeMe({
        membership: {
          membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
          isKpmOwner: false, isKpmAdmin: true, status: 'active', directCount: 0,
        },
        permissions: ['profile:read_self'],
      }),
    });
    expect(screen.getByTitle('Agency Builder')).toBeInTheDocument();
    // Twice on purpose: the profile's own badge, and the sidebar identity chip that the
    // shell now renders — which is what makes the chrome worth having.
    expect(screen.getAllByText('KPM Admin').length).toBeGreaterThan(1);
  });

  it('offers the platform console only to a Super Admin', () => {
    const { unmount } = renderWithSession(<ProfilePage />, { me: ME });
    expect(screen.queryByRole('link', { name: /platform console/ })).not.toBeInTheDocument();
    unmount();

    renderWithSession(<ProfilePage />, {
      me: makeMe({
        user: {
          id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
          pronoun: 'they', initials: 'R', platformRole: 'super_admin',
        },
        permissions: ['profile:read_self'],
      }),
    });
    expect(screen.getByRole('link', { name: /platform console/ })).toHaveAttribute('href', '/admin');
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
