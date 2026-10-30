import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SummaryCards } from '@/components/personal-summary';
import { goalWordMessages } from '@/i18n/messages/goal-words';
import { summaryMessages } from '@/i18n/messages/summary';
import type { Summary } from '@/lib/summary';
import { NONE_CHASED, RINA_CHASING } from '@test/campaigns-fixtures';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, stubFetch, type StubReply } from '@test/harness';
import PersonalSummaryPage from './page';

/**
 * **P18.98-T4, Personal Summary in ID mode** (field selling; UI V1 since 2026-10-30, UI-006, UI-050 – UI-057): `/summary`
 * — its title, *Unduh* and the control row with its month and year pill — and the cards a coachee's tab draws too: the
 * date header, the goal card with the gap inside it, the sales activity targets and their tiles, the ratio card, the
 * leads that need the reader, and the six insight rules. Read in Bahasa Indonesia: our words the approved glossary's, §A.4's labels and the jargon kept English, what
 * the office typed as typed, every figure Indonesian, and no English message of the module's own left on the screen.
 * English is `page.spec.tsx`'s, unchanged but for its figures.
 */
const nav = vi.hoisted(() => ({ replace: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => '/summary',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
beforeEach(() => { nav.search = ''; });

const SUMMARY_ENGLISH = englishOnly(summaryMessages, goalWordMessages);
const noEnglishLeft = () => expect(englishShown(document.body, SUMMARY_ENGLISH)).toEqual([]);

const AGENT = makeMe({ permissions: ['personal_summary:read'] });
const M = 1_000_000 * 100;

const figures = (over: Record<string, unknown> = {}) => ({
  targetMinor: 75 * M, actualMinor: 30 * M, attainmentPct: 40, gapMinor: 45 * M, overMinor: 0,
  policiesNeeded: 3, targetMet: false, ...over,
});
const chip = (key: string, code: string, logged: number, target: number | null, attainmentPct: number | null) =>
  ({ key, code, logged, target, attainmentPct, targetMet: target !== null && logged >= target });
const activity = (over: Record<string, unknown> = {}) => ({
  from: '2026-09-01', to: '2026-09-14',
  targets: [chip('leads', 'LEADS_CONTACTED', 20, 57, 35), chip('appointments', 'SELL_PRESENTATION', 6, 17, 35), chip('closings', 'SELL_SUBMISSION', 2, 5, 40)],
  total: 1250,
  // The office's two summary tiles, in its own words (ADR-0064).
  sections: [
    { code: 'RECRUITMENT', label: 'Recruitment', total: 6, rows: [{ code: 'RECRUIT_PRESENTATION', label: 'Proses pendaftaran kode agen', count: 6 }] },
    { code: 'DEVELOPMENT', label: 'Development', total: 2, rows: [{ code: 'DEV_TEAM_ACTIVITY', label: 'Aktivitas team development', count: 2 }] },
  ],
  ...over,
});
const openLead = (over: Record<string, unknown>) => ({
  id: 'l-1', name: 'Pak Hendro Gunawan', type: 'sales', statusCode: 'FOLLOW_UP', statusLabel: 'Sudah di-follow up',
  thisMonth: false, flags: [], overdueDays: null, nextActionDate: '2026-09-20', nextActionNote: null, ...over,
});
const LEADS = [
  openLead({ id: 'l-1', thisMonth: true, flags: ['overdue', 'no-remarks'], overdueDays: 6, nextActionDate: '2026-09-08', nextActionNote: 'Kirim ilustrasi' }),
  openLead({ id: 'l-2', name: 'Ibu Wulan Sari', type: 'recruitment', statusLabel: 'Polis diajukan', nextActionDate: '2026-10-16' }),
  openLead({ id: 'l-3', name: '', type: null, statusCode: null, statusLabel: null, flags: ['no-next-action'], nextActionDate: null }),
];
const INSIGHTS = [
  { rule: 'BEHIND_PACE', kind: 'action', facts: { closingsLast30Days: 2, closingTarget: 5, neededPerWeek: 1, weeksLeft: 3 } },
  { rule: 'LEAD_OVERDUE', kind: 'action', facts: { leadId: 'l-1', name: 'Pak Heri', overdueDays: 8, others: 2 } },
  { rule: 'LEAD_NEGLECTED', kind: 'action', facts: { leadId: 'l-2', name: 'Pak Alvin', others: 1 } },
  { rule: 'RATIO_BELOW', kind: 'improve', facts: { code: 'SSR', label: 'Selling success rate', value: 0.0909, benchmark: 0.15, displayUnit: 'percent' } },
  { rule: 'RATIO_STRENGTH', kind: 'improve', facts: { code: 'LPA', label: 'Leads per activity', value: 0.6, benchmark: 0.3, displayUnit: 'decimal' } },
];
const summary = (over: Record<string, unknown> = {}) => ({
  year: '2026', month: '2026-09', today: '2026-09-14',
  period: { firstMonth: '2025-11', thisMonth: '2026-09', currentMonth: true, currentYear: true },
  goal: { set: true, savedAt: '2026-09-01T02:00:00.000Z' }, caseSizeMinor: 18 * M,
  monthly: { ...figures(), source: { provenance: 'imported', month: '2026-09' } },
  yearly: {
    ...figures({ targetMinor: 500 * M, actualMinor: 230 * M, attainmentPct: 46, gapMinor: 270 * M, policiesNeeded: 15 }),
    source: { provenance: 'corrected', month: '2026-08', correctedBy: { membershipId: 'm-s', name: 'Sari Puspita' } },
  },
  pace: { closingTarget: 10, closingsLast30Days: 21, dayOfMonth: 17, daysInMonth: 30, weeksLeft: 2, policiesNeeded: 8, neededPerWeek: 4, targetMet: false },
  policies: { source: 'activity_log', codes: ['SELL_SUBMISSION'] },
  uploadedOn: { month: '2026-09-12', year: '2026-09-12' },
  activity: { monthly: activity(), yearly: activity({ from: '2026-01-01', total: 310 }) },
  leads: { rows: LEADS, total: LEADS.length },
  insights: INSIGHTS,
  ...over,
});
const ratio = (over: Record<string, unknown>) => ({
  code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', comparison: 'gte', displayUnit: 'percent', benchmark: 0.15,
  tag: null, sides: null, numerator: [], denominator: [], purpose: null, divergesFromStandard: false, value: 0.0909,
  share: null, numeratorCount: 1, denominatorCount: 11, status: 'alert', ...over,
});
const RATIOS = {
  membershipId: 'm-1', from: '2026-08-16', to: '2026-09-14', days: 30,
  ratios: [ratio({}), ratio({ code: 'LPA', label: 'Leads per activity', displayUnit: 'decimal', benchmark: 0.3, value: 0.375, status: 'success' })],
};

const show = (body: unknown, routes: Record<string, StubReply | StubReply[]> = {}, query: Record<string, string> = {}) => {
  nav.search = new URLSearchParams(query).toString();
  const stub = stubFetch({
    '/summary': { body }, '/activity/ratios': { body: RATIOS }, 'GET /campaigns/chasing': { body: NONE_CHASED }, ...routes,
  });
  renderInIndonesian(<PersonalSummaryPage />, { me: AGENT });
  return stub;
};
const card = (name: string) => screen.findByRole('region', { name });

/** The pill's sheet: its choices in order. */
const sheetOf = async (pill: string) => {
  await userEvent.click(await screen.findByRole('button', { name: pill }));
  const sheet = await screen.findByRole('dialog');
  return within(within(sheet).getByRole('list')).getAllByRole('button').map((b) => b.textContent);
};
const foot = (goal: HTMLElement) => goal.querySelector('dl')?.textContent;

describe('P18.98-T4 Personal Summary in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2, UI-051 frames the page in Indonesian: Unduh, Bulanan | Tahunan and the month pill, the title kept, no line', async () => {
    show(summary());
    await card('Target vs. realisasi (APE)');

    expect(screen.getByRole('heading', { level: 1, name: 'Personal Summary' })).toBeInTheDocument();
    expect(screen.queryByText('Goal, aktivitas, dan leads Anda — dalam satu halaman.')).not.toBeInTheDocument();
    const [wide, compact] = screen.getAllByRole('button', { name: 'Unduh' });
    expect(wide).toHaveTextContent(/^Unduh$/);
    expect(compact).toHaveAttribute('aria-label', 'Unduh');
    const views = screen.getByRole('group', { name: 'Periode' });
    expect(within(views).getAllByRole('button').map((b) => b.textContent)).toEqual(['Bulanan', 'Tahunan']);
    expect(await sheetOf('Bulan: Sep 2026')).toEqual([
      'Sep 2026', 'Agu 2026', 'Jul 2026', 'Jun 2026', 'Mei 2026', 'Apr 2026', 'Mar 2026', 'Feb 2026', 'Jan 2026', 'Des 2025', 'Nov 2025',
    ]);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Bulan');
    noEnglishLeft();
  });

  it('AC-2, UI-054, UI-006 the date header and the goal card: the figure, its marker, the bar, the gap inside it', async () => {
    show(summary());
    const goal = await card('Target vs. realisasi (APE)');

    expect(goal.querySelector('[data-date-header]')).toHaveTextContent('12 Sep 2026sisa 16 hari bulan ini');
    expect(goal).toHaveTextContent('Rp 30 jt');
    expect(goal).toHaveTextContent('dari target Rp 75 jt');
    expect(within(goal).getByText('40%')).toBeInTheDocument();
    expect(within(goal).getByRole('button', { name: 'Dari unggahan KPM Anda, Sep 2026' })).toBeInTheDocument();
    // UI-006: *Sisa bulan ini* | *Polis yang dibutuhkan ± 3 polis*; the pace box is gone (UI-054).
    expect(foot(goal)).toBe('Sisa bulan iniRp 45 jtPolis yang dibutuhkan± 3 polis');
    expect(screen.queryByText(/laju Anda saat ini/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Selisih' })).not.toBeInTheDocument();
    noEnglishLeft();
  });

  it('UI-054 the date header on the last day of the month, and on Tahunan, in Indonesian', async () => {
    show(summary({ today: '2026-09-30', uploadedOn: { month: '2026-09-30', year: '2026-09-30' } }));
    const goal = await card('Target vs. realisasi (APE)');
    expect(goal.querySelector('[data-date-header]')).toHaveTextContent('30 Sep 2026hari terakhir bulan ini');
    await userEvent.click(screen.getByRole('button', { name: 'Tahunan' }));
    expect((await card('Target vs. realisasi (APE)')).querySelector('[data-date-header]'))
      .toHaveTextContent('30 Sep 2026sisa 92 hari tahun ini');
    noEnglishLeft();
  });

  it('AC-2, AC-4, UI-052 the targets: the stages kept, the tiles and activities as the office typed them, the source', async () => {
    show(summary());
    const targets = await card('Target aktivitas penjualan Anda');

    expect(targets).toHaveTextContent('Dari Goal Settings — janji temu dan closings adalah target pipeline penjualan Anda.');
    expect(within(targets).getByRole('link', { name: 'Goal Settings' })).toHaveAttribute('href', '/goals');
    expect(targets).toHaveTextContent('Set appointment20 / 57');
    expect(within(targets).getByRole('progressbar', { name: 'Submission polis terhadap target' }))
      .toHaveAttribute('aria-valuetext', '2 dari 5');
    expect(targets.querySelector('[data-activity-total]')).toHaveTextContent('1.250 aktivitas bulan ini');
    expect(within(targets).getByRole('button', {
      name: 'Submission polis adalah polis yang Anda catat di Log Activity; APE berasal dari unggahan produksi.',
    })).toBeInTheDocument();
    const phone = targets.querySelector('[data-breakdown="phone"]') as HTMLElement;
    expect(within(phone).getAllByRole('button').map((b) => b.textContent)).toEqual(['Aktivitas Recruitment6', 'Aktivitas Development2']);
    await userEvent.click(within(phone).getAllByRole('button')[0]);
    const sheet = await screen.findByRole('dialog', { name: 'Aktivitas Recruitment' });
    expect(within(sheet).getByRole('listitem')).toHaveTextContent('Proses pendaftaran kode agen6');
    noEnglishLeft();
  });

  it('AC-2, UI-053 the ratio card: its header Indonesian, each ratio’s name the office’s, the figures Indonesian', async () => {
    show(summary());
    const ratios = await card('Ratio · 30 hari terakhir');

    expect(await within(ratios).findByText('Selling success rate')).toBeInTheDocument();
    expect(ratios).toHaveTextContent('9%');
    expect(ratios).toHaveTextContent('Leads per activityTarget 0,300,38');
    noEnglishLeft();
  });

  it('AC-2, AC-4 the leads that need the reader: our words Indonesian, a lead’s name, status and note as typed', async () => {
    show(summary());
    const leads = await card('Leads yang perlu perhatian Anda');

    expect(within(leads).getByText('Leads terbuka Anda, tanggal terdekat lebih dulu')).toBeInTheDocument();
    const [late, recruit, unnamed] = within(leads).getAllByRole('listitem');
    expect(late).toHaveTextContent('Sales · Sudah di-follow up');
    expect(within(late).getByText('Closes this month')).toBeInTheDocument();
    expect(within(late).getByText('Terlambat 6 hari')).toBeInTheDocument();
    expect(within(late).getByText('Tanpa keterangan')).toBeInTheDocument();
    expect(late).toHaveTextContent('8 Sep — Kirim ilustrasi');
    expect(recruit).toHaveTextContent('Recruit · Polis diajukan');
    expect(recruit).toHaveTextContent('16 Okt');
    expect(unnamed).toHaveTextContent('(tanpa nama)');
    expect(unnamed).toHaveTextContent('Tanpa jenis · Belum ada status');
    expect(within(unnamed).getByText('Tanpa tindakan berikutnya')).toBeInTheDocument();
    expect(unnamed).toHaveTextContent('Tanggal belum diatur');
    // UI-006 (owner): *Campaign yang Anda kejar*.
    expect(await card('Campaign yang Anda kejar')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-3 the insights: each rule a whole Indonesian sentence, its screen a link, the badge Berbasis AI', async () => {
    show(summary());
    const next = await card('Langkah berikutnya');
    const items = within(next).getAllByRole('listitem');

    expect(within(next).getByText('Berbasis AI')).toBeInTheDocument();
    expect(items[0]).toHaveTextContent(
      'Anda tertinggal dari laju yang dibutuhkan — dengan laju ini Anda akan closing 2 dari 5 bulan ini. Sekitar 1 polis '
      + 'seminggu selama 3 minggu yang tersisa cukup untuk mengejar ketertinggalan.',
    );
    expect(items[1]).toHaveTextContent(
      'Tindakan berikutnya untuk Pak Heri sudah terlambat 8 hari — jadwalkan ulang atau atur tanggal baru minggu ini di '
      + 'Leads Management. 2 leads Anda yang lain juga terlambat.',
    );
    expect(within(items[1]).getByText('Pak Heri').tagName).toBe('STRONG');
    expect(within(items[1]).getByRole('link', { name: 'Leads Management' })).toHaveAttribute('href', '/leads');
    expect(items[2]).toHaveTextContent(
      'Pak Alvin belum punya tindakan berikutnya maupun keterangan — lakukan follow up dan catat hasilnya agar lead ini '
      + 'tidak mandek. 1 lead lain juga belum punya keduanya.',
    );

    const improve = await card('Cara meningkatkan performa Anda');
    expect(improve).toHaveTextContent(
      'Selling success rate sebesar 9% dalam 30 hari terakhir, di bawah benchmark-nya sebesar 15% — di tahap itulah '
      + 'aktivitas Anda belum menghasilkan konversi. Activity Ratios menunjukkan apa yang dihitungnya.',
    );
    expect(within(improve).getByRole('link', { name: 'Activity Ratios' })).toHaveAttribute('href', '/activity/ratio');
    expect(improve).toHaveTextContent(
      'Leads per activity adalah kekuatan nyata — 0,60 dalam 30 hari terakhir, jauh di atas benchmark-nya sebesar 0,30.',
    );
    noEnglishLeft();
  });

  it('AC-3 a quiet logging window, a reader who never logged, and the month’s last week', async () => {
    show(summary({
      insights: [
        { rule: 'NOTHING_LOGGED', kind: 'action', facts: { windowDays: 7, lastLoggedOn: '2026-09-01' } },
        { rule: 'BEHIND_PACE', kind: 'action', facts: { closingsLast30Days: 0, closingTarget: 3, neededPerWeek: 3, weeksLeft: 1 } },
      ],
    }));
    const next = await card('Langkah berikutnya');
    expect(next).toHaveTextContent(
      'Tidak ada yang dicatat dalam 7 hari terakhir — catatan terakhir Anda pada 1 Sep. Setiap angka di halaman ini '
      + 'bersumber dari apa yang Anda catat di Log Activity.',
    );
    expect(within(next).getByRole('link', { name: 'Log Activity' })).toHaveAttribute('href', '/activity/log');
    expect(next).toHaveTextContent('Sekitar 3 polis di minggu yang tersisa cukup untuk mengejar ketertinggalan.');
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show(summary({ insights: [{ rule: 'NOTHING_LOGGED', kind: 'action', facts: { windowDays: 7, lastLoggedOn: null } }] }));
    expect(await card('Langkah berikutnya')).toHaveTextContent(
      'Anda belum mencatat aktivitas apa pun — beberapa menit di Log Activity setiap hari adalah sumber setiap angka di '
      + 'halaman ini.',
    );
    noEnglishLeft();
  });

  it('AC-1 switches to the year, in Indonesian: the year pill, the year to date as of its month, the year’s gap', async () => {
    show(summary());
    await card('Target vs. realisasi (APE)');
    await userEvent.click(screen.getByRole('button', { name: 'Tahunan' }));

    expect(screen.getByRole('button', { name: 'Tahun: 2026' })).toBeInTheDocument();
    const goal = await card('Target vs. realisasi (APE)');
    expect(goal).toHaveTextContent('Rp 230 jt');
    expect(within(goal).getByRole('button', { name: 'Dikoreksi oleh Sari Puspita, sejak awal tahun per Agu 2026' }))
      .toBeInTheDocument();
    expect(foot(goal)).toBe('Sisa tahun iniRp 270 jtPolis yang dibutuhkan± 15 polis');
    expect(await card('Target aktivitas penjualan Anda')).toHaveTextContent('310 aktivitas tahun ini');
    noEnglishLeft();
  });

  it('AC-1 says a target reached, and asks for nothing (ADR-0047)', async () => {
    show(summary({
      monthly: { ...figures({ actualMinor: 95 * M, attainmentPct: 127, gapMinor: 0, overMinor: 20 * M, policiesNeeded: 0, targetMet: true }), source: null },
      pace: { closingTarget: 5, closingsLast30Days: 6, dayOfMonth: 20, daysInMonth: 30, weeksLeft: 2, policiesNeeded: 0, neededPerWeek: 0, targetMet: true },
    }));
    const goal = await card('Target vs. realisasi (APE)');
    expect(foot(goal)).toBe('Sisa bulan iniTercapai — lebih Rp 20 jtPolis yang dibutuhkanTidak ada');
    noEnglishLeft();
  });

  it('AC-1 a year made before this month began, in Indonesian', async () => {
    show(summary({
      monthly: { targetMinor: 0, actualMinor: 30 * M, attainmentPct: null, gapMinor: 0, overMinor: 30 * M, policiesNeeded: 0, targetMet: true, source: { provenance: 'imported', month: '2026-09' } },
      pace: { closingTarget: 0, closingsLast30Days: 4, dayOfMonth: 14, daysInMonth: 30, weeksLeft: 3, policiesNeeded: 0, neededPerWeek: 0, targetMet: true },
    }));
    const goal = await card('Target vs. realisasi (APE)');
    expect(goal).toHaveTextContent('Target tahunan Anda sudah tercapai sebelum bulan ini dimulai — bulan ini tidak memerlukan apa-apa lagi.');
    expect(goal).toHaveTextContent('Tercapai — lebih Rp 30 jt');
  });

  it('AC-1 no goal, and a goal with no APE target: said in Indonesian, with the way to Goal Settings', async () => {
    show(summary({ goal: { set: false, savedAt: null }, pace: null }));
    expect(await screen.findByText('Anda belum mengatur goal untuk 2026, jadi belum ada yang bisa diukur.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Atur goal Anda' })).toHaveAttribute('href', '/goals');
    noEnglishLeft();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show(summary({
      monthly: { ...figures({ targetMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }), source: null },
      yearly: { ...figures({ targetMinor: null, attainmentPct: null, gapMinor: null, policiesNeeded: null }), source: { provenance: 'self_reported', month: null } },
      pace: null,
    }));
    expect(await screen.findByText('Goal Anda untuk 2026 belum memiliki target APE sebagai ukuran.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buka Goal Settings' })).toHaveAttribute('href', '/goals');
  });

  it('AC-1 the empty cards: no leads, the unit’s in Leads Management, no ratios, and nothing to act on', async () => {
    show(summary({ leads: { rows: [], total: 0, unitOpen: 71 }, insights: [] }), { '/activity/ratios': { body: { ...RATIOS, ratios: [] } } });
    const leads = await card('Leads yang perlu perhatian Anda');
    expect(leads).toHaveTextContent('Tidak ada leads terbuka milik Anda sendiri — leads unit Anda ada di Leads Management.');
    expect(within(leads).getByRole('link', { name: 'Leads Management' })).toHaveAttribute('href', '/leads');
    expect(await screen.findByText('Belum ada ratio yang berlaku di sini.')).toBeInTheDocument();
    expect(await card('Langkah berikutnya')).toHaveTextContent(
      'Belum ada yang perlu ditindaklanjuti dari angka Anda saat ini — terus mencatat, dan hasilnya akan muncul di sini.',
    );
    noEnglishLeft();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show(summary({ leads: { rows: [], total: 0, unitOpen: 0 } }));
    expect(await card('Leads yang perlu perhatian Anda')).toHaveTextContent('Belum ada leads aktif — tambahkan di Leads Management.');
  });

  it('AC-1, UI-054 an earlier month, in Indonesian: its upload’s date only, its own target, no gap, the activities pada its month', async () => {
    const august = summary({
      month: '2026-08', pace: null, period: { firstMonth: '2025-11', thisMonth: '2026-09', currentMonth: false, currentYear: true },
      uploadedOn: { month: '2026-09-03', year: '2026-09-03' },
      activity: { monthly: activity({ from: '2026-08-01', to: '2026-08-31', total: 37 }), yearly: activity() },
    });
    show(august, { '/summary?month=2026-08': { body: august } }, { month: '2026-08' });
    const goal = await card('Target vs. realisasi (APE)');

    expect(screen.getByRole('button', { name: 'Bulan: Agu 2026' })).toBeInTheDocument();
    expect(goal.querySelector('[data-date-header]')!.textContent).toBe('3 Sep 2026');
    expect(foot(goal)).toBeUndefined();
    expect(await card('Target aktivitas penjualan Anda')).toHaveTextContent('37 aktivitas pada Agu 2026');
    noEnglishLeft();
  });

  it('AC-1 a year that has ended with no goal, in Indonesian, and nothing offered', async () => {
    const last = summary({
      year: '2025', month: '2025-12', pace: null, goal: { set: false, savedAt: null },
      period: { firstMonth: '2025-11', thisMonth: '2026-09', currentMonth: false, currentYear: false },
    });
    show(last, { '/summary?year=2025': { body: last } }, { year: '2025' });

    expect(await screen.findByText('Anda tidak mengatur goal untuk 2025, jadi tidak ada yang bisa diukur.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Atur goal Anda' })).not.toBeInTheDocument();
    expect(await card('Target aktivitas penjualan Anda')).toHaveTextContent('310 aktivitas pada 2025');
  });

  it('AC-1 waits in Indonesian, and downloads under the kept title with the month in Indonesian', async () => {
    stubFetch({ '/summary': () => new Promise(() => undefined) as never, '/activity/ratios': { body: RATIOS } });
    renderInIndonesian(<PersonalSummaryPage />, { me: AGENT });
    expect(screen.getByRole('status')).toHaveTextContent('Menyusun ringkasan Anda…');
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    const titles: string[] = [];
    vi.stubGlobal('print', vi.fn(() => { titles.push(document.title); window.dispatchEvent(new Event('afterprint')); }));
    show(summary());
    await card('Target vs. realisasi (APE)');
    await userEvent.click(screen.getAllByRole('button', { name: 'Unduh' })[0]);
    expect(titles).toEqual(['Personal Summary – Sep 2026']);
  });
});

/**
 * **A coachee's *Personal Summary* tab** (P11-T7 AC-4): the same cards about somebody else — *dia* and *-nya* whatever
 * their pronoun (T4 AC-3), the prototype's coaching words, nothing linking to the reader's own screens, and no word
 * naming the office (ADR-0084, in Indonesian too).
 */
describe('P18.98-T4 a coachee’s Personal Summary in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  const cards = (body: unknown, pronoun: 'she' | 'he' | 'they', pulse = true) => {
    stubFetch({ 'GET /campaigns/chasing': { body: RINA_CHASING } });
    renderInIndonesian(
      <SummaryCards
        summary={body as Summary}
        view="month"
        pulse={pulse ? { ratios: RATIOS as never, error: null } : undefined}
        subject={{ membershipId: 'mem-rina', pronoun }}
      />,
      { me: AGENT },
    );
  };

  it.each(['she', 'he', 'they'] as const)('AC-3 writes the coachee as dia and -nya whatever their pronoun (%s)', async (pronoun) => {
    cards(summary({
      monthly: { ...figures(), source: { provenance: 'imported', month: '2026-09' } },
      insights: [{ rule: 'NOTHING_LOGGED', kind: 'action', facts: { windowDays: 7, lastLoggedOn: '2026-09-04' } }, ...INSIGHTS.slice(1)],
    }), pronoun);

    const targets = await card('Target aktivitas penjualannya');
    expect(targets).toHaveTextContent('janji temu dan closings adalah target pipeline penjualannya.');
    expect(within(targets).getByRole('button', {
      name: 'Submission polis adalah polis yang dia catat di Log Activity; APE berasal dari unggahan produksi.',
    })).toBeInTheDocument();
    const goal = await card('Target vs. realisasi (APE)');
    expect(within(goal).getByRole('button', { name: 'Dari unggahan produksi, Sep 2026' })).toBeInTheDocument();
    expect(foot(goal)).toBe('Sisa bulan iniRp 45 jtPolis yang dibutuhkan± 3 polis');
    const leads = await card('Leads yang perlu perhatiannya');
    expect(within(leads).getByText('Semua leads aktif, tanggal terdekat lebih dulu')).toBeInTheDocument();
    // A lead with no type is said without one about a coachee.
    expect(within(leads).getAllByRole('listitem')[2]).toHaveTextContent('Belum ada status');
    expect(within(leads).getAllByRole('listitem')[2]).not.toHaveTextContent('Tanpa jenis');
    expect(await card('Campaign yang dia kejar')).toBeInTheDocument();
    const next = await card('Langkah berikutnya');
    expect(next).toHaveTextContent(
      'Tidak ada yang dicatat dalam 7 hari terakhir — catatan terakhirnya pada 4 Sep. Setiap angka di halaman ini '
      + 'bersumber dari apa yang dia catat.',
    );
    expect(next).toHaveTextContent('jadwalkan ulang atau atur tanggal baru minggu ini. 2 leads-nya yang lain juga terlambat.');
    expect(await card('Cara meningkatkan performanya')).toHaveTextContent('di tahap itulah aktivitasnya belum menghasilkan konversi.');
    // Nothing links to the reader's own screens but the coachee's Goal Setting tab.
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/coaching/mem-rina/goal-setting']);
    expect(document.body.textContent).not.toMatch(/\bKPM\b/);
    noEnglishLeft();
  });

  it('AC-3 the coachee’s empty and waiting states, and the ratios’ sign where no read serves it', async () => {
    cards(summary({ goal: { set: false, savedAt: null }, pace: null, leads: { rows: [], total: 0 }, insights: [] }), 'he', false);

    expect(await screen.findByText('Dia belum mengatur goal untuk 2026, jadi belum ada yang bisa diukur.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Atur goal-nya' })).toHaveAttribute('href', '/coaching/mem-rina/goal-setting');
    expect(screen.getByText('Ratio penjualan dan recruitment-nya dalam 30 hari terakhir, masing-masing terhadap benchmark-nya.'))
      .toBeInTheDocument();
    expect(await card('Leads yang perlu perhatiannya')).toHaveTextContent('Tidak ada leads aktif.');
    expect(await card('Langkah berikutnya')).toHaveTextContent('Belum ada yang perlu ditindaklanjuti dari angkanya saat ini.');
    expect(document.body.textContent).not.toMatch(/\bKPM\b/);
    noEnglishLeft();
  });
});
