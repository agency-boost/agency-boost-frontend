import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import type { BillingKpmList, BillingKpmRow, BillingPrices } from '@/lib/billing';
import BillingPage from './page';

const query = { current: new URLSearchParams() };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/billing',
  useSearchParams: () => query.current,
}));

const rp = (major: number) => major * 100;
const PRICES: BillingPrices = {
  currency: 'IDR',
  tiers: [
    { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10, standardMinor: rp(500_000), offerMinor: rp(400_000), customPricing: false },
    { code: 'TIER_11_20', minLeaders: 11, maxLeaders: 20, standardMinor: rp(475_000), offerMinor: rp(375_000), customPricing: false },
    { code: 'TIER_21_50', minLeaders: 21, maxLeaders: 50, standardMinor: rp(450_000), offerMinor: rp(350_000), customPricing: false },
    { code: 'TIER_51_100', minLeaders: 51, maxLeaders: 100, standardMinor: rp(425_000), offerMinor: rp(300_000), customPricing: false },
    { code: 'TIER_101_PLUS', minLeaders: 101, maxLeaders: null, standardMinor: null, offerMinor: null, customPricing: true },
  ],
  annualDiscountPct: 5, trialDays: 30, graceDays: 7, endingSoonDays: 30, daysPerMonth: 30, perDayRoundingMinor: rp(100),
  bulkPercentMax: 100, noteMax: 500, kpmNameMax: 120, countMax: 10_000, rateMaxMinor: rp(100_000_000),
  breakEven: { policyApeMinor: rp(20_000_000), commissionPct: 20, overridingPct: 10, bonusPct: 10, incomePerPolicyMinor: rp(8_000_000) },
};

const row = (over: Partial<BillingKpmRow>): BillingKpmRow => ({
  kpmId: 'kpm-1', code: '0417', branch: 'BSD City Branch', company: { id: 'co-1', name: 'Prudential' }, kpmStatus: 'active',
  owner: { fullName: 'Wilson Tanoto', phone: '+6281234567890' }, leadersUsed: 9, maxLeaders: 10,
  tier: { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10 }, rateMinor: rp(400_000), customPrice: false, plan: 'six_months',
  trial: false, startDate: '2026-07-29', endDate: '2027-01-28', perMonthMinor: rp(3_600_000), periodTotalMinor: rp(21_600_000),
  graceEndsOn: null, attention: null, needsAction: false, agents: null, bulkDiscount: null, note: null, ...over,
});
const BSD = row({});
const TANGERANG = row({
  kpmId: 'kpm-2', code: '0603', branch: 'Tangerang Branch', leadersUsed: 11, plan: 'annual', endDate: '2027-03-15',
  perMonthMinor: rp(4_180_000), periodTotalMinor: rp(50_160_000), attention: 'over', needsAction: true,
  owner: { fullName: 'Hendra Gunawan', phone: '+6281111111111' },
});
const MAGNI = row({
  kpmId: 'kpm-3', code: '1234', branch: 'Magni', leadersUsed: 1, maxLeaders: null, rateMinor: null, plan: null, trial: true,
  endDate: '2026-11-30', perMonthMinor: null, periodTotalMinor: null, attention: 'trial', needsAction: true, owner: null,
});
const LIST: BillingKpmList = {
  summary: { monthlyRevenueMinor: rp(7_780_000), payingKpms: 2, leadersBilled: 20, endingSoon: 1, needsAction: 2, kpms: 3 },
  total: { kpms: 3, leadersUsed: 21, weightedRateMinor: rp(400_000), perMonthMinor: rp(7_780_000), periodTotalMinor: rp(71_760_000), needsAction: 2 },
  rows: [BSD, MAGNI, TANGERANG],
};

const ME = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.id', fullName: 'PLATFORM OPERATOR', preferredName: null,
    pronoun: 'they', initials: 'PO', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'billing:read_prices', 'billing:send_quote', 'kpm:update_subscription'],
});

