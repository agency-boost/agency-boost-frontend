import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { Me } from '@/lib/session';
import type { NpsResults, QualResults, RunView, SurveyResults } from '@/lib/surveys';
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
  runId: 'run-q4', kind: 'nps', periodKey: '2026-Q4', opensOn: '2026-10-27', closesOn: '2026-11-09', state: 'open',
  invitedRoleClasses: ['agent', 'aab', 'ab'], anonymous: true, perPerson: false, remindHalfway: true,
  responses: { sent: 3, invited: 30, pct: 10 }, ...over,
});
const NPS: NpsResults = {
  cutoffs: { promoterMin: 9, passiveMin: 7, ageBandUpper: [29, 45], tenureBands: [3, 7, 10] },
  respondents: 3,
  overall: { score: 40, promoters: 10, passives: 1, detractors: 4, n: 15 },
  change: 5,
  aspects: [{ aspect: 'Keseluruhan', score: 33, n: 3, change: -2 }],
  questions: [{ kode: 'P2', text: { id: 'Seberapa jelas visi KPM?', en: '' }, aspect: 'Visi', score: 20, n: 3, change: null, textChanged: true }],
  openAnswers: ['Jadwal training lebih jelas.'],
  breakdowns: { roleClass: [{ key: 'agent', respondents: 2, score: null }], tenureBand: [], ageBand: [{ key: '0', respondents: 3, score: 40 }] },
};
const RESULTS = (over: Partial<SurveyResults> = {}): SurveyResults => ({
  kind: 'nps', today: '2026-11-05', visible: true, sectionOn: true, canWrite: true, audience: 'office',
  template: { cadence: 'quarter', qualMonths: [6, 12], defaults: { anonymous: true, perPerson: false, remindHalfway: true } },
  runs: [run({}), run({ runId: 'run-q3', periodKey: '2026-Q3', state: 'closed', opensOn: '2026-08-01', closesOn: '2026-08-20' })],
  selected: { ...run({}), previousRunId: 'run-q3', nps: NPS, qual: null },
  ...over,
});

function show(results: SurveyResults, kind: 'nps' | 'qual' = 'nps', extra: Record<string, StubReply> = {}) {
  atWidth(1280);
  const stub = stubFetch({ [`GET /kpm/advanced-analytics/${kind}`]: { body: results }, ...extra });
  const view = renderInIndonesian(<SurveyResultsScreen kind={kind} />, { me: OWNER });
  return { ...stub, ...view };
}

