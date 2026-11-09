import { createElement, Fragment, type ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/** Words with an element among them — a phrase in bold — as one message, its parts in the language's own order. */
const words = (...parts: ReactNode[]) => createElement(Fragment, null, ...parts);

/** A phrase in bold inside a sentence, wrapped by the caller. */
type Strong = (words: string) => ReactNode;

/**
 * **The Company template's *Products* tab** (`components/products-tab.tsx`, P5-T4, ADR-0033, ADR-0119; P18.10-T6, area
 * "admin-template"; `functional/sales-tools.md`, *The module's own strings*): the company's live catalogue — its card,
 * the shelf's order, *Add a product*, a product opened (its fields, its fit bands, its default attack plan, its
 * commission schedule, its lifecycle) and the states around them.
 *
 * **What the agents' catalogue already says is its own, and read from there**: a channel's name (*Conventional*,
 * *Syariah*; `channelLabel`), a budget band in the reader's figures (`budgetChoices`), a need's name in Indonesian
 * (`needLabel`), a commission year (*Y1*; `product-catalog.ts`), and the controls every settings screen shares
 * (`settings.ts`). **English is the source**, every word as it was; the Indonesian is the approved glossary's, with the
 * field selling screens' words for the same things (§B.10: *nasabah*, *etalase*, *Cocok untuk*, *Kalimat pembuka*,
 * *Tekankan manfaat berikut*, *Jika ada keberatan*, *Tindakan berikutnya*, *ditarik*). **Kept English** (§A): the
 * catalogue's categories (§A.3's tabs: *Life*, *Health*, *Critical illness*, *Education*, and *Investment*, the tab
 * *Investment-linked* in short — for approval), *Commission rate* (§A.4), *Attack Plan* and *Script* (§A.3, §A.6), *KPM*
 * and *Owner* (§A.5), *Health* in the need's note. **Content stays as typed** (ADR-0179 §5; §C3): a product's name, its
 * tagline, benefits, what makes it different, its best fit, its attack plan, a code.
 *
 * **A need's chip writes its code in English, as it always has**, and its name in Indonesian (`need`): the English
 * screen shows the code (*life-protection*), which no reader of ID mode should meet.
 *
 * @moved components/products-tab.tsx
 */
const en = {
  /** A product's category, the catalogue's tabs (§A.3) — *Investment* the tab *Investment-linked* in short. */
  categories: {
    life: kept('Life'),
    health: kept('Health'),
    ci: kept('Critical illness'),
    education: kept('Education'),
    investment: kept('Investment'),
  },
  /** Its lifecycle (ADR-0033): the badge, and the three controls that move it. */
  lifecycle: {
    active: 'Active',
    closed_to_new_business: 'Closed to new business',
    withdrawn: 'Withdrawn',
  },

  /** The tab's states: a catalogue that could not be read, and none yet. `message` is the API's, as sent. */
  readFailed: ({ message }: { message: string }) => `Could not read this company’s catalog. ${message}`,
  tryAgain: 'Try again',
  /** A save refused because somebody else saved, closed or withdrew the product first (P19-T6 AC-2). */
  savedElsewhere: 'Someone else changed this product after you opened it, so your changes were not saved. Reload to see '
    + 'what is stored now; what you typed stays on screen until you do.',
  reload: 'Reload',
  empty: 'This company has no products yet. Add the first one, and every office of this company can sell it from '
    + 'their next read.',

  /** The card in place of a draft bar: the catalogue is read live. */
  live: 'This catalog is live.',
  /** The ⓘ beside it, which holds the rest from 768px (P19.2-T2 AC-7; UI-136, Appendix A). */
  liveAbout: 'About this catalog',
  liveDetail: 'It has no draft and no version: what you change here reaches every office of this company on their next '
    + 'read, and no Owner has to publish it. What an office decides — which of these it sells, and its own wording — '
    + 'stays the office’s.',
  counts: ({ products, active, byDefault }: { products: number; active: number; byDefault: number }) =>
    `${products} ${products === 1 ? 'product' : 'products'} · ${active} active · ${byDefault} active by default in a `
    + 'new office',
  reorderHint: 'Drag ⠿ to reorder, or focus it and press ↑ or ↓.',
  addProduct: 'Add a product',
  activeByDefault: 'Active by default',
  close: 'Close',

  /** A product opened: its identity, read-only. */
  codeReason: 'Typed once. A policy and a lead point at it, so it never changes.',
  version: 'Version',
  versionReason: 'Bumped by every change but a reorder, which is presentation.',
  tagline: 'Tagline',
  channel: 'Channel',
  category: 'Category',

  /** What the customer is buying, and who it fits. */
  primaryNeed: 'Primary need',
  primaryNeedHint: 'What the customer is buying. Accident is a need, not a category — accident products sit under Health.',
  /** A need's chip: `code` the API's (*life-protection*), `name` its name in the reader's language. */
  need: ({ code }: { code: string; name: string }) => code,
  whoItFits: 'Who it fits',
  whoItFitsHint: 'What the fit check scores a prospect against.',
  age: 'Age',
  monthlyBudget: 'Monthly budget',
  benefits: 'Benefits',
  onePerLine: 'One per line.',
  differentiator: 'What makes it different',
  bestFor: 'Best for',
  activeByDefaultHint: 'What an office sells before its Owner has an opinion about this product. An office that has '
    + 'already decided keeps its decision.',

  /** The default attack plan, in the order and the numbers of the Owner's override modal (`KPM_Owner.html:1786-1793`). */
  plan: {
    title: 'The default attack plan',
    lead: 'The words an agent opens with. An office may override them, and its own approval gate decides when its '
      + 'agents see the override.',
    goodFit: '0 · Good fit for',
    opening: '1 · Opening line',
    benefits: '2 · Lead with these benefits',
    fullScript: '3 · Full script',
    /** The cards (P19.4-T4 AC-1, ADR-0209 §9): each objection and its reply, repeatable. */
    objections: '4 · If they push back',
    nextAction: '5 · Next action',
    /** A rider has no attack plan of its own (OD-262, ADR-0209 §3). */
    riderHasNone: 'A rider has no attack plan of its own: agents meet it inside its base products, as “Can be added”.',
  },

  /** Riders (P19.4-T4 AC-9; the riders spec's admin screen, ADR-0209 §7). */
  kindLabel: ({ name }: { name: string }) => `Kind of ${name}`,
  kinds: { base: 'Base product', rider: 'Rider' },
  riderChip: kept('Rider'),
  forBases: ({ names }: { names: string }) => `For: ${names}`,
  attachesTo: 'Can be added to',
  attachesToHint: 'This company’s active base products. Agents see the rider inside each of them, never on its own.',
  attachAtLeastOne: 'Choose at least one base product',
  noActiveBase: 'This company has no active base product to attach a rider to.',
  ridersAvailable: 'Riders available:',
  ridersNone: 'none',
  openRider: ({ name }: { name: string }) => `Open ${name}`,
  unattached: 'This rider is not attached to any active product',
  /** The list's filters: the kind, and the withdrawn products (B1-5). */
  filterLabel: 'Kind',
  filters: { all: 'All', base: 'Base products', rider: 'Riders' },
  showWithdrawn: 'Show withdrawn',
  noneShown: 'No product matches. Change the filter, or show the withdrawn ones.',

  /**
   * **One line per product** (P19.2-T2 AC-2; UI-131, `admin-mobile` screen 3, `admin-desktop` screen 2): the list's
   * caption, its search, its chips' names, the filter button, *Ubah urutan* and the laptop's columns. The mockups' own
   * Indonesian where they draw it (*Cari produk*, *Ubah urutan*, *Produk*, *Kategori*, *Status*, *Default di KPM baru*,
   * *Ya*); the rest proposed in §B.10 of the glossary for approval (O-8). The channel's column is *Channel* — the
   * mockup's *Jenis* is the riders spec's word for the kind on this screen.
   */
  caption: 'Products',
  search: 'Search products',
  channelFilter: 'Filter by channel',
  categoryFilter: 'Filter by category',
  filter: 'Filter',
  filterOn: 'Filter, a filter is on',
  reorder: 'Change order',
  reorderDone: 'Done',
  columns: {
    number: '#',
    product: 'Product',
    status: 'Status',
    byDefault: 'Default in a new office',
    /** The › column, said to a screen reader only. */
    open: 'Open',
  },
  yes: 'Yes',
  notByDefault: '–',

  /** A product's currencies (P19.4-T4 AC-12, B1-4): a label, never a sum. */
  currency: 'Currency',
  currencyHint: 'What its policies are sold in. A label only: no sum is converted.',
  currencyAtLeastOne: 'Choose at least one currency.',

  /** The commission schedule (OD-135, ADR-0119). `max` is the API's last policy year. */
  commission: {
    title: 'Commission',
    notShown: 'You are not shown commission rates.',
    notSet: 'Not set. Nothing is shown to an agent until this company states its schedule — a figure somebody reads as '
      + 'their pay is never one this product invents.',
    caption: 'Commission rate',
    year: 'Year',
    rate: 'Rate (%)',
    rateFor: ({ year }: { year: number }) => `Rate for year ${year}`,
    outOfRange: 'Enter a rate from 0 to 100.',
    tooPrecise: 'Use at most two decimal places.',
    addYear: '+ Add year',
    removeYear: ({ year }: { year: number }) => `Remove year ${year}`,
    full: ({ max }: { max: number }) => `A schedule covers at most ${max} years.`,
  },
  saveProduct: 'Save product',

  /** The lifecycle, which reaches every office (ADR-0033); `strong` wraps the bold phrase. */
  lifecycleTitle: 'Lifecycle',
  lifecycleLead: ({ strong }: { strong: Strong }) => words(
    'Each of these reaches ',
    strong('every office of this company'),
    ' on their next read. Only a withdrawn product that nothing names can be deleted, and its code is never used again.',
  ),
  replacedBy: 'Replaced by',
  replacedByHint: 'Optional, and only a product on this company’s shelf.',
  nothingReplaces: 'Nothing replaces it',
  closeToNewBusiness: 'Close to new business',
  closeTip: 'Existing policies keep running; nobody sells it to somebody new.',
  withdraw: 'Withdraw',
  withdrawTip: 'Every office of this company stops selling it on their next read.',
  reopen: 'Reopen',
  reopenTip: 'Back on sale. Offices keep whatever they had decided.',
  /** Delete (P19.4-T4 AC-13, B1-5): a withdrawn product only, after a question. */
  delete: 'Delete',
  deleteTip: 'Only a withdrawn product nothing names: no office sells it or has a script for it, and no rider is attached.',
  deleteConfirm: ({ name }: { name: string }) =>
    `Delete ${name}? It leaves this list for good, and its code is never used again.`,
  deleteConfirmLabel: 'Delete product',

  /** *Add a product*: the code, filled in from the name. */
  addCodeHint: 'Filled in from the name. Typed once, and never reused.',
  codeTaken: 'This company already has a product with this code.',
};

const id: MessagesOf<typeof en> = {
  categories: {
    life: kept('Life'),
    health: kept('Health'),
    ci: kept('Critical illness'),
    education: kept('Education'),
    investment: kept('Investment'),
  },
  lifecycle: {
    active: 'Aktif',
    closed_to_new_business: 'Ditutup untuk penjualan baru',
    withdrawn: 'Ditarik',
  },

  readFailed: ({ message }) => `Tidak dapat membaca katalog perusahaan ini. ${message}`,
  tryAgain: 'Coba lagi',
  savedElsewhere: 'Orang lain mengubah produk ini setelah Anda membukanya, jadi perubahan Anda tidak tersimpan. Muat ulang '
    + 'untuk melihat yang tersimpan sekarang; yang Anda ketik tetap di layar sampai Anda memuat ulang.',
  reload: 'Muat ulang',
  empty: `Perusahaan ini belum punya produk. Tambahkan yang pertama, dan setiap ${kept('KPM')} perusahaan ini dapat `
    + 'menjualnya saat membaca katalog berikutnya.',

  live: 'Katalog ini langsung berlaku.',
  liveAbout: 'Tentang katalog ini',
  liveDetail: `Katalog ini tidak punya draf dan versi: yang Anda ubah di sini sampai ke setiap ${kept('KPM')} perusahaan `
    + `ini saat membaca katalog berikutnya, dan tidak ada ${kept('Owner')} yang perlu menerbitkannya. Yang diputuskan `
    + `${kept('KPM')} — produk mana yang dijualnya, dan kata-katanya sendiri — tetap milik ${kept('KPM')} itu.`,
  // One form for one and many (§B.0 rule 8).
  counts: ({ products, active, byDefault }) =>
    `${products} produk · ${active} aktif · ${byDefault} aktif secara default di ${kept('KPM')} baru`,
  reorderHint: 'Seret ⠿ untuk mengubah urutan, atau fokuskan lalu tekan ↑ atau ↓.',
  addProduct: 'Tambah produk',
  activeByDefault: 'Aktif secara default',
  close: 'Tutup',

  codeReason: `Diketik sekali. Polis dan ${kept('lead')} merujuk ke kode ini, jadi kode ini tidak pernah berubah.`,
  version: 'Versi',
  versionReason: 'Naik pada setiap perubahan kecuali perubahan urutan, yang hanya soal tampilan.',
  tagline: 'Deskripsi singkat',
  channel: 'Kanal',
  category: 'Kategori',

  primaryNeed: 'Kebutuhan utama',
  primaryNeedHint: 'Yang dibeli nasabah. Kecelakaan adalah kebutuhan, bukan kategori — produk kecelakaan masuk ke '
    + `${kept('Health')}.`,
  // The need's name, in the field selling screens' words (`sales-attack-plan.tsx`), where English writes its code.
  need: ({ name }) => name,
  whoItFits: 'Cocok untuk siapa',
  whoItFitsHint: 'Acuan cek kecocokan saat menilai prospek.',
  age: 'Usia',
  monthlyBudget: 'Anggaran bulanan',
  benefits: 'Manfaat',
  onePerLine: 'Satu per baris.',
  differentiator: 'Yang membuatnya berbeda',
  bestFor: 'Paling cocok untuk',
  activeByDefaultHint: `Yang dijual ${kept('KPM')} sebelum ${kept('Owner')}-nya menentukan sikap atas produk ini. `
    + `${kept('KPM')} yang sudah memutuskan tetap memakai keputusannya.`,

  plan: {
    title: `${kept('Attack Plan')} default`,
    lead: `Kata-kata pembuka agent. ${kept('KPM')} boleh menggantinya, dan persetujuan ${kept('KPM')} itu sendiri yang `
      + 'menentukan kapan agent-nya melihat penggantinya.',
    goodFit: '0 · Cocok untuk',
    opening: '1 · Kalimat pembuka',
    benefits: '2 · Tekankan manfaat berikut',
    fullScript: `3 · ${kept('Script')} lengkap`,
    // *They* is one customer, so *dia* (§B.0 rule 8).
    objections: '4 · Jika ada keberatan',
    nextAction: '5 · Tindakan berikutnya',
    riderHasNone: `${kept('Rider')} tidak punya ${kept('Attack Plan')} sendiri: agent melihatnya di dalam produk dasarnya, `
      + 'sebagai “Bisa ditambah”.',
  },

  // The riders spec's own words (*Admin UI*), verbatim.
  kindLabel: ({ name }) => `Jenis ${name}`,
  kinds: { base: 'Produk dasar', rider: kept('Rider') },
  riderChip: kept('Rider'),
  forBases: ({ names }) => `Untuk: ${names}`,
  attachesTo: 'Bisa ditambahkan ke',
  attachesToHint: `Produk dasar aktif perusahaan ini. Agent melihat ${kept('rider')} di dalam setiap produk itu, tidak `
    + 'pernah sendirian.',
  attachAtLeastOne: 'Pilih minimal satu produk dasar',
  noActiveBase: `Perusahaan ini belum punya produk dasar aktif untuk dipasangi ${kept('rider')}.`,
  ridersAvailable: `${kept('Rider')} yang tersedia:`,
  ridersNone: 'belum ada',
  openRider: ({ name }) => `Buka ${name}`,
  unattached: `${kept('Rider')} ini tidak terpasang ke produk aktif mana pun`,
  filterLabel: 'Jenis',
  filters: { all: 'Semua', base: 'Produk dasar', rider: kept('Rider') },
  showWithdrawn: 'Tampilkan ditarik',
  noneShown: 'Tidak ada produk yang cocok. Ubah filternya, atau tampilkan yang ditarik.',

  caption: 'Produk',
  search: 'Cari produk',
  channelFilter: 'Saring menurut kanal',
  categoryFilter: 'Saring menurut kategori',
  filter: 'Filter',
  filterOn: 'Filter, ada filter aktif',
  reorder: 'Ubah urutan',
  reorderDone: 'Selesai',
  columns: {
    number: '#',
    product: 'Produk',
    status: 'Status',
    byDefault: `Default di ${kept('KPM')} baru`,
    open: 'Buka',
  },
  yes: 'Ya',
  notByDefault: '–',

  currency: 'Mata uang',
  currencyHint: 'Mata uang polisnya dijual. Hanya label: tidak ada jumlah yang dikonversi.',
  currencyAtLeastOne: 'Pilih minimal satu mata uang.',

  commission: {
    title: 'Komisi',
    notShown: 'Persentase komisi tidak ditampilkan untuk Anda.',
    notSet: 'Belum diatur. Tidak ada yang ditampilkan kepada agent sampai perusahaan ini menetapkan jadwalnya — angka '
      + 'yang dibaca seseorang sebagai penghasilannya tidak pernah dikarang oleh aplikasi ini.',
    caption: 'Persentase komisi',
    year: 'Tahun',
    rate: 'Persentase (%)',
    rateFor: ({ year }) => `Persentase untuk tahun ${year}`,
    outOfRange: 'Masukkan persentase dari 0 sampai 100.',
    tooPrecise: 'Gunakan paling banyak dua angka desimal.',
    addYear: '+ Tambah tahun',
    removeYear: ({ year }) => `Hapus tahun ${year}`,
    full: ({ max }) => `Jadwal mencakup paling banyak ${max} tahun.`,
  },
  saveProduct: 'Simpan produk',

  // As an office's *Lifecycle* card names it (§B.10, the Super Admin's console).
  lifecycleTitle: 'Siklus hidup',
  lifecycleLead: ({ strong }) => words(
    'Setiap tindakan ini sampai ke ',
    strong(`setiap ${kept('KPM')} perusahaan ini`),
    ' saat membaca katalog berikutnya. Hanya produk yang ditarik dan tidak dirujuk apa pun yang dapat dihapus, dan '
      + 'kodenya tidak pernah dipakai lagi.',
  ),
  replacedBy: 'Digantikan oleh',
  replacedByHint: 'Opsional, dan hanya produk di etalase perusahaan ini.',
  nothingReplaces: 'Tidak ada penggantinya',
  closeToNewBusiness: 'Tutup untuk penjualan baru',
  closeTip: 'Polis yang sudah ada tetap berjalan; tidak ada yang menjualnya kepada nasabah baru.',
  withdraw: 'Tarik',
  withdrawTip: `Setiap ${kept('KPM')} perusahaan ini berhenti menjualnya saat membaca katalog berikutnya.`,
  reopen: 'Buka kembali',
  reopenTip: `Dijual kembali. Setiap ${kept('KPM')} tetap memakai keputusannya sendiri.`,
  delete: 'Hapus',
  deleteTip: `Hanya produk yang ditarik dan tidak dirujuk apa pun: tidak ada ${kept('KPM')} yang menjualnya atau punya `
    + `${kept('script')} untuknya, dan tidak ada ${kept('rider')} yang terpasang.`,
  deleteConfirm: ({ name }) => `Hapus ${name}? Produk ini hilang dari daftar untuk selamanya, dan kodenya tidak pernah `
    + 'dipakai lagi.',
  deleteConfirmLabel: 'Hapus produk',

  addCodeHint: 'Diisi dari nama. Diketik sekali, dan tidak pernah dipakai ulang.',
  codeTaken: 'Perusahaan ini sudah punya produk dengan kode ini.',
};

export const adminTemplateProductsMessages = defineMessages({ en, id });