const stubBilling = (over: Record<string, unknown> = {}) => stubFetch({
  '/admin/billing/prices': { body: PRICES },
  '/admin/billing/kpms': { body: LIST },
  ...over,
} as never);

/** The result card, by its name. */
const result = () => screen.getByRole('region', { name: 'Harga' });

describe('Langganan & akses (P19.23-T5)', () => {
  beforeEach(() => {
    query.current = new URLSearchParams();
    // 10:00 on 20 November 2026 in Jakarta.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T03:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('P19.23-T5 AC-1 opens on the Kalkulator, the tabs in the client’s order', async () => {
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    expect(await screen.findByRole('heading', { name: 'Kalkulator harga' })).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Bagian Langganan & akses' })).getAllByRole('link');
    expect(tabs.map((t) => t.textContent)).toEqual(['Kalkulator', 'Paket & harga', 'Langganan per KPM']);
    expect(tabs[0]).toHaveAttribute('aria-current', 'page');
    expect(tabs.map((t) => t.getAttribute('href'))).toEqual(['/admin/billing', '/admin/billing?tab=harga', '/admin/billing?tab=kpm']);
  });

  // Found 2026-11-20: *KPM* and *Catatan* kept a bare input's own width, half their column, beside fields that fill it.
  it('draws KPM and Catatan the width of their column, as every field above them', async () => {
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('heading', { name: 'Kalkulator harga' });
    expect(screen.getByRole('combobox', { name: 'KPM' })).toHaveClass('w-full');
    expect(screen.getByRole('textbox', { name: 'Catatan' })).toHaveClass('w-full');
  });

  it('P19.23-T5 AC-2 frame 43: 15 leaders, Tahunan — the total, Harga normal struck through, the tiles, Hemat and Balik modal', async () => {
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('heading', { name: 'Kalkulator harga' });
    const card = result();
    expect(card).toHaveTextContent('Total 1 tahun');
    expect(within(card).getAllByText('Rp 85.500.000').some((el) => el.tagName === 'S')).toBe(true);
    expect(card).toHaveTextContent('Rp 64.125.000');
    expect(card).toHaveTextContent('15 leader');
    expect(card).toHaveTextContent('Hemat Rp 21.375.000 (25%) dari harga standar');
    expect(card).toHaveTextContent('Rp 5.343.750per bulan');
    expect(card).toHaveTextContent('Rp 11.900per leader / hari');
    expect(card).toHaveTextContent('Harga normal (15 × Rp 475.000 × 12)');
    expect(card).toHaveTextContent('Diskon harga → Rp 375.000− Rp 18.000.000');
    expect(card).toHaveTextContent('Hemat tahunan 5%− Rp 3.375.000');
    const breakEven = screen.getByRole('region', { name: 'Balik modal jika 1 KPM jual tambahan' });
    expect(breakEven).toHaveTextContent('8,0 polis / tahun');
    expect(breakEven).toHaveTextContent('0,7 polis / bulan');
    expect(breakEven).toHaveTextContent('1 polis APE Rp 20.000.000: komisi 20% Rp 4.000.000 + overriding 10% Rp 2.000.000 + bonus 10% Rp 2.000.000 = Rp 8.000.000');
    // The plan the leaders fall in: 11–20, PAKET INI.
    const current = within(screen.getByRole('list', { name: 'Paket' })).getAllByRole('listitem').find((li) => li.getAttribute('aria-current'));
    expect(current).toHaveTextContent('PAKET INI');
    expect(current).toHaveTextContent('11–20 leader');
    // Start today; the end the year's last day.
    expect(screen.getByLabelText('Mulai')).toHaveValue('2026-11-20');
    expect(screen.getByLabelText('Berakhir')).toHaveValue('2027-11-19');
  });

  it('P19.23-T5 AC-2 frame 45: agents fill per agent / hari and are never billed', async () => {
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('heading', { name: 'Kalkulator harga' });
    const leaders = screen.getByLabelText('Jumlah leader');
    await userEvent.clear(leaders);
    await userEvent.type(leaders, '22');
    await userEvent.type(screen.getByLabelText('Jumlah agent'), '80');
    const card = result();
    expect(card).toHaveTextContent('Rp 87.780.000');
    expect(card).toHaveTextContent('22 leader · 80 agent');
    expect(card).toHaveTextContent('Rp 3.000per agent / hari');
  });

  it('P19.23-T5 AC-2 frame 51: 6 bulan, the price typed as the total, and the price per leader derived', async () => {
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('heading', { name: 'Kalkulator harga' });
    await userEvent.clear(screen.getByLabelText('Jumlah leader'));
    await userEvent.type(screen.getByLabelText('Jumlah leader'), '11');
    await userEvent.click(screen.getByRole('button', { name: '6 bulan' }));
    expect(screen.getByLabelText('Berakhir')).toHaveValue('2027-05-19');
    await userEvent.click(screen.getByRole('button', { name: 'isi total' }));
    const total = screen.getByLabelText('Total 6 bulan');
    await userEvent.clear(total);
    await userEvent.type(total, '24750000');
    expect(total).toHaveValue('24.750.000');
    expect(screen.getByText('= Rp 375.000 per leader / bulan')).toBeInTheDocument();
    expect(result()).toHaveTextContent('Hemat Rp 6.600.000 (21%) dari harga standar');
  });

  it('P19.23-T5 AC-2 a bulk discount in percent comes off after the annual discount', async () => {
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('heading', { name: 'Kalkulator harga' });
    const bulk = screen.getByLabelText('Diskon bulk order');
    await userEvent.clear(bulk);
    await userEvent.type(bulk, '10');
    expect(result()).toHaveTextContent('Diskon bulk order 10%− Rp 6.412.500');
    expect(result()).toHaveTextContent('Rp 57.712.500');
  });

  it('P19.23-T5 AC-3 101+ is Harga khusus: the price is typed, and nothing is shown until it is', async () => {
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('heading', { name: 'Kalkulator harga' });
    await userEvent.clear(screen.getByLabelText('Jumlah leader'));
    await userEvent.type(screen.getByLabelText('Jumlah leader'), '120');
    expect(result()).toHaveTextContent('Harga khusus: isi harga untuk tim ini');
    await userEvent.type(screen.getByLabelText('Harga / leader / bulan'), '250000');
    expect(result()).toHaveTextContent('Rp 342.000.000');
    expect(result()).not.toHaveTextContent('Harga normal');
  });

  it('P19.23-T5 AC-2 Pakai untuk KPM needs an existing KPM, then writes the package the server prices', async () => {
    const stub = stubBilling({ 'PUT /admin/billing/kpms/kpm-2/subscription': { body: { ...TANGERANG, maxLeaders: 15, attention: null } } });
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('heading', { name: 'Kalkulator harga' });
    await userEvent.click(screen.getByRole('button', { name: 'Pakai untuk KPM' }));
    expect(await screen.findByText('Pilih KPM yang sudah ada untuk memakai paket ini.')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('combobox', { name: 'KPM' }), 'Tange');
    await userEvent.click(screen.getByRole('option', { name: /Tangerang Branch/ }));
    // Its leaders fill in: 11.
    expect(screen.getByLabelText('Jumlah leader')).toHaveValue('11');
    await userEvent.click(screen.getByRole('button', { name: 'Pakai untuk KPM' }));
    const put = stub.calls.find((c) => c.init.method === 'PUT')!;
    expect(JSON.parse(String(put.init.body))).toEqual({
      leaders: 11, agents: null, plan: 'annual', price: { mode: 'per_leader', rateMinor: rp(375_000) }, bulk: null,
      startDate: '2026-11-20', endDate: '2027-11-19', note: null,
    });
  });

  it('P19.23-T5 AC-2 Kirim penawaran opens WhatsApp to the Owner of the KPM picked, with the offer', async () => {
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('heading', { name: 'Kalkulator harga' });
    await userEvent.type(screen.getByRole('combobox', { name: 'KPM' }), 'BSD');
    await userEvent.click(screen.getByRole('option', { name: /BSD City Branch/ }));
    const link = screen.getByRole('link', { name: 'Kirim penawaran' });
    const href = link.getAttribute('href')!;
    expect(href.startsWith('https://wa.me/6281234567890?text=')).toBe(true);
    const text = decodeURIComponent(href.split('?text=')[1]);
    expect(text).toContain('Halo Wilson Tanoto,');
    // 9 leaders at the 1–10 offer price, Tahunan: 9 × Rp 400.000 × 12, less 5%.
    expect(text).toContain('Total: Rp 41.040.000');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('P19.23-T5 AC-2 Buat PDF sends the inputs and the new KPM’s name, and saves the file', async () => {
    const created = vi.fn(() => 'blob:offer');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }));
    const stub = stubBilling({ 'POST /admin/billing/offer': { body: new Blob(['%PDF-'], { type: 'application/pdf' }) } });
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('heading', { name: 'Kalkulator harga' });
    await userEvent.click(screen.getByRole('button', { name: 'Buat PDF' }));
    expect(await screen.findByText('Pilih KPM atau tulis nama KPM baru.')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('combobox', { name: 'KPM' }), 'Serpong Branch');
    await userEvent.click(screen.getByRole('button', { name: 'Buat PDF' }));
    const post = stub.calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(String(post.init.body))).toMatchObject({ kpmName: 'Serpong Branch', leaders: 15, plan: 'annual' });
    await vi.waitFor(() => expect(created).toHaveBeenCalled());
  });

  it('P19.23-T5 AC-2 an end before the start is said under the dates, and nothing can be confirmed', async () => {
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('heading', { name: 'Kalkulator harga' });
    const end = screen.getByLabelText('Berakhir');
    await userEvent.clear(end);
    await userEvent.type(end, '2026-11-01');
    expect(await screen.findByText('Isi tanggal berakhir yang sama dengan atau setelah tanggal mulai.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buat PDF' })).toBeDisabled();
  });

  it('P19.23-T5 AC-3 Paket & harga: the five tiers, the period, the trial and the note — no Ubah', async () => {
    query.current = new URLSearchParams('tab=harga');
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    const table = await screen.findByRole('table', { name: 'Paket dan harga' });
    const rows = within(table).getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(rows).toEqual([
      '1–10 leaderRp 500.000 /leader/blnRp 400.000 /leader/bln20%',
      '11–20 leaderRp 475.000 /leader/blnRp 375.000 /leader/bln21%',
      '21–50 leaderRp 450.000 /leader/blnRp 350.000 /leader/bln22%',
      '51–100 leaderRp 425.000 /leader/blnRp 300.000 /leader/bln29%',
      '101+ leaderHarga khususdiatur per KPM',
    ]);
    expect(screen.getByText('Gratis 30 hari untuk KPM baru')).toBeInTheDocument();
    expect(screen.getByText(/Diskon tahunan/)).toHaveTextContent('Diskon tahunan 5%');
    expect(screen.getByText('Harga peluncuran — terkunci untuk pendaftaran sebelum Mar 2027')).toBeInTheDocument();
    expect(screen.queryByText('Ubah')).toBeNull();
  });

  it('P19.23-T5 AC-4 Langganan per KPM: the summary, the Total row, a row per KPM with its one pill', async () => {
    query.current = new URLSearchParams('tab=kpm');
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    const table = await screen.findByRole('table', { name: 'Langganan per KPM' });
    const summary = screen.getByRole('region', { name: 'Ringkasan' });
    expect(summary).toHaveTextContent('Pendapatan per bulanRp 7.780.000dari 2 KPM berbayar');
    expect(summary).toHaveTextContent('Perlu tindakan2lewat batas · berakhir');
    const [, total, bsd, magni, tangerang] = within(table).getAllByRole('row');
    expect(total).toHaveTextContent('Total · 3 KPM');
    expect(total).toHaveTextContent('Rp 400.000rata-rata tertimbang');
    expect(total).toHaveTextContent('2 perlu tindakan');
    expect(bsd).toHaveTextContent('BSD City BranchPrudential');
    expect(bsd).toHaveTextContent('Rp 21.600.0006 bulan');
    expect(magni).toHaveTextContent('Trial');
    expect(tangerang).toHaveTextContent('Melewati batas');
    expect(tangerang).toHaveTextContent('tahunan · diskon 5%');
    expect(within(tangerang).getByRole('img', { name: '11 dari 10 leader dipakai' })).toBeInTheDocument();
    expect(screen.getByText('Tidak diperpanjang 7 hari setelah berakhir = KPM otomatis ditangguhkan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semua 3' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('P19.23-T5 AC-4 Perlu tindakan asks the server for those rows', async () => {
    query.current = new URLSearchParams('tab=kpm');
    const stub = stubBilling({ '/admin/billing/kpms?filter=needs_action': { body: { ...LIST, rows: [MAGNI, TANGERANG] } } });
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('table', { name: 'Langganan per KPM' });
    await userEvent.click(screen.getByRole('button', { name: 'Perlu tindakan 2' }));
    await vi.waitFor(() => expect(stub.calls.some((c) => c.url.includes('filter=needs_action'))).toBe(true));
    expect(await screen.findByText('Magni')).toBeInTheDocument();
  });

  it('P19.23-T5 AC-4 Atur opens the calculator for that KPM: Konfirmasi paket writes it and the list reloads', async () => {
    query.current = new URLSearchParams('tab=kpm');
    const stub = stubBilling({ 'PUT /admin/billing/kpms/kpm-2/subscription': { body: { ...TANGERANG, attention: null } } });
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('table', { name: 'Langganan per KPM' });
    await userEvent.click(screen.getByRole('button', { name: 'Atur langganan Tangerang Branch' }));
    const dialog = await screen.findByRole('dialog', { name: 'Langganan Tangerang Branch' });
    expect(dialog).toHaveTextContent('Prudential · 11 leader aktif');
    expect(within(dialog).queryByRole('combobox')).toBeNull();
    expect(within(dialog).getByLabelText('Jumlah leader')).toHaveValue('11');
    // The confirmed price fills in: Rp 400.000, and it is not the tier's.
    expect(within(dialog).getByLabelText('Harga / leader / bulan')).toHaveValue('400.000');
    const before = stub.calls.filter((c) => c.url.includes('/admin/billing/kpms') && (c.init.method ?? 'GET') === 'GET').length;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Konfirmasi paket' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const put = stub.calls.find((c) => c.init.method === 'PUT')!;
    expect(JSON.parse(String(put.init.body))).toMatchObject({ leaders: 11, price: { mode: 'per_leader', rateMinor: rp(400_000) } });
    await vi.waitFor(() => expect(
      stub.calls.filter((c) => c.url.includes('/admin/billing/kpms') && (c.init.method ?? 'GET') === 'GET').length,
    ).toBeGreaterThan(before));
  });

  it('P19.23-T5 AC-2 a refused save is said in the dialog, and nothing closes', async () => {
    query.current = new URLSearchParams('tab=kpm');
    stubBilling({
      'PUT /admin/billing/kpms/kpm-2/subscription': {
        status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'Isi harga.', requestId: 'r-1', details: { field: 'price.rateMinor' } } },
      },
    });
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('table', { name: 'Langganan per KPM' });
    await userEvent.click(screen.getByRole('button', { name: 'Atur langganan Tangerang Branch' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Konfirmasi paket' }));
    expect(await within(dialog).findByText('Paket tidak dapat disimpan.')).toBeInTheDocument();
  });

  it('P19.23-T5 every state: the price list failing says so and retries', async () => {
    stubFetch({
      '/admin/billing/prices': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'r-2' } } },
        { body: PRICES },
      ],
      '/admin/billing/kpms': { body: LIST },
    });
    renderInIndonesian(<BillingPage />, { me: ME });
    expect(await screen.findByText('Data ini tidak dapat dimuat.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByRole('heading', { name: 'Kalkulator harga' })).toBeInTheDocument();
  });

  it('P19.23-T5 every state: no KPM yet, and nothing needing action', async () => {
    query.current = new URLSearchParams('tab=kpm');
    stubBilling({
      '/admin/billing/kpms': { body: { ...LIST, rows: [], summary: { ...LIST.summary, kpms: 0 }, total: { ...LIST.total, kpms: 0 } } },
    });
    renderInIndonesian(<BillingPage />, { me: ME });
    expect(await screen.findByText('Belum ada KPM.')).toBeInTheDocument();
  });

  it('P19.23-T7 AC-1 on a phone: the tabs one row of equal widths, the result above the form, the plan cards last', async () => {
    atWidth(390);
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    await screen.findByRole('heading', { name: 'Kalkulator harga' });
    const tabs = within(screen.getByRole('navigation', { name: 'Bagian Langganan & akses' })).getAllByRole('link');
    expect(tabs.map((t) => t.textContent)).toEqual(['Kalkulator', 'Paket & harga', 'Langganan']);
    const card = result();
    const leaders = screen.getByLabelText('Jumlah leader');
    const plans = screen.getByRole('list', { name: 'Paket' });
    expect(card.compareDocumentPosition(leaders) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(leaders.compareDocumentPosition(plans) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /*
   * **P19.26-T6 AC-2 (UI-218 (21 Nov)): the calculator on a phone** — no *Kalkulator harga* (the tab says it), the two
   * days one under the other so neither is cut, *Kirim penawaran* on one line. jsdom applies no media query: the classes.
   */
  it('P19.26-T6 AC-2 on a phone: no Kalkulator harga heading, the days stacked, Kirim penawaran on one line', async () => {
    atWidth(375);
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    const heading = await screen.findByRole('heading', { name: 'Kalkulator harga' });
    expect(heading.closest('[data-calculator-head]')).toHaveClass('max-md:hidden');
    expect(document.querySelector('[data-calculator-dates]')).toHaveClass('max-md:flex-col', 'max-md:items-stretch');
    const send = document.querySelector('[data-send-offer]') as HTMLElement;
    expect(send).toHaveTextContent('Kirim penawaran');
    expect(send).toHaveClass('max-md:whitespace-nowrap');
  });

  it('P19.23-T7 AC-1 on a phone Langganan per KPM is cards, each value under its column’s name', async () => {
    atWidth(390);
    query.current = new URLSearchParams('tab=kpm');
    stubBilling();
    renderInIndonesian(<BillingPage />, { me: ME });
    const cards = await screen.findByRole('list', { name: 'Langganan per KPM' });
    expect(screen.queryByRole('table')).toBeNull();
    const tangerang = within(cards).getAllByRole('listitem')[3];
    expect(tangerang).toHaveTextContent('Leader dipakai11 / 10');
    expect(tangerang).toHaveTextContent('Berlaku hingga15 Mar 2027Melewati batas');
  });

  it('P19.23-T5 reads in English for a reader who chose it', async () => {
    stubBilling();
    renderWithSession(<BillingPage />, { me: ME });
    expect(await screen.findByRole('heading', { name: 'Price calculator' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create PDF' })).toBeInTheDocument();
  });
});
