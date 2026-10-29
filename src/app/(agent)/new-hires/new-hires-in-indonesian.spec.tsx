import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { englishOnly, englishShown } from '@test/english-left';
import { renderInIndonesian, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import { leaderView, notFound, ROSTER, SARI, SARI_ME, SHELL_STUBS } from '@test/activation-fixtures';
import { invite, JOINING_PERMISSIONS, joinRequest, LINK, requestedTransfer, shared, TODAY } from '@test/joining-fixtures';
import { DATE_SETTLE_MS } from '@/components/activation-parts';
import { activationMessages } from '@/i18n/messages/activation';
import { addAgentMessages } from '@/i18n/messages/add-agent';
import { newHiresMessages } from '@/i18n/messages/new-hires';
import { inviteMessage } from '@/lib/invites';
import { PHONE_QUERY } from '@/lib/use-phone';
import NewHireDetailPage from './[membershipId]/page';
import NewHiresPage from './page';

/**
 * **New Hires in Indonesian** (P18.98-T4 AC-1 to AC-4, new hires and activation): `/new-hires` — the 3M activation %
 * with its filter and its units, the three sections as tables and as a phone's cards, *Jadwalkan 1:1* and *Tandai
 * keluar* with its confirmation — its joining half — *Tinjau permintaan (n)*, *+ Tambah agent* and its share step,
 * *Menunggu bergabung* — and one hire's `/new-hires/[membershipId]`. The approved glossary's words
 * (`i18n/messages/new-hires.ts`, `activation.ts`, `add-agent.ts`), each kept term English (§A), names and codes as
 * typed, every date in Indonesian, and no English message of these modules left (`englishShown`). English is the other
 * specs', unchanged.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/new-hires',
}));

const ENGLISH = englishOnly(newHiresMessages, activationMessages, addAgentMessages);
const noEnglishLeft = (root: Element = document.body) => expect(englishShown(root, ENGLISH)).toEqual([]);

/** Sari, who may add agents, decide the requests addressed to her, mark a hire left and put a 1:1 on the calendar. */
const ACTING = {
  ...SARI_ME, permissions: [...SARI_ME.permissions, ...JOINING_PERMISSIONS, 'new_hire:mark_left', 'calendar_entry:create'],
};

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = ACTING) => {
  const stub = stubFetch({
    ...SHELL_STUBS,
    '/new-hires': { body: ROSTER },
    '/new-hires/invites': { body: { today: TODAY, invites: [] } },
    '/new-hires/transfers': { body: [] },
    '/join/requests': { body: [] },
    '/join/requests/routing': { body: [] },
    ...routes,
  });
  renderInIndonesian(<AgentLayout><NewHiresPage /></AgentLayout>, { me });
  return stub;
};
const region = (name: string) => screen.findByRole('region', { name });
const IN_PROGRESS = 'Berjalan (hari 1–90)';

afterEach(() => vi.unstubAllGlobals());

