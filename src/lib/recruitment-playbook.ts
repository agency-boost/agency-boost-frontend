'use client';

/**
 * **A recruitment playbook's shape, as the Super Admin edits it** (P17-T8, OD-88 → 5, ADR-0125): the words every agent
 * builds an Attack Plan from — a profile per candidate type, an opening per motivation, the answer to each hesitation, a
 * candidate type's own answers, and the next action.
 *
 * **A template section since P19.4-T5** (ADR-0210): the `recruitment_playbook` kind, drafted as it is typed and
 * published through the template's kind routes (`readTemplate`, `saveTemplateDraft`, `publishTemplate` in `admin.ts`),
 * its read carrying the editor's `playbook` — the AgencyBoost words, the vocabulary and the bounds. Each KPM reads its
 * template's published words live. `GET` and `PUT /admin/companies/:companyId/recruitment-playbook` are retired.
 *
 * The codes are the backend's domain constants (D-vocabulary), served in `vocabulary` with their chip labels and in the
 * chips' order — never declared here.
 */

/** One answer to one of the brief's questions: its stable code, and the chip's label verbatim. */
export interface Choice {
  code: string;
  label: string;
}

/** The brief's three questions and their answers, in the chips' order (`Recruitment_Section.html:305-330`). */
export interface RecruitmentVocabulary {
  types: Choice[];
  motivations: Choice[];
  hesitations: Choice[];
}

/** What a candidate says, and what the agent says back. */
export interface Words {
  theySay: string;
  youSay: string;
}

/** One candidate type's profile: keyed in {@link PlaybookBody.profiles} by the type's code. */
export interface PlaybookProfile {
  label: string;
  tagline: string;
  goodFitFor: string;
  benefits: string[];
  /** One opening line per motivation code. */
  openings: Record<string, string>;
}

/** The whole playbook, as one write sends it. */
export interface PlaybookBody {
  /** Keyed by candidate type code. */
  profiles: Record<string, PlaybookProfile>;
  /** The base answer to each hesitation, keyed by hesitation code. */
  objections: Record<string, Words>;
  /** A candidate type's own answers, which win over the base one: type code → hesitation code → words. */
  profileObjections: Record<string, Record<string, Words>>;
  nextAction: string;
}

/**
 * **The bounds the API refuses past**, served with the read (invariant §7): the longest any one text may
 * be once trimmed, and the most benefits one candidate type lists. Never re-declared here.
 */
export interface PlaybookLimits {
  textMax: number;
  benefitsMax: number;
}
