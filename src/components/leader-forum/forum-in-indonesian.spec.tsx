import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atWidth, InLanguage, renderInIndonesian, renderWithSession, routeParams, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import {
  makeMeetingView, makeScorecard, readOnlyMeeting, renderTab, writeFailed,
} from '@test/leader-meetings-fixtures';
import LeaderMeetingsPage from '@/app/leader-meetings/page';
import LeaderMeetingPage from '@/app/leader-meetings/[meetingId]/page';
import SharedLeaderMeetingPage from '@/app/leader-meetings/shared/[token]/page';
import {
  FIELD_ME, listView, LINK_CAN, meetingView, notFound, OWNER_ME, SHELL_STUBS,
} from '@/app/leader-meetings/forum-fixtures';
import { forumMessages } from '@/i18n/messages/forum';
import { forumMinutesMessages } from '@/i18n/messages/forum-minutes';
import { forumStatsMessages } from '@/i18n/messages/forum-stats';
import {
  accessNoteText, changeText, listed, noneWords, partialNotes,
} from '@/lib/leader-meeting-tabs';
import {
  changeDateLabel, coreLeadersTagged, defaultMeetingTitle, deleteQuestion, openItemsNoun, shareHint, stateLabel,
} from '@/lib/leader-meetings';
import { ActionItems } from './action-items';
import { Agenda } from './agenda';
import { PrintLayout } from './print-layout';
import { Scorecard } from './scorecard';

/**
 * **The Strategic Leader Forum in Indonesian** (P18.98-T4 AC-1 to AC-4, people and forum): every screen of it read in
 * ID mode — the list, a meeting's head and its three tabs, the dialogs, the shared view and the not-found states, a
 * phone's cards and the print. Its words are the approved glossary's, each kept term English (§A), what the office typed
 * as typed, and no English message of the forum's own left on the screen (`englishShown`). English is every other
 * spec's, unchanged.
 */
const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), pathname: '/leader-meetings' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn() }),
  usePathname: () => nav.pathname,
}));

