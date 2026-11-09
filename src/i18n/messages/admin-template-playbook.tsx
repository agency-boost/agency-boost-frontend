import { createElement, Fragment, type ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/** Words with an element among them — a part only a screen reader hears — as one message, in the language's order. */
const words = (...parts: ReactNode[]) => createElement(Fragment, null, ...parts);

/** The part of a control's name a screen reader hears and nobody sees, wrapped by the caller (`sr-only`). */
type Hidden = (words: string) => ReactNode;

/**
 * **A template's *Rekrutmen* section** (`components/recruitment-playbook-tab.tsx`, P19.4-T5, ADR-0210; P17-T8, ADR-0125;
 * P18.10-T6, area "admin-template"; `functional/recruitment.md`, *The module's own strings*): the template's recruitment
 * playbook — a card per candidate type, *Objections*, *Next action* — a template with none, and a publish refused field
 * by field. Its draft, its *Terbitkan* and a conflict are the section's draft bar's.
 *
 * **What the attack plans already say is theirs, and read from there** (`plan.ts`): *Good fit for* and *Opening lines*.
 * **English is the source**, every word as it was; the Indonesian is the approved glossary's, with the field's words for
 * the same things (§B.10: *kandidat*, *keberatan*, *manfaat*, *Tindakan berikutnya*, *Dia berkata*, *Anda menjawab*).
 * **Kept English** (§A): *Playbook*, *recruitment*, *Attack Plan*, *AgencyBoost*. **Content stays as typed** (ADR-0179 §5):
 * every word of the playbook — a profile's label and tagline, its benefits, an opening, an objection and its answer, the
 * next action — and the brief's vocabulary (a candidate type, a motivation, a hesitation), as the API serves it.
 *
 * @moved components/recruitment-playbook-tab.tsx
 * @moved lib/recruitment-playbook.ts
 */
const en = {
  /** A refusal the server gave no words for. */
  refused: 'Refused by the server.',

  /** A template with none, *Kosong* (ADR-0210 §1): the two starts, each the section's draft until *Terbitkan*. */
  none: 'This template has no recruitment playbook yet, so the Attack Plan of every KPM made from it has nothing to '
    + 'build from.',
  startFromDefaults: 'Start from the AgencyBoost words',
  startFromNothing: 'Start from nothing',

  /** *Terbitkan* refused field by field: each field marked below. */
  refusedFields: 'Not published. Each field marked below needs a fix.',

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
  refused: 'Ditolak oleh server.',

  none: `Template ini belum punya ${kept('playbook')} ${kept('recruitment')}, jadi ${kept('Attack Plan')} setiap KPM yang `
    + 'dibuat darinya belum punya bahan untuk disusun.',
  startFromDefaults: `Mulai dari kata-kata ${kept('AgencyBoost')}`,
  startFromNothing: 'Mulai dari kosong',

  refusedFields: 'Belum terbit. Setiap kolom yang ditandai di bawah perlu diperbaiki.',

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
