import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { atWidth, renderInIndonesian, stubFetch, type StubReply } from '@test/harness';
import {
  agendaRead, AGUS, coachingTask, DOWNLINE, entry, leadTask, monthRead, peoplePage, weekRead,
} from '@test/calendar-fixtures';
import { calendarMessages } from '@/i18n/messages/calendar';
import { limitWords, notesParts, personTag } from '@/lib/calendar';
import { blankForm, formWords, validateForm, violationsToErrors } from '@/lib/calendar-form';
import CalendarPage from './page';

/**
 * **The calendar in Indonesian** (P18.98-T4 AC-1 to AC-4, events, campaigns and the calendar): the toolbar, the legend,
 * the week's entries by name, the compare bar and its popover, the month with its lines and *+{n} lainnya…*, a phone's
 * agenda and *Filter*, the detail dialog — the organiser's and an invitee's — the entry dialog with its rules, *Block
 * time*, the invite field and *Hide my personal activities*. The approved glossary's words, the kept terms English (§A:
 * *Calendar*, *Week · Month*, *Agenda*, *event*, *1:1*, *coaching*, *KPM*, *downline*), the weekday and month names the
 * formatters' (P18.98-T3), what the organiser typed as typed, and none of the module's English left.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/calendar',
  useSearchParams: () => new URLSearchParams(),
}));

const WEEK_READ = '/calendar/entries?view=week';
const MONTH_READ = '/calendar/entries?view=month';
const AGENDA_READ = '/calendar/entries?view=agenda';
const SETTINGS = '/calendar/settings';
const RANGE = '28 Sep – 4 Okt 2026';
const ENGLISH = englishOnly(calendarMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

function show(routes: Record<string, StubReply | StubReply[]> = {}) {
  const stub = stubFetch({
    [WEEK_READ]: { body: weekRead() }, [AGENDA_READ]: { body: agendaRead() }, [SETTINGS]: { body: { hideDetails: false } }, ...routes,
  });
  renderInIndonesian(<CalendarPage />, { me: AGUS });
  return stub;
}
const grid = () => screen.findByRole('region', { name: `Kalender, ${RANGE}` });

afterEach(() => vi.unstubAllGlobals());

describe('P18.98-T4 the calendar in Indonesian', () => {
  it('P18.98-T4 AC-1, AC-2 the week: title kept, toolbar, legend and entries by name, a trip’s name', async () => {
    show();
    const region = await grid();
    expect(screen.getByRole('heading', { level: 1, name: 'Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hari ini' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Minggu sebelumnya' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Minggu berikutnya' })).toBeInTheDocument();
    const views = screen.getByRole('group', { name: 'Tampilan' });
    expect(within(views).getAllByRole('button').map((b) => b.textContent)).toEqual(['Agenda', '3 Hari', 'Week', 'Month']);
    expect(screen.getByRole('button', { name: '+ Event baru' })).toBeInTheDocument();
    for (const type of ['Rapat internal', 'Coaching 1:1', 'Pertemuan nasabah', 'Tugas', 'Perjalanan']) {
      expect(screen.getAllByText(type).length).toBeGreaterThan(0);
    }
    expect(within(region).getByRole('button', { name: 'Rapat internal: Weekly unit standup, 09.00–09.30' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Perjalanan: Client trip — Surabaya' })).toBeInTheDocument();
    expect(screen.getByText('Melihat:')).toBeInTheDocument();
    expect(screen.getByText('Kalender saya')).toBeInTheDocument();
    // UI-104: the *Jenis* chips in place of the legend, and no switch — it lives on Profil saya now.
    const chips = screen.getByRole('group', { name: 'Jenis' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['Rapat internal', 'Coaching 1:1', 'Pertemuan nasabah', 'Tugas', 'Perjalanan', 'Event']);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(document.querySelector('[data-task-row]')).toHaveTextContent('Tugas');
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the compare popover: its search, groups, tags and a person added', async () => {
    show({ '/calendar/downline': { body: DOWNLINE } });
    await grid();
    await userEvent.click(screen.getByRole('button', { name: '+ Bandingkan dengan downline' }));
    expect(await screen.findByRole('textbox', { name: 'Cari downline Anda…' })).toBeInTheDocument();
    for (const name of ['Unit langsung', 'AAB & timnya (grup)']) expect(await screen.findByRole('group', { name })).toBeInTheDocument();
    expect(screen.getByText('Agent · di bawah Sari Dewi')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the month: its heads the formatter’s, Month kept, a line named with its time first', async () => {
    show({ [MONTH_READ]: { body: monthRead() } });
    await grid();
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(await screen.findByText('Sep 2026')).toBeInTheDocument();
    expect(screen.getByText('Sen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bulan sebelumnya' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Rapat internal: 9-9.30 Weekly unit standup' }).length).toBeGreaterThan(0);
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 a phone: the agenda by day, Filter, Agenda kept, a day with nothing on it', async () => {
    atWidth(375);
    show();
    const region = await screen.findByRole('region', { name: `Kalender, ${RANGE}` });
    expect(within(screen.getByRole('combobox', { name: 'Tampilan' })).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Agenda', '3 Hari', 'Week', 'Month']);
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(region).getByRole('heading', { level: 2, name: 'Senin, 28 Sep 2026 · Hari ini' })).toBeInTheDocument();
    expect(within(region).getAllByText('Tidak ada event').length).toBeGreaterThan(0);
    noEnglishLeft();
  });

  it('UI-104 the Agenda’s Tugas in Indonesian: Tugas · n, Dari: NAME, Selesai and the trip’s Hari x/y', async () => {
    atWidth(375);
    show({ [AGENDA_READ]: { body: agendaRead({ tasks: [coachingTask(), leadTask()] }) } });
    const region = await screen.findByRole('region', { name: `Kalender, ${RANGE}` });
    const list = within(region).getByRole('region', { name: 'Tugas' });
    expect(within(list).getByText('Tugas · 2')).toBeInTheDocument();
    expect(within(list).getByText('Dari: WILSON TANOTO')).toBeInTheDocument();
    expect(within(list).getByRole('checkbox', { name: 'Selesai: Dari: Wilson Tanoto' })).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Buka Ibu Wiwik Setyaningsih' })).toBeInTheDocument();
    expect(within(region).getAllByText('Hari 1/2').length).toBeGreaterThan(0);
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 to AC-4 the organiser’s detail: labels, a meeting link, the notes as typed, Delete asks first', async () => {
    show();
    await userEvent.click(within(await grid()).getByRole('button', { name: /^Rapat internal: Weekly unit standup/ }));
    const box = await screen.findByRole('dialog', { name: 'Weekly unit standup' });
    for (const label of ['Kapan', 'Lokasi / catatan', 'Yang diundang']) expect(within(box).getByText(label)).toBeInTheDocument();
    expect(within(box).getByRole('link', { name: /^Gabung Zoom ?, terbuka di tab baru$/ })).toBeInTheDocument();
    expect(within(box).getByText('Tidak ada orang lain yang diundang')).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Ubah' })).toBeInTheDocument();
    await userEvent.click(within(box).getByRole('button', { name: 'Hapus' }));
    expect(await screen.findByText('Hapus "Weekly unit standup"?')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 an invitee’s detail: Terima and Tolak, the organiser’s chip, and the entry’s name says it waits', async () => {
    const invited = entry({
      entryId: 'e-invite', title: 'Coaching review', readerIs: 'invitee', myAnswer: 'pending',
      organiser: { membershipId: 'mem-hendra', name: 'Hendra Kusnadi' },
      invitees: [{ membershipId: 'mem-agus', name: 'Agus Santoso', placed: false, readerCoaches: false }],
    });
    show({ [WEEK_READ]: { body: weekRead({ entries: [invited] }) } });
    const name = 'Rapat internal: Coaching review, 09.00–09.30, menunggu jawaban Anda';
    await userEvent.click(within(await grid()).getByRole('button', { name }));
    const box = await screen.findByRole('dialog', { name: 'Coaching review' });
    expect(within(box).getByRole('button', { name: 'Terima' })).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Tolak' })).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Penyelenggara' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the entry dialog: its fields, the invite field, the rules under their fields', async () => {
    show({ '/calendar/people': { body: peoplePage() } });
    await grid();
    await userEvent.click(screen.getByRole('button', { name: '+ Event baru' }));
    const box = await screen.findByRole('dialog', { name: 'Event baru' });
    expect(within(box).getByText('Tambahkan rapat, tugas, atau sesi coaching ke kalender Anda.')).toBeInTheDocument();
    expect(within(box).getByRole('group', { name: 'Jenis' })).toBeInTheDocument();
    expect(within(box).getByLabelText('Judul')).toHaveAttribute('placeholder', 'mis. Standup unit mingguan');
    expect(within(box).getByLabelText('Undang (opsional) — siapa pun di KPM Anda')).toHaveAttribute('placeholder', 'Cari nama di KPM Anda…');
    for (const label of ['Tanggal', 'Mulai', 'Selesai']) expect(within(box).getByLabelText(label)).toBeInTheDocument();
    expect(within(box).getByLabelText('Catatan / lokasi')).toHaveAttribute('placeholder', 'Tautan Zoom, tempat, atau catatan agenda');
    await userEvent.click(within(box).getByLabelText('Undang (opsional) — siapa pun di KPM Anda'));
    expect(await within(box).findByRole('group', { name: 'Unit langsung Anda' })).toBeInTheDocument();
    expect(within(box).getByRole('group', { name: 'Pimpinan KPM' })).toBeInTheDocument();
    await userEvent.click(within(box).getByRole('option', { name: /Indah Permata/ }));
    expect(within(box).getByRole('button', { name: 'Hapus Indah Permata' })).toBeInTheDocument();
    await userEvent.click(within(box).getByRole('button', { name: 'Perjalanan' }));
    expect(within(box).getByLabelText('Tanggal berangkat')).toBeInTheDocument();
    expect(within(box).getByLabelText('Tanggal kembali')).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Simpan event' })).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 a saved new entry says the shared confirmation in Indonesian', async () => {
    show({ 'POST /calendar/entries': { body: entry({ entryId: 'e-new', title: 'Baru' }) } });
    await grid();
    await userEvent.click(screen.getByRole('button', { name: '+ Event baru' }));
    const box = await screen.findByRole('dialog', { name: 'Event baru' });
    await userEvent.click(within(box).getByRole('button', { name: 'Simpan event' }));
    expect(await screen.findByText('Event dibuat ✓')).toBeInTheDocument();
  });
});

describe('P18.98-T4 the calendar’s own functions in each language', () => {
  it('writes the rules, a tag and a meeting link’s words in the language passed', () => {
    expect(limitWords('id', 'id')).toEqual({
      tripTooLong: 'Perjalanan paling lama 31 hari.',
      titleTooLong: 'Judul paling banyak 120 karakter.',
      notesTooLong: 'Catatan paling banyak 1.000 karakter.',
      tooManyInvitees: 'Anda dapat mengundang paling banyak 50 orang.',
    });
    // English words, English figures: a thousand grouped with a comma.
    expect(limitWords('en', 'en').notesTooLong).toBe('Keep the notes to 1,000 characters.');
    const form = { ...blankForm({ date: '2026-09-28', start: '10:00', end: '09:00' }) };
    expect(validateForm(form, 0, formWords('id', 'id'))).toEqual({ end: 'Pilih jam selesai setelah jam mulai.' });
    expect(personTag({ rung: { code: 'AGENT', label: 'Agent' }, leaderName: 'Sari Dewi', direct: false }, 'id')).toBe('Agent · di bawah Sari Dewi');
    expect(notesParts('Zoom: https://zoom.us/j/1', 'id')).toEqual([{ text: 'Zoom: ' }, { href: 'https://zoom.us/j/1', label: 'Gabung Zoom' }]);
  });

  it('P18.98-T4 places the API’s Indonesian violations under their fields, a trip too long among them (P18.98-T5)', () => {
    const words = formWords('id', 'id');
    expect(violationsToErrors({
      violations: [
        'endsOn paling lambat 31 hari dari startsOn, termasuk kedua tanggalnya.',
        'title paling banyak 120 karakter',
        'inviteeIds paling banyak berisi 50 item',
      ],
    }, words)).toEqual({ endsOn: words.tripTooLong, title: words.titleTooLong, invitees: words.tooManyInvitees });
  });
});
