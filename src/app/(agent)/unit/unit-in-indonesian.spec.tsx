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
  activities, AGUS_ME, dashboard, EMPTY, NEW_HIRE_VIEW, RATIOS, SARI_UNIT,
} from '@test/unit-dashboard-fixtures';
import type { UnitDashboardView } from '@/lib/unit-dashboard';
import UnitBelowPage from './dashboard/[membershipId]/page';
import UnitDashboardPage from './dashboard/page';

/**
 * **The Unit Dashboard and the Group tree in Indonesian** (P18.98-T4 AC-1 to AC-4, coaching and unit; UI V1, Phase 18.99
 * T4, UI-006 on this page): the tabs, the period pill, the four tiles, *Roster tim Anda* as a table and as a phone's
 * accordion with its chips, groups and pills, the Activities tab, *Update production*, the empty unit, a unit below the
 * reader and one they cannot open; the
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
const tileOf = (label: string) => screen.getByText(label).closest<HTMLElement>('[data-stat-tile]')!;

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

  it('UI-001, UI-003, UI-006 the title, the tabs, the period pill and the four tiles: the report’s words, kept terms English', async () => {
    show();
    await roster();
    expect(screen.getByRole('heading', { level: 1, name: 'Unit Dashboard' })).toBeInTheDocument();
    expect(within(screen.getByRole('tablist')).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview', 'Aktivitas']);
    const period = screen.getByRole('combobox', { name: 'Periode' });
    expect(within(period).getAllByRole('option').map((o) => o.textContent)).toEqual(['7 hari terakhir', 'Bulan ini', 'Tahun ini']);
    expect(period).toHaveValue('month');
    // UI-003's labels, the month in full in the reader's figures; *4 dari 12* as the report writes it.
    expect(tileOf('Tim Anda')).toHaveTextContent('16agent4 langsung12 AAB');
    expect(tileOf('Produksi Group')).toHaveTextContent('78%Rp 1Mdari Rp 1,3 M');
    expect(tileOf('Active Agent Oktober')).toHaveTextContent('12dari 16');
    expect(tileOf('Active Agent Oktober')).toHaveTextContent('Unit 3/4AAB 9/12');
    expect(tileOf('Recruitment Oktober')).toHaveTextContent('2kandidatUnit 1AAB 1');
    noEnglishLeft();
  });

  it('UI-002, UI-005, UI-009, UI-028 the roster: its heading, Last updated, chips, columns, groups and pills in Indonesian', async () => {
    show();
    const table = await roster();
    expect(screen.getByText('Last updated 7 Okt 26')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Filter menurut status' })).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['Semua 14', 'Perlu perhatian 4', 'Perlu dipantau 6']);
    expect(within(table).getAllByRole('columnheader').map((h) => (h.textContent ?? '').split('ⓘ')[0])).toEqual([
      'Nama', 'Progres goal', 'Leads penjualan', 'Closing', 'Leads rekrut', 'Potensi rekrut', 'Aktivitas', '1:1 terakhir', 'Status', 'Detail',
    ]);
    expect(within(table).getByRole('button', { name: 'Unit Anda · 4' }).closest('tr')).toHaveTextContent('Aktif 3/4');
    expect(within(table).getByRole('button', { name: 'Unit Sari Wulandari · 6' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anda (Agus)' })).toHaveAttribute('href', '/summary');
    expect(within(rowOf('Siti Rahma')).getByText('Perlu perhatian')).toHaveAttribute('data-tone', 'red');
    expect(within(rowOf('Siti Rahma')).getByText('Belum diunggah')).toBeInTheDocument();
    expect(within(rowOf('Sari Wulandari')).getAllByText('Goal belum diatur').length).toBeGreaterThan(0);
    expect(within(rowOf('Dimas Pratama')).getByText('Rp 65,6 jt / 80 jt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bagaimana status ditentukan?' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('UI-001 the Activities tab: its controls, the table and the ratio card in Indonesian', async () => {
    nav.search = 'tab=activities';
    stubFetch({ ...SHELL, 'GET /unit/dashboard/activities': { body: activities() } });
    renderWithSession(<InLanguage language="id"><AgentLayout><UnitDashboardPage /></AgentLayout></InLanguage>, { me: AGUS_ME });
    const grid = await screen.findByRole('table', { name: 'Aktivitas · Unit' });
    expect(screen.getByRole('button', { name: 'Periode sebelumnya' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Periode berikutnya' })).toBeDisabled();
    expect(screen.getByLabelText('Pilih tanggal: 26 Okt – 1 Nov 2026')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Periode' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Minggu', 'Bulan']);
    expect(within(screen.getAllByRole('group', { name: 'Unit atau Group' })[0]).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['Unit', 'Group']);
    expect(within(grid).getByRole('columnheader', { name: 'Aktivitas' })).toBeInTheDocument();
    expect(within(grid).getByRole('button', { name: 'Tampilkan Recruitment' })).toBeInTheDocument();
    // The office's own names, as typed (content: never translated).
    expect(within(grid).getByRole('rowheader', { name: 'Mendapatkan calon prospek baru' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Ratio · 30 hari terakhir' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 a new hire before a first sale: her tag, and the production tile’s ⓘ that leaves her out', async () => {
    show(NEW_HIRE_VIEW);
    await roster();
    const yanti = rowOf('Yanti Puspita');
    expect(within(yanti).getByText(/^New hire/)).toBeInTheDocument();
    expect(within(yanti).getByText(', belum ada penjualan pertama')).toHaveClass('sr-only');
    expect(within(tileOf('Produksi Group')).getByRole('button', {
      name: 'Belum diunggah untuk Siti Rahma, jadi tidak dihitung dalam total ini. Belum ada penjualan pertama untuk Yanti Puspita, new hire, jadi tidak dihitung dalam total ini.',
    })).toBeInTheDocument();
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

  it('UI-002 a phone’s accordion: the groups, the rows and the pills in Indonesian', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    show();
    expect(await screen.findByRole('button', { name: /^Unit Anda · 4/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /^Unit Arief Wibowo · 3/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anda (Agus)' })).toBeInTheDocument();
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
    expect(tileOf('Recruitment Oktober')).toHaveTextContent('1kandidatUnit 1AAB 0');
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
