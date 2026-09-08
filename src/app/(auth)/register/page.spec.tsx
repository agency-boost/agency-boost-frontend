import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, stubFetch } from '@test/harness';
import RegisterPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/register',
}));

/** The insurers the selector loads. Public, so no token is involved. */
const INSURERS = [
  { _id: 'co-1', name: 'Allianz' },
  { _id: 'co-2', name: 'Prudential' },
];

async function fill(password = 'a long enough password') {
  await userEvent.type(screen.getByLabelText('Full name'), 'Rina Wijaya');
  await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.type(screen.getByLabelText('Confirm password'), password);
  // The insurer that issued the code, and the code itself (ADR-0017).
  await screen.findByRole('option', { name: 'Prudential' });
  await userEvent.selectOptions(screen.getByLabelText('Insurer'), 'co-2');
  await userEvent.type(screen.getByLabelText('Agent code'), 'PRU-88213');
}

describe('register', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says plainly that an account is not an office', () => {
    // Creating an account and joining an office are separate steps; a reader who
    // expects one to imply the other will wait for something that is not coming.
    renderWithSession(<RegisterPage />, { me: null });
    expect(screen.getByText(/office is added separately/)).toBeInTheDocument();
  });

  it('sends the five fields the API asks for', async () => {
    const { calls } = stubFetch({
      '/companies': { body: INSURERS },
      '/auth/register': { status: 201, body: { status: 'verification_sent' } },
    });
    renderWithSession(<RegisterPage />, { me: null });

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const register = calls.find((c) => c.url.includes('/auth/register'))!;
    expect(JSON.parse(register.init.body as string)).toEqual({
      fullName: 'Rina Wijaya',
      email: 'rina@kpm0417.test',
      password: 'a long enough password',
      companyId: 'co-2',
      agentCode: 'PRU-88213',
    });
  });

  it('offers no insurer chosen for you, because the wrong one is not recoverable here', async () => {
    stubFetch({ '/companies': { body: INSURERS } });
    renderWithSession(<RegisterPage />, { me: null });

    await screen.findByRole('option', { name: 'Prudential' });
    expect(screen.getByLabelText<HTMLSelectElement>('Insurer').value).toBe('');
    // And the form will not go until one is picked: the code is unique inside an
    // insurer, so submitting against the wrong one is a code that belongs to somebody.
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });

  it('confirms the same way whether or not the address is already taken', async () => {
    // The API answers identically on purpose — confirming would let anyone test
    // addresses against this form. The screen must not undo that.
    stubFetch({
      '/companies': { body: INSURERS },
      '/auth/register': { status: 201, body: { status: 'verification_sent' } },
    });
    renderWithSession(<RegisterPage />, { me: null });

    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const confirmation = await screen.findByText(/verification link is on its way/);
    expect(confirmation.textContent).toMatch(/if .* can be registered/i);
    expect(confirmation.textContent).not.toMatch(/already|exists|taken/i);
  });

  it('applies the password rules the server applies, before the round trip', async () => {
    stubFetch({ '/companies': { body: INSURERS } });
    renderWithSession(<RegisterPage />, { me: null });
    const submit = screen.getByRole('button', { name: 'Create account' });

    await userEvent.type(screen.getByLabelText('Full name'), 'Rina');
    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    // Everything else valid, so the password is the only thing holding the button.
    await screen.findByRole('option', { name: 'Prudential' });
    await userEvent.selectOptions(screen.getByLabelText('Insurer'), 'co-2');
    await userEvent.type(screen.getByLabelText('Agent code'), 'PRU-88213');

    await userEvent.type(screen.getByLabelText('Password'), 'short');
    expect(screen.getByText('Use at least 10 characters.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'a long password ');
    expect(screen.getByText('Do not begin or end with a space.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'a long enough password');
    // Typed but not yet confirmed: the button stays down, because a create flow needs
    // the second box (the reset screen has needed one since Phase 2).
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Confirm password'), 'a long enough passwor');
    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Confirm password'), 'd');
    expect(screen.queryByText('The two passwords do not match.')).toBeNull();
    expect(submit).toBeEnabled();
  });

  it('offers to show what was typed, on both password boxes', async () => {
    stubFetch({ '/companies': { body: INSURERS } });
    renderWithSession(<RegisterPage />, { me: null });

    // A ten-character minimum makes a mistyped passphrase the likeliest failure, and
    // "the two do not match" does not say which one is wrong.
    const toggles = screen.getAllByRole('button', { name: 'Show password' });
    expect(toggles).toHaveLength(2);

    await userEvent.type(screen.getByLabelText('Password'), 'a long enough password');
    await userEvent.click(toggles[0]);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    // And only that one.
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');
  });

  it('says how long the verification link lasts', async () => {
    stubFetch({
      '/companies': { body: INSURERS },
      '/auth/register': { status: 201, body: {} },
    });
    renderWithSession(<RegisterPage />, { me: null });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/24 hours and works once/)).toBeInTheDocument();
  });

  it('shows a server rejection rather than a false confirmation', async () => {
    stubFetch({
      '/companies': { body: INSURERS },
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
