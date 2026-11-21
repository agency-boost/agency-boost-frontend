import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { Me } from '@/lib/session';
import type {
  Demographics, DriverFigure, InformalDrivers, InformalSheet, Mapa, MapaRow, Quant, QuantMetric, Shell, Subgroup,
} from '@/lib/advanced-analytics-page';
import { atWidth, makeMe, renderInIndonesian, stubFetch, type StubReply } from '@test/harness';
import { SectionBody, SectionTabs } from './advanced-analytics-screen';
import { DemographicsSection } from './demographics-section';
import { MapaSection, mapaFigure } from './mapa-section';
import { QuantSection, quantText } from './quant-section';
import { InformalGroupSection, SubgroupSection } from './subgroup-section';

/** jsdom paints nothing: contrast is pinned by the tokens' own spec (`a11y.spec.tsx`), as every screen's axe run does. */
const NO_CONTRAST = { rules: { 'color-contrast': { enabled: false } } };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/advanced-analytics/quant',
  useSearchParams: () => new URLSearchParams(),
}));

const member = (over: Record<string, unknown>) => makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 3, ...over,
  } as never,
});
const OWNER: Me = { ...member({ isKpmOwner: true }), permissions: ['advanced_analytics:read', 'advanced_analytics:write', 'ab_group_target:write'] };

const SHELL: Shell = {
  templateName: 'Prudential standar', version: 2, canWrite: true, canUpload: true,
  sections: (['demographics', 'mapa', 'nps', 'quant', 'qual', 'subgroup', 'events'] as const)
    .map((slug) => ({ kode: slug.toUpperCase(), slug })),
};

const person = (id: string, name: string, role = 'agent') => ({ membershipId: id, name, photoUrl: null, role });

const DEMOGRAPHICS: Demographics = {
  month: '2026-11', ab: null, abs: [{ membershipId: 'ab-1', name: 'Agus Prasetyo' }], manpower: 4,
  role: [{ key: 'AB', label: 'AB', count: 1 }, { key: 'AGENT', label: 'Agent', count: 3 }],
  workStatus: [{ key: 'full_time', count: 2 }, { key: 'part_time', count: 1 }, { key: 'unset', count: 1 }],
  gender: [{ key: 'male', count: 2 }, { key: 'female', count: 2 }, { key: 'unset', count: 0 }],
  ageBand: [{ key: 'gen_z', count: 1, from: 17, to: 29 }, { key: 'gen_y', count: 2, from: 30, to: 45 }, { key: 'gen_x', count: 0, from: 46, to: null }, { key: 'unset', count: 1 }],
  tenureBand: [{ key: '0', count: 2, from: null, to: 3 }, { key: '3', count: 0, from: 3, to: 7 }, { key: '7', count: 0, from: 7, to: 10 }, { key: '10', count: 1, from: 10, to: null }, { key: 'unset', count: 1 }],
  asOf: '2026-11-19',
  summary: { manpower: 4, complete: 2, incomplete: 2, completePct: 50, incompletePct: 50 },
  completeness: [
    { field: 'workStatus', filled: 3, of: 4, pct: 75, leaderPct: 100, agentPct: 67 },
    { field: 'dateOfBirth', filled: 3, of: 4, pct: 75, leaderPct: 100, agentPct: 67 },
    { field: 'joinDate', filled: 2, of: 4, pct: 50, leaderPct: 100, agentPct: 33 },
  ],
  members: [
    { ...person('m-1', 'Dewi Lestari'), agentCode: '70001', uplineName: 'Agus Prasetyo', workStatus: null, ageBand: null, joinDate: null, missing: ['workStatus', 'dateOfBirth', 'joinDate'], phone: '081211002200' },
    { ...person('m-2', 'Lukman Hakim'), agentCode: '70002', uplineName: 'Agus Prasetyo', workStatus: 'full_time', ageBand: 'gen_y', joinDate: null, missing: ['joinDate'], phone: null },
    { ...person('ab-1', 'Agus Prasetyo', 'ab'), agentCode: '70000', uplineName: null, workStatus: 'full_time', ageBand: 'gen_y', joinDate: '2016-05-01', missing: [], phone: null },
    { ...person('m-3', 'Rina Kurnia'), agentCode: '70003', uplineName: 'Agus Prasetyo', workStatus: 'part_time', ageBand: 'gen_z', joinDate: '2024-07-01', missing: [], phone: null },
  ],
  left: 2,
  canUpload: true,
};