const FORUM_ENGLISH = englishOnly(forumMessages, forumStatsMessages, forumMinutesMessages);
const noEnglishLeft = () => expect(englishShown(document.body, FORUM_ENGLISH)).toEqual([]);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('P18.98-T4 the forum’s list in Indonesian', () => {
  beforeEach(() => { nav.pathname = '/leader-meetings'; });

  it('reads the English it is looking for, so a silent zero cannot pass: the same list in English shows it', async () => {
    expect(FORUM_ENGLISH.length).toBeGreaterThan(80);
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings': { body: listView() } });
    renderWithSession(<LeaderMeetingsPage />, { me: OWNER_ME });
    await screen.findByText('Strategic Check-in — #14');
    expect(englishShown(document.body, FORUM_ENGLISH)).toEqual(expect.arrayContaining([
      '+ New meeting', 'Upcoming', 'All clear', 'Biweekly check-ins with your core leaders — agenda, notes, and action items',
    ]));
  });

  it('P18.98-T4 AC-1, AC-2 reads the list in the glossary’s words, the name, the meetings’ titles and the tags kept', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings': { body: listView() } });
    renderInIndonesian(<LeaderMeetingsPage />, { me: OWNER_ME });
    await screen.findByText('Strategic Check-in — #14');

    // §A: the forum's name stays English; the line under it is ours.
    expect(screen.getByRole('heading', { level: 1, name: 'Strategic Leader Forum' })).toBeInTheDocument();
    expect(screen.getByText('Rapat dua mingguan bersama para Core Leader Anda — agenda, catatan, dan tindakan')).toBeInTheDocument();
    // §A.3: a filter that names a status follows the status words.
    expect(['Semua', 'Akan datang', 'Sudah lewat'].map((name) => screen.getByRole('button', { name }))).toHaveLength(3);
    expect(screen.getByRole('button', { name: '+ Rapat baru' })).toBeInTheDocument();
    // A card's line: the date in Indonesian, the state, the count — *Core Leader* kept, its English plural (§B.0 rule 8).
    const link = screen.getByRole('link', { name: 'Strategic Check-in — #14' });
    expect(link).toHaveAccessibleDescription('13 Okt 2026 · Akan datang · 3 Core Leaders di-tag');
    expect(link).toHaveTextContent('4 item belum selesai');
    expect(link).toHaveTextContent('Buka');
    expect(screen.getByText('26 Sep 2026 · Selesai · 2 Core Leaders di-tag')).toBeInTheDocument();
    expect(screen.getByText('Semua selesai')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 an empty list, and a filter that matches nothing', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings': { body: listView({ meetings: [] }) } });
    const { unmount } = renderInIndonesian(<LeaderMeetingsPage />, { me: OWNER_ME });
    expect(await screen.findByText('Belum ada rapat.')).toBeInTheDocument();
    unmount();

    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings': { body: listView() } });
    renderInIndonesian(<LeaderMeetingsPage />, { me: FIELD_ME });
    await screen.findByText('Strategic Check-in — #14');
    await userEvent.click(screen.getByRole('button', { name: 'Akan datang' }));
    expect(screen.queryByText('Strategic Check-in — #13')).toBeNull();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 New meeting asks in Indonesian, a new meeting named as the programme names it', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings': { body: listView() } });
    renderInIndonesian(<LeaderMeetingsPage />, { me: OWNER_ME });
    await userEvent.click(await screen.findByRole('button', { name: '+ Rapat baru' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rapat baru' });
    expect(within(dialog).getByLabelText('Judul')).toHaveValue('Strategic Check-in — #15');
    expect(within(dialog).getByLabelText('Tanggal')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buat rapat' }));
    expect(await within(dialog).findByText('Pilih tanggal.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    noEnglishLeft();
  });
});

describe('P18.98-T4 a forum meeting in Indonesian', () => {
  beforeEach(() => { nav.pathname = '/leader-meetings/m-14'; });
  const page = <LeaderMeetingPage params={routeParams({ meetingId: 'm-14' })} />;
  const open = (meeting = meetingView(), routes: Record<string, unknown> = {}) => {
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/m-14': { body: meeting }, ...(routes as Record<string, never>) });
    return renderInIndonesian(page, { me: OWNER_ME });
  };

  it('P18.98-T4 AC-1, AC-2 the head: the date’s button, the state, the cadence, the three buttons and who may edit', async () => {
    open();
    const head = within(await screen.findByRole('region', { name: /Strategic Check-in/ }));
    expect(screen.getByRole('link', { name: '← Kembali ke semua rapat' })).toHaveAttribute('href', '/leader-meetings');
    expect(head.getByRole('button', { name: 'Ganti tanggal Strategic Check-in — #14, 13 Okt 2026' })).toBeInTheDocument();
    expect(head.getByText(/· Akan datang$/)).toBeInTheDocument();
    expect(head.getByText('Disarankan: setiap 2 minggu · 60–90 menit')).toBeInTheDocument();
    for (const name of ['Bagikan', 'Simpan sebagai PDF', 'Simpan']) expect(head.getByRole('button', { name })).toBeInTheDocument();
    expect(head.getByText('Dapat mengubah notulen ini')).toBeInTheDocument();
    expect(head.getByText(/Wilson Tanoto \(Anda\)/)).toBeInTheDocument();
    expect(head.getByRole('link', { name: 'Kelola tag →' })).toBeInTheDocument();
    // §A.3: the tabs are names.
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview & Stats', 'Agenda', 'Action Items']);
    noEnglishLeft();
  });

  it('P18.98-T4 AC-2, AC-4 Agenda and Action Items in Indonesian; every item, PIC and remark as the office typed it', async () => {
    open();
    await userEvent.click(await screen.findByRole('tab', { name: 'Agenda' }));
    const agenda = within(screen.getByRole('tabpanel', { name: 'Agenda' }));
    expect(agenda.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Persiapan', 'Saat rapat', 'Setelah rapat']);
    expect(agenda.getByRole('textbox', { name: 'Persiapan, item 1' })).toHaveValue('Compile follow-ups & commitments from prior session');
    expect(agenda.getByRole('textbox', { name: 'PIC untuk Persiapan, item 1' })).toHaveValue('Wilson');
    expect(agenda.getByRole('textbox', { name: 'PIC untuk Setelah rapat, item 1' })).toHaveAttribute('placeholder', 'Tambah PIC');
    // The office's default agenda is content: *RBDO/BDO* as written (§C9).
    expect(agenda.getByRole('textbox', { name: 'Setelah rapat, item 1' })).toHaveValue('Note feedback for RBDO/BDO');
    expect(agenda.getAllByRole('button', { name: '+ Tambah item' })).toHaveLength(3);

    await userEvent.click(screen.getByRole('tab', { name: 'Action Items' }));
    const tracker = within(screen.getByRole('tabpanel', { name: 'Action Items' }));
    expect(tracker.getByText('Pelacak tindakan')).toBeInTheDocument();
    expect(tracker.getByText('Seret ⠿ untuk mengubah urutan')).toBeInTheDocument();
    expect(tracker.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(
      ['Inisiatif utama', 'Ukuran keberhasilan', 'Tindakan', 'PIC', 'Status', 'Keterangan / Target'],
    );
    expect(tracker.getByRole('button', { name: 'Direncanakan. Ganti ke Dijalankan' })).toHaveTextContent('Direncanakan');
    expect(tracker.getByRole('button', { name: 'Belum direncanakan. Ganti ke Direncanakan' })).toBeInTheDocument();
    expect(tracker.getByRole('button', { name: 'Pindahkan baris 1, Activity tracking tool adoption. Gunakan tombol panah.' })).toBeInTheDocument();
    expect(tracker.getByRole('button', { name: 'Hapus baris 2' })).toBeInTheDocument();
    expect(tracker.getByRole('textbox', { name: 'PIC, baris 2' })).toHaveValue('Ferry / Joy');
    expect(tracker.getByRole('textbox', { name: 'Keterangan / Target, baris 2' })).toHaveValue('TBD');
    expect(tracker.getByRole('button', { name: '+ Tambah tindakan' })).toBeInTheDocument();
    expect(tracker.getByText('🔒 Hanya Wilson Tanoto, Maya Halim, dan Core Leader yang di-tag dapat mengubah pelacak ini.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 a write that fails says so in Indonesian, in the toast and under Save', async () => {
    open(meetingView(), { 'PATCH /leader-meetings/m-14/agenda-items/a-1': writeFailed });
    await userEvent.click(await screen.findByRole('tab', { name: 'Agenda' }));
    const field = screen.getByRole('textbox', { name: 'Persiapan, item 1' });
    await userEvent.type(field, ' lagi');
    await userEvent.tab();
    const line = 'Gagal menyimpan perubahan itu. Perubahannya masih di sini — coba lagi.';
    // The toast, then the line under *Save*, which stays until a later write lands.
    await waitFor(() => expect(screen.getAllByText(line)).toHaveLength(2));
  });

  it('P18.98-T4 AC-1 Meeting details and the question before a delete', async () => {
    open(meetingView({ writtenIn: false, can: { ...meetingView().can, delete: true } }));
    await userEvent.click(await screen.findByRole('button', { name: /^Ganti tanggal/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Detail rapat' }));
    expect(dialog.getByRole('button', { name: 'Simpan perubahan' })).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', { name: 'Hapus rapat' }));
    expect(dialog.getByText('Hapus “Strategic Check-in — #14”? Belum ada yang ditulis di dalamnya, dan rapat ini tidak dapat dikembalikan.')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Jangan hapus' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Hapus' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 Share these minutes, its hint the branch as typed and the day in Indonesian', async () => {
    open(meetingView(), {
      'POST /leader-meetings/m-14/share-links': { status: 201, body: { token: 'tok_abc', expiresAt: '2026-10-24T03:00:00.000Z' } },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Bagikan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bagikan notulen ini' });
    expect(dialog).toHaveAccessibleDescription(
      'Siapa pun yang masuk ke AgencyBoost di BSD City Branch dapat membuka notulen rapat ini dengan tautan ini, hanya untuk dibaca, sampai 24 Okt 2026.',
    );
    for (const name of ['Salin tautan', 'Hentikan berbagi', 'Tutup']) expect(within(dialog).getByRole('button', { name })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the not-found states, by the address and by a link', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/m-14': notFound });
    const { unmount } = renderInIndonesian(page, { me: OWNER_ME });
    expect(await screen.findByRole('heading', { name: 'Rapat ini tidak ditemukan.' })).toBeInTheDocument();
    expect(screen.getByText('Rapat ini mungkin sudah dihapus, atau bukan rapat yang dapat Anda buka.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Kembali ke semua rapat' })).toBeInTheDocument();
    unmount();

    nav.pathname = '/leader-meetings/shared/tok_gone';
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/shared/tok_gone': notFound });
    renderInIndonesian(<SharedLeaderMeetingPage params={routeParams({ token: 'tok_gone' })} />, { me: FIELD_ME });
    expect(await screen.findByRole('heading', { name: 'Tautan ini tidak membuka apa pun.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buka beranda Anda' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the shared view, read-only: nothing to write, and Save as PDF', async () => {
    nav.pathname = '/leader-meetings/shared/tok_abc';
    stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/shared/tok_abc': { body: meetingView({ via: 'link', can: LINK_CAN }) } });
    renderInIndonesian(<SharedLeaderMeetingPage params={routeParams({ token: 'tok_abc' })} />, { me: FIELD_ME });
    await screen.findByRole('heading', { level: 2, name: 'Strategic Check-in — #14' });
    expect(screen.getByRole('button', { name: 'Simpan sebagai PDF' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simpan' })).toBeNull();
    noEnglishLeft();
  });
});

describe('P18.98-T4 Overview & Stats in Indonesian: the table, a phone’s cards and the notes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.98-T4 AC-2 keeps every KPI, column and row name; says ours in Indonesian, for the eye and for a screen reader', () => {
    renderTab(Scorecard, makeMeetingView(), {}, 'id');
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').slice(0, 3).map((h) => h.textContent)).toEqual(
      ['Metrics', '⟵ Full Year & YTD View ⟶', '⟵ Monthly View ⟶'],
    );
    expect(within(table).getByRole('rowheader', { name: 'APE (Rp M)' })).toBeInTheDocument();
    expect(within(table).getByText('Activation')).toBeInTheDocument();
    expect(within(table).getByText('Productivity')).toBeInTheDocument();
    expect(within(table).getAllByText('menunggu data').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Tidak dilacak').length).toBeGreaterThan(0);
    expect(screen.getByRole('textbox', { name: 'Monthly Target per unit, APE (Rp M)' })).toHaveAttribute('placeholder', 'TBD');
    // The footnotes and a (*) note in Indonesian, the kept names in them English.
    expect(screen.getByText(/^Annual Active Agents — anggota yang memiliki APE atau polis di file produksi bulanan/)).toBeInTheDocument();
    expect(screen.getByText(/^AA — Active Agent, anggota yang bulannya menunjukkan APE/)).toBeInTheDocument();
    expect(screen.getByText('(*) YTD 2026 mencakup Jan–Sep 2026 tanpa Agu 2026, yang belum diunggah')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-2 a rate the field cannot read is refused in Indonesian, its example in the reader’s marks', async () => {
    renderTab(Scorecard, makeMeetingView(), {}, 'id');
    const field = screen.getByRole('textbox', { name: 'Monthly Target per unit, Manpower' });
    await userEvent.type(field, 'kira-kira dua');
    await userEvent.tab();
    expect(await screen.findByText('Ketik angka mulai dari 0, misalnya 1 atau 0,5.')).toBeInTheDocument();
  });

  it('P18.98-T4 AC-2 on a phone: one card a metric, its change in Indonesian — points as *poin*', async () => {
    atWidth(375);
    renderTab(Scorecard, makeMeetingView({
      scorecard: makeScorecard({
        rows: makeScorecard().rows.map((row) => (row.key === 'new_agent_3m'
          ? { ...row, ytdChange: { kind: 'figure', value: 20, unit: 'points' } }
          : row)),
      }),
    }), {}, 'id');
    await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
    expect(screen.getAllByText('Perubahan').length).toBe(9);
    expect(screen.getByText('+20 poin')).toBeInTheDocument();
    expect(screen.getByText('+6%')).toBeInTheDocument();
    expect(screen.getAllByText('Monthly Target').length).toBeGreaterThan(0);
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the print, in the screen’s language: the three parts, the minutes’ words and the statuses Indonesian', () => {
    stubFetch({});
    render(<InLanguage language="id"><PrintLayout meeting={makeMeetingView()} /></InLanguage>);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Overview & Stats', 'Agenda', 'Action Items']);
    expect(screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual(
      ['BSD City Branch: Sep 2026', 'Persiapan', 'Saat rapat', 'Setelah rapat'],
    );
    expect(screen.getAllByText('PIC: Wilson').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PIC: —').length).toBeGreaterThan(0);
    const tracker = screen.getAllByRole('table')[1];
    expect(within(tracker).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(
      ['Inisiatif utama', 'Ukuran keberhasilan', 'Tindakan', 'PIC', 'Status', 'Keterangan / Target'],
    );
    expect(within(tracker).getAllByText(/^(Belum direncanakan|Direncanakan|Dijalankan)$/).length).toBe(4);
    noEnglishLeft();
  });

  it('P18.98-T4 AC-4 the read-only tracker and agenda show the office’s words as typed, in no other language', () => {
    renderTab(ActionItems, readOnlyMeeting(), {}, 'id');
    expect(screen.getByText('Ferry / Joy')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 a ticked During item is said done in Indonesian', () => {
    renderTab(Agenda, readOnlyMeeting(), {}, 'id');
    expect(screen.getAllByText('Selesai.').length).toBeGreaterThan(0);
  });
});

describe('P18.98-T4 the forum’s sentences in each language (`lib/leader-meetings.ts`, `lib/leader-meeting-tabs.ts`)', () => {
  it('P18.98-T4 AC-3 each sentence whole in Indonesian: its own order, no plural, a kept term English', () => {
    expect(coreLeadersTagged(1, 'id')).toBe('1 Core Leader di-tag');
    expect(coreLeadersTagged(3, 'id')).toBe('3 Core Leaders di-tag');
    expect(openItemsNoun(1, 'id')).toBe('item belum selesai');
    expect(openItemsNoun(4, 'id')).toBe('item belum selesai');
    expect(stateLabel('completed', 'id')).toBe('Selesai');
    expect(changeDateLabel('Strategic Check-in — #14', 'id')).toBe('Ganti tanggal Strategic Check-in — #14');
    expect(deleteQuestion('X', 'id')).toBe('Hapus “X”? Belum ada yang ditulis di dalamnya, dan rapat ini tidak dapat dikembalikan.');
    expect(shareHint('BSD City Branch', '24 Okt 2026', 'id')).toBe(
      'Siapa pun yang masuk ke AgencyBoost di BSD City Branch dapat membuka notulen rapat ini dengan tautan ini, hanya untuk dibaca, sampai 24 Okt 2026.',
    );
    expect(defaultMeetingTitle([{ number: 14 }], 'id')).toBe('Strategic Check-in — #15');
  });

  it('P18.98-T4 AC-3 names joined as each language joins them, and the access note whole', () => {
    expect(listed(['a', 'b'], 'id')).toBe('a dan b');
    expect(listed(['a', 'b', 'c'], 'id')).toBe('a, b, dan c');
    expect(listed(['a', 'b', 'c'])).toBe('a, b and c');
    expect(accessNoteText({ ownerName: 'Wilson Tanoto', adminNames: [] }, 'id'))
      .toBe('🔒 Hanya Wilson Tanoto dan Core Leader yang di-tag dapat mengubah pelacak ini.');
    expect(accessNoteText({ ownerName: null, adminNames: [] }, 'id'))
      .toBe('🔒 Hanya Core Leader yang di-tag dapat mengubah pelacak ini.');
  });

  it('P18.98-T4 AC-3 the (*) notes: the months in the figures’ language, the words in the reader’s — each pair of the two', () => {
    const periods = makeScorecard().periods;
    const earlier = { periods, partialPeriods: [{ column: 'fy' as const, leavesOut: ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07'] }] };
    expect(partialNotes(earlier, 'id', 'id')).toEqual(['(*) Full Year 2025 hanya mencakup Agu–Des 2025; bulan-bulan sebelumnya belum diunggah']);
    expect(partialNotes(earlier, 'en', 'id')).toEqual(['(*) Full Year 2025 hanya mencakup Aug–Dec 2025; bulan-bulan sebelumnya belum diunggah']);
    expect(partialNotes(earlier, 'id', 'en')).toEqual(['(*) Full Year 2025 covers Agu–Des 2025 only; earlier months not uploaded']);
    expect(partialNotes({ periods, partialPeriods: [{ column: 'ytd', leavesOut: ['2026-08', '2026-09'] }] }, 'id', 'id'))
      .toEqual(['(*) YTD 2026 hanya mencakup Jan–Jul 2026; bulan-bulan berikutnya belum diunggah']);
    expect(partialNotes({ periods, partialPeriods: [{ column: 'ytdLastYear', leavesOut: ['2025-03', '2025-04'] }] }, 'id', 'id'))
      .toEqual(['(*) YTD 2025 mencakup Jan–Sep 2025 tanpa Mar 2025 dan Apr 2025, yang belum diunggah']);
  });

  it('P18.98-T4 AC-3 a change in points, and *—*’s reasons, in Indonesian', () => {
    expect(changeText({ kind: 'figure', value: 15, unit: 'points' }, 'id', 'id')).toBe('+15 poin');
    expect(changeText({ kind: 'figure', value: -1, unit: 'points' }, 'id', 'id')).toBe('-1 poin');
    expect(changeText({ kind: 'figure', value: -1, unit: 'points' }, 'en', 'en')).toBe('-1 point');
    expect(noneWords({ key: 'average_case_size' }, { kind: 'none' }, 'id')).toBe('Tidak ada polis dalam periode ini.');
    expect(noneWords({ key: 'cases_per_producing_agent' }, { kind: 'none' }, 'id')).toBe('Tidak ada Annual Active Agents dalam periode ini.');
    expect(noneWords({ key: 'manpower' }, { kind: 'unrecorded' }, 'id')).toBe('Tidak tercatat untuk rapat ini.');
  });
});
