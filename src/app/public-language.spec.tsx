import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import {
  atWidth, languageCookie, renderLive, renderWithSession, resetLanguage, routeParams, stubFetch, wears,
} from '@test/harness';
import ForgotPasswordPage from './(auth)/forgot-password/page';
import LoginPage from './(auth)/login/page';
import RegisterPage from './(auth)/register/page';
import ResetPasswordPage from './(auth)/reset-password/[token]/page';
import VerifyEmailPage from './(auth)/verify-email/[token]/page';
import JoinPage from './join/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * The six public pages, as somebody meets them before they are anybody (the route registry's *public* family): each
 * title in English, and in Indonesian — what a reader who has chosen nothing reads once the switch is live (P18.98-T4,
 * the approved §A.2; *AgencyBoost* kept).
 */
const TITLED: [string, () => React.ReactElement, string, string][] = [
  ['/login', () => <LoginPage />, 'AgencyBoost', 'AgencyBoost'],
  ['/register', () => <RegisterPage />, 'Create your account', 'Buat akun Anda'],
  ['/forgot-password', () => <ForgotPasswordPage />, 'Reset your password', 'Atur ulang kata sandi'],
  ['/reset-password/[token]', () => <ResetPasswordPage params={routeParams({ token: 'tok-1' })} />, 'Choose a new password', 'Buat kata sandi baru'],
  ['/verify-email/[token]', () => <VerifyEmailPage params={routeParams({ token: 'tok-1' })} />, 'Verify your email', 'Verifikasi email Anda'],
];

/** What the pages read on their own while open: the insurers, a token checked. */
const PUBLIC_READS = {
  '/companies': { body: [] },
  '/auth/verify-email': { body: { status: 'verified' } },
};

const languageGroup = () => screen.queryByRole('group', { name: /^(Language|Bahasa)$/ });

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
});

/**
 * **P18.98-T2 AC-3: the switch on the six public pages' card** (ADR-0179 §2). No shell, no bar: it sits on the
 * page's own column, on the title's line, at every size. Held back until `LANGUAGE_LIVE`.
 */
describe('P18.98-T2 the switch on the public pages', () => {
  it.each(TITLED)('AC-3 draws nothing on %s while it is not live: the title is the page’s, as it was', async (_, page, title) => {
    stubFetch(PUBLIC_READS);
    renderWithSession(page(), { me: null });

    const heading = await screen.findByRole('heading', { level: 1, name: title });
    expect(languageGroup()).not.toBeInTheDocument();
    expect(heading.parentElement!.tagName).toBe('MAIN');
  });

  describe.each([375, 1280])('live, at %ipx', (px) => {
    it.each(TITLED)('AC-3 puts it on %s’s title line, at its right: two 44 × 44 options, the title untouched', async (_, page, __, title) => {
      atWidth(px);
      stubFetch(PUBLIC_READS);
      renderLive(page(), { me: null });

      const heading = await screen.findByRole('heading', { level: 1, name: title });
      const group = languageGroup()!;
      const row = heading.parentElement!;
      expect(Array.from(row.children)).toEqual([heading, group]);
      expect(row).toHaveClass('flex', 'justify-between');
      // Centred on the title's line, so the title stays where it stood and nothing under it moves.
      expect(wears(group, px)).toContain('-my-[5px]');
      expect(wears(group, px).split(' ')).not.toContain('hidden');
      for (const o of within(group).getAllByRole('button')) expect(o).toHaveClass('h-11', 'w-11');
    });
  });

  it('AC-3 puts it above /join’s card for somebody signed out, and not while the session is read', async () => {
    stubFetch({});
    const { unmount } = renderLive(<JoinPage />, { me: null, loading: true });
    expect(languageGroup()).not.toBeInTheDocument();
    unmount();

    renderLive(<JoinPage />, { me: null });
    const group = languageGroup()!;
    expect(group).toBeInTheDocument();
    expect(group.parentElement).toHaveClass('flex', 'justify-end');
    expect(within(group).getAllByRole('button').map((o) => o.textContent)).toEqual(['ID', 'EN']);
  });

  it('AC-3, AC-5 signed out, switches the page at once, keeps the typed address, and writes the cookie alone', async () => {
    const { calls } = stubFetch({});
    renderLive(<LoginPage />, { me: null });
    const email = screen.getByLabelText('Email');
    await userEvent.type(email, 'rina@kpm0417.test');

    await userEvent.click(within(languageGroup()!).getByRole('button', { name: 'EN' }));

    expect(document.documentElement.lang).toBe('en');
    expect(languageCookie()).toBe('en');
    expect(screen.getByLabelText('Email')).toBe(email);
    expect(email).toHaveValue('rina@kpm0417.test');
    // Nobody is signed in: there is no account to tell.
    expect(calls).toHaveLength(0);
  });

  it.each(['id', 'en'] as const)('AC-3 has no axe violations on sign-in with the switch, the page in %s', async (language) => {
    stubFetch({});
    const { container } = renderLive(<LoginPage />, { me: null });
    if (language === 'en') await userEvent.click(within(languageGroup()!).getByRole('button', { name: 'EN' }));
    // Contrast is measured in a browser, not in jsdom, which cannot draw a canvas (as every axe spec here).
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations ?? []).toEqual([]);
  });
});
