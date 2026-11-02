import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import {
  browserChose, renderInIndonesian, renderWithLanguage, renderWithSession, resetLanguage, stubFetch, type StubReply,
} from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { notFound, PGB, plan, product, RINA_ME, SCRIPT, serverError, SHELF, SHELL_STUBS } from '@test/sales-tools-fixtures';
import { planMessages } from '@/i18n/messages/plan';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import { salesAttackPlanMessages } from '@/i18n/messages/sales-attack-plan';
import AttackPlanPage from './page';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => '/attack-plan',
  useSearchParams: () => new URLSearchParams(nav.search),
  useParams: () => ({}),
}));

type Query = Record<string, string>;
type Routes = Record<string, StubReply | StubReply[]>;

/** The module's English that ID mode must not show: the plan's own, the two plans' shared words, the catalog's. */
const PLAN_ENGLISH = englishOnly(salesAttackPlanMessages, planMessages, productCatalogMessages);
const noEnglishLeft = () => expect(englishShown(document.body, PLAN_ENGLISH)).toEqual([]);

const page = (query: Query) => {
  nav.search = new URLSearchParams(query).toString();
  return <AgentLayout><AttackPlanPage /></AgentLayout>;
};

function stubs(routes: Routes = {}) {
  return stubFetch({
    ...SHELL_STUBS, 'GET /attack-plan': { body: plan() }, 'GET /product-catalog': { body: { products: SHELF } }, ...routes,
  });
}

/** The page at an address, in Indonesian. */
function show(query: Query = {}, routes: Routes = {}) {
  const stub = stubs(routes);
  renderInIndonesian(page(query), { me: RINA_ME });
  return stub;
}

const BRIEF = { need: 'retirement', age: '2', budget: '2' };
const briefHeading = () => screen.findByRole('heading', { level: 2, name: 'Dengan siapa kita bicara?' });
const result = (name = 'PRUMapan') => screen.findByRole('heading', { level: 2, name });
const group = (name: string) => screen.getByRole('group', { name });
const chips = (name: string) => within(group(name)).getAllByRole('button').map((b) => b.textContent);

/**
 * **P18.98-T4, the Sales Attack Plan in ID mode** (field selling; ADR-0179 §3–§6): the brief's questions, chips and
 * notes in the approved glossary's Indonesian, *Sales Attack Plan*, *Attack Plan* and *Product Catalog* English (§A), the
 * product, its script and its alternatives as typed, and a budget band's sums in the reader's figures. In English:
 * `page.spec.tsx`.
 */
