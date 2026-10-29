import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import GroupTreePage from '@/app/(agent)/group-tree/page';
import { groupTreeMessages } from '@/i18n/messages/group-tree';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { PHONE_QUERY } from '@/lib/use-phone';
import { englishOnly, englishShown } from '@test/english-left';
import {
  InLanguage, makeMe, renderInLayout, renderWithSession, routeParams, stubFetch, type StubReply,
} from '@test/harness';
import {
  AGUS_ME, dashboard, EMPTY, NEW_HIRE_VIEW, RATIOS, SARI_UNIT,
} from '@test/unit-dashboard-fixtures';
import type { UnitDashboardView } from '@/lib/unit-dashboard';
import UnitBelowPage from './dashboard/[membershipId]/page';
import UnitDashboardPage from './dashboard/page';

/**
 * **The Unit Dashboard and the Group tree in Indonesian** (P18.98-T4 AC-1 to AC-4, coaching and unit): the period
 * switch, the four tiles, *Your team's roster* as a table and as a phone's cards with its groups, totals, marks and
 * pills, a row's detail, *Update production*, the empty unit, a unit below the reader and one they cannot open; the
 * Group tree's line, wait and empty state. Their words the approved glossary's, each kept term English (§A), names and
 * the server's sentences as sent, the figures in the reader's language — Indonesian here — and no English message of the
 * module's own left on the screen (`englishShown`). English is every other spec's, unchanged.
 */
