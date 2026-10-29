import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { InLanguage, renderInIndonesian, renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { notFound, PGB, product, RINA_ME, SCRIPT, serverError, SHELF, SHELL_STUBS } from '@test/sales-tools-fixtures';
import { isKept } from '@/i18n/kept';
import { planMessages } from '@/i18n/messages/plan';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import ProductCatalogLayout from './layout';
import ProductCatalogPage from './page';
import ProductDrawerPage from './[productCode]/page';

const nav = vi.hoisted(() => ({
  push: vi.fn(), replace: vi.fn(), back: vi.fn(), pathname: '/product-catalog', search: '',
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useParams: () => ({}),
}));

type Routes = Record<string, StubReply | StubReply[]>;

/** The module's English that ID mode must not show: the catalog's own, and the plan blocks its drawer draws. */
const CATALOG_ENGLISH = englishOnly(productCatalogMessages, planMessages);
const noEnglishLeft = () => expect(englishShown(document.body, CATALOG_ENGLISH)).toEqual([]);

/** The grid alone, at `/product-catalog`, in Indonesian. */
function grid(routes: Routes = {}) {
  nav.pathname = '/product-catalog';
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /product-catalog': { body: { products: SHELF } }, ...routes });
  renderInIndonesian(<AgentLayout><ProductCatalogLayout><ProductCatalogPage /></ProductCatalogLayout></AgentLayout>, { me: RINA_ME });
  return stub;
}

/** The drawer over the grid, at `/product-catalog/{code}`, in Indonesian. */
function drawer(code: string, routes: Routes = {}) {
  nav.pathname = `/product-catalog/${code}`;
  const stub = stubFetch({
    ...SHELL_STUBS,
    'GET /product-catalog': { body: { products: SHELF } },
    [`GET /product-catalog/${code}`]: { body: product() },
    ...routes,
  });
  renderInIndonesian(
    <AgentLayout>
      <ProductCatalogLayout><ProductDrawerPage params={routeParams({ productCode: code })} /></ProductCatalogLayout>
    </AgentLayout>,
    { me: RINA_ME },
  );
  return stub;
}

const shelfReady = () => screen.findByRole('heading', { level: 2, name: 'Life' });
const dialog = (name = 'PRUMapan') => screen.findByRole('dialog', { name });

/**
 * **P18.98-T4, the Product Catalog and its drawer in ID mode** (field selling; ADR-0179 §3–§6): the screen's words the
 * approved glossary's Indonesian, its title, tabs and categories English (§A), every product as the company or the office
 * typed it, and a commission rate in the reader's figures. In English: `page.spec.tsx`.
 */
describe('P18.98-T4 the Product Catalog in Indonesian', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    nav.back.mockReset();
    nav.search = '';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 the page: its line, the search and the filters in Indonesian, the title, tabs and categories kept English', async () => {
    grid();
    await shelfReady();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Product Catalog$/);
    expect(screen.getByText(
      'Seluruh etalase produk individu — konvensional dan syariah. Ketuk produk mana pun untuk melihat manfaat, '
      + 'keunggulan, dan script penjualannya.',
    )).toHaveClass('max-md:hidden');
    const tabs = screen.getByRole('navigation', { name: 'Sales tools' });
    expect(within(tabs).getAllByRole('link').map((l) => l.textContent)).toEqual(['Sales Attack Plan', 'Product Catalog']);
    const search = screen.getByRole('searchbox', { name: 'Cari produk berdasarkan nama' });
    expect(search).toHaveAttribute('placeholder', 'Cari produk…');
    expect(within(screen.getByRole('group', { name: 'Kategori' })).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'All products', 'Life', 'Health', 'Critical illness', 'Education', 'Investment-linked',
    ]);
    expect(within(screen.getByRole('group', { name: 'Kanal' })).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['Semua', 'Konvensional', 'Syariah']);
    noEnglishLeft();
  });

  it('AC-2, AC-4 a section per category, kept English, its count Indonesian; each card the company’s words as typed', async () => {
    grid();
    await shelfReady();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Life', 'Health', 'Investment-linked']);
    expect(within(screen.getByRole('region', { name: 'Life' })).getByText('2 produk')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Health' })).getByText('1 produk')).toBeInTheDocument();
    const mapan = document.querySelector('[data-product-card="PRUMAPAN"]') as HTMLElement;
    expect(mapan.textContent).toBe('KonvensionalPRUMapanDana pensiun yang cair rutin dari usia 55.Lihat detail →');
    // The company's English tagline stays as it was typed.
    expect(screen.getByText('Affordable whole-life to age 100.')).toBeInTheDocument();
    const pgb = document.querySelector('[data-product-card="PRULINK_GENERASI_BARU_PGB"]') as HTMLElement;
    expect(within(pgb).getByText('Tidak dijual lagi')).toHaveClass('text-alert');
    expect(within(document.querySelector('[data-product-card="PRUSEHAT_SYARIAH"]') as HTMLElement).getByText('Syariah'))
      .toBeInTheDocument();
    noEnglishLeft();
  });

  it('the check is live: the same page read in English shows the module’s English, which the check finds', async () => {
    nav.pathname = '/product-catalog';
    stubFetch({ ...SHELL_STUBS, 'GET /product-catalog': { body: { products: SHELF } } });
    renderWithSession(<AgentLayout><ProductCatalogLayout><ProductCatalogPage /></ProductCatalogLayout></AgentLayout>, { me: RINA_ME });
    await shelfReady();
    expect(englishShown(document.body, CATALOG_ENGLISH))
      .toEqual(expect.arrayContaining(['Search products by name', 'Search products…', 'Conventional', 'View detail →']));
  });

  it('AC-2 a search that finds nothing, and a filter that leaves nothing, say so in Indonesian', async () => {
    grid();
    await shelfReady();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Cari produk berdasarkan nama' }), '  zzz ');
    expect(screen.getByText('Tidak ada produk yang cocok dengan “zzz”.')).toHaveAttribute('role', 'status');
    noEnglishLeft();
  });

  it('AC-2 a filter that leaves nothing', async () => {
    nav.search = 'category=education';
    grid();
    expect(await screen.findByText('Tidak ada produk yang cocok dengan filter ini.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Education' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC-2 the states the prototype lacks: loading, an error with its retry, the empty shelf', async () => {
    grid({ 'GET /product-catalog': [serverError, { body: { products: [] } }] });
    expect((await screen.findByText('Memuat produk…')).closest('[role="status"]')).not.toBeNull();
    // The server's sentence is the server's (P18.98-T5); the retry is ours.
    await userEvent.click(await screen.findByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText('Belum ada produk di etalase Anda.')).toBeInTheDocument();
    expect(screen.getByText('Produk akan muncul di sini setelah tersedia untuk Anda.')).toBeInTheDocument();
    noEnglishLeft();
  });
});

describe('P18.98-T4 a product’s drawer in Indonesian', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    nav.back.mockReset();
    nav.search = '';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('AC-2 Details: the blocks in Indonesian, the tabs and Commission rate kept, the company’s words as typed', async () => {
    drawer('PRUMAPAN');
    const box = await dialog();
    expect(within(box).getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
    expect(within(box).getByRole('tablist', { name: 'Detail produk' })).toBeInTheDocument();
    expect(within(box).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Details', 'Attack Plan', 'Documents']);
    expect(within(box).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Commission rate', 'Manfaat', 'Keunggulannya', 'Nasabah yang paling cocok',
    ]);
    const table = within(box).getByRole('table', { name: 'Commission rate' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Tahun', 'Persentase']);
    expect(within(table).getAllByRole('row').slice(1).map((r) => r.textContent)).toEqual(['Tahun 130%', 'Tahun 215%', 'Tahun 35%']);
    expect(within(box).getByText('The accessible retirement-income option.')).toBeInTheDocument();
    expect(within(box).getByText('Konvensional')).toBeInTheDocument();
    expect(within(box).getByRole('link', { name: 'Buka halaman Attack Plan lengkap' })).toHaveAttribute('href', '/attack-plan?product=PRUMAPAN');
    noEnglishLeft();
  });

  it('P18.98-T3 figures: a commission rate in the reader’s figures — 7,25% in Indonesian, 7.25% in English', async () => {
    const rates = product({ commissionSchedule: [{ year: 1, rate: 0.0725 }, { year: 2, rate: 0.125 }] });
    drawer('PRUMAPAN', { 'GET /product-catalog/PRUMAPAN': { body: rates } });
    const table = within(await dialog()).getByRole('table', { name: 'Commission rate' });
    expect(within(table).getAllByRole('row').slice(1).map((r) => r.textContent)).toEqual(['Tahun 17,25%', 'Tahun 212,5%']);
  });

  it('P18.98-T3 figures: the same rates, read in English', async () => {
    nav.pathname = '/product-catalog/PRUMAPAN';
    const rates = product({ commissionSchedule: [{ year: 1, rate: 0.0725 }, { year: 2, rate: 0.125 }] });
    stubFetch({ ...SHELL_STUBS, 'GET /product-catalog': { body: { products: SHELF } }, 'GET /product-catalog/PRUMAPAN': { body: rates } });
    renderWithSession(
      <InLanguage language="en">
        <AgentLayout>
          <ProductCatalogLayout><ProductDrawerPage params={routeParams({ productCode: 'PRUMAPAN' })} /></ProductCatalogLayout>
        </AgentLayout>
      </InLanguage>,
      { me: RINA_ME },
    );
    const table = within(await dialog()).getByRole('table', { name: 'Commission rate' });
    expect(within(table).getAllByRole('row').slice(1).map((r) => r.textContent)).toEqual(['Y17.25%', 'Y212.5%']);
  });

  it('AC-2 the not-set line while the company states none', async () => {
    drawer('PRUMAPAN', { 'GET /product-catalog/PRUMAPAN': { body: product({ commissionSchedule: [] }) } });
    const box = await dialog();
    expect(within(box).getByText('Belum diatur — perusahaan belum menetapkan persentase untuk produk ini.')).toBeInTheDocument();
  });

  it('AC-2 Attack Plan: the six blocks framed in Indonesian, every field of the script as typed, the deep link', async () => {
    drawer('PRUMAPAN');
    const box = await dialog();
    await userEvent.click(within(box).getByRole('tab', { name: 'Attack Plan' }));
    const panel = within(within(box).getByRole('tabpanel', { name: 'Attack Plan' }));
    expect(panel.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      '00 Cocok untuk', '11 Kalimat pembuka', '22 Tekankan manfaat berikut', '33 Script lengkap — cara menyampaikannya',
      '44 Jika ada keberatan', '55 Tindakan berikutnya',
    ]);
    expect(panel.getByText(`“${SCRIPT.opening}”`)).toBeInTheDocument();
    expect(panel.getByText('Dia berkata:', { exact: false })).toHaveTextContent(`Dia berkata: “${SCRIPT.objectionTheySay}”`);
    expect(panel.getByText('Anda menjawab:')).toBeInTheDocument();
    expect(panel.getByText(SCRIPT.objectionYouSay)).toBeInTheDocument();
    expect(panel.getByText(SCRIPT.nextAction)).toBeInTheDocument();
    expect(panel.getByRole('link', {
      name: 'Buka di halaman Sales Attack Plan (tambahkan usia & anggaran nasabah untuk cek kecocokan) →',
    })).toHaveAttribute('href', '/attack-plan?product=PRUMAPAN');
    noEnglishLeft();
  });

  it('AC-2 Attack Plan with no authored script: the drawer’s line in Indonesian', async () => {
    drawer('PRUMAPAN', { 'GET /product-catalog/PRUMAPAN': { body: product({ script: { ...SCRIPT, fullScript: '' } }) } });
    const box = await dialog();
    await userEvent.click(within(box).getByRole('tab', { name: 'Attack Plan' }));
    expect(within(box).getByText('Belum ada script yang disusun untuk produk ini.')).toBeInTheDocument();
  });

  it('AC-2, AC-4 a run-off product: its note as served, the disabled action and the tab’s line in Indonesian', async () => {
    drawer('PRULINK_GENERASI_BARU_PGB', { 'GET /product-catalog/PRULINK_GENERASI_BARU_PGB': { body: PGB } });
    const box = await dialog('PRULink Generasi Baru (PGB)');
    expect(within(box).getByText('Tidak dijual lagi')).toBeInTheDocument();
    // The server's note is the server's (P18.98-T5 writes it in the request's language).
    expect(within(box).getByText(PGB.runOffNote as string)).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Tidak ada script penjualan aktif' })).toBeDisabled();
    await userEvent.click(within(box).getByRole('tab', { name: 'Attack Plan' }));
    expect(within(box).getByText(
      'Produk ini tidak dijual lagi — tidak ada script penjualan aktif. Gunakan tab Details hanya sebagai informasi referensi.',
    )).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-2, AC-4 Documents: each slot’s label as served, its link and its missing line in Indonesian', async () => {
    drawer('PRUMAPAN');
    const box = await dialog();
    await userEvent.click(within(box).getByRole('tab', { name: 'Documents' }));
    expect([...box.querySelectorAll('[data-slot]')].map((r) => r.textContent)).toEqual([
      'BrochureBrochure — terbuka di tab baruBuka tautan →', 'Illustration / SimulationBelum diunggah oleh KPM.',
      'Product DocumentBelum diunggah oleh KPM.',
    ]);
    expect(within(box).getByRole('button', { name: 'Buka tautan →' })).toHaveAccessibleDescription('Brochure — terbuka di tab baru');
    noEnglishLeft();
  });

  it('AC-2 a document that cannot be opened says so in Indonesian', async () => {
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.stubGlobal('open', vi.fn(() => tab));
    drawer('PRUMAPAN', { 'GET /product-catalog/PRUMAPAN/documents/brochure/url': notFound });
    const box = await dialog();
    await userEvent.click(within(box).getByRole('tab', { name: 'Documents' }));
    await userEvent.click(within(box).getByRole('button', { name: 'Buka tautan →' }));
    expect(await within(box).findByText('Tidak dapat membuka dokumen ini.')).toBeInTheDocument();
    expect(tab.close).toHaveBeenCalled();
  });

  it('AC-2 the drawer while it loads, and an error with its retry', async () => {
    drawer('PRUMAPAN', { 'GET /product-catalog/PRUMAPAN': [serverError, { body: product() }] });
    expect((await screen.findByText('Memuat produk ini…')).closest('[role="status"]')).not.toBeNull();
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    await dialog();
  });

  it('AC-2 the not-found state: the dialog named by the kept title, its words in Indonesian', async () => {
    drawer('PRUSMART_PLAN', { 'GET /product-catalog/PRUSMART_PLAN': notFound });
    expect(await screen.findByText('Produk ini tidak ada di etalase Anda.')).toBeInTheDocument();
    expect(screen.getByText('Produk ini mungkin sudah ditarik atau dinonaktifkan, atau alamatnya salah ketik.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Product Catalog' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Kembali ke Product Catalog' }));
    expect(nav.replace).toHaveBeenCalledWith('/product-catalog', { scroll: false });
    noEnglishLeft();
  });

  it('AC-7 the kept terms the screen writes are marked for lang="en" (P18.98-T7)', async () => {
    drawer('PRUMAPAN');
    await dialog();
    for (const term of ['Product Catalog', 'Sales tools', 'Details', 'Attack Plan', 'Documents', 'Commission rate', 'Life']) {
      expect([term, isKept(term)]).toEqual([term, true]);
    }
  });
});
