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
 * mounts — the five steps, *Simpan goal* and its status, the cascade, the commitment and every state a plan can be in —
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

const show = (goals: unknown) => {
  const stub = stubFetch({ ...BASE, '/goals': goals } as Parameters<typeof stubFetch>[0]);
  renderInIndonesian(<AgentLayout><GoalSettingsPage /></AgentLayout>, { me: AGENT });
  return stub;
};
const coachee = (body: unknown, pronoun: 'she' | 'he' | 'they' = 'she') => {
  stubFetch({ ...BASE, '/goals': { body } } as Parameters<typeof stubFetch>[0]);
  renderInIndonesian(<GoalCalculator period={PERIOD} subject={{ membershipId: 'mem-rina', pronoun }} />, { me: AGENT });
};
const commitment = async () => (await screen.findByText(/^Untuk mencapai/)).closest('p')!;

describe('P18.98-T4 Goal Settings in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 asks the five steps in Indonesian, §A.4’s labels and the cascade’s stages kept English', async () => {
    show({ body: goal() });

    expect(await screen.findByRole('heading', { level: 1, name: 'Goal Settings' })).toBeInTheDocument();
    expect(screen.getByText('Ubah target tahunan Anda menjadi angka aktivitas bulan ini.')).toBeInTheDocument();
    for (const name of [
      'Berapa target APE Anda tahun ini?', 'Progres Anda saat ini', 'Dari APE ke jumlah polis', 'Conversion assumptions',
      'Monthly activity target', 'Komitmen saya (per 13 Sep 2026)',
    ]) {
      expect(await screen.findByRole('heading', { name })).toBeInTheDocument();
    }
    const modes = screen.getByRole('tablist', { name: 'Cara Anda ingin mengaturnya' });
    expect(within(modes).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Atur target APE langsung', 'Hitung dari target tabungan']);
    // The save and its status, beside it.
    const save = screen.getByRole('button', { name: 'Simpan goal' });
    expect(within(save.parentElement!).getByRole('status')).toHaveTextContent('Tersimpan');
    // §A.4's KPI labels, kept; every figure the reader's: *500.000.000*, *Rp 500 jt*, *≈ 1,4*.
    expect(screen.getByLabelText('Annual APE target')).toHaveValue('500.000.000');
    expect(screen.getByRole('textbox', { name: 'APE already produced this year' })).toBeInTheDocument();
    expect(screen.getByLabelText('Appointment to Sales meeting')).toHaveValue('30');
    expect(screen.getByLabelText('Closing rate')).toBeInTheDocument();
    expect(screen.getByText('Sisa yang dibutuhkan').closest('[data-variant]')).toHaveTextContent('Rp 500 jt');
    expect(screen.getByText("This month's APE target").closest('[data-variant]')).toHaveTextContent('Rp 100 jt');
    expect(screen.getByText('Policies per month').closest('[data-variant]')).toHaveTextContent('6polis');
    expect(screen.getByText('Policies per week').closest('[data-variant]')).toHaveTextContent('≈ 1,4');
    // The months: the label, its *auto* badge, the box's unit and the office's figure as its placeholder.
    const months = screen.getByLabelText(/^Sisa bulan tahun ini/);
    expect(months).toHaveAttribute('placeholder', '5');
    expect(screen.getByText('otomatis')).toBeInTheDocument();
    expect(screen.getByText('bulan')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByLabelText('Rata-rata case size (APE per polis)')).toHaveValue('18.000.000');
    expect(screen.getByRole('button', {
      name: 'APE per closing. Naikkan jika satu janji temu sering menghasilkan lebih dari satu polis.',
    })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-3 writes the cascade and the commitment as whole Indonesian sentences, figures and kept terms in place', async () => {
    show({ body: goal() });

    const panels = [...(await screen.findAllByText(/\/bulan$/))].map((p) => p.closest('[class*="text-center"]')!.textContent);
    expect(panels).toEqual([
      expect.stringMatching(/^Set appointment.*67\/bulan≈ 16\/minggu$/),
      expect.stringMatching(/^Sales meeting.*20\/bulan≈ 5\/minggu$/),
      expect.stringMatching(/^Submission polis.*6\/bulan≈ 1,4\/minggu$/),
    ]);
    // AC-4: the activity a stage counts is the office's, as typed.
    expect(screen.getByText('Melakukan presentasi penjualan untuk calon atau existing nasabah')).toBeInTheDocument();
    expect(screen.getByText('Terhubung ke aktivitas #3, #4, #6 di Activity Management.')).toBeInTheDocument();
    const sentence = await commitment();
    expect(sentence).toHaveTextContent(
      'Untuk mencapai APE Rp 500 jt tahun ini (sekitar 5 bulan lagi), target bulan ini adalah APE Rp 100 jt — saya akan '
      + 'menghubungi 67 leads, mendapatkan 20 janji temu, dan closing 6 polis bulan ini.',
    );
    // Every figure bold and amber, as in English.
    expect([...sentence.querySelectorAll('strong')].map((b) => b.textContent))
      .toEqual(['Rp 500 jt', 'Rp 100 jt', '67 leads', '20 janji temu', '6 polis']);
    expect(screen.getByText('Perkiraan untuk perencanaan pribadi — asumsi berbeda untuk setiap orang.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-3 counts one lead in the singular, a kept noun’s English plural otherwise (§B.0 rule 8)', async () => {
    show({ body: goal({ projected: projection({ leadsPerMonth: 1 }) }) });
    expect(await commitment()).toHaveTextContent('saya akan menghubungi 1 lead, mendapatkan');
  });

  it.each([
    [0.3, '(kurang dari sebulan lagi)'],
    [1.2, '(sekitar 1 bulan lagi)'],
    [11.9, '(sekitar 12 bulan lagi)'],
  ])('P18.95-T5 AC-5 in Indonesian: %s months left reads %s', async (monthsLeft, words) => {
    show({ body: goal({ monthsLeft }) });
    expect(await commitment()).toHaveTextContent(words);
  });

  it('AC-1 offers the savings pair in Indonesian, its two labels kept', async () => {
    show({ body: goal() });
    await userEvent.click(await screen.findByRole('tab', { name: 'Hitung dari target tabungan' }));

    expect(screen.getByLabelText('Annual savings target')).toHaveValue('50.000.000');
    expect(screen.getByLabelText('Commission rate')).toHaveAccessibleDescription('% dari APE yang menjadi penghasilan / tabungan');
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
    expect(screen.queryByText('Set appointment')).not.toBeInTheDocument();
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

  it('AC-1 marks the office’s figure, its correction and who made it, the month Indonesian (ADR-0063 §5)', async () => {
    show({ body: goal({ achieved: { minor: 120_000_000_00, provenance: 'imported', month: '2026-08' } }) });
    const field = (await screen.findByRole('button', { name: 'Per Agu 2026' })).closest('dl')!;
    expect(field).toHaveTextContent(/^APE already produced this year.*Rp 120\.000\.000$/);
    noEnglishLeft();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show({ body: goal({ achieved: { minor: 120_000_000_00, provenance: 'corrected', month: '2026-08' } }) });
    expect(await screen.findByRole('button', { name: 'Dikoreksi manual, sejak awal tahun per Agu 2026' })).toBeInTheDocument();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';

    show({ body: goal({ achieved: { minor: 120_000_000_00, provenance: 'corrected', month: '2026-08', correctedBy: { name: 'Sari Puspita' } } }) });
    expect(await screen.findByRole('button', { name: 'Dikoreksi oleh Sari Puspita, sejak awal tahun per Agu 2026' })).toBeInTheDocument();
  });

  it('AC-1 says an edit is not yet saved, and saved once it is', async () => {
    const { calls } = show([{ body: goal() }, { body: goal() }]);
    await userEvent.type(await screen.findByLabelText('Annual APE target'), '1');
    const status = () => within(screen.getByRole('button', { name: 'Simpan goal' }).parentElement!).getByRole('status');
    expect(status()).toHaveTextContent('Belum disimpan');

    await userEvent.click(screen.getByRole('button', { name: 'Simpan goal' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PUT')).toBe(true));
    await waitFor(() => expect(status()).toHaveTextContent('Tersimpan'));
    expect(status()).not.toHaveTextContent('Belum');
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
    expect(await commitment()).toHaveTextContent('— dia akan menghubungi 67 leads');
    expect(screen.getByRole('button', { name: 'Angkanya sendiri, diisi di Goal Settings' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Dikoreksi setelah unggahan produksi, sejak awal tahun per Agu 2026' }))
      .toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bKPM\b/);
    noEnglishLeft();
  });

  it('AC-1 waits in the coachee’s words', () => {
    stubFetch({});
    renderInIndonesian(<GoalCalculator period={null} subject={{ membershipId: 'mem-rina', pronoun: 'he' }} />, { me: AGENT });
    expect(screen.getByRole('status')).toHaveTextContent('Memuat rencananya…');
  });
});
