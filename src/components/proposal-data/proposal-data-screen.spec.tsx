import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type {
  ProductDataDetail, ProductDataOverview, ProductDataRow, RateRules, RateTableView,
} from '@/lib/product-data';
import type { ProposalItem } from '@/lib/proposals';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { ProposalDataScreen } from './proposal-data-screen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/companies/co-1/proposal',
}));

const ME = makeMe({ membership: null, permissions: ['product_data:read', 'product_data:manage'] });
const RULES: RateRules = {
  upStep: 100_000_000, upMin: 10_000_000_000, upMax: null, premiumMin: null, premiumMax: null, entryAgeMin: 1, entryAgeMax: 60,
  payTermMaxAge: { y10: 60 },
};

const row = (over: Partial<ProductDataRow> = {}): ProductDataRow => ({
  productId: 'p-pcb', code: 'PRUCRITICAL_BENEFIT_88', name: 'PCB88', category: 'ci', isSyariah: false, calcType: 'up_premium',
  lifecycle: 'active', status: 'ready', checkReasons: [],
  table: { state: 'active', id: 't-1', version: 1, effectiveFrom: '2026-04-01', effectiveTo: null, gapCount: 0, scheduledFrom: '2026-12-12' },
  illustration: { state: 'none', blocks: 0 }, ...over,
});

const OVERVIEW: ProductDataOverview = {
  company: { id: 'co-1', name: 'Prudential' }, canManage: true,
  counters: { check: 1, manual: 1, ready: 1, withdrawn: 0 },
  lastUpdated: { at: '2026-11-12T03:00:00.000Z', by: { id: 'u-1', name: 'Sari Admin' } },
  products: [
    row({ productId: 'p-cinta', code: 'PRUCINTA', name: 'PRUCinta', status: 'check', checkReasons: ['gaps'], table: { state: 'gaps', id: 't-9', version: 1, effectiveFrom: '2026-07-01', effectiveTo: null, gapCount: 3, scheduledFrom: null } }),
    row({ productId: 'p-anug', code: 'PRUANUGERAH_SYARIAH', name: 'PRU Anugerah Syariah', isSyariah: true, status: 'manual', calcType: 'up_premium', table: { state: 'none', id: null, version: null, effectiveFrom: null, effectiveTo: null, gapCount: 0, scheduledFrom: null }, illustration: { state: 'published', blocks: 3 } }),
    row(),
  ],
};

const version = (over: Partial<RateTableView> = {}): RateTableView => ({
  id: 't-1', productId: 'p-pcb', version: 1, status: 'active', effectiveFrom: '2026-04-01', effectiveTo: null,
  source: { fileName: 'Contoh tarif PCB88 2026.xlsx', type: 'xlsx' }, uploadedAt: '2026-11-12T03:00:00.000Z',
  uploadedBy: { id: 'u-1', name: 'Sari Admin' }, activatedAt: '2026-11-12T03:00:00.000Z', activatedBy: { id: 'u-1', name: 'Sari Admin' },
  turnedOffAt: null, turnedOffBy: null, basis: 'per_mille', mapped: true, rowCount: 460, gaps: [], gapCount: 0,
  testCases: [], overrideReason: null, rules: RULES, frequencies: { monthly: 0.09, quarterly: 0.27, semiannual: 0.52, annual: 1 },
  rulesSource: 'ketentuan', rulesConfirmed: true, used: true, file: null,
  previous: { rules: RULES, frequencies: { monthly: null, quarterly: null, semiannual: null, annual: null }, from: 'catalogue', version: null },
  ...over,
});

const DETAIL = (over: Partial<ProductDataDetail> = {}): ProductDataDetail => ({
  product: {
    id: 'p-pcb', code: 'PRUCRITICAL_BENEFIT_88', name: 'PCB88', category: 'ci', channel: 'conventional', isSyariah: false,
    lifecycle: 'active', version: 3, currencies: ['IDR'], kind: 'base',
    rules: {
      proposalFields: [], planOptions: [], syariahName: null, defaultInsured: null, proposalTypeLabel: null, currencies: ['IDR'],
      calcType: 'up_premium', entryAge: { min: 1, max: 60 },
      payTerms: [{ key: 'y10', label: '10 tahun', years: 10, toAge: null, single: false, maxEntryAge: 60, default: true }],
      frequencies: [], smokerRated: false, planRule: null, upStep: 100_000_000, upMin: 10_000_000_000, upMax: null,
      premiumMin: null, premiumMax: null, needTag: null,
    },
  },
  canManage: true, catalogueRules: RULES, inForce: version(), scheduled: null, versions: [version()], ...over,
});