const change = (value: number | null, kind: 'pct' | 'points' = 'pct') => ({ value, kind });
const row = (key: MapaRow['key'], group: MapaRow['group'], unit: MapaRow['unit'], v: Partial<MapaRow> = {}): MapaRow => ({
  key, group, unit, ytdLastYear: 5, ytd: 6, ytdChange: change(20), sameMonthLastYear: 5, lastMonth: 7, thisMonth: 2,
  changeVsSameMonth: change(-60), changeVsLastMonth: change(-71), target: null, ...v,
});
const M = 1_000_000 * 100;
const MAPA: Mapa = {
  month: '2026-10', currentMonth: '2026-11', earliestMonth: '2025-01', asOf: '2026-10-27', dataThrough: '2026-10',
  headline: {
    ape: { value: 597 * M, target: 683 * M, pct: 87, tone: 'yellow' },
    activeAgent: { value: 2, target: 18, pct: 11, tone: 'red' },
    rekrut: { value: 0, target: 10, pct: 0, tone: 'red' },
  },
  rows: [
    row('ape', 'ape', 'idr_minor', { ytdLastYear: 1630 * M, ytd: 2195 * M, ytdChange: change(35), thisMonth: 597 * M, sameMonthLastYear: 158 * M, lastMonth: 462 * M, target: 683 * M }),
    row('manpower', 'manpower', 'count', { ytdLastYear: 33, ytd: 30, ytdChange: change(-9) }),
    row('rekrut', 'manpower', 'count', { ytdLastYear: 0.9, ytd: 1.1, target: 10 }),
    row('active_agent', 'activation', 'count', { target: 18 }),
    row('new_agent_3m', 'activation', 'percentage', { ytdLastYear: 30, ytd: 36, ytdChange: change(6, 'points'), changeVsSameMonth: change(-4, 'points'), changeVsLastMonth: change(-8, 'points') }),
    row('policies', 'productivity', 'count'),
    row('policies_per_active_agent', 'productivity', 'ratio', { ytd: 2.2 }),
    row('average_case_size', 'case_size', 'idr_minor', { ytd: 18_800_000 * 100 }),
  ],
};

const metric = (code: string, over: Partial<QuantMetric> = {}): QuantMetric => ({
  code, metric: `M_${code}`, value: 1.2, complete: true, missingMonths: [], reason: null, median: 1.1, peers: 3, status: 'above',
  previous: 1, distribution: {
    leaders: [
      { ...person('ab-2', 'Satria Nugraha', 'ab'), role: 'ab', value: 1.7 },
      { ...person('aab-1', 'Dewi Lestari', 'aab'), role: 'aab', value: 1.3 },
      { ...person('ab-3', 'Sari Puspita', 'ab'), role: 'ab', value: 0.6 },
    ],
    median: 1.3, atOrAbove: 2,
  },
  ...over,
});
const QUANT: Quant = {
  periodEnd: '2026-06', fromMonth: '2026-01', runs: [{ periodEnd: '2026-06', fromMonth: '2026-01' }, { periodEnd: '2025-12', fromMonth: '2025-07' }],
  freezesAt: '2026-07-15T17:00:00.000Z', frozenAt: '2026-07-16T03:00:00.000Z', lateWriteAt: null, needed: 3,
  bands: { peerBandPct: 5, diffBand: 2 }, companyName: 'Prudential',
  metrics: [
    metric('A1'),
    metric('A3', { status: 'below', value: 0.7, median: 0.8, previous: 0.6 }),
    metric('B2', {
      status: 'below', value: 41, median: 45, previous: 39,
      distribution: { leaders: [{ ...person('aab-2', 'Arief Hidayat', 'aab'), role: 'aab', value: 56 }], median: 42.6, atOrAbove: 1 },
    }),
    metric('C2', { status: 'in_line' }),
    metric('D1', { status: null, median: null, peers: 2, value: 18_800_000 * 100, previous: null }),
  ],
};

