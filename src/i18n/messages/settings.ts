import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The office's settings screens: their frame, and the words every one of them shares** (P18.98-T4, the office's
 * settings A; the approved glossary's §B.1–§B.5). The block order every settings screen is drawn in
 * (`components/settings-screen.tsx`), its tab rows (`settings-tabs.tsx`), the two bars — what is held in this browser
 * (`staged-changes-bar.tsx`) and what agents are on (`publish-bar.tsx`) — and the mark a staged row wears
 * (`lib/staged-projection.ts`). Every Settings screen draws them: the training, events, campaigns and products screens
 * too, whose own words move with them.
 *
 * **The shared vocabulary** — *Save*, *Cancel*, *Edit*, *Archive*, *Show archived*, *Code*, *Name*, *Applies to* … — is
 * here once, so two settings screens cannot word one control two ways. A screen's own sentences are its own area's
 * (`settings-activity-types.ts`, `settings-lead-statuses.ts` …).
 *
 * **Not here: the kept-English words.** A screen's title is its nav item (§A.1), and the tabs are §A.3's — *Activity
 * types*, *Ratio benchmarks*, *Sales*, *Recruitment*, *Ladder*, *Skills* — each written `kept('…')` where it is drawn.
 * *Office* is *KPM* in ID mode (§B.9). A count is written as it was, its plural each language's (§B.0 rule 8).
 *
 * @moved components/settings-screen.tsx
 * @moved components/settings-tabs.tsx
 * @moved components/publish-bar.tsx
 * @moved components/staged-changes-bar.tsx
 * @moved lib/staged-projection.ts
 */
const en = {
  /** The second tab row's name, where a screen gives none: two landmarks of one name cannot be told apart. */
  sections: ({ title }: { title: string }) => `${title} sections`,
  /** The tab row's name where a screen gives none — the Activity types item's two halves. */
  activitySettings: 'Activity settings',

  /** The publish bar (P4-T6): what agents are on, and the one way to move them. */
  publish: {
    cannotCheck: 'Could not check what your agents are seeing.',
    tryAgain: 'Try again',
    notSeeing: 'Your agents are not seeing these changes yet.',
    nothingPublished: 'Nothing has been published for this office.',
    onVersion: ({ version }: { version: number }) => `They are on version ${version}.`,
    publishing: 'Publishing…',
    publishToAgents: 'Publish to agents',
  },

  /** The staged-changes bar (P4-T19): held in this browser, saved to the office, published to agents — in that order. */
  staged: {
    notSaved: ({ count }: { count: number }) =>
      (count === 1 ? '1 change not saved yet.' : `${count} changes not saved yet.`),
    nothingReached: 'Nothing has reached your office — and publishing to agents is a separate step after that.',
    saveChanges: 'Save changes',
    discard: 'Discard them',
    /** What a staged operation did to the row, said on it. */
    mark: {
      added: 'Added — not saved yet',
      edited: 'Edited — not saved yet',
      archived: 'Archived — not saved yet',
      restored: 'Restored — not saved yet',
    },
  },

  /** The controls every settings screen draws (§B.1). */
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved.',
  cancel: 'Cancel',
  edit: 'Edit',
  add: 'Add',
  rename: 'Rename',
  remove: 'Remove',
  archive: 'Archive',
  restore: 'Restore',
  undo: 'Undo',
  showArchived: 'Show archived',
  /** The line under an archived row, lower-case as drawn; and the badge (§B.3). */
  archivedLine: 'archived',
  archivedBadge: 'Archived',
  /** The fields a row is made of (§B.4). */
  code: 'Code',
  name: 'Name',
  label: 'Label',
  description: 'Description',
  item: 'Item',
  /** A field's hint where it may be left empty (§B.3). */
  optional: 'Optional.',
  /** How many items a card holds. */
  items: ({ n }: { n: number }) => (n === 1 ? '1 item' : `${n} items`),
  /** A row's ⋮, named for its row. */
  actionsFor: ({ name }: { name: string }) => `Actions for ${name}`,
  /** Who a section or a ratio is for: the rungs ticked, or everyone when none is. */
  appliesTo: 'Applies to',
  everyone: 'Everyone',
  changeWhoItAppliesTo: 'Change who it applies to',
};

const id: MessagesOf<typeof en> = {
  sections: ({ title }) => `Bagian ${title}`,
  activitySettings: 'Pengaturan aktivitas',

  publish: {
    cannotCheck: 'Tidak dapat memeriksa apa yang dilihat agent Anda.',
    tryAgain: 'Coba lagi',
    notSeeing: 'Agent Anda belum melihat perubahan ini.',
    nothingPublished: `Belum ada yang diterbitkan untuk ${kept('KPM')} ini.`,
    onVersion: ({ version }) => `Mereka memakai versi ${version}.`,
    publishing: 'Menerbitkan…',
    publishToAgents: 'Terbitkan ke agent',
  },

  staged: {
    notSaved: ({ count }) => `${count} perubahan belum disimpan.`,
    nothingReached: `Belum ada yang sampai ke ${kept('KPM')} Anda — dan menerbitkan ke agent adalah langkah terpisah setelah itu.`,
    saveChanges: 'Simpan perubahan',
    discard: 'Buang perubahan',
    mark: {
      added: 'Ditambahkan — belum disimpan',
      edited: 'Diubah — belum disimpan',
      archived: 'Diarsipkan — belum disimpan',
      restored: 'Dipulihkan — belum disimpan',
    },
  },

  save: 'Simpan',
  saving: 'Menyimpan…',
  saved: 'Tersimpan.',
  cancel: 'Batal',
  edit: 'Ubah',
  add: 'Tambah',
  rename: 'Ganti nama',
  remove: 'Hapus',
  archive: 'Arsipkan',
  restore: 'Pulihkan',
  undo: 'Urungkan',
  showArchived: 'Tampilkan yang diarsipkan',
  archivedLine: 'diarsipkan',
  archivedBadge: 'Diarsipkan',
  code: 'Kode',
  name: 'Nama',
  label: 'Label',
  description: 'Deskripsi',
  item: 'Item',
  optional: 'Opsional.',
  items: ({ n }) => `${n} item`,
  actionsFor: ({ name }) => `Aksi untuk ${name}`,
  appliesTo: 'Berlaku untuk',
  everyone: 'Semua orang',
  changeWhoItAppliesTo: 'Ubah untuk siapa ini berlaku',
};

export const settingsMessages = defineMessages({ en, id });
