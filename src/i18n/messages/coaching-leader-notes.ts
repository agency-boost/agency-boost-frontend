import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **A coachee's *🔒 Leader Notes* tab** (P18.98-T4, coaching and unit; `functional/coaching.md`, *Leader Notes*, *The
 * module's own strings*): the *Capability mapping* ladder, the *Skill tracker*, the leader's *Personal notes* and those
 * somebody below them wrote — their states, their saves and their refusals.
 *
 * **English is the source**: the prototype's words (`Overall.html:4344-4382`, `:11189-11282`) and ours (L-01). The
 * Indonesian is the approved glossary's (OD-237; §B.0), with the settings' own words for the same things —
 * *tahap* for a stage, *grid skill*, *Diarsipkan* (§B.3) — and *Catatan pribadi* for approval in §B.10. **UI V1
 * (Phase 18.99 T10):** *Skill tracker* kept English at every size (UI-006, UI-036; was *Pelacak skill*), *Tidak berlaku*
 * the report's (UI-036), and the tile's button name proposed in §B.10 (*UI V1, Phase 18.99 T10*). **Kept** (§A): *Capability mapping*, the module's name as §A.1's *Capability Mapping* (its sentence-case card
 * title, for approval), *leader*, *skill*; *office* is *KPM* (§B.9) in the one sentence that says it. **Content stays as
 * typed** (ADR-0179 §5): a stage's, a milestone's, a grid's and an item's label, a note, an author's name.
 *
 * @moved components/coaching-leader-notes.tsx
 */
const en = {
  /** The ladder's card (`Overall.html:4346-4360`) and what its saves say. */
  capability: kept('Capability mapping'),
  updated: 'Capability mapping updated.',
  reread: 'The capability mapping was changed somewhere else, so it has been read again.',
  noStages: 'Your office has not set up its capability stages yet.',
  currentStage: 'Current stage',
  loading: 'Loading the capability mapping…',
  /** The tile's button (UI-035), named by the stage it shows: the whole tile opens the ladder. */
  openLadder: ({ stage }: { stage: string }) => `Capability mapping: ${stage}. Show every stage.`,
  /** *Skill tracker* (`Overall.html:4362-4376`): kept English in both languages since UI V1 (UI-006, UI-036). */
  tracker: kept('Skill tracker'),
  /** A section that does not apply to this coachee, as its grey pill says (UI-036). */
  notApplicable: 'Not applicable',
  noGrids: 'Your office has not set up its skill grids yet.',
  /** A row the office stopped offering, still drawn where it was ticked (P11-T9 AC-3). */
  archived: 'Archived',
  /** *Personal notes* (`Overall.html:4378-4380`), and another leader's (`:4594-4596`). */
  notes: 'Personal notes',
  /** After *Personal notes*, for a screen reader, on a note somebody below the reader wrote. */
  notesFrom: ({ name }: { name: string }) => ` from ${name}`,
  leaderOnly: ({ name }: { name: string }) => `Leader-only, never shown to ${name}`,
  from: ({ name }: { name: string }) => `From ${name}`,
  saved: 'Personal notes saved.',
  loadingNotes: 'Loading the personal notes…',
  notesReread: 'Your notes were changed somewhere else, so they have been read again.',
  save: 'Save notes',
};

const id: MessagesOf<typeof en> = {
  capability: kept('Capability mapping'),
  updated: `${kept('Capability mapping')} diperbarui.`,
  reread: `${kept('Capability mapping')} diubah di tempat lain, jadi sudah dimuat ulang.`,
  noStages: `${kept('KPM')} Anda belum menyiapkan tahap kapabilitasnya.`,
  currentStage: 'Tahap saat ini',
  loading: `Memuat ${kept('Capability mapping')}…`,
  openLadder: ({ stage }) => `${kept('Capability mapping')}: ${stage}. Tampilkan semua tahap.`,
  tracker: kept('Skill tracker'),
  notApplicable: 'Tidak berlaku',
  noGrids: `${kept('KPM')} Anda belum menyiapkan grid ${kept('skill')}-nya.`,
  archived: 'Diarsipkan',
  notes: 'Catatan pribadi',
  notesFrom: ({ name }) => ` dari ${name}`,
  leaderOnly: ({ name }) => `Khusus ${kept('leader')}, tidak pernah ditampilkan kepada ${name}`,
  from: ({ name }) => `Dari ${name}`,
  saved: 'Catatan pribadi tersimpan.',
  loadingNotes: 'Memuat catatan pribadi…',
  notesReread: 'Catatan Anda diubah di tempat lain, jadi sudah dimuat ulang.',
  save: 'Simpan catatan',
};

export const coachingLeaderNotesMessages = defineMessages({ en, id });
