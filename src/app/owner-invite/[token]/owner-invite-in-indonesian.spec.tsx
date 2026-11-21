import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import { ownerInviteMessages } from '@/i18n/messages/owner-invite';
import OwnerInvitePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/owner-invite/tok-1',
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * **`/owner-invite/[token]` in Indonesian** (P19.23-T2 AC-3; OD-420): the claim link as the KPM's future Owner reads it —
 * the spec's *Terima & jadi owner*, *Masuk*, *Daftar* — signed out and signed in, the KPM's name, the company and the
 * Owner's name as stored, the date in the reader's figures, and none of the area's English left.
 */
const ENGLISH = englishOnly(ownerInviteMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

const BANNER = {
  kpmName: 'Serpong Branch', kpmCode: '0418', companyName: 'Prudential', ownerName: 'BUDI HARTONO',
  expiresAt: '2026-11-27T03:00:00.000Z',
};
const page = () => <OwnerInvitePage params={routeParams({ token: 'tok-1' })} />;

afterEach(() => vi.unstubAllGlobals());

describe('P19.23-T2 AC-3 /owner-invite in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH.length).toBeGreaterThan(10);
    expect(ENGLISH).toEqual(expect.arrayContaining(['Accept & become owner', 'Owner invitation']));
  });

  it('P19.23-T2 AC-3 signed out: the banner, Masuk coming back, Daftar and the note', async () => {
    stubFetch({ '/owner-invites/tok-1': { body: BANNER } });
    renderInIndonesian(page(), { me: null });
    expect(await screen.findByText('Untuk BUDI HARTONO')).toBeInTheDocument();
    expect(screen.getByText('KPM Serpong Branch · Prudential')).toBeInTheDocument();
    expect(screen.getByText(/^Tautan ini berlaku sampai 27 Nov 2026\.$/)).toBeInTheDocument();
    expect(screen.getByText('Masuk terlebih dahulu — Anda akan kembali ke undangan ini.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Masuk' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Daftar' })).toHaveAttribute('href', '/register');
    expect(screen.getByText('Setelah mendaftar dan memverifikasi email, buka tautan ini lagi.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P19.23-T2 AC-3 signed in: Terima & jadi owner', async () => {
    stubFetch({ '/notifications': { body: { items: [], unread: 0 } }, '/owner-invites/tok-1': { body: BANNER } });
    renderInIndonesian(page(), {
      me: makeMe({ user: { ...makeMe().user, fullName: 'Budi Hartono' }, membership: null, permissions: ['join_via_code_link_qr'] }),
    });
    expect(await screen.findByRole('button', { name: 'Terima & jadi owner' })).toBeEnabled();
    expect(screen.getByText('Masuk sebagai Budi Hartono.')).toBeInTheDocument();
    expect(screen.getByText('Dengan menerima, akun Anda menjadi owner KPM ini: semua halaman KPM, dengan hak penuh.')).toBeInTheDocument();
    noEnglishLeft();
  });
});
