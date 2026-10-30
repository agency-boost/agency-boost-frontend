import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, resetLanguage, stubFetch } from '@test/harness';
import { describeDevice } from '@/components/session-list';
import { accountMessages } from '@/i18n/messages/account';
import ProfilePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/profile',
}));

const ENGLISH = englishOnly(accountMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

/** An AB tagged Core Leader, as `profile-mobile` draws Agus. */
const ME = makeMe({
  user: {
    ...makeMe().user, fullName: 'Agus Prasetyo', dateOfBirth: '1995-03-18', gender: 'male', companyJoinMonth: '2020-09',
    workStatus: 'full_time',
  },
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmOwner: false, isKpmAdmin: false,
    status: 'active', directCount: 4, isCoreLeader: true, groups: ['Marvelous'], office: { code: '0417', branch: 'BSD City Branch' },
  },
  permissions: ['profile:read_self', 'calendar_entry:read', 'calendar_entry:update'],
});
const SESSIONS = [
  {
    sessionId: 's1', userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit Chrome/120 Mobile Safari', ip: '103.10.1.2',
    lastUsedAt: '2026-09-10T08:00:00.000Z', startedAt: '2026-09-01T08:00:00.000Z', expiresAt: '2026-10-01T08:00:00.000Z', current: true,
  },
];
const READS = {
  '/auth/me/profile': {
    body: {
      companyName: 'Prudential Indonesia', agentCode: '70012345',
      leader: { name: 'Wilson Tanoto', orgLevelCode: 'AB' }, group: { people: 11, ab: 0, aab: 3, agents: 8 },
    },
  },
  '/join/my-code': { body: { code: 'AGUS01', url: 'https://app.test/join?code=AGUS01' } },
  '/auth/sessions': { body: SESSIONS },
  '/calendar/settings': { body: { hideDetails: false } },
  '/notifications': { body: { items: [], unread: 0 } },
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
});

describe('UI-111 Profil saya in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH.length).toBeGreaterThan(30);
    expect(ENGLISH).toEqual(expect.arrayContaining(['My profile', 'Personal details', 'Change photo']));
  });

  it('UI-111 the page in the report’s words: Profil saya, Ubah foto, Data diri, KPM dan peran, Pengaturan, Keamanan, Keluar', async () => {
    stubFetch(READS);
    renderInIndonesian(<ProfilePage />, { me: ME });

    expect(screen.getByRole('heading', { level: 1, name: 'Profil saya' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ubah foto' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['Data diri', 'KPM dan peran', 'Pengaturan', 'Keamanan']);
    expect(screen.getByRole('button', { name: 'Keluar' })).toBeInTheDocument();
    expect(await screen.findByText('Perusahaan asuransi')).toBeInTheDocument();
    expect(screen.getByText('Tidak bisa diubah. Hubungi admin KPM jika salah.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nomor WhatsApp')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Laki-laki' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Penuh waktu' })).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText('11 orang · 3 AAB · 8 Agent')).toBeInTheDocument();
    expect(screen.getByText('Leader Anda')).toBeInTheDocument();
    expect(screen.getByText('Grup informal')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Sembunyikan aktivitas Calendar' }))
      .toHaveAccessibleDescription('Tim tetap melihat waktu Anda sibuk, tanpa detail');
    expect(screen.getByRole('button', { name: /Perangkat tempat Anda masuk.*1 perangkat · ini: Chrome di Android/ })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('UI-111 the photo sheet in Indonesian: Foto profil, Kamera, Galeri, Simpan foto', async () => {
    stubFetch(READS);
    renderInIndonesian(<ProfilePage />, { me: ME });
    await userEvent.click(screen.getByRole('button', { name: 'Ubah foto profil Anda' }));
    const sheet = await screen.findByRole('dialog', { name: 'Foto profil' });
    expect(within(sheet).getByText('Pilih foto, lalu geser dan perbesar sesuai keinginan')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Kamera' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Galeri' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Simpan foto' })).toBeDisabled();
    noEnglishLeft();
  });

  it('UI-111 a change floats Belum disimpan · Simpan', async () => {
    stubFetch(READS);
    renderInIndonesian(<ProfilePage />, { me: ME });
    await userEvent.click(screen.getByRole('radio', { name: 'Paruh waktu' }));
    const pill = document.querySelector('[data-floating-save]') as HTMLElement;
    expect(within(pill).getByText('Belum disimpan')).toBeInTheDocument();
    expect(within(pill).getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
  });

  it('UI-111 the password sheet in Indonesian: Ubah kata sandi and its three fields', async () => {
    stubFetch(READS);
    renderInIndonesian(<ProfilePage />, { me: ME });
    await userEvent.click(screen.getByRole('button', { name: 'Ubah kata sandi' }));
    const sheet = await screen.findByRole('dialog', { name: 'Ubah kata sandi' });
    expect(within(sheet).getByLabelText('Kata sandi saat ini')).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Kata sandi baru')).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Konfirmasi kata sandi baru')).toBeInTheDocument();
  });

  it('UI-111 the email in Indonesian: the report’s hint, Ubah email, Kirim tautan, and the line once the link is sent', async () => {
    stubFetch({ ...READS, 'POST /auth/me/email': { status: 202, body: { status: 'accepted' } } });
    renderInIndonesian(<ProfilePage />, { me: ME });

    const field = screen.getByLabelText('Email');
    expect(field).toHaveAccessibleDescription('Jika diubah, tautan verifikasi dikirim ke alamat baru');
    await userEvent.clear(field);
    await userEvent.type(field, 'agus.baru@kpm0417.test');
    const pill = document.querySelector('[data-floating-save]') as HTMLElement;
    await userEvent.click(within(pill).getByRole('button', { name: 'Simpan' }));

    const sheet = await screen.findByRole('dialog', { name: 'Ubah email' });
    expect(within(sheet).getByText('Masukkan kata sandi Anda untuk mengirim tautan verifikasi ke agus.baru@kpm0417.test.')).toBeInTheDocument();
    await userEvent.type(within(sheet).getByLabelText('Kata sandi saat ini'), 'kata-sandi-1');
    noEnglishLeft();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Kirim tautan' }));

    expect(await screen.findByText(
      'Tautan verifikasi dikirim ke agus.baru@kpm0417.test. Email Anda berubah setelah tautan itu dibuka.',
    )).toBeInTheDocument();
    noEnglishLeft();
  });

  it('UI-111 an address that is not one, in Indonesian', async () => {
    stubFetch(READS);
    renderInIndonesian(<ProfilePage />, { me: ME });
    const field = screen.getByLabelText('Email');
    await userEvent.clear(field);
    await userEvent.type(field, 'agus');
    await userEvent.click(within(document.querySelector('[data-floating-save]') as HTMLElement).getByRole('button', { name: 'Simpan' }));
    expect(await screen.findByText('Tulis alamat email yang lengkap, misalnya nama@contoh.com.')).toBeInTheDocument();
  });
});

describe('P18.98-T4 describeDevice, in the words’ language', () => {
  it('names a device in Indonesian, a browser’s and a system’s names their own', () => {
    expect(describeDevice('Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari', 'id')).toBe('Chrome di Android');
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit', 'id')).toBe('iPhone atau iPad');
    expect(describeDevice(null, 'id')).toBe('Perangkat tidak dikenal');
    expect(describeDevice('curl/8.4.0', 'id')).toBe('Perangkat tidak dikenal');
  });

  it('reads English when no language is passed, as its spec always has', () => {
    expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605')).toBe('Safari on Mac');
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit')).toBe('iPhone or iPad');
  });
});
