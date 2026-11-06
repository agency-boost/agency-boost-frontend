import { createElement, Fragment, type ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/** Words with an element among them — the ladder in bold — as one message, its parts in the language's own order. */
const words = (...parts: ReactNode[]) => createElement(Fragment, null, ...parts);

/**
 * **The company role ladder** (`/admin/org-levels`, P3.1-T7, ADR-0012, ADR-0156, ADR-0168 §3; P18.10-T6, area
 * "admin-template"; `functional/org-levels.md`, *The module's own strings*): a company's rungs, junior first — each
 * rung's label and leader tier, saved as they are changed, and its state, *Archive*, *Restore* and, for an archived one,
 * *Delete* (ADR-0213 §1, §2) — the reading order, and *Add a rung*.
 *
 * **English is the source**, every word as it was; the Indonesian is the approved glossary's — *Arsipkan · Pulihkan*
 * (§B.1), *Menambahkan…* (§B.2), *Aktif · Diarsipkan* (§B.3), *Kode · Status · Aksi · Label* (§B.4) — with the API's
 * words for the same things (P18.10-T5's rows of §B.10): a rung a ***jenjang***, the ladder a ***susunan jenjang***, a
 * leader tier a ***tingkat leader***. **Kept English** (§A): the title (§A.1's *Org role ladder*), the two tiers, the
 * client's names (*Senior Leader*, *Associate Leader*, ADR-0156 — for approval), *AgencyBoost*, *leader* (§A.6); the
 * platform's library is *Template bawaan AgencyBoost* (ADR-0185 §1).
 * **Content stays as typed** (ADR-0179 §5): a company's name, a rung's label and code; the example codes *AGENT, AAB,
 * AB* are identifiers, the same in both languages.
 *
 * *Changed 2026-11-06 (P19.2-T2 AC-1, AC-3, AC-4; UI-126, UI-133, UI-134; `admin-mobile` screen 4):* below 1024px a
 * rung is a row — its tier a pill opening its choices, *Ganti nama · Arsipkan / Pulihkan · Hapus* in its ⋯ — and *Tambah
 * jenjang* a sheet from the title row at every size: `rename`, `rowArchived`, `save`, `required` (the companies sheet's
 * *Wajib diisi.*), proposed in §B.10 where the mockup gives no word.
 *
 * @moved app/(admin)/admin/org-levels/
 */
const en = {
  title: kept('Org role ladder'),
  subtitle: 'The rungs a company promotes people along. An office cannot invent one — this is the company\'s to '
    + 'define, and only the platform writes it.',
  company: 'Company',
  /** The platform's library, by the name ADR-0185 §1 gives it wherever it is shown. */
  templateLibrary: 'AgencyBoost built-in templates',

  /** The table's columns, its caption and the skeleton's; the last column said to a screen reader only. */
  columns: {
    order: 'Order',
    rung: 'Rung',
    tier: 'Leader tier',
    status: 'Status',
    actions: 'Actions',
  },
  ladder: 'Role ladder',
  ladderCaption: 'Role ladder, junior first',
  /** A company with none, by its name as stored; and no company at all. */
  noLadder: ({ company }: { company: string }) => `${company} has no ladder yet. Add the most junior rung first.`,
  noCompany: 'Create a company before defining a ladder.',

  /** A rung's tier (ADR-0156): the client's two names, and *Not a leader*, the empty value. */
  tiers: {
    senior: kept('Senior Leader'),
    associate: kept('Associate Leader'),
    none: 'Not a leader',
  },
  /** The tier's select in its cell, named for its rung, and the line its save status sits on. */
  tierOf: ({ rung }: { rung: string }) => `Leader tier of ${rung}`,
  tierStatus: ({ rung }: { rung: string }) => `Leader tier, ${rung}`,
  /** A refused tier change, the count from the refusal's details and the rung by its label. */
  tierInUse: ({ n, rung }: { n: number; rung: string }) =>
    `${n === 1 ? '1 person stands' : `${n} people stand`} on ${rung}, so its leader tier cannot change. Move them to `
    + 'another rung first, or add a new rung.',
  /** A change refused because somebody else changed the rung first (P19-T6 AC-2); the ladder is read again with it. */
  savedElsewhere: ({ rung }: { rung: string }) => `Someone else changed ${rung} after you opened this page, so your `
    + 'change was not saved. The ladder now shows what is stored; check it and try again.',
  active: 'Active',
  archived: 'Archived',
  archive: 'Archive',
  restore: 'Restore',
  /** A rung's label, edited in its cell and saved as it is left (ADR-0213 §1, B1-6); the line its save status sits on. */
  labelOf: ({ rung }: { rung: string }) => `Label of ${rung}`,
  labelStatus: ({ rung }: { rung: string }) => `Label, ${rung}`,
  /** Below 1024px (P19.2-T2 AC-1): the label from the row's ⋯, in a sheet titled by the rung's code. */
  rename: 'Rename',
  save: 'Save',
  /** A row's meta below 1024px: the code, and *Archived* where it is. */
  rowArchived: ({ code }: { code: string }) => `${code} · Archived`,
  /** A field left empty, said on it when *Add rung* is pressed (UI-133: *the main button is enabled*). */
  required: 'Required.',
  /** *Hapus*, on an archived rung (ADR-0213 §2): asked first; the server refuses one anything names, saying what. */
  delete: 'Delete',
  deleteQuestion: ({ rung, code }: { rung: string; code: string }) => `Delete ${rung}? Only an archived rung that `
    + `nothing in this company names can be deleted — the server checks, and says what names it if anything does. `
    + `${code} can then be used again.`,

  /** Under the table: the active rungs in order, bold — `ladder` the joined labels, or `null` for none. */
  readingOrder: ({ ladder, strong }: { ladder: string | null; strong: (words: string) => ReactNode }) => words(
    'Reading order is junior first: ',
    strong(ladder ?? 'nothing active'),
    '. Archiving retires a rung without deleting it, so everybody who ever stood on it still renders.',
  ),

  /** *Add a rung*. */
  addTitle: 'Add a rung',
  code: 'Code',
  codeHint: 'Stable and semantic — AGENT, AAB, AB. Upper-cased on the way in, and never changed afterwards; reused only '
    + 'once its rung is deleted.',
  codeShape: 'Letters, digits and underscores, starting with a letter.',
  label: 'Label',
  labelHint: 'What a reader sees. This one you can change.',
  tier: 'Leader tier',
  position: ({ n }: { n: number }) => `It goes on the end of the ladder, at position ${n}.`,
  adding: 'Adding…',
  add: 'Add rung',
};

const id: MessagesOf<typeof en> = {
  title: kept('Org role ladder'),
  subtitle: `Jenjang tempat perusahaan mempromosikan orang. ${kept('KPM')} tidak dapat membuat jenjang sendiri — `
    + 'perusahaanlah yang menetapkannya, dan hanya platform yang menuliskannya.',
  company: 'Perusahaan',
  templateLibrary: `Template bawaan ${kept('AgencyBoost')}`,

  columns: {
    order: 'Urutan',
    rung: 'Jenjang',
    tier: `Tingkat ${kept('leader')}`,
    status: 'Status',
    actions: 'Aksi',
  },
  ladder: 'Susunan jenjang',
  ladderCaption: 'Susunan jenjang, dari yang paling junior',
  noLadder: ({ company }) => `${company} belum punya susunan jenjang. Tambahkan jenjang paling junior terlebih dahulu.`,
  noCompany: 'Buat perusahaan sebelum menyusun jenjang.',

  tiers: {
    senior: kept('Senior Leader'),
    associate: kept('Associate Leader'),
    none: `Bukan ${kept('leader')}`,
  },
  tierOf: ({ rung }) => `Tingkat ${kept('leader')} ${rung}`,
  tierStatus: ({ rung }) => `Tingkat ${kept('leader')}, ${rung}`,
  // One form for one and many (§B.0 rule 8), as the API's refusal says it.
  tierInUse: ({ n, rung }) => `${n} orang berada di ${rung}, jadi tingkat ${kept('leader')}-nya tidak dapat diubah. `
    + 'Pindahkan mereka ke jenjang lain terlebih dahulu, atau tambahkan jenjang baru.',
  savedElsewhere: ({ rung }) => `Orang lain mengubah ${rung} setelah Anda membuka halaman ini, jadi perubahan Anda tidak `
    + 'tersimpan. Susunan jenjang kini menampilkan yang tersimpan; periksa, lalu coba lagi.',
  active: 'Aktif',
  archived: 'Diarsipkan',
  archive: 'Arsipkan',
  restore: 'Pulihkan',
  labelOf: ({ rung }) => `Label ${rung}`,
  labelStatus: ({ rung }) => `Label, ${rung}`,
  // UI-142's own word for it on the Owner's pages (*Ganti nama*).
  rename: 'Ganti nama',
  save: 'Simpan',
  rowArchived: ({ code }) => `${code} · Diarsipkan`,
  required: 'Wajib diisi.',
  delete: 'Hapus',
  deleteQuestion: ({ rung, code }) => `Hapus ${rung}? Hanya jenjang yang sudah diarsipkan dan tidak dipakai apa pun di `
    + `perusahaan ini yang dapat dihapus — server memeriksanya, dan menyebut apa yang memakainya bila ada. Kode ${code} `
    + 'lalu dapat dipakai lagi.',

  readingOrder: ({ ladder, strong }) => words(
    'Urutan baca dari yang paling junior: ',
    strong(ladder ?? 'belum ada yang aktif'),
    '. Mengarsipkan jenjang tidak menghapusnya, jadi semua orang yang pernah berada di jenjang itu tetap ditampilkan.',
  ),

  addTitle: 'Tambah jenjang',
  code: 'Kode',
  codeHint: 'Stabil dan bermakna — AGENT, AAB, AB. Diubah menjadi huruf besar saat dimasukkan, dan tidak pernah diubah '
    + 'sesudahnya; dipakai ulang hanya setelah jenjangnya dihapus.',
  codeShape: 'Huruf, angka, dan garis bawah, diawali huruf.',
  label: 'Label',
  labelHint: 'Yang dilihat pembaca. Yang ini boleh Anda ubah.',
  tier: `Tingkat ${kept('leader')}`,
  position: ({ n }) => `Jenjang ini ditambahkan di akhir susunan, di posisi ${n}.`,
  adding: 'Menambahkan…',
  add: 'Tambah jenjang',
};

export const adminTemplateOrgLevelsMessages = defineMessages({ en, id });
