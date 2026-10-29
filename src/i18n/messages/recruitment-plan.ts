import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **Recruitment, and its Attack Plan** (P18.98-T4, field selling; `functional/recruitment.md`, *The module's own
 * strings*): the section's title, line and tabs (`/recruitment/*`), the hand-off at `/recruitment`, and
 * `/recruitment/attack-plan` — the candidate brief's three questions, the plan's summary and head, and the states the
 * prototype lacks; `lib/recruitment.ts`' words. The blocks' labels, the brief card and *Back* are the two plans' own,
 * `plan.ts`; the pitch's documents, *Pitch Materials*' cards, are `recruitment-pitch.ts`.
 *
 * **English is the source** of the keys, `AgencyBoost_Recruitment_Section.html`'s words verbatim (`:276-353`,
 * `:586-619`; D-copy) and the module's own Fills; the Indonesian is the approved glossary's (OD-237; §B.0's voice), with
 * what it lacked in the glossary for approval's §B.10 — *gambaran kandidat* for the candidate brief, *keraguan* for a
 * hesitation, *Rencana siap*. A candidate is *dia* (§B.0 rule 8). **Kept English** (§A): *Recruitment* (the title, the
 * tab row's name, and inside a sentence), the tabs *Attack Plan* and *Pitch Materials*, *pitch*. **Content stays as
 * typed** (ADR-0179 §5): the company's playbook — the chips' labels (the candidate types, motivations and hesitations),
 * a profile's label, tagline, fit, benefits, the opening lines, the push-backs and their replies, the next action — as
 * the server answers it. None of OD-39's six words in either language, and no *kantor* (`recruitment-words.spec.ts`).
 *
 * @moved lib/recruitment.ts
 * @moved app/(agent)/recruitment/
 */
const en = {
  /** The section (`:276-286`): its title, its line, and its two tabs, named by the section for a screen reader. */
  title: kept('Recruitment'),
  subtitle: 'Build the pitch on the fly, or pull the ready-made materials to show a candidate.',
  tabs: kept('Recruitment'),
  tabAttackPlan: kept('Attack Plan'),
  tabPitchMaterials: kept('Pitch Materials'),
  /** `/recruitment`, handing off to the first tab: the skeleton's name. */
  redirecting: 'Taking you to Attack Plan…',

  /** The step pills (`:290-294`); the first also names the brief's summary for a screen reader. */
  stepBrief: 'Candidate brief',
  stepPlan: 'Recruitment plan',
  /** The brief's three questions (`:305-330`). */
  candidateType: 'Candidate type',
  motivation: 'What\'s driving them',
  hesitation: 'Their biggest hesitation',
  build: 'Build recruitment plan',
  /** The brief's summary (`:342-350`): each label with its space, before the answers. */
  typeIs: 'Type: ',
  motivationIs: 'Motivation: ',
  hesitationIs: 'Hesitation: ',
  /** The plan's head (`:586-590`): its tag, and its pill. */
  profileTag: 'Candidate profile',
  planReady: 'Plan ready',

  /** The states the prototype lacks (Fills; P17-T3 AC-7). */
  loadingBrief: 'Loading the candidate brief…',
  loadingPlan: 'Building your recruitment plan…',
  tryAgain: 'Try again',
  noPlaybook: 'No recruitment plan can be built yet.',
  noPlaybookHint: 'The opening lines, benefits and answers to objections a plan is made from haven\'t been written for '
    + 'your company yet. You can still show a candidate the ready-made documents in Pitch Materials.',
  toPitchMaterials: 'Go to Pitch Materials',
};

const id: MessagesOf<typeof en> = {
  title: kept('Recruitment'),
  subtitle: `Susun ${kept('pitch')} secara langsung, atau ambil materi siap pakai untuk ditunjukkan kepada kandidat.`,
  tabs: kept('Recruitment'),
  tabAttackPlan: kept('Attack Plan'),
  tabPitchMaterials: kept('Pitch Materials'),
  redirecting: `Membuka ${kept('Attack Plan')}…`,

  stepBrief: 'Gambaran kandidat',
  stepPlan: `Rencana ${kept('recruitment')}`,
  candidateType: 'Jenis kandidat',
  motivation: 'Apa yang mendorongnya',
  hesitation: 'Keraguan terbesarnya',
  build: `Susun rencana ${kept('recruitment')}`,
  typeIs: 'Jenis: ',
  motivationIs: 'Motivasi: ',
  hesitationIs: 'Keraguan: ',
  profileTag: 'Profil kandidat',
  planReady: 'Rencana siap',

  loadingBrief: 'Memuat gambaran kandidat…',
  loadingPlan: `Menyusun rencana ${kept('recruitment')} Anda…`,
  tryAgain: 'Coba lagi',
  noPlaybook: `Belum ada rencana ${kept('recruitment')} yang dapat disusun.`,
  noPlaybookHint: 'Kalimat pembuka, manfaat, dan jawaban atas keberatan yang menjadi bahan sebuah rencana belum ditulis '
    + `untuk perusahaan Anda. Anda tetap dapat menunjukkan dokumen siap pakai di ${kept('Pitch Materials')} kepada kandidat.`,
  toPitchMaterials: `Buka ${kept('Pitch Materials')}`,
};

export const recruitmentPlanMessages = defineMessages({ en, id });
