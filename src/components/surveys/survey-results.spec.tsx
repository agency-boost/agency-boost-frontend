import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { Me } from '@/lib/session';
import type {
  NpsLine, NpsResults, QualResults, RunView, SurveyPeople, SurveyPersonAnswers, SurveyResults,
} from '@/lib/surveys';
import { atWidth, makeMe, renderInIndonesian, stubFetch, type StubReply } from '@test/harness';
import { SurveyResultsScreen } from './survey-results';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/advanced-analytics/nps',
  useSearchParams: () => new URLSearchParams(),
}));

const OWNER: Me = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 3,
  },
});

const run = (over: Partial<RunView>): RunView => ({
  runId: 'run-q3', kind: 'nps', periodKey: '2026-Q3', opensOn: '2026-08-01', closesOn: '2026-08-20', state: 'closed',
  invitedRoleClasses: ['agent', 'aab', 'ab'], anonymous: true, perPerson: false, remindHalfway: true,
  responses: { sent: 19, invited: 30, pct: 63, leaders: 7, agents: 12 }, headlineScore: 62, ...over,
});
const line = (kode: string, text: string, score: number | null, over: Partial<NpsLine> = {}): NpsLine => ({
  kode, text: { id: text, en: text }, aspect: kode, score, n: 19, change: -2, textChanged: false,
  shares: score === null ? null : { promoterPct: 53, passivePct: 29, detractorPct: 18 },
  trend: [40, 45, 37, score], reasons: [], ...over,
});
const NPS: NpsResults = {
  cutoffs: { promoterMin: 9, passiveMin: 7 },
  who: 'all',
  whoShown: true,
  respondents: 19,
  headline: line('P1', 'Seberapa besar kemungkinan Anda merekomendasikan KPM ini?', 62, {
    change: 5, shares: { promoterPct: 69, passivePct: 24, detractorPct: 7 }, trend: [51, 57, 57, 62],
  }),
  questions: [
    line('P2', 'Visi jelas & menginspirasi', 35, {
      reasons: [
        { text: 'Visi hanya slogan, belum diturunkan oleh leader.', who: 'agent' },
        { text: 'Kami belum punya rencana bulanan yang turun dari visi.', who: 'leader' },
      ],
    }),
    line('P4', 'Kekompakan', 49, { change: 3, reasons: [{ text: 'Antar unit jalan sendiri-sendiri.', who: null }] }),
  ],
  trendPeriods: ['2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3'],
  improve: [{ text: 'Forum leader lebih rutin.', who: 'leader' }],
};
const SEND = (over: Partial<SurveyResults['send']> = {}): SurveyResults['send'] => ({
  periodKey: '2026-Q4', opensOn: '2026-11-20', closesOnMax: '2026-12-31', invitable: 30,
  run: null, notAnswered: null, minutes: 3,
  preview: [
    { kodes: ['P1'], text: { id: 'Seberapa besar kemungkinan Anda merekomendasikan KPM ini ke teman?', en: '' }, type: 'score', audience: 'all', items: 0 },
    { kodes: ['P2'], text: { id: 'Visi KPM jelas & menginspirasi', en: '' }, type: 'score', audience: 'all', items: 0 },
    { kodes: ['OPEN'], text: { id: 'Apa satu hal yang paling ingin Anda perbaiki?', en: '' }, type: 'text', audience: 'all', items: 0 },
  ],
  ...over,
});
const RESULTS = (over: Partial<SurveyResults> = {}): SurveyResults => ({
  kind: 'nps', today: '2026-11-20', visible: true, sectionOn: true, canWrite: true, audience: 'office', who: 'all',
  template: { cadence: 'quarter', qualMonths: [6, 12], defaults: { anonymous: true, perPerson: false, remindHalfway: true } },
  runs: [run({}), run({ runId: 'run-q2', periodKey: '2026-Q2', headlineScore: 57, responses: { sent: 17, invited: 31, pct: 55, leaders: 6, agents: 11 } })],
  selected: { ...run({}), previousRunId: 'run-q2', nps: NPS, qual: null },
  send: SEND(),
  ...over,
});

