import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, stubFetch } from '@test/harness';
import { adminTemplateProductsMessages } from '@/i18n/messages/admin-template-products';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import { salesAttackPlanMessages } from '@/i18n/messages/sales-attack-plan';
import { settingsMessages } from '@/i18n/messages/settings';
import { ProductsTab } from './products-tab';

/**
 * **P18.98-T6, the Company template's *Products* tab in ID mode** (AC-1 as T4's AC-1 to AC-3; area "admin-template"):
 * the tab's words the approved glossary's Indonesian (`admin-template-products.tsx`, with the agents' catalogue's words
 * for a channel, a need, a budget band and a commission year), the catalogue's categories and *Commission rate* kept
 * English (§A.3, §A.4), a product's name, tagline, benefits and attack plan as the company typed them (ADR-0179 §5),
 * and its figures in Indonesian. The same tab in English is `products-tab.spec.tsx`.
 *
 * **English left** (`englishShown`) is read against the areas the tab draws words from; *Code*, a read-only code's
 * label, is `CodeField`'s (`components/ui/`), the shared pieces', and is left out.
 */
const ENGLISH = englishOnly(adminTemplateProductsMessages, settingsMessages, productCatalogMessages, salesAttackPlanMessages)
  .filter((words) => words !== 'Code');
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['product_catalog:crud', 'commission_rates:read'],
});

const product = (over: Record<string, unknown> = {}) => ({
  id: 'p1', companyId: 'c1', code: 'PRUMAPAN', name: 'PRUMapan', tagline: 'Proteksi jiwa dengan manfaat pensiun',
  channel: 'syariah', category: 'investment', primaryNeeds: ['retirement'], eligibleAgeBands: [1], eligibleBudgetBands: [1],
  benefits: ['Dana Mapan tiap tahun dari usia 55'], differentiator: 'Pilihan pensiun paling terjangkau.',
  bestFor: 'Profesional generasi sandwich',
  defaultAttackPlan: {
    goodFit: 'Profesional generasi sandwich', opening: 'Menyiapkan dana pensiun memang tidak mudah.',
    benefits: ['Dana Mapan'], fullScript: 'Boleh saya siapkan ilustrasinya?', objectionTheySay: 'Pensiun masih lama.',
    objectionYouSay: 'Justru lebih ringan dimulai sekarang.', nextAction: 'Siapkan ilustrasi.',
  },
  commissionSchedule: [{ year: 1, rate: 0.125 }], lifecycle: 'closed_to_new_business', replacedByProductId: null,
  activeByDefault: true, sortOrder: 1, version: 3,
  ...over,
});

function mount(rows: unknown[] = [product()]) {
  stubFetch({ '/admin/companies/c1/products': { body: rows } });
  renderInIndonesian(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });
}