const DRAFT = version({
  id: 't-2', version: 2, status: 'draft', activatedAt: null, activatedBy: null, mapped: false, rowCount: 0, used: false,
  rulesSource: 'ketentuan', rulesConfirmed: false, rules: { ...RULES, upMin: 15_000_000_000 },
  file: {
    header: ['Usia', 'Jenis kelamin', 'Tarif per 1.000 UP'], columnMap: { Usia: 'age', 'Jenis kelamin': 'gender', 'Tarif per 1.000 UP': 'rate' },
    preview: [['35', 'L', '12,43']], rows: 120, ketentuan: true, ketentuanProblems: [{ row: 5, label: 'Diskon', value: '5%' }],
  },
  previous: { rules: RULES, frequencies: { monthly: null, quarterly: null, semiannual: null, annual: null }, from: 'version', version: 1 },
});

const item = (over: Partial<ProposalItem> = {}): ProposalItem => ({
  itemId: 'try-1', productId: 'p-pcb', productCode: 'PRUCRITICAL_BENEFIT_88', productVersion: 3, name: 'PCB88', plan: null,
  currency: 'IDR',
  snapshot: {
    name: 'PCB88', syariahName: null, typeLabel: 'PENYAKIT KRITIS', category: 'ci', needTag: 'CRITICAL_INCOME', isSyariah: false,
    calcType: 'up_premium', currencies: ['IDR'], fields: [], planRule: null,
    payTerms: [{ key: 'y10', label: '10 tahun', years: 10, toAge: null, single: false, maxEntryAge: 60, default: true }],
    frequencies: ['monthly', 'quarterly', 'semiannual', 'annual'], smokerRated: false, entryAge: { min: 1, max: 60 },
    limits: { upStep: null, upMin: null, upMax: null, premiumMin: null, premiumMax: null }, benefits: [], pdfDetail: [],
  },
  insured: { relation: 'client', name: null, age: null, gender: null }, smoker: null, fieldValues: {}, payTerm: 'y10',
  payFrequency: 'monthly', up: null, premium: null, fixedField: 'none', rateTableVersionId: null, rateTableEffectiveFrom: null,
  calcNote: null, totalPaid: null, choice: null,
  calc: { mode: 'table', state: 'needs_amount', tableId: 't-1', effectiveFrom: '2026-04-01', frequencies: ['monthly', 'annual'], limit: null, stepMinor: null, missing: null, ageBounds: null },
  ...over,
});
const BOX = { title: 'PCB88', typeLabel: 'PENYAKIT KRITIS', who: 'Untuk: Klien', premium: 'Rp 559.350', per: 'per bulan', pill: 'per bulan · 10 tahun', source: 'Tabel tarif berlaku 1 April 2026', rows: [{ label: 'Masa bayar', value: '10 tahun', kind: 'value' as const }], protection: [], facts: [] };

beforeEach(() => atWidth(1280));
afterEach(() => vi.unstubAllGlobals());

