import { fireEvent, screen } from '@testing-library/react';
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

  /*
   * P18.8-T15 AC-1 (UI-005): an emptied preferred name is sent as none. It went as `''`, which the API stored,
   * and every `preferredName ?? fullName` then printed a blank where the name belonged.
   */
  it('P18.8-T15 AC-1: sends null for an emptied or blank preferred name, and a real one trimmed', async () => {
    const { calls } = stubFetch({ '/auth/me': { body: {} }, '/auth/sessions': { body: [] } });
    renderWithSession(<ProfilePage />, { me: makeMe({ permissions: ['profile:read_self'], user: { ...ME.user, preferredName: 'Rin' } }) });

    await userEvent.clear(screen.getByLabelText('Preferred name'));
    await userEvent.type(screen.getByLabelText('Preferred name'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const blank = calls.filter((c) => c.init.method === 'PATCH').at(-1)!;
    expect(JSON.parse(blank.init.body as string).preferredName).toBeNull();
    expect(await screen.findByText('Saved.')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Preferred name'));
    await userEvent.type(screen.getByLabelText('Preferred name'), ' Rina ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const named = calls.filter((c) => c.init.method === 'PATCH').at(-1)!;
    expect(JSON.parse(named.init.body as string).preferredName).toBe('Rina');
  });

  /*
   * P18.8-T4 AC-6 (ADR-0158 §3): what a person records, shown and theirs to complete. Somebody who
   * arrived before it was asked has none, and fills it in here.
   */
  it('P18.8-T4 AC-6: shows the four, Not recorded where somebody has given none', () => {
    renderWithSession(<ProfilePage />, {
      me: makeMe({
        permissions: ['profile:read_self'],
        user: { ...ME.user, dateOfBirth: '1990-03-15', gender: null, companyJoinMonth: '2021-07', workStatus: null },
      }),
    });
    expect(screen.getByLabelText('Date of birth')).toHaveValue('1990-03-15');
    expect(screen.getByLabelText('Joined your insurer')).toHaveValue('2021-07');
    expect(screen.getByLabelText<HTMLSelectElement>('Gender').selectedOptions[0].text).toBe('Not recorded');
    expect(screen.getByLabelText<HTMLSelectElement>('Status').selectedOptions[0].text).toBe('Not recorded');
  });

  it('P18.8-T4 AC-6: sends only what changed, so an untouched one is not rewritten', async () => {
    const { calls } = stubFetch({ '/auth/me': { body: {} }, '/auth/sessions': { body: [] } });
    renderWithSession(<ProfilePage />, {
      me: makeMe({
        permissions: ['profile:read_self'],
        user: { ...ME.user, dateOfBirth: '1990-03-15', gender: 'female', companyJoinMonth: null, workStatus: null },
      }),
    });

    fireEvent.change(screen.getByLabelText('Joined your insurer'), { target: { value: '2019-04' } });
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'part_time');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const body = JSON.parse(calls.find((c) => c.init.method === 'PATCH')!.init.body as string);
    expect(body).toMatchObject({ companyJoinMonth: '2019-04', workStatus: 'part_time' });
    expect(body).not.toHaveProperty('dateOfBirth');
    expect(body).not.toHaveProperty('gender');
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
  });

  it('P18.8-T4 AC-4: says the server\'s refusal under the field it names', async () => {
    stubFetch({
      '/auth/sessions': { body: [] },
      '/auth/me': {
        status: 400,
        body: { error: {
          code: 'VALIDATION_FAILED', message: 'A date of birth must be at least 18 years ago.',
          details: { field: 'dateOfBirth' }, requestId: 'req-13',
        } },
      },
    });
    renderWithSession(<ProfilePage />, { me: ME });

    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2015-01-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('A date of birth must be at least 18 years ago.')).toHaveAttribute('id', 'dateOfBirth-error');
    expect(screen.getByLabelText('Date of birth')).toHaveAttribute('aria-invalid', 'true');
  });

  it('P18.8-T4 AC-6, P18.9-T1 AC-3: in a support session shows the details and offers none of them, nor a Save', async () => {
    // ADR-0162 §4: the API refuses `PATCH /auth/me` in any session, elevated or setup included — so the
    // card offers nothing, rather than the name and pronoun the four used to be locked beside.
    const { calls } = stubFetch({ '/auth/me': { body: {} }, '/auth/sessions': { body: [] } });
    renderWithSession(<ProfilePage />, {
      me: makeMe({
        permissions: ['profile:read_self'],
        isImpersonating: true,
        impersonatedBy: 'u-root',
        impersonationReadOnly: false,
        user: { ...ME.user, dateOfBirth: '1990-03-15', gender: 'female', companyJoinMonth: '2021-07', workStatus: 'full_time' },
      }),
    });
    for (const label of ['Full name', 'Preferred name', 'Pronoun', 'Date of birth', 'Gender', 'Joined your insurer', 'Status']) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.getAllByText('Only they can change this, not a support session.')).toHaveLength(7);
    // P18.95-T7 AC-1: the support session's reason shows at every size; only the pronoun's own line goes on a phone.
    expect(screen.getAllByText('Only they can change this, not a support session.').every((p) => !/hidden/.test(p.className))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);
  });

  it('P18.8-T4: asks a Super Admin none of the four — they sell for nobody', () => {
    renderWithSession(<ProfilePage />, {
      me: makeMe({
        permissions: ['profile:read_self'],
        membership: null,
        user: { ...ME.user, platformRole: 'super_admin' },
      }),
    });
    expect(screen.queryByLabelText('Date of birth')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
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

  it('P18.95-T7 AC-1 keeps the pronoun’s line from 768px and draws it nowhere on a phone, still its description (grey text row 27)', () => {
    renderWithSession(<ProfilePage />, { me: ME });
    const line = screen.getByText('Yours to set. It appears in the commitment sentence your leader reads back to you in coaching.');
    expect(line.className.split(/\s+/).filter((c) => /hidden/.test(c))).toEqual(['max-md:hidden']);
    expect(screen.getByLabelText('Pronoun')).toHaveAccessibleDescription(line.textContent!);
    expect(screen.getByText('What colleagues call you day to day.').className).not.toMatch(/hidden/);
  });

  it('P18.95-T7 AC-3 says under Change password what it waits for: the boxes still empty, then what to fix', async () => {
    renderWithSession(<ProfilePage />, { me: ME });
    const submit = screen.getByRole('button', { name: 'Change password' });
    expect(submit).toHaveAccessibleDescription('Still needed: Current password, New password and Confirm new password.');

    await userEvent.type(screen.getByLabelText('Current password'), 'old password');
    expect(submit).toHaveAccessibleDescription('Still needed: New password and Confirm new password.');
    await userEvent.type(screen.getByLabelText('New password'), 'short');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'short');
    expect(submit).toHaveAccessibleDescription('The new password needs at least 10 characters.');

    await userEvent.type(screen.getByLabelText('New password'), ' but now long enough');
    expect(submit).toHaveAccessibleDescription('Fix the passwords above.');
    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Confirm new password'), ' but now long enough');
    expect(submit).toBeEnabled();
    expect(submit).not.toHaveAccessibleDescription();
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
