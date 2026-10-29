import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The Product Catalog and its drawer** (P18.98-T4, field selling; `functional/sales-tools.md`, *The module's own
 * strings*): `/product-catalog` — its line, the search, the category pills and the channel toggle, a section's count, a
 * card's tags, the empty and failing states — and a product's drawer, `/product-catalog/[productCode]`, with its
 * *Details*, *Attack Plan* and *Documents*; the words a product's script is framed with on both Sales tools screens
 * (`product-script.tsx`); the tab row over the two screens (`sales-tools-tabs.tsx`); and `lib/product-catalog.ts`'
 * words for a product — its channel, its count.
 *
 * **English is the source** of the keys, the prototype's words verbatim (`Overall.html:3872-3883`, `:10116-10394`; D-copy)
 * and the module's own Fills; the Indonesian is the approved glossary's (OD-237; §B.0's voice), with what it lacked in
 * the glossary for approval's §B.10 — *etalase* for the shelf, *nasabah* for the customer, *Tidak dijual lagi* for a
 * product in run-off. **Kept English** (§A): the titles, the tabs (*Sales Attack Plan*, *Product Catalog*, *Details*,
 * *Attack Plan*, *Documents*), the categories (*All products*, *Life*, *Health* …), *Commission rate* (§A.4), *Script*
 * (§A.6), *KPM*. *Syariah* is Indonesian already (`SAME_IN_INDONESIAN`). **Content stays as typed** (ADR-0179 §5; §C3):
 * a product's name (*PRUMapan*), its tagline, benefits, what stands out and its best fit, its script. The server's own
 * words — a product's run-off note, a document slot's label — are shown as served (P18.98-T5's). **A message never writes
 * a figure** (P18.98-T3): a commission rate is written by the caller in the figures' language (`formatRate(rate, figures)`).
 *
 * @moved components/product-catalog.tsx
 * @moved components/product-drawer.tsx
 * @moved components/product-script.tsx
 * @moved components/sales-tools-tabs.tsx
 * @moved lib/product-catalog.ts
 * @moved app/(agent)/product-catalog/
 */
const en = {
  /** The tab row over both screens (P18.8-T12, ADR-0161 §5): named by the nav's group, each tab a page's title (§A.1–§A.3). */
  tabs: {
    label: kept('Sales tools'),
    plan: kept('Sales Attack Plan'),
    catalog: kept('Product Catalog'),
  },

  /** The page (`:3872-3883`, title `:10416`). */
  title: kept('Product Catalog'),
  subtitle: 'The full individual shelf — conventional and syariah. Tap any product for benefits, positioning, and its sales script.',
  /** The catalog's search (P18.95-T6 AC-4; UI-023): its name, its placeholder, and what a search that finds nothing says. */
  searchName: 'Search products by name',
  searchPlaceholder: 'Search products…',
  /** `term` as typed, trimmed. */
  noSearchMatch: ({ term }: { term: string }) => `No products match “${term}”.`,
  /** The category pills' group, for a screen reader; the first pill (§A.3). */
  categories: 'Category',
  allProducts: kept('All products'),
  /** The channel toggle's group, for a screen reader, and its three options (`:10123`). */
  channels: 'Channel',
  all: 'All',
  channel: {
    conventional: 'Conventional',
    syariah: 'Syariah',
  },
  /** A product closed to new business: the card's tag, the result's pill (`.tag.runoff`). */
  runOff: 'In run-off',
  viewDetail: 'View detail →',
  noFilterMatch: 'No products match this filter.',
  /** A section's count (`:10170`). */
  productCount: ({ n }: { n: number }) => (n === 1 ? '1 product' : `${n} products`),
  /** The states the prototype lacks (Fills; P14-T7 AC-10). */
  loadingShelf: 'Loading products…',
  tryAgain: 'Try again',
  emptyShelf: 'There are no products on your shelf yet.',
  emptyShelfHint: 'Products appear here once they are made available to you.',

  /** The drawer (`:4737-4743`, `:10192-10394`). */
  drawer: {
    /** ✕'s name: the glyph is drawn, hidden from a screen reader. */
    close: 'Close',
    loading: 'Loading this product…',
    notFound: 'This product isn\'t on your shelf.',
    notFoundHint: 'It may have been withdrawn or switched off, or the address may be mistyped.',
    backToCatalog: 'Back to Product Catalog',
    /** The tab list, named for a screen reader, and its three tabs (§A.3). */
    tabs: 'Product details',
    details: kept('Details'),
    plan: kept('Attack Plan'),
    documents: kept('Documents'),
    /** *Details* (`:10238-10280`): the commission table — its name the KPI's (§A.4) — and the three blocks. */
    commissionRate: kept('Commission rate'),
    year: 'Year',
    rate: 'Rate',
    /** A row's year: *Y1*. */
    yearRow: ({ year }: { year: number }) => `Y${year}`,
    /** The commission's not-set line (ADR-0119, OD-135). */
    commissionNotSet: 'Not set yet — the company has not given a rate for this product.',
    benefits: 'Benefits',
    standsOut: 'How it stands out',
    bestFit: 'Best-fit customer',
    openFullPlan: 'Open full Attack Plan page',
    noActiveScript: 'No active sales script',
    /** *Attack Plan* (`:10282-10357`): a run-off product's line, and the plan page's deep link. */
    runOff: 'This product is in run-off — no active sales script. Use the Details tab for reference information only.',
    openInPlan: 'Open in Sales Attack Plan page (add customer age & budget for a fit check) →',
    /** *Documents* (`:10371-10386`): a slot that can be opened, and one that cannot — *KPM* the prototype's (OD-39). */
    openLink: 'Open link →',
    notUploaded: 'Not uploaded by KPM yet.',
    /** A document's link, described by its slot's label (the server's). */
    opensInNewTab: ({ label }: { label: string }) => `${label} — opens in a new tab`,
    documentFailed: 'Could not open this document.',
    opening: 'Opening…',
  },

  /** The words a product's script is framed with, beside the blocks both plans share (`plan.ts`; D-noscript). */
  script: {
    fullScript: 'Full script — how to narrate it',
    /** In the drawer, where no script is authored (`:10332-10348`). */
    drawerNoScript: 'No authored script yet for this product.',
    /** On the plan page, as *Next action*, where no script is authored (`:9768-9790`). */
    pageNoScriptNext: 'No authored script yet for this product — confirm details manually before proposing.',
  },
};

const id: MessagesOf<typeof en> = {
  tabs: {
    label: kept('Sales tools'),
    plan: kept('Sales Attack Plan'),
    catalog: kept('Product Catalog'),
  },

  title: kept('Product Catalog'),
  subtitle: `Seluruh etalase produk individu — konvensional dan syariah. Ketuk produk mana pun untuk melihat manfaat, `
    + `keunggulan, dan ${kept('script')} penjualannya.`,
  searchName: 'Cari produk berdasarkan nama',
  searchPlaceholder: 'Cari produk…',
  noSearchMatch: ({ term }) => `Tidak ada produk yang cocok dengan “${term}”.`,
  categories: 'Kategori',
  allProducts: kept('All products'),
  channels: 'Kanal',
  all: 'Semua',
  channel: {
    conventional: 'Konvensional',
    // The product line's Indonesian name, which the English already uses (`SAME_IN_INDONESIAN`).
    syariah: 'Syariah',
  },
  runOff: 'Tidak dijual lagi',
  viewDetail: 'Lihat detail →',
  noFilterMatch: 'Tidak ada produk yang cocok dengan filter ini.',
  // One form for one and many (§B.0 rule 8).
  productCount: ({ n }) => `${n} produk`,
  loadingShelf: 'Memuat produk…',
  tryAgain: 'Coba lagi',
  emptyShelf: 'Belum ada produk di etalase Anda.',
  emptyShelfHint: 'Produk akan muncul di sini setelah tersedia untuk Anda.',

  drawer: {
    close: 'Tutup',
    loading: 'Memuat produk ini…',
    notFound: 'Produk ini tidak ada di etalase Anda.',
    notFoundHint: 'Produk ini mungkin sudah ditarik atau dinonaktifkan, atau alamatnya salah ketik.',
    backToCatalog: `Kembali ke ${kept('Product Catalog')}`,
    tabs: 'Detail produk',
    details: kept('Details'),
    plan: kept('Attack Plan'),
    documents: kept('Documents'),
    commissionRate: kept('Commission rate'),
    year: 'Tahun',
    rate: 'Persentase',
    yearRow: ({ year }) => `Tahun ${year}`,
    commissionNotSet: 'Belum diatur — perusahaan belum menetapkan persentase untuk produk ini.',
    benefits: 'Manfaat',
    standsOut: 'Keunggulannya',
    bestFit: 'Nasabah yang paling cocok',
    openFullPlan: `Buka halaman ${kept('Attack Plan')} lengkap`,
    noActiveScript: `Tidak ada ${kept('script')} penjualan aktif`,
    runOff: `Produk ini tidak dijual lagi — tidak ada ${kept('script')} penjualan aktif. Gunakan tab ${kept('Details')} `
      + 'hanya sebagai informasi referensi.',
    openInPlan: `Buka di halaman ${kept('Sales Attack Plan')} (tambahkan usia & anggaran nasabah untuk cek kecocokan) →`,
    openLink: 'Buka tautan →',
    notUploaded: `Belum diunggah oleh ${kept('KPM')}.`,
    opensInNewTab: ({ label }) => `${label} — terbuka di tab baru`,
    documentFailed: 'Tidak dapat membuka dokumen ini.',
    opening: 'Membuka…',
  },

  script: {
    fullScript: `${kept('Script')} lengkap — cara menyampaikannya`,
    drawerNoScript: `Belum ada ${kept('script')} yang disusun untuk produk ini.`,
    pageNoScriptNext: `Belum ada ${kept('script')} yang disusun untuk produk ini — konfirmasi detailnya secara manual `
      + 'sebelum membuat penawaran.',
  },
};

export const productCatalogMessages = defineMessages({ en, id });