const fig = (value: number | null, target: number | null, pct: number | null, tone: DriverFigure['tone']): DriverFigure => ({ value, target, pct, tone });
const DRIVERS: InformalDrivers = {
  maa: fig(5, 8, 63, 'red'), usage: { downlinePct: 74, leaderPct: 89, tone: 'yellow' },
  oneOnOne: fig(8.5, 16, 53, 'red'), rekrut: fig(4, 10, 40, 'red'),
};
const abRow = (id: string, name: string, people: number) => ({
  ab: { ...person(id, name, 'ab'), agentCode: '7000', isGroupLeader: true, isCoreLeader: false }, people, leaders: 1,
  drivers: { ...DRIVERS, maa: fig(3, 2, 150, 'green' as const) },
});
const SUBGROUP: Subgroup = {
  month: '2026-10', currentMonth: '2026-11', earliestMonth: '2024-01', canWrite: true,
  total: { groups: 2, leaders: 9, people: 30, drivers: DRIVERS },
  groups: [
    {
      group: { groupId: 'g-1', name: 'Top Producers 2026' }, leaders: [{ membershipId: 'ab-1', name: 'Wilson Tanoto', photoUrl: null }],
      counts: { leaders: 4, people: 10, abGroups: 2 }, drivers: DRIVERS,
      abGroups: [abRow('ab-1', 'Wilson Tanoto', 1), abRow('ab-4', 'Agus Prasetyo', 9)],
    },
    {
      group: { groupId: 'g-2', name: 'New Agent Mentoring Circle' }, leaders: [], counts: { leaders: 1, people: 4, abGroups: 1 },
      drivers: DRIVERS, abGroups: [abRow('ab-5', 'Satria Nugraha', 4)],
    },
  ],
};
const SHEET: InformalSheet = {
  driver: 'maa', month: '2026-10', ab: { ...person('ab-4', 'Agus Prasetyo', 'ab'), phone: '081211002200' }, drivers: DRIVERS,
  maa: {
    active: [{ person: { ...person('m-5', 'Rina Kurnia'), phone: null }, apeMinor: 18 * M, policies: 2 }],
    notYet: [{ person: { ...person('m-6', 'Dina Pertiwi'), phone: null }, potensi: 2, lastActiveMonth: '2026-09' }],
  },
};


function show(ui: React.ReactElement, routes: Record<string, StubReply | StubReply[]>, width = 1280) {
  atWidth(width);
  const stub = stubFetch(routes);
  return { ...stub, ...renderInIndonesian(ui, { me: OWNER }) };
}