describe('P19.15-T4 AC-1 the Proposal tab', () => {
  const base = { '/product-data/companies/co-1/intakes': { body: { aiReading: true, intakes: [] } } };

  it('P19.15-T4 AC-1 four counters that filter, the last change, one row per product with its pills', async () => {
    stubFetch({ ...base, '/product-data/companies/co-1/products': { body: OVERVIEW } });
    renderInIndonesian(<ProposalDataScreen companyId="co-1" canManage />, { me: ME });
    const counters = await screen.findByRole('group', { name: 'Produk menurut status' });
    expect(within(counters).getAllByRole('button').map((b) => b.textContent)).toEqual(['1Perlu dicek', '1Ketik manual', '1Siap hitung', '0Ditarik']);
    expect(screen.getByText(/Terakhir diperbarui: .* oleh Sari Admin/)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Produk Prudential untuk proposal' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[4].textContent)).toEqual(['Perlu dicek', 'Ketik manual', 'Siap hitung']);
    expect(within(rows[0]).getByText('Ada celah')).toHaveAttribute('data-tone', 'amber');
    expect(within(rows[1]).getByText('Belum ada', { selector: '[data-tone="grey"]' })).toBeInTheDocument();
    expect(within(rows[1]).getByText('Ada · 3 bagian')).toHaveAttribute('data-tone', 'green');
    expect(within(rows[1]).getByText('Syariah')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Berlaku 1 Apr 2026')).toHaveAttribute('data-tone', 'green');
    expect(within(rows[2]).getByText('Tarif baru mulai 12 Des 2026')).toBeInTheDocument();
    expect(within(rows[2]).getByText('UP ↔ premi')).toBeInTheDocument();
    await userEvent.click(within(counters).getByRole('button', { name: /Siap hitung/ }));
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Tampilkan semua produk' }));
    expect(within(table).getAllByRole('row')).toHaveLength(4);
  });

  it('P19.15-T4 AC-1 rows become cards on a phone', async () => {
    atWidth(375);
    stubFetch({ ...base, '/product-data/companies/co-1/products': { body: OVERVIEW } });
    renderWithSession(<ProposalDataScreen companyId="co-1" canManage />, { me: ME });
    const list = await screen.findByRole('list', { name: 'Prudential’s products for proposals' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('P19.15-T4 AC-3 read-only for a reader who may not manage: says so, no upload', async () => {
    stubFetch({
      ...base,
      '/product-data/companies/co-1/products/p-pcb': { body: DETAIL({ canManage: false }) },
      '/product-data/companies/co-1/products': { body: { ...OVERVIEW, canManage: false } },
    });
    renderWithSession(<ProposalDataScreen companyId="co-1" canManage={false} />, { me: ME });
    expect(await screen.findByText('You can see this insurer’s proposal data but not change it.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open PCB88' }));
    await userEvent.click(await screen.findByRole('tab', { name: 'Premium table' }));
    expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn off' })).not.toBeInTheDocument();
    expect(screen.getByText('Version 1 in force from 1 Apr 2026')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    stubFetch({ ...base, '/product-data/companies/co-1/products': { body: OVERVIEW } });
    const { container } = renderInIndonesian(<ProposalDataScreen companyId="co-1" canManage />, { me: ME });
    await screen.findByRole('table');
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});

describe('P19.15-T1 a product: Isian, Tabel premi, Uji coba', () => {
  const open = async (routes: Record<string, unknown>) => {
    const stub = stubFetch({
      '/product-data/companies/co-1/intakes': { body: { aiReading: true, intakes: [] } },
      '/product-data/companies/co-1/products': { body: OVERVIEW },
      ...routes,
    } as never);
    renderInIndonesian(<ProposalDataScreen companyId="co-1" canManage />, { me: ME });
    await userEvent.click(await screen.findByRole('button', { name: 'Buka PCB88' }));
    return stub;
  };

  it('P19.15-T1 AC-4 Isian: the catalogue’s rules as forms, the table’s rules beside them, saved pinned', async () => {
    const { calls } = await open({
      'GET /product-data/companies/co-1/products/p-pcb': { body: DETAIL() },
      'PATCH /product-data/companies/co-1/products/p-pcb/rules': { body: DETAIL() },
    });
    expect(await screen.findByText(/Ketentuan tabel premi yang berlaku \(versi 1, mulai 1 Apr 2026\)/)).toBeInTheDocument();
    const upMin = screen.getByLabelText('UP minimum');
    expect(upMin).toHaveValue('100000000');
    await userEvent.clear(upMin);
    await userEvent.type(upMin, '150000000');
    await userEvent.click(screen.getByLabelText('Merokok berpengaruh?'));
    await userEvent.click(screen.getByRole('button', { name: 'Simpan isian' }));
    await screen.findByText('Tersimpan.');
    const sent = JSON.parse(String(calls.find((c) => c.init.method === 'PATCH')!.init.body));
    expect(sent).toMatchObject({ expectedVersion: 3, upMin: 15_000_000_000, smokerRated: true, calcType: 'up_premium' });
    expect(sent).not.toHaveProperty('faq');
    expect(sent).not.toHaveProperty('pdfDetail');
  });

  it('P19.15-T1 AC-1 Tabel premi: the template, the upload with Berlaku mulai, then the columns confirmed with every unreadable cell named', async () => {
    const { calls } = await open({
      'GET /product-data/companies/co-1/products/p-pcb': [{ body: DETAIL() }, { body: DETAIL({ versions: [DRAFT, version()] }) }],
      'POST /product-data/companies/co-1/products/p-pcb/rate-tables': { status: 201, body: DRAFT },
      'GET /product-data/companies/co-1/rate-tables/t-2': { body: DRAFT },
      'PATCH /product-data/companies/co-1/rate-tables/t-2': {
        status: 422, body: { error: { code: 'RATE_TABLE_ROWS_INVALID', message: '1 sel', details: { count: 1, problems: [{ row: 7, column: 'Jenis kelamin', value: 'X', reason: 'gender' }] } } },
      },
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Tabel premi' }));
    expect(screen.getByText(/Unggah tabel tarif resmi/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unduh template (Excel)' })).toBeInTheDocument();
    const upload = screen.getByRole('button', { name: 'Unggah' });
    expect(upload).toBeDisabled();
    await userEvent.upload(screen.getByLabelText('File (Excel atau CSV)'), new File(['Usia;Tarif'], 'tarif.csv', { type: 'text/csv' }));
    const from = screen.getByLabelText('Berlaku mulai');
    await userEvent.type(from, '2026-12-01');
    await waitFor(() => expect(upload).toBeEnabled());
    await userEvent.click(upload);
    const step2 = await screen.findByRole('region', { name: '2. Cocokkan kolom' });
    expect(within(step2).getByRole('combobox', { name: 'Usia' })).toHaveValue('age');
    expect(within(step2).getByText('12,43')).toBeInTheDocument();
    const form = calls.find((c) => c.init.method === 'POST')!.init.body as FormData;
    expect(form.get('effectiveFrom')).toBe('2026-12-01');
    await userEvent.click(within(step2).getByRole('button', { name: 'Konfirmasi kolom' }));
    expect(await within(step2).findByText(/Baris 7, Jenis kelamin: “X”/)).toBeInTheDocument();
    expect(within(step2).getByText(/bukan jenis kelamin/)).toBeInTheDocument();
  });

  it('P19.15-T1 AC-1, AC-2, AC-4 the gaps in plain words, Ketentuan old → new, three examples, activation needing a reason', async () => {
    const mapped: RateTableView = {
      ...DRAFT, mapped: true, rowCount: 120, gapCount: 3,
      gaps: [
        { kind: 'ages', from: 61, to: 65 }, { kind: 'combination', plan: 'MAX', payTerm: 'y15', payTermLabel: '15 tahun' }, { kind: 'smoker' },
      ],
      testCases: [0, 1, 2].map((i) => ({
        inputs: { age: 35, gender: 'male' as const, smoker: null, plan: null, payTerm: 'y10', payFrequency: 'monthly' as const, amountMinor: 50_000_000_000 },
        expectedMinor: 55_935_000, actualMinor: i === 2 ? 55_000_000 : 55_935_000, match: i !== 2,
      })),
    };
    const { calls } = await open({
      'GET /product-data/companies/co-1/products/p-pcb': { body: DETAIL({ versions: [mapped, version()] }) },
      'GET /product-data/companies/co-1/rate-tables/t-2': { body: mapped },
      'PATCH /product-data/companies/co-1/rate-tables/t-2': { body: { ...mapped, rulesConfirmed: true } },
      'POST /product-data/companies/co-1/rate-tables/t-2/activate': { body: { ...mapped, status: 'scheduled' } },
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Tabel premi' }));
    const gaps = await screen.findByRole('region', { name: '3. Cek kelengkapan' });
    expect(within(gaps).getByText('Usia 61–65 tidak ada di tabel')).toBeInTheDocument();
    expect(within(gaps).getByText('Plan MAX, bayar 15 tahun tidak ada')).toBeInTheDocument();
    expect(within(gaps).getByText('Tarif perokok tidak ada, padahal produk ini ‘Merokok berpengaruh’')).toBeInTheDocument();
    const rules = screen.getByRole('region', { name: 'Ketentuan' });
    expect(within(rules).getByText(/Dibaca dari sheet Ketentuan/)).toBeInTheDocument();
    expect(within(rules).getByText(/Diskon: “5%”/)).toBeInTheDocument();
    expect(within(rules).getByText(/Sekarang: Rp 100 Jt → Tabel ini: Rp 150 Jt/)).toBeInTheDocument();
    await userEvent.click(within(rules).getByRole('button', { name: 'Simpan ketentuan' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    const step4 = screen.getByRole('region', { name: '4. Uji 3 contoh' });
    expect(within(step4).getAllByText(/✓ Sama/)).toHaveLength(2);
    expect(within(step4).getByText('Berbeda')).toBeInTheDocument();
    const activate = within(step4).getByRole('button', { name: 'Aktifkan' });
    expect(activate).toBeDisabled();
    await userEvent.type(within(step4).getByLabelText('Alasan tetap mengaktifkan'), 'Ilustrasi pakai tarif lama');
    await userEvent.click(activate);
    await waitFor(() => {
      const call = calls.find((c) => c.url.endsWith('/activate'));
      expect(JSON.parse(String(call!.init.body))).toEqual({ overrideReason: 'Ilustrasi pakai tarif lama' });
    });
  });

  it('P19.15-T1 AC-3 versions: Berlaku · Terjadwal · Lama, who uploaded it; turning one off asks first', async () => {
    const { calls } = await open({
      'GET /product-data/companies/co-1/products/p-pcb': { body: DETAIL({ versions: [version({ id: 't-3', version: 3, status: 'scheduled', used: false }), version(), version({ id: 't-0', version: 0, status: 'old' })] }) },
      'POST /product-data/companies/co-1/rate-tables/t-1/turn-off': { body: version({ status: 'off' }) },
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Tabel premi' }));
    const list = screen.getByRole('region', { name: 'Versi' });
    expect(within(list).getAllByText(/^(Terjadwal|Berlaku|Lama)$/).map((n) => n.textContent)).toEqual(['Terjadwal', 'Berlaku', 'Lama']);
    expect(within(list).getAllByText(/Diunggah Sari Admin/)).toHaveLength(3);
    // A version a proposal used offers no delete.
    expect(within(list).getAllByRole('button', { name: 'Hapus' })).toHaveLength(1);
    await userEvent.click(within(list).getAllByRole('button', { name: 'Matikan' })[1]);
    const dialog = await screen.findByRole('dialog', { name: 'Matikan versi ini?' });
    expect(within(dialog).getByText(/Proposal yang sudah dibuat tetap memakai angkanya/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Matikan' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/t-1/turn-off'))).toBe(true));
  });

  it('P19.15-T1 AC-7 Uji coba: the agent’s card, each change sent with its state, the PDF box under it', async () => {
    const calculated = item({
      up: { amountMinor: 50_000_000_000, currency: 'IDR' }, premium: { amountMinor: 55_935_000, currency: 'IDR' }, fixedField: 'up',
      rateTableVersionId: 't-1', rateTableEffectiveFrom: '2026-04-01',
      calc: { mode: 'table', state: 'ok', tableId: 't-1', effectiveFrom: '2026-04-01', frequencies: ['monthly', 'annual'], limit: null, stepMinor: null, missing: null, ageBounds: null },
    });
    const { calls } = await open({
      'GET /product-data/companies/co-1/products/p-pcb': { body: DETAIL() },
      'POST /product-data/companies/co-1/products/p-pcb/try': [{ body: { item: item(), box: { ...BOX, premium: null } } }, { body: { item: calculated, box: BOX } }],
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Uji coba' }));
    const up = await screen.findByLabelText('Uang pertanggungan');
    await userEvent.type(up, '500000000');
    await userEvent.tab();
    expect(await screen.findByText('Rp 559.350', { exact: false })).toBeInTheDocument();
    const last = JSON.parse(String(calls.filter((c) => c.url.endsWith('/try')).at(-1)!.init.body));
    expect(last).toMatchObject({ age: 35, gender: 'male', patch: { up: { amountMinor: 50_000_000_000 } }, state: { payTerm: 'y10' } });
    expect(screen.getByText('Tabel tarif berlaku 1 April 2026')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Kotak PDF' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hapus PCB88/ })).not.toBeInTheDocument();
  });
});
