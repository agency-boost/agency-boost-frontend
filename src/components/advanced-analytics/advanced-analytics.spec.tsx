import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { Me } from '@/lib/session';
import type { Demographics, EventsNps, Mapa, MapaRow, Quant, Shell, Subgroup } from '@/lib/advanced-analytics-page';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import { SectionBody, SectionTabs } from './advanced-analytics-screen';
import { targetFromTyped, targetToTyped } from './mapa-section';
import { quantText } from './quant-section';

/** jsdom paints nothing: contrast is pinned by the tokens' own spec (`a11y.spec.tsx`), as every screen's axe run does. */
const NO_CONTRAST = { rules: { 'color-contrast': { enabled: false } } };
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/kpm/advanced-analytics/quant',
  useSearchParams: () => new URLSearchParams(),
}));

const member = (over: Record<string, unknown>) => makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 3, ...over,
  } as never,
});
const OWNER: Me = { ...member({ isKpmOwner: true }), permissions: ['advanced_analytics:read', 'advanced_analytics:write', 'member:read_tags'] };
const CORE_LEADER: Me = member({ isCoreLeader: true });

const SHELL: Shell = {
  templateName: 'Prudential standar', version: 2, canWrite: true, canUpload: true,
  sections: [
    { kode: 'MAPA', slug: 'mapa' }, { kode: 'DEMOGRAPHICS', slug: 'demographics' }, { kode: 'QUANT', slug: 'quant' },
    { kode: 'SUBGROUP', slug: 'subgroup' }, { kode: 'EVENTS', slug: 'events' },
  ],
};
const READ_ONLY: Shell = { ...SHELL, canWrite: false, canUpload: false };

const DEMOGRAPHICS: Demographics = {
  month: '2026-11', ab: null, abs: [{ membershipId: 'ab-1', name: 'Agus Prasetyo' }], manpower: 28,
  role: [{ key: 'AB', label: 'AB', count: 3 }, { key: 'AAB', label: 'AAB', count: 5 }, { key: 'AGENT', label: 'Agen', count: 20 }],
  workStatus: [{ key: 'full_time', count: 20 }, { key: 'part_time', count: 6 }, { key: 'unset', count: 2 }],
  gender: [{ key: 'male', count: 12 }, { key: 'female', count: 14 }, { key: 'unset', count: 2 }],
  ageBand: [
    { key: 'gen_z', count: 10, from: 17, to: 29 }, { key: 'gen_y', count: 12, from: 30, to: 45 },
    { key: 'gen_x', count: 4, from: 46, to: null }, { key: 'unset', count: 2 },
  ],
  tenureBand: [
    { key: '0', count: 15, from: null, to: 3 }, { key: '3', count: 8, from: 3, to: 7 }, { key: '7', count: 3, from: 7, to: 10 },
    { key: '10', count: 2, from: 10, to: null }, { key: 'unset', count: 0 },
  ],
};

const metric = (code: string, over: Partial<Quant['metrics'][number]> = {}): Quant['metrics'][number] => ({
  code, metric: `M_${code}`, value: 2.5, complete: true, missingMonths: [], reason: null, median: 2, peers: 3, status: 'above', ...over,
});
const QUANT: Quant = {
  periodEnd: '2026-06', runs: ['2026-06', '2025-12'], freezesAt: '2026-07-15T17:00:00.000Z', frozenAt: '2026-07-20T03:00:00.000Z',
  lateWriteAt: '2026-07-20T03:00:00.000Z', needed: 3, bands: { peerBandPct: 5, diffBand: 2 },
  metrics: [
    metric('A1'), metric('A2', { value: 3, median: 1, status: 'in_line' }),
    metric('A3', { complete: false, missingMonths: ['2026-03'], status: null }),
    metric('B1', { value: 50, median: null, peers: 2, status: null }),
    metric('B2', { value: null, reason: 'not_enough_data', status: null }),
    metric('B3', { value: 67, median: 70, status: 'below' }), metric('C1'), metric('C2'), metric('C3'),
    metric('D1', { value: 25_000_000_00, median: 20_000_000_00 }),
  ],
};

