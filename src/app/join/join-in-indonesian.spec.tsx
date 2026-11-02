import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { browserChose, makeMe, renderInIndonesian, renderWithLanguage, resetLanguage, stubFetch } from '@test/harness';
import { joinMessages } from '@/i18n/messages/join';
import JoinPage from './page';

/**
 * **`/join` in Indonesian** (P18.98-T4 AC-1 to AC-4, public and account): a leader's code checked, for somebody signed
 * out, with no office, or already in one, and a leader's invite to one person. The approved glossary's words
 * (`i18n/messages/join.tsx`; the §A.2 titles, *office* is *KPM*, *reports to* *melapor ke*), *KPM* and *leader* kept,
 * the office's label, a leader's name, a branch, a company and an agent code as stored, the join date in the reader's
 * figures, and none of the area's English left. English is the page's own spec's, unchanged.
 */
let query = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/join',
  useSearchParams: () => query,
}));

const ENGLISH = englishOnly(joinMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

const PREVIEW = { code: 'JOR417', kpmLabel: 'Prudential — KPM 0417 · BSD City Branch', leaderName: 'Wilson Tanoto' };
const NEWCOMER = makeMe({ membership: null, permissions: ['join_via_code_link_qr'] });
const MEMBER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['join_via_code_link_qr'],
});
const BANNER = {
  leaderName: 'Agus Prasetyo', kpm: { code: '0417', branchName: 'BSD City Branch' }, companyId: 'co-1', companyName: 'Prudential',
  agentCode: '20001', joinDate: '2026-10-27', fullName: 'Yoga Pratama', existingAccount: false, expiresAt: '2026-11-10T03:00:00.000Z',
};
const SHELL = { '/notifications': { body: { items: [], unread: 0 } } };

afterEach(() => {
  query = new URLSearchParams();
  vi.unstubAllGlobals();
  resetLanguage();
});

describe('P18.98-T4 /join in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH.length).toBeGreaterThan(20);
    expect(ENGLISH).toEqual(expect.arrayContaining(['Join an office', 'Check this invite']));
  });

  it('AC-1 signed out: the title, the way to sign in first and the link inside its sentence', () => {
    stubFetch({});
    renderInIndonesian(<JoinPage />, { me: null });
    // Signed out there is no shell, so no title: the card alone (`RoleShell`'s `allowSignedOut`).
    expect(screen.getByText('Masuk terlebih dahulu, lalu buka tautan ini lagi.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Masuk' })).toHaveAttribute('href', '/login');
    const create = screen.getByRole('link', { name: 'Buat akun' });
    expect(create).toHaveAttribute('href', '/register');
    expect(create.parentElement).toHaveTextContent(/^Belum punya akun\? Buat akun\.$/);
    expect(screen.getByLabelText('Kode undangan')).toHaveAccessibleDescription('Enam karakter. Huruf besar atau kecil, tidak masalah.');
    expect(screen.getByRole('button', { name: 'Periksa undangan ini' })).toBeDisabled();
    noEnglishLeft();
  });

  it('AC-1, AC-4 a code checked: the office’s label and the leader as stored, bold, in one Indonesian sentence', async () => {
    query = new URLSearchParams('code=JOR417');
    stubFetch({ ...SHELL, '/join/invite': { body: PREVIEW } });
    renderInIndonesian(<JoinPage />, { me: NEWCOMER });
    expect(await screen.findByText('Prudential — KPM 0417 · BSD City Branch')).toBeInTheDocument();
    expect(screen.getByText('Undangan ini untuk')).toBeInTheDocument();
    const leader = screen.getByText('Wilson Tanoto');
    expect(leader.tagName).toBe('STRONG');
    expect(leader.parentElement).toHaveTextContent(/^Anda akan melapor ke Wilson Tanoto\.$/);
    expect(screen.getByText(/^Menerima undangan ini langsung memasukkan Anda/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terima dan bergabung' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Gunakan kode lain' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 already in an office: why the invite is not theirs, and the way back to their work', async () => {
    stubFetch(SHELL);
    renderInIndonesian(<JoinPage />, { me: MEMBER });
    expect(await screen.findByText('Anda sudah tergabung di KPM, jadi undangan ini bukan untuk Anda.')).toBeInTheDocument();
    // Signed in, the shell draws the page's title and its line.
    expect(screen.getByRole('heading', { level: 1, name: 'Bergabung ke KPM' })).toBeInTheDocument();
    expect(screen.getByText('Dengan kode, tautan, atau QR dari leader. Ketiganya adalah undangan yang sama.')).toBeInTheDocument();
    expect(screen.getByText(/^Pindah antar-KPM tidak dapat Anda lakukan sendiri/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali ke halaman kerja Anda' })).toHaveAttribute('href', '/home');
    noEnglishLeft();
  });

  it('AC-1, AC-3, AC-4 a leader’s invite, signed out: the banner whole, the details with the join date in Indonesian', async () => {
    query = new URLSearchParams('invite=kpm-1.secret');
    stubFetch({ '/invites/kpm-1.secret': { body: BANNER } });
    renderInIndonesian(<JoinPage />, { me: null });
    expect(await screen.findByText('Anda bergabung ke tim Agus Prasetyo · KPM 0417')).toBeInTheDocument();
    expect(screen.getByText('BSD City Branch · Prudential')).toBeInTheDocument();
    expect(screen.getByText('Kode agen 20001 · Tanggal bergabung 27 Okt 2026')).toBeInTheDocument();
    expect(screen.getByText('Masuk dengan akun yang terhubung dengan kode agen Anda, lalu terima undangannya.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Masuk untuk menerima' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buat akun dengan undangan ini' }))
      .toHaveAttribute('href', '/register?invite=kpm-1.secret');
    noEnglishLeft();
  });

  it('AC-1 a leader’s invite, signed in: one Indonesian button', async () => {
    query = new URLSearchParams('invite=kpm-1.secret');
    stubFetch({ ...SHELL, '/invites/kpm-1.secret': { body: { ...BANNER, existingAccount: true } } });
    renderInIndonesian(<JoinPage />, { me: NEWCOMER });
    expect(await screen.findByRole('button', { name: 'Terima dan bergabung' })).toBeEnabled();
    expect(screen.getByRole('heading', { level: 1, name: 'Bergabung ke tim leader Anda' })).toBeInTheDocument();
    expect(screen.getByText('Undangan dari leader Anda, ditujukan kepada Anda lewat kode agen Anda.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T3 a visitor who chose nothing reads English words and the join date in Indonesian while not live', async () => {
    query = new URLSearchParams('invite=kpm-1.secret');
    stubFetch({ '/invites/kpm-1.secret': { body: BANNER } });
    renderWithLanguage(<JoinPage />, { me: null }, { live: false });
    expect(await screen.findByText('Agent code 20001 · Join date 27 Okt 2026')).toBeInTheDocument();
  });

  it('a visitor whose browser chose Indonesian reads it before signing in', async () => {
    browserChose('id');
    query = new URLSearchParams('invite=kpm-1.secret');
    stubFetch({ '/invites/kpm-1.secret': { body: BANNER } });
    renderWithLanguage(<JoinPage />, { me: null }, { live: false });
    expect(await screen.findByText('Kode agen 20001 · Tanggal bergabung 27 Okt 2026')).toBeInTheDocument();
    noEnglishLeft();
  });
});
