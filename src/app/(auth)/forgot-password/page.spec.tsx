import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, stubFetch } from '@test/harness';
import ForgotPasswordPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/forgot-password',
}));

describe('forgot password', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function submit(address: string) {
    renderWithSession(<ForgotPasswordPage />);
    await userEvent.type(screen.getByLabelText('Email'), address);
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  }

  it('confirms identically whether or not the address exists', async () => {
    // Anything else lets a visitor enumerate accounts. Both branches are asserted
    // against the same expected text on purpose.
    stubFetch({ '/auth/forgot-password': { status: 202, body: {} } });
    await submit('known@kpm0417.test');
    const known = (await screen.findByText(/a reset link is on its way/)).textContent;

    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    stubFetch({ '/auth/forgot-password': { status: 404, body: {} } });
    await submit('unknown@kpm0417.test');
    const unknown = (await screen.findByText(/a reset link is on its way/)).textContent;

    expect(known?.replace('known@', 'X@')).toBe(unknown?.replace('unknown@', 'X@'));
  });

  it('says how long the link lasts, so nobody sits waiting on an expired one', async () => {
    stubFetch({ '/auth/forgot-password': { status: 202, body: {} } });
    await submit('rina@kpm0417.test');
    expect(await screen.findByText(/expires in 30 minutes/)).toBeInTheDocument();
  });
});
