import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, routeParams, stubFetch } from '@test/harness';
import ResetPasswordPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/reset-password/tok',
}));

const params = routeParams({ token: 'tok-123' });

describe('reset password', () => {
  afterEach(() => {
    push.mockClear();
    vi.unstubAllGlobals();
  });

  it('says the reset ends the other sessions, which is the point of resetting', () => {
    renderWithSession(<ResetPasswordPage params={params} />);
    expect(screen.getByText(/signs you out everywhere else/)).toBeInTheDocument();
  });

  it('holds the submit until the two entries agree and are long enough', async () => {
    renderWithSession(<ResetPasswordPage params={params} />);
    const submit = screen.getByRole('button', { name: 'Set new password' });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('New password'), 'short');
    expect(screen.getByText('Use at least 10 characters.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('New password'), ' but longer');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'something else');
    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Confirm password'));
    await userEvent.type(screen.getByLabelText('Confirm password'), 'short but longer');
    expect(submit).toBeEnabled();
  });

  it('sends the token from the URL, never asking the user to retype it', async () => {
    const { calls } = stubFetch({ '/auth/reset-password': { body: { status: 'reset' } } });
    renderWithSession(<ResetPasswordPage params={params} />);

    await userEvent.type(screen.getByLabelText('New password'), 'a long enough password');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'a long enough password');
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      token: 'tok-123',
      newPassword: 'a long enough password',
    });
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('keeps the user on the page when the token has expired', async () => {
    stubFetch({
      '/auth/reset-password': {
        status: 400,
        body: { error: { code: 'TOKEN_EXPIRED', message: 'That link has expired.', requestId: 'req-6' } },
      },
    });
    renderWithSession(<ResetPasswordPage params={params} />);

    await userEvent.type(screen.getByLabelText('New password'), 'a long enough password');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'a long enough password');
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That link has expired.');
    expect(push).not.toHaveBeenCalled();
  });
});
