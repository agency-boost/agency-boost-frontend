import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import type { TrainingItemKind, TrainingStatus } from '@/lib/training';

/**
 * **Training, as the learner and the coach read it** (P18.98-T4, training; `functional/training.md`, *The module's own
 * strings*): the learner's `/training/*` — the subtabs, *Skills List* and its skill cards, a module's page with its tiles
 * and the status toggle, the states — and the coaching *Training* tab (`person-training.tsx`), a coachee's and the
 * reader's own, which draw the same parts (`training-parts.tsx`).
 *
 * **English is the source** of the keys, the prototype's words verbatim (`Overall.html:3708-3778`, `:7625-7918`) and the
 * module's own Fills; the Indonesian is the approved glossary's (OD-237; §B.0's voice), with what it lacked in the
 * glossary for approval's §B.10. **Kept English** (§A): the page's title and the nav item (*Training Modules*,
 * *Training modules* — the report's own words in ID mode, UI-067's *‹ Training Modules*), *Training* (the category row's
 * name, a category's *Training {label}*), and the column *Module* (§A.6). **UI V1 (Phase 18.99 T10)**: *Skills List*,
 * *No.*, *Skill*, the subtitle and the captions are gone (UI-063, UI-066, UI-067); the lesson card's *Module 1 of 3* and
 * the video's *Play Video: {label}* are proposed in §B.10 (*UI V1, Phase 18.99 T10*). In a sentence *training* is *pelatihan* and *module* *modul* (§A.6's own alternative; §B.10 *Modul
 * Training*), while *skill* stays (§B.10 *grid skill*). **Content stays as typed** (ADR-0179 §5): a category's, a skill's
 * and a module's name, a category's description, an item's label. **None of OD-39's six words in either language**, and
 * no promise of a *Skill Tracker* (OD-150) — `components/training/copy.spec.ts` reads both languages.
 *
 * @moved components/training/
 * @moved lib/training.ts
 * @moved app/(agent)/training/
 */
const en = {
  /** Every learner page's title, the nav item's words (P18.95-T9 AC-2), and the not-found card's way back (the item). */
  title: kept('Training Modules'),
  trainingModules: kept('Training modules'),
  /** The subtabs' `nav`, named. */
  tab: kept('Training'),
  /**
   * A desktop skill card's three columns (UI-066: *No.* and *Skill* dropped — the card's heading says the skill), and
   * *Status* over the module page's status card (UI-068).
   */
  columns: { module: kept('Module'), format: 'Format', status: 'Status' },
  /** A category's own title on its empty card (`"{label} Training"`, contradiction 14); `label` as the office typed it. */
  categoryTitle: ({ label }: { label: string }) => `${label} Training`,
  comingSoon: 'Modules for this category are coming soon.',
  back: ({ title }: { title: string }) => `Back to ${title}`,
  skillTag: ({ label }: { label: string }) => `Skill: ${label}`,
  /** The lesson card's *1/3* (UI-067), as a screen reader hears it. */
  position: ({ n, of }: { n: number; of: number }) => `Module ${n} of ${of}`,
  /** A video's play button, named (UI-067): it plays here, so no *opens in a new tab*. */
  playName: ({ label }: { label: string }) => `Play Video: ${label}`,
  /** The ✓ an opened item wears, named; and the toasts. */
  opened: 'Opened',
  markedOpened: 'Marked as opened.',
  marked: ({ title, status }: { title: string; status: TrainingStatus }) =>
    `Marked "${title}" as ${({ not_started: 'not started', in_progress: 'in progress', done: 'done' })[status]}.`,
  /** The status words (`:7657-7661`), on the pills and on the three buttons. */
  status: { not_started: 'Not started', in_progress: 'In progress', done: 'Done' } satisfies Record<TrainingStatus, string>,
  /** The *Format* chip's word (`:7652-7656`). */
  format: { file: 'File', video: 'Video', link: 'Link' } satisfies Record<TrainingItemKind, string>,
  /**
   * An item's button (`RESOURCE_TYPE_META`, `:7812-7816`). The captions — *Uploaded by admin*, *External resource* — are
   * gone since UI V1 (UI-067).
   */
  tile: {
    file: { button: 'Open File' },
    video: { button: 'Play Video' },
    link: { button: 'Open Link' },
  } satisfies Record<TrainingItemKind, { button: string }>,

  /** The module's own (L-01's states, D-history's word). */
  nothingToOpen: 'Nothing to open in this module yet.',
  archived: 'Archived',
  noTraining: 'No training to show yet.',
  noTrainingSub: 'Modules appear here once they are published for you.',
  categoryNotFound: 'This category can’t be found.',
  moduleNotFound: 'This module can’t be found.',
  notFoundSub: 'It may have been withdrawn, or the address may be mistyped.',
  loadingCatalog: 'Loading training…',
  loadingModule: 'Loading this module…',
  tryAgain: 'Try again',
  /** A skill's list of modules, named for a screen reader: which skill's modules these are. */
  tableCaption: ({ skill }: { skill: string }) => `${skill} modules`,
  statusGroup: ({ title }: { title: string }) => `Status of ${title}`,
  /** A tile's button, named: its words first (WCAG 2.5.3), the item, and that it leaves. */
  openName: ({ button, label }: { button: string; label: string }) => `${button}: ${label} (opens in a new tab)`,
  openFailed: ({ label }: { label: string }) => `Couldn’t open ${label}. Try again.`,
  /** `why` the server's sentence (P18.98-T5's). */
  notSaved: ({ why }: { why: string }) => `Not saved. ${why}`,
  noFormatName: 'No material yet',
};