describe('P18.98-T4 the Sales Attack Plan in Indonesian', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    nav.back.mockReset();
    nav.search = '';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetLanguage();
  });

  describe('the brief', () => {
    it('AC-2 the steps, the card, the four questions and their chips in Indonesian; the title and the plan’s name kept', async () => {
      show();
      await briefHeading();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Sales Attack Plan$/);
      expect(within(screen.getByRole('navigation', { name: 'Sales tools' })).getAllByRole('link').map((l) => l.textContent))
        .toEqual(['Sales Attack Plan', 'Product Catalog']);
      expect(within(screen.getByRole('list', { name: 'Langkah' })).getAllByRole('listitem').map((s) => s.textContent))
        .toEqual(['11 Gambaran nasabah', '22 Attack Plan']);
      expect(screen.getByText('Jawab 3 pertanyaan untuk mendapatkan pitch Anda.')).toBeInTheDocument();
      expect(chips('Kebutuhan utama')).toEqual([
        'Perlindungan jiwa', 'Kesehatan', 'Penyakit kritis', 'Khusus kecelakaan', 'Pendidikan', 'Investasi', 'Dana pensiun',
        'Warisan',
      ]);
      expect(chips('Rentang usia')).toEqual(['< 25', '25–34', '35–49', '50–64', '65+']);
      // The reader's figures, Indonesian here: the backend's own labels, to the character.
      expect(chips('Anggaran premi bulanan')).toEqual([
        '< Rp 500 rb', 'Rp 500 rb–Rp 2 jt', 'Rp 2 jt–Rp 5 jt', 'Rp 5 jt–Rp 10 jt', 'Rp 10 jt–Rp 20 jt', '> Rp 20 jt',
      ]);
      expect(chips('Atau bayar sekali')).toEqual(['Sekaligus']);
      expect(screen.getByText('Pilih kebutuhan, rentang usia, dan anggaran untuk melanjutkan.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Susun Attack Plan' })).toBeDisabled();
      noEnglishLeft();
    });

    it('AC-1 choosing in Indonesian builds the same address: the codes, never the words', async () => {
      show();
      await briefHeading();
      await userEvent.click(within(group('Kebutuhan utama')).getByRole('button', { name: 'Kesehatan' }));
      await userEvent.click(within(group('Rentang usia')).getByRole('button', { name: '65+' }));
      await userEvent.click(within(group('Atau bayar sekali')).getByRole('button', { name: 'Sekaligus' }));
      expect(screen.queryByText('Pilih kebutuhan, rentang usia, dan anggaran untuk melanjutkan.')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Susun Attack Plan' }));
      expect(nav.push).toHaveBeenCalledWith('/attack-plan?need=health&age=5&budget=7', { scroll: false });
    });

    it('AC-2 the empty shelf in the brief’s place, in the catalog’s Indonesian', async () => {
      show({}, { 'GET /product-catalog': { body: { products: [] } } });
      expect(await screen.findByText('Belum ada produk di etalase Anda.')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Dengan siapa kita bicara?' })).not.toBeInTheDocument();
      noEnglishLeft();
    });
  });

  describe('P18.98-T3 figures: a budget band’s sums are the reader’s figures, its words the reader’s words', () => {
    const monthly = () => chips('Monthly premium budget');

    it('a reader who chose nothing, not live: English words and Indonesian sums — the page as before the phase', async () => {
      stubs();
      renderWithLanguage(page({}), { me: RINA_ME }, { live: false });
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      expect(monthly()).toEqual([
        '< Rp 500 rb', 'Rp 500 rb–Rp 2 jt', 'Rp 2 jt–Rp 5 jt', 'Rp 5 jt–Rp 10 jt', 'Rp 10 jt–Rp 20 jt', '> Rp 20 jt',
      ]);
      expect(chips('Or pay once')).toEqual(['Lump-sum']);
    });

    it('a reader who chose English: IDR, in English’s marks', async () => {
      browserChose('en');
      stubs();
      renderWithLanguage(page({}), { me: RINA_ME }, { live: false });
      await screen.findByRole('heading', { level: 2, name: 'Who are we talking to?' });
      expect(monthly()).toEqual([
        '< IDR 500K', 'IDR 500K–IDR 2M', 'IDR 2M–IDR 5M', 'IDR 5M–IDR 10M', 'IDR 10M–IDR 20M', '> IDR 20M',
      ]);
    });

    it('a reader who chose Indonesian: both Indonesian, the summary too', async () => {
      browserChose('id');
      stubs();
      renderWithLanguage(page(BRIEF), { me: RINA_ME }, { live: false });
      await result();
      expect(screen.getByLabelText('Gambaran nasabah').textContent).toBe('Kebutuhan: Dana pensiunUsia: 25–34Anggaran: Rp 500 rb–Rp 2 jt');
    });
  });

  describe('the plan', () => {
    it('AC-2, AC-4 the summary, the tag, the pill, the blocks and the alternatives’ line in Indonesian; the product as typed', async () => {
      show(BRIEF);
      await result();
      expect(screen.getByLabelText('Gambaran nasabah').textContent).toBe('Kebutuhan: Dana pensiunUsia: 25–34Anggaran: Rp 500 rb–Rp 2 jt');
      expect(screen.getByText('Dana pensiun · Konvensional')).toBeInTheDocument();
      expect(screen.getByText('Dana pensiun yang cair rutin dari usia 55.')).toBeInTheDocument();
      expect(screen.getByText('Cocok')).toHaveAttribute('data-tone', 'success');
      expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        '00 Cocok untuk', '11 Kalimat pembuka', '22 Tekankan manfaat berikut', '33 Script lengkap — cara menyampaikannya',
        '44 Jika ada keberatan', '55 Tindakan berikutnya',
      ]);
      expect(screen.getByText(SCRIPT.fullScript)).toBeInTheDocument();
      expect(screen.getByText(`“${SCRIPT.objectionTheySay}”`)).toBeInTheDocument();
      expect(screen.getByText('Juga sesuai dengan kebutuhan ini — ketuk untuk mengganti rencana di atas:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'PRUAnugerah' })).toBeInTheDocument();
      // *Back* and the first step's pill, in Indonesian.
      expect(screen.getByRole('button', { name: 'Kembali' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: '1 Gambaran nasabah' }));
      expect(nav.replace).toHaveBeenCalledWith('/attack-plan', { scroll: false });
      noEnglishLeft();
    });

    it('AC-2, AC-3 Check fit: the pill, and the note naming both bands in its own order', async () => {
      show({ need: 'retirement', age: '5', budget: '6' }, {
        'GET /attack-plan': { body: plan({ verdict: 'check_fit', outside: ['age', 'budget'], alternatives: [] }) },
      });
      await result();
      expect(screen.getByText('Cek kecocokan')).toHaveAttribute('data-tone', 'alert');
      expect(screen.getByText(
        'Di luar rentang usia dan rentang anggaran yang umum untuk produk ini — masih memungkinkan, tetapi periksa kelayakan '
        + 'dan besaran premi sebelum membuat penawaran.',
      )).toBeInTheDocument();
      expect(screen.getByLabelText('Gambaran nasabah').textContent).toBe('Kebutuhan: Dana pensiunUsia: 65+Anggaran: > Rp 20 jt');
      noEnglishLeft();
    });

    it('AC-3 the count past the four alternatives, one form for one and many', async () => {
      const alternatives = ['A', 'B', 'C', 'D'].map((c) => ({ code: c, name: `Product ${c}` }));
      show(BRIEF, { 'GET /attack-plan': { body: plan({ alternatives, moreCount: 3 }) } });
      await result();
      expect(screen.getByText('3 produk lain juga sesuai. Buka Product Catalog untuk melihat seluruh etalase.')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /^Product / })).toHaveLength(4);
    });

    it('AC-2 a lump-sum brief is named in the summary', async () => {
      show({ need: 'investment', age: '3', budget: '7' });
      await result();
      expect(screen.getByLabelText('Gambaran nasabah').textContent).toBe('Kebutuhan: InvestasiUsia: 35–49Anggaran: Sekaligus');
    });

    it('AC-2 nothing on the shelf serves the need: the no-match line in Indonesian', async () => {
      show({ need: 'education', age: '2', budget: '2' }, { 'GET /attack-plan': { body: plan({ product: null, verdict: null, alternatives: [] }) } });
      expect(await screen.findByText(
        'Tidak ada produk aktif yang sesuai dengan kebutuhan ini. Coba kebutuhan lain di gambaran nasabah.',
      )).toBeInTheDocument();
      noEnglishLeft();
    });

    it('AC-2 no authored script: Next action says so in Indonesian', async () => {
      show(BRIEF, { 'GET /attack-plan': { body: plan({ product: product({ script: { ...SCRIPT, fullScript: '' } }) }) } });
      await result();
      expect(screen.getByText(
        'Belum ada script yang disusun untuk produk ini — konfirmasi detailnya secara manual sebelum membuat penawaran.',
      )).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        '00 Cocok untuk', '11 Kalimat pembuka', '22 Tekankan manfaat berikut', '33 Jika ada keberatan', '44 Tindakan berikutnya',
      ]);
    });

    it('AC-2 a skeleton while it is built, and an error with its retry', async () => {
      show(BRIEF, { 'GET /attack-plan': [serverError, { body: plan() }] });
      expect((await screen.findByText('Menyusun Attack Plan Anda…')).closest('[role="status"]')).not.toBeNull();
      await screen.findByRole('alert');
      await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
      await result();
    });
  });

  describe('the catalog’s deep link', () => {
    it('AC-3 the banner is one sentence in Indonesian, Product Catalog bold and kept; its action and pill in Indonesian', async () => {
      show({ product: 'PRUMAPAN' }, { 'GET /product-catalog/PRUMAPAN': { body: product() } });
      await result();
      const banner = screen.getByText(/gambaran nasabah belum diisi, jadi kecocokan tidak dicek\./);
      expect(banner.textContent).toBe('Dibuka dari Product Catalog — gambaran nasabah belum diisi, jadi kecocokan tidak dicek.');
      expect(within(banner).getByText('Product Catalog').tagName).toBe('STRONG');
      expect(screen.getByText('Dari katalog')).toHaveAttribute('data-tone', 'neutral');
      await userEvent.click(screen.getByRole('button', { name: 'Tambah usia & anggaran' }));
      expect(nav.push).toHaveBeenCalledWith('/attack-plan', { scroll: false });
      noEnglishLeft();
    });

    it('AC-2 a run-off product: the pill and the note in Indonesian', async () => {
      show({ product: 'PRULINK_GENERASI_BARU_PGB' }, { 'GET /product-catalog/PRULINK_GENERASI_BARU_PGB': { body: PGB } });
      await result('PRULink Generasi Baru (PGB)');
      expect(screen.getByText('Tidak dijual lagi')).toHaveAttribute('data-tone', 'neutral');
      expect(screen.getByText(
        'Produk ini tidak dijual lagi dan tidak lagi diterbitkan untuk pemohon baru. Tidak ada script penjualan aktif — '
        + 'ditampilkan hanya sebagai referensi untuk pemegang polis yang sudah ada.',
      )).toBeInTheDocument();
      noEnglishLeft();
    });

    it('AC-2 a code the office does not keep on: the not-found state in Indonesian', async () => {
      show({ product: 'PRUSMART_PLAN' }, { 'GET /product-catalog/PRUSMART_PLAN': notFound });
      expect(await screen.findByText('Produk ini tidak ada di etalase Anda.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Kembali ke Product Catalog' })).toHaveAttribute('href', '/product-catalog');
      noEnglishLeft();
    });
  });

  it('the check is live: the plan read in English shows the module’s English, which the check finds', async () => {
    stubs();
    renderWithSession(page(BRIEF), { me: RINA_ME });
    await result();
    expect(englishShown(document.body, PLAN_ENGLISH)).toEqual(expect.arrayContaining(['Good fit', 'Next action', 'Back']));
  });
});
