import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { GoalCalculator } from '@/components/goal-calculator';
import { goalWordMessages } from '@/i18n/messages/goal-words';
import { goalsMessages } from '@/i18n/messages/goals';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import GoalSettingsPage from './page';

/**
 * **P18.98-T4, Goal Settings in ID mode** (field selling): `/goals` and the calculator a coachee's *Goal Setting* tab
 * mounts — since UI V1 (P18.99-T5) the result card, four steps, *Simpan goal* and its status, the commitment in the
 * report's sentence (UI-017) and every state a plan can be in —
 * read in Bahasa Indonesia: our words the approved glossary's, §A.4's KPI labels, the cascade's stages and the jargon
 * kept English, the office's activity names as typed, every figure Indonesian, and no English message of the module's
 * own left on the screen. English is `page.spec.tsx`'s, unchanged.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/goals',
}));

const GOALS_ENGLISH = englishOnly(goalsMessages, goalWordMessages);
const noEnglishLeft = () => expect(englishShown(document.body, GOALS_ENGLISH)).toEqual([]);

const AGENT = makeMe({ permissions: ['goal:read', 'goal:update'] });
const PERIOD = String(new Date().getFullYear());

const projection = (over: Record<string, unknown> = {}) => ({
  annualApeTargetMinor: 500_000_000_00, apeAchievedMinor: 0, remainingApeMinor: 500_000_000_00,
  monthlyApeTargetMinor: 100_000_000_00, policiesPerMonth: 6, policiesPerWeek: 1.4, appointmentsPerMonth: 20,
  appointmentsPerWeek: 5, leadsPerMonth: 67, leadsPerWeek: 16, targetMet: false, ...over,
});
const goal = (over: Record<string, unknown> = {}) => ({
  period: PERIOD, mode: 'direct', annualApeTargetMinor: 500_000_000_00, savingsTargetMinor: 50_000_000_00,
  commissionRatePct: 10, monthsLeft: 5, apeAchievedMinor: 0,
  achieved: { minor: 0, provenance: 'self_reported', month: null },
  caseSizeMinor: 18_000_000_00, leadsToApptPct: 30, closingRatePct: 30,
  snapshot: { monthlyApeTargetMinor: 100_000_000_00, policiesPerMonth: 6, appointmentsPerMonth: 20, leadsPerMonth: 67 },
  projected: projection(),
  cascadeMapping: { leadsCode: 'LEADS_CONTACTED', appointmentsCode: 'SELL_PRESENTATION', closingsCode: 'SELL_SUBMISSION' },
  cascadeBinding: { leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'] },
  measured: null, monthsLeftIsOverride: false, savedAt: '2026-09-13T04:00:00.000Z', savedByMembershipId: 'mem-1',
  ...over,
});
const type = (code: string, categoryCode: string, label: string, displayOrder: number) => ({
  id: `t-${code}`, code, categoryCode, label, description: null, appliesToOrgLevelCodes: [], displayOrder, version: 1,
  status: 'active',
});
const category = (code: string, label: string, displayOrder: number, types: unknown[]) => ({
  id: `c-${code}`, code, label, description: null, appliesToOrgLevelCodes: [], displayOrder, version: 1, status: 'active', types,
});
/** The seed's activities, in the office's own words: the chips name them as typed. */
const BASE = {
  '/kpm/config': {
    body: {
      activity: [
        category('LEADS_GENERATION', 'Leads Generation', 1, [type('LEADS_CONTACTED', 'LEADS_GENERATION', 'Set Appointment', 3)]),
        category('SELLING', 'Selling', 2, [
          type('SELL_PRESENTATION', 'SELLING', 'Melakukan presentasi penjualan untuk calon atau existing nasabah', 4),
          type('SELL_SUBMISSION', 'SELLING', 'Submission polis', 6),
        ]),
      ],
      ratios: [], leadPipelines: [], version: 1,
    },
  },
  '/kpm/org-levels': { body: [] },
};
const met = projection({
  targetMet: true, remainingApeMinor: 0, monthlyApeTargetMinor: 0, policiesPerMonth: 0, appointmentsPerMonth: 0, leadsPerMonth: 0,
});

/** `POST /goals/:period/preview` (P18.99-T5): the plan the inputs on screen would make. */
const PREVIEW = { [`POST /goals/${PERIOD}/preview`]: { body: {
  period: PERIOD, monthsLeft: 5, monthsLeftIsOverride: false, achieved: { minor: 0, provenance: 'self_reported', month: null },
  projected: projection(),
} } };

