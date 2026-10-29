import { planMessages } from '@/i18n/messages/plan';
import { recruitmentPlanMessages } from '@/i18n/messages/recruitment-plan';
import { api } from './api-client';

/**
 * **Recruitment › Attack Plan** (`docs/02-specs/functional/recruitment.md`, Phase 17, P17-T3): the shape
 * the plan's read answers, the call that asks for it, the address that carries the brief, and the words the
 * page draws — `AgencyBoost_Recruitment_Section.html`'s, verbatim, and the few the page writes itself.
 *
 * **The vocabulary is the server's** (D-vocabulary): the five candidate types, four motivations and five
 * hesitations come with every answer, codes and chip labels, in the chips' order. Nothing here declares
 * them again — the chips are drawn from `vocabulary`, and an address's codes are checked by the server.
 *
 * **The plan is the server's too** (D-plan): which profile, which opening for each motivation, whose
 * objection — a profile's own or the base — and the next action. The page prints what it is answered.
 * **Nothing about a candidate is kept** (D-store): the brief lives in the address as codes, and nowhere else.
 *
 * Each interface is spelled out with named nested types, so `contract.spec.ts` can read its fields against
 * `backend/openapi.json`: it reads an interface's body up to the first `}`.
 *
 * **The words are the catalogue's** (P18.98-T4; ADR-0179 §4): `messages/recruitment-plan.ts` and the two plans'
 * `messages/plan.ts`. **The chips' labels and the plan's words are the company's playbook**, shown as typed in both
 * languages (ADR-0179 §5): the server answers them, and nothing here translates them.
 */

/** One chip: a code and its label, verbatim (`:305-330`). */
export interface Choice {
  code: string;
  label: string;
}

/** The brief's three questions, each in the chips' order. */
export interface RecruitmentVocabulary {
  types: Choice[];
  motivations: Choice[];
  hesitations: Choice[];
}

/** The brief a plan was built for, as the server read it — the answers in the chips' order. */
export interface RecruitmentBrief {
  type: Choice;
  motivations: Choice[];
  hesitations: Choice[];
}

/** The candidate's profile, the company's words. `label` is the summary's *Type* (`:557`). */
export interface RecruitmentProfile {
  code: string;
  label: string;
  tagline: string;
  goodFitFor: string;
  benefits: string[];
}

/** One opening line, for one chosen motivation. */
export interface RecruitmentOpening {
  motivation: Choice;
  text: string;
}

/** One push-back, for one chosen hesitation: the profile's own words where there are some, else the base. */
export interface RecruitmentObjection {
  hesitation: Choice;
  theySay: string;
  youSay: string;
  profileOwn: boolean;
}

export interface RecruitmentPlan {
  brief: RecruitmentBrief;
  profile: RecruitmentProfile;
  openings: RecruitmentOpening[];
  objections: RecruitmentObjection[];
  nextAction: string;
}

/**
 * What `GET /recruitment/attack-plan` answers. `plan` is `null` without a brief, and when the company has no
 * playbook (`hasPlaybook: false`) — never another company's.
 */
export interface RecruitmentAttackPlanView {
  hasPlaybook: boolean;
  vocabulary: RecruitmentVocabulary;
  plan: RecruitmentPlan | null;
}

// ------------------------------------------------------------------------------------- addresses

/** A brief as the address holds it: codes only, the answers in the order given. */
export interface BriefCodes {
  type: string;
  motivations: string[];
  hesitations: string[];
}

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (typeof value === 'string' && value ? value : undefined);

/** `a,b` into its codes; `undefined` for an empty one, or a code given twice. */
function listOf(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const codes = value.split(',');
  if (codes.some((c) => c === '') || new Set(codes).size !== codes.length) return undefined;
  return codes;
}

/**
 * The brief an address holds (D-urls): `?type=&motivation=&hesitation=`, the last two comma-separated, all
 * three given — or nothing, so an incomplete address opens the brief with nothing chosen (P17-T3 AC-5). An
 * unknown code is the server's to refuse; the page then opens the brief the same way.
 */
export function briefFromQuery(query: Query): BriefCodes | null {
  const type = one(query.type);
  const motivations = listOf(one(query.motivation));
  const hesitations = listOf(one(query.hesitation));
  if (!type || type.includes(',') || !motivations || !hesitations) return null;
  return { type, motivations, hesitations };
}

/** `type=…&motivation=a,b&hesitation=c` — commas kept as commas, each code encoded. */
export function briefQuery(brief: BriefCodes): string {
  const list = (codes: readonly string[]) => codes.map(encodeURIComponent).join(',');
  return `type=${encodeURIComponent(brief.type)}&motivation=${list(brief.motivations)}&hesitation=${list(brief.hesitations)}`;
}

/**
 * The brief as chosen on step 1, once it is complete: a type, a motivation and a hesitation that the
 * vocabulary has, the answers put in the chips' order (`:521`) — or `null`, and *Build recruitment plan*
 * stays disabled (`:533`). A code the vocabulary does not have is not an answer.
 */