const row = (key: MapaRow['row'], over: Partial<MapaRow> = {}): MapaRow => ({
  row: key, unit: key === 'ape' ? 'idr_minor' : 'count', monthly: key !== 'producing_agents', targetable: key === 'ape' || key === 'flc',
  months: Array.from({ length: 12 }, (_, i) => {
    const month = `2026-${String(i + 1).padStart(2, '0')}`;
    return {
      month,
      value: i < 10 ? { kind: 'figure' as const, value: key === 'ape' ? 100_000_000_00 : 4 } : { kind: 'future' as const },
      lastYear: { kind: 'pending' as const },
      target: key === 'ape' && i === 8 ? 150_000_000_000 : null,
      ...(key === 'flc' && i === 8 ? { joined: 1 } : {}),
    };
  }),
  ytd: { kind: 'figure', value: key === 'ape' ? 900_000_000_00 : 30 },
  ytdLastYear: { kind: 'not_uploaded' },
  ...over,
});
const MAPA: Mapa = {
  year: '2026', through: '2026-11', ytdMissingMonths: ['2026-03'], ytdLastYearMissingMonths: [], canWrite: true,
  rows: [row('ape'), row('manpower'), row('flc'), row('producing_agents')],
};

const SUBGROUP: Subgroup = {
  month: '2026-11', thresholds: { okPct: 80, powerUserDays: 10, powerUserWindow: 30 }, canWrite: true,
  rows: [{
    group: { groupId: 'g-1', name: 'TOP PRODUCERS' }, head: { membershipId: 'ab-1', name: 'Agus Prasetyo' }, manpower: 12, leaders: 3,
    maa: { baseline: 4.5, lastMonth: 5, mtd: 3, asOf: '2026-11-05' },
    targets: { aa: 3, rec: 6, isDefault: true }, adoption: { headDays: 18, downlinePct: 64 }, powerUsers: 4,
    oneOnOnesPerWeek: 1.8, weeklyActivityTarget: 6,
    recruitment: { baseline: 9, ytd: 5, missingMonths: ['2026-03'] },
    attainment: { aaPct: 100, aaOk: true, recPct: 83, recOk: true },
  }, {
    group: { groupId: 'g-2', name: 'LEADER MUDA' }, head: null, manpower: 4, leaders: 2,
    maa: { baseline: null, lastMonth: 1, mtd: 1, asOf: '2026-11-05' },
    targets: { aa: 4, rec: 9, isDefault: false }, adoption: { headDays: null, downlinePct: 50 }, powerUsers: 1,
    oneOnOnesPerWeek: 0.5, weeklyActivityTarget: 8,
    recruitment: { baseline: null, ytd: 1, missingMonths: [] },
    attainment: { aaPct: 25, aaOk: false, recPct: 11, recOk: false },
  }, {
    group: null, head: null, manpower: 20, leaders: 4,
    maa: { baseline: 2, lastMonth: 2, mtd: 2, asOf: '2026-11-05' },
    targets: { aa: 12, rec: 24, isDefault: true }, adoption: { headDays: null, downlinePct: 40 }, powerUsers: 2,
    oneOnOnesPerWeek: 1, weeklyActivityTarget: 24,
    recruitment: { baseline: 3, ytd: 2, missingMonths: [] },
    attainment: { aaPct: 17, aaOk: false, recPct: 8, recOk: false },
  }],
};

const EVENTS: EventsNps = {
  period: { kind: 'ytd', from: '2026-01-01', to: '2026-11-06' }, ab: null, abs: [{ membershipId: 'ab-1', name: 'Agus Prasetyo' }],
  kpm: { nps: 43, average: 8.4, n: 7 },
  events: [{ eventId: 'ev-1', title: 'Town Hall Q3', startsOn: '2026-09-12', nps: 43, average: 8.4, n: 7 }],
};

function show(slug: Parameters<typeof SectionBody>[0]['slug'], routes: Record<string, StubReply>, me: Me = OWNER, shell: Shell = SHELL, platformKpmId?: string) {
  atWidth(1280);
  const stub = stubFetch(routes);
  const view = renderInIndonesian(<SectionBody slug={slug} shell={shell} platformKpmId={platformKpmId} />, { me });
  return { ...stub, ...view };
}