const nav = vi.hoisted(() => ({ search: '', pathname: '/unit/dashboard' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

beforeEach(() => {
  nav.search = '';
  nav.pathname = '/unit/dashboard';
});
afterEach(() => vi.unstubAllGlobals());

const UNIT_ENGLISH = englishOnly(unitDashboardMessages, groupTreeMessages);
const noEnglishLeft = (root: Element = document.body) => expect(englishShown(root, UNIT_ENGLISH)).toEqual([]);

const SHELL = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
  '/notifications': { body: { items: [], unread: 0 } },
};

const show = (view: UnitDashboardView | StubReply = dashboard(), routes: Record<string, StubReply | StubReply[]> = {}) => {
  const reply = 'status' in view || 'body' in view ? view : { body: view };
  const stub = stubFetch({ ...SHELL, 'GET /unit/dashboard': reply as StubReply, '/activity/ratios': { body: RATIOS }, ...routes });
  renderWithSession(<InLanguage language="id"><AgentLayout><UnitDashboardPage /></AgentLayout></InLanguage>, { me: AGUS_ME });
  return stub;
};
const roster = () => screen.findByRole('table', { name: 'Roster tim Anda' });
const rowOf = (name: string) => screen.getByRole('link', { name }).closest('tr')!;
const tileOf = (label: string) => screen.getByText(label).parentElement!;

describe('P18.98-T4 the Unit Dashboard in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass: the same dashboard in English shows it', async () => {
    expect(UNIT_ENGLISH.length).toBeGreaterThan(45);
    stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: dashboard() } });
    renderInLayout(AgentLayout, <UnitDashboardPage />, { me: AGUS_ME });
    await screen.findByRole('table', { name: 'Your team’s roster' });
    expect(englishShown(document.body, UNIT_ENGLISH)).toEqual(
      expect.arrayContaining(['Your team’s roster', 'Period', 'Last 1:1', 'Update production']),
    );
  });

  it('P18.98-T4 AC-1, AC-2 the title, the period switch and the four tiles: names kept, their lines Indonesian', async () => {
    show();
    await roster();
    expect(screen.getByRole('heading', { level: 1, name: 'Unit Dashboard' })).toBeInTheDocument();
    const periods = screen.getByRole('group', { name: 'Periode' });
    expect(within(periods).getAllByRole('button').map((b) => b.textContent)).toEqual(['7 hari terakhir', 'Bulan ini', 'Tahun ini']);
    expect(within(periods).getByRole('button', { name: 'Bulan ini' })).toHaveAttribute('aria-pressed', 'true');
    expect(tileOf('Your team')).toHaveTextContent('16 agent');
    expect(tileOf('Your team')).toHaveTextContent('4 langsung · 12 di bawah AAB');
    // A reader who chose Indonesian reads its figures in it (P18.98-T3).
    expect(tileOf('Direct Group production')).toHaveTextContent('Rp 1 M / 1,3 M');
    expect(tileOf('On pace to be active (Group)')).toHaveTextContent('12 / 16 agent');
    const recruits = tileOf('Potential Recruits (Group)');
    expect(recruits).toHaveTextContent('Unit Anda1 kandidat');
    expect(recruits).toHaveTextContent('AAB Anda1 kandidat');
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 to AC-4 the roster: its headings, groups, totals, rows, pills and marks', async () => {
    show();
    const table = await roster();
    // Each heading's own words first; an ⓘ's name and tip follow some of them.
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Nama', 'Progres goal', 'Mengejar MDRT', 'Leads', 'Aktivitas', '1:1 terakhir', 'Status', 'Detail',
    ].map((words) => expect.stringMatching(new RegExp(`^${words}`))));
    expect(within(table).getByRole('rowheader', { name: /^Unit Anda · 4/ })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'AAB units' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Unit Sari Wulandari — Total' })).toBeInTheDocument();

    const agus = rowOf('Anda (Agus)');
    expect(agus).toHaveTextContent('135% · lebih Rp 28 jtRp 108 jt dari 80 jt');
    expect(within(agus).getByRole('button', { name: 'Sesuai target' })).toHaveAccessibleDescription(
      'Berada di jalur untuk memenuhi syarat sebagai Monthly Active Agent, pada atau di atas 90% dari laju goal yang diharapkan.',
    );
    expect(agus).toHaveTextContent('Penjualan: 9 · 4 closing');
    expect(agus).toHaveTextContent('Rekrut: —');
    expect(agus).toHaveTextContent('85 / 95 aktivitas goal');
    expect(within(agus).getByText('Potential Monthly Active Agent')).toHaveClass('sr-only');
    expect(within(agus).getByRole('button', { name: 'Lihat detail Anda' })).toBeInTheDocument();

    const dimas = rowOf('Dimas Pratama');
    expect(dimas).toHaveTextContent('82% · kurang Rp 14,4 jtRp 65,6 jt dari 80 jt');
    expect(dimas).toHaveTextContent('12 hari lalu · terlambatoleh Agus Santoso');
    expect(within(dimas).getByRole('button', { name: 'Perlu dipantau' })).toBeInTheDocument();
    expect(within(rowOf('Siti Rahma')).getAllByRole('cell')[0]).toHaveTextContent(/^Belum diunggahdari target Rp 80 jt$/);
    expect(rowOf('Siti Rahma')).toHaveTextContent('Belum ada 1:1');
    expect(within(rowOf('Sari Wulandari')).getAllByRole('cell')[0]).toHaveTextContent(/^Goal belum diaturproduksi Rp 65,6 jt$/);
    expect(within(rowOf('Arief Wibowo')).getByText('Pribadi')).toBeInTheDocument();
    // A correction's marker: who and when, the month and the day in the figures' language.
    expect(within(rowOf('Indah Lestari')).getByRole('button', {
      name: 'Dikoreksi setelah unggahan produksi, Okt 2026, oleh Ibu Ratna pada 6 Okt 2026',
    })).toBeInTheDocument();
    // The Status rules and what counts as a goal activity.
    expect(screen.getByRole('button', { name: 'Bagaimana status ditentukan?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apa yang dihitung sebagai aktivitas goal?' })).toHaveAccessibleDescription(
      'Aktivitas yang menjadi dasar goal: Set appointment, Sales meeting, Submission polis. Bukan setiap aktivitas yang dicatat.',
    );
    // The totals.
    const total = within(table).getByRole('rowheader', { name: 'Unit Anda — Total' }).closest('tr')!;
    expect(total).toHaveTextContent('82% · kurang Rp 57,6 jt');
    expect(total).toHaveTextContent('Rekrut: 1 rekrut potensial');
    expect(total).toHaveTextContent('On pace to be active: 3/4');
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 a new hire before a first sale: her tag, and the totals and tiles that leave her out', async () => {
    show(NEW_HIRE_VIEW);
    await roster();
    const yanti = rowOf('Yanti Puspita');
    expect(within(yanti).getByText('New hire')).toBeInTheDocument();
    expect(within(yanti).getByText(', belum ada penjualan pertama')).toHaveClass('sr-only');
    expect(screen.getAllByRole('button', {
      name: 'Belum ada penjualan pertama untuk Yanti Puspita, new hire, jadi tidak dihitung dalam total ini.',
    }).length).toBeGreaterThan(0);
    expect(within(tileOf('Direct Group production')).getByRole('button', {
      name: 'Belum diunggah untuk Siti Rahma, jadi tidak dihitung dalam total ini. Belum ada penjualan pertama untuk Yanti Puspita, new hire, jadi tidak dihitung dalam total ini.',
    })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 a row’s detail: Gap, the breakdown and the ratios kept, their lines Indonesian, the follow-up as typed', async () => {
    nav.search = 'period=7d';
    show();
    await roster();
    await userEvent.click(screen.getByRole('button', { name: 'Lihat detail Dimas Pratama' }));
    const detail = rowOf('Dimas Pratama').nextElementSibling as HTMLElement;
    expect(within(detail).getByText('Gap')).toBeInTheDocument();
    expect(detail).toHaveTextContent('Sisa Rp 14,4 jt');
    expect(detail).toHaveTextContent('≈ perlu 1 polis lagi, dengan rata-rata ukuran case-nya Rp 18 jt.');
    expect(within(detail).getByText('Activity breakdown')).toBeInTheDocument();
    expect(detail).toHaveTextContent('Set appointment63/70 prorata');
    expect(await within(detail).findByText('Selling success rate')).toBeInTheDocument();
    expect(detail).toHaveTextContent('Selling success rate18,0%');
    expect(within(detail).getByText('Follow-up yang ditandai (terdeteksi sistem)')).toBeInTheDocument();
    expect(detail).toHaveTextContent('Terlambat 3 hariRole-play objection handling before next presentation');
    expect(within(rowOf('Dimas Pratama')).getAllByRole('cell')[0]).toHaveTextContent('Rp 65,6 jt dari 80 jt · bulan ini');
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 Update production: its dialog, the money’s mark in its headings, its groups and its toast', async () => {
    const { calls } = show(dashboard(), { 'PATCH /unit/dashboard/production': { body: { updated: 1, state: {} } } });
    await roster();
    await userEvent.click(screen.getByRole('button', { name: 'Perbarui produksi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Perbarui produksi' });
    expect(dialog).toHaveTextContent('Masukkan angka terbaru dari laporan perusahaan — bulan dan tahun diperbarui secara terpisah.');
    expect(within(dialog).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['Nama', 'Pencapaian bulan (Rp)', 'Pencapaian tahun (Rp)']);
    expect(within(dialog).getByRole('rowheader', { name: 'Agen langsung Anda' })).toBeInTheDocument();
    expect(within(dialog).getByRole('rowheader', { name: 'Unit Arief Wibowo' })).toBeInTheDocument();
    const box = within(dialog).getByRole('textbox', { name: 'Pencapaian bulan (Rp), Dimas Pratama' });
    expect(box).toHaveValue('65.600.000');
    expect(within(dialog).getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    noEnglishLeft();
    await userEvent.clear(box);
    await userEvent.type(box, '70000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan semua' }));
    expect(await screen.findByText('Produksi diperbarui untuk 1 agent.')).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(true);
  });

  it('P18.98-T4 AC-1 a locked month: Update production held, saying who reopens it', async () => {
    show(dashboard({ production: { month: '2026-10', revision: 7, locked: true, canUpdate: true } }));
    await roster();
    expect(screen.getByRole('button', { name: 'Perbarui produksi' })).toHaveAccessibleDescription(
      'Produksi untuk Okt 2026 dikunci. Owner atau Admin dapat membukanya kembali.',
    );
  });

  it('P18.98-T4 AC-1 a phone’s cards: the groups, the labels above their values, by whom', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    show();
    const unit = await screen.findByRole('list', { name: 'Unit Anda' });
    expect(screen.getByRole('list', { name: 'Unit Sari Wulandari' })).toBeInTheDocument();
    const dimas = within(unit).getByRole('link', { name: 'Dimas Pratama' }).closest('li')!;
    expect(within(dimas).getByText('Progres goal')).toBeInTheDocument();
    expect(within(dimas).getByText('1:1 terakhir')).toBeInTheDocument();
    expect(dimas).toHaveTextContent('oleh Agus Santoso');
    await userEvent.click(within(dimas).getByRole('button', { name: 'Lihat detail Dimas Pratama' }));
    expect(within(dimas).getByText('Aktivitas')).toBeInTheDocument();
    expect(within(dimas).getByText('Leads')).toBeInTheDocument();
    expect(await within(dimas).findByText('70,0% Selling · 30,0% Recruitment')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 somebody who leads nobody: the empty unit, the two screens kept by their names', async () => {
    show(EMPTY);
    expect(await screen.findByText('Belum ada siapa pun di unit Anda.')).toBeInTheDocument();
    expect(screen.getByText(
      'Halaman ini menampilkan orang-orang yang Anda pimpin, setelah ada yang bergabung dengan Anda. Angka Anda sendiri ada di layar berikut:',
    )).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: 'Personal summary' })).toHaveAttribute('href', '/summary');
    expect(within(main).getByRole('link', { name: 'Activity management' })).toHaveAttribute('href', '/activity/log');
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 a unit below the reader, named for its head, and one the reader cannot open', async () => {
    stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: SARI_UNIT }, '/activity/ratios': { body: RATIOS } });
    const { unmount } = renderWithSession(
      <InLanguage language="id"><AgentLayout><UnitBelowPage params={routeParams({ membershipId: 'mem-sari' })} /></AgentLayout></InLanguage>,
      { me: AGUS_ME },
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Unit Dashboard Sari Wulandari' })).toBeInTheDocument();
    expect(tileOf('Potential Recruits (Group)')).toHaveTextContent('Unit Sari Wulandari1 kandidat');
    expect(tileOf('Potential Recruits (Group)')).toHaveTextContent('AAB Sari Wulandari0 kandidat');
    expect(screen.getByRole('table', { name: 'Roster tim Anda' })).toBeInTheDocument();
    noEnglishLeft();
    unmount();
    vi.unstubAllGlobals();
    stubFetch({ ...SHELL, 'GET /unit/dashboard': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'r-1' } } } });
    renderWithSession(
      <InLanguage language="id"><AgentLayout><UnitBelowPage params={routeParams({ membershipId: 'mem-x' })} /></AgentLayout></InLanguage>,
      { me: AGUS_ME },
    );
    expect(await screen.findByRole('heading', { level: 2, name: 'Ini bukan unit yang bisa Anda buka.' })).toBeInTheDocument();
    expect(screen.getByText('Mungkin dia belum memimpin siapa pun, berada di luar tim Anda, atau alamatnya salah ketik.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Unit Dashboard Anda' })).toHaveAttribute('href', '/unit/dashboard');
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 *+ Add agent*, the add-agent area’s word, beside Update production', async () => {
    stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: dashboard() }, '/activity/ratios': { body: RATIOS } });
    const me = makeMe({ ...AGUS_ME, permissions: [...AGUS_ME.permissions, 'member:invite'] });
    renderWithSession(<InLanguage language="id"><AgentLayout><UnitDashboardPage /></AgentLayout></InLanguage>, { me });
    await roster();
    expect(screen.getByRole('button', { name: '+ Tambah agent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Perbarui produksi' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 *+ Add agent*’s toasts carry the unit’s own sentence in Indonesian', async () => {
    // The confirmation before the dash is the shared one (`lib/confirmations.ts`), moved with the shared pieces.
    expect(unitDashboardMessages.id.addedDetail({ name: 'Rina Wijaya' })).toBe('Rina Wijaya sekarang ada di unit.');
    expect(unitDashboardMessages.id.transferDetail({ name: '87014' })).toBe('87014 pindah setelah KPM menyetujuinya.');
  });
});

describe('P18.98-T4 the Group tree in Indonesian', () => {
  const ME = makeMe({ ...AGUS_ME, permissions: ['org_tree:read'] });

  it('P18.98-T4 AC-1, AC-2 its title kept, its line and its empty state Indonesian', async () => {
    nav.pathname = '/group-tree';
    stubFetch({ ...SHELL, '/members/tree': { body: { nodes: [], leader: null, rootIds: [], selfId: 'mem-agus', counts: { ab: 0, aab: 0, agent: 0, total: 0 } } } });
    renderWithSession(<InLanguage language="id"><AgentLayout><GroupTreePage /></AgentLayout></InLanguage>, { me: ME });
    expect(await screen.findByText(
      'Belum ada yang melapor kepada Anda. Setelah Anda menambahkan agent ke unit Anda, mereka muncul di sini, bersama semua orang di bawah mereka.',
    )).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Group Tree' })).toBeInTheDocument();
    expect(screen.getByText(
      'Leader Anda, Anda sendiri, dan seluruh downline Anda, disusun per lapisan. Ketuk siapa pun untuk membuka Unit Dashboard-nya.',
    )).toBeInTheDocument();
    noEnglishLeft();
  });
});
