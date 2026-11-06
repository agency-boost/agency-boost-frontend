import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { Me } from '@/lib/session';
import type { CoachingSurvey } from '@/lib/surveys';
import { atWidth, makeMe, renderInIndonesian, stubFetch, wears } from '@test/harness';
import { CoachingSurveyTab } from './coaching-survey';

const coachee = vi.hoisted(() => ({ current: { membershipId: 'mem-indah', name: 'Indah Permatasari' } }));
const gone = vi.fn();
vi.mock('@/components/coaching-person', () => ({
  useCoachee: () => coachee.current,
  useCoacheeNotFound: () => gone,
}));

const AGUS: Me = makeMe({
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 3,
  },
});

const pair = (id: string, en = id) => ({ id, en });
const RUN = { runId: 'run-jun', periodKey: '2026-06', opensOn: '2026-06-01', closesOn: '2026-06-30', submittedOn: '2026-06-12' };

/** The coaching mockup's Indah: *Penjualan 4*, top producer, her note. */
const INDAH: CoachingSurvey = {
  state: 'answered',
  run: RUN,
  person: { roleClass: 'agent', workStatus: 'full_time', tenureYears: 2, age: 27, generation: 0 },
  issueMaxRating: 3,
  issueCounts: [{ kode: 'SALES', title: pair('A. Penjualan'), count: 4 }],
  aspiration: {
    kode: 'Q4',
    options: [
      { kode: 'TOP', label: pair('Saya ingin menjadi top producer'), chosen: true },
      { kode: 'TEAM', label: pair('Saya ingin menjadi team builder yang produktif'), chosen: false },
      { kode: 'FLOW', label: pair('Saya ingin menjalani saja dan mengikuti alurnya'), chosen: false },
      { kode: 'WEIGH', label: pair('Saya masih mempertimbangkan karier saya di industri asuransi'), chosen: false },
    ],
    note: 'Target saya MDRT dalam 2 tahun, tapi butuh bimbingan closing.',
  },
  sections: [{
    kode: 'SALES', kind: 'scale', title: pair('A. Penjualan'), questionKodes: ['Q5'],
    items: [
      { kode: 'FREQUENCY', label: pair('Frekuensi penjualan'), rating: 3 },
      { kode: 'ACTIVITY', label: pair('Activity management'), rating: 4 },
      { kode: 'PIPELINE', label: pair('Leads pipeline'), rating: 2 },
    ],
  }],
};

/** The mockup's Ika (AAB): four sections, *D. Manajemen unit* across two columns. */
const IKA: CoachingSurvey = {
  ...INDAH,
  person: { roleClass: 'aab', workStatus: 'full_time', tenureYears: 7, age: 38, generation: 1 },
  issueCounts: [
    { kode: 'SALES', title: pair('A. Penjualan'), count: 2 }, { kode: 'RECRUIT', title: pair('B. Rekrutmen'), count: 6 },
    { kode: 'ACTIVATION', title: pair('C. Aktivasi'), count: 4 }, { kode: 'UNIT', title: pair('D. Manajemen unit'), count: 0 },
  ],
  sections: [
    { kode: 'SALES', kind: 'scale', title: pair('A. Penjualan'), questionKodes: ['Q5'], items: [{ kode: 'PIPELINE', label: pair('Leads pipeline'), rating: 4 }] },
    { kode: 'RECRUIT', kind: 'scale', title: pair('B. Rekrutmen'), questionKodes: ['Q6'], items: [{ kode: 'PITCH', label: pair('Pitch rekrutmen'), rating: 2 }] },
    { kode: 'ACTIVATION', kind: 'state', title: pair('C. Aktivasi'), questionKodes: ['Q7'], items: [{ kode: 'JFW', label: pair('Joint field work'), state: 'not_done' }] },
    { kode: 'UNIT', kind: 'unit', title: pair('D. Manajemen unit'), questionKodes: ['Q8', 'Q9'], items: [{ kode: 'UNIT_MEETING', label: pair('Unit meeting'), state: 'consistent', rating: 5 }] },
  ],
};

function show(body: CoachingSurvey | { status: number; code: string }, px = 1280) {
  atWidth(px);
  const reply = 'status' in body ? { status: body.status, body: { error: { code: body.code, message: 'x' } } } : { body };
  const stub = stubFetch({ '/coaching/mem-indah/survey': reply });
  const view = renderInIndonesian(<CoachingSurveyTab />, { me: AGUS });
  return { ...stub, ...view };
}

