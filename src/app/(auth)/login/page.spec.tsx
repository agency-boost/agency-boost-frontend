import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, stubFetch } from '@test/harness';
import { ApiConfigError } from '@/lib/api';
import { ApiRequestError } from '@/lib/api-client';
import LoginPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/login',
}));

describe('login', () => {
  it('labels both fields and marks them for the password manager', () => {
    renderWithSession(<LoginPage />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('signs in and lands the user somewhere', async () => {
    const { session } = renderWithSession(<LoginPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await userEvent.type(screen.getByLabelText('Password'), 'demo password rina');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(session.signIn).toHaveBeenCalledWith('rina@kpm0417.test', 'demo password rina');
    expect(push).toHaveBeenCalledWith('/');
  });

  it('shows the server message and the request id, and marks both fields invalid', async () => {
    // Which of the two was wrong is deliberately not said — the API returns one error
    // for a bad address and a bad password alike, and the screen must not undo that.
    const signIn = vi.fn(async () => {
      throw new ApiRequestError(401, {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
        requestId: 'req-9',
      });
    });
    renderWithSession(<LoginPage />, { signIn });

    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email or password is incorrect.');
    expect(alert).toHaveTextContent('req-9');
    expect(alert.textContent).not.toMatch(/no account|not found|unknown user/i);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(push).not.toHaveBeenCalledWith('/');
  });

  it('reports a network failure as a network failure, not as bad credentials', async () => {
    const signIn = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    renderWithSession(<LoginPage />, { signIn });

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.test');
    await userEvent.type(screen.getByLabelText('Password'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.');
  });

  it('offers the reset path and the way to an account', () => {
    renderWithSession(<LoginPage />);
    expect(screen.getByRole('link', { name: /Forgot your password/ })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('names the missing variable instead of blaming the server', async () => {
    // The failure that prompted this: a renamed environment variable surfaced as
    // "Could not reach the server", which sends you to debug a healthy backend.
    const signIn = vi.fn(async () => {
      throw new ApiConfigError('NEXT_PUBLIC_API_ORIGIN is not set.', 'NEXT_PUBLIC_API_ORIGIN');
    });
    renderWithSession(<LoginPage />, { signIn });

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.test');
    await userEvent.type(screen.getByLabelText('Password'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('NEXT_PUBLIC_API_ORIGIN');
    expect(alert.textContent).not.toMatch(/could not reach/i);
  });

  describe('the development accounts panel', () => {
    const ORIGINAL = process.env.NEXT_PUBLIC_APP_ENV;
    afterEach(() => {
      process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL;
    });

    it('is absent unless the environment says development', () => {
      process.env.NEXT_PUBLIC_APP_ENV = 'production';
      renderWithSession(<LoginPage />);
      expect(screen.queryByText('Development accounts')).not.toBeInTheDocument();
    });

    it('fills both fields and signs in, leaving the values on screen', async () => {
      process.env.NEXT_PUBLIC_APP_ENV = 'development';
      const { session } = renderWithSession(<LoginPage />);

      await userEvent.click(screen.getByRole('button', { name: /Show all \d+ accounts/ }));
      await userEvent.click(screen.getByRole('button', { name: /Super Admin.*superadmin@/s }));

      expect(session.signIn).toHaveBeenCalledWith(
        'superadmin@agencyboost.test',
        'demo super admin',
      );
      // Visible afterwards, so a failed attempt can be read and edited rather than
      // repeated blindly.
      expect(screen.getByLabelText('Email')).toHaveValue('superadmin@agencyboost.test');
      expect(screen.getByLabelText('Password')).toHaveValue('demo super admin');
      expect(push).toHaveBeenCalledWith('/');
    });

    it('shows the ordinary error when a seeded account does not exist yet', async () => {
      process.env.NEXT_PUBLIC_APP_ENV = 'development';
      const signIn = vi.fn(async () => {
        throw new ApiRequestError(401, {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Email or password is incorrect.',
          requestId: 'req-2',
        });
      });
      renderWithSession(<LoginPage />, { signIn });

      await userEvent.click(screen.getByRole('button', { name: /Show all \d+ accounts/ }));
      await userEvent.click(screen.getByRole('button', { name: /KPM Owner.*owner@kpm0417/s }));

      expect(await screen.findByRole('alert')).toHaveTextContent('incorrect');
      expect(screen.getByLabelText('Email')).toHaveValue('owner@kpm0417.test');
    });
  });
  it('offers to send the verification email again, when that is the refusal (P4-T13)', async () => {
    /*
     * Login refuses an unverified account, and until `resend-verification` existed the
     * only advice was "check your inbox" — for an email that, before `P4-T14`, had never
     * been sent. Both halves are real now, so the screen offers the action.
     */
    const signIn = vi.fn(async () => {
      throw new ApiRequestError(403, {
        code: 'AUTH_EMAIL_NOT_VERIFIED',
        message: 'Verify your email address before signing in. Check your inbox.',
        requestId: 'req-11',
      });
    });
    const { calls } = stubFetch({
      '/auth/resend-verification': { status: 202, body: { status: 'accepted' } },
    });
    renderWithSession(<LoginPage />, { signIn });

    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await userEvent.type(screen.getByLabelText('Password'), 'a-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await userEvent.click(
      await screen.findByRole('button', { name: 'Send the verification email again' }),
    );

    expect(calls.some((c) => c.url.includes('/auth/resend-verification'))).toBe(true);
    expect(await screen.findByText(/On its way, if that address has an account waiting/))
      .toBeInTheDocument();
  });

  it('offers it only for that refusal, not for a wrong password', async () => {
    const signIn = vi.fn(async () => {
      throw new ApiRequestError(401, {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
        requestId: 'req-12',
      });
    });
    renderWithSession(<LoginPage />, { signIn });

    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Send the verification email again' }))
      .toBeNull();
  });

});
