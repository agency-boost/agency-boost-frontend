import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { ActivityDashboardPanel } from '@/components/activity-dashboard';
import { activityMessages } from '@/i18n/messages/activity';
import { TenantConfigProvider } from '@/lib/tenant-config-cache';
import { PHONE_QUERY } from '@/lib/use-phone';
import { makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import ActivityDashboardPage from './dashboard/page';
import LogActivityPage from './log/page';
import ActivityIndex from './page';
import ActivityRatioPage from './ratio/page';

/**
 * **Activity Management in ID mode** (P18.98-T4 AC-1 to AC-4, field selling): *Log Activity*, the *Dashboard* (and its
 * body as a coachee's *Activity* tab draws it), the *Ratio* tab and `/activity`'s hand-off — in the approved glossary's
 * Indonesian, the title, the nav item and the three tabs English (§A), what the office typed as typed, the figures
 * Indonesian, and no English message of the module's own left on the screen (`englishShown`). English is each
 * screen's `page.spec.tsx`, unchanged but for its figures.
 */
const nav = vi.hoisted(() => ({ pathname: '/activity/log' }));
const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => nav.pathname,
}));

const ACTIVITY_ENGLISH = englishOnly(activityMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ACTIVITY_ENGLISH)).toEqual([]);

const AGENT = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent',
    status: 'active', isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['activity_log:read_raw', 'activity_log:create', 'activity_log:update', 'activity_ratios:read'],
});

/** Below 768px, as `usePhone` reads it. */
const asPhone = () => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
  media: query, matches: query === PHONE_QUERY, addEventListener: vi.fn(), removeEventListener: vi.fn(),
})));

/* ── Log Activity ─────────────────────────────────────────────────────────────────────────────── */

/** The office's own taxonomy, in its own words — shown as typed in both languages. */
const TAXONOMY = [
  {
    id: 'c1', code: 'LEADS', label: 'Leads Generation', description: null,
    appliesToOrgLevelCodes: [], displayOrder: 1, version: 1, status: 'active',
    types: [
      { id: 't1', code: 'LEADS_GEN_ACTIVITY', label: 'Melakukan aktivitas leads generation', categoryCode: 'LEADS', description: null, displayOrder: 1, version: 1, status: 'active' },
      { id: 't2', code: 'LEADS_CONTACTED', label: 'Set Appointment', categoryCode: 'LEADS', description: null, displayOrder: 2, version: 1, status: 'active' },
    ],
  },
  {
    id: 'c2', code: 'SELLING', label: 'Selling', description: null,
    appliesToOrgLevelCodes: [], displayOrder: 2, version: 1, status: 'active',
    types: [
      { id: 't3', code: 'SELL_SUBMISSION', label: 'Submission polis', categoryCode: 'SELLING', description: null, displayOrder: 1, version: 1, status: 'active' },
    ],
  },
];

const day = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-1', localDate: '2026-10-28',
  entries: [
    { activityTypeId: 't1', activityTypeCode: 'LEADS_GEN_ACTIVITY', label: 'Melakukan aktivitas leads generation', count: 0 },
    { activityTypeId: 't2', activityTypeCode: 'LEADS_CONTACTED', label: 'Set Appointment', count: 2 },
    { activityTypeId: 't3', activityTypeCode: 'SELL_SUBMISSION', label: 'Submission polis', count: 1 },
  ],
  totalCount: 3, version: 1, frozenAt: null, editable: true, correctionCount: 0, ...over,
});

