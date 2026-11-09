import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, routeParams, stubFetch } from '@test/harness';
import VerifyEmailPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/verify-email/tok',
}));

const params = routeParams({ token: 'tok-abc' });

/** Signed in on this device, the address not verified yet. */
const unverified = () => {
  const me = makeMe();
  return { ...me, user: { ...me.user, emailVerified: false } };
};

const INVALID = {
  status: 400,
  body: { error: { code: 'AUTH_TOKEN_INVALID', message: 'That link is no longer valid. Request a new one.', requestId: 'req-1' } },
};

/**
 * **Verify your email** (P19-T1 AC-1, AC-2; UI-163, ADR-0190 §1–§2): the page sends nothing on load — a mail scanner that
 * opens the link spends no token — and verifies on the press of its one button. The server answers success for an
 * address already verified, so a second press reads as the first.
 */
describe('verify email (P19-T1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19-T1 AC-1 shows the title and one button, Verify my email, and sends nothing until it is pressed', async () => {
    const { calls } = stubFetch({ '/auth/verify-email': { body: { status: 'verified' } } });
    renderWithSession(<VerifyEmailPage params={params} />, { me: null });

    expect(screen.getByRole('heading', { level: 1, name: 'Verify your email' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Verify my email' })).toBeEnabled();
    // A scanner that loads the page and leaves spends nothing.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toHaveLength(0);
  });

  it('P19-T1 AC-2 verifies on the press, says so, and offers the way to sign in', async () => {
    const { calls } = stubFetch({ '/auth/verify-email': { body: { status: 'verified' } } });
    renderWithSession(<VerifyEmailPage params={params} />, { me: null });

    await userEvent.click(screen.getByRole('button', { name: 'Verify my email' }));

    expect(await screen.findByText('Your email is verified.')).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ token: 'tok-abc' });
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login');
  });

  it('P19-T1 AC-2 a person signed in on this device goes back to the app, and their session is read again', async () => {
    stubFetch({ '/auth/verify-email': { body: { status: 'verified' } } });
    const reload = vi.fn(async () => undefined);
    renderWithSession(<VerifyEmailPage params={params} />, { me: unverified(), reload });

    await userEvent.click(screen.getByRole('button', { name: 'Verify my email' }));

    expect(await screen.findByText('Your email is verified.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue to AgencyBoost' })).toHaveAttribute('href', '/');
    // The shells' banner reads the session, so it goes at once.
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('P19-T1 AC-2 says the button is working while the press is out, and cannot be pressed twice meanwhile', async () => {
    let answer!: () => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      answer = () => resolve({ ok: true, status: 200, json: async () => ({ status: 'verified' }) } as Response);
    })));
    renderWithSession(<VerifyEmailPage params={params} />, { me: null });

    await userEvent.click(screen.getByRole('button', { name: 'Verify my email' }));
    expect(screen.getByRole('button', { name: 'Verifying…' })).toBeDisabled();
    answer();
    expect(await screen.findByText('Your email is verified.')).toBeInTheDocument();
  });

  it('P19-T1 AC-2 an expired or unknown link shows the refusal and the way to a new one: sign in, then Send again', async () => {
    stubFetch({ '/auth/verify-email': INVALID });
    renderWithSession(<VerifyEmailPage params={params} />, { me: null });

    await userEvent.click(screen.getByRole('button', { name: 'Verify my email' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That link is no longer valid. Request a new one.');
    expect(screen.getByText('Verification links expire after 24 hours.')).toBeInTheDocument();
    expect(screen.getByText(/^Sign in, then press Send again for a new link\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login');
  });

  it('P19-T1 AC-2 signed in on this device, a failed link offers Send again here, which sends a new one to their address', async () => {
    const { calls } = stubFetch({
      '/auth/verify-email': INVALID,
      '/auth/resend-verification': { status: 202, body: { status: 'accepted' } },
    });
    renderWithSession(<VerifyEmailPage params={params} />, { me: unverified() });

    await userEvent.click(screen.getByRole('button', { name: 'Verify my email' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Send again' }));

    expect(await screen.findByText('A new link is on its way. Check your inbox.')).toBeInTheDocument();
    const resend = calls.find((c) => c.url.includes('/auth/resend-verification'))!;
    expect(JSON.parse(resend.init.body as string)).toEqual({ email: 'rina@kpm0417.test' });
    expect(screen.getByRole('button', { name: 'Send again' })).toBeDisabled();
  });
});
