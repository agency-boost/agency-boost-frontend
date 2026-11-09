import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian, resetLanguage, stubFetch } from '@test/harness';
import ProfilePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/profile',
}));

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
});

/**
 * Stefan, registered and in no office yet (UI-166, 3 November): what `GET /auth/me` answers him since ADR-0189 §5 — the
 * join flow's grants, his inbox, and his own profile.
 */
const STEFAN = makeMe({
  user: {
    id: 'u-stefan', email: 'stefan@example.test', fullName: 'Stefan Kurniawan', preferredName: null, pronoun: 'he',
    initials: 'SK', platformRole: 'none', phone: null, avatarUrl: null,
  },
  membership: null,
  permissions: [
    'join_via_code_link_qr', 'kpm:read_directory', 'kpm_registration:create', 'kpm_request:create',
    'notification:mark_read', 'notification:read_inbox', 'profile:read_self', 'profile:update_self',
  ],
});

/**
 * **Profile always opens** (P19-T4 AC-5; UI-166 item 3; ADR-0189 §5): with the tab bar, the details, and *Keluar* — for
 * somebody in no office as for every member. Nothing of an office's is asked for it.
 */
describe('P19-T4 Profile for somebody in no office', () => {
  it('P19-T4 AC-5 opens with the tab bar, the details to edit and Keluar, and is never Tidak tersedia', async () => {
    atWidth(375);
    const { calls } = stubFetch({
      '/auth/me/profile': { body: { companyName: null, agentCode: null, leader: null, group: null } },
      '/auth/sessions': { body: [] },
      '/notifications': { body: { items: [], unread: 0 } },
    });
    renderInIndonesian(<ProfilePage />, { me: STEFAN });

    expect(await screen.findByRole('heading', { level: 1, name: 'Profil saya' })).toBeInTheDocument();
    expect(screen.queryByText('Tidak tersedia untuk Anda')).not.toBeInTheDocument();
    expect(document.querySelector('[data-tab-bar]')).not.toBeNull();
    const profile = document.querySelector('[data-profile]') as HTMLElement;
    expect(within(profile).getByRole('button', { name: 'Keluar' })).toBeEnabled();
    expect(within(profile).getByDisplayValue('Stefan Kurniawan')).toBeInTheDocument();
    // No office, so no *KPM dan peran* — and nothing an office answers was asked.
    expect(screen.queryByRole('heading', { level: 2, name: 'KPM dan peran' })).not.toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => /\/kpm\/|\/calendar\/|\/join\/my-code/.test(c.url))).toBe(false));
  });
});
