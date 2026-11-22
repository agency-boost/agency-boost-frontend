import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **The simple proposal** (P19.7-T2; *redrawn 2026-11-12 by P19.14-T1, T2, T4*; `functional/proposal.md`; ADR-0221,
 * ADR-0254, ADR-0255): *Riwayat* at `/proposal`, step 1 at `/proposal/new`, and a stored proposal at
 * `/proposal/[proposalId]` — *1 Untuk siapa · 2 Produk*, then the PDF as the result — each product's card, *Lihat semua
 * plan*, *Tanya-jawab*, the saves, and Home's *Buat proposal* pill.
 *
 * **The Indonesian is the owner's spec of 11 November, verbatim** (`revisions/2026-11-13/files/proposal/
 * engineer-spec-p1-proposal.md`): *Untuk siapa?*, *+ Lead baru "{teks}"*, *No. HP*, *Umur ulang tahun berikutnya* and its
 * helper *"Lahir Mei 1991 → sekarang 35 → isi 36"*, *+ Detail klien (opsional)*, *Status (Lajang / Menikah)*,
 * *Tanggungan*, *Pekerjaan*, *Kota*, *Yang dibahas* and its six chips, *"✓ {nama} · {umur} th · {jenis kelamin} · ada
 * di Leads"*, *"Usia {n} di luar batas ({min}–{max})"*, *Tertanggung* (*Peserta* on a syariah product), *Pasangan*,
 * *Anak*, *Orang lain*, *Masa bayar*, *Merokok?*, *Cara bayar*, *Sekali bayar*, *otomatis*, *Uang pertanggungan* (*Santunan
 * asuransi*), *Premi* (*Kontribusi*), *"Lihat di ilustrasi resmi"*, *Lihat proposal*, *Simpan PDF*, *Ubah*, *Tampilkan
 * total*, *"Belum ada produk — minta Owner menambahkannya"*; the 3 November spec's that stay (*Lihat semua plan*,
 * *Tanya-jawab*, *Paling banyak dipilih*, *"Total dibayar selama N tahun"*); and the states (*"Belum tersimpan. Coba
 * lagi."*, *"Proposal ini diubah di perangkat lain."*). The English is the catalogue's translation of them. *Proposal*,
 * *PDF* and *Syariah* read the same in both (`SAME_IN_INDONESIAN`).
 *
 * **Content stays as typed**: a client's and a product's names, a plan's name and highlights, an FAQ, a field's label, a
 * pay term's label — the catalogue's words, which the server answers (ADR-0179 §5). **A message never writes a figure**:
 * an amount is written by the caller in the figures' language and passed in.
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
    /** *Unduh lagi* (ADR-0222 §2): a *Selesai* proposal's file, built again with today's branding. */
    download: 'Download again',
    downloaded: 'PDF downloaded',
  },
  status: {
    draft: 'Draft',
    done: 'Done',
  },
  /** The step pills (P19.14-T1 AC-1): *1 Untuk siapa · 2 Produk*; the PDF is the result, not a step. */
  steps: {
    label: 'Steps',
    client: 'Who for',
    products: 'Products',
  },
  back: 'Back',
  next: 'Next',
  /** Step 1, *Untuk siapa?* (P19.14-T1 AC-2, AC-3). */
  client: {
    heading: 'Who is it for?',
    searchName: 'Search your leads',
    searchPlaceholder: 'Search a lead’s name…',
    leadsLabel: 'Your Sales leads',
    loading: 'Loading leads',
    /** Under the box when nothing matches: *+ Lead baru "{teks}"*. */
    newLead: ({ text }: { text: string }) => `+ New lead “${text}”`,
    newLeadPlain: '+ New lead',
    name: 'Name',
    phone: 'Phone (optional)',
    saveLead: 'Save the lead',
    leadSaved: 'Lead saved in Leads',
    change: 'Change',
    chosen: 'Chosen lead',
    /** The client box, under the chosen lead (1b). */
    clientHeading: 'Client details for this proposal',
    ageHelp: 'Born May 1991 → now 35 → enter 36',
    detailsOpen: '+ Client details (optional)',
    detailsClose: 'Hide the client details',
    status: 'Status',
    statuses: { single: 'Single', married: 'Married' },
    dependants: 'Dependants',
    dependantsHint: 'e.g. Wife, 2 children',
    occupation: 'Occupation',
    city: 'City',
    needs: 'Discussed',
    needOptions: {
      HOSPITAL: 'Hospital costs',
      CRITICAL_INCOME: 'Income during critical illness',
      FAMILY: 'Family benefit',
      EDUCATION: 'Education fund',
      FUTURE: 'Future / retirement fund',
      OTHER: 'Other',
    },
    needsOther: 'What else was discussed',
    /** Why *Lanjut* waits (an `sr-only` description of the disabled button). */
    needsAgeGender: 'Enter the age and the gender to continue.',
    willRemove: ({ n }: { n: number }) =>
      `${n} ${n === 1 ? 'product is' : 'products are'} not available at this age and will be removed.`,
    continue: 'Continue',
    cancel: 'Cancel',
  },
  /** Step 2, *Produk* (P19.14-T2 AC-1 to AC-6). */
  products: {
    heading: 'Products',
    /** *"✓ Pak Budi · 35 th · Laki-laki · ada di Leads"*: `gender` the caller's words. */
    clientLine: ({ name, age, gender }: { name: string; age: number; gender: string }) =>
      `✓ ${name} · ${age} yrs · ${gender} · in Leads`,
    clientLineHint: 'Change who it is for',
    searchName: 'Search products',
    searchPlaceholder: 'Search a product…',
    categoriesLabel: 'Categories',
    all: 'All',
    cardsLabel: 'Products',
    outOfAge: ({ age, min, max }: { age: number; min: number; max: number }) => `Age ${age} outside the limit (${min}–${max})`,
    noProducts: 'No products yet — ask the Owner to add them',
    noMatch: ({ term }: { term: string }) => `No product matches “${term}”.`,
    added: 'Added',
    full: ({ max }: { max: number }) => `At most ${max} products in one proposal.`,
    loading: 'Loading products',
    /** The floating button (the result): active once a product has a premium. */
    seeProposal: 'See the proposal',
    seeProposalWait: 'Enter a premium to see the proposal.',
  },
  /** A product's card (P19.14-T2 AC-3, AC-4). */
  panel: {
    remove: ({ product }: { product: string }) => `Remove ${product}`,
    insured: 'Insured',
    /** A syariah product's word for the insured (ADR-0255 §1). */
    insuredSyariah: 'Participant',
    relations: {
      spouse: 'Spouse',
      child: 'Child',
      other: 'Someone else',
    },
    insuredName: 'Name',
    insuredAge: 'Age',
    payTerm: 'Payment term',
    /** A pay term the insured's age does not allow: crossed out, and its reason for a screen reader. */
    payTermBlocked: ({ max }: { max: number }) => `Not available above age ${max}`,
    payTermMoved: ({ from, to, age }: { from: string; to: string; age: number }) =>
      `${from} is not available at age ${age} — changed to ${to}.`,
    payTermNone: ({ age }: { age: number }) => `No payment term is offered at age ${age}.`,
    smoker: 'Smoker?',
    smokerOptions: { no: 'No', yes: 'Yes' },
    payFrequency: 'Payment frequency',
    pay: {
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      semiannual: 'Half-yearly',
      annual: 'Annually',
      single: 'Single payment',
    },
    payChanged: 'Payment frequency changed — enter the premium again.',
    /** A plan worked out from other fields: *otomatis*. */
    automatic: 'automatic',
    up: 'Sum assured',
    upSyariah: 'Insurance benefit',
    /** *Premi per bulan* … — *Kontribusi* on a syariah product (ADR-0255 §1). */
    premiumPer: {
      monthly: 'Premium per month',
      quarterly: 'Premium per quarter',
      semiannual: 'Premium per half-year',
      annual: 'Premium per year',
      single: 'Single premium',
    },
    contributionPer: {
      monthly: 'Contribution per month',
      quarterly: 'Contribution per quarter',
      semiannual: 'Contribution per half-year',
      annual: 'Contribution per year',
      single: 'Single contribution',
    },
    premiumHint: 'See the official illustration',
    /*
     * P19.15-T1 (ADR-0258 §5; the P1 spec's *Premium and UP*): the card calculating. Amounts and dates written by the
     * caller in the figures' language.
     */
    calc: {
      tableFrom: ({ date }: { date: string }) => `Premium table in force from ${date}`,
      singlePayment: 'single payment',
      fixed: 'typed by you',
      calculated: 'calculated',
      benefit: ({ amount }: { amount: string }) => `Benefit from the table: ${amount}`,
      adjusted: ({ step }: { step: string }) => `Premium adjusted because the sum assured was rounded to ${step}`,
      updated: ({ date }: { date: string }) => `Premium updated to the rates from ${date}`,
      tableOff: 'The premium table no longer applies. Type the premium from the official illustration.',
      missing: 'This combination is not in the premium table',
      noFrequency: 'This payment frequency is not in the premium table',
      ageOutside: ({ age, min, max }: { age: number; min: string; max: string }) => `Age ${age} is outside the table’s entry ages (${min}–${max})`,
      needsAge: 'Fill in the insured’s age to calculate the premium',
      needsGender: 'Choose the insured’s gender to calculate the premium',
      limits: {
        up_min: ({ limit }: { limit: string }) => `Min. sum assured ${limit}`,
        up_max: ({ limit }: { limit: string }) => `Max. sum assured ${limit}`,
        premium_min: ({ limit }: { limit: string }) => `Min. premium ${limit} a year`,
        premium_max: ({ limit }: { limit: string }) => `Max. premium ${limit} a year`,
      },
      use: ({ amount }: { amount: string }) => `use ${amount}`,
      useUp: ({ amount }: { amount: string }) => `use sum assured ${amount}`,
      useGoal: ({ amount }: { amount: string }) => `use ${amount}`,
    },
    /** `amount` written in full by the caller, in the figures' language. */
    totalPaid: ({ years, amount }: { years: number; amount: string }) => `Total paid over ${years} years: ${amount}`,
    canBeAdded: 'Can be added:',
    atLeast: ({ amount }: { amount: string }) => `At least ${amount}`,
    seePlans: 'See all plans',
    faq: 'Q&A',
  },
  /** *Lihat semua plan*. */
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
   * The result, the PDF (P19.14-T1 AC-1; ADR-0222 §4, §5): the file's own pages, *Simpan PDF*, *Ubah* and *Tampilkan
   * total*; the view-only session's sentence is ADR-0222 §4's, verbatim in Indonesian.
   */
  pdf: {
    heading: 'The proposal',
    pages: 'The proposal’s pages',
    page: ({ n, count }: { n: number; count: number }) => `Page ${n} of ${count}`,
    loading: 'Preparing the PDF',
    edit: 'Edit',
    save: 'Save PDF',
    saving: 'Saving…',
    saved: 'PDF saved',
    showTotal: 'Show total',
    viewOnly: 'The PDF preview is not available in a view-only session.',
    unreadable: 'The PDF could not be shown on this device.',
    retry: 'Try again',
  },
  /** Home's quick action (ADR-0221 §8). */
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
    client: 'Untuk siapa',
    products: 'Produk',
  },
  back: 'Kembali',
  next: 'Lanjut',
  client: {
    heading: 'Untuk siapa?',
    searchName: 'Cari lead Anda',
    searchPlaceholder: 'Cari nama lead…',
    leadsLabel: 'Lead Sales Anda',
    loading: 'Memuat lead',
    newLead: ({ text }) => `+ Lead baru “${text}”`,
    newLeadPlain: '+ Lead baru',
    name: 'Nama',
    phone: 'No. HP (opsional)',
    saveLead: 'Simpan lead',
    leadSaved: 'Lead tersimpan di Leads',
    change: 'Ganti',
    chosen: 'Lead dipilih',
    clientHeading: 'Data klien untuk proposal',
    ageHelp: 'Lahir Mei 1991 → sekarang 35 → isi 36',
    detailsOpen: '+ Detail klien (opsional)',
    detailsClose: 'Sembunyikan detail klien',
    status: 'Status',
    statuses: { single: 'Lajang', married: 'Menikah' },
    dependants: 'Tanggungan',
    dependantsHint: 'mis. Istri, 2 anak',
    occupation: 'Pekerjaan',
    city: 'Kota',
    needs: 'Yang dibahas',
    needOptions: {
      HOSPITAL: 'Biaya rumah sakit',
      CRITICAL_INCOME: 'Penghasilan saat sakit kritis',
      FAMILY: 'Santunan keluarga',
      EDUCATION: 'Dana pendidikan',
      FUTURE: 'Dana masa depan / pensiun',
      OTHER: 'Lainnya',
    },
    needsOther: 'Yang dibahas lainnya',
    needsAgeGender: 'Isi umur dan jenis kelamin untuk lanjut.',
    willRemove: ({ n }) => `${n} produk tidak tersedia untuk umur ini dan akan dihapus.`,
    continue: 'Lanjut',
    cancel: 'Batal',
  },
  products: {
    heading: 'Produk',
    clientLine: ({ name, age, gender }) => `✓ ${name} · ${age} th · ${gender} · ada di Leads`,
    clientLineHint: 'Ganti untuk siapa',
    searchName: 'Cari produk',
    searchPlaceholder: 'Cari produk…',
    categoriesLabel: 'Kategori',
    all: 'Semua',
    cardsLabel: 'Produk',
    outOfAge: ({ age, min, max }) => `Usia ${age} di luar batas (${min}–${max})`,
    noProducts: 'Belum ada produk — minta Owner menambahkannya',
    noMatch: ({ term }) => `Tidak ada produk yang cocok dengan “${term}”.`,
    added: 'Ditambahkan',
    full: ({ max }) => `Paling banyak ${max} produk dalam satu proposal.`,
    loading: 'Memuat produk',
    seeProposal: 'Lihat proposal',
    seeProposalWait: 'Isi premi dulu untuk melihat proposal.',
  },
  panel: {
    remove: ({ product }) => `Hapus ${product}`,
    insured: 'Tertanggung',
    insuredSyariah: 'Peserta',
    relations: {
      spouse: 'Pasangan',
      child: 'Anak',
      other: 'Orang lain',
    },
    insuredName: 'Nama',
    insuredAge: 'Umur',
    payTerm: 'Masa bayar',
    payTermBlocked: ({ max }) => `Tidak tersedia di atas usia ${max}`,
    payTermMoved: ({ from, to, age }) => `${from} tidak tersedia untuk usia ${age} — diganti ${to}.`,
    payTermNone: ({ age }) => `Tidak ada masa bayar untuk usia ${age}.`,
    smoker: 'Merokok?',
    smokerOptions: { no: 'Tidak', yes: 'Ya' },
    payFrequency: 'Cara bayar',
    pay: {
      monthly: 'Bulanan',
      quarterly: 'Kuartalan',
      semiannual: 'Semesteran',
      annual: 'Tahunan',
      single: 'Sekali bayar',
    },
    payChanged: 'Cara bayar diubah — isi lagi preminya.',
    automatic: 'otomatis',
    up: 'Uang pertanggungan',
    upSyariah: 'Santunan asuransi',
    premiumPer: {
      monthly: 'Premi per bulan',
      quarterly: 'Premi per kuartal',
      semiannual: 'Premi per semester',
      annual: 'Premi per tahun',
      single: 'Premi sekali bayar',
    },
    contributionPer: {
      monthly: 'Kontribusi per bulan',
      quarterly: 'Kontribusi per kuartal',
      semiannual: 'Kontribusi per semester',
      annual: 'Kontribusi per tahun',
      single: 'Kontribusi sekali bayar',
    },
    premiumHint: 'Lihat di ilustrasi resmi',
    calc: {
      tableFrom: ({ date }) => `Tabel tarif berlaku ${date}`,
      singlePayment: 'sekali bayar',
      fixed: 'diketik Anda',
      calculated: 'dihitung',
      benefit: ({ amount }) => `Manfaat dari tabel: ${amount}`,
      adjusted: ({ step }) => `Premi disesuaikan karena UP dibulatkan ke ${step}`,
      updated: ({ date }) => `Premi diperbarui ke tarif ${date}`,
      tableOff: 'Tabel tarif tidak berlaku lagi. Ketik premi dari ilustrasi resmi.',
      missing: 'Kombinasi ini tidak ada di tabel tarif',
      noFrequency: 'Cara bayar ini tidak ada di tabel tarif',
      ageOutside: ({ age, min, max }) => `Usia ${age} di luar usia masuk tabel (${min}–${max})`,
      needsAge: 'Isi umur tertanggung untuk menghitung premi',
      needsGender: 'Pilih jenis kelamin tertanggung untuk menghitung premi',
      limits: {
        up_min: ({ limit }) => `Min. UP ${limit}`,
        up_max: ({ limit }) => `Maks. UP ${limit}`,
        premium_min: ({ limit }) => `Min. premi ${limit} per tahun`,
        premium_max: ({ limit }) => `Maks. premi ${limit} per tahun`,
      },
      use: ({ amount }) => `pakai ${amount}`,
      useUp: ({ amount }) => `pakai UP ${amount}`,
      useGoal: ({ amount }) => `pakai ${amount}`,
    },
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
    heading: 'Proposal',
    pages: 'Halaman proposal',
    page: ({ n, count }) => `Halaman ${n} dari ${count}`,
    loading: 'Menyiapkan PDF',
    edit: 'Ubah',
    save: 'Simpan PDF',
    saving: 'Menyimpan…',
    saved: 'PDF tersimpan',
    showTotal: 'Tampilkan total',
    viewOnly: 'Pratinjau PDF tidak tersedia dalam sesi hanya melihat.',
    unreadable: 'PDF tidak bisa ditampilkan di perangkat ini.',
    retry: 'Coba lagi',
  },
  home: {
    make: 'Buat proposal',
  },
};

export const proposalMessages = defineMessages({ en, id });