const show = (goals: unknown) => {
  const stub = stubFetch({ ...BASE, ...PREVIEW, '/goals': goals } as Parameters<typeof stubFetch>[0]);
  renderInIndonesian(<AgentLayout><GoalSettingsPage /></AgentLayout>, { me: AGENT });
  return stub;
};
const coachee = (body: unknown, pronoun: 'she' | 'he' | 'they' = 'she') => {
  stubFetch({ ...BASE, ...PREVIEW, '/goals': { body } } as Parameters<typeof stubFetch>[0]);
  renderInIndonesian(<GoalCalculator period={PERIOD} subject={{ membershipId: 'mem-rina', pronoun }} />, { me: AGENT });
};
const commitment = async () => (await screen.findByText(/^Bulan ini/)).closest('p')!;
/** The orange result card (UI-014). */
const resultCard = () => screen.findByRole('region', { name: 'Target aktivitas bulanan' });
/** The desktop's save status, at the foot of the right column (UI-022). */
const status = () => within(document.querySelector('[data-goal-aside]') as HTMLElement).getByRole('status');

describe('P18.98-T4 Goal Settings in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 UI-006 asks the four steps in Indonesian, the kept terms English, every figure Indonesian', async () => {
    show({ body: goal() });

    expect(await screen.findByRole('heading', { level: 1, name: 'Goal Settings' })).toBeInTheDocument();
    expect(screen.getByText('Ubah target tahunan Anda menjadi angka aktivitas bulan ini.')).toBeInTheDocument();
    for (const name of [
      'Target aktivitas bulanan', '1Berapa target APE Anda tahun ini?', '2Progres Anda saat ini', '3Dari APE ke jumlah polis',
      '4Asumsi konversi', 'Komitmen saya (per 13 Sep 2026)',
    ]) {
      expect(await screen.findByRole('heading', { name: name.replace(/^\d/, '') })).toBeInTheDocument();
    }
    const modes = screen.getByRole('tablist', { name: 'Cara Anda ingin mengaturnya' });
    expect(within(modes).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Atur target APE langsung', 'Hitung dari target tabungan']);
    // The save and the shared save state (UI-019).
    expect(screen.getByRole('button', { name: 'Simpan goal' })).toBeInTheDocument();
    expect(status()).toHaveTextContent('Tersimpan ✓');
    // UI-016: the sliders' values compact, the rates whole; *Appointment to meeting* kept (UI-006).
    expect(screen.getByRole('slider', { name: 'Target APE tahunan' })).toHaveAttribute('aria-valuetext', 'Rp 500 jt');
    expect(screen.getByRole('button', { name: 'Ketik jumlah tepat untuk Target APE tahunan' })).toHaveTextContent('Rp 500 jt');
    expect(screen.getByRole('slider', { name: /^Rata-rata case size \(APE per polis\)/ })).toHaveAttribute('aria-valuetext', 'Rp 18 jt');
    expect(within(screen.getByRole('group', { name: 'Appointment to meeting' })).getByText('30%')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tingkat closing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah Tingkat closing' })).toBeInTheDocument();
    // UI-020: the two prefilled figures, the months the office's with its ⚡.
    expect(screen.getByRole('textbox', { name: 'Sisa bulan tahun ini' })).toHaveValue('5');
    expect(screen.getByRole('textbox', { name: 'Sisa bulan tahun ini' }).parentElement).toHaveTextContent('bulan');
    expect(screen.getByText('Otomatis')).toHaveClass('sr-only');
    expect(screen.getByRole('textbox', { name: 'APE yang sudah dicapai tahun ini' })).toHaveValue('Rp 0');
    expect(screen.getByText('Sisa yang dibutuhkan').closest('[data-variant]')).toHaveTextContent('Rp 500 jt');
    expect(screen.getByText('Target APE bulan ini').closest('[data-variant]')).toHaveTextContent('Rp 100 jt');
    expect(screen.getByText('Polis per bulan').closest('[data-variant]')).toHaveTextContent('6polis');
    expect(screen.getByText('Polis per minggu').closest('[data-variant]')).toHaveTextContent('≈ 1,4');
    expect(screen.getByRole('button', {
      name: 'APE per closing. Naikkan jika satu janji temu sering menghasilkan lebih dari satu polis.',
    })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-3 UI-014 UI-017 the result card and the commitment in the report’s Indonesian sentence', async () => {
    show({ body: goal() });

    const card = await resultCard();
    const tiles = [...card.querySelectorAll('[data-result-tile]')].map((t) => t.textContent);
    expect(tiles).toEqual([
      '67Set appointment≈ 16/minggu',
      expect.stringMatching(/^20Sales meeting.*≈ 5\/minggu$/),
      '6Submission polis≈ 1,4/minggu',
    ]);
    expect(card).toHaveTextContent('Rp 100 jt');
    // UI-021: the activity a stage counts is the office's, as typed, behind the ⓘ.
    expect(within(card).getByRole('button', { name: 'Melakukan presentasi penjualan untuk calon atau existing nasabah' })).toBeInTheDocument();
    expect(screen.getByText('Terhubung ke aktivitas #3, #4, #6 di Activity Management.')).toBeInTheDocument();
    const sentence = await commitment();
    expect(sentence).toHaveTextContent(
      'Bulan ini APE Rp 100 jt (menuju Rp 500 jt tahun ini): 67 Set appointment, 20 Sales meeting, 6 Submission polis.',
    );
    expect([...sentence.querySelectorAll('strong')].map((b) => b.textContent))
      .toEqual(['Rp 100 jt', 'Rp 500 jt', '67 Set appointment', '20 Sales meeting', '6 Submission polis']);
    expect(screen.getByText('Perkiraan untuk perencanaan pribadi — asumsi berbeda untuk setiap orang.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 UI-016 offers the savings pair in Indonesian: a slider and − / +, the hint under it', async () => {
    show({ body: goal() });
    await userEvent.click(await screen.findByRole('tab', { name: 'Hitung dari target tabungan' }));

    expect(screen.getByRole('slider', { name: 'Target tabungan tahunan' })).toHaveAttribute('aria-valuetext', 'Rp 50 jt');
    expect(within(screen.getByRole('group', { name: 'Persentase komisi' })).getByText('10%')).toBeInTheDocument();
    expect(screen.getAllByText('% dari APE yang menjadi penghasilan / tabungan').some((el) => el.tagName === 'P')).toBe(true);
    expect(screen.getByText('Setara dengan target APE sebesar').closest('[data-variant]')).toHaveTextContent('Rp 500 jt');
    noEnglishLeft();
  });

  it('AC-1 says a goal a leader set, on the day, in Indonesian (ADR-0046)', async () => {
    show({ body: goal({ savedByMembershipId: 'mem-leader' }) });

    const leader = await screen.findByText('Diatur oleh leader Anda');
    expect(leader.tagName).toBe('STRONG');
    expect(leader.parentElement).toHaveTextContent(/^Diatur oleh leader Anda pada .+2026\. Anda dapat mengubahnya — ini rencana Anda\.$/);
    noEnglishLeft();
  });

  it('AC-1 says the target is passed rather than printing zeroes (ADR-0047)', async () => {
    show({ body: goal({ projected: met }) });

    expect(await screen.findByText('Anda sudah melampaui target tahunan Anda.')).toBeInTheDocument();
    expect(screen.getByText(/Atur yang baru di atas, atau terus melaju — tidak ada lagi yang diminta rencana ini dari Anda\./))
      .toBeInTheDocument();
    expect((await resultCard()).querySelectorAll('[data-result-tile]')).toHaveLength(0);
    noEnglishLeft();
  });

  it('AC-1 says which numbers it cannot work from', async () => {
    show({ body: goal({ projected: null }) });

    expect(await screen.findByText(
      'Rencana ini tidak dapat dihitung dari angka di atas. Periksa case size dan kedua tingkat konversi — masing-masing '
      + 'harus lebih dari nol.',
    )).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 UI-020 marks the office’s figure ⚡, its ⓘ saying whose, the month Indonesian (ADR-0063 §5)', async () => {
    show({ body: goal({ achieved: { minor: 120_000_000_00, provenance: 'imported', month: '2026-08' } }) });
    const why = await screen.findByRole('button', { name: 'Kenapa APE yang sudah dicapai tahun ini otomatis' });
    const field = why.closest('dl')!;
    expect(field.querySelector('dd')).toHaveTextContent(/^Rp 120 jt$/);
    expect(why).toHaveAccessibleDescription('Per Agu 2026');
    noEnglishLeft();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show({ body: goal({ achieved: { minor: 120_000_000_00, provenance: 'corrected', month: '2026-08' } }) });
    expect(await screen.findByRole('button', { name: 'Kenapa APE yang sudah dicapai tahun ini otomatis' }))
      .toHaveAccessibleDescription('Dikoreksi manual, sejak awal tahun per Agu 2026');
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show({ body: goal({ achieved: { minor: 120_000_000_00, provenance: 'corrected', month: '2026-08', correctedBy: { name: 'Sari Puspita' } } }) });
    expect(await screen.findByRole('button', { name: 'Kenapa APE yang sudah dicapai tahun ini otomatis' }))
      .toHaveAccessibleDescription('Dikoreksi oleh Sari Puspita, sejak awal tahun per Agu 2026');
  });

  it('AC-1 UI-019 says an edit is not yet saved, saved again once undone, and saved once it is', async () => {
    const { calls } = show([{ body: goal() }, { body: goal() }]);
    await resultCard();
    await userEvent.click(screen.getByRole('button', { name: 'Tambah Tingkat closing' }));
    expect(status()).toHaveTextContent('Belum disimpan');
    await userEvent.click(screen.getByRole('button', { name: 'Kurangi Tingkat closing' }));
    expect(status()).toHaveTextContent('Tersimpan ✓');
    await userEvent.click(screen.getByRole('button', { name: 'Tambah Tingkat closing' }));

    await userEvent.click(screen.getByRole('button', { name: 'Simpan goal' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PUT')).toBe(true));
    await waitFor(() => expect(status()).toHaveTextContent('Tersimpan ✓'));
    expect(await screen.findByText('Goal tersimpan ✓')).toBeInTheDocument();
  });

  it('AC-1 waits in the reader’s words', () => {
    stubFetch({});
    renderInIndonesian(<GoalCalculator period={null} />, { me: AGENT });
    expect(screen.getByRole('status')).toHaveTextContent('Memuat rencana Anda…');
  });
});

/**
 * **A coachee's *Goal Setting* tab** (P11-T7 AC-5): the same calculator about somebody else — *dia* and *-nya* whatever
 * their pronoun (§B.0 rule 8; T4 AC-3), the coaching tool's own questions, and no word naming the office (ADR-0084).
 */
describe('P18.98-T4 a coachee’s Goal Setting in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(['she', 'he', 'they'] as const)('AC-3 writes a coachee as dia whatever their pronoun (%s)', async (pronoun) => {
    coachee(goal(), pronoun);

    expect(await screen.findByRole('heading', { name: 'Berapa target APE-nya tahun ini?' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Progres saat ini' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Cara mengaturnya' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Komitmen (per 13 Sep 2026)' })).toBeInTheDocument();
    // UI-017: the report's sentence needs no pronoun.
    expect(await commitment()).toHaveTextContent('Bulan ini APE Rp 100 jt (menuju Rp 500 jt tahun ini): 67 Set appointment');
    // Her own figure, read-only to her leader (ADR-0075): the same pill, its ⓘ saying whose.
    expect(screen.getByRole('button', { name: 'Angkanya sendiri, diisi di Goal Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'APE yang sudah dicapai tahun ini' })).not.toBeInTheDocument();
    expect(screen.getByText(
      'Perubahan di sini langsung diperbarui di Personal Summary dan Coaching Session — ketiganya tetap selaras.',
    )).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bKPM\b/);
    noEnglishLeft();
  });

  it('AC-3 says she has passed her target, and names the upload without the office', async () => {
    coachee(goal({ projected: met, achieved: { minor: 120_000_000_00, provenance: 'corrected', month: '2026-08' } }));

    expect(await screen.findByText('Dia sudah melampaui target tahunannya.')).toBeInTheDocument();
    expect(screen.getByText(/tidak ada lagi yang diminta rencana ini darinya\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kenapa APE yang sudah dicapai tahun ini otomatis' }))
      .toHaveAccessibleDescription('Dikoreksi setelah unggahan produksi, sejak awal tahun per Agu 2026');
    expect(document.body.textContent).not.toMatch(/\bKPM\b/);
    noEnglishLeft();
  });

  it('AC-1 waits in the coachee’s words', () => {
    stubFetch({});
    renderInIndonesian(<GoalCalculator period={null} subject={{ membershipId: 'mem-rina', pronoun: 'he' }} />, { me: AGENT });
    expect(screen.getByRole('status')).toHaveTextContent('Memuat rencananya…');
  });
});