const id: MessagesOf<typeof en> = {
  title: kept('Training Modules'),
  trainingModules: kept('Training modules'),
  tab: kept('Training'),
  // *Format* and *Status* are Indonesian already (`SAME_IN_INDONESIAN`).
  columns: { module: kept('Module'), format: 'Format', status: 'Status' },
  categoryTitle: ({ label }) => `${kept('Training')} ${label}`,
  comingSoon: 'Modul untuk kategori ini segera hadir.',
  back: ({ title }) => `Kembali ke ${title}`,
  skillTag: ({ label }) => `${kept('Skill')}: ${label}`,
  position: ({ n, of }) => `Modul ${n} dari ${of}`,
  playName: ({ label }) => `Putar video: ${label}`,
  opened: 'Sudah dibuka',
  markedOpened: 'Ditandai sudah dibuka.',
  marked: ({ title, status }) =>
    `"${title}" ditandai ${({ not_started: 'belum dimulai', in_progress: 'sedang berjalan', done: 'selesai' })[status]}.`,
  status: { not_started: 'Belum dimulai', in_progress: 'Berjalan', done: 'Selesai' },
  format: { file: 'File', video: 'Video', link: 'Tautan' },
  tile: {
    file: { button: 'Buka file' },
    video: { button: 'Putar video' },
    link: { button: 'Buka tautan' },
  },

  nothingToOpen: 'Belum ada yang bisa dibuka di modul ini.',
  archived: 'Diarsipkan',
  noTraining: 'Belum ada pelatihan untuk ditampilkan.',
  noTrainingSub: 'Modul akan muncul di sini setelah diterbitkan untuk Anda.',
  categoryNotFound: 'Kategori ini tidak ditemukan.',
  moduleNotFound: 'Modul ini tidak ditemukan.',
  notFoundSub: 'Mungkin sudah ditarik, atau alamatnya salah ketik.',
  loadingCatalog: 'Memuat pelatihan…',
  loadingModule: 'Memuat modul ini…',
  tryAgain: 'Coba lagi',
  tableCaption: ({ skill }) => `Modul ${skill}`,
  statusGroup: ({ title }) => `Status ${title}`,
  openName: ({ button, label }) => `${button}: ${label} (terbuka di tab baru)`,
  openFailed: ({ label }) => `Tidak dapat membuka ${label}. Coba lagi.`,
  notSaved: ({ why }) => `Tidak tersimpan. ${why}`,
  noFormatName: 'Belum ada materi',
};

export const trainingMessages = defineMessages({ en, id });