describe('P18.98-T6 the Products tab in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the English it is looking for, so a silent zero cannot pass', () => {
    expect(ENGLISH).toEqual(expect.arrayContaining(['This catalog is live.', 'Add a product', 'Closed to new business']));
  });

  it('AC-1, AC-2, AC-4 the shelf: the card in Indonesian, the category kept, the product as typed', async () => {
    mount();
    const card = (await screen.findByText('PRUMapan')).closest('li')!;
    expect(screen.getByText('Katalog ini langsung berlaku.')).toBeInTheDocument();
    expect(screen.getByText(/^Katalog ini tidak punya draf dan versi/)).toBeInTheDocument();
    expect(screen.getByText('1 produk · 0 aktif · 1 aktif secara default di KPM baru')).toBeInTheDocument();
    expect(screen.getByText('Seret ⠿ untuk mengubah urutan, atau fokuskan lalu tekan ↑ atau ↓.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah produk' })).toBeInTheDocument();
    expect(within(card).getByText('Proteksi jiwa dengan manfaat pensiun')).toBeInTheDocument();
    // The channel in the catalogue's words, the category kept (§A.3), the lifecycle in Indonesian.
    expect(within(card).getByText('Syariah')).toBeInTheDocument();
    expect(within(card).getByText('Investment')).toBeInTheDocument();
    expect(within(card).getByText('Ditutup untuk penjualan baru')).toBeInTheDocument();
    expect(within(card).getByText('Aktif secara default')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1, AC-3 a product opened: its fields, its fit in Indonesian figures and its needs by name', async () => {
    mount();
    const card = (await screen.findByText('PRUMapan')).closest('li')!;
    await userEvent.click(within(card).getByRole('button', { name: 'Ubah' }));
    expect(within(card).getByRole('button', { name: 'Tutup' })).toBeInTheDocument();

    expect(within(card).getByText('Versi')).toBeInTheDocument();
    expect(within(card).getByText('Naik pada setiap perubahan kecuali perubahan urutan, yang hanya soal tampilan.'))
      .toBeInTheDocument();
    expect(within(card).getByLabelText('Deskripsi singkat')).toHaveValue('Proteksi jiwa dengan manfaat pensiun');
    expect(within(within(card).getByLabelText('Kanal')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Konvensional', 'Syariah']);
    expect(within(within(card).getByLabelText('Kategori')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Life', 'Health', 'Critical illness', 'Education', 'Investment']);
    // A need by its name, where English writes its code.
    const need = within(card).getByRole('group', { name: 'Kebutuhan utama' });
    expect(within(need).getByRole('checkbox', { name: 'Dana pensiun' })).toBeChecked();
    expect(within(need).getByRole('checkbox', { name: 'Perlindungan jiwa' })).not.toBeChecked();
    // The budget bands in Indonesian figures, the single payment in words.
    const fits = within(card).getByRole('group', { name: 'Cocok untuk siapa' });
    expect(within(fits).getByText('Acuan cek kecocokan saat menilai prospek.')).toBeInTheDocument();
    expect(within(fits).getByRole('checkbox', { name: '< Rp 500 rb' })).toBeChecked();
    expect(within(fits).getByRole('checkbox', { name: 'Sekaligus' })).toBeInTheDocument();
    expect(within(fits).getByRole('checkbox', { name: '65+' })).toBeInTheDocument();
    expect(within(card).getByLabelText('Manfaat')).toHaveAccessibleDescription('Satu per baris.');
    expect(within(card).getByLabelText('Paling cocok untuk')).toHaveValue('Profesional generasi sandwich');
    noEnglishLeft();
  });

  it('AC-1, AC-2 the default attack plan, the commission in Indonesian figures, the lifecycle with its bold phrase', async () => {
    mount();
    const card = (await screen.findByText('PRUMapan')).closest('li')!;
    await userEvent.click(within(card).getByRole('button', { name: 'Ubah' }));

    expect(within(card).getByRole('heading', { name: 'Attack Plan default' })).toBeInTheDocument();
    expect(within(card).getByLabelText('0 · Cocok untuk')).toHaveValue('Profesional generasi sandwich');
    expect(within(card).getByLabelText('3 · Script lengkap')).toBeInTheDocument();
    expect(within(card).getByLabelText('4a · Jika ada keberatan — dia berkata')).toHaveValue('Pensiun masih lama.');
    expect(within(card).getByLabelText('5 · Tindakan berikutnya')).toBeInTheDocument();

    // UI V1 (UI-006): *Commission rate* is Indonesian in ID mode — *Persentase komisi* (proposed in §B.10, P18.99).
    const table = within(card).getByRole('table', { name: 'Persentase komisi' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Tahun', 'Persentase (%)']);
    expect(within(table).getByRole('rowheader')).toHaveTextContent('Tahun 1');
    // A rate as typed and read, in the reader's mark: *12,5*.
    expect(within(card).getByLabelText('Persentase untuk tahun 1')).toHaveValue('12,5');
    expect(within(card).getByRole('button', { name: '+ Tambah tahun' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Hapus tahun 1' })).toBeInTheDocument();
    await userEvent.clear(within(card).getByLabelText('Persentase untuk tahun 1'));
    await userEvent.type(within(card).getByLabelText('Persentase untuk tahun 1'), '120');
    expect(within(card).getByText('Masukkan persentase dari 0 sampai 100.')).toBeInTheDocument();

    expect(within(card).getByRole('heading', { name: 'Siklus hidup' })).toBeInTheDocument();
    expect(within(card).getByText('setiap KPM perusahaan ini').tagName).toBe('STRONG');
    expect(within(card).getByLabelText('Digantikan oleh')).toHaveAccessibleDescription(
      'Opsional, dan hanya produk di etalase perusahaan ini.',
    );
    expect(within(card).getByRole('button', { name: 'Tarik' })).toHaveAttribute(
      'title', 'Setiap KPM perusahaan ini berhenti menjualnya saat membaca katalog berikutnya.',
    );
    expect(within(card).getByRole('button', { name: 'Buka kembali' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Simpan produk' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a new product, a taken code, and an empty shelf, in Indonesian', async () => {
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah produk' }));
    expect(screen.getByLabelText('Kode', { selector: '#add-product-code' }))
      .toHaveAccessibleDescription('Diisi dari nama. Diketik sekali, dan tidak pernah dipakai ulang.');
    await userEvent.type(screen.getByLabelText('Kode', { selector: '#add-product-code' }), 'PRUMAPAN');
    expect(screen.getByLabelText('Kode', { selector: '#add-product-code' }))
      .toHaveAccessibleDescription(expect.stringContaining('Perusahaan ini sudah punya produk dengan kode ini.'));
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a company with no products, and a catalogue that could not be read, in Indonesian', async () => {
    mount([]);
    expect(await screen.findByText(/^Perusahaan ini belum punya produk\./)).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a catalogue that could not be read says so in Indonesian, the server’s sentence as sent', async () => {
    stubFetch({
      '/admin/companies/c1/products': {
        status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Data ini berubah.', requestId: 'r-1' } },
      },
    });
    renderInIndonesian(<ProductsTab companyId="c1" />, { me: SUPER_ADMIN });
    expect(await screen.findByText('Tidak dapat membaca katalog perusahaan ini. Data ini berubah.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
    noEnglishLeft();
  });
});
