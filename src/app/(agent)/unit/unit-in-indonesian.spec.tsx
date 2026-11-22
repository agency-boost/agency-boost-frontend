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
 * **The Unit Dashboard and the Group tree in Indonesian** (P18.10-T4 AC-1 to AC-4, coaching and unit; UI V1, Phase 18.11
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
/** The roster, as P19.18-T1 draws it: unit cards in a region named by its title (*Roster tim Anda · 16*). */
const roster = () => screen.findByRole('region', { name: /^Roster tim Anda/ });
const person = (id: string) => document.querySelector<HTMLElement>(`[data-person="${id}"]`)!;
const panel = () => document.querySelector<HTMLElement>('[data-unit-panel]')!;
/** The owner in their field view, whose taps open the person card (P19.18-T1 AC-9). */
const OWNER_ME = makeMe({
  ...AGUS_ME, membership: { ...AGUS_ME.membership!, isKpmOwner: true }, permissions: [...AGUS_ME.permissions, 'member:invite'],
});

describe('P18.10-T4 the Unit Dashboard in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass: the same dashboard in English shows it', async () => {
    expect(UNIT_ENGLISH.length).toBeGreaterThan(45);
    stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: dashboard() } });
    renderInLayout(AgentLayout, <UnitDashboardPage />, { me: AGUS_ME });
    await screen.findByRole('region', { name: /^Your team’s roster/ });
    expect(englishShown(document.body, UNIT_ENGLISH)).toEqual(
      expect.arrayContaining(['Period', 'Update production', 'Group production', 'Your team']),
    );
  });

  it('P19.18-T1 AC-1, AC-3 the title, the tabs, Tahun ini first, and the orange panel: the client’s words, kept terms English', async () => {
    show();
    await roster();
    expect(screen.getByRole('heading', { level: 1, name: 'Unit Dashboard' })).toBeInTheDocument();
    expect(within(screen.getByRole('tablist')).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview', 'Aktivitas']);
    // A menu under its button since P19.8-T4 (AC-12, MOB UI-171); *Tahun ini* first since P19.18-T1 AC-1.
    await userEvent.click(screen.getByRole('button', { name: 'Periode Tahun ini' }));
    const period = screen.getByRole('listbox', { name: 'Periode' });
    expect(within(period).getAllByRole('option').map((o) => o.textContent)).toEqual(['7 hari terakhir', 'Bulan ini', expect.stringContaining('Tahun ini')]);
    expect(within(period).getByRole('option', { name: 'Tahun ini', selected: true })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    // The panel (AC-3): *Produksi Group*, its % pill, *Rp 1 M dari Rp 1,3 M*; three tiles, one number each, no chips.
    expect(panel()).toHaveTextContent('Produksi Group');
    expect(panel()).toHaveTextContent('78%Rp 1 Mdari Rp 1,3 M');
    const tiles = [...panel().querySelectorAll<HTMLElement>('[data-panel-tile]')].map((t) => t.textContent);
    expect(tiles).toEqual(['16Tim Anda', '2OktActive Agent', '1OktRecruitment']);
    expect(panel()).not.toHaveTextContent(/langsung|kandidat|dari 16/);
    noEnglishLeft();
  });

  it('P19.18-T1 AC-4 the two sheets in Indonesian: who is active this month, who joined, and Lihat di New Hires', async () => {
    show();
    await roster();
    await userEvent.click(screen.getByRole('button', { name: 'Active Agent Oktober: 2' }));
    const active = await screen.findByRole('dialog', { name: 'Active Agent · Oktober' });
    expect(active).toHaveAccessibleDescription('2 dari 16 · dari data produksi yang diunggah');
    expect(active.querySelector('[data-sheet-person="mem-novi"]')).toHaveTextContent('Unit ARIEF WIBOWO · APE Rp 6 Jt · 1 polis');
    expect(active.querySelector('[data-sheet-person="mem-agus"]')).toHaveTextContent('Unit Anda · APE Rp 12 Jt · 1 polis');
    noEnglishLeft();
    await userEvent.click(within(active).getByRole('button', { name: 'Tutup' }));
    await userEvent.click(screen.getByRole('button', { name: 'Recruitment Oktober: 1' }));
    const joined = await screen.findByRole('dialog', { name: 'Recruitment · Oktober' });
    expect(joined).toHaveAccessibleDescription('1 agent baru bergabung bulan ini');
    expect(joined.querySelector('[data-sheet-person="mem-tono"]')).toHaveTextContent('Direkrut oleh Sari Wulandari · Bergabung 3 Okt 2026');
    expect(within(joined).getByRole('link', { name: 'Lihat di New Hires' })).toHaveAttribute('href', '/new-hires');
    noEnglishLeft();
  });

  it('P19.18-T1 AC-6 to AC-8 the roster: its title, the unit lines, the rows, the coaching tile and the leads in Indonesian', async () => {
    show();
    const region = await roster();
    expect(within(region).getByRole('heading', { name: 'Roster tim Anda · 16' })).toBeInTheDocument();
    expect(screen.getByText('7 Okt 26')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentang roster ini' })).toBeInTheDocument();
    expect(document.querySelector('[data-unit-section="own"] [data-unit-line]')).toHaveTextContent('Unit Anda·4 orang');
    expect(document.querySelector('[data-unit-section="mem-sari"] [data-unit-line]')).toHaveTextContent('Unit SARI WULANDARI·6 orang');
    expect(document.querySelector('[data-team-line="mem-wulan"]')).toHaveTextContent('Unit WULAN SARI·2 orang');
    expect(screen.getByRole('link', { name: 'Anda (Agus)' })).toHaveAttribute('href', '/summary');
    expect(person('mem-siti')).toHaveTextContent('Belum diunggah');
    expect(person('mem-sari')).toHaveTextContent('Goal belum diatur');
    expect(person('mem-dimas')).toHaveTextContent('82%Rp 65,6 Jt / 80 Jt');
    expect(person('mem-dimas').querySelector('[data-coaching-status]')).toHaveTextContent('Coaching 12 hari lalu');
    expect(person('mem-siti').querySelector('[data-coaching-status]')).toHaveTextContent('Belum pernah coaching');
    expect(person('mem-dimas').querySelector('[data-period-leads]')).toHaveTextContent('Leads sales 5Leads rekrut 2');
    // No status pill and no status chips (OD-391).
    expect(screen.queryByRole('group', { name: 'Filter menurut status' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Perlu perhatian|Perlu dipantau|Sesuai target/)).not.toBeInTheDocument();
    noEnglishLeft();
  });

  it('P19.18-T1 AC-9 the KPM Owner’s person card in Indonesian: the role once, the four numbers, Buka profil, WhatsApp', async () => {
    stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: dashboard({ personCard: true }) }, '/activity/ratios': { body: RATIOS } });
    renderWithSession(<InLanguage language="id"><AgentLayout><UnitDashboardPage /></AgentLayout></InLanguage>, { me: OWNER_ME });
    await roster();
    await userEvent.click(within(person('mem-indah')).getByRole('button', { name: 'Indah Lestari' }));
    const card = await screen.findByRole('dialog', { name: 'INDAH LESTARI' });
    expect(card).toHaveAccessibleDescription('Agent · Unit Anda');
    expect([...card.querySelectorAll('[data-card-figure]')].map((f) => f.textContent)).toEqual([
      'Leads penjualan51 potensi', 'Leads rekrut20 potensi', 'Progres goal82%Rp 65,6 Jt / 80 Jt', 'Aktivitas127 hari terakhir',
    ]);
    expect(card.querySelector('[data-coaching-status]')).toHaveTextContent('Coaching 4 hari lalu');
    expect(within(card).getByRole('link', { name: 'Buka profil' })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'WhatsApp' })).toBeInTheDocument();
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
    // P19.18-T2 AC-1: every category closed on opening — *Tampilkan …* on each; one tap opens Leads Generation.
    await userEvent.click(within(grid).getByRole('button', { name: 'Tampilkan Leads Generation' }));
    expect(within(grid).getByRole('button', { name: 'Sembunyikan Leads Generation' })).toBeInTheDocument();
    // The office's own names, as typed (content: never translated).
    expect(within(grid).getByRole('rowheader', { name: 'Mendapatkan calon prospek baru' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Ratio · 30 hari terakhir' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.10-T4 AC-1 a new hire before a first sale: the production’s ⓘ that leaves her out', async () => {
    show(NEW_HIRE_VIEW);
    await roster();
    expect(within(panel()).getByRole('button', {
      name: 'Belum diunggah untuk Siti Rahma, jadi tidak dihitung dalam total ini. Belum ada penjualan pertama untuk Yanti Puspita, new hire, jadi tidak dihitung dalam total ini.',
    })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.10-T4 AC-1 Update production: its dialog, the money’s mark in its headings, its groups and its toast', async () => {
    const { calls } = show(dashboard(), { 'PATCH /unit/dashboard/production': { body: { updated: 1, state: {} } } });
    await roster();
    await userEvent.click(screen.getByRole('button', { name: 'Perbarui produksi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Perbarui produksi' });
    expect(dialog).toHaveTextContent('Masukkan angka bulan terbaru dari laporan perusahaan — angka tahun adalah jumlah bulan-bulannya.');
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

  it('P18.10-T4 AC-1 a locked month: Update production held, saying who reopens it', async () => {
    show(dashboard({ production: { month: '2026-10', revision: 7, locked: true, canUpdate: true } }));
    await roster();
    expect(screen.getByRole('button', { name: 'Perbarui produksi' })).toHaveAccessibleDescription(
      'Produksi untuk Okt 2026 dikunci. Owner atau Admin dapat membukanya kembali.',
    );
  });

  it('P19.18-T1 AC-6 a phone: Unit Anda open, the other units closed, each line and row in Indonesian', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    show();
    expect(await screen.findByRole('button', { name: /^Unit Anda/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /^Unit ARIEF WIBOWO/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anda (Agus)' })).toBeInTheDocument();
    noEnglishLeft();
  });


  /* *Changed 2026-11-07* (P19.8-T4 AC-11; MOB UI-181; OD-280): no *Belum ada data* line; *0 dari –*. */
  it('P18.10-T4 AC-1, P19-T4 AC-3, P19.8-T4 AC-11 MOB UI-181 a leader who leads nobody: the tiles at zero, 0 dari – and the Contoh', async () => {
    show(EMPTY);
    expect(await screen.findByText('Contoh')).toBeInTheDocument();
    expect(screen.queryByText('Belum ada data')).not.toBeInTheDocument();
    expect([...panel().querySelectorAll('[data-number-size]')].map((n) => n.textContent)).toEqual(['0', '–', '–']);
    expect(document.querySelector('[data-sample]')!.textContent).toContain('Agen contoh 1');
    noEnglishLeft();
  });

  it('P18.10-T4 AC-1 a unit below the reader, named for its head, and one the reader cannot open', async () => {
    stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: SARI_UNIT }, '/activity/ratios': { body: RATIOS } });
    const { unmount } = renderWithSession(
      <InLanguage language="id"><AgentLayout><UnitBelowPage params={routeParams({ membershipId: 'mem-sari' })} /></AgentLayout></InLanguage>,
      { me: AGUS_ME },
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Unit Dashboard Sari Wulandari' })).toBeInTheDocument();
    expect(panel().querySelector('[data-panel-tile="team"]')).toHaveTextContent('6Tim Anda');
    expect(screen.getByRole('region', { name: /^Roster tim Anda/ })).toBeInTheDocument();
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

  it('P18.10-T4 AC-1 *+ Add agent*, the add-agent area’s word, beside Update production', async () => {
    stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: dashboard() }, '/activity/ratios': { body: RATIOS } });
    const me = makeMe({ ...AGUS_ME, permissions: [...AGUS_ME.permissions, 'member:invite'] });
    renderWithSession(<InLanguage language="id"><AgentLayout><UnitDashboardPage /></AgentLayout></InLanguage>, { me });
    await roster();
    expect(screen.getByRole('button', { name: '+ Tambah agent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Perbarui produksi' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.10-T4 AC-1 *+ Add agent*’s toasts carry the unit’s own sentence in Indonesian', async () => {
    // The confirmation before the dash is the shared one (`lib/confirmations.ts`), moved with the shared pieces.
    expect(unitDashboardMessages.id.addedDetail({ name: 'Rina Wijaya' })).toBe('Rina Wijaya sekarang ada di unit.');
    expect(unitDashboardMessages.id.transferDetail({ name: '87014' })).toBe('87014 pindah setelah KPM menyetujuinya.');
  });
});

describe('P18.10-T4 the Group tree in Indonesian', () => {
  const ME = makeMe({ ...AGUS_ME, permissions: ['org_tree:read'] });

  it('P18.10-T4 AC-1, AC-2 its title kept, its line and its empty state Indonesian', async () => {
    nav.pathname = '/group-tree';
    stubFetch({ ...SHELL, '/members/tree': { body: { nodes: [], leader: null, rootIds: [], selfId: 'mem-agus', counts: { ab: 0, aab: 0, agent: 0, total: 0 } } } });
    renderWithSession(<InLanguage language="id"><AgentLayout><GroupTreePage /></AgentLayout></InLanguage>, { me: ME });
    expect(await screen.findByText('Belum ada data')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Undang agen' })).toHaveAttribute('href', '/new-hires');
    expect(screen.getByRole('heading', { level: 1, name: 'Group Tree' })).toBeInTheDocument();
    expect(screen.getByText(
      'Leader Anda, Anda sendiri, dan seluruh downline Anda, disusun per lapisan. Ketuk siapa pun untuk membuka Unit Dashboard-nya.',
    )).toBeInTheDocument();
    noEnglishLeft();
  });
});

/**
 * **The views, in Indonesian** (P19.12-T6; ADR-0249): the client's own words — *Tampilan*, *Grup langsung · Grup
 * informal · Semua downline*, *"3 AB di bawah Anda belum masuk grup"*, *+ Tambah ke grup*, *Belum punya leader* — with no
 * English left. *Changed 2026-11-20 (P19.18-T1 AC-2, AC-3):* *Direct Unit* leads the picker, and the tiles carry no *AB*
 * chip — no split chips at all.
 */
describe('P19.12-T6 the views in Indonesian', () => {
  const OWNER = makeMe({
    ...AGUS_ME,
    membership: { ...AGUS_ME.membership!, isKpmOwner: true },
    permissions: [...AGUS_ME.permissions, 'member:tag_group'],
  });
  const informal = dashboard({
    scope: 'informal',
    scopes: { offered: ['unit', 'direct', 'informal', 'downline'], default: 'downline' },
    informal: { groups: [], absNotInGroup: 3, abs: [{ membershipId: 'mem-y', name: 'Yosef Tambunan' }], canTag: true },
    tiles: { ...dashboard().tiles, team: { ...dashboard().tiles.team, aab: 10, ab: 2, total: 16 } },
    unled: { rows: [{ ...dashboard().yourUnit.rows[1], membershipId: 'mem-nora', name: 'Nora Siregar' }], total: dashboard().yourUnit.total },
  });

  it('P19.12-T6 AC-2 the picker, the line, the AB chip and Belum punya leader, all in Indonesian', async () => {
    nav.search = 'scope=informal';
    stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: informal }, '/activity/ratios': { body: RATIOS } });
    renderWithSession(<InLanguage language="id"><AgentLayout><UnitDashboardPage /></AgentLayout></InLanguage>, { me: OWNER });
    await roster();
    expect(screen.getByRole('button', { name: 'Tampilan Grup informal' })).toBeInTheDocument();
    expect(screen.getByText('3 AB di bawah Anda belum masuk grup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Tambah ke grup' })).toBeInTheDocument();
    // P19.18-T1 AC-3: no split chips — the AB chip is gone with them.
    expect(panel()).not.toHaveTextContent(/\bAB\b/);
    expect(document.body).toHaveTextContent(/Belum punya leader/);
    await userEvent.click(screen.getByRole('button', { name: 'Tampilan Grup informal' }));
    expect(within(screen.getByRole('listbox', { name: 'Tampilan' })).getAllByRole('option').map((o) => o.textContent?.replace('✓', '').trim()))
      .toEqual(['Direct Unit', 'Grup langsung', 'Grup informal', 'Semua downline']);
    noEnglishLeft();
  });
});
