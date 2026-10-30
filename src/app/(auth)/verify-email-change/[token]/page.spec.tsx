import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { renderInIndonesian, renderWithSession, resetLanguage, routeParams, stubFetch } from '@test/harness';
import { authMessages } from '@/i18n/messages/auth';
import VerifyEmailChangePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/verify-email-change/tok',
}));

const ENGLISH = englishOnly(authMessages);

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
});

/**
 * **UI-111 — the email change's link** (UI V1, 2026-10-30; ADR-0181): `/verify-email-change/[token]` spends the token
 * once, on arrival, and says the address the account signs in with now — or why the link did not work.
 */
describe('UI-111 /verify-email-change/[token]', () => {
  it('UI-111 sends the token once on arrival, then says the new address and offers My profile and sign in', async () => {
    const { calls } = stubFetch({ '/auth/verify-email-change': { body: { status: 'changed', email: 'agus.baru@kpm0417.test' } } });
    renderWithSession(<VerifyEmailChangePage params={routeParams({ token: 'tok-abc' })} />, { me: null });

    expect(screen.getByRole('heading', { level: 1, name: 'Confirm your new email' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your link…');
    expect(await screen.findByText('Your email is now agus.baru@kpm0417.test.')).toBeInTheDocument();
    const sent = calls.filter((c) => c.url.includes('/auth/verify-email-change'));
    expect(sent).toHaveLength(1);
    expect(sent[0].init.method).toBe('POST');
    expect(JSON.parse(sent[0].init.body as string)).toEqual({ token: 'tok-abc' });
    expect(screen.getByRole('link', { name: 'Go to My profile' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login');
  });

  it('UI-111 a used, replaced or expired link: the server’s sentence, and what to do next', async () => {
    stubFetch({
      '/auth/verify-email-change': {
        status: 400,
        body: { error: { code: 'AUTH_TOKEN_INVALID', message: 'That link is no longer valid. Request a new one.', requestId: 'req-1' } },
      },
    });
    renderWithSession(<VerifyEmailChangePage params={routeParams({ token: 'tok-old' })} />, { me: null });

    expect(await screen.findByRole('alert')).toHaveTextContent('That link is no longer valid. Request a new one.');
    expect(screen.getByText('Email change links are single-use and expire after 24 hours. Ask again from My profile.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Go to My profile' })).not.toBeInTheDocument();
  });

  it('UI-111 an address taken since the request: the server’s 409 said as it is', async () => {
    stubFetch({
      '/auth/verify-email-change': {
        status: 409,
        body: { error: { code: 'AUTH_EMAIL_TAKEN', message: 'That address now belongs to another account, so your email has not changed. Ask again with a different one.', requestId: 'req-2' } },
      },
    });
    renderWithSession(<VerifyEmailChangePage params={routeParams({ token: 'tok-taken' })} />, { me: null });

    expect(await screen.findByRole('alert')).toHaveTextContent('your email has not changed');
  });

  it('UI-111 in Indonesian: the title, the wait, Email Anda sekarang …, Buka Profil saya, and the failure line', async () => {
    stubFetch({ '/auth/verify-email-change': { body: { status: 'changed', email: 'agus.baru@kpm0417.test' } } });
    const { unmount } = renderInIndonesian(<VerifyEmailChangePage params={routeParams({ token: 'tok-1' })} />, { me: null });
    expect(screen.getByRole('heading', { level: 1, name: 'Konfirmasi email baru Anda' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Memeriksa tautan Anda…');
    expect(await screen.findByText('Email Anda sekarang agus.baru@kpm0417.test.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buka Profil saya' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('link', { name: 'Buka halaman masuk' })).toHaveAttribute('href', '/login');
    expect(englishShown(document.body, ENGLISH)).toEqual([]);
    unmount();
    vi.unstubAllGlobals();

    stubFetch({
      '/auth/verify-email-change': {
        status: 400,
        body: { error: { code: 'AUTH_TOKEN_INVALID', message: 'Tautan itu sudah tidak berlaku. Minta tautan baru.', requestId: 'r' } },
      },
    });
    renderInIndonesian(<VerifyEmailChangePage params={routeParams({ token: 'tok-2' })} />, { me: null });
    expect(await screen.findByText(/^Tautan perubahan email hanya bisa dipakai sekali dan kedaluwarsa setelah 24 jam\./)).toBeInTheDocument();
    expect(englishShown(document.body, ENGLISH)).toEqual([]);
  });
});