describe('P18.98-T4 /new-hires in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass: the same roster in English shows it', async () => {
    expect(ENGLISH.length).toBeGreaterThan(100);
    stubFetch({ ...SHELL_STUBS, '/new-hires': { body: ROSTER } });
    renderInLayout(AgentLayout, <NewHiresPage />, { me: SARI_ME });
    await screen.findByRole('region', { name: 'In progress (day 1–90)' });
    expect(englishShown(document.body, ENGLISH)).toEqual(expect.arrayContaining(['Join month', 'No checklist', 'Result']));
  });

  it('AC-1, AC-2 its title and the 3M activation % kept, the counts, the filter and the units Indonesian', async () => {
    show();
    const top = within(await region('3M activation %'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^New Hires$/);
    expect(screen.getByText('Pantau progres 90-day activation agen baru Anda.')).toBeInTheDocument();
    expect(top.getByText('2 teraktivasi · 2 tidak teraktivasi · 4 berjalan')).toBeInTheDocument();
    const select = top.getByRole('combobox', { name: 'Bulan bergabung' });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Semua', 'Sep 2026', 'Agu 2026', 'Jul 2026']);
    expect(within(top.getByRole('list', { name: 'Per unit' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Direct Unit 67%', 'AAB: Arief Hidayat 0%', 'AAB: Sari Puspita —Belum ada hasil',
    ]);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      '3M activation %', IN_PROGRESS, 'Teraktivasi', 'Tidak teraktivasi',
    ]);
    noEnglishLeft();
  });

  it('AC-1, AC-2 a section’s columns and rows: First sale kept, a day, a checklist and a result in Indonesian', async () => {
    show();
    const table = within(await region(IN_PROGRESS)).getByRole('table', { name: IN_PROGRESS });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Nama', 'Tanggal bergabung', 'Hari', 'Checklist', 'First sale',
    ]);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['4 Agu 2026', '85 /90', '56%', '23 Agu 2026']);
    expect(within(within(table).getByRole('row', { name: /Fikri Ramadhan/ })).getAllByRole('cell')[2]).toHaveTextContent(/^Tanpa checklist$/);

    const not = within(await region('Tidak teraktivasi'));
    expect(within(not.getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Nama', 'Tanggal bergabung', 'Checklist', 'First sale', 'Hasil', 'Aksi',
    ]);
    expect(within(not.getByRole('row', { name: /Tari Wulandari/ })).getAllByRole('cell')[3])
      .toHaveTextContent(/^Tidak teraktivasi · Keluar 21 Okt 2026$/);
    const indah = within(within(await region('Teraktivasi')).getByRole('row', { name: /Indah Permata/ })).getAllByRole('cell')[1];
    expect(indah.querySelector('[data-overdue]')).toHaveTextContent(/^94%, terlambat$/);
    noEnglishLeft();
  });

  it('AC-1, AC-3 Jadwalkan 1:1 and Tandai keluar, the confirmation whole, and what it answers', async () => {
    show({
      'POST /new-hires/mem-lukman/left': {
        body: { membershipId: 'mem-lukman', leftAt: '2026-10-27T03:00:00.000Z', leftOn: '2026-10-27', activation3M: 'not_activated' },
      },
    });
    const not = within(await region('Tidak teraktivasi'));
    expect(not.getByRole('link', { name: 'Jadwalkan 1:1 dengan Lukman Hakim' })).toHaveTextContent('Jadwalkan 1:1');
    await userEvent.click(not.getByRole('button', { name: 'Tandai keluar — Lukman Hakim' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(
      'Tandai Lukman Hakim sebagai keluar? Dia tetap ada di catatan Anda beserta riwayatnya, dan hasil 3M activation miliknya '
        + 'ditetapkan hari ini. Ini tidak dapat diurungkan.',
    );
    expect(within(dialog).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tandai keluar' }));
    expect(await screen.findByText('Lukman Hakim ditandai keluar.')).toBeInTheDocument();
  });

  it('AC-1 a refusal of Tandai keluar says so in Indonesian, the server’s sentence as it comes', async () => {
    show({
      'POST /new-hires/mem-lukman/left': {
        status: 409, body: { error: { code: 'NEW_HIRE_HAS_REPORTS', message: '1 person reports to them.', requestId: 'r-1' } },
      },
    });
    await userEvent.click(within(await region('Tidak teraktivasi')).getByRole('button', { name: 'Tandai keluar — Lukman Hakim' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Tandai keluar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Gagal menandai keluar. 1 person reports to them.');
  });

  it('AC-1 its states in Indonesian: the wait, nobody in the year, a section with nobody', async () => {
    show({ '/new-hires': { body: { ...ROSTER, sections: { ...ROSTER.sections, activated: [] } } } });
    expect(screen.getByRole('status')).toHaveTextContent('Memuat new hires Anda…');
    expect(within(await region('Teraktivasi')).getByText('Tidak ada siapa pun di sini.')).toBeInTheDocument();
  });

  it('AC-1 nobody who joined as a new hire in the year', async () => {
    show({ '/new-hires': notFound });
    expect(await screen.findByText('Tidak ada orang yang Anda pimpin yang bergabung sebagai new hire dalam 12 bulan terakhir.'))
      .toBeInTheDocument();
  });

  it('AC-1, AC-3 on a phone, a card per hire: the day in words and the two dates, whole', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query, matches: query === PHONE_QUERY, addEventListener: () => {}, removeEventListener: () => {},
    })));
    show();
    await screen.findByRole('list', { name: IN_PROGRESS });
    const budi = screen.getByText('Budi Hartono').closest('li')!;
    expect(budi).toHaveTextContent('Hari ke-62 dari 90');
    expect(budi).toHaveTextContent('Tanggal bergabung 27 Agu 2026 · First sale —');
    expect(screen.getByText('Tari Wulandari').closest('li')).toHaveTextContent('Tidak teraktivasi · Keluar 21 Okt 2026');
    noEnglishLeft();
  });
});