describe('P19.5-T3 the KPM’s Advanced analytics page', () => {
  afterEach(() => { vi.unstubAllGlobals(); replace.mockClear(); });

  it('P19.5-T3 AC-1 AC-11 the tabs are the template’s sections that are on, in its order, then Event; the template notice', () => {
    renderInIndonesian(<SectionTabs shell={SHELL} hrefOf={(s) => `/kpm/advanced-analytics/${s}`} />, { me: OWNER });
    const tabs = within(screen.getByRole('navigation', { name: 'Bagian Advanced analytics' })).getAllByRole('link');
    expect(tabs.map((a) => a.textContent)).toEqual(['MAPA driver', 'Demografi KPM', 'Analitik kuantitatif', 'Perbaikan sub-group', 'Event']);
    expect(tabs[0]).toHaveAttribute('href', '/kpm/advanced-analytics/mapa');
    expect(document.querySelector('[data-template-notice]')).toHaveTextContent('Bagian mengikuti Prudential standar v2.');
  });

  it('P19.5-T3 AC-2 OWN Case 6 Demografi KPM: manpower 28, five dimensions with Belum diisi, the bands from the server', async () => {
    show('demographics', { 'GET /kpm/advanced-analytics/demographics': { body: DEMOGRAPHICS } });
    expect(await screen.findByText('28')).toBeInTheDocument();
    const age = document.querySelector('[data-dimension="ageBand"]')!;
    expect(age).toHaveTextContent('Gen Z 17–29');
    expect(age).toHaveTextContent('Gen Y 30–45');
    expect(age).toHaveTextContent('Gen X 46+');
    expect(age).toHaveTextContent('Belum diisi');
    expect(document.querySelector('[data-dimension="tenureBand"]')).toHaveTextContent('> 10 tahun');
    expect(document.querySelector('[data-dimension="workStatus"]')).toHaveTextContent('Paruh waktu');
    expect(document.querySelector('[data-dimension="role"]')).toHaveTextContent('Agen');
  });

  it('P19.5-T3 AC-2 the AB filter asks the server for that AB’s Group', async () => {
    const { calls } = show('demographics', { 'GET /kpm/advanced-analytics/demographics': { body: DEMOGRAPHICS } });
    await userEvent.selectOptions(await screen.findByLabelText(kept('AB')), 'ab-1');
    await waitFor(() => expect(calls.some((c) => c.url.includes('ab=ab-1'))).toBe(true));
  });

  it('P19.5-T3 AC-1 D-37 with no data the layout stays: Belum ada data, and Unggah data for the Owner only', async () => {
    const empty = { ...DEMOGRAPHICS, manpower: 0 };
    show('demographics', { 'GET /kpm/advanced-analytics/demographics': { body: empty } });
    expect(await screen.findByText('Belum ada data')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Unggah data' })).toHaveAttribute('href', '/kpm/data-upload');
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    show('demographics', { 'GET /kpm/advanced-analytics/demographics': { body: empty } }, CORE_LEADER, READ_ONLY);
    expect(await screen.findByText('Belum ada data')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Unggah data' })).toBeNull();
  });

  it('P19.5-T3 AC-6 AC-7 AC-8 Quant: each metric with this KPM, the peer median and the chip; under three, no chip', async () => {
    show('quant', { 'GET /kpm/advanced-analytics/quant': { body: QUANT } });
    const a1 = await screen.findByText('Rekrutmen per leader').then((el) => el.closest('tr')!);
    expect(a1).toHaveTextContent('Di atas pembanding');
    expect(document.querySelector('[data-row="A2"]')).toHaveTextContent('Setara');
    expect(document.querySelector('[data-row="B3"]')).toHaveTextContent('Di bawah pembanding');
    const b1 = document.querySelector('[data-row="B1"]')!;
    expect(b1).toHaveTextContent('Belum cukup KPM pembanding (2 dari 3)');
    expect(b1.querySelector('[data-tone]')).toBeNull();
    expect(document.querySelector('[data-row="B2"]')).toHaveTextContent('Belum cukup data');
    expect(screen.getByText('Pembanding: median KPM lain di perusahaan ini')).toBeInTheDocument();
  });

  it('P19.5-T3 AC-5 AT-6 an incomplete value is the shared Belum lengkap cell and takes no chip', async () => {
    show('quant', { 'GET /kpm/advanced-analytics/quant': { body: QUANT } });
    const a3 = await screen.findByText('Agen aktif per leader').then((el) => el.closest('tr')!);
    expect(a3.querySelector('[data-ytd="incomplete"]')).toHaveTextContent('Belum lengkap · Mar belum diunggah');
    expect(a3.querySelector('[data-tone]')).toBeNull();
  });

  it('P19.5-T3 AC-9 AA UI-023 a locked run says so, and a later upload is named', async () => {
    show('quant', { 'GET /kpm/advanced-analytics/quant': { body: QUANT } });
    expect(await screen.findByText('Data diunggah setelah periode dikunci')).toBeInTheDocument();
    expect(document.querySelector('[data-run-state="frozen"]')).toHaveTextContent('Dikunci');
  });

  it('P19.5-T3 AC-9 before the first run, the empty state', async () => {
    show('quant', { 'GET /kpm/advanced-analytics/quant': { body: { ...QUANT, periodEnd: null, runs: [], metrics: [] } } });
    expect(await screen.findByText('Periode pertama dihitung setelah Juni atau Desember berakhir.')).toBeInTheDocument();
  });

  it('P19.5-T3 AC-4 AC-5 MAPA: the forum’s rows by month, the target field, YTD Belum lengkap · Mar, D2’s ⓘ', async () => {
    const { calls } = show('mapa', {
      'GET /kpm/advanced-analytics/mapa': { body: MAPA },
      'PUT /kpm/advanced-analytics/targets/mapa': { body: { month: '2026-01', row: 'ape', value: 120_000_000_000 } },
    });
    const ape = await screen.findByText(/^APE/).then((el) => el.closest('tr')!);
    expect(ape.querySelector('[data-ytd="incomplete"]')).toHaveTextContent('Belum lengkap · Mar belum diunggah');
    const flc = document.querySelector('[data-row="flc"]')!;
    expect(within(flc as HTMLElement).getAllByText('ⓘ').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-row="producing_agents"]')).toHaveTextContent('Tidak dilacak');
    const field = screen.getByRole('textbox', { name: /Target APE.*Jan/ });
    await userEvent.type(field, '1,2');
    field.blur();
    await waitFor(() => expect(calls.find((c) => c.init.method === 'PUT')).toBeTruthy());
    expect(JSON.parse(calls.find((c) => c.init.method === 'PUT')!.init.body as string)).toEqual({ month: '2026-01', row: 'ape', value: 120_000_000_000 });
  });

  it('P19.5-T3 AC-4 a Core Leader reads the targets — TBD where none — and types none', async () => {
    show('mapa', { 'GET /kpm/advanced-analytics/mapa': { body: { ...MAPA, canWrite: false } } }, CORE_LEADER, READ_ONLY);
    await screen.findByText(/^APE/);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.querySelector('[data-row="ape"]')).toHaveTextContent('TBD');
  });

  it('P19.5-T3 AC-4 an APE target is typed in miliar and stored in minor units', () => {
    expect(targetFromTyped('ape', '1,5')).toBe(150_000_000_000);
    expect(targetFromTyped('ape', '2')).toBe(200_000_000_000);
    expect(targetFromTyped('flc', '6')).toBe(6);
    expect(targetFromTyped('flc', '1.5')).toBeUndefined();
    expect(targetFromTyped('ape', '')).toBeNull();
    expect(targetToTyped('ape', 150_000_000_000, 'id')).toBe('1,5');
    expect(quantText('A2', 3, 'id')).toBe('+3');
    expect(quantText('B1', 50, 'id')).toBe('50%');
  });

  it('P19.13-T3 AC-6 Sub-group: one row per group with its ★, then Tidak ada group; Ubah target and Grouping open Core leaders & groups', async () => {
    show('subgroup', { 'GET /kpm/advanced-analytics/subgroup': { body: SUBGROUP } });
    const top = await screen.findByText('TOP PRODUCERS').then((el) => el.closest('tr')!);
    expect(top).toHaveTextContent('★ Agus Prasetyo');
    expect(top).toHaveTextContent('bawaan template');
    expect(top).toHaveTextContent('100% tercapai');
    expect(top).toHaveTextContent('Leader: 18 dari 30 hari');
    expect(top.querySelector('[data-ytd="incomplete"]')).toBeTruthy();
    expect(within(top).getByRole('link', { name: 'Ubah target' })).toHaveAttribute('href', '/people/core-leaders?group=g-1');
    // A group with no ★ says so, and has no head's days.
    const muda = screen.getByText('LEADER MUDA').closest('tr')!;
    expect(muda).toHaveTextContent('Belum ada group leader');
    expect(muda).not.toHaveTextContent('dari 30 hari');
    const none = screen.getByText('Tidak ada group').closest('tr')!;
    expect(within(none).getByRole('link', { name: 'Ubah target' })).toHaveAttribute('href', '/people/core-leaders?group=none');
    expect(screen.getByRole('link', { name: 'Grouping ›' })).toHaveAttribute('href', '/people/core-leaders');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('P19.13-T3 AC-6 a Core Leader reads Sub-group with no Grouping and no Ubah target: the page is the office’s', async () => {
    show('subgroup', { 'GET /kpm/advanced-analytics/subgroup': { body: { ...SUBGROUP, canWrite: false } } }, CORE_LEADER);
    await screen.findByText('TOP PRODUCERS');
    expect(screen.queryByRole('link', { name: 'Grouping ›' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ubah target' })).toBeNull();
  });

  it('P19.5-T3 AC-3 OWN Case 7 Event: the KPM’s score and each event, no name of anybody', async () => {
    show('events', { 'GET /kpm/advanced-analytics/events': { body: EVENTS } });
    expect(await screen.findByText('Town Hall Q3')).toBeInTheDocument();
    expect(document.querySelector('[data-kpm-nps]')).toHaveTextContent('+43');
    expect(document.querySelector('[data-kpm-nps]')).toHaveTextContent('rata-rata 8,4');
  });

  it('P19.5-T3 AC-12 the Super Admin’s tab reads the platform route and draws nothing that writes', async () => {
    const { calls } = show('mapa', { 'GET /admin/tenants/kpm-9/advanced-analytics/mapa': { body: { ...MAPA, canWrite: false } } }, makeMe(), READ_ONLY, 'kpm-9');
    await screen.findByText(/^APE/);
    expect(calls[0].url).toContain('/admin/tenants/kpm-9/advanced-analytics/mapa');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Unggah data' })).toBeNull();
  });

  it('P19.5-T3 AC-13 axe is clean on every section, in Indonesian and English', async () => {
    const routes = {
      'GET /kpm/advanced-analytics/demographics': { body: DEMOGRAPHICS },
      'GET /kpm/advanced-analytics/quant': { body: QUANT },
      'GET /kpm/advanced-analytics/mapa': { body: MAPA },
      'GET /kpm/advanced-analytics/subgroup': { body: SUBGROUP },
      'GET /kpm/advanced-analytics/events': { body: EVENTS },
    };
    for (const [slug, text] of [['demographics', 'Gen Z 17–29'], ['quant', 'Rekrutmen per leader'], ['mapa', /^APE/], ['subgroup', 'TOP PRODUCERS'], ['events', 'Town Hall Q3']] as const satisfies readonly (readonly [Parameters<typeof SectionBody>[0]['slug'], string | RegExp])[]) {
      const { container, unmount } = show(slug, routes);
      await screen.findAllByText(text);
      expect((await axe(container, NO_CONTRAST)).violations).toEqual([]);
      unmount();
      vi.unstubAllGlobals();
    }
    stubFetch(routes);
    const { container } = renderWithSession(<SectionBody slug="quant" shell={SHELL} />, { me: OWNER });
    await screen.findByText('Recruitment per leader');
    expect(screen.getByText('Not enough peer KPMs (2 of 3)')).toBeInTheDocument();
    expect((await axe(container, NO_CONTRAST)).violations).toEqual([]);
  });
});

/** `kept('AB')` reads as itself in both languages. */
function kept(term: string): string {
  return term;
}