export function completeBrief(
  vocabulary: RecruitmentVocabulary | null,
  type: string | null,
  motivations: readonly string[],
  hesitations: readonly string[],
): BriefCodes | null {
  if (!vocabulary) return null;
  const inOrder = (choices: readonly Choice[], codes: readonly string[]) =>
    choices.filter((c) => codes.includes(c.code)).map((c) => c.code);
  const chosenType = vocabulary.types.find((c) => c.code === type)?.code;
  const chosenMotivations = inOrder(vocabulary.motivations, motivations);
  const chosenHesitations = inOrder(vocabulary.hesitations, hesitations);
  if (!chosenType || chosenMotivations.length === 0 || chosenHesitations.length === 0) return null;
  return { type: chosenType, motivations: chosenMotivations, hesitations: chosenHesitations };
}

/** The codes of a brief the server read, so step 1 opens on it as it was. */
export const codesOf = (brief: RecruitmentBrief): BriefCodes => ({
  type: brief.type.code,
  motivations: brief.motivations.map((c) => c.code),
  hesitations: brief.hesitations.map((c) => c.code),
});

/** The labels of several answers, as the summary joins them (`:558-559`). */
export const labels = (choices: readonly Choice[]) => choices.map((c) => c.label).join(', ');

export const ATTACK_PLAN_HREF = '/recruitment/attack-plan';
export const PITCH_MATERIALS_HREF = '/recruitment/pitch-materials';

/** `/recruitment/attack-plan?type=…&motivation=…&hesitation=…` */
export const planHref = (brief: BriefCodes) => `${ATTACK_PLAN_HREF}?${briefQuery(brief)}`;

// ------------------------------------------------------------------------------------------- calls

/**
 * The plan for a brief, or — with none — the vocabulary and whether the company has a playbook. A brief the
 * server cannot read (an unknown or repeated code) is `400 VALIDATION_FAILED`.
 */
export const readRecruitmentPlan = (brief: BriefCodes | null) =>
  api<RecruitmentAttackPlanView>(brief ? `/recruitment/attack-plan?${briefQuery(brief)}` : '/recruitment/attack-plan');

// ------------------------------------------------------------------------------------------ words

/**
 * **The words, in English** — the catalogue's source (`messages/recruitment-plan.ts`, and the two plans' shared
 * `messages/plan.ts`), for code with no reader to ask, in the shapes they had before P18.98-T4 moved every word of the
 * section into the catalogue, where they are written once. The screens read them with `useMessages`, in the reader's
 * language.
 */
const EN = recruitmentPlanMessages.en;
const PLAN = planMessages.en;

/** `Recruitment_Section.html`'s strings, verbatim (D-copy). */
export const PROTOTYPE_COPY = {
  title: EN.title,
  subtitle: EN.subtitle,
  tabAttackPlan: EN.tabAttackPlan,
  tabPitchMaterials: EN.tabPitchMaterials,
  stepBrief: EN.stepBrief,
  stepPlan: EN.stepPlan,
  briefTitle: PLAN.briefTitle,
  /** The client's words at every size (P18.95-T7 AC-1, grey text row 9; ADR-0167 §7), as `/attack-plan`'s hint. */
  briefHint: PLAN.briefHint,
  candidateType: EN.candidateType,
  motivation: EN.motivation,
  hesitation: EN.hesitation,
  build: EN.build,
  /** `← Back` (`:342`): the arrow is drawn beside it, hidden from a screen reader. */
  back: PLAN.back,
  typeIs: EN.typeIs,
  motivationIs: EN.motivationIs,
  hesitationIs: EN.hesitationIs,
  profileTag: EN.profileTag,
  planReady: EN.planReady,
  goodFitFor: PLAN.goodFitFor,
  openingLine: PLAN.openingLine,
  openingLines: PLAN.openingLines,
  leadWithBenefits: PLAN.leadWithBenefits,
  pushBack: PLAN.pushBack,
  theySay: PLAN.theySay,
  youSay: PLAN.youSay,
  nextAction: PLAN.nextAction,
} as const;

/**
 * **The strings this screen writes itself** (Fills; D-copy): the states the prototype has none of, and the
 * names a screen reader hears. None uses *office*, *KPM*, *reports to*, *tagged to*, *untagged* or
 * *unassigned* (ADR-0084's rule) — `recruitment.spec.ts` checks the English, `recruitment-words.spec.ts` both
 * languages — and none names a phase.
 */
export const OWN_COPY = {
  tabs: EN.tabs,
  steps: PLAN.steps,
  loadingBrief: EN.loadingBrief,
  loadingPlan: EN.loadingPlan,
  tryAgain: EN.tryAgain,
  noPlaybook: EN.noPlaybook,
  noPlaybookHint: EN.noPlaybookHint,
  toPitchMaterials: EN.toPitchMaterials,
  redirecting: EN.redirecting,
} as const;
