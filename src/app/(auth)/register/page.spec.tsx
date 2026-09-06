import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, stubFetch } from '@test/harness';
import RegisterPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/register',
}));

async function fill(password = 'a long enough password') {
  await userEvent.type(screen.getByLabelText('Full name'), 'Rina Wijaya');
  await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
  await userEvent.type(screen.getByLabelText('Password'), password);
}

describe('register', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says plainly that an account is not an office', () => {
    // Creating an account and joining an office are separate steps; a reader who
    // expects one to imply the other will wait for something that is not coming.
    renderWithSession(<RegisterPage />, { me: null });
    expect(screen.getByText(/office is added separately/)).toBeInTheDocument();
  });

  it('sends the three fields the API asks for', async () => {
    const { calls } = stubFetch({ '/auth/register': { status: 201, body: { status: 'verification_sent' } } });
    renderWithSession(<RegisterPage />, { me: null });

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      fullName: 'Rina Wijaya',
      email: 'rina@kpm0417.test',
      password: 'a long enough password',
    });
  });

  it('confirms the same way whether or not the address is already taken', async () => {
    // The API answers identically on purpose — confirming would let anyone test
    // addresses against this form. The screen must not undo that.
    stubFetch({ '/auth/register': { status: 201, body: { status: 'verification_sent' } } });
    renderWithSession(<RegisterPage />, { me: null });

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const confirmation = await screen.findByText(/verification link is on its way/);
    expect(confirmation.textContent).toMatch(/if .* can be registered/i);
    expect(confirmation.textContent).not.toMatch(/already|exists|taken/i);
  });

  it('applies the password rules the server applies, before the round trip', async () => {
    renderWithSession(<RegisterPage />, { me: null });
    const submit = screen.getByRole('button', { name: 'Create account' });

    await userEvent.type(screen.getByLabelText('Full name'), 'Rina');
    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');

    await userEvent.type(screen.getByLabelText('Password'), 'short');
    expect(screen.getByText('Use at least 10 characters.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'a long password ');
    expect(screen.getByText('Do not begin or end with a space.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'a long enough password');
    expect(submit).toBeEnabled();
  });

  it('says how long the verification link lasts', async () => {
    stubFetch({ '/auth/register': { status: 201, body: {} } });
    renderWithSession(<RegisterPage />, { me: null });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/24 hours and works once/)).toBeInTheDocument();
  });

  it('shows a server rejection rather than a false confirmation', async () => {
    stubFetch({
      '/auth/register': {
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: 'Password must not begin or end with a space.', requestId: 'req-3' } },
      },
    });
    renderWithSession(<RegisterPage />, { me: null });

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('must not begin or end with a space');
    expect(screen.queryByText(/verification link is on its way/)).not.toBeInTheDocument();
  });

  it('offers the way back to sign in', () => {
    renderWithSession(<RegisterPage />, { me: null });
    expect(screen.getByRole('link', { name: /Already have an account/ })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