describe('P19.22 the KPM’s Advanced analytics page — the data tabs (ADR-0275)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  // ------------------------------------------------------------------------------------------------ T1 the tab bar

  it('P19.22-T1 AC-1 seven tabs with short labels, in the fixed order; the current one a navy pill; no template notice', () => {
    renderInIndonesian(<SectionTabs shell={SHELL} hrefOf={(s) => `/kpm/advanced-analytics/${s}`} />, { me: OWNER });
    const nav = screen.getByRole('navigation', { name: 'Bagian Advanced analytics' });
    const tabs = within(nav).getAllByRole('link');
    expect(tabs.map((a) => a.textContent)).toEqual(['Demografi', 'MAPA driver', 'NPS', 'Kuantitatif', 'Kualitatif', 'Informal group', 'Event']);
    expect(tabs[3]).toHaveAttribute('aria-current', 'page');
    expect(tabs[3].className).toContain('bg-secondary');
    expect(tabs[0].className).toContain('px-[18px]');
    expect(document.querySelector('[data-template-notice]')).toBeNull();
  });

  it('P19.22-T1 AC-2 on a phone the bar scrolls sideways inside itself; from 768px the tabs spread evenly', () => {
    renderInIndonesian(<SectionTabs shell={SHELL} hrefOf={(s) => `/kpm/advanced-analytics/${s}`} />, { me: OWNER });
    const nav = document.querySelector('[data-analytics-tabs]')!;
    expect(nav.className).toContain('overflow-x-auto');
    expect(nav.className).toContain('flex-nowrap');
    expect(nav.className).toContain('md:justify-between');
  });

  it('P19.22-T1 a section loads when its tab is opened', async () => {
    // P19.25 (ADR-0281): the Event tab reads Kehadiran (`lib/event-analytics.ts`), its own spec in components/events-analytics.
    show(<SectionBody slug="events" shell={SHELL} />, {
      'GET /kpm/advanced-analytics/events/attendance': {
        body: {
          period: { kind: 'ytd', month: null, from: '2026-01-01', to: '2026-11-06' }, currentMonth: '2026-11', members: 0,
          recordedEvents: 0, recentEvents: 0, summary: { hadir: null, expected: null, pct: null, tone: null, events: 0 },
          past: [{ eventId: 'ev-1', title: 'Town Hall Q3', type: { code: 'COMMUNITY', label: 'Town hall' }, startsOn: '2026-09-12', recorded: false, figure: null }],
          upcoming: [], groups: [], people: [], canRecord: false,
        },
      },
    });
    expect((await screen.findAllByText('Town Hall Q3'))[0]).toBeInTheDocument();
  });

  // ------------------------------------------------------------------------------------------------ T2 Demografi

  it('P19.22-T2 AC-1 the summary, Komposisi anggota with each source, Kelengkapan data Leader vs Agent', async () => {
    show(<DemographicsSection canUpload />, { 'GET /kpm/advanced-analytics/demographics': { body: DEMOGRAPHICS } });
    const summary = await screen.findByText('Total manpower').then((el) => el.closest('[data-summary]')!);
    expect(summary).toHaveTextContent('Data lengkap');
    expect(summary).toHaveTextContent('Perlu melengkapi');
    expect(summary).toHaveTextContent('50% · kirim pengingat');
    expect(screen.getByText('Data dari profil anggota · 19 Nov 2026')).toBeInTheDocument();
    expect(document.querySelector('[data-dim="role"]')).toHaveTextContent('Otomatis');
    expect(document.querySelector('[data-dim="workStatus"]')).toHaveTextContent('Profil');
    expect(document.querySelector('[data-dim="tenureBand"]')).toHaveTextContent('Tanggal bergabung');
    expect(document.querySelector('[data-dim="ageBand"]')).toHaveTextContent('Gen Z · 17–29 (1)');
    expect(document.querySelector('[data-dim="workStatus"]')).toHaveTextContent('Belum diisi (1)');
    expect(document.querySelector('[data-field="joinDate"]')).toHaveTextContent('2 dari 4 · 50%');
    expect(document.querySelector('[data-field="joinDate"]')).toHaveTextContent('Leader 100% · Agent 33%');
  });

  it('P19.22-T2 AC-1 Sembunyikan "Belum diisi" takes the grey part out of every bar', async () => {
    show(<DemographicsSection canUpload />, { 'GET /kpm/advanced-analytics/demographics': { body: DEMOGRAPHICS } });
    await userEvent.click(await screen.findByRole('switch', { name: 'Sembunyikan "Belum diisi"' }));
    expect(document.querySelector('[data-dim="workStatus"]')).not.toHaveTextContent('Belum diisi');
  });

  it('P19.22-T2 AC-1 Data anggota shows the incomplete with Belum diisi in red; Kirim pengingat opens one WhatsApp per person', async () => {
    show(<DemographicsSection canUpload />, { 'GET /kpm/advanced-analytics/demographics': { body: DEMOGRAPHICS } });
    expect(await screen.findByText('4 aktif · 2 berhenti')).toBeInTheDocument();
    const rows = document.querySelectorAll('[data-member]');
    expect([...rows].map((r) => r.getAttribute('data-member'))).toEqual(['m-1', 'm-2']);
    // The name in capitals (the brief's *Naming rule*), by the stylesheet: the words stay the person's own.
    expect(within(rows[0] as HTMLElement).getByText('Dewi Lestari').parentElement!.className).toContain('uppercase');
    expect(rows[0]).toHaveTextContent('Belum diisi');
    await userEvent.click(screen.getByRole('button', { name: /Kirim pengingat ke 2 orang/ }));
    const link = await screen.findByRole('link', { name: 'WhatsApp Dewi Lestari' });
    expect(link.getAttribute('href')).toContain('https://wa.me/6281211002200?text=');
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain('Status kerja, Usia (tanggal lahir), Tanggal bergabung');
    expect(screen.getByText('Belum ada nomor WhatsApp')).toBeInTheDocument();
  });

  it('P19.22-T2 AC-1 Upload data in three steps: the file read as text and sent; the outcome named', async () => {
    const { calls } = show(<DemographicsSection canUpload />, {
      'GET /kpm/advanced-analytics/demographics': { body: DEMOGRAPHICS },
      'POST /kpm/advanced-analytics/demographics/upload': {
        body: { updated: 1, unchanged: 0, skipped: 1, rows: [{ line: 3, agentCode: 'NOPE', name: null, status: 'not_found', fields: [], problems: [] }] },
      },
    });
    expect(await screen.findByText('Unduh daftar')).toBeInTheDocument();
    expect(screen.getByText('Isi Status kerja (Full-time / Part-time), Tanggal lahir dan Tanggal bergabung (dd/mm/yyyy). Kolom kosong tidak diubah.')).toBeInTheDocument();
    const input = screen.getByLabelText('Pilih file CSV', { selector: 'input' }) as HTMLInputElement;
    await userEvent.upload(input, new File(['Kode agen,Status kerja\n70001,Full-time\n'], 'demografi.csv', { type: 'text/csv' }));
    expect(await screen.findByText('1 diperbarui · 0 tidak berubah · 1 dilewati')).toBeInTheDocument();
    expect(screen.getByText('Baris 3 · NOPE: Kode agen tidak ditemukan')).toBeInTheDocument();
    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(String(post.init.body))).toEqual({ file: 'Kode agen,Status kerja\n70001,Full-time\n' });
  });

  it('P19.22-T2 a reader who may not upload sees no Upload data and no reminder', async () => {
    show(<DemographicsSection />, { 'GET /kpm/advanced-analytics/demographics': { body: { ...DEMOGRAPHICS, canUpload: false } } });
    expect(await screen.findByRole('heading', { name: 'Data anggota' })).toBeInTheDocument();
    expect(screen.queryByText('Upload data')).toBeNull();
    expect(screen.queryByRole('button', { name: /Kirim pengingat/ })).toBeNull();
  });

  // ------------------------------------------------------------------------------------------------ T3 MAPA

  it('P19.22-T3 AC-1 Bulan ini vs target: APE, Active Agent, Rekrut, each with its target and %', async () => {
    show(<MapaSection />, { 'GET /kpm/advanced-analytics/mapa': { body: MAPA } });
    const ape = await screen.findByText('Bulan ini vs target').then(() => document.querySelector('[data-headline="APE"]')!);
    expect(ape).toHaveTextContent('Rp 597 Jt');
    expect(ape).toHaveTextContent('target Rp 683 Jt · 87%');
    expect(document.querySelector('[data-headline="Active Agent"]')).toHaveTextContent('target 18 · 11%');
    expect(screen.getByText('Diperbarui 27 Okt 2026 · data sampai Okt 2026')).toBeInTheDocument();
  });

  it('P19.22-T3 AC-2 one table: APE alone, then M · A · P · A; APE in Rp jt; a percentage changes in poin', async () => {
    show(<MapaSection />, { 'GET /kpm/advanced-analytics/mapa': { body: MAPA } });
    const table = await screen.findByRole('table', { name: 'Metrik MAPA' });
    const groups = within(table).getAllByRole('columnheader').filter((h) => h.getAttribute('scope') === 'colgroup').map((h) => h.textContent);
    expect(groups).toEqual(['APE', 'M · Manpower', 'A · Activation', 'P · Productivity', 'A · Average case size']);
    const ape = document.querySelector('[data-row="ape"]')!;
    expect(ape).toHaveTextContent('APE (Rp jt)');
    expect(ape).toHaveTextContent('1.630');
    expect(ape).toHaveTextContent('2.195');
    expect(ape).toHaveTextContent('683');
    expect(document.querySelector('[data-row="new_agent_3m"]')).toHaveTextContent('+6 poin');
    expect(document.querySelector('[data-row="manpower"]')).toHaveTextContent('–');
  });

  it('P19.22-T3 AC-3 the column header swaps the pair to Bulan lalu; the month picker asks for another month', async () => {
    const { calls } = show(<MapaSection />, { 'GET /kpm/advanced-analytics/mapa': { body: MAPA } });
    await screen.findByRole('table', { name: 'Metrik MAPA' });
    expect(screen.getByText('Okt \'25')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Bandingkan dengan'), 'lastMonth');
    expect(screen.getByText('Sep \'26')).toBeInTheDocument();
    expect(document.querySelector('[data-row="active_agent"]')).toHaveTextContent('71%');
    await userEvent.selectOptions(screen.getByLabelText('Bulan'), '2026-08');
    await waitFor(() => expect(calls.some((c) => c.url.includes('month=2026-08'))).toBe(true));
  });

  it('P19.22-T3 the figures by unit', () => {
    expect(mapaFigure({ key: 'ape', unit: 'idr_minor' }, 2195 * M, 'id')).toBe('2.195');
    expect(mapaFigure({ key: 'average_case_size', unit: 'idr_minor' }, 18_800_000 * 100, 'id')).toBe('18,8');
    expect(mapaFigure({ key: 'rekrut', unit: 'count' }, 0.9, 'id')).toBe('0,9');
    expect(mapaFigure({ key: 'new_agent_3m', unit: 'percentage' }, 36, 'id')).toBe('36%');
    expect(mapaFigure({ key: 'manpower', unit: 'count' }, null, 'id')).toBe('–');
  });

  // ------------------------------------------------------------------------------------------------ T4 Kuantitatif

  it('P19.22-T4 AC-1 Posisi KPM vs peers, Perlu fokus chips, one row per metric with KPM Anda · Median peers · Semester lalu', async () => {
    show(<QuantSection />, { 'GET /kpm/advanced-analytics/quant': { body: QUANT } });
    const position = await screen.findByText('Posisi KPM vs peers · 5 metrik').then((el) => el.closest('[data-position]')!);
    expect(position.querySelector('[data-count="above"]')).toHaveTextContent('1Di atas peers');
    expect(position.querySelector('[data-count="below"]')).toHaveTextContent('2Di bawah peers');
    expect(within(position as HTMLElement).getByRole('button', { name: /A3\s*Active agent per leader/ })).toBeInTheDocument();
    expect(screen.getByText('Peers = KPM Prudential lain dengan data lengkap (min. 3)')).toBeInTheDocument();
    const a1 = document.querySelector('[data-metric="A1"]')!;
    expect(a1).toHaveTextContent('Rekrut per leader');
    expect(a1).toHaveTextContent('KPM Anda1,2');
    expect(a1).toHaveTextContent('Median peers1,1');
    expect(a1).toHaveTextContent('Semester lalu1▲');
    expect(document.querySelector('[data-metric="D1"]')).toHaveTextContent('Belum cukup KPM pembanding (2 dari 3)');
    expect(screen.getByRole('combobox', { name: 'Periode' })).toHaveDisplayValue('Periode: Jan – Jun 2026');
  });

  it('P19.22-T4 AC-2 the right side opens on the first metric; tapping another shows its distribution, highlighted on the left', async () => {
    show(<QuantSection />, { 'GET /kpm/advanced-analytics/quant': { body: QUANT } });
    await screen.findAllByText('Distribusi per leader');
    const panel = document.querySelector('aside [data-distribution]')!;
    expect(panel).toHaveAttribute('data-distribution', 'A1');
    expect(panel).toHaveTextContent('2 dari 3 leader di atau di atas median KPM (1,3) · median peers 1,1');
    expect(panel).toHaveTextContent('Median KPM 1,3');
    expect([...panel.querySelectorAll('[data-leader]')].map((l) => l.getAttribute('data-leader'))).toEqual(['ab-2', 'aab-1', 'ab-3']);
    expect(document.querySelector('[data-metric="A1"]')).toHaveAttribute('data-selected');
    await userEvent.click(screen.getByRole('button', { name: /Tampilkan distribusi B2/ }));
    expect(document.querySelector('aside [data-distribution]')).toHaveAttribute('data-distribution', 'B2');
    expect(document.querySelector('[data-metric="B2"]')).toHaveAttribute('data-selected');
  });

  it('P19.22-T4 the figures by metric, and the empty state', async () => {
    expect(quantText('B2', 41, 'id')).toBe('41%');
    expect(quantText('A2', 3, 'id')).toBe('+3');
    expect(quantText('D1', 18_800_000 * 100, 'id')).toBe('18,8');
    show(<QuantSection />, { 'GET /kpm/advanced-analytics/quant': { body: { ...QUANT, periodEnd: null, runs: [], metrics: [] } } });
    expect(await screen.findByText('Semester pertama dihitung setelah Juni atau Desember berakhir.')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------------------------------------ T5 Informal group

  it('P19.22-T5 AC-1 AC-2 a month dropdown and the note only; Total KPM with four drivers coloured by progress', async () => {
    show(<SubgroupSection />, { 'GET /kpm/advanced-analytics/subgroup': { body: SUBGROUP } });
    expect(await screen.findByText('Sama dengan Overview › Performa vs target')).toBeInTheDocument();
    const total = document.querySelector('[data-total]')!;
    expect(total).toHaveTextContent('Total KPM · 2 informal group · 9 leader · 30 orang');
    expect(total.querySelector('[data-driver="maa"]')).toHaveTextContent('5/8');
    expect(total.querySelector('[data-driver="maa"]')).toHaveAttribute('data-tone', 'red');
    expect(total.querySelector('[data-driver="usage"]')).toHaveTextContent('74%');
    expect(total.querySelector('[data-driver="usage"]')).toHaveTextContent('downline · leader 89%');
    expect(total.querySelector('[data-driver="oneOnOne"]')).toHaveTextContent('8,5/16');
    expect(total.querySelector('[data-driver="rekrut"]')).toHaveTextContent('Rekrut YTD 2026');
  });

  it('P19.22-T5 AC-3 one card per group, the first open with its AB groups; a card opens and closes', async () => {
    show(<SubgroupSection />, { 'GET /kpm/advanced-analytics/subgroup': { body: SUBGROUP } });
    const first = await screen.findByText('Top Producers 2026').then((el) => el.closest('[data-group]')!);
    expect(first).toHaveTextContent('Group Leader WILSON TANOTO · 4 leader · 10 orang');
    expect(first).toHaveTextContent('2 AB group');
    expect(first.querySelectorAll('[data-ab-group]')).toHaveLength(2);
    expect(first.querySelector('[data-ab-group="ab-4"]')).toHaveTextContent('9 orang di grupnya');
    const second = document.querySelector('[data-group="g-2"]')!;
    expect(second).toHaveTextContent('Belum ada Group Leader');
    expect(second.querySelectorAll('[data-ab-group]')).toHaveLength(0);
    await userEvent.click(within(second as HTMLElement).getByRole('button', { name: 'Buka New Agent Mentoring Circle' }));
    expect(second.querySelectorAll('[data-ab-group]')).toHaveLength(1);
    // ⋯ (Ubah nama · Ubah group leader · Hapus group) beside the card's own chevron, both named by the group.
    expect(within(first as HTMLElement).getAllByRole('button', { name: /Top Producers 2026/ })).toHaveLength(2);
  });

  it('P19.22-T5 AC-4 every number of an AB group opens the people behind it, with WhatsApp to the AB and Ubah target', async () => {
    const { calls } = show(<SubgroupSection />, {
      'GET /kpm/advanced-analytics/subgroup/people': { body: SHEET },
      'GET /kpm/advanced-analytics/subgroup': { body: SUBGROUP },
    });
    const agus = await screen.findByText('9 orang di grupnya').then((el) => el.closest('[data-ab-group]')!);
    await userEvent.click(within(agus as HTMLElement).getByRole('button', { name: /^MAA 3 \/ 2/ }));
    expect(await screen.findByText('Sudah aktif (1)')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/subgroup/people?ab=ab-4&driver=maa&month=2026-10'))).toBe(true);
    expect(screen.getByText('Belum aktif (1) · urut dari yang paling dekat')).toBeInTheDocument();
    expect(screen.getByText('2 potensi')).toBeInTheDocument();
    expect(screen.getByText('aktif terakhir Sep 2026')).toBeInTheDocument();
    const wa = screen.getByRole('link', { name: /WhatsApp Agus · kirim daftar ini/ });
    expect(decodeURIComponent(wa.getAttribute('href')!)).toContain('- DINA PERTIWI');
    expect(screen.getByRole('button', { name: 'Ubah target' })).toBeInTheDocument();
  });

  it('P19.22-T8 the forum’s name for the informal-group section is the same component', () => {
    expect(InformalGroupSection).toBe(SubgroupSection);
  });

  // ------------------------------------------------------------------------------------------------ accessibility

  it.each([
    ['Demografi', <DemographicsSection key="d" canUpload />, { 'GET /kpm/advanced-analytics/demographics': { body: DEMOGRAPHICS } }, 'Data anggota'],
    ['MAPA driver', <MapaSection key="m" />, { 'GET /kpm/advanced-analytics/mapa': { body: MAPA } }, 'Metrik MAPA'],
    ['Analisa kuantitatif', <QuantSection key="q" />, { 'GET /kpm/advanced-analytics/quant': { body: QUANT } }, 'Perlu fokus'],
    ['Informal group', <SubgroupSection key="s" />, { 'GET /kpm/advanced-analytics/subgroup': { body: SUBGROUP } }, 'Top Producers 2026'],
  ] as const)('P19.22 WCAG 2.1 AA %s, populated, has no axe violation', async (_name, ui, routes, ready) => {
    const { container } = show(ui, routes as Record<string, StubReply>);
    await screen.findAllByText(ready);
    expect((await axe(container, NO_CONTRAST)).violations.map((v) => v.id)).toEqual([]);
  });
});
