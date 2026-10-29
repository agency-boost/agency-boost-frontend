import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The Super Admin's companies** (`/admin/companies`, P3.5-T14, ADR-0018, ADR-0164; P18.98-T6, area "admin-template";
 * `functional/tenant-provisioning.md`, *The module's own strings*): the list — each company's slug, currency, time zone
 * and state, the way to its Company template, *Edit*, *Suspend* and *Reactivate* — and *Add a company*, with what a
 * new company starts from.
 *
 * **English is the source**, every word as it was; the Indonesian is the approved glossary's — *Simpan · Batal · Ubah*
 * (§B.1), *Menambahkan…* (§B.2), *Aktif* (§B.3), *Nama · Status · Aksi* (§B.4), *KPM ini ditangguhkan* (§B.6) — with
 * the API's words for the same things (P18.98-T5's rows of §B.10: the role ladder a ***susunan jenjang***, the
 * insurer a ***perusahaan asuransi***, the AgencyBoost defaults ***Pengaturan default AgencyBoost***), and what it
 * lacked proposed in the glossary for approval's §B.10. **Kept English** (§A): the title (§A.2), *Company template*
 * (§A.2), *KPM* (§A.5; *office* is *KPM*, §B.9), *Template library* and *AgencyBoost*, the jargon. *Slug* is the API's
 * word too (`SAME_IN_INDONESIAN`). **Content stays as typed** (ADR-0179 §5): a company's name and slug; the currency,
 * the time zone and the locale are codes (*IDR · Asia/Jakarta · id-ID*), the same in both languages.
 *
 * @moved app/(admin)/admin/companies/page.tsx
 */
const en = {
  title: kept('Manage Companies'),
  subtitle: 'Each company has its own role ladder, product catalog, and Company template. A KPM belongs to exactly '
    + 'one, and inherits its currency, locale and time zone.',
  /** The table's caption, and its columns; the last two said to a screen reader only. */
  caption: 'Companies',
  columns: {
    name: 'Name',
    slug: 'Slug',
    currency: 'Currency',
    timeZone: 'Time zone',
    status: 'Status',
    template: kept('Company template'),
    actions: 'Actions',
  },
  empty: 'No companies yet. Add one to start provisioning offices.',

  /** A row. */
  active: 'Active',
  suspended: 'Suspended',
  startedBlank: 'Started blank',
  templateLibrary: kept('Template library'),
  edit: 'Edit',
  suspend: 'Suspend',
  suspendTip: 'No new person and no new office attaches to it. Its existing offices carry on.',
  reactivate: 'Reactivate',

  /** A rename, in the row, and *Add a company*. */
  name: 'Name',
  slug: 'Slug',
  slugEditHint: 'Nothing stores it — every office points at the company by id.',
  slugAddHint: 'Filled in from the name, and yours to change. Unique, and not renamed later.',
  slugShape: 'Lower-case letters and digits, separated by single hyphens.',
  save: 'Save',
  cancel: 'Cancel',
  addTitle: 'Add a company',
  startFrom: 'Start from',
  /** *Start from*'s hint, by what is chosen and whether a Template library exists (ADR-0164 §4). */
  fromLibraryHint: 'A copy of the Template library: its role ladder, products, carrier rules, recruitment playbook and '
    + 'Default template — activity taxonomy, ratios, lead ladders, training tree, activation checklist, capability '
    + 'ladder and event types — ready to edit. Changing the Template later changes nothing here.',
  fromDefaultsHint: 'The activity taxonomy, ratios, lead ladders, training tree, activation checklist, capability '
    + 'ladder, event types, carrier rules and product catalog arrive ready to edit.',
  emptyHint: 'Every one of them starts empty. The role ladder is seeded either way — an office whose company has none '
    + 'is one nobody can join.',
  /** The options: the Template library's default by the library's name, or the platform's defaults; or nothing. */
  libraryDefault: ({ library }: { library: string }) => `${library} · Default template`,
  defaults: 'AgencyBoost defaults',
  startEmpty: 'Empty',
  inherit: 'Offices inherit',
  inheritReason: 'Currency, time zone and locale are the same for every company in v1, so a new office takes them '
    + 'without being asked.',
  adding: 'Adding…',
  add: 'Add company',
};

