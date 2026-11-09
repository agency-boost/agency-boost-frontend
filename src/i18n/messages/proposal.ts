import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **The simple proposal** (P19.7-T2; `functional/proposal.md`; ADR-0221, ADR-0225): *Riwayat* at `/proposal`, step 1 at
 * `/proposal/new` and the three steps of a stored proposal at `/proposal/[proposalId]` — the progress bar, *Untuk
 * siapa?*, *Pilih produk* with its two settings, the cards, a product's panel, *Lihat semua plan*, *Tanya-jawab*, the
 * saves — and Home's *Buat proposal* pill.
 *
 * **The Indonesian is the owner's spec, verbatim** (`revisions/2026-11-03/files/proposal/proposal-spec-2026-11-03.md`):
 * *Buat proposal pertama*, *Umur belum ada*, *"Umur dan jenis kelamin belum ada di lead ini. Isi sekali, nanti tersimpan
 * di lead."*, *"Umur tersimpan di lead"*, *Konvensional / Syariah*, *Cara bayar*, *Tertanggung*, *Premi per …* and
 * *Kontribusi* on a *Syariah* proposal (ADR-0221 §9), *"Lihat di ilustrasi resmi"*, *"Total dibayar selama N tahun"*,
 * *Lihat semua plan*, *"Premi: lihat ilustrasi resmi"*, *Paling banyak dipilih*, *Tanya-jawab*, *"Belum ada produk —
 * minta Owner menambahkannya"*; ADR-0221's own sentences (*"{n} produk tidak tersedia untuk pilihan ini dan akan
 * dihapus."*, *"Cara bayar diubah — isi lagi preminya."*) and the spec's states (*"Belum tersimpan. Coba lagi."*,
 * *"Proposal ini diubah di perangkat lain."*). The English is the catalogue's translation of them. *Proposal*, *PDF* and
 * *Syariah* read the same in both (`SAME_IN_INDONESIAN`).
 *
 * **Content stays as typed**: a client's and a product's names, a plan's name and highlights, an FAQ, a field's label —
 * the catalogue's words, which the server answers (ADR-0179 §5). **A message never writes a figure**: an amount is
 * written by the caller in the figures' language and passed in.
 *
 * @moved components/proposal/
 * @moved app/(agent)/proposal/
 */
