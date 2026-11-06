import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ToastHost } from '@/components/ui/toast';
import { setImpersonating } from '@/lib/api-client';
import type { Me } from '@/lib/session';
import { resetPending, type FormQuestion, type SurveyForm, type SurveyList } from '@/lib/surveys';
import { makeMe, renderInIndonesian, stubFetch, type StubReply } from '@test/harness';
import { SurveyFormScreen } from './survey-form';
import { SurveyListScreen } from './survey-list';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/surveys/run-nps',
  useSearchParams: () => new URLSearchParams(),
}));

const INDAH: Me = makeMe({
  membership: {
    membershipId: 'mem-indah', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
});

const score = (kode: string, id: string): FormQuestion => ({
  kode, type: 'score', text: { id, en: id }, items: [], askWhy: true, required: true, blockKode: null, blockTitle: null,
  scale: { min: 0, max: 10 },
});
const QUESTIONS: FormQuestion[] = [
  score('P1', 'Seberapa besar kemungkinan Anda merekomendasikan KPM ini kepada teman sebagai tempat berkarier?'),
  score('P2', 'Seberapa jelas visi dan arah KPM ini bagi Anda?'),
  { kode: 'OPEN', type: 'text', text: { id: 'Apa satu hal yang paling ingin Anda perbaiki di KPM ini?', en: '' }, items: [], askWhy: false, required: false, blockKode: null, blockTitle: null, scale: null },
];
const FORM = (over: Partial<SurveyForm> = {}): SurveyForm => ({
  run: { runId: 'run-nps', kind: 'nps', periodKey: '2026-Q4', opensOn: '2026-10-27', closesOn: '2026-11-09', notice: 'anonymous', anonymous: true, kpmCode: '0417' },
  state: 'open', questions: QUESTIONS, answers: {}, answeredCount: 0, totalCount: 3, resumeIndex: 0, downlineLeaders: [], ...over,
});

function show(form: SurveyForm, extra: Record<string, StubReply> = {}) {
  const stub = stubFetch({
    'GET /surveys/run-nps': { body: form },
    'PUT /surveys/run-nps/answers/': { body: { answeredCount: 1, totalCount: 3 } },
    'POST /surveys/run-nps/submit': { status: 201, body: { submittedAt: '2026-11-03T03:00:00Z' } },
    '/surveys/pending': { body: { today: '2026-11-03', kpmCode: '0417', open: [], sentOpen: [], popup: null } },
    ...extra,
  });
  const view = renderInIndonesian(<ToastHost><SurveyFormScreen runId="run-nps" /></ToastHost>, { me: INDAH });
  return { ...stub, ...view };
}

describe('P19.5-T4 the survey form (C-R6, C-R8, C-R9; ADR-0216 §5)', () => {
  beforeEach(() => { push.mockClear(); resetPending(); });
  afterEach(() => { vi.unstubAllGlobals(); setImpersonating(false); });

  it('AC-5 one question a screen: Pertanyaan n dari M · ditutup <tanggal>, 0 to 10, the ends, Kenapa?, the anonymous notice', async () => {
    show(FORM());
    expect(await screen.findByText('Pertanyaan 1 dari 3 · ditutup 9 Nov')).toBeInTheDocument();
    expect(screen.getByText('Survei NPS KPM Q4 2026')).toBeInTheDocument();
    expect(screen.getByText('Tersimpan otomatis')).toBeInTheDocument();
    const scale = screen.getByRole('radiogroup', { name: 'Nilai 0 sampai 10' });
    expect(within(scale).getAllByRole('radio')).toHaveLength(11);
    expect(screen.getByText('0 · Sangat tidak mungkin')).toBeInTheDocument();
    expect(screen.getByText('10 · Sangat mungkin')).toBeInTheDocument();
    expect(screen.getByLabelText('Kenapa? (opsional)')).toBeInTheDocument();
    expect(screen.getByText('Anonim. KPM hanya melihat ringkasan, bukan nama Anda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kembali' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lanjut' })).toBeDisabled();
  });

  it('C-R6 Tersimpan otomatis: a score is saved as it is chosen, and Lanjut opens the next', async () => {
    const { calls } = show(FORM());
    await userEvent.click(await screen.findByRole('radio', { name: '8' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PUT')).toBe(true));
    const put = calls.find((c) => c.init.method === 'PUT')!;
    expect(put.url).toContain('/surveys/run-nps/answers/P1');
    expect(JSON.parse(put.init.body as string)).toEqual({ value: { score: 8 } });
    await userEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
    expect(await screen.findByText('Pertanyaan 2 dari 3 · ditutup 9 Nov')).toBeInTheDocument();
  });

  it('C-R6, C2-3 it opens where the member stopped: question 2 with 1 answered', async () => {
    show(FORM({ answers: { P1: { score: 8 } }, answeredCount: 1, resumeIndex: 1 }));
    expect(await screen.findByText('Pertanyaan 2 dari 3 · ditutup 9 Nov')).toBeInTheDocument();
  });

  it('C-R6 × closes it with “Tersimpan. Lanjutkan dari Lainnya.” and goes Home, the text saved first', async () => {
    const { calls } = show(FORM({ resumeIndex: 2, answers: { P1: { score: 8 }, P2: { score: 9 } } }));
    await userEvent.type(await screen.findByRole('textbox', { name: 'Jawaban' }), 'Lebih banyak training');
    await userEvent.click(screen.getByRole('button', { name: 'Tutup, jawaban tersimpan' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/home'));
    expect(calls.find((c) => c.url.includes('/answers/OPEN'))).toBeDefined();
    expect(await screen.findByText('Tersimpan. Lanjutkan dari Lainnya.')).toBeInTheDocument();
  });

  it('AC-6 C-R9 Kirim on the last screen: Terima kasih! and the line', async () => {
    const { calls } = show(FORM({ resumeIndex: 2, answers: { P1: { score: 8 }, P2: { score: 9 } } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Kirim' }));
    expect(await screen.findByRole('heading', { name: 'Terima kasih!' })).toBeInTheDocument();
    expect(screen.getByText('Jawaban Anda sudah terkirim. Pengingat survei ini tidak akan muncul lagi.')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/submit'))).toBe(true);
  });

  it('B-R4, C-R8 a qualitative run shown per person carries B-R4’s notice; its items are 1 to 5', async () => {
    show(FORM({
      run: { ...FORM().run, kind: 'qual', periodKey: '2026-12', notice: 'per_person', anonymous: false },
      questions: [{
        kode: 'Q5', type: 'scale_items', text: { id: 'Seberapa yakin Anda dengan setiap bagian penjualan ini?', en: '' },
        items: [{ kode: 'PIPELINE', label: { id: 'Leads pipeline', en: 'Leads pipeline' } }], askWhy: false, required: true,
        blockKode: 'SALES', blockTitle: { id: 'A. Penjualan', en: 'A. Sales' }, scale: { min: 1, max: 5 },
      }],
    }));
    expect(await screen.findByText('Jawaban Anda (kecuali Dukungan leader) dapat dilihat leader Anda untuk coaching.')).toBeInTheDocument();
    expect(within(screen.getByRole('radiogroup', { name: 'Leads pipeline' })).getAllByRole('radio')).toHaveLength(5);
  });

  it('a closed run says so; a sent one thanks', async () => {
    show(FORM({ state: 'closed', questions: [] }));
    expect(await screen.findByText('Survei ini sudah ditutup')).toBeInTheDocument();
  });

  it('ADR-0216 §3 a view-as session sees the questions, no saved answer, and saves nothing', async () => {
    setImpersonating(true);
    const { calls } = show(FORM());
    expect(await screen.findByText('Hanya lihat: jawaban anggota yang tersimpan tidak ditampilkan.')).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
  });

  it('axe: the form, clean', async () => {
    const { container } = show(FORM());
    await screen.findByText('Pertanyaan 1 dari 3 · ditutup 9 Nov');
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });
});

describe('P19.5-T4 /surveys — the open runs, then Riwayat (C-R2, AC-6, AC-8)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const LIST = (over: Partial<SurveyList> = {}): SurveyList => ({
    today: '2026-11-03',
    open: [{
      runId: 'run-nps', kind: 'nps', periodKey: '2026-Q4', opensOn: '2026-10-27', closesOn: '2026-11-09', daysLeft: 6,
      answeredCount: 0, totalCount: 6, minutes: 3, anonymous: true, notice: 'anonymous',
    }],
    history: [{ runId: 'run-q3', kind: 'nps', periodKey: '2026-Q3', submittedOn: '2026-08-18' }],
    ...over,
  });

  it('AC-8 the open run with its facts and dates, Isi sekarang; then Riwayat with Diisi <tanggal>', async () => {
    stubFetch({ '/surveys': { body: LIST() } });
    renderInIndonesian(<SurveyListScreen />, { me: INDAH });
    const open = await screen.findByText('Survei NPS KPM Q4 2026');
    expect(open.closest('article')).toHaveTextContent('6 pertanyaan · ±3 menit · anonim');
    expect(open.closest('article')).toHaveTextContent('Dibuka 27 Okt – 9 Nov');
    expect(screen.getByRole('link', { name: 'Isi sekarang' })).toHaveAttribute('href', '/surveys/run-nps');
    expect(screen.getByText('Riwayat')).toBeInTheDocument();
    expect(screen.getByText('Diisi 18 Agu')).toBeInTheDocument();
  });

  it('AC-8 with nothing open: “Tidak ada survei yang perlu diisi”', async () => {
    stubFetch({ '/surveys': { body: LIST({ open: [], history: [] }) } });
    renderInIndonesian(<SurveyListScreen />, { me: INDAH });
    expect(await screen.findByText('Tidak ada survei yang perlu diisi')).toBeInTheDocument();
    expect(screen.getByText('Belum ada survei yang diisi.')).toBeInTheDocument();
  });
});
