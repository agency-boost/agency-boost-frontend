import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import { feedbackSummary, INVITEES, NPS, rollCall } from '@test/events-fixtures';
import { eventsOfficeMessages } from '@/i18n/messages/events-office';
import { settingsMessages } from '@/i18n/messages/settings';
import { settingsEventsMessages } from '@/i18n/messages/settings-events';
import {
  attendedWords, awaitingLine, chosenCount, leftRow, markLabel, npsFormula, responsesLine, summaryTitle,
} from '@/lib/events-admin';
import EventsSettingsPage from './page';

/**
 * **Settings › Events in Indonesian** (P18.10-T4 AC-1 to AC-4, events, campaigns and the calendar): the list with its
 * phases and lines, the panel with the picker, the event types, and what *View feedback* opens — the roll call and the
 * *Feedback Summary*. The approved glossary's words, the title and tabs kept (§A), what the office and its members typed
 * as typed, and none of the module's English left. English is `page.spec.tsx`'s, unchanged.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/events',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write', 'event_settings:read', 'event_attendance:confirm', 'event_feedback:read'],
});

const type = (over: Record<string, unknown> = {}) => ({
  id: 't1', code: 'TRAINING', label: 'Training', description: null, emoji: '📚',
  color: '#2D9CDB', displayOrder: 1, status: 'active', events: 3, ...over,
});
const event = (over: Record<string, unknown> = {}) => ({
  id: 'e1', code: 'KICKOFF', typeCode: 'TRAINING', title: 'Kickoff 2026', blurb: 'The year ahead', description: '',
  startsAt: '2026-10-01T02:00:00.000Z', endsAt: '2026-10-01T06:00:00.000Z', startsOn: '2026-10-01', location: 'Jakarta',
  locationUrl: null, audience: { issuer: 'kpm', scope: 'all_agents', inviteeMembershipIds: [] },
  phase: 'upcoming', status: 'active', version: 1, ...over,
});

const ENGLISH = englishOnly(settingsEventsMessages, eventsOfficeMessages, settingsMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

function render(types: unknown[] = [type()], events: unknown[] = [event()]) {
  stubFetch({
    '/kpm/settings/events/types': { body: types },
    '/kpm/settings/events': { body: events },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
    'GET /kpm/settings/events/invitees': { body: { people: INVITEES } },
    'GET /kpm/settings/events/e3/attendance': { body: rollCall({ eventId: 'e3', title: 'Last month' }) },
    'GET /kpm/settings/events/e3/feedback': { body: feedbackSummary({ eventId: 'e3', title: 'Last month' }) },
  });
  renderInIndonesian(<EventsSettingsPage />, { me: OWNER });
}

afterEach(() => vi.unstubAllGlobals());

describe('P18.10-T4 Settings › Events in Indonesian', () => {
  it('P18.10-T4 AC-1 to AC-4, P19.25-T3 AC-1 the list: Events | Jenis event, Akan datang / Sudah lewat, the line and ⋯ in Indonesian', async () => {
    render([type()], [
      event({ audience: { issuer: 'kpm', scope: 'select_agents', inviteeMembershipIds: ['mem-budi', 'mem-rina'] } }),
      event({ id: 'e2', code: 'NOW', title: 'Happening', phase: 'running' }),
      event({ id: 'e3', code: 'LAST', title: 'Last month', phase: 'past' }),
    ]);
    await screen.findByText('Last month');
    expect(screen.getByRole('heading', { level: 1, name: 'Events' })).toBeInTheDocument();
    expect(screen.getByText('Apa yang diadakan KPM Anda, dan siapa yang diundang.')).toBeInTheDocument();
    for (const name of ['Events', 'Jenis event']) expect(screen.getByRole('link', { name })).toBeInTheDocument();
    // A running event is Akan datang until it ends (ADR-0281 §6).
    expect(screen.getAllByText('Akan datang')).toHaveLength(2);
    expect(screen.getByText('Sudah lewat')).toBeInTheDocument();
    expect(screen.queryByText('Sedang berlangsung')).not.toBeInTheDocument();
    // The day in the reader's figures, the place as typed, who it is for.
    expect(screen.getByText('1 Okt 2026 · Jakarta · 2 orang terpilih')).toBeInTheDocument();
    expect(screen.getAllByText('1 Okt 2026 · Jakarta · semua anggota')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Tindakan untuk Last month' }));
    for (const item of ['Ubah', 'Catat kehadiran', 'Arsipkan']) expect(screen.getByRole('menuitem', { name: item })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByLabelText('Tampilkan yang diarsipkan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Tambah event' })).toBeInTheDocument();
    expect(screen.getByText('Masukan dan kehadiran: Advanced analytics › Event')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.10-T4 AC-1 the panel: its fields, the audience choices and the picker, in Indonesian', async () => {
    render();
    await userEvent.click(await screen.findByRole('button', { name: '+ Tambah event' }));
    for (const label of ['Judul', 'Kode', 'Jenis', 'Satu kalimat tentang event ini', 'Mulai', 'Selesai', 'Tempat', 'Diadakan oleh', 'Siapa yang diundang']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Waktu KPM Anda.')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Diadakan oleh')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['KPM ini', 'Perusahaan Anda', 'Sebuah grup']);
    await userEvent.selectOptions(screen.getByLabelText('Siapa yang diundang'), 'select_agents');
    expect(await screen.findByLabelText('Cari orang')).toBeInTheDocument();
    expect(screen.getByText('0 dipilih')).toBeInTheDocument();
    expect(screen.getByText('Pilih minimal satu orang di bawah untuk menyimpan.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambahkan event' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.10-T4 AC-1 the event types: a type’s count, its form, and an empty list', async () => {
    render([type(), type({ id: 't2', code: 'NIGHT', label: 'Recognition night', events: 1 })]);
    await userEvent.click(await screen.findByRole('link', { name: 'Jenis event' }));
    expect(await screen.findByText('3 events')).toBeInTheDocument();
    expect(screen.getByText('1 event')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Arsipkan' })[0])
      .toHaveAttribute('title', 'Event yang sudah tercatat dengan jenis ini (3) tetap dapat dibaca, dan event baru tidak dapat ditambahkan.');
    await userEvent.click(screen.getByRole('button', { name: 'Tambah jenis event' }));
    expect(screen.getByLabelText('Emoji')).toBeInTheDocument();
    expect(screen.getByText('Posternya berupa emoji.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.10-T4 AC-1 no active type: the sentence with its kept tab name bold, and the empty list', async () => {
    render([type({ status: 'archived' })], []);
    const line = await screen.findByText(/Anda belum punya jenis event yang aktif/);
    expect(within(line).getByText('Jenis event', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/^Belum ada event\. Semua yang diadakan KPM Anda ada di sini/)).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.10-T4 AC-1 to AC-4 Catat kehadiran: the roll call and the Feedback Summary in Indonesian, answers as typed', async () => {
    render([type()], [event({ id: 'e3', code: 'LAST', title: 'Last month', phase: 'past' })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Tindakan untuk Last month' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Catat kehadiran' }));
    const box = await screen.findByRole('dialog', { name: 'Last month' });
    expect(within(box).getByRole('tab', { name: 'Daftar hadir' })).toBeInTheDocument();
    const table = await within(box).findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Nama', 'Peran', 'Tanggapan', 'Kehadiran']);
    expect(within(table).getAllByText('Sudah RSVP').length).toBeGreaterThan(0);
    expect(within(table).getByText('Menyatakan hadir')).toBeInTheDocument();
    expect(within(table).getByText('Anda tidak dapat mengonfirmasi kehadiran Anda sendiri.')).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'Hadir — Siti Rahma' })).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Simpan kehadiran' })).toBeInTheDocument();
    noEnglishLeft();

    await userEvent.click(within(box).getByRole('tab', { name: 'Ringkasan masukan' }));
    expect(await within(box).findByText('Last month — Ringkasan masukan')).toBeInTheDocument();
    expect(within(box).getByText('= % Promotor (9–10) − % Detraktor (0–6)')).toBeInTheDocument();
    expect(within(box).getByText(/· 1 tanggapan/)).toBeInTheDocument();
    expect(within(box).getByText(/· 1 menunggu konfirmasi kehadiran/)).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Kehadiran belum dikonfirmasi — tidak dihitung dalam NPS' })).toBeInTheDocument();
    expect(within(box).getAllByText('Alasan:').length).toBeGreaterThan(0);
    // The members' own words as typed.
    expect(within(box).getByText('Clear on the riders.')).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
    noEnglishLeft();
  });
});

describe('P18.10-T4 lib/events-admin.ts in each language', () => {
  it('writes its sentences in the language passed, English when none is', () => {
    expect(summaryTitle('Kickoff', 'id')).toBe('Kickoff — Ringkasan masukan');
    expect(npsFormula(NPS, 'id')).toBe('= % Promotor (9–10) − % Detraktor (0–6)');
    expect([responsesLine(1, 'id'), responsesLine(3, 'id'), responsesLine(3)]).toEqual(['· 1 tanggapan', '· 3 tanggapan', '· 3 responses']);
    expect(awaitingLine(2, 'id')).toBe('· 2 menunggu konfirmasi kehadiran');
    expect([attendedWords(true, 'id'), attendedWords(false, 'id'), attendedWords(null, 'id')]).toEqual(['Hadir', 'Tidak hadir', '—']);
    expect(chosenCount(2, 'id')).toBe('2 dipilih');
    expect([leftRow(1, 'id'), leftRow(3, 'id')]).toEqual(['Seseorang yang sudah keluar', '3 orang yang sudah keluar']);
    expect(markLabel('absent', 'Rina', 'id')).toBe('Tidak hadir — Rina');
  });
});
