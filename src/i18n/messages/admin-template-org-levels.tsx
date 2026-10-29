import { createElement, Fragment, type ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/** Words with an element among them — the ladder in bold — as one message, its parts in the language's own order. */
const words = (...parts: ReactNode[]) => createElement(Fragment, null, ...parts);

/**
 * **The company role ladder** (`/admin/org-levels`, P3.5-T7, ADR-0012, ADR-0156, ADR-0168 §3; P18.98-T6, area
 * "admin-template"; `functional/org-levels.md`, *The module's own strings*): a company's rungs, junior first — each
 * rung's leader tier, saved as it is chosen, and its state — the reading order, and *Add a rung*.
 *
 * **English is the source**, every word as it was; the Indonesian is the approved glossary's — *Arsipkan · Pulihkan*
 * (§B.1), *Menambahkan…* (§B.2), *Aktif · Diarsipkan* (§B.3), *Kode · Status · Aksi · Label* (§B.4) — with the API's
 * words for the same things (P18.98-T5's rows of §B.10): a rung a ***jenjang***, the ladder a ***susunan jenjang***, a
 * leader tier a ***tingkat leader***. **Kept English** (§A): the title (§A.1's *Org role ladder*), the two tiers, the
 * client's names (*Senior Leader*, *Associate Leader*, ADR-0156 — for approval), *Template library*, *leader* (§A.6).
 * **Content stays as typed** (ADR-0179 §5): a company's name, a rung's label and code; the example codes *AGENT, AAB,
 * AB* are identifiers, the same in both languages.
 *
 * @moved app/(admin)/admin/org-levels/
 */
const en = {
  title: kept('Org role ladder'),
  subtitle: 'The rungs a company promotes people along. An office cannot invent one — this is the company\'s to '
    + 'define, and only the platform writes it.',
  company: 'Company',
  templateLibrary: kept('Template library'),

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
  active: 'Active',
  archived: 'Archived',
  archive: 'Archive',
  restore: 'Restore',

  /** Under the table: the active rungs in order, bold — `ladder` the joined labels, or `null` for none. */
  readingOrder: ({ ladder, strong }: { ladder: string | null; strong: (words: string) => ReactNode }) => words(
    'Reading order is junior first: ',
    strong(ladder ?? 'nothing active'),
    '. Archiving retires a rung without deleting it, so everybody who ever stood on it still renders.',
  ),

  /** *Add a rung*. */
  addTitle: 'Add a rung',
  code: 'Code',
  codeHint: 'Stable and semantic — AGENT, AAB, AB. Upper-cased on the way in, and never changed or reused afterwards.',
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
  templateLibrary: kept('Template library'),

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
  active: 'Aktif',
  archived: 'Diarsipkan',
  archive: 'Arsipkan',
  restore: 'Pulihkan',

  readingOrder: ({ ladder, strong }) => words(
    'Urutan baca dari yang paling junior: ',
    strong(ladder ?? 'belum ada yang aktif'),
    '. Mengarsipkan jenjang tidak menghapusnya, jadi semua orang yang pernah berada di jenjang itu tetap ditampilkan.',
  ),

  addTitle: 'Tambah jenjang',
  code: 'Kode',
  codeHint: 'Stabil dan bermakna — AGENT, AAB, AB. Diubah menjadi huruf besar saat dimasukkan, dan tidak pernah diubah '
    + 'atau dipakai ulang sesudahnya.',
  codeShape: 'Huruf, angka, dan garis bawah, diawali huruf.',
  label: 'Label',
  labelHint: 'Yang dilihat pembaca. Yang ini boleh Anda ubah.',
  tier: `Tingkat ${kept('leader')}`,
  position: ({ n }) => `Jenjang ini ditambahkan di akhir susunan, di posisi ${n}.`,
  adding: 'Menambahkan…',
  add: 'Tambah jenjang',
};

export const adminTemplateOrgLevelsMessages = defineMessages({ en, id });
