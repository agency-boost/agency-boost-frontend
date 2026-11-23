import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, routeParams, stubFetch } from '@test/harness';
import { addUserMessages } from '@/i18n/messages/add-user';
import UserInvitePage from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/user-invite/tok-1',
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * **`/user-invite/[token]` in Indonesian** (P19.28-T1 AC-4; ADR-0286 §2): *Tambah user*'s link as the person invited reads
 * it — the KPM, its company, the name typed, the role, *Masuk* coming back, *Daftar*, *Terima & bergabung* — and none of
 * the area's English left. Accepting joins the KPM and opens Home; a refusal is the server's own sentence.
 */
const ENGLISH = englishOnly(addUserMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

const BANNER = {
  kpmName: 'Bekasi Barat Branch', kpmCode: '0602', companyName: 'Prudential', fullName: 'Rina Kartika',
  roleLabel: 'Agent', makeOwner: false, expiresAt: '2026-12-06T03:00:00.000Z',
};
const page = () => <UserInvitePage params={routeParams({ token: 'tok-1' })} />;

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockReset();
});

describe('P19.28-T1 AC-4 /user-invite in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH).toEqual(expect.arrayContaining(['Accept & join', 'Invitation']));
  });

  it('P19.28-T1 AC-4 signed out: the banner, Masuk coming back, Daftar and the note', async () => {
    stubFetch({ '/user-invites/tok-1': { body: BANNER } });
    renderInIndonesian(page(), { me: null });
    expect(await screen.findByText('Untuk Rina Kartika')).toBeInTheDocument();
    expect(screen.getByText('KPM Bekasi Barat Branch · Prudential')).toBeInTheDocument();
    expect(screen.getByText('Peran: Agent')).toBeInTheDocument();
    expect(screen.getByText(/^Tautan ini berlaku sampai 6 Des 2026\.$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Masuk' })).toHaveAttribute('href', expect.stringContaining('user-invite'));
    expect(screen.getByRole('link', { name: 'Daftar' })).toHaveAttribute('href', '/register');
    noEnglishLeft();
  });

  it('P19.28-T1 AC-4 signed in: Terima & bergabung joins the KPM and opens Home; an owner invitation says so', async () => {
    const { calls } = stubFetch({
      '/notifications': { body: { items: [], unread: 0 } },
      'GET /user-invites/tok-1': { body: { ...BANNER, makeOwner: true } },
      'POST /user-invites/tok-1/accept': { body: { kpmId: 'k1', kpmName: 'Bekasi Barat Branch', membershipId: 'm1' } },
    });
    renderInIndonesian(page(), {
      me: makeMe({ user: { ...makeMe().user, fullName: 'Rina Kartika' }, membership: null, permissions: ['join_via_code_link_qr'] }),
    });
    expect(await screen.findByText('Anda juga akan menjadi owner KPM ini.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Terima & bergabung' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(calls.some((c) => c.url.includes('/user-invites/tok-1/accept') && c.init.method === 'POST')).toBe(true);
    noEnglishLeft();
  });

  it('P19.28-T1 AC-4 a link that opens nothing says why, in the server’s words', async () => {
    stubFetch({ '/user-invites/tok-1': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Undangan ini sudah dibatalkan.' } } } });
    renderInIndonesian(page(), { me: null });
    expect(await screen.findByText('Undangan ini sudah dibatalkan.')).toBeInTheDocument();
  });
});
