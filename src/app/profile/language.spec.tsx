import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { languageCookie, makeMe, renderLive, renderWithSession, resetLanguage, stubFetch } from '@test/harness';
import ProfilePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/profile',
}));

const ME = makeMe({ permissions: ['profile:read_self'] });
const SUPPORT = makeMe({
  permissions: ['profile:read_self'], isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'sa-1',
});

/** What `/profile` reads on its own besides the session: where the account is signed in, and the bell's count. */
const READS = {
  '/auth/sessions': { body: [] },
  '/notifications/unread-count': { body: { unread: 0 } },
};

const field = () => screen.queryByRole('combobox', { name: /^(Language|Bahasa)$/ });

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
});

/**
 * **P18.98-T2 AC-4: *Language* on *Your account*** (ADR-0179 §2; UI-041) — *Bahasa Indonesia* or *English*, the same
 * preference as the switch, saving by itself with *Saving… → Saved ✓* (OD-200). Drawn while `LANGUAGE_LIVE` (live since 2026-10-29).
 */
describe('P18.98-T2 Language on Your account', () => {
  it('AC-4 is not drawn while the switch is not live', () => {
    stubFetch(READS);
    renderWithSession(<ProfilePage />, { me: ME });

    expect(screen.getByRole('heading', { name: 'Your details' })).toBeInTheDocument();
    expect(field()).not.toBeInTheDocument();
  });

  it('AC-4 offers the two languages, each by its own name in its own language, showing the one the screen is in', () => {
    stubFetch(READS);
    renderLive(<ProfilePage />, { me: ME });

    const select = field()!;
    // Live, somebody who has chosen nothing reads Bahasa Indonesia, and the field says it in Indonesian.
    expect(select).toHaveAccessibleName('Bahasa');
    expect(select).toHaveValue('id');
    const options = within(select).getAllByRole('option');
    expect(options.map((o) => [o.textContent, o.getAttribute('value'), o.getAttribute('lang')])).toEqual([
      ['Bahasa Indonesia', 'id', 'id'],
      ['English', 'en', 'en'],
    ]);
  });

  it('AC-4 saves by itself — Saving… then Saved ✓ — on the account, the cookie and the screen at once', async () => {
    const { calls } = stubFetch({ ...READS, 'PATCH /auth/me': { body: ME } });
    renderLive(<ProfilePage />, { me: ME });

    await userEvent.selectOptions(field()!, 'en');

    // The screen is in English at once, the field and its status with it.
    expect(document.documentElement.lang).toBe('en');
    expect(field()).toHaveAccessibleName('Language');
    expect(field()).toHaveValue('en');
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    const saves = calls.filter((c) => c.init.method === 'PATCH');
    expect(saves).toHaveLength(1);
    expect(JSON.parse(saves[0].init.body as string)).toEqual({ locale: 'en' });
    expect(languageCookie()).toBe('en');
    // Not *Your details*' own *Save*: that button sends nothing of the language, and nothing else was sent.
    expect(saves[0].url).toBe('http://api.test/api/v1/auth/me');
  });

  it('AC-4 says its status in the language just chosen: Menyimpan… and Tersimpan ✓ in Bahasa Indonesia', async () => {
    document.cookie = 'ab_lang=en; Path=/';
    document.documentElement.lang = 'en';
    stubFetch({ ...READS, 'PATCH /auth/me': { body: ME } });
    renderLive(<ProfilePage />, { me: ME });
    expect(field()).toHaveValue('en');

    await userEvent.selectOptions(field()!, 'id');

    expect(await screen.findByText('Tersimpan ✓')).toBeInTheDocument();
    expect(languageCookie()).toBe('id');
  });

  it('AC-3, AC-4 keeps what was typed in Your details across the change: the open form is not refilled', async () => {
    stubFetch({ ...READS, 'PATCH /auth/me': { body: ME } });
    renderLive(<ProfilePage />, { me: ME });
    // Live, somebody who has chosen nothing reads Bahasa Indonesia (P18.98-T4, the account's words).
    const preferred = screen.getByLabelText('Nama panggilan');
    await userEvent.clear(preferred);
    await userEvent.type(preferred, 'Rin');

    await userEvent.selectOptions(field()!, 'en');
    await screen.findByText('Saved ✓');

    // The same box, its label now English, what was typed in it kept.
    expect(screen.getByLabelText('Preferred name')).toBe(preferred);
    expect(preferred).toHaveValue('Rin');
  });

  it('AC-4 says Couldn’t save — retry when the account cannot be told, and the retry sends it again', async () => {
    const { calls } = stubFetch({
      ...READS,
      'PATCH /auth/me': [
        { status: 503, body: { error: { code: 'INTERNAL_ERROR', message: 'Down', requestId: 'r' } } },
        { body: ME },
      ],
    });
    renderLive(<ProfilePage />, { me: ME });

    await userEvent.selectOptions(field()!, 'en');
    const retry = await screen.findByRole('button', { name: "Couldn't save — retry: Language" });
    // The screen and the browser keep the choice meanwhile.
    expect(document.documentElement.lang).toBe('en');

    await userEvent.click(retry);

    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    const saves = calls.filter((c) => c.init.method === 'PATCH').map((c) => JSON.parse(c.init.body as string));
    expect(saves).toEqual([{ locale: 'en' }, { locale: 'en' }]);
  });

  it('AC-2 in a support session is shown and not offered, as the rest of Your details is', () => {
    const { calls } = stubFetch(READS);
    renderLive(<ProfilePage />, { me: SUPPORT });

    expect(field()).toBeDisabled();
    // Live and chosen nothing, the support session's reason is the account's Indonesian (P18.98-T4).
    expect(field()).toHaveAccessibleDescription('Hanya dia yang dapat mengubah ini, bukan sesi dukungan.');
    expect(calls.filter((c) => c.init.method === 'PATCH')).toHaveLength(0);
  });

  it('AC-4 is everybody’s: the Super Admin has it too', () => {
    stubFetch(READS);
    renderLive(<ProfilePage />, {
      me: makeMe({
        user: { ...ME.user, platformRole: 'super_admin' }, membership: null, permissions: ['profile:read_self'],
      }),
    });

    expect(field()).toBeEnabled();
  });
});