describe('P19.5-T4 the KPM’s NPS and Kualitatif tabs (AC-1 to AC-4, AC-13)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1 Periode survei lists the runs with their state and n dari M; Mulai survei for the Owner', async () => {
    show(RESULTS());
    expect(await screen.findByText('Periode survei')).toBeInTheDocument();
    const q4 = document.querySelector('[data-survey-run="run-q4"]')!;
    expect(q4).toHaveTextContent('Survei NPS KPM Q4 2026');
    expect(q4).toHaveTextContent('Berjalan');
    expect(q4).toHaveTextContent('3 dari 30');
    expect(document.querySelector('[data-survey-run="run-q3"]')).toHaveTextContent('Selesai');
    expect(screen.getByRole('button', { name: 'Mulai survei' })).toBeInTheDocument();
  });

  it('AC-3 the score, P, Pa and D, the change from Q3, per aspect, per question with “Pertanyaan diubah sejak periode lalu”, the open answers', async () => {
    show(RESULTS());
    const panel = await screen.findByText('Skor NPS').then((el) => el.closest('[data-nps-results]')!);
    expect(panel).toHaveTextContent('40');
    expect(panel).toHaveTextContent('+5 dibanding Q3 2026');
    expect(within(panel as HTMLElement).getByText('Pertanyaan diubah sejak periode lalu')).toBeInTheDocument();
    expect(within(panel as HTMLElement).getByText('“Jadwal training lebih jelas.”')).toBeInTheDocument();
    // A cell under three respondents reads — (ADR-0216 §3).
    expect(within(panel as HTMLElement).getByText('Agent').parentElement).toHaveTextContent('—');
  });

  it('A-R9 a summary — a view-as session — has no open answers and no write', async () => {
    show(RESULTS({ canWrite: false, audience: 'summary', selected: { ...RESULTS().selected!, nps: { ...NPS, openAnswers: null } } }));
    await screen.findByText('Skor NPS');
    expect(screen.queryByText('Jawaban terbuka')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mulai survei' })).toBeNull();
  });

  it('P19.5-T4 ADR-0216 §3 an anonymous run under three respondents: the score, P, Pa, D and every row read —, no open answers', async () => {
    const floored: NpsResults = {
      ...NPS, respondents: 2, overall: null, change: null, openAnswers: null,
      aspects: [{ aspect: 'Keseluruhan', score: null, n: 2, change: null }],
      questions: [{ ...NPS.questions[0], score: null, n: 2 }],
      breakdowns: { roleClass: [{ key: 'agent', respondents: 2, score: null }], tenureBand: [], ageBand: [] },
    };
    show(RESULTS({ selected: { ...RESULTS().selected!, nps: floored } }));
    const panel = await screen.findByText('Skor NPS').then((el) => el.closest('[data-nps-results]')! as HTMLElement);
    expect(screen.getByText('Skor NPS').nextElementSibling).toHaveTextContent('—');
    for (const label of ['Promotor', 'Pasif', 'Detraktor']) expect(within(panel).getByText(label).nextElementSibling).toHaveTextContent('—');
    expect(within(panel).getByText('Keseluruhan').parentElement).toHaveTextContent('—');
    expect(panel).not.toHaveTextContent('dibanding');
    expect(panel).toHaveTextContent('2 responden');
    expect(screen.queryByText('Jawaban terbuka')).toBeNull();
  });

  it('P19.5-T4 ADR-0216 §3 an anonymous qualitative item under three answers reads —, with no mark', async () => {
    const QUAL: QualResults = {
      respondents: 2, cutoffs: { qualIssueMaxRating: 3 },
      blocks: [{
        kode: 'SALES', title: { id: 'A. Penjualan', en: 'A. Sales' }, audience: 'all', questionKodes: ['Q5'],
        items: [{ questionKode: 'Q5', itemKode: 'PIPELINE', label: { id: 'Leads pipeline', en: '' }, kind: 'rating', answers: 2, issues: null, issuePct: null, severity: null }],
      }],
      aspiration: [{ kode: 'TOP', label: { id: 'Saya ingin menjadi top producer', en: '' }, count: null, pct: null }],
      support: { n: 2, satisfiedPct: null, fairPct: null, poorPct: null },
      coachingDownline: { n: 1, pct: null, good: null },
    };
    const qualRun = run({ kind: 'qual', periodKey: '2026-06', state: 'closed' });
    show(RESULTS({ kind: 'qual', runs: [qualRun], selected: { ...qualRun, previousRunId: null, nps: null, qual: QUAL } }), 'qual');
    const block = await screen.findByText('Leads pipeline').then((el) => el.closest('[data-qual-block]')!);
    expect(block).toHaveTextContent('—');
    expect(block).not.toHaveTextContent('bermasalah');
    expect(block).not.toHaveTextContent('Masalah besar');
    expect(screen.getByText('Saya ingin menjadi top producer').parentElement).toHaveTextContent('—');
    expect(document.querySelector('[data-qual-support]')).not.toHaveTextContent('%');
  });

  it('AC-1 Mulai survei: the dates within the cadence, the roles, Anonim from the template, Ingatkan 1 hari sebelum berakhir always on', async () => {
    const { calls } = show(RESULTS(), 'nps', { 'POST /kpm/advanced-analytics/surveys/runs': { status: 201, body: run({ state: 'scheduled' }) } });
    await userEvent.click(await screen.findByRole('button', { name: 'Mulai survei' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mulai survei' });
    expect(within(dialog).getByText('Dibuka dan ditutup dalam satu kuartal.')).toBeInTheDocument();
    expect(within(dialog).getByRole('switch', { name: 'Anonim' })).toBeChecked();
    expect(dialog).toHaveTextContent('Ingatkan 1 hari sebelum berakhir · selalu aktif');
    expect(within(dialog).queryByRole('switch', { name: 'Tampilkan jawaban per orang' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mulai' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'POST')).toBe(true));
    const body = JSON.parse(calls.find((c) => c.init.method === 'POST')!.init.body as string);
    expect(body).toEqual({
      kind: 'nps', opensOn: '2026-11-05', closesOn: '2026-12-31', invitedRoleClasses: ['agent', 'aab', 'ab'],
      anonymous: true, perPerson: false, remindHalfway: true,
    });
  });

  it('B-R2 a qualitative run: Tampilkan jawaban per orang, off and disabled while Anonim is on', async () => {
    show(RESULTS({ kind: 'qual', template: { ...RESULTS().template, defaults: { anonymous: false, perPerson: true, remindHalfway: true } }, runs: [], selected: null }), 'qual');
    await userEvent.click(await screen.findByRole('button', { name: 'Mulai survei' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mulai survei' });
    const perPerson = within(dialog).getByRole('switch', { name: 'Tampilkan jawaban per orang' });
    expect(perPerson).toBeChecked();
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Anonim' }));
    expect(perPerson).not.toBeChecked();
    expect(perPerson).toBeDisabled();
    expect(within(dialog).getByText('Dibuka dan ditutup di bulan Juni atau Desember.')).toBeInTheDocument();
  });

  it('AC-1 the server’s refusal shows in the dialog: 409 SURVEY_RUN_CONFLICT', async () => {
    show(RESULTS(), 'nps', {
      'POST /kpm/advanced-analytics/surveys/runs': { status: 409, body: { error: { code: 'SURVEY_RUN_CONFLICT', message: 'Sudah ada survei jenis ini di periode ini.' } } },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Mulai survei' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mulai' }));
    expect(await screen.findByText(/Sudah ada survei jenis ini di periode ini/)).toBeInTheDocument();
  });

  it('AC-4 the qualitative results: issue % per item, Masalah besar, Dukungan leader for the Owner', async () => {
    const QUAL: QualResults = {
      respondents: 2, cutoffs: { qualIssueMaxRating: 3 },
      blocks: [{
        kode: 'SALES', title: { id: 'A. Penjualan', en: 'A. Sales' }, audience: 'all', questionKodes: ['Q5'],
        items: [{ questionKode: 'Q5', itemKode: 'PIPELINE', label: { id: 'Leads pipeline', en: '' }, kind: 'rating', answers: 2, issues: 2, issuePct: 100, severity: 'big' }],
      }],
      aspiration: [{ kode: 'TOP', label: { id: 'Saya ingin menjadi top producer', en: '' }, count: 1, pct: 50 }],
      support: { n: 2, satisfiedPct: 50, fairPct: 0, poorPct: 50 },
      coachingDownline: { n: 1, pct: 100, good: true },
    };
    show(RESULTS({ kind: 'qual', runs: [run({ kind: 'qual', periodKey: '2026-06', state: 'closed' })], selected: { ...run({ kind: 'qual', periodKey: '2026-06', state: 'closed' }), previousRunId: null, nps: null, qual: QUAL } }), 'qual');
    const block = await screen.findByText('Leads pipeline').then((el) => el.closest('[data-qual-block]')!);
    expect(block).toHaveTextContent('Masalah besar');
    expect(block).toHaveTextContent('100% bermasalah');
    expect(document.querySelector('[data-qual-support]')).toHaveTextContent('Dukungan leader');
  });

  it('AT-12 a section off with no run open: the tab says so and lists nothing', async () => {
    show(RESULTS({ visible: false, sectionOn: false }));
    expect(await screen.findByText('Survei ini dimatikan di template KPM.')).toBeInTheDocument();
    expect(screen.queryByText('Periode survei')).toBeNull();
  });

  it('axe: the NPS tab, clean', async () => {
    const { container } = show(RESULTS());
    await screen.findByText('Skor NPS');
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });
});
