import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The two attack plans' shared words** (P18.98-T4, field selling; `functional/sales-tools.md`, `functional/recruitment.md`,
 * *The module's own strings*): what the Sales Attack Plan (`/attack-plan`, and the catalog's drawer) and the Recruitment
 * Attack Plan (`/recruitment/attack-plan`) both say, in the prototypes' words (`Overall.html:3786-3866`, `:9726-9790`;
 * `Recruitment_Section.html:288-353`, `:586-619`) — the step list's name, *Back*, the brief card's title and its line, and
 * the numbered blocks' labels. Here once, so the two plans cannot word one block two ways.
 *
 * **The shared parts, `components/plan/`, write no word of their own**: every word comes in by props, from these two
 * screens' areas (`product-catalog.ts`, `sales-attack-plan.tsx`, `recruitment-plan.ts` and this one), so the parts are
 * held to the catalogue from here.
 *
 * **English is the source** of the keys; the Indonesian is the approved glossary's (OD-237; §B.0's voice), with what it
 * lacked in the glossary for approval's §B.10. *Pitch* is kept (§A.6). A person is *dia* (§B.0 rule 8). **The plans'
 * content is never a message** (ADR-0179 §5): a product's script, a candidate profile's words, an opening line, a
 * push-back and its reply, the next action — the company's or the office's, shown as typed.
 *
 * @moved components/plan/
 */
const en = {
  /** The step pills' list, named for a screen reader. */
  steps: 'Steps',
  /** *‹ Back* and *← Back*: the arrow is drawn beside it, hidden from a screen reader. */
  back: 'Back',
  /** The brief card (`Overall.html:3796`, `Recruitment_Section.html:300`). */
  briefTitle: 'Who are we talking to?',
  /** The client's one line at every size, beside the questions it counts (P18.95-T7 AC-1, grey text rows 9 and 10). */
  briefHint: 'Answer 3 questions to get your pitch.',
  /** The numbered blocks' labels (`.d-label`, `.block-label`). */
  goodFitFor: 'Good fit for',
  openingLine: 'Opening line',
  /** The recruitment plan's, where a candidate has more than one motivation (`Recruitment_Section.html:567-569`). */
  openingLines: 'Opening lines',
  leadWithBenefits: 'Lead with these benefits',
  pushBack: 'If they push back',
  /** The push-back box's two labels (`.objection-box`). */
  theySay: 'They say:',
  youSay: 'You say:',
  nextAction: 'Next action',

  /**
   * **The plan on a phone** (UI V1, UI-107; `attack-plan-mobile` 3 and 5): the brief's answers as chips with *Change*,
   * the long lists and the full script folded, the push-back as two bubbles.
   */
  change: 'Change',
  moreBenefits: ({ n }: { n: number }) => (n === 1 ? 'See 1 more benefit' : `See ${n} more benefits`),
  showLess: 'Show less',
  readAll: 'Read all',
  theySaid: 'They say',
  youAnswer: 'You say',
};

const id: MessagesOf<typeof en> = {
  steps: 'Langkah',
  back: 'Kembali',
  briefTitle: 'Dengan siapa kita bicara?',
  briefHint: `Jawab 3 pertanyaan untuk mendapatkan ${kept('pitch')} Anda.`,
  goodFitFor: 'Cocok untuk',
  openingLine: 'Kalimat pembuka',
  // One form for one and many (§B.0 rule 8).
  openingLines: 'Kalimat pembuka',
  leadWithBenefits: 'Tekankan manfaat berikut',
  // *They* is the customer or the candidate: one person, so no *mereka* — and no pronoun is needed at all.
  pushBack: 'Jika ada keberatan',
  theySay: 'Dia berkata:',
  youSay: 'Anda menjawab:',
  nextAction: 'Tindakan berikutnya',

  change: 'Ubah',
  moreBenefits: ({ n }) => `Lihat ${n} manfaat lagi`,
  showLess: 'Tampilkan lebih sedikit',
  readAll: 'Baca semua',
  theySaid: 'Dia berkata',
  youAnswer: 'Anda menjawab',
};

export const planMessages = defineMessages({ en, id });