function show(results: SurveyResults, kind: 'nps' | 'qual' = 'nps', extra: Record<string, StubReply | StubReply[]> = {}, width = 1280) {
  atWidth(width);
  const stub = stubFetch({ [`GET /kpm/advanced-analytics/${kind}`]: { body: results }, ...extra });
  const view = renderInIndonesian(<SurveyResultsScreen kind={kind} />, { me: OWNER });
  return { ...stub, ...view };
}

describe('P19.22-T6 NPS (ADR-0276 §1–§3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.22-T6 AC-1 the controls: Hasil | Survei baru, the quarter, Semua | Leader | Agent', async () => {
    show(RESULTS());
    const views = await screen.findByRole('group', { name: 'Tampilan' });
    expect(within(views).getAllByRole('button').map((b) => b.textContent)).toEqual(['Hasil', 'Survei baru']);
    expect(within(views).getByRole('button', { name: 'Hasil' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('combobox', { name: 'Periode survei' })).toHaveDisplayValue('Q3 2026');
    expect(within(screen.getByRole('group', { name: 'Yang menjawab' })).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['Semua', 'Leader', 'Agent']);
  });

  it('P19.22-T6 AC-2 Keseluruhan KPM in its navy card: the score, the change in poin, the bar and the response line', async () => {
    show(RESULTS());
    const card = (await screen.findByText('Keseluruhan KPM · Semua')).closest('section')!;
    expect(card).toHaveTextContent('62%');
    expect(card).toHaveTextContent('▲ +5 poin');
    expect(within(card).getByRole('img', { name: '69% promoter, 24% passive, 7% detractor' })).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: /^Tren: 51% → 57% → 57% → 62%$/ })).toBeInTheDocument();
    expect(card).toHaveTextContent('Diundang 30 · Menjawab 19 (7 leader, 12 agent) · Response rate 63%');
  });

  it('P19.22-T6 AC-2 one row per question, lowest first; the first open with its reasons tagged Leader / Agent; a tap moves them', async () => {
    const user = userEvent.setup();
    show(RESULTS());
    const rows = await screen.findAllByRole('button', { pressed: false });
    expect(document.querySelectorAll('[data-nps-question]')[0]).toHaveAttribute('data-nps-question', 'P2');
    expect(screen.getByRole('button', { name: /Visi jelas & menginspirasi/ })).toHaveAttribute('aria-pressed', 'true');
    const reasons = document.querySelector('[data-nps-reasons="P2"]')!;
    expect(reasons).toHaveTextContent('Kenapa mereka memberi nilai ini');
    expect(reasons).toHaveTextContent('2 jawaban · Semua');
    expect(within(reasons as HTMLElement).getByText('Agent')).toBeInTheDocument();
    expect(within(reasons as HTMLElement).getByText('“Kami belum punya rencana bulanan yang turun dari visi.”')).toBeInTheDocument();
    expect(rows.length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /Kekompakan/ }));
    expect(document.querySelector('[data-nps-reasons="P4"]')).toHaveTextContent('Antar unit jalan sendiri-sendiri.');
    expect(screen.getByText('Promoter 9–10')).toBeInTheDocument();
    expect(screen.getByText('Passive 7–8')).toBeInTheDocument();
    expect(screen.getByText('Detractor 0–6')).toBeInTheDocument();
    expect(screen.getByText('Tren: Q4 ’25 → Q3 ’26')).toBeInTheDocument();
  });

  it('P19.22-T6 AC-2 the headline’s panel shows what respondents would improve, in their own words (no AI)', async () => {
    const user = userEvent.setup();
    show(RESULTS());
    await user.click(await screen.findByRole('button', { name: /Keseluruhan KPM · Semua/ }));
    const panel = document.querySelector('[data-nps-reasons="P1"]')!;
    expect(panel).toHaveTextContent('Yang ingin mereka perbaiki');
    expect(panel).toHaveTextContent('Apa satu hal yang paling ingin Anda perbaiki?');
    expect(panel).toHaveTextContent('Forum leader lebih rutin.');
    expect(document.body).not.toHaveTextContent('AI');
  });

  it('P19.22-T6 AC-1 Leader asks the server for the leaders’ view; a view too small to show says so', async () => {
    const user = userEvent.setup();
    const hidden: NpsResults = {
      ...NPS, who: 'leader', whoShown: false, respondents: 2, improve: null,
      headline: line('P1', 'Rekomendasi', null, { reasons: null, change: null }), questions: [line('P2', 'Visi', null, { reasons: null })],
    };
    const { calls } = show(RESULTS(), 'nps', {
      'GET /kpm/advanced-analytics/nps?who=leader': { body: RESULTS({ who: 'leader', selected: { ...run({}), previousRunId: null, nps: hidden, qual: null } }) },
    });
    await user.click(await screen.findByRole('button', { name: 'Leader' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/kpm/advanced-analytics/nps?who=leader'))).toBe(true));
    expect(await screen.findByText('Keseluruhan KPM · Leader')).toBeInTheDocument();
    expect(screen.getAllByText('Jawaban terlalu sedikit untuk dilihat per kelompok — survei tetap anonim.').length).toBeGreaterThan(0);
  });

  it('part C on a phone the reasons open right under the tapped row', async () => {
    const user = userEvent.setup();
    show(RESULTS(), 'nps', {}, 390);
    const kompak = await screen.findByRole('button', { name: /Kekompakan/ });
    expect(kompak).toHaveAttribute('aria-expanded', 'false');
    await user.click(kompak);
    expect(kompak).toHaveAttribute('aria-expanded', 'true');
    expect(kompak.closest('li')!.querySelector('[data-nps-reasons="P4"]')).not.toBeNull();
  });

  it('P19.22-T6 AC-3 Survei baru: the preview, Kirim ke 30 anggota with the closing day, then the period’s run', async () => {
    const user = userEvent.setup();
    const sent = RESULTS({ send: SEND({ run: run({ runId: 'run-q4', periodKey: '2026-Q4', state: 'open', closesOn: '2026-12-15', responses: { sent: 12, invited: 30, pct: 40, leaders: 4, agents: 8 } }) }) });
    const { calls } = show(RESULTS(), 'nps', {
      'POST /kpm/advanced-analytics/surveys/runs': { status: 201, body: sent.send.run },
      'GET /kpm/advanced-analytics/nps': [{ body: RESULTS() }, { body: sent }],
    });
    await user.click(await screen.findByRole('button', { name: 'Survei baru' }));
    const send = document.querySelector('[data-survey-send="nps"]')!;
    expect(send).toHaveTextContent('Pratinjau survei');
    expect(send).toHaveTextContent('3 pertanyaan · ±3 menit');
    expect(send).toHaveTextContent('Visi KPM jelas & menginspirasi (0–10)');
    expect(send).toHaveTextContent('Apa satu hal yang paling ingin Anda perbaiki? (teks, opsional)');
    const closes = screen.getByLabelText('Atur tanggal tutup');
    expect(closes).toHaveValue('2026-12-31');
    await user.clear(closes);
    await user.type(closes, '2026-12-15');
    await user.click(screen.getByRole('button', { name: 'Kirim ke 30 anggota' }));
    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(String(post.init.body))).toEqual({
      kind: 'nps', opensOn: '2026-11-20', closesOn: '2026-12-15', invitedRoleClasses: ['agent', 'aab', 'ab'], anonymous: true,
      perPerson: false, remindHalfway: true,
    });
    expect(await screen.findByText('Tutup: 15 Des 2026')).toBeInTheDocument();
  });

  it('P19.22-T6 AC-3 live progress in the navy panel, Belum menjawab with Ingatkan n orang on WhatsApp, past runs', async () => {
    const user = userEvent.setup();
    const waiting = ['Dewi Lestari', 'Lukman Hakim', 'Putri Anggraini', 'Raka Aditama', 'Sinta Dewi'].map((name, i) => ({
      membershipId: `m-${i}`, name, roleClass: i === 0 ? 'aab' as const : 'agent' as const,
    }));
    show(RESULTS({
      send: SEND({
        run: run({ runId: 'run-q4', periodKey: '2026-Q4', state: 'open', closesOn: '2026-12-15', responses: { sent: 12, invited: 30, pct: 40, leaders: 4, agents: 8 } }),
        notAnswered: waiting,
      }),
    }));
    await user.click(await screen.findByRole('button', { name: 'Survei baru' }));
    const panel = document.querySelector('[data-response-panel]')!;
    expect(panel).toHaveTextContent('Sudah menjawab');
    expect(panel).toHaveTextContent('40%');
    expect(panel).toHaveTextContent('12 dari 30 menjawab');
    expect(panel).toHaveTextContent('4 leader · 8 agent');
    expect(screen.getByText('Belum menjawab · 5')).toBeInTheDocument();
    const remind = screen.getByRole('link', { name: 'Ingatkan 5 orang' });
    const text = decodeURIComponent(remind.getAttribute('href')!.split('?text=')[1]);
    expect(remind.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(text).toContain('Survei NPS KPM Q4 2026');
    expect(text).toContain('Dewi Lestari, Lukman Hakim, Putri Anggraini, Raka Aditama, Sinta Dewi');
    expect(screen.queryByText('Sinta Dewi')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Lihat semua (5) ›' }));
    expect(screen.getByText('Sinta Dewi')).toBeInTheDocument();
    const earlier = document.querySelector('[data-previous-run="run-q3"]')!;
    expect(earlier).toHaveTextContent('Q3 2026');
    expect(earlier).toHaveTextContent('NPS 62%');
    expect(earlier).toHaveTextContent('19 menjawab · 63%');
  });

  it('A-R9 a summary — a view-as session — sends nothing', async () => {
    const user = userEvent.setup();
    show(RESULTS({ canWrite: false, audience: 'summary' }));
    await user.click(await screen.findByRole('button', { name: 'Survei baru' }));
    expect(screen.queryByRole('button', { name: /Kirim ke/ })).toBeNull();
    expect(screen.getByText('Mode lihat: mengirim survei tidak tersedia.')).toBeInTheDocument();
  });

  it('every state: no run yet, the section off, an error', async () => {
    show(RESULTS({ selected: null, runs: [] }));
    expect(await screen.findByText('Belum ada survei yang dikirim. Buka Survei baru untuk mengirim yang pertama.')).toBeInTheDocument();
    vi.unstubAllGlobals();
    show(RESULTS({ visible: false }));
    expect(await screen.findAllByText('Survei ini dimatikan di template KPM.')).not.toHaveLength(0);
  });

  it('axe: the NPS tab, populated', async () => {
    const { container } = show(RESULTS());
    await screen.findByText('Keseluruhan KPM · Semua');
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------- Kualitatif

const QUAL: QualResults = {
  who: 'all', whoShown: true, respondents: 19,
  cutoffs: { qualIssueMaxRating: 3, supportPromMin: 9, supportPasMin: 7 },
  profile: {
    workStatus: { fullTime: 12, partTime: 7, unknown: 0 },
    tenure: { counts: [8, 6, 3, 2], unknown: 0, bands: [3, 7, 10] },
  },
  aspiration: [
    { kode: 'TOP', label: { id: 'Ingin menjadi top producer', en: '' }, pct: 61, leaderPct: 70, agentPct: 44 },
    { kode: 'TEAM', label: { id: 'Ingin menjadi team builder yang produktif', en: '' }, pct: 50, leaderPct: 63, agentPct: 25 },
  ],
  aspirationNotes: [{ text: 'Target saya MDRT dalam 2 tahun.', who: 'agent' }],
  blocks: [
    {
      kode: 'SALES', title: { id: 'A. Penjualan', en: '' }, audience: 'all', questionKodes: ['Q5'], asked: true, respondents: 19,
      rows: [
        { questionKode: 'Q5', itemKode: 'APPOINTMENT', label: { id: 'Penjadwalan janji temu', en: '' }, kind: 'rating', answers: 19, issuePct: 57, severity: 'watch', previousPct: 59, trend: 'better', comfortPct: null },
        { questionKode: 'Q5', itemKode: 'PRODUCT', label: { id: 'Pengetahuan produk', en: '' }, kind: 'rating', answers: 19, issuePct: 30, severity: null, previousPct: 28, trend: 'worse', comfortPct: null },
      ],
    },
    {
      kode: 'RECRUIT', title: { id: 'B. Rekrutmen', en: '' }, audience: 'leader', questionKodes: ['Q6'], asked: true, respondents: 7,
      rows: [{ questionKode: 'Q6', itemKode: 'PIPELINE', label: { id: 'Leads pipeline', en: '' }, kind: 'rating', answers: 7, issuePct: 76, severity: 'big', previousPct: 78, trend: 'better', comfortPct: null }],
    },
    {
      kode: 'UNIT', title: { id: 'D. Manajemen unit', en: '' }, audience: 'leader', questionKodes: ['Q8', 'Q9'], asked: true, respondents: 7,
      rows: [{ questionKode: 'Q8', itemKode: 'ONE_ON_ONE', label: { id: 'Coaching 1-on-1', en: '' }, kind: 'state', answers: 7, issuePct: 68, severity: 'big', previousPct: 70, trend: 'better', comfortPct: 35 }],
    },
  ],
  support: [
    { rater: 'agent', n: 12, average: 7.9, satisfiedPct: 47, fairPct: 27, poorPct: 26 },
    { rater: 'leader', n: 7, average: 7.1, satisfiedPct: 36, fairPct: 20, poorPct: 44 },
  ],
  coachingDownline: {
    asked: true, n: 4, yes: 3, pct: 75, good: true,
    rows: [{ leaderId: 'm-dewi', uplineId: 'm-agus', leaderName: 'Dewi Lestari', uplineName: 'Agus', areas: ['SALES', 'ACTIVATION'], independent: false }],
  },
  voices: [{ text: 'Tidak ada pertemuan, jadi akhirnya jalan masing-masing.', who: 'agent' }],
};
const QRESULTS = (over: Partial<SurveyResults> = {}): SurveyResults => RESULTS({
  kind: 'qual',
  runs: [run({ runId: 'run-jun', kind: 'qual', periodKey: '2026-06', anonymous: false, perPerson: true, headlineScore: null })],
  selected: { ...run({ runId: 'run-jun', kind: 'qual', periodKey: '2026-06', headlineScore: null }), previousRunId: null, nps: null, qual: QUAL },
  send: SEND({ periodKey: '2026-12', opensOn: '2026-12-01', preview: [
    { kodes: ['Q4'], text: { id: 'Aspirasi jangka panjang', en: '' }, type: 'aspiration', audience: 'all', items: 4 },
    { kodes: ['Q5'], text: { id: 'A. Penjualan', en: '' }, type: 'scale_items', audience: 'all', items: 7 },
    { kodes: ['Q8', 'Q9'], text: { id: 'D. Manajemen unit', en: '' }, type: 'unit_items', audience: 'leader', items: 8 },
  ] }),
  ...over,
});

const PEOPLE = (over: Partial<SurveyPeople> = {}): SurveyPeople => ({
  today: '2026-11-20', audience: 'office',
  runs: [{ runId: 'run-jun', periodKey: '2026-06', state: 'closed' }],
  run: { runId: 'run-jun', periodKey: '2026-06', state: 'closed', anonymous: false, perPerson: true },
  answersShown: true,
  groups: [{ groupId: 'g-top', name: 'Top Producers 2026' }],
  issueMaxRating: 3,
  people: [
    { membershipId: 'm-agus', name: 'Agus Prasetyo', photoUrl: null, roleClass: 'ab', upline: 'Wilson Tanoto', groupId: 'g-top', workStatus: 'full_time', tenureYears: 6, age: 44, generation: 1, answered: true, issues: 21, canOpen: true, phone: null },
    { membershipId: 'm-dewi', name: 'Dewi Lestari', photoUrl: null, roleClass: 'aab', upline: 'Agus Prasetyo', groupId: 'g-top', workStatus: 'part_time', tenureYears: 3, age: 38, generation: 1, answered: false, issues: null, canOpen: false, phone: '+6281211002200' },
    { membershipId: 'm-yosef', name: 'Yosef Tambunan', photoUrl: null, roleClass: 'ab', upline: 'Wilson Tanoto', groupId: null, workStatus: 'full_time', tenureYears: 9, age: 50, generation: 2, answered: true, issues: 18, canOpen: false, phone: null },
  ],
  ...over,
});
const AGUS: SurveyPersonAnswers = {
  membershipId: 'm-agus', runId: 'run-jun', roleClass: 'ab',
  person: { workStatus: 'full_time', tenureYears: 6, age: 44, generation: 1 },
  issueMaxRating: 3,
  tiles: [{ kode: 'SALES', title: { id: 'A. Penjualan', en: '' }, count: 3, of: 7 }, { kode: 'RECRUIT', title: { id: 'B. Rekrutmen', en: '' }, count: 6, of: 8 }],
  aspiration: { kode: 'Q4', options: [{ kode: 'TOP', label: { id: 'Saya ingin menjadi top producer', en: '' }, chosen: true }, { kode: 'FLOW', label: { id: 'Saya ingin menjalani saja dan mengikuti alurnya', en: '' }, chosen: false }], note: 'Ingin fokus ke nasabah jangka panjang.' },
  sections: [
    { kode: 'SALES', kind: 'scale', title: { id: 'A. Penjualan', en: '' }, questionKodes: ['Q5'], items: [{ kode: 'FREQUENCY', label: { id: 'Frekuensi penjualan', en: '' }, rating: 3 }] },
    { kode: 'ACTIVATION', kind: 'state', title: { id: 'C. Aktivasi', en: '' }, questionKodes: ['Q7'], items: [{ kode: 'KPM_TRAINING', label: { id: 'Pelatihan KPM', en: '' }, state: 'not_done' }] },
    { kode: 'COACHING', kind: 'downline', title: { id: 'Coaching downline', en: '' }, questionKodes: ['Q10', 'Q11'], stillCoaching: true, leaders: [{ membershipId: 'm-dewi', name: 'Dewi Lestari', areas: [{ kode: 'SALES', label: { id: 'Penjualan', en: '' } }] }] },
  ],
  support: { kode: 'Q12', score: 8 },
};

describe('P19.22-T7 Analisa kualitatif (ADR-0276 §4, §5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.22-T7 AC-1 Hasil · Per orang · Survei baru, the month, Semua | Leader | Agent; the navy response panel', async () => {
    show(QRESULTS(), 'qual');
    const views = await screen.findByRole('group', { name: 'Tampilan' });
    expect(within(views).getAllByRole('button').map((b) => b.textContent)).toEqual(['Hasil', 'Per orang', 'Survei baru']);
    expect(screen.getByRole('combobox', { name: 'Periode survei' })).toHaveDisplayValue('Jun 2026');
    const panel = document.querySelector('[data-response-panel]')!;
    expect(panel).toHaveTextContent('Response rate');
    expect(panel).toHaveTextContent('63%');
    expect(panel).toHaveTextContent('19 dari 30 menjawab');
    expect(panel).toHaveTextContent('7 leader · 12 agent');
    expect(panel).toHaveTextContent('Belum menjawab (11)');
  });

  it('P19.22-T7 AC-2 A–D in one row format: rank, item, % masalah pill, semester lalu ▲ worse / ▼ better; what the % means', async () => {
    show(QRESULTS(), 'qual');
    const sales = (await screen.findByText('A · Penjualan')).closest('section')!;
    expect(sales).toHaveTextContent('Semua · N = 19');
    expect(sales).toHaveTextContent('% yang memberi nilai 1–3 dari 5 (agent untuk dirinya, leader untuk timnya)');
    const rows = within(sales).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('1Penjadwalan janji temu57%59%');
    expect(within(rows[0]).getByLabelText('lebih baik')).toHaveTextContent('▼');
    expect(within(rows[1]).getByLabelText('lebih buruk')).toHaveTextContent('▲');
    const unit = screen.getByText('D · Manajemen unit').closest('section')!;
    expect(unit).toHaveTextContent('tidak nyaman 35%');
    expect(unit).toHaveTextContent('Leader · N = 7');
  });

  it('P19.22-T7 AC-2 quotes only on tap: Aspirasi’s notes and Suara responden; the downline table and Dukungan leader', async () => {
    const user = userEvent.setup();
    show(QRESULTS(), 'qual');
    expect(await screen.findByText('Leader 70% · Agent 44%')).toBeInTheDocument();
    expect(screen.queryByText('“Target saya MDRT dalam 2 tahun.”')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Lihat catatan responden (1) ›' }));
    expect(screen.getByText('“Target saya MDRT dalam 2 tahun.”')).toBeInTheDocument();
    const voice = screen.getByRole('button', { name: /Tidak ada pertemuan/ });
    expect(voice).toHaveAttribute('aria-expanded', 'false');
    await user.click(voice);
    expect(voice).toHaveAttribute('aria-expanded', 'true');
    const coaching = document.querySelector('[data-qual-coaching]')!;
    expect(coaching).toHaveTextContent('3 dari 4');
    expect(coaching).toHaveTextContent('Dewi Lestari');
    expect(within(coaching as HTMLElement).getByRole('img', { name: 'Jual: masih di-coach' })).toBeInTheDocument();
    expect(coaching).toHaveTextContent('Belum mandiri');
    const support = document.querySelector('[data-qual-support]')!;
    expect(support).toHaveTextContent('Agent menilai leader');
    expect(support).toHaveTextContent('7,9/10');
    expect(support).toHaveTextContent('Leader menilai upline');
  });

  it('P19.22-T7 AC-2 Agent: the leader blocks say they were asked of leaders only', async () => {
    const user = userEvent.setup();
    const agents: QualResults = {
      ...QUAL, who: 'agent', support: [QUAL.support[0]], voices: null,
      coachingDownline: { asked: false, n: 0, yes: null, pct: null, good: null, rows: null },
      blocks: QUAL.blocks.map((b) => (b.audience === 'leader' ? { ...b, asked: false, respondents: 0, rows: [] } : b)),
    };
    show(QRESULTS(), 'qual', {
      'GET /kpm/advanced-analytics/qual?runId': { body: QRESULTS() },
      'GET /kpm/advanced-analytics/qual?who=agent': { body: QRESULTS({ who: 'agent', selected: { ...QRESULTS().selected!, qual: agents } }) },
    });
    await user.click(await screen.findByRole('button', { name: 'Agent' }));
    expect(await screen.findAllByText('Pertanyaan ini hanya ditanyakan ke leader.')).toHaveLength(3);
    expect(screen.queryByText('Leader menilai upline')).toBeNull();
  });

  it('P19.22-T7 AC-3 Per orang: rows with role, upline, waktu, masa kerja, usia, n item — or Belum menjawab + WhatsApp', async () => {
    const user = userEvent.setup();
    show(QRESULTS(), 'qual', { 'GET /kpm/advanced-analytics/qual/people': { body: PEOPLE() } });
    await user.click(await screen.findByRole('button', { name: 'Per orang' }));
    const agus = await waitFor(() => document.querySelector('[data-person-row="m-agus"]')!);
    expect(agus).toHaveTextContent('Agus Prasetyo');
    expect(agus).toHaveTextContent('AB');
    expect(agus).toHaveTextContent('Wilson Tanoto');
    expect(agus).toHaveTextContent('Full-time');
    expect(agus).toHaveTextContent('6 tahun');
    expect(agus).toHaveTextContent('44 · Gen Y');
    expect(agus).toHaveTextContent('21 item');
    const dewi = document.querySelector('[data-person-row="m-dewi"]')!;
    expect(dewi).toHaveTextContent('Belum menjawab');
    const wa = within(dewi as HTMLElement).getByRole('link', { name: 'WhatsApp Dewi Lestari' });
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/6281211002200\?text=/);
    expect(decodeURIComponent(wa.getAttribute('href')!)).toContain('Halo Dewi, mohon isi Survei kualitatif Jun 2026');
    // Yosef is outside the reader's reach: his row does not open.
    expect(within(document.querySelector('[data-person-row="m-yosef"]') as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('P19.22-T7 AC-3 filters: Sudah / Belum and the informal group', async () => {
    const user = userEvent.setup();
    show(QRESULTS(), 'qual', { 'GET /kpm/advanced-analytics/qual/people': { body: PEOPLE() } });
    await user.click(await screen.findByRole('button', { name: 'Per orang' }));
    await waitFor(() => expect(document.querySelector('[data-person-row="m-agus"]')).not.toBeNull());
    await user.click(screen.getByRole('button', { name: 'Belum' }));
    expect(document.querySelectorAll('[data-person-row]')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Semua' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Informal group' }), 'Tanpa group');
    expect([...document.querySelectorAll('[data-person-row]')].map((r) => r.getAttribute('data-person-row'))).toEqual(['m-yosef']);
  });

  it('P19.22-T7 AC-3 tapping a row opens their full answers right under it; again closes them', async () => {
    const user = userEvent.setup();
    show(QRESULTS(), 'qual', {
      'GET /kpm/advanced-analytics/qual/people/m-agus': { body: AGUS },
      'GET /kpm/advanced-analytics/qual/people': { body: PEOPLE() },
    });
    await user.click(await screen.findByRole('button', { name: 'Per orang' }));
    const open = await screen.findByRole('button', { name: 'Agus Prasetyo: tampilkan jawabannya' });
    await user.click(open);
    const answers = await waitFor(() => document.querySelector('[data-person-answers="m-agus"]')!);
    expect(answers.closest('[data-person-row]')).toHaveAttribute('data-person-row', 'm-agus');
    expect(answers).toHaveTextContent('3/7');
    expect(answers).toHaveTextContent('Penjualan');
    expect(answers).toHaveTextContent('“Ingin fokus ke nasabah jangka panjang.”');
    expect(within(answers as HTMLElement).getByRole('img', { name: 'Frekuensi penjualan: 3 dari 5' })).toBeInTheDocument();
    expect(answers).toHaveTextContent('Tidak dilakukan');
    expect(answers).toHaveTextContent('Masih coaching leader downline?');
    expect(answers).toHaveTextContent('8/10');
    await user.click(screen.getByRole('button', { name: 'Agus Prasetyo: sembunyikan jawabannya' }));
    expect(document.querySelector('[data-person-answers]')).toBeNull();
  });

  it('P19.22-T7 AC-3 an anonymous run says so; a summary shows no names', async () => {
    const user = userEvent.setup();
    show(QRESULTS(), 'qual', { 'GET /kpm/advanced-analytics/qual/people': { body: PEOPLE({ answersShown: false, people: null, audience: 'summary' }) } });
    await user.click(await screen.findByRole('button', { name: 'Per orang' }));
    expect(await screen.findByText('Survei ini anonim: jawaban per orang tidak disimpan.')).toBeInTheDocument();
    expect(screen.getByText('Nama dan jawaban per orang tidak ditampilkan dalam mode lihat.')).toBeInTheDocument();
  });

  it('P19.22-T7 AC-4 Survei baru: the preview by question group, Profil from the profile, sent for December', async () => {
    const user = userEvent.setup();
    show(QRESULTS(), 'qual');
    await user.click(await screen.findByRole('button', { name: 'Survei baru' }));
    const send = document.querySelector('[data-survey-send="qual"]')!;
    expect(send).toHaveTextContent('Status kerja, tanggal lahir, tanggal bergabung (dari profil, tidak ditanya ulang)');
    expect(send).toHaveTextContent('Penjualan: nilai 1–5 untuk 7 aspek');
    expect(send).toHaveTextContent('Q8–Q9');
    expect(send).toHaveTextContent('Manajemen unit: konsisten dan nyaman, 8 kegiatan (leader)');
    expect(screen.getByRole('button', { name: 'Kirim ke 30 anggota' })).toBeInTheDocument();
  });

  it('axe: Kualitatif Hasil and Per orang with a person open, populated', async () => {
    const user = userEvent.setup();
    const { container } = show(QRESULTS(), 'qual', {
      'GET /kpm/advanced-analytics/qual/people/m-agus': { body: AGUS },
      'GET /kpm/advanced-analytics/qual/people': { body: PEOPLE() },
    });
    await screen.findByText('A · Penjualan');
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Per orang' }));
    await user.click(await screen.findByRole('button', { name: 'Agus Prasetyo: tampilkan jawabannya' }));
    await waitFor(() => expect(document.querySelector('[data-person-answers]')).not.toBeNull());
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toEqual([]);
  });
});
