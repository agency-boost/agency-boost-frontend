import { createElement, Fragment, type ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/** Words with an element among them — a part only a screen reader hears — as one message, in the language's order. */
const words = (...parts: ReactNode[]) => createElement(Fragment, null, ...parts);

/** The part of a control's name a screen reader hears and nobody sees, wrapped by the caller (`sr-only`). */
type Hidden = (words: string) => ReactNode;

/**
 * **The Company template's *Recruitment* tab** (`components/recruitment-playbook-tab.tsx`, P17-T8, ADR-0125; P18.98-T6,
 * area "admin-template"; `functional/recruitment.md`, *The module's own strings*): the company's recruitment playbook —
 * a card per candidate type, *Objections*, *Next action* — with the line that says it is live, *Save playbook*, the
 * notice when somebody saved first, and a company with none.
 *
 * **What the attack plans already say is theirs, and read from there** (`plan.ts`): *Good fit for* and *Opening lines*.
 * **English is the source**, every word as it was; the Indonesian is the approved glossary's, with the field's words for
 * the same things (§B.10: *kandidat*, *keberatan*, *manfaat*, *Tindakan berikutnya*, *Dia berkata*, *Anda menjawab*).
 * **Kept English** (§A): *Playbook*, *recruitment*, *Attack Plan*, *AgencyBoost*. **Content stays as typed** (ADR-0179 §5):
 * every word of the playbook — a profile's label and tagline, its benefits, an opening, an objection and its answer, the
 * next action — and the brief's vocabulary (a candidate type, a motivation, a hesitation), as the API serves it. **A
 * message never writes a figure** (P18.98-T3): when it was saved is written in the reader's figures and handed in.
 *
 * @moved components/recruitment-playbook-tab.tsx
 * @moved lib/recruitment-playbook.ts
 */
const en = {
  /** What a field left empty says when *Save playbook* is pressed; a refusal the server gave no words for. */
  writeThis: 'Write this before saving.',
  refused: 'Refused by the server.',

  /** The tab's states. `message` is the API's, as sent. */
  readFailed: ({ message }: { message: string }) => `Could not read this company’s recruitment playbook. ${message}`,
  tryAgain: 'Try again',
  none: 'This company has no recruitment playbook yet, so its agents’ Attack Plan has nothing to build from.',
  startFromDefaults: 'Start from the AgencyBoost words',
  startFromNothing: 'Start from nothing',

  /** The card at the head: live, or not saved yet, and who saved it when. `when` is written in the reader's figures. */
  live: 'This playbook is live.',
  liveDetail: 'Each save reaches every agent of this company on their next plan.',
  notSaved: 'Not saved yet.',
  notSavedDetail: 'Nothing reaches this company’s agents until you save it.',
  /** `name` the person who saved it, or `null` for the playbook a company was given. */
  saved: ({ version, name, when }: { version: number; name: string | null; when: string }) =>
    `Version ${version} · saved${name === null ? '' : ` by ${name}`} on ${when}`,
  saving: 'Saving…',
  save: 'Save playbook',
  discard: 'Discard changes',
  refusedFields: 'Not saved. Each field marked below needs a fix.',

  /** Somebody saved first (`409 VERSION_CONFLICT`): the version stored now, and the two ways on. */
  conflict: 'This playbook was changed somewhere else.',
  conflictDetail: ({ version, name, when }: { version: number; name: string | null; when: string }) =>
    `It is now version ${version}, saved${name === null ? '' : ` by ${name}`} on ${when}. Your edits are still here, `
    + 'and saving them replaces that version.',
  loadVersion: ({ version }: { version: number }) => `Load version ${version}`,
  keepMine: 'Keep my edits',

  /** A card: read as text until *Edit*. */
  notWritten: 'Not written yet.',
  edit: 'Edit',
  close: 'Close',
  objections: 'Objections',
  objectionsSummary: 'The answer to each hesitation, for every candidate type without its own.',
  nextAction: 'Next action',

  /** A hesitation's two answers. */
  theySay: 'They say',
  youSay: 'You say',

  /** A candidate type opened. */
  label: 'Label',
  tagline: 'Tagline',
  benefits: 'Benefits',
  benefit: ({ n }: { n: number }) => `Benefit ${n}`,
  oneBenefit: 'A candidate type lists at least one benefit.',
  /** *Remove*, and the part a screen reader hears after it: *Remove benefit 2*. */
  removeBenefit: ({ n, hidden }: { n: number; hidden: Hidden }) => words('Remove', hidden(` benefit ${n}`)),
  addBenefit: '+ Add benefit',
  mostBenefits: ({ max }: { max: number }) => `A candidate type lists at most ${max} benefits.`,
  ownObjections: 'Its own objections',
  ownObjectionsHint: 'Said instead of the answer under Objections, for this candidate type only.',
  /** `label` a hesitation's, as the API serves it. */
  removeOwn: ({ label, hidden }: { label: string; hidden: Hidden }) =>
    words('Remove', hidden(` its own objection for ${label}`)),
  addOwnFor: 'Add its own objection for',
};

const id: MessagesOf<typeof en> = {
  writeThis: 'Isi ini sebelum menyimpan.',
  refused: 'Ditolak oleh server.',

  readFailed: ({ message }) =>
    `Tidak dapat membaca ${kept('playbook')} ${kept('recruitment')} perusahaan ini. ${message}`,
  tryAgain: 'Coba lagi',
  none: `Perusahaan ini belum punya ${kept('playbook')} ${kept('recruitment')}, jadi ${kept('Attack Plan')} agent-nya `
    + 'belum punya bahan untuk disusun.',
  startFromDefaults: `Mulai dari kata-kata ${kept('AgencyBoost')}`,
  startFromNothing: 'Mulai dari kosong',

  live: `${kept('Playbook')} ini langsung berlaku.`,
  liveDetail: 'Setiap penyimpanan sampai ke setiap agent perusahaan ini pada rencana berikutnya.',
  notSaved: 'Belum disimpan.',
  notSavedDetail: 'Belum ada yang sampai ke agent perusahaan ini sampai Anda menyimpannya.',
  saved: ({ version, name, when }) => `Versi ${version} · disimpan${name === null ? '' : ` oleh ${name}`} pada ${when}`,
  saving: 'Menyimpan…',
  save: `Simpan ${kept('playbook')}`,
  discard: 'Buang perubahan',
  refusedFields: 'Tidak tersimpan. Setiap kolom yang ditandai di bawah perlu diperbaiki.',

  conflict: `${kept('Playbook')} ini diubah di tempat lain.`,
  conflictDetail: ({ version, name, when }) =>
    `Sekarang versi ${version}, disimpan${name === null ? '' : ` oleh ${name}`} pada ${when}. Perubahan Anda masih ada `
    + 'di sini, dan menyimpannya akan menggantikan versi itu.',
  loadVersion: ({ version }) => `Muat versi ${version}`,
  keepMine: 'Pertahankan perubahan saya',

  notWritten: 'Belum ditulis.',
  edit: 'Ubah',
  close: 'Tutup',
  objections: 'Keberatan',
  objectionsSummary: 'Jawaban untuk setiap keraguan, bagi setiap jenis kandidat yang belum punya jawabannya sendiri.',
  nextAction: 'Tindakan berikutnya',

  // *They* is one candidate, so *dia* (§B.0 rule 8), as the attack plans' push-back box says it.
  theySay: 'Dia berkata',
  youSay: 'Anda menjawab',

  label: 'Label',
  tagline: 'Deskripsi singkat',
  benefits: 'Manfaat',
  benefit: ({ n }) => `Manfaat ${n}`,
  oneBenefit: 'Setiap jenis kandidat mencantumkan setidaknya satu manfaat.',
  removeBenefit: ({ n, hidden }) => words('Hapus', hidden(` manfaat ${n}`)),
  addBenefit: '+ Tambah manfaat',
  mostBenefits: ({ max }) => `Setiap jenis kandidat mencantumkan paling banyak ${max} manfaat.`,
  ownObjections: 'Keberatan khususnya',
  ownObjectionsHint: 'Dipakai sebagai pengganti jawaban di Keberatan, hanya untuk jenis kandidat ini.',
  removeOwn: ({ label, hidden }) => words('Hapus', hidden(` keberatan khusus untuk ${label}`)),
  addOwnFor: 'Tambah keberatan khusus untuk',
};

export const adminTemplatePlaybookMessages = defineMessages({ en, id });