describe('P19.5-T4 the coaching Survei tab (ADR-0216 §7; coaching-survey-results-2026-11-02.html)', () => {
  afterEach(() => { vi.unstubAllGlobals(); gone.mockClear(); });

  it('B4-1 AC-14 Indah: the bar, Item bermasalah Penjualan 4, her aspiration ticked with the note, no Q12', async () => {
    show(INDAH);
    expect(await screen.findByText('Full-time')).toBeInTheDocument();
    expect(screen.getByText('2 tahun')).toBeInTheDocument();
    expect(screen.getByText('27 · Gen Z')).toBeInTheDocument();
    expect(screen.getByText('Item bermasalah')).toBeInTheDocument();
    expect(document.querySelector('[data-issue-count="SALES"]')).toHaveTextContent('Penjualan 4');
    expect(screen.getByText('Aspirasi jangka panjang')).toBeInTheDocument();
    expect(screen.getByText('“Target saya MDRT dalam 2 tahun, tapi butuh bimbingan closing.”')).toBeInTheDocument();
    expect(screen.getByText('A. Penjualan')).toBeInTheDocument();
    expect(screen.getByText('nilai 1–5 · 1–3 = masalah')).toBeInTheDocument();
    expect(screen.queryByText(/Dukungan leader|Q12/)).toBeNull();
    // What the mockup leaves out is not built (ADR-0216 §9).
    expect(screen.queryByText(/Perlu bantuan|Jadikan tindakan/)).toBeNull();
  });

  it('AC-17 on the 1-to-5 scale the chosen value is filled: red at the cut-off or below, green above', async () => {
    show(INDAH);
    const pipeline = (await screen.findByText('Leads pipeline')).parentElement!;
    const two = within(pipeline).getByText('2');
    expect(two).toHaveClass('bg-signal-red');
    const activity = screen.getByText('Activity management').parentElement!;
    expect(within(activity).getByText('4')).toHaveClass('bg-success');
    expect(within(pipeline).getByRole('img', { name: 'Nilai 2 dari 5' })).toBeInTheDocument();
  });

  it('B4-3 for an AAB: Penjualan tim, Rekrutmen, Aktivasi agen baru, Manajemen unit, with the state pills', async () => {
    show(IKA);
    expect(await screen.findByText('A. Penjualan tim')).toBeInTheDocument();
    for (const title of ['B. Rekrutmen', 'C. Aktivasi agen baru', 'D. Manajemen unit']) expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText('Tidak dilakukan')).toHaveClass('bg-pill-red');
    expect(screen.getByText('Konsisten')).toHaveClass('bg-pill-green');
    expect(screen.getByText('Butir')).toBeInTheDocument();
    expect(screen.getByText('Q8 · Q9')).toBeInTheDocument();
    expect(document.querySelector('[data-issue-count="UNIT"]')).toHaveClass('bg-pill-green');
  });

  it('AC-18 three columns on a desktop with Manajemen unit across two; two on a tablet; one on a phone', async () => {
    show(IKA, 1280);
    const unit = (await screen.findByText('D. Manajemen unit')).closest('section')!;
    expect(unit).toHaveClass('lg:col-span-2');
    const grid = unit.parentElement!;
    expect(wears(grid, 1280)).toContain('grid-cols-3');
    expect(wears(grid, 768)).toContain('grid-cols-2');
    expect(wears(grid, 375)).toContain('grid-cols-1');
  });

  it('AC-18 at 375px the row is one column and every target is the mockup’s', async () => {
    show(IKA, 375);
    const unit = (await screen.findByText('D. Manajemen unit')).closest('section')!;
    expect(wears(unit.parentElement!, 375)).toContain('grid-cols-1');
  });

  it('B4-5 AC-15 not answered: “Indah belum mengisi survei Jun 2026” and when it closed', async () => {
    show({ ...INDAH, state: 'not_answered', person: null, issueCounts: [], aspiration: null, sections: [] });
    expect(await screen.findByText('Indah belum mengisi survei Jun 2026')).toBeInTheDocument();
    expect(screen.getByText('Survei ditutup 30 Jun 2026.')).toBeInTheDocument();
  });

  it('B4-4 AC-15 anonymous: “Survei Jun 2026 dijalankan anonim” and the mockup’s line', async () => {
    show({ ...INDAH, state: 'anonymous', person: null, issueCounts: [], aspiration: null, sections: [] });
    expect(await screen.findByText('Survei Jun 2026 dijalankan anonim')).toBeInTheDocument();
    expect(screen.getByText(/Jawaban per orang tidak disimpan/)).toBeInTheDocument();
  });

  it('none: Belum ada survei', async () => {
    show({ ...INDAH, state: 'none', run: null, person: null, issueCounts: [], aspiration: null, sections: [] });
    expect(await screen.findByText('Belum ada survei')).toBeInTheDocument();
  });

  it('A-R9 refused 403 SURVEY_ANSWERS_HIDDEN in a view-as session: says so; B4-6 outside the line or another office’s person is the shell’s not-found', async () => {
    show({ status: 403, code: 'SURVEY_ANSWERS_HIDDEN' });
    expect(await screen.findByText('Jawaban survei seseorang tidak ditampilkan dalam sesi lihat sebagai.')).toBeInTheDocument();
    vi.unstubAllGlobals();
    show({ status: 404, code: 'NOT_FOUND' });
    await vi.waitFor(() => expect(gone).toHaveBeenCalled());
  });

  it('axe: the answered tab, clean', async () => {
    const { container } = show(IKA);
    await screen.findByText('A. Penjualan tim');
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });
});