const id: MessagesOf<typeof en> = {
  title: kept('Manage Companies'),
  subtitle: `Setiap perusahaan memiliki susunan jenjang, katalog produk, dan ${kept('Company template')} sendiri. `
    + `Setiap ${kept('KPM')} masuk ke tepat satu perusahaan, dan mewarisi mata uang, bahasa, dan zona waktunya.`,
  caption: 'Perusahaan',
  columns: {
    name: 'Nama',
    // The API's word for it (`SAME_IN_INDONESIAN`).
    slug: 'Slug',
    currency: 'Mata uang',
    timeZone: 'Zona waktu',
    status: 'Status',
    template: kept('Company template'),
    actions: 'Aksi',
  },
  empty: `Belum ada perusahaan. Tambahkan satu untuk mulai menyiapkan ${kept('KPM')}.`,

  active: 'Aktif',
  suspended: 'Ditangguhkan',
  startedBlank: 'Dimulai kosong',
  templateLibrary: kept('Template library'),
  edit: 'Ubah',
  suspend: 'Tangguhkan',
  suspendTip: `Tidak ada orang baru dan ${kept('KPM')} baru yang bergabung ke perusahaan ini. ${kept('KPM')} yang sudah `
    + 'ada tetap berjalan.',
  reactivate: 'Aktifkan kembali',

  name: 'Nama',
  slug: 'Slug',
  slugEditHint: `Tidak ada yang menyimpannya — setiap ${kept('KPM')} merujuk ke perusahaan lewat id-nya.`,
  slugAddHint: 'Diisi dari nama, dan boleh Anda ubah. Unik, dan tidak diganti nama nanti.',
  slugShape: 'Huruf kecil dan angka, dipisahkan oleh satu tanda hubung.',
  save: 'Simpan',
  cancel: 'Batal',
  addTitle: 'Tambah perusahaan',
  startFrom: 'Mulai dari',
  fromLibraryHint: `Salinan ${kept('Template library')}: susunan jenjang, produk, aturan perusahaan asuransi, `
    + `${kept('playbook')} ${kept('recruitment')}, dan templat default-nya — taksonomi aktivitas, ${kept('ratios')}, `
    + `urutan tahap ${kept('lead')}, struktur pelatihan, ${kept('Activation checklist')}, ${kept('Ladder')} kapabilitas, `
    + `dan jenis ${kept('event')} — siap diubah. Mengubah Template nanti tidak mengubah apa pun di sini.`,
  fromDefaultsHint: `Taksonomi aktivitas, ${kept('ratios')}, urutan tahap ${kept('lead')}, struktur pelatihan, `
    + `${kept('Activation checklist')}, ${kept('Ladder')} kapabilitas, jenis ${kept('event')}, aturan perusahaan asuransi, dan `
    + 'katalog produk datang siap diubah.',
  emptyHint: `Semuanya dimulai kosong. Susunan jenjang tetap diisi — ${kept('KPM')} yang perusahaannya tidak punya `
    + 'susunan jenjang tidak dapat diikuti siapa pun.',
  libraryDefault: ({ library }) => `${library} · Templat default`,
  defaults: `Pengaturan default ${kept('AgencyBoost')}`,
  startEmpty: 'Kosong',
  inherit: `Yang diwarisi ${kept('KPM')}`,
  inheritReason: `Mata uang, zona waktu, dan bahasa sama untuk setiap perusahaan di v1, jadi ${kept('KPM')} baru `
    + 'memakainya tanpa ditanya.',
  adding: 'Menambahkan…',
  add: 'Tambah perusahaan',
};

export const adminTemplateCompaniesMessages = defineMessages({ en, id });
