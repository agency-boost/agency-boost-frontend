import { createElement, Fragment, type ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/** Words with an element among them — a version in bold — as one message, its parts in the language's own order. */
const words = (...parts: ReactNode[]) => createElement(Fragment, null, ...parts);

/**
 * **Settings › Activation checklist** (`/kpm/settings/activation-checklist`, P5-T3; P18.98-T4): the office's 90-day
 * checklist, drafted and published as versions. The frame and the controls every settings screen shares are
 * `settings.ts`'. The two grey sentences keep their verdict per size in both languages (P18.97-T4 AC-6): shown from
 * 1024px, behind an ⓘ at 768–1023px, and below 768px the first behind its ⓘ and the second removed.
 *
 * **Content, shown as typed** (ADR-0179 §5): an aspect's name, an item's label, a training module's title. **Kept
 * English** (§A): the title (§A.1), the three features an item may complete from — *Goal Settings*, *Leads
 * Management*, *Activity Management* (§A.2) — *new hire* (§A.5), *Training* (§A.1). **Not here**: the link badge's *Auto*
 * and *Ticked by hand* and the data-backed item's *From …*, which are `lib/activation.ts`' (the field's activation, which
 * moves with its screens). *Aspect* is *aspek*, *checklist* *checklist* and *window* *jangka waktu* (for approval, the
 * glossary for approval's §B.10).
 *
 * @moved app/(tenant)/kpm/settings/activation-checklist/
 */
const en = {
  subtitle: 'What every new hire works through in their first 90 days.',
  /** Grey text: the AUTO badge's explanation. *Remove · ⓘ · Show.* */
  linkedItems: 'Linked items complete automatically.',
  /** Grey text: who a published version reaches. *ⓘ · ⓘ · Show.* */
  newVersions: 'New versions apply to new hires only.',
  addAspect: '+ Add aspect',
  addItem: '+ Add item',

  /** A version as the card names it, in bold where a sentence points at it. */
  version: ({ n }: { n: number }) => `version ${n}`,
  /** The card's sentence, by what is published and what is drafted; `version` and `standard` are bold. */
  published: ({ version, draft }: { version: ReactNode; draft: number | null }) => words(
    'Hires starting now are given ',
    version,
    '.',
    draft === null ? null : ` You have an unpublished draft, which will become version ${draft}.`,
  ),
  draftOnly: ({ version }: { version: ReactNode }) => words(
    'Nothing is published yet, so no hire has been given a checklist. Your draft will become ',
    version,
    '.',
  ),
  fromNothing: ({ version }: { version: ReactNode }) => words(
    'Nothing is published yet, so no hire has been given a checklist. Add its first aspect, save it, then publish ',
    version,
    '.',
  ),
  fromStandard: ({ standard }: { standard: ReactNode }) => words(
    'Nothing is published yet, so no hire has been given a checklist. What you are looking at is the ',
    standard,
    ', ready to edit — save it, then publish version 1.',
  ),
  standardChecklist: 'standard checklist',
  /** The window the checklist runs over, the office's setting; `days` is bold. */
  window: ({ days }: { days: ReactNode }) => words('The window is ', days, '.'),
  days: ({ n }: { n: string }) => `${n} days`,

  saveDraft: 'Save draft',
  saveDraftFirst: 'Save the draft first.',
  publishVersion: ({ n }: { n: number }) => `Publish version ${n}`,
  undoEdits: 'Undo my edits',

  /** Adding an aspect, which needs its first item. */
  addAnAspect: 'Add an aspect',
  aspectLead: 'An aspect is a heading with items under it. It needs its first item now, because an aspect with nothing '
    + 'in it is a heading a hire opens and finds empty.',
  aspect: 'Aspect',
  aspectCodeHint: 'Filled in from the name. Permanent once saved.',
  firstItem: 'Its first item',
  addTheAspect: 'Add the aspect',
  none: 'This office has no activation checklist yet.',

  /** Why a code cannot change, in its edit. */
  aspectReason: "Every hire's progress on this aspect points at it.",
  itemReason: "Every hire's progress on this item points at it.",
  /** Why *Remove* is held, or what it takes. */
  oneAspect: 'A checklist needs at least one aspect.',
  removesAspect: ({ name, n }: { name: string; n: number }) =>
    `Removes ${name} and its ${n} ${n === 1 ? 'item' : 'items'} from the next version.`,
  oneItem: 'An aspect needs at least one item — remove the aspect instead.',

  /** What an item completes from: nothing, a feature, or one of the office's published modules. */
  completesFrom: 'Completes from',
  noLink: 'No link (manual)',
  feature: 'Feature',
  trainingModule: 'Training module',
  itemCodeHint: 'Filled in from the item. Permanent once saved.',
};

const id: MessagesOf<typeof en> = {
  subtitle: `Yang dijalani setiap ${kept('new hire')} dalam 90 hari pertamanya.`,
  linkedItems: 'Item yang tertaut selesai secara otomatis.',
  newVersions: `Versi baru hanya berlaku untuk ${kept('new hire')}.`,
  addAspect: '+ Tambah aspek',
  addItem: '+ Tambah item',

  version: ({ n }) => `versi ${n}`,
  published: ({ version, draft }) => words(
    `${kept('New hire')} yang mulai sekarang mendapat `,
    version,
    '.',
    draft === null ? null : ` Anda punya draf yang belum diterbitkan, yang akan menjadi versi ${draft}.`,
  ),
  draftOnly: ({ version }) => words(
    `Belum ada yang diterbitkan, jadi belum ada ${kept('new hire')} yang mendapat checklist. Draf Anda akan menjadi `,
    version,
    '.',
  ),
  fromNothing: ({ version }) => words(
    `Belum ada yang diterbitkan, jadi belum ada ${kept('new hire')} yang mendapat checklist. Tambahkan aspek `
      + 'pertamanya, simpan, lalu terbitkan ',
    version,
    '.',
  ),
  fromStandard: ({ standard }) => words(
    `Belum ada yang diterbitkan, jadi belum ada ${kept('new hire')} yang mendapat checklist. Yang Anda lihat adalah `,
    standard,
    ', siap diubah — simpan, lalu terbitkan versi 1.',
  ),
  standardChecklist: 'checklist standar',
  window: ({ days }) => words('Jangka waktunya ', days, '.'),
  days: ({ n }) => `${n} hari`,

  saveDraft: 'Simpan draf',
  saveDraftFirst: 'Simpan draf terlebih dahulu.',
  publishVersion: ({ n }) => `Terbitkan versi ${n}`,
  undoEdits: 'Urungkan perubahan saya',

  addAnAspect: 'Tambah aspek',
  aspectLead: 'Aspek adalah judul dengan item di bawahnya. Aspek perlu item pertamanya sekarang, karena aspek tanpa isi '
    + `adalah judul yang dibuka ${kept('new hire')} dan ternyata kosong.`,
  aspect: 'Aspek',
  aspectCodeHint: 'Diisi dari nama. Permanen setelah disimpan.',
  firstItem: 'Item pertamanya',
  addTheAspect: 'Tambah aspek ini',
  none: `${kept('KPM')} ini belum punya ${kept('Activation checklist')}.`,

  aspectReason: `Progres setiap ${kept('new hire')} pada aspek ini merujuk ke kode ini.`,
  itemReason: `Progres setiap ${kept('new hire')} pada item ini merujuk ke kode ini.`,
  oneAspect: 'Checklist memerlukan setidaknya satu aspek.',
  removesAspect: ({ name, n }) => `Menghapus ${name} beserta ${n} itemnya dari versi berikutnya.`,
  oneItem: 'Aspek memerlukan setidaknya satu item — hapus aspeknya saja.',

  completesFrom: 'Diselesaikan dari',
  noLink: 'Tanpa tautan (manual)',
  feature: 'Fitur',
  trainingModule: `Modul ${kept('Training')}`,
  itemCodeHint: 'Diisi dari item. Permanen setelah disimpan.',
};

export const checklistMessages = defineMessages({ en, id });
