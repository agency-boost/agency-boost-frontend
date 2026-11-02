import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { englishOnly, englishShown } from '@test/english-left';
import {
  browserChose, renderInIndonesian, renderInLayout, renderWithLanguage, resetLanguage, stubFetch, type StubReply,
} from '@test/harness';
import {
  activationView, completeView, notFound, RINA, RINA_ME, SHELL_STUBS, withWaitingCheckIn,
} from '@test/activation-fixtures';
import { activationMessages } from '@/i18n/messages/activation';
import ActivationPage from './page';

/**
 * **The hire's `/activation` in Indonesian** (P18.98-T4 AC-1 to AC-4, new hires and activation): the progress card,
 * the aspect table, a row with its note and date, the *Auto* badge and its *Buka … →*, who ticked what, a data-backed
 * item's source line, its waiting line and *Which case?*, the graduation's confirmation, the leader's note and the
 * page's states — the approved glossary's words (`i18n/messages/activation.ts`), each kept term English (§A), what the
 * office typed as typed, every date in Indonesian, and no English message of the module's own left (`englishShown`).
 * English is `page.spec.tsx`'s, unchanged.
 */
const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => '/activation',
}));

const ENGLISH = englishOnly(activationMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = RINA_ME) => {
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: activationView() }, ...routes });
  renderInIndonesian(<AgentLayout><ActivationPage /></AgentLayout>, { me });
  return stub;
};
const ready = () => screen.findByRole('heading', { level: 2, name: 'Progres activation Anda' });
const row = (code: string) => document.querySelector(`[data-code="${code}"]`) as HTMLElement;

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
});

