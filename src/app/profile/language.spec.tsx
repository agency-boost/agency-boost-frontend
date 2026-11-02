import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { languageCookie, makeMe, renderLive, renderWithSession, resetLanguage, stubFetch } from '@test/harness';
import ProfilePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/profile',
}));

/**
 * ***Bahasa* on *Profil saya*** (UI V1, UI-111; ADR-0180 §3; P18.98-T2 AC-4 before it): a row showing the language the
 * screen is in, opening a small sheet of the two; choosing one is **the same preference as the *ID | EN* switch** —
 * the screen at once, the browser's cookie, the account (`useChooseLanguage`).
 */
const ME = makeMe({ permissions: ['profile:read_self'] });
const SUPPORT = makeMe({
  permissions: ['profile:read_self'], isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'sa-1',
});

const READS = {
  '/auth/me/profile': { body: { companyName: null, agentCode: null, leader: null, group: null } },
  '/auth/sessions': { body: [] },
  '/notifications/unread-count': { body: { unread: 0 } },
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
});

describe('UI-111 Bahasa on Profil saya', () => {
  it('UI-111 is not drawn while the switch is not live', () => {
    stubFetch(READS);
    renderWithSession(<ProfilePage />, { me: ME });
    expect(screen.queryByRole('button', { name: /^(Language|Bahasa)/ })).not.toBeInTheDocument();
  });

  it('UI-111 offers the two languages, each by its own name in its own language, the one in force checked', async () => {
    stubFetch(READS);
    renderLive(<ProfilePage />, { me: ME });
    await userEvent.click(screen.getByRole('button', { name: /^Bahasa/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Bahasa' });
    const id = within(sheet).getByRole('radio', { name: 'Bahasa Indonesia' });
    const en = within(sheet).getByRole('radio', { name: 'English' });
    expect(id).toHaveAttribute('lang', 'id');
    expect(en).toHaveAttribute('lang', 'en');
    expect(id).toHaveAttribute('aria-checked', 'true');
  });

  it('UI-111 choosing saves at once: the account, the cookie and the screen, and the sheet closes', async () => {
    const { calls } = stubFetch({ ...READS, 'PATCH /auth/me': { body: ME } });
    renderLive(<ProfilePage />, { me: ME });
    await userEvent.click(screen.getByRole('button', { name: /^Bahasa/ }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Bahasa' })).getByRole('radio', { name: 'English' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'My profile' })).toBeInTheDocument();
    expect(languageCookie()).toBe('en');
    expect(calls.some((c) => c.init.method === 'PATCH' && JSON.parse(String(c.init.body)).locale === 'en')).toBe(true);
    expect(screen.queryByRole('dialog', { name: 'Language' })).not.toBeInTheDocument();
  });

  it('UI-111 in a support session it is shown and not offered: the person’s language is theirs (ADR-0162 §4)', () => {
    stubFetch(READS);
    renderLive(<ProfilePage />, { me: SUPPORT });
    expect(screen.getByRole('button', { name: /^Bahasa/ })).toBeDisabled();
  });

  it('UI-111 is everybody’s: the Super Admin has it too', () => {
    stubFetch(READS);
    renderLive(<ProfilePage />, {
      me: makeMe({
        user: { ...ME.user, platformRole: 'super_admin' }, membership: null, permissions: ['profile:read_self'],
      }),
    });
    expect(screen.getByRole('button', { name: /^Bahasa/ })).toBeEnabled();
  });
});
