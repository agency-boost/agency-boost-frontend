import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import ChooseAPasswordPage from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/choose-a-password',
}));

const OWED = makeMe({ mustChangePassword: true });

async function fill(current = 'kfmp-3xqz-7bdn-r4vw', next = 'a password of my own') {
  await userEvent.type(screen.getByLabelText('The password you were sent'), current);
  await userEvent.type(screen.getByLabelText('Your new password'), next);
  await userEvent.type(screen.getByLabelText('Confirm your new password'), next);
}

describe('choosing your own password (P3.6-T4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    replace.mockClear();
  });

  it('says why they are here, and that nothing else is open', () => {
    // It is not a nag. Every other route on the API answers 403 until this is done, so a
    // softer word would be describing a choice they do not have.
    renderWithSession(<ChooseAPasswordPage />, { me: OWED });
    expect(screen.getByText(/generated for you and sent by email/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing else in AgencyBoost opens until you replace it/))
      .toBeInTheDocument();
  });

  it('sends the two fields the endpoint takes, and not the confirmation', async () => {
    const { calls } = stubFetch({ '/auth/change-password': { body: { status: 'changed' } } });
    renderWithSession(<ChooseAPasswordPage />, { me: OWED });

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Save and sign in again' }));

    const call = calls.find((c) => c.url.includes('/auth/change-password'))!;
    expect(JSON.parse(call.init.body as string)).toEqual({
      currentPassword: 'kfmp-3xqz-7bdn-r4vw',
      newPassword: 'a password of my own',
    });
  });

  it('sends them back to sign in, because the change kills this session too', async () => {
    stubFetch({ '/auth/change-password': { body: { status: 'changed' } } });
    renderWithSession(<ChooseAPasswordPage />, { me: OWED });

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Save and sign in again' }));
    expect(replace).toHaveBeenCalledWith('/login?changed=1');
  });

  it('refuses the password they were sent as the new one', async () => {
    // The server refuses it too. Saying so here means the round trip is not spent
    // learning something the screen already knew — and the credential the operator holds
    // would otherwise still be live.
    renderWithSession(<ChooseAPasswordPage />, { me: OWED });
    const same = 'kfmp-3xqz-7bdn-r4vw';
    await userEvent.type(screen.getByLabelText('The password you were sent'), same);
    await userEvent.type(screen.getByLabelText('Your new password'), same);
    await userEvent.type(screen.getByLabelText('Confirm your new password'), same);

    expect(screen.getByText('Choose something different from the one you were sent.'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save and sign in again' })).toBeDisabled();
  });

  it('applies the same rules as everywhere else, and asks twice', async () => {
    renderWithSession(<ChooseAPasswordPage />, { me: OWED });
    const submit = screen.getByRole('button', { name: 'Save and sign in again' });

    await userEvent.type(screen.getByLabelText('The password you were sent'), 'temporary-one');
    await userEvent.type(screen.getByLabelText('Your new password'), 'short');
    expect(screen.getByText('Use at least 10 characters.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Your new password'), ' but now long enough');
    await userEvent.type(screen.getByLabelText('Confirm your new password'), 'something else');
    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument();
    expect(submit).toBeDisabled();
  });

  it('offers to show what was typed, on all three boxes', () => {
    renderWithSession(<ChooseAPasswordPage />, { me: OWED });
    expect(screen.getAllByRole('button', { name: 'Show password' })).toHaveLength(3);
  });

  it('surfaces a refusal rather than appearing to succeed', async () => {
    stubFetch({
      '/auth/change-password': {
        status: 401,
        body: {
          error: {
            code: 'AUTH_INVALID_CREDENTIALS',
            message: 'Your current password is not correct.',
            requestId: 'r-9',
          },
        },
      },
    });
    renderWithSession(<ChooseAPasswordPage />, { me: OWED });

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Save and sign in again' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('not correct');
    expect(replace).not.toHaveBeenCalled();
  });
});
