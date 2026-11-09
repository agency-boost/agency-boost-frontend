import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InLanguage, makeMe, renderWithSession, stubFetch } from '@test/harness';
import type { Me } from '@/lib/session';
import { AppShell } from './app-shell';
import { VerifyEmailBanner } from './verify-email-banner';
import { fieldChrome } from '@test/shell-fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/overview',
}));

const withAddress = (emailVerified: boolean | undefined, over: Partial<Me> = {}): Me => {
  const me = makeMe(over);
  return { ...me, user: { ...me.user, emailVerified } };
};

/**
 * ***"Verifikasi email Anda · Kirim ulang"*** (P19-T1 AC-4; UI-163, ADR-0190 §4): a person signs in before their address
 * is verified, and every shell says so until it is, with the way to a new link.
 */
describe('P19-T1 AC-4 the shells’ verification banner', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19-T1 AC-4 says Verifikasi email Anda · Kirim ulang to a person whose address is not verified, in Indonesian', () => {
    renderWithSession(<InLanguage language="id"><VerifyEmailBanner /></InLanguage>, { me: withAddress(false) });
    const banner = document.querySelector('[data-verify-email]') as HTMLElement;
    expect(banner).toHaveTextContent(/^Verifikasi email Anda·Kirim ulang$/);
    expect(screen.getByRole('button', { name: 'Kirim ulang' })).toBeEnabled();
  });

  it('P19-T1 AC-4 Kirim ulang sends a new link to the account’s own address, and says it was sent', async () => {
    const { calls } = stubFetch({ '/auth/resend-verification': { status: 202, body: { status: 'accepted' } } });
    renderWithSession(<VerifyEmailBanner />, { me: withAddress(false) });

    await userEvent.click(screen.getByRole('button', { name: 'Send again' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Sent. Check your inbox.');
    expect(calls).toHaveLength(1);
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ email: 'rina@kpm0417.test' });
    expect(screen.queryByRole('button', { name: 'Send again' })).toBeNull();
  });

  it('P19-T1 AC-4 a refused resend says why, and Send again can be pressed again', async () => {
    stubFetch({
      '/auth/resend-verification': {
        status: 429,
        body: { error: { code: 'AUTH_RATE_LIMITED', message: 'Too many attempts. Try again in 42 minute(s).', requestId: 'r' } },
      },
    });
    renderWithSession(<VerifyEmailBanner />, { me: withAddress(false) });

    await userEvent.click(screen.getByRole('button', { name: 'Send again' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Try again in 42 minute(s).');
    expect(screen.getByRole('button', { name: 'Send again' })).toBeEnabled();
  });

  it.each([
    ['a verified address', withAddress(true)],
    ['a session that does not say', withAddress(undefined)],
    ['a support session, the address being the member’s', withAddress(false, { isImpersonating: true, impersonatedBy: 'sa-1' })],
    ['nobody signed in', null],
  ])('P19-T1 AC-4 is not shown for %s', (_who, me) => {
    renderWithSession(<VerifyEmailBanner />, { me });
    expect(document.querySelector('[data-verify-email]')).toBeNull();
  });

  it('P19-T1 AC-4 every shell carries it, at the top of the page, before the title', () => {
    renderWithSession(
      <AppShell field={fieldChrome()} sections={[]} user={{ name: 'Rina', role: 'Agent', initials: 'RW' }} title="Ringkasan">
        <p>content</p>
      </AppShell>,
      { me: withAddress(false) },
    );
    const main = screen.getByRole('main');
    expect(main.firstElementChild).toHaveAttribute('data-verify-email');
    expect(screen.getByRole('heading', { name: 'Ringkasan' })).toBeInTheDocument();
  });

  it('P19-T1 AC-4 a shell drawn with no session at all draws no banner, and does not fail', () => {
    render(<AppShell field={fieldChrome()} sections={[]} user={{ name: 'Rina', role: 'Agent', initials: 'RW' }}><p>content</p></AppShell>);
    expect(document.querySelector('[data-verify-email]')).toBeNull();
  });
});
