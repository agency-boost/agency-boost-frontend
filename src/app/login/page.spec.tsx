import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSession } from '../../../test/harness';
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

  it('offers the reset path', () => {
    renderWithSession(<LoginPage />);
    expect(screen.getByRole('link', { name: /Forgot your password/ })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
