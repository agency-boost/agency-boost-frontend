import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInIndonesian, renderWithLanguage, resetLanguage, stubFetch } from '@test/harness';
import { TenantConfigProvider } from '@/lib/tenant-config-cache';
import RatioBenchmarksPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/ratio-benchmarks',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['tenant_config:read', 'tenant_config:write'],
});

const ratio = (over: Record<string, unknown>) => ({
  numerator: ['SELL_SUBMISSION'], denominator: ['SELL_PRESENTATION'], displayOrder: 1, version: 1, status: 'active',
  origin: 'platform', appliesToOrgLevelCodes: [], standardNumerator: ['SELL_SUBMISSION'],
  standardDenominator: ['SELL_PRESENTATION'], divergesFromStandard: false, ...over,
});

const RATIOS = [
  ratio({
    id: 'r1', code: 'SELLING_SUCCESS_RATE', label: 'Selling success rate', benchmark: 0.155, comparison: 'gte',
    displayUnit: 'percent', denominator: ['LEADS_CONTACTED'], divergesFromStandard: true,
  }),
  ratio({
    id: 'r2', code: 'SELLING_VS_RECRUITMENT', label: 'Selling vs Recruitment', benchmark: 25, comparison: 'band',
    displayUnit: 'points', denominator: ['RECRUIT_AGENT_CODE'], appliesToOrgLevelCodes: ['AB'],
  }),
  ratio({
    id: 'r3', code: 'REFERRAL_RATE', label: 'Referral rate', benchmark: 0.5, comparison: 'gte', displayUnit: 'decimal',
    origin: 'office', standardNumerator: null, standardDenominator: null,
  }),
];

const LADDER = [
  { orgLevelId: 'l1', companyId: 'co-1', code: 'AGENT', label: 'Agent', displayOrder: 1, status: 'active', archivedAt: null },
  { orgLevelId: 'l2', companyId: 'co-1', code: 'AB', label: 'AB', displayOrder: 2, status: 'active', archivedAt: null },
];

/** The office's own sections and types, in its own words: they name a balance's sides and a formula's chips. */
const TAXONOMY = [
  {
    id: 'c1', code: 'SELLING', label: 'Penjualan', displayOrder: 1, version: 1, status: 'active',
    types: [
      { id: 't1', code: 'SELL_SUBMISSION', categoryCode: 'SELLING', label: 'Submission polis', description: null, displayOrder: 1, version: 1, status: 'active' },
      { id: 't2', code: 'SELL_PRESENTATION', categoryCode: 'SELLING', label: 'Presentasi penjualan', description: null, displayOrder: 2, version: 1, status: 'active' },
      { id: 't4', code: 'LEADS_CONTACTED', categoryCode: 'SELLING', label: 'Menghubungi leads', description: null, displayOrder: 4, version: 1, status: 'active' },
    ],
  },
  {
    id: 'c2', code: 'RECRUITMENT', label: 'Rekrutmen', displayOrder: 2, version: 1, status: 'active',
    types: [
      { id: 't3', code: 'RECRUIT_AGENT_CODE', categoryCode: 'RECRUITMENT', label: 'Proses NPA', description: null, displayOrder: 3, version: 1, status: 'active' },
    ],
  },
];

