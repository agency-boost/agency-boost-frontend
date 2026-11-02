import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The Super Admin's companies** (`/admin/companies`, P3.5-T14, ADR-0018, ADR-0164, ADR-0185; P18.98-T6, area
 * "admin-template"; `functional/tenant-provisioning.md`, *The module's own strings*): the platform's built-in templates
 * above the list, as one card (ADR-0185 §1) — the list itself the insurers, each opening its company page — each
 * company's slug, currency, time zone and state, *Edit*, *Suspend* and *Reactivate*; and *Add a company*, with what a
 * new company starts from.
 *
 * **English is the source**; the Indonesian is the approved glossary's — *Simpan · Batal · Ubah* (§B.1), *Menambahkan…*
 * (§B.2), *Aktif* (§B.3), *Nama · Status · Aksi* (§B.4), *KPM ini ditangguhkan* (§B.6) — with the API's words for the
 * same things (the role ladder a ***susunan jenjang***, the insurer a ***perusahaan asuransi***), and ADR-0185's: the
 * platform's library ***Template bawaan AgencyBoost***, a company's templates ***Template KPM***. **Kept English** (§A):
 * the title (§A.2), *KPM* (§A.5; *office* is *KPM*, §B.9), *AgencyBoost*, *Playbook*. *Slug* is the API's word too
 * (`SAME_IN_INDONESIAN`). **Content stays as typed** (ADR-0179 §5): a company's name and slug; the currency, the time
 * zone and the locale are codes (*IDR · Asia/Jakarta · id-ID*), the same in both languages.
 *
 * @moved app/(admin)/admin/companies/page.tsx
 */
const en = {
  title: kept('Manage Companies'),
  subtitle: 'Each company has its own role ladder, products and KPM templates.',
  /** The platform's built-in templates (ADR-0185 §1): one card above the insurers, opening the library's page. */
  library: {
    name: 'AgencyBoost built-in templates',
    lead: 'Copied when a company or an office is created.',
  },
  /** The table's caption, and its columns; the last said to a screen reader only. */
  caption: 'Companies',
  columns: {
    name: 'Name',
    slug: 'Slug',
    currency: 'Currency',
    timeZone: 'Time zone',
    status: 'Status',
    actions: 'Actions',
  },
  empty: 'No companies yet. Add one to start provisioning offices.',

  /** A row. */
  active: 'Active',
  suspended: 'Suspended',
  startedBlank: 'Started blank',
  edit: 'Edit',
  suspend: 'Suspend',
  suspendTip: 'No new person and no new office attaches to it. Its existing offices carry on.',
  reactivate: 'Reactivate',

  /** A rename, in the row, and *Add a company*. */
  name: 'Name',
  slug: 'Slug',
  slugEditHint: 'Nothing stores it — every office points at the company by id.',
  slugAddHint: 'Filled in from the name. Unique.',
  slugShape: 'Lower-case letters and digits, separated by single hyphens.',
  save: 'Save',
  cancel: 'Cancel',
  addTitle: 'Add a company',
  startFrom: 'Start from',
  /** *Start from* (ADR-0164 §4, ADR-0185 §1): the built-in templates, or nothing; and what each gives. */
  fromLibrary: 'AgencyBoost built-in templates',
  fromLibraryHint: 'A copy of them, with the products, carrier rules and playbook, ready to edit.',
  startEmpty: 'Empty',
  emptyHint: 'Everything starts empty but the role ladder.',
  inherit: 'Offices inherit',
  inheritReason: 'The same for every company in v1.',
  adding: 'Adding…',
  add: 'Add company',
};

const id: MessagesOf<typeof en> = {
  title: kept('Manage Companies'),
  subtitle: `Setiap perusahaan memiliki susunan jenjang, produk, dan Template ${kept('KPM')} sendiri.`,
  library: {
    name: `Template bawaan ${kept('AgencyBoost')}`,
    lead: `Disalin saat perusahaan atau ${kept('KPM')} baru dibuat.`,
  },
  caption: 'Perusahaan',
  columns: {
    name: 'Nama',
    // The API's word for it (`SAME_IN_INDONESIAN`).
    slug: 'Slug',
    currency: 'Mata uang',
    timeZone: 'Zona waktu',
    status: 'Status',
    actions: 'Aksi',
  },
  empty: `Belum ada perusahaan. Tambahkan satu untuk mulai menyiapkan ${kept('KPM')}.`,

  active: 'Aktif',
  suspended: 'Ditangguhkan',
  startedBlank: 'Dimulai kosong',
  edit: 'Ubah',
  suspend: 'Tangguhkan',
  suspendTip: `Tidak ada orang baru dan ${kept('KPM')} baru yang bergabung ke perusahaan ini. ${kept('KPM')} yang sudah `
    + 'ada tetap berjalan.',
  reactivate: 'Aktifkan kembali',

  name: 'Nama',
  slug: 'Slug',
  slugEditHint: `Tidak ada yang menyimpannya — setiap ${kept('KPM')} merujuk ke perusahaan lewat id-nya.`,
  slugAddHint: 'Diisi dari nama. Unik.',
  slugShape: 'Huruf kecil dan angka, dipisahkan oleh satu tanda hubung.',
  save: 'Simpan',
  cancel: 'Batal',
  addTitle: 'Tambah perusahaan',
  startFrom: 'Mulai dari',
  fromLibrary: `Template bawaan ${kept('AgencyBoost')}`,
  fromLibraryHint: `Salinannya, dengan produk, aturan perusahaan asuransi, dan ${kept('playbook')}, siap diubah.`,
  startEmpty: 'Kosong',
  emptyHint: 'Semuanya dimulai kosong, kecuali susunan jenjang.',
  inherit: `Yang diwarisi ${kept('KPM')}`,
  inheritReason: 'Sama untuk setiap perusahaan di v1.',
  adding: 'Menambahkan…',
  add: 'Tambah perusahaan',
};

export const adminTemplateCompaniesMessages = defineMessages({ en, id });