describe('P18.98-T4 /new-hires’ joining half in Indonesian', () => {
  it('AC-1, AC-4 Waiting to join: an invite, an expired one in another unit, a transfer the KPM decides', async () => {
    show({
      '/new-hires/invites': {
        body: {
          today: TODAY,
          invites: [invite(), invite({ inviteId: 'inv-2', fullName: 'Rudi Hartono', status: 'expired', leader: { membershipId: 'mem-arief', name: 'Arief Hidayat' } })],
        },
      },
      '/new-hires/transfers': { body: [requestedTransfer()] },
    });
    const section = within(await region('Menunggu bergabung'));
    const rows = section.getAllByRole('listitem');
    expect(within(rows[0]).getByText('Diundang, menunggu bergabung')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/80777 · Tanggal bergabung 27 Okt 2026/)).toBeInTheDocument();
    expect(within(rows[0]).getByRole('button', { name: 'Kirim ulang' })).toBeInTheDocument();
    expect(within(rows[1]).getByText('Undangan kedaluwarsa')).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('Ke unit Arief Hidayat');
    expect(within(rows[2]).getByText('Pemindahan diajukan')).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent('87014 · Ke unit Agus Prasetyo · KPM yang memutuskan');
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Batalkan undangan' }));
    const ask = await screen.findByRole('dialog', { name: 'Batalkan undangan untuk Yusuf Hidayat? Tautannya tidak akan berfungsi lagi.' });
    expect(within(ask).getByRole('button', { name: 'Jangan batalkan' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 Tinjau permintaan (n) opens the inbox under its title and line in Indonesian', async () => {
    show({ '/join/requests': { body: [joinRequest(), joinRequest({ requestId: 'req-2', fullName: 'Fajar Nugroho', initials: 'FN' })] } });
    await userEvent.click(await screen.findByRole('button', { name: 'Tinjau permintaan (2)' }));
    const inbox = await screen.findByRole('dialog', { name: 'Tinjau permintaan' });
    expect(inbox).toHaveAccessibleDescription('Setujui untuk menambahkan mereka ke unit Anda, beserta tanggal mereka bergabung.');
    expect(within(inbox).getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
  });

  it('AC-1 + Tambah agent: its four fields, their hints and refusals in Indonesian, today in Indonesian', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: '+ Tambah agent' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Tambah agent' }));
    expect(dialog.getByLabelText('Kode agen')).toHaveAccessibleDescription('Diterbitkan oleh perusahaan, tertera di kontraknya.');
    expect(dialog.getByLabelText('Nama')).toBeInTheDocument();
    expect(dialog.getByLabelText('Nomor WhatsApp')).toHaveAccessibleDescription('Tautan undangan dikirim ke nomor ini.');
    expect(dialog.getByLabelText('Tanggal bergabung')).toHaveValue(TODAY);
    expect(dialog.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    await userEvent.type(dialog.getByLabelText('Kode agen'), 'PRU-1');
    expect(dialog.getByText('Hanya angka, sesuai kontraknya.')).toBeInTheDocument();
    await userEvent.type(dialog.getByLabelText('Nomor WhatsApp'), '123');
    fireEvent.blur(dialog.getByLabelText('Nomor WhatsApp'));
    expect(await dialog.findByText('Masukkan nomor WhatsApp, seperti 0812-3456-7890.')).toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText('Tanggal bergabung'), { target: { value: '2026-10-28' } });
    expect(dialog.getByText('Tanggal bergabung tidak boleh setelah hari ini, 27 Okt 2026.')).toBeInTheDocument();
    noEnglishLeft(screen.getByRole('dialog'));
  });

  it('AC-1, AC-4 the share step in Indonesian, and the WhatsApp message the client’s Indonesian', async () => {
    show({ 'POST /new-hires/agents': { body: { outcome: 'invited', ...shared() } } });
    await userEvent.click(await screen.findByRole('button', { name: '+ Tambah agent' }));
    const form = within(await screen.findByRole('dialog', { name: 'Tambah agent' }));
    await userEvent.type(form.getByLabelText('Kode agen'), '80777');
    await userEvent.type(form.getByLabelText('Nama'), 'Yusuf Hidayat');
    await userEvent.type(form.getByLabelText('Nomor WhatsApp'), '0812-8077-7001');
    await userEvent.click(form.getByRole('button', { name: 'Tambah agent' }));

    const share = within(await screen.findByRole('dialog', { name: 'Undang Yusuf Hidayat' }));
    expect(share.getByText('Undangan untuk Yusuf Hidayat sudah siap. Tautannya bisa dipakai sekali, hingga 10 Nov 2026.')).toBeInTheDocument();
    expect(share.getByRole('link', { name: 'Bagikan di WhatsApp' })).toHaveAttribute(
      'href', `https://wa.me/6281280777001?text=${encodeURIComponent(inviteMessage('Yusuf Hidayat', LINK))}`,
    );
    expect(inviteMessage('Yusuf Hidayat', LINK)).toBe(`Halo Yusuf Hidayat, saya mengundang Anda bergabung di tim saya di AgencyBoost: ${LINK}`);
    expect(share.getByText(LINK)).toBeInTheDocument();
    expect(share.getByRole('button', { name: 'Salin tautan' })).toBeInTheDocument();
    expect(share.getByRole('button', { name: 'Selesai' })).toBeInTheDocument();
    noEnglishLeft(screen.getByRole('dialog'));
  });

  it('AC-1 a linked account: what it did, in Indonesian, after the shared confirmation', async () => {
    show({ 'POST /new-hires/agents': { body: { outcome: 'linked', member: { membershipId: 'mem-putri', fullName: 'Putri Anggraini' } } } });
    await userEvent.click(await screen.findByRole('button', { name: '+ Tambah agent' }));
    const form = within(await screen.findByRole('dialog', { name: 'Tambah agent' }));
    await userEvent.type(form.getByLabelText('Kode agen'), '80008');
    await userEvent.type(form.getByLabelText('Nama'), 'Putri');
    await userEvent.type(form.getByLabelText('Nomor WhatsApp'), '0812-1111-2222');
    await userEvent.click(form.getByRole('button', { name: 'Tambah agent' }));
    // `CONFIRMED.agentAdded` is `lib/confirmations.ts`', the shared area's: its words move with it.
    expect(await screen.findByText(/— Putri Anggraini sekarang ada di unit Anda\.$/)).toBeInTheDocument();
  });
});

describe('P18.98-T4 /new-hires/[membershipId] in Indonesian', () => {
  const detail = (routes: Record<string, StubReply | StubReply[]> = {}) => {
    const stub = stubFetch({
      ...SHELL_STUBS,
      'GET /new-hires/mem-rina': { body: leaderView({ day: 95, overdue: true, startCorrected: { by: SARI, at: '2026-08-07T02:00:00.000Z' } }) },
      ...routes,
    });
    renderInIndonesian(<AgentLayout><NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} /></AgentLayout>, { me: SARI_ME });
    return stub;
  };

  it('AC-1, AC-2 the hire’s name as the title, the way back, the progress and the join date’s correction in Indonesian', async () => {
    detail();
    await screen.findByRole('heading', { level: 2, name: 'Progres activation' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Rina Wijaya$/);
    expect(screen.getByText('Anda dapat memperbarui status 90-Day Activation agen ini, serta catatan coaching Anda.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali ke New Hires' })).toHaveAttribute('href', '/new-hires');
    const field = screen.getByLabelText('Tanggal bergabung');
    expect(field).toHaveValue('2026-08-06');
    // The shared field's face and the screen's own dates, one vocabulary.
    expect(field.nextElementSibling).toHaveTextContent('6 Agu 2026');
    expect(screen.getByRole('button', { name: 'Tanggal bergabung dikoreksi oleh Anda · 7 Agu 2026' })).toBeInTheDocument();
    expect(screen.getByText('Hari').parentElement).toHaveTextContent('Hari90+/90, terlambat');
    expect(screen.getByRole('progressbar', { name: 'Progres activation' })).toHaveAttribute('aria-valuetext', '31% selesai');
    expect(within(document.querySelector('[data-code="INSURANCE_BASICS"]') as HTMLElement)
      .getByRole('button', { name: 'Dicentang oleh Rina Wijaya · 10 Agu 2026' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a tick toasts in Indonesian, and a date out of bounds is refused in Indonesian', async () => {
    detail({ 'PUT /new-hires/mem-rina/items/CRM_SETUP': { body: leaderView() } });
    await screen.findByRole('heading', { level: 2, name: 'Progres activation' });
    await userEvent.click(within(document.querySelector('[data-code="CRM_SETUP"]') as HTMLElement).getByRole('checkbox'));
    expect(await screen.findByText('Status activation diperbarui.')).toBeInTheDocument();
    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByLabelText('Tanggal bergabung'), { target: { value: '2024-01-01' } });
      vi.advanceTimersByTime(DATE_SETTLE_MS);
    } finally {
      vi.useRealTimers();
    }
    expect(await screen.findByText('Pilih tanggal dari 3 Okt 2025 sampai hari ini.')).toBeInTheDocument();
  });

  it('AC-1, AC-4 the coaching note: its heading, hint, example, button and toast in Indonesian, the note as typed', async () => {
    detail({
      'PUT /new-hires/mem-rina/note': { body: { note: { text: 'Pertahankan ritmenya.', by: SARI, at: '2026-10-03T03:00:00.000Z' } } },
    });
    const card = within(await screen.findByRole('region', { name: 'Catatan coaching' }));
    expect(card.getByText('Terlihat oleh agen ini di halaman 90-Day Activation miliknya.')).toBeInTheDocument();
    const box = card.getByRole('textbox', { name: 'Catatan coaching' });
    expect(box).toHaveValue('Great pace on prospecting — let’s book your first JFW this week.');
    expect(box).toHaveAttribute('placeholder', expect.stringMatching(/^Contoh: /));
    expect(card.getByRole('button', { name: 'Terakhir disimpan oleh Anda · 30 Sep 2026' })).toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.click(card.getByRole('button', { name: 'Simpan catatan' }));
    expect(card.getByRole('alert')).toHaveTextContent('Tulis catatan sebelum menyimpan.');
    await userEvent.type(box, 'Pertahankan ritmenya.');
    await userEvent.click(card.getByRole('button', { name: 'Simpan catatan' }));
    expect(await screen.findByText('Catatan coaching tersimpan — terlihat oleh Rina Wijaya.')).toBeInTheDocument();
  });

  it('AC-1 an activation that is over says how it ended, in Indonesian', async () => {
    detail({
      'GET /new-hires/mem-rina': {
        body: leaderView({ state: 'graduated', graduatedAt: '2026-10-01T03:00:00.000Z', graduatedBy: { membershipId: 'mem-rina', name: 'Rina Wijaya' } }),
      },
    });
    expect(await screen.findByText('Ditandai selesai oleh Rina Wijaya pada 1 Okt 2026.')).toBeInTheDocument();
  });

  it('AC-1 a hire outside the reader’s reach, in Indonesian', async () => {
    detail({ 'GET /new-hires/mem-rina': notFound });
    expect(await screen.findByRole('heading', { level: 2, name: 'Orang ini bukan new hire Anda.' })).toBeInTheDocument();
    expect(screen.getByText('Dia mungkin sudah pindah ke leader lain, atau alamatnya salah ketik.')).toBeInTheDocument();
    noEnglishLeft();
  });
});