const ROUTES = {
  '/kpm/settings/ratio-benchmarks': { body: RATIOS },
  '/kpm/settings/activity-types': { body: TAXONOMY },
  '/kpm/config': { body: { activity: TAXONOMY, ratios: RATIOS, leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: LADDER },
  '/kpm/settings/publish-state': {
    body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
  },
};

const page = () => <TenantConfigProvider><RatioBenchmarksPage /></TenantConfigProvider>;
const card = (name: string) => screen.getByRole('heading', { name }).closest('div')!.parentElement!;

const ENGLISH = /\b(On track|Applies to|Everyone|Change who it applies to|Edit|Archive|Show archived|Add a ratio|Calculated on|Provisioned with|Your office|This is not your company|Agents see|points?)\b/;

/**
 * **P18.98-T4, Settings › Ratio benchmarks in ID mode**: the screen's words the approved glossary's Indonesian, its
 * title, tabs, *ratio* and *benchmark* English (§A), the office's names as typed — and **its figures in the reader's
 * language** (P18.98-T3): *15,5%*, *0,50*, *±25 poin*, *37,5%*. In English: `page.spec.tsx`.
 */
describe('P18.98-T4 Settings › Ratio benchmarks in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 says every card in Indonesian, its figures written as Indonesian writes them', async () => {
    stubFetch(ROUTES);
    renderInIndonesian(page(), { me: OWNER });
    await screen.findByRole('heading', { name: 'Selling success rate' });

    expect(screen.getByRole('heading', { name: 'Ratio benchmarks', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Activity types' })).toBeInTheDocument();
    expect(screen.getByText('Yang dihitung setiap ratio, dan apa yang dianggap sesuai target.')).toBeInTheDocument();
    expect(screen.getByText('Dihitung dari aktivitas 30 hari terakhir.')).toBeInTheDocument();
    expect(within(card('Selling success rate')).getByText('15,5%')).toBeInTheDocument();
    expect(within(card('Selling success rate')).getByText(/^Sesuai target jika minimal/)).toBeInTheDocument();
    expect(within(card('Selling vs Recruitment')).getByText('±25 poin')).toBeInTheDocument();
    expect(within(card('Referral rate')).getByText('0,50')).toBeInTheDocument();
    expect(within(card('Selling vs Recruitment')).getByText(/^Berlaku untuk/).closest('p')).toHaveTextContent('Berlaku untuk AB');
    expect(within(card('Referral rate')).getByText(/^Berlaku untuk/).closest('p')).toHaveTextContent('Berlaku untuk Semua orang');
    expect(screen.getAllByRole('button', { name: 'Ubah untuk siapa ini berlaku' })).toHaveLength(3);
    expect(document.body.textContent).not.toMatch(ENGLISH);
  });

  it('AC-3 says a balance by its sections as typed, and how agents read it with the band in Indonesian', async () => {
    stubFetch(ROUTES);
    renderInIndonesian(page(), { me: OWNER });
    const balance = card(await screen.findByText('Selling vs Recruitment').then((h) => h.textContent!));

    expect(within(balance).getByText('Penjualan')).toBeInTheDocument();
    expect(within(balance).getByText('Rekrutmen')).toBeInTheDocument();
    expect(within(balance).getByText(
      'Agent melihat porsi setiap sisi dari keduanya — sesuai target selama setiap sisi berada di antara 37,5% dan 62,5%.',
    )).toBeInTheDocument();
  });

  it('AC-3 names a moved formula by its types, as typed, in an Indonesian sentence', async () => {
    stubFetch(ROUTES);
    renderInIndonesian(page(), { me: OWNER });
    await screen.findByRole('heading', { name: 'Selling success rate' });

    expect(screen.getByText('Ini bukan lagi standar perusahaan Anda.')).toBeInTheDocument();
    expect(screen.getByText(/^Awalnya diatur sebagai Submission polis ÷ Presentasi penjualan\./)).toBeInTheDocument();
    expect(screen.getAllByText(/^Disediakan dengan standar perusahaan Anda\./)).toHaveLength(2);
    expect(screen.getByText(/^Milik KPM Anda sendiri/)).toBeInTheDocument();
  });

  it('AC-1 edits a benchmark with its unit and its hint in Indonesian, the input in Indonesian marks', async () => {
    stubFetch(ROUTES);
    renderInIndonesian(page(), { me: OWNER });
    await userEvent.click(within(card(await screen.findByText('Referral rate').then((h) => h.textContent!)))
      .getByRole('button', { name: 'Ubah' }));

    const benchmark = screen.getByLabelText('Benchmark');
    expect(benchmark).toHaveValue('0,5');
    expect(benchmark).toHaveAccessibleDescription('Sesuai target jika minimal angka ini.');
    const unit = screen.getByLabelText('Ditampilkan sebagai');
    expect(within(unit).getAllByRole('option').map((o) => o.textContent)).toEqual(['Persentase — 15%', 'Angka — 0,30']);
    await userEvent.selectOptions(unit, 'percent');
    expect(benchmark).toHaveValue('50');
    expect(benchmark).toHaveAccessibleDescription('Sesuai target jika minimal angka ini, dalam persentase — 15 berarti 15%.');
  });

  it('AC-1 adds a balance in Indonesian, its sides Sisi A and Sisi B and the band read as it is typed', async () => {
    stubFetch(ROUTES);
    renderInIndonesian(page(), { me: OWNER });
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah ratio' }));

    expect(screen.getByRole('heading', { name: 'Tambah ratio' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Jenis' })).toBeInTheDocument();
    expect(screen.getByLabelText('Ratio (A dibagi B)')).toBeChecked();
    expect(screen.getByRole('group', { name: 'Yang dihitung' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Dari' })).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Keseimbangan (A dibanding B)'));

    expect(screen.getByRole('group', { name: 'Sisi A' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Sisi B' })).toBeInTheDocument();
    const band = screen.getByLabelText('Dalam batas, ke kedua arah');
    expect(band).toHaveAccessibleDescription('Poin persentase ke kedua arah dari pembagian rata.');
    await userEvent.type(band, '25');
    expect(band).toHaveAccessibleDescription(
      'Poin persentase ke kedua arah dari pembagian rata: setiap sisi antara 37,5% dan 62,5%.',
    );
    expect(screen.getByRole('button', { name: 'Tambah ratio ini' })).toBeDisabled();
  });

  it('AC-1 shows the published copy in Indonesian, the bar’s button named as the bar names it', async () => {
    stubFetch(ROUTES);
    renderInIndonesian(page(), { me: OWNER });
    await userEvent.click(await screen.findByRole('button', { name: 'Lihat yang dilihat agent sekarang' }));

    expect(screen.getByRole('heading', { name: 'Yang dilihat agent sekarang' })).toBeInTheDocument();
    const lead = screen.getByText(/^Salinan yang diterbitkan\./);
    expect(lead).toHaveTextContent('Salinan yang diterbitkan. Salinan ini hanya berubah saat Anda menekan Terbitkan ke agent — bukan saat Anda menyimpan.');
    expect(within(lead).getByText('Terbitkan ke agent').tagName).toBe('STRONG');
    expect(screen.getByText(/— sesuai target jika dalam/).closest('li')).toHaveTextContent('Selling vs Recruitment — sesuai target jika dalam ±25 poin');
    expect(screen.getByRole('button', { name: 'Sembunyikan yang dilihat agent' })).toBeInTheDocument();
  });

  it('AC-1 says an office with no ratio in Indonesian', async () => {
    stubFetch({ ...ROUTES, '/kpm/settings/ratio-benchmarks': { body: [] } });
    renderInIndonesian(page(), { me: OWNER });
    expect(await screen.findByText('Belum ada ratio')).toBeInTheDocument();
  });
});

/**
 * **P18.98-T3's rule on this screen, now that P18.98-T4 wired it**: under the app's own provider, a reader who chose
 * nothing while the switch is not live reads English words and **Indonesian figures** — the screen as it was — and
 * one who chose English reads English figures too.
 */
describe('P18.98-T4 Ratio benchmarks’ figures follow the reader’s choice', () => {
  afterEach(() => { vi.unstubAllGlobals(); resetLanguage(); });

  it('not live and unchosen: English words, Indonesian figures, as before the phase', async () => {
    stubFetch(ROUTES);
    renderWithLanguage(page(), { me: OWNER }, { live: false });
    await screen.findByRole('heading', { name: 'Selling success rate' });

    expect(screen.getByText('15,5%')).toBeInTheDocument();
    expect(screen.getByText('0,50')).toBeInTheDocument();
    expect(screen.getByText('±25 points')).toBeInTheDocument();
    expect(screen.getAllByText(/^On track at or above/).length).toBeGreaterThan(0);
  });
});