const en = {
  title: 'Proposal',
  /** *Riwayat* (`/proposal`; AC-10). */
  history: {
    heading: 'History',
    newProposal: 'Make a proposal',
    /** The empty state, one large button (AC-1; D-37). */
    firstProposal: 'Make your first proposal',
    searchName: 'Search proposals',
    searchPlaceholder: 'Client or product…',
    noMatch: ({ term }: { term: string }) => `No proposals match “${term}”.`,
    loading: 'Loading proposals',
    loadMore: 'Show more',
    actions: ({ client }: { client: string }) => `Actions for the proposal for ${client}`,
    open: 'Open',
    duplicate: 'Duplicate',
    delete: 'Delete',
    deleteAsk: ({ client }: { client: string }) =>
      `Delete the proposal for ${client}? It leaves History and the lead.`,
    deleteConfirm: 'Delete',
    cancel: 'Cancel',
    deleted: 'Proposal deleted',
    duplicated: 'Proposal duplicated',
    dropped: ({ n }: { n: number }) =>
      `${n} ${n === 1 ? 'product is' : 'products are'} no longer offered and ${n === 1 ? 'was' : 'were'} left out.`,
    productsNone: 'No products yet',
    /** *Unduh lagi* (T2 AC-10; ADR-0222 §2): a *Selesai* proposal's file, built again with today's branding. */
    download: 'Download again',
    downloaded: 'PDF downloaded',
  },
  status: {
    draft: 'Draft',
    done: 'Done',
  },
  /** The progress bar (AC-2): *1 Klien · 2 Produk · 3 PDF*. */
  steps: {
    label: 'Steps',
    client: 'Client',
    products: 'Products',
    pdf: 'PDF',
  },
  back: 'Back',
  next: 'Next',
  /** Step 1, *Untuk siapa?* (AC-3, AC-4). */
  client: {
    heading: 'Who is it for?',
    searchName: 'Search your Sales leads',
    searchPlaceholder: 'Search a lead…',
    leadsLabel: 'Your Sales leads',
    noLeadMatch: ({ term }: { term: string }) => `No lead matches “${term}”.`,
    loading: 'Loading leads',
    newClient: 'New client',
    fromLeads: 'Choose a lead',
    name: 'Name',
    /** The amber pill on a lead with no age or gender (Acc. 3). */
    ageMissing: 'No age yet',
    missingCard: 'This lead has no age or gender yet. Fill them in once and they are kept on the lead.',
    ageSaved: 'Age saved on the lead',
  },
  /** Step 2, *Pilih produk* (AC-5 to AC-9). */
  products: {
    heading: 'Choose products',
    channelLabel: 'Conventional or Syariah',
    channels: {
      conventional: 'Conventional',
      syariah: 'Syariah',
    },
    payLabel: 'Payment frequency',
    pay: {
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      semiannual: 'Half-yearly',
      annual: 'Annually',
    },
    payChanged: 'Payment frequency changed — enter the premiums again.',
    willRemove: ({ n }: { n: number }) =>
      `${n} ${n === 1 ? 'product is' : 'products are'} not available for this choice and will be removed.`,
    continue: 'Continue',
    cancel: 'Cancel',
    cardsLabel: 'Products',
    noProducts: 'No products yet — ask the Owner to add them',
    added: 'Added',
    full: ({ max }: { max: number }) => `At most ${max} products in one proposal.`,
    loading: 'Loading products',
  },
  /** A product's panel (AC-7). */
  panel: {
    remove: ({ product }: { product: string }) => `Remove ${product}`,
    insured: 'Insured',
    relations: {
      client: 'Client',
      spouse: 'Spouse',
      child: 'Child',
      other: 'Someone else',
    },
    insuredName: 'Name',
    insuredAge: 'Age',
    /** *Premi per bulan* … — *Kontribusi* on a Syariah proposal (ADR-0221 §9). */
    premiumPer: {
      monthly: 'Premium per month',
      quarterly: 'Premium per quarter',
      semiannual: 'Premium per half-year',
      annual: 'Premium per year',
    },
    contributionPer: {
      monthly: 'Contribution per month',
      quarterly: 'Contribution per quarter',
      semiannual: 'Contribution per half-year',
      annual: 'Contribution per year',
    },
    premiumHint: 'See the official illustration',
    /** `amount` written in full by the caller, in the figures' language. */
    totalPaid: ({ years, amount }: { years: number; amount: string }) => `Total paid over ${years} years: ${amount}`,
    canBeAdded: 'Can be added:',
    atLeast: ({ amount }: { amount: string }) => `At least ${amount}`,
    seePlans: 'See all plans',
    faq: 'Q&A',
  },
  /** *Lihat semua plan* (AC-8). */
  plans: {
    title: ({ product }: { product: string }) => `${product} plans`,
    premium: 'Premium: see the official illustration',
    contribution: 'Contribution: see the official illustration',
    popular: 'Most chosen',
    chosen: 'Chosen',
  },
  faq: {
    title: ({ product }: { product: string }) => `${product} — Q&A`,
  },
  /** The saves (`functional/proposal.md`, *States*). */
  save: {
    saving: 'Saving…',
    failed: 'Not saved yet. Try again.',
    retry: 'Try again',
    conflict: 'This proposal was changed on another device.',
  },
  /**
   * Step 3, *Lihat PDF* (P19.7-T3; ADR-0222 §4, §5): the file's own pages, *Simpan PDF*, *Ubah* and *Tampilkan total
   * premi*; the view-only session's sentence is ADR-0222 §4's, verbatim in Indonesian.
   */
  pdf: {
    heading: 'See the PDF',
    pages: 'The proposal’s pages',
    page: ({ n, count }: { n: number; count: number }) => `Page ${n} of ${count}`,
    loading: 'Preparing the PDF',
    edit: 'Edit',
    save: 'Save PDF',
    saving: 'Saving…',
    saved: 'PDF saved',
    showTotal: 'Show total premium',
    showTotalSyariah: 'Show total contribution',
    viewOnly: 'The PDF preview is not available in a view-only session.',
    unreadable: 'The PDF could not be shown on this device.',
    retry: 'Try again',
  },
  /** Home's quick action (AC-1; ADR-0221 §8). */
  home: {
    make: 'Make a proposal',
  },
};