describe('P18.98-T4 /activation in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass: the same page in English shows it', async () => {
    expect(ENGLISH.length).toBeGreaterThan(40);
    stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: activationView() } });
    renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
    expect(englishShown(document.body, ENGLISH)).toEqual(expect.arrayContaining(['Mark checklist complete', 'Show note and date']));
  });

  it('AC-1, AC-2 the progress card: its title kept, its words Indonesian, its figures in Indonesian', async () => {
    show();
    await ready();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Your 90-Day Activation$/);
    expect(screen.getByText('90 hari pertama Anda, checklist demi checklist.')).toBeInTheDocument();
    const term = screen.getByText('Tanggal bergabung');
    expect(term.tagName).toBe('DT');
    expect(term.nextElementSibling).toHaveTextContent('6 Agu 2026');
    expect(screen.getByRole('button', { name: 'Tandai checklist selesai' })).toHaveAccessibleDescription('Aktif setelah semua 16 item selesai');
    expect(screen.getByText('Hari').parentElement).toHaveTextContent('Hari59/90');
    expect(screen.getByText('Selesai').parentElement).toHaveTextContent('Selesai5/16');
    expect(screen.getByRole('progressbar', { name: 'Progres activation Anda' })).toHaveAttribute('aria-valuetext', '31% selesai');
    const table = screen.getByRole('table', { name: 'Progres activation Anda' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Aspek', 'Item', 'Status']);
    // The office's aspects as typed, each verdict Indonesian.
    expect(within(table).getAllByRole('row').slice(1).map((r) => r.textContent)).toEqual([
      'Introduction2/4Berjalan', 'Initial Setup2/4Berjalan', 'Training & Certification0/3Belum dimulai', 'First Sale1/2Berjalan',
      'Ongoing Habits0/3Belum dimulai',
    ]);
    expect(screen.getByText('Hanya terlihat oleh agen baru, selama 6 bulan pertama mereka. Agen senior tidak akan melihat bagian ini.'))
      .toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-4 a row: its note and date named in Indonesian, the item and the note as typed, who ticked it and when', async () => {
    show();
    await ready();
    const basics = within(row('INSURANCE_BASICS'));
    expect(basics.getByRole('checkbox', { name: 'Learn insurance basics' })).toBeChecked();
    await userEvent.click(basics.getByRole('button', { name: 'Tampilkan catatan dan tanggal' }));
    const note = basics.getByRole('textbox', { name: 'Catatan (opsional) — Learn insurance basics' });
    expect(note).toHaveAttribute('placeholder', 'Catatan (opsional)');
    expect(note).toHaveValue('Read the handbook');
    expect(basics.getByLabelText('Tanggal — Learn insurance basics')).toHaveValue('2026-08-09');
    expect(basics.getByRole('button', { name: 'Dicentang oleh Anda · 10 Agu 2026' })).toBeInTheDocument();
    expect(within(row('CAREER_MINDSET')).getByRole('button', { name: 'Dicentang oleh Sari Puspita · 12 Agu 2026' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-2, AC-4 a linked row: Otomatis, the server’s sentence as it comes, the feature’s title kept in its way in', async () => {
    show();
    await ready();
    const goals = within(row('GOAL_SETTING'));
    expect(goals.getByRole('checkbox')).toBeDisabled();
    expect(goals.getByRole('button', { name: 'Otomatis — selesai saat the hire has saved any goal since joining' }))
      .toHaveTextContent('Otomatis');
    expect(goals.getByRole('button', { name: 'Diselesaikan dari Goal Settings oleh Anda · 15 Agu 2026' })).toBeInTheDocument();
    expect(goals.getByRole('link', { name: 'Buka Goal Settings →' })).toHaveAttribute('href', '/goals');
  });

  it('AC-1, AC-3 a data-backed item: its source line, a tick waiting for data, and Which case? in Indonesian', async () => {
    show({
      'GET /activation/me': { body: activationView({}, withWaitingCheckIn()) },
      '/activation/me/closings': { body: { closings: [{ leadId: 'l-1', name: 'Ibu Ratna', date: '2026-09-20' }] } },
    });
    await ready();
    expect(within(row('FIRST_CASE_CLOSED')).getByRole('link', { name: 'Diselesaikan dari Sales data · 20 Sep 2026' }))
      .toHaveAttribute('href', '/leads');
    expect(within(row('WEEKLY_CHECK_IN')).getByText('Dicentang oleh Sari Puspita, menunggu data')).toBeInTheDocument();

    const milestone = within(row('INDEPENDENT_AGENT_MILESTONE'));
    await userEvent.click(milestone.getByRole('checkbox'));
    const form = within(milestone.getByRole('group', { name: 'Case yang mana?' }));
    expect(await form.findByRole('radio', { name: 'Ibu Ratna · 20 Sep 2026' })).toBeChecked();
    await userEvent.click(form.getByRole('radio', { name: 'Catat closing baru' }));
    expect(form.getByLabelText('Dijual kepada')).toBeInTheDocument();
    expect(form.getByLabelText('Dibayar dan diterbitkan pada')).toBeInTheDocument();
    await userEvent.click(form.getByRole('button', { name: 'Simpan' }));
    expect(form.getByRole('alert')).toHaveTextContent('Isi semua kolom terlebih dahulu.');
    expect(form.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a write refused says so in Indonesian, the server’s sentence as it comes', async () => {
    show({
      'PUT /activation/me/items/CRM_SETUP': {
        status: 409, body: { error: { code: 'ACTIVATION_CLOSED', message: 'This activation has ended.', requestId: 'r-1' } },
      },
    });
    await ready();
    await userEvent.click(within(row('CRM_SETUP')).getByRole('checkbox', { name: 'Set up company CRM system' }));
    expect(await within(row('CRM_SETUP')).findByRole('alert')).toHaveTextContent('Tidak tersimpan. This activation has ended.');
  });

  it('AC-1, AC-2 the graduation’s confirmation in Indonesian, the menu’s name kept', async () => {
    show({ 'GET /activation/me': { body: completeView() } });
    await userEvent.click(await screen.findByRole('button', { name: 'Tandai checklist selesai' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Tandai checklist Anda selesai? Menu 90-Day Activation akan dihapus.');
    expect(within(dialog).getByRole('button', { name: 'Konfirmasi' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    expect(screen.getByText('100% selesai')).toBeInTheDocument();
  });

  it('AC-4 the leader’s note as typed, under its heading and its line in Indonesian', async () => {
    show();
    await ready();
    const card = screen.getByRole('region', { name: 'Catatan coaching' });
    expect(card).toHaveTextContent('Great pace on prospecting — let’s book your first JFW this week.');
    expect(card).toHaveTextContent('Dari Sari Puspita · 30 Sep 2026');
  });

  it('AC-1 the page’s states in Indonesian: its wait, no activation, one marked complete, one ended', async () => {
    show();
    expect(screen.getByRole('status')).toHaveTextContent('Memuat activation Anda…');
    await ready();
  });

  it.each([
    ['none', { 'GET /activation/me': notFound }, 'Anda tidak punya 90-day activation.', 'Ini untuk orang di bulan-bulan pertamanya sebagai agen.'],
    [
      'graduated',
      { 'GET /activation/me': { body: completeView({ state: 'graduated', graduatedAt: '2026-09-29T03:00:00.000Z', graduatedBy: RINA }) } },
      'Checklist 90 hari Anda sudah selesai.', 'Anda menandainya selesai pada 29 Sep 2026.',
    ],
    [
      'expired',
      { 'GET /activation/me': { body: activationView({ state: 'expired', endsOn: '2026-10-06' }) } },
      '90-day activation Anda sudah berakhir.', 'Berlangsung selama enam bulan, hingga 6 Okt 2026.',
    ],
  ])('AC-1 not offered (%s) says so in Indonesian', async (_, routes, title, line) => {
    show(routes as Record<string, StubReply>);
    expect(await screen.findByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    expect(screen.getByText(line)).toBeInTheDocument();
    if (_ !== 'none') {
      expect(screen.getByText('Checklist Anda tetap ada di halaman coaching Anda sendiri.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Coaching Anda sendiri' })).toHaveAttribute('href', '/coaching/me/activation');
    }
    noEnglishLeft();
  });
});

/**
 * **The figures follow the reader's choice** (P18.98-T3's rule, now on this screen): a reader with no choice, the switch
 * not live, reads English words and Indonesian dates — the date beside the shared field's face as its face is — and a
 * reader who chose Indonesian reads both in it.
 */
describe('P18.98-T4 /activation under the app’s provider', () => {
  it('a reader with no choice reads English words and Indonesian dates', async () => {
    stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: activationView() } });
    renderWithLanguage(<AgentLayout><ActivationPage /></AgentLayout>, { me: RINA_ME }, { live: false });
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
    expect(screen.getByText('Join date').nextElementSibling).toHaveTextContent('6 Agu 2026');
    expect(within(row('INSURANCE_BASICS')).getByRole('button', { name: 'Ticked by you · 10 Agu 2026' })).toBeInTheDocument();
  });

  it('a reader who chose Indonesian reads its words and its dates', async () => {
    browserChose('id');
    stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: activationView() } });
    renderWithLanguage(<AgentLayout><ActivationPage /></AgentLayout>, { me: RINA_ME }, { live: false });
    await ready();
    expect(screen.getByText('Tanggal bergabung').nextElementSibling).toHaveTextContent('6 Agu 2026');
    expect(within(row('INSURANCE_BASICS')).getByRole('button', { name: 'Dicentang oleh Anda · 10 Agu 2026' })).toBeInTheDocument();
  });
});
