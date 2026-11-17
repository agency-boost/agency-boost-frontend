import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * ***Kelola data produk*, *Data produk* and *Perubahan oleh pengelola*** (P19.15-T4; ADR-0260; the glossary's *Proposal*
 * section): the Super Admin's dialog and tab on *KPM Owners & Admins* (`/admin/tenant-admins`), the office's page
 * `/kpm/data-produk`, and *Products*' link to it. **The P1b spec's own words** where it gives them — *Kelola data
 * produk*, *Data produk*, *Perubahan oleh pengelola* — Indonesian in ID mode and the glossary's English in EN mode
 * (*Manage product data*, *Product data*, *Changes by managers*). Names typed by people — a company's, a product's, a
 * person's — stay as typed; a date is its caller's, in the figures' language.
 */
const en = {
  /** `/kpm/data-produk`: the menu item's name (ADR-0252: a title is its menu's name). */
  page: {
    title: 'Product data',
    companies: 'Insurer',
    /** One company's tab may only be looked at: the Owner's or an Admin's own, without *Kelola data produk*. */
    readOnly: 'View only',
    empty: 'There is no insurer\'s product data to show.',
  },
  /** *Products*' one line to the read-only view (ADR-0260 §5). */
  productsLink: 'View proposal data',
  grants: {
    /** The key in a row of *KPM Owners & Admins*: names the control and whose it is. */
    open: ({ name }: { name: string }) => `Manage product data for ${name}`,
    title: 'Manage product data',
    switchLabel: 'Manage product data',
    hint: 'They get Product data in their menu, and the full Proposal tab for the insurers ticked: upload, rules, premium tables, illustrations and tests. Every change carries their name in the audit log.',
    insurers: 'Insurers',
    needOne: 'Tick at least one insurer.',
    save: 'Save',
    cancel: 'Cancel',
    saving: 'Saving…',
    given: ({ name }: { name: string }) => `${name} can now manage product data.`,
    removed: ({ name }: { name: string }) => `${name} can no longer manage product data.`,
    /** The pill in the row's Access column: the access and the insurers it reaches. */
    pill: ({ companies }: { companies: string }) => `Manage product data · ${companies}`,
    /** A grant kept for somebody who is no longer an Owner or an Admin: it holds nothing (ADR-0260 §2). */
    dormant: 'Not in force: no longer an Owner or Admin',
    loadingInsurers: 'Loading insurers…',
  },
  changes: {
    tab: 'Changes by managers',
    people: kept('KPM Owners & Admins'),
    caption: 'Changes by product data managers',
    columns: { when: 'When', change: 'Change', product: 'Product', by: 'By' },
    empty: 'No product data manager has changed anything yet.',
    /** The company's Proposal tab, where a version they turned on can be turned off. */
    openProposal: ({ company }: { company: string }) => `${company} Proposal tab`,
    inAudit: 'In the audit log',
    loadMore: 'Load more',
    loadingMore: 'Loading…',
  },
};

const id: MessagesOf<typeof en> = {
  page: {
    title: 'Data produk',
    companies: 'Perusahaan asuransi',
    readOnly: 'Hanya lihat',
    empty: 'Belum ada data produk perusahaan asuransi untuk ditampilkan.',
  },
  productsLink: 'Lihat data proposal',
  grants: {
    open: ({ name }) => `Kelola data produk untuk ${name}`,
    title: 'Kelola data produk',
    switchLabel: 'Kelola data produk',
    hint: 'Mendapat Data produk di menunya, dan tab Proposal lengkap untuk perusahaan yang dicentang: unggah file, isian, tabel premi, ilustrasi dan uji coba. Setiap perubahannya tercatat atas namanya di log audit.',
    insurers: 'Perusahaan asuransi',
    needOne: 'Centang minimal satu perusahaan asuransi.',
    save: 'Simpan',
    cancel: 'Batal',
    saving: 'Menyimpan…',
    given: ({ name }) => `${name} sekarang dapat mengelola data produk.`,
    removed: ({ name }) => `${name} tidak lagi dapat mengelola data produk.`,
    pill: ({ companies }) => `Kelola data produk · ${companies}`,
    dormant: `Tidak berlaku: bukan lagi ${kept('Owner')} atau ${kept('Admin')}`,
    loadingInsurers: 'Memuat perusahaan asuransi…',
  },
  changes: {
    tab: 'Perubahan oleh pengelola',
    people: kept('KPM Owners & Admins'),
    caption: 'Perubahan oleh pengelola data produk',
    columns: { when: 'Waktu', change: 'Perubahan', product: 'Produk', by: 'Oleh' },
    empty: 'Belum ada perubahan oleh pengelola data produk.',
    openProposal: ({ company }) => `Tab Proposal ${company}`,
    inAudit: 'Di log audit',
    loadMore: 'Muat lagi',
    loadingMore: 'Memuat…',
  },
};

export const productDataAccessMessages = defineMessages({ en, id });