const id: MessagesOf<typeof en> = {
  title: 'Proposal',
  history: {
    heading: 'Riwayat',
    newProposal: 'Buat proposal',
    firstProposal: 'Buat proposal pertama',
    searchName: 'Cari proposal',
    searchPlaceholder: 'Klien atau produk…',
    noMatch: ({ term }) => `Tidak ada proposal yang cocok dengan “${term}”.`,
    loading: 'Memuat proposal',
    loadMore: 'Tampilkan lagi',
    actions: ({ client }) => `Aksi untuk proposal ${client}`,
    open: 'Buka',
    duplicate: 'Duplikat',
    delete: 'Hapus',
    deleteAsk: ({ client }) => `Hapus proposal untuk ${client}? Proposal hilang dari Riwayat dan dari lead.`,
    deleteConfirm: 'Hapus',
    cancel: 'Batal',
    deleted: 'Proposal dihapus',
    duplicated: 'Proposal diduplikat',
    dropped: ({ n }) => `${n} produk tidak ditawarkan lagi dan tidak ikut.`,
    productsNone: 'Belum ada produk',
    download: 'Unduh lagi',
    downloaded: 'PDF terunduh',
  },
  status: {
    draft: 'Draf',
    done: 'Selesai',
  },
  steps: {
    label: 'Langkah',
    client: 'Klien',
    products: 'Produk',
    pdf: 'PDF',
  },
  back: 'Kembali',
  next: 'Lanjut',
  client: {
    heading: 'Untuk siapa?',
    searchName: 'Cari lead Sales Anda',
    searchPlaceholder: 'Cari lead…',
    leadsLabel: 'Lead Sales Anda',
    noLeadMatch: ({ term }) => `Tidak ada lead yang cocok dengan “${term}”.`,
    loading: 'Memuat lead',
    newClient: 'Klien baru',
    fromLeads: 'Pilih lead',
    name: 'Nama',
    ageMissing: 'Umur belum ada',
    missingCard: 'Umur dan jenis kelamin belum ada di lead ini. Isi sekali, nanti tersimpan di lead.',
    ageSaved: 'Umur tersimpan di lead',
  },
  products: {
    heading: 'Pilih produk',
    channelLabel: 'Konvensional atau Syariah',
    channels: {
      conventional: 'Konvensional',
      syariah: 'Syariah',
    },
    payLabel: 'Cara bayar',
    pay: {
      monthly: 'Bulanan',
      quarterly: 'Kuartalan',
      semiannual: 'Semesteran',
      annual: 'Tahunan',
    },
    payChanged: 'Cara bayar diubah — isi lagi preminya.',
    willRemove: ({ n }) => `${n} produk tidak tersedia untuk pilihan ini dan akan dihapus.`,
    continue: 'Lanjut',
    cancel: 'Batal',
    cardsLabel: 'Produk',
    noProducts: 'Belum ada produk — minta Owner menambahkannya',
    added: 'Ditambahkan',
    full: ({ max }) => `Paling banyak ${max} produk dalam satu proposal.`,
    loading: 'Memuat produk',
  },
  panel: {
    remove: ({ product }) => `Hapus ${product}`,
    insured: 'Tertanggung',
    relations: {
      client: 'Klien',
      spouse: 'Pasangan',
      child: 'Anak',
      other: 'Orang lain',
    },
    insuredName: 'Nama',
    insuredAge: 'Umur',
    premiumPer: {
      monthly: 'Premi per bulan',
      quarterly: 'Premi per kuartal',
      semiannual: 'Premi per semester',
      annual: 'Premi per tahun',
    },
    contributionPer: {
      monthly: 'Kontribusi per bulan',
      quarterly: 'Kontribusi per kuartal',
      semiannual: 'Kontribusi per semester',
      annual: 'Kontribusi per tahun',
    },
    premiumHint: 'Lihat di ilustrasi resmi',
    totalPaid: ({ years, amount }) => `Total dibayar selama ${years} tahun: ${amount}`,
    canBeAdded: 'Bisa ditambah:',
    atLeast: ({ amount }) => `Minimal ${amount}`,
    seePlans: 'Lihat semua plan',
    faq: 'Tanya-jawab',
  },
  plans: {
    title: ({ product }) => `Plan ${product}`,
    premium: 'Premi: lihat ilustrasi resmi',
    contribution: 'Kontribusi: lihat ilustrasi resmi',
    popular: 'Paling banyak dipilih',
    chosen: 'Dipilih',
  },
  faq: {
    title: ({ product }) => `${product} — Tanya-jawab`,
  },
  save: {
    saving: 'Menyimpan…',
    failed: 'Belum tersimpan. Coba lagi.',
    retry: 'Coba lagi',
    conflict: 'Proposal ini diubah di perangkat lain.',
  },
  pdf: {
    heading: 'Lihat PDF',
    pages: 'Halaman proposal',
    page: ({ n, count }) => `Halaman ${n} dari ${count}`,
    loading: 'Menyiapkan PDF',
    edit: 'Ubah',
    save: 'Simpan PDF',
    saving: 'Menyimpan…',
    saved: 'PDF tersimpan',
    showTotal: 'Tampilkan total premi',
    showTotalSyariah: 'Tampilkan total kontribusi',
    viewOnly: 'Pratinjau PDF tidak tersedia dalam sesi hanya melihat.',
    unreadable: 'PDF tidak bisa ditampilkan di perangkat ini.',
    retry: 'Coba lagi',
  },
  home: {
    make: 'Buat proposal',
  },
};

export const proposalMessages = defineMessages({ en, id });