const logRoutes = (over: Record<string, unknown> = {}, activity: unknown[] = TAXONOMY) => ({
  '/kpm/config': { body: { activity, ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
  '/activity/log': { body: day(over) },
});

const renderLog = () => {
  nav.pathname = '/activity/log';
  renderInIndonesian(<AgentLayout><LogActivityPage /></AgentLayout>, { me: AGENT });
};

describe('P18.98-T4 Log Activity in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 says the day in Indonesian, the title and the three tabs English, the office’s items as typed', async () => {
    stubFetch(logRoutes());
    renderLog();
    await screen.findByText('Melakukan aktivitas leads generation');

    expect(screen.getByRole('heading', { name: 'Activity Management', level: 1 })).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Activity management' });
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Log Activity', 'Dashboard', 'Ratio']);
    expect(screen.getByText('Catat aktivitas hari ini dalam 1 menit.')).toBeInTheDocument();
    expect(screen.getByLabelText('Tanggal')).toBeInTheDocument();
    expect(screen.getByText('Tersimpan · 3 aktivitas')).toBeInTheDocument();
    expect(screen.getByText(/^Total aktivitas hari ini/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/sentuhan/);
    expect(screen.getByText('2 item')).toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeInTheDocument();
    for (const typed of ['Leads Generation', 'Selling', 'Set Appointment', 'Submission polis']) {
      expect(screen.getAllByText(typed).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan aktivitas' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 asks before a date change throws counts away, in Indonesian', async () => {
    stubFetch(logRoutes());
    renderLog();
    await screen.findByText('Melakukan aktivitas leads generation');

    // The stepper's own controls are the shared `Stepper`'s; its last button adds one.
    const stepper = screen.getByRole('group', { name: 'Submission polis' });
    await userEvent.click(within(stepper).getAllByRole('button').at(-1)!);
    const date = screen.getByLabelText('Tanggal');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-10-27');

    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Ada jumlah yang belum disimpan untuk hari tersebut. Buang dan buka hari lain?'))
      .toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Buang jumlah' })).toBeInTheDocument();
  });

  it('AC-3 asks a closed day’s reason, counting its corrections in one sentence', async () => {
    stubFetch(logRoutes({ editable: false, frozenAt: '2026-10-28T00:00:00.000Z', correctionCount: 2 }));
    renderLog();
    const reason = await screen.findByLabelText('Mengapa catatan ini dikoreksi?');

    expect(reason).toHaveAccessibleDescription('Hari tersebut sudah ditutup, dan sudah dikoreksi 2 kali.');
    expect(screen.getByRole('button', { name: 'Simpan koreksi' })).toBeDisabled();
    noEnglishLeft();
  });

  it('AC-1 says a closed day that was never logged, and an office with nothing set up', async () => {
    stubFetch(logRoutes({ editable: false, frozenAt: '2026-10-28T00:00:00.000Z', version: 0, totalCount: 0 }));
    renderLog();
    expect(await screen.findByText('Hari tersebut sudah ditutup, dan tidak ada aktivitas yang tercatat.')).toBeInTheDocument();
  });

  it('AC-1 tells an office with no activity types to ask its KPM Owner, KPM and KPM Owner kept', async () => {
    stubFetch(logRoutes({}, []));
    renderLog();
    expect(await screen.findByText(
      'KPM Anda belum mengatur jenis aktivitasnya. Tanyakan kepada KPM Owner Anda — daftar di layar ini mereka yang menentukan.',
    )).toBeInTheDocument();
  });

  it('AC-3 writes a phone’s one line as one sentence: the day, its count in bold and the word for it', async () => {
    asPhone();
    stubFetch(logRoutes());
    renderLog();
    await screen.findByText('Melakukan aktivitas leads generation');

    const line = screen.getByText((_, el) => el?.tagName === 'P' && /^Hari ini: 3 aktivitas/.test(el.textContent ?? ''));
    expect(within(line).getByText('3').tagName).toBe('STRONG');
  });

  it('UI-106 says a phone’s views, its date pill and its save bar in Indonesian — aktivitas, never sentuhan', async () => {
    asPhone();
    stubFetch(logRoutes());
    renderLog();
    await screen.findByText('Melakukan aktivitas leads generation');

    expect(screen.getByRole('heading', { name: 'Activity', level: 1 })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Activity management' })).getAllByRole('link').map((a) => a.textContent))
      .toEqual(['Log Activity', 'Dashboard', 'Ratio']);
    expect(screen.getByRole('button', { name: 'Hari sebelumnya' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hari berikutnya' })).toBeDisabled();
    expect(screen.getByLabelText('Pilih hari')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apa itu aktivitas?' })).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Tambah Submission polis'));
    const bar = document.querySelector('[data-action-bar]')!;
    expect(bar).toHaveTextContent('Belum disimpan');
    expect(bar).toHaveTextContent('1 aktivitas baru');
    expect(within(bar as HTMLElement).getByRole('button', { name: 'Simpan aktivitas' })).toBeInTheDocument();
    expect(within(bar as HTMLElement).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/sentuhan/);
    noEnglishLeft();
  });
});

/* ── The Dashboard ────────────────────────────────────────────────────────────────────────────── */

const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - i);
  const iso = d.toISOString().slice(0, 10);
  return { from: iso, to: iso, days: 1, kind: 'day' as const };
});
const type = (code: string, label: string, displayOrder: number, counts: number[], over = {}) => ({
  code, label, description: null, displayOrder, standing: 'shown', total: counts.reduce((a, b) => a + b, 0), counts, ...over,
});
const section = (code: string, label: string, types: ReturnType<typeof type>[], over = {}) => {
  const counts = types[0].counts.map((_, i) => types.reduce((t, ty) => t + ty.counts[i], 0));
  return { code, label, standing: 'shown', total: counts.reduce((a, b) => a + b, 0), counts, types, ...over };
};

/** Seven days, most recent first, ending Monday 28 September. */
const WEEK = (() => {
  const sections = [
    section('LEADS_GENERATION', 'Leads Generation', [
      type('LEADS_CONTACTED', 'Menghubungi prospek', 3, [5, 4, 0, 0, 3, 0, 0], { description: 'Telepon, WhatsApp' }),
    ]),
    section('SELLING', 'Selling', [
      type('SELL_SUBMISSION', 'Submission polis', 6, [1, 0, 0, 0, 0, 0, 0]),
      type('SELL_OLD', 'Presentasi lama', 7, [1, 0, 0, 0, 0, 0, 0], { standing: 'archived' }),
    ]),
    section('TEAM_DEVELOPMENT', 'Team Development', [type('DEV_TEAM', 'Rapat tim', 1, [0, 1, 0, 0, 0, 0, 0])], {
      standing: 'not_shown',
    }),
  ];
  const counts = sections[0].counts.map((_, i) => sections.reduce((t, s) => t + s.counts[i], 0));
  return {
    range: 'ROLLING_7D', from: '2026-09-22', to: '2026-09-28', days: 7, today: '2026-09-28',
    buckets: days('2026-09-28', 7), sections, counts, total: counts.reduce((a, b) => a + b, 0),
    daysLogged: 4, correctedDays: 0,
  };
})();

const MONTH = {
  ...WEEK,
  range: 'ROLLING_30D', from: '2026-08-30', days: 30,
  buckets: [
    { from: '2026-09-22', to: '2026-09-28', days: 7, kind: 'week' },
    { from: '2026-09-15', to: '2026-09-21', days: 7, kind: 'week' },
    { from: '2026-09-08', to: '2026-09-14', days: 7, kind: 'week' },
    { from: '2026-09-01', to: '2026-09-07', days: 7, kind: 'week' },
    { from: '2026-08-30', to: '2026-08-31', days: 2, kind: 'remainder' },
  ],
  sections: [section('SELLING', 'Selling', [type('SELL_SUBMISSION', 'Submission polis', 6, [1, 2, 0, 0, 1])])],
  counts: [1, 2, 0, 0, 1], total: 4, correctedDays: 1,
};

const SECTIONS = [
  ['LEADS_GENERATION', 'Leads Generation'], ['SELLING', 'Selling'],
].map(([code, label], i) => ({
  id: `c${i}`, code, label, description: null, appliesToOrgLevelCodes: [] as string[], displayOrder: i + 1, version: 1,
  status: 'active', types: [],
}));
const dashboardConfig = {
  '/kpm/config': { body: { activity: SECTIONS, ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
};

const renderDashboard = () => renderInIndonesian(
  <TenantConfigProvider><ActivityDashboardPage /></TenantConfigProvider>, { me: AGENT },
);

describe('P18.98-T4 the Activity Dashboard in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 says the range, the strip and the table in Indonesian, the weekdays and the days in Indonesian figures', async () => {
    stubFetch({ ...dashboardConfig, '/activity/dashboard': { body: WEEK } });
    renderDashboard();
    await screen.findByText('Menghubungi prospek');

    expect(screen.getByText('Aktivitas Anda sendiri, hari demi hari.')).toBeInTheDocument();
    expect(within(screen.getByRole('tablist', { name: 'Rentang' })).getAllByRole('tab').map((t) => t.textContent))
      .toEqual(['7 hari terakhir', '30 hari terakhir', 'Kustom']);
    expect(screen.getByRole('status')).toHaveTextContent('7 hari · 22 Sep – 28 Sep 2026');
    const table = screen.getByRole('table', { name: 'Aktivitas Anda' });
    expect(within(table).getAllByRole('columnheader').slice(0, 4).map((h) => h.textContent))
      .toEqual(['Aktivitas', 'Total', 'Sen28', 'Min27']);
    expect(screen.getByText('Total aktivitas')).toBeInTheDocument();
    // Why a row is not one of today's sections, in the reader's words.
    expect(within(table).getByText('Diarsipkan')).toBeInTheDocument();
    expect(within(table).getByText('Tidak lagi ada di bagian Anda')).toBeInTheDocument();
    // What the office typed, as typed.
    expect(within(table).getByText('Telepon, WhatsApp')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-3 heads the last 30 days as weeks and the days left over, and leads with the total of every category', async () => {
    stubFetch({ ...dashboardConfig, '/activity/dashboard': [{ body: WEEK }, { body: MONTH }] });
    renderDashboard();
    await screen.findByText('Menghubungi prospek');
    await userEvent.click(screen.getByRole('tab', { name: '30 hari terakhir' }));

    expect(await screen.findByRole('columnheader', { name: 'Minggu 1 22 Sep–28 Sep' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Sisa 2 hari 30 Agu–31 Agu' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^30 hari · 30 Agu – 28 Sep 2026$/);
    expect(screen.getByText('Total — semua kategori')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 refuses a custom range that starts after it ends, in Indonesian', async () => {
    stubFetch({ ...dashboardConfig, '/activity/dashboard': { body: WEEK } });
    renderDashboard();
    await screen.findByText('Menghubungi prospek');
    await userEvent.click(screen.getByRole('tab', { name: 'Kustom' }));

    const from = await screen.findByLabelText('Dari');
    expect(screen.getByLabelText('Sampai')).toBeInTheDocument();
    expect(screen.getByText('sampai')).toBeInTheDocument();
    await userEvent.clear(from);
    await userEvent.type(from, '2026-09-29');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^Pilih rentang yang valid — /));
  });

  it('AC-1 says a range with nothing logged, and offers Log Activity, kept', async () => {
    const empty = { ...WEEK, sections: [], counts: [0, 0, 0, 0, 0, 0, 0], total: 0 };
    stubFetch({ ...dashboardConfig, '/activity/dashboard': { body: empty } });
    renderDashboard();

    const line = (await screen.findByText('Belum ada yang tercatat dalam rentang ini.')).closest('p')!;
    expect(within(line).getByRole('link', { name: 'Log Activity' })).toHaveAttribute('href', '/activity/log');
  });

  it('AC-3 says a coachee’s table by name, and a section no longer theirs with -nya, whatever their pronoun', async () => {
    stubFetch({ ...dashboardConfig, '/activity/dashboard': { body: WEEK } });
    renderInIndonesian(
      <TenantConfigProvider>
        <ActivityDashboardPanel subject={{ membershipId: 'mem-2', name: 'Rina Wijaya', pronoun: 'she', rungCode: 'AGENT' }} />
      </TenantConfigProvider>,
      { me: AGENT },
    );
    const table = await screen.findByRole('table', { name: 'Aktivitas Rina Wijaya' });
    expect(within(table).getByText('Tidak lagi ada di bagiannya')).toBeInTheDocument();
    // Nobody logs another person's day: no *Log Activity* here.
    expect(screen.queryByRole('link', { name: 'Log Activity' })).not.toBeInTheDocument();
  });

  it('AC-1, UI-106 draws a phone’s chips, total and cards in Indonesian, each column’s days in Indonesian figures', async () => {
    asPhone();
    stubFetch({ ...dashboardConfig, '/activity/dashboard': { body: WEEK } });
    renderDashboard();
    const cards = await screen.findByRole('region', { name: 'Aktivitas Anda' });

    expect(within(screen.getByRole('group', { name: 'Rentang' })).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['7 hari', '30 hari', 'Kustom']);
    expect(screen.getByText('Total aktivitas').parentElement).toHaveClass('bg-navy');
    expect(screen.getByRole('group', { name: 'Total per kelompok' })).toBeInTheDocument();
    const line = within(cards).getAllByRole('button')[0];
    expect(line).toHaveTextContent('Menghubungi prospek12');
    expect(document.body).not.toHaveTextContent(/sentuhan|jumlah/);
    await userEvent.click(line);
    const panel = document.getElementById(line.getAttribute('aria-controls')!)!;
    expect(within(panel).getAllByRole('term').map((t) => t.textContent).slice(0, 2)).toEqual(['Sen 28', 'Min 27']);
    noEnglishLeft();
  });
});

/* ── The Ratio tab ────────────────────────────────────────────────────────────────────────────── */

const term = (code: string, label: string, displayOrder: number) => ({ code, label, displayOrder });
const rate = (over: Record<string, unknown>) => ({
  code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', comparison: 'gte', displayUnit: 'percent',
  benchmark: 0.3, tag: { code: 'SELLING', label: 'Selling' }, sides: null,
  numerator: [term('SELL_SUBMISSION', 'Submission polis', 6)],
  denominator: [term('SELL_PRESENTATION', 'Presentasi penjualan', 4), term('SELL_FOLLOWUP', 'Follow up penjualan', 5)],
  purpose: 'Mengukur tingkat konversi aktivitas selling menjadi submission', divergesFromStandard: true,
  value: 0.0909, share: null, numeratorCount: 1, denominatorCount: 11, status: 'alert',
  ...over,
});
const balance = (over: Record<string, unknown> = {}) => rate({
  code: 'SELLING_VS_RECRUITMENT', label: 'Selling vs Recruitment', comparison: 'band', displayUnit: 'points',
  benchmark: 30, tag: { code: null, label: 'Balance' }, sides: { numerator: 'Selling', denominator: 'Recruitment' },
  numerator: [term('SELL_PRESENTATION', 'Presentasi penjualan', 4)],
  denominator: [term('RECRUIT_PRESENTATION', 'Melakukan presentasi recruitment', 7)],
  purpose: null, divergesFromStandard: false, value: 24.4, share: 62.2, status: 'success', ...over,
});
const view = (ratios: unknown[]) => ({ membershipId: 'm-1', from: '2026-08-30', to: '2026-09-28', days: 30, ratios });

const renderRatio = (body: unknown) => {
  stubFetch({ '/activity/ratios': { body } });
  renderInIndonesian(<ActivityRatioPage />, { me: AGENT });
};

describe('P18.98-T4 the Ratio tab in Indonesian (UI V1, UI-106: the shared card)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2, UI-106 says the card and a rate in Indonesian, its figure and target in Indonesian figures, the office’s words as typed', async () => {
    renderRatio(view([balance(), rate({})]));
    const card = await screen.findByRole('region', { name: 'Ratio · 30 hari terakhir' });

    expect(screen.getByText('Seberapa baik aktivitas Anda menghasilkan konversi.')).toBeInTheDocument();
    expect(card.querySelector('[data-split-bar]')).toHaveAccessibleName('Selling 62% · Recruitment 38%');
    const row = card.querySelector('[data-ratio="SELLING_SUCCESS_RATE"]') as HTMLElement;
    expect(row).toHaveTextContent('Selling success rate');
    expect(row).toHaveTextContent('Target 30%');
    expect(row).toHaveTextContent('9%');
    await userEvent.click(within(row).getByRole('button'));
    expect(row).toHaveTextContent('Apa itu ratio ini?');
    // The formula in words, the office's types as typed.
    expect(row).toHaveTextContent('Submission polis, dibagi Presentasi penjualan ditambah Follow up penjualan');
    expect(row).toHaveTextContent('KPM Anda telah menetapkan rumusnya sendiri untuk ratio ini.');
    expect(row).toHaveTextContent('Mengukur tingkat konversi aktivitas selling menjadi submission');
    noEnglishLeft();
  });

  it('AC-1, UI-106 says an office with no ratios for the reader, and a ratio with too little data, in Indonesian', async () => {
    renderRatio(view([]));
    expect(await screen.findByText('Belum ada ratio yang berlaku di sini.')).toBeInTheDocument();
  });

  it('UI-106 shows a ratio with too little data as –, said Data belum cukup', async () => {
    renderRatio(view([rate({ value: null, status: 'neutral' })]));
    const card = await screen.findByRole('region', { name: 'Ratio · 30 hari terakhir' });
    expect(card.querySelector('[data-status="none"]')).toHaveTextContent('–Data belum cukup');
  });
});

describe('P18.98-T4 /activity hands off in Indonesian', () => {
  it('names where it is taking the reader, the tab kept English', () => {
    renderInIndonesian(<ActivityIndex />, { me: AGENT });
    expect(screen.getByRole('status')).toHaveTextContent('Membuka Log Activity…');
    expect(replace).toHaveBeenCalledWith('/activity/log');
  });
});
