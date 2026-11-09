import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AgentLayout from '@/app/(agent)/layout';
import { renderInIndonesian, renderInLayout, routeParams, stubFetch } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { CATALOG, CERAH, itemOf, MEDICAL, proposal, RINA, ROSA, row, SHELL, WULAN } from '@test/proposal-fixtures';
import { leadsMessages } from '@/i18n/messages/leads';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import { proposalMessages } from '@/i18n/messages/proposal';
import ProposalPage from './page';
import NewProposalPage from './new/page';
import ProposalStepsPage from './[proposalId]/page';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), search: '', pathname: '/proposal' }));
/** `pdf.js` is the browser's: a two-page file (P19.7-T3). */
vi.mock('@/lib/pdf-pages', () => ({
  openPdf: async () => ({
    pages: 2,
    draw: async (_n: number, _c: HTMLCanvasElement, cssWidth: number) => ({ cssWidth, cssHeight: cssWidth * 1.414, text: 'Ringkasan' }),
    close: () => {},
  }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useParams: () => ({}),
}));

/** The module's English that ID mode must not show: the proposal's own, the strip's, the stepper's. */
const ENGLISH = englishOnly(proposalMessages, productCatalogMessages, leadsMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);
/** axe, as `screens.a11y.spec.tsx` runs it: jsdom samples no pixels, so contrast is the tokens' spec's. */
const clean = async () => {
  const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
  expect(results.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.html.slice(0, 160)).join(" | ")}`)).toEqual([]);
};

const stubs = () => stubFetch({
  ...SHELL,
  'GET /proposals?': { body: { rows: [row(), row({ id: 'p-2', status: 'draft', client: { name: 'Pak Hendro' } })], total: 2, page: 1, pageSize: 20 } },
  'GET /leads?': { body: { rows: [ROSA, WULAN], total: 2, page: 1, pageSize: 50 } },
  'GET /proposals/p-1': {
    body: proposal({ items: [itemOf(MEDICAL, { itemId: 'i-med', plan: 'Gold' }), itemOf(CERAH, { itemId: 'i-cerah' })] }),
  },
  'GET /proposals/catalog': { body: { products: CATALOG } },
  'GET /proposals/p-1/pdf': { body: new Blob(['%PDF-1.3'], { type: 'application/pdf' }) },
});

/**
 * **P19.7-T2 the proposal in Indonesian** (P18.10-T7 AC-1; the spec's words verbatim): *Riwayat*, step 1 and step 2 read
 * in the approved Indonesian — *Buat proposal*, *Untuk siapa?*, *Klien baru*, *Umur belum ada*, *Konvensional / Syariah*,
 * *Cara bayar*, *Tertanggung*, *Premi per bulan*, *Lihat di ilustrasi resmi*, *Lihat semua plan*, *Tanya-jawab* — with no
 * English of ours left, and each clean under axe. In English: each page's own spec.
 */
describe('P19.7-T2 the proposal in Indonesian', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    try { window.sessionStorage.clear(); } catch { /* jsdom has it */ }
  });
  afterEach(() => vi.unstubAllGlobals());

  it('/proposal (id): Riwayat, the strip’s third tab, the statuses and the main action in Indonesian', async () => {
    nav.pathname = '/proposal';
    nav.search = '';
    stubs();
    renderInIndonesian(<AgentLayout><ProposalPage /></AgentLayout>, { me: RINA });
    await screen.findByText('Ibu Rosa Damayanti');
    expect(within(screen.getByRole('navigation', { name: 'Sales tools' })).getAllByRole('link').map((l) => l.textContent))
      .toEqual(['Sales Attack Plan', 'Product Catalog', 'Proposal']);
    expect(screen.getByText('Selesai')).toBeInTheDocument();
    expect(screen.getByText('Draf')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buat proposal' })).toHaveAttribute('href', '/proposal/new');
    expect(screen.getByRole('searchbox', { name: 'Cari proposal' })).toBeInTheDocument();
    noEnglishLeft();
    await clean();
  });

  it('/proposal (id, empty): Buat proposal pertama', async () => {
    nav.pathname = '/proposal';
    nav.search = '';
    stubFetch({ ...SHELL, 'GET /proposals?': { body: { rows: [], total: 0, page: 1, pageSize: 20 } } });
    renderInIndonesian(<AgentLayout><ProposalPage /></AgentLayout>, { me: RINA });
    expect(await screen.findByRole('link', { name: 'Buat proposal pertama' })).toBeInTheDocument();
    noEnglishLeft();
    await clean();
  });

  it('/proposal/new (id): Untuk siapa?, Klien baru, Umur belum ada and its card, Lanjut', async () => {
    nav.pathname = '/proposal/new';
    nav.search = '';
    stubs();
    renderInIndonesian(<AgentLayout><NewProposalPage /></AgentLayout>, { me: RINA });
    expect(await screen.findByRole('heading', { level: 2, name: 'Untuk siapa?' })).toBeInTheDocument();
    const steps = screen.getByRole('list', { name: 'Langkah' });
    expect(within(steps).getAllByRole('listitem').map((s) => s.textContent)).toEqual(['11 Klien', '22 Produk', '33 PDF']);
    await userEvent.click(await screen.findByRole('radio', { name: /Ibu Wulan Sari/ }));
    expect(screen.getByText('Umur belum ada')).toBeInTheDocument();
    expect(screen.getByText('Umur dan jenis kelamin belum ada di lead ini. Isi sekali, nanti tersimpan di lead.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Umur ulang tahun berikutnya' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Laki-laki' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lanjut' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali' })).toBeInTheDocument();
    noEnglishLeft();
    await clean();
    await userEvent.click(screen.getByRole('button', { name: 'Klien baru' }));
    expect(screen.getByRole('textbox', { name: 'Nama' })).toBeInTheDocument();
    noEnglishLeft();
    await clean();
  });

  it('/proposal/[proposalId] (id): Pilih produk, the settings, the cards and a panel in Indonesian', async () => {
    nav.pathname = '/proposal/p-1';
    nav.search = 'step=2';
    stubs();
    renderInIndonesian(
      <AgentLayout><ProposalStepsPage params={routeParams({ proposalId: 'p-1' })} /></AgentLayout>,
      { me: RINA },
    );
    expect(await screen.findByRole('heading', { level: 2, name: 'Pilih produk' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Konvensional atau Syariah' })).toHaveTextContent('KonvensionalSyariah');
    expect(within(screen.getByRole('group', { name: 'Cara bayar' })).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['Bulanan', 'Kuartalan', 'Semesteran', 'Tahunan']);
    expect(await screen.findByRole('group', { name: 'Tertanggung' })).toHaveTextContent('KlienPasanganAnakOrang lain');
    expect(screen.getByRole('textbox', { name: 'Premi per bulan' })).toBeInTheDocument();
    expect(screen.getByText('Lihat di ilustrasi resmi')).toBeInTheDocument();
    noEnglishLeft();
    await clean();
  });

  it('/proposal/[proposalId] (id, the plans and the FAQ): Lihat semua plan, Paling banyak dipilih, Tanya-jawab', async () => {
    nav.pathname = '/proposal/p-1';
    nav.search = 'step=2';
    stubFetch({
      ...SHELL,
      'GET /proposals/p-1': { body: proposal({ items: [itemOf(MEDICAL, { itemId: 'i-med', plan: 'Gold' })] }) },
      'GET /proposals/catalog': { body: { products: CATALOG } },
    });
    renderInIndonesian(
      <AgentLayout><ProposalStepsPage params={routeParams({ proposalId: 'p-1' })} /></AgentLayout>,
      { me: RINA },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Lihat semua plan' }));
    const sheet = await screen.findByRole('dialog', { name: 'Plan PRUWell Medical' });
    expect(sheet).toHaveTextContent('Paling banyak dipilih');
    expect(sheet).toHaveTextContent('Premi: lihat ilustrasi resmi');
    noEnglishLeft();
    await clean();
  });

  it('/proposal/[proposalId] (id, step 3): Lihat PDF, its pages, Simpan PDF, Ubah and Tampilkan total premi (P19.7-T3)', async () => {
    nav.pathname = '/proposal/p-1';
    nav.search = 'step=3';
    stubs();
    renderInIndonesian(
      <AgentLayout><ProposalStepsPage params={routeParams({ proposalId: 'p-1' })} /></AgentLayout>,
      { me: RINA },
    );
    expect(await screen.findByRole('heading', { level: 2, name: 'Lihat PDF' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Halaman 1 dari 2' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Halaman proposal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ubah' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan PDF' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Tampilkan total premi' })).not.toBeChecked();
    noEnglishLeft();
    await clean();
  });

  it('the pages in English pass axe too (Riwayat, step 1, step 2)', async () => {
    nav.pathname = '/proposal';
    nav.search = '';
    stubs();
    const first = renderInLayout(AgentLayout, <ProposalPage />, { me: RINA });
    await screen.findByText('Ibu Rosa Damayanti');
    await clean();
    first.unmount();
    nav.pathname = '/proposal/p-1';
    nav.search = 'step=2';
    renderInLayout(AgentLayout, <ProposalStepsPage params={routeParams({ proposalId: 'p-1' })} />, { me: RINA });
    await screen.findByRole('group', { name: 'Insured' });
    await clean();
  });
});
