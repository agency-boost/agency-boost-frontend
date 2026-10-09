'use client';

import { api } from './api-client';

/**
 * **A company's recruitment playbook, as the Super Admin reads and writes it** (P17-T8, OD-88 → 5,
 * ADR-0125): the words every agent of the company builds an Attack Plan from — a profile per candidate
 * type, an opening per motivation, the answer to each hesitation, a candidate type's own answers, and
 * the next action.
 *
 * **The company's, read live.** No template holds it and nobody publishes it, which is why it sits
 * beside *Products* on the Company template rather than behind a draft bar (ADR-0115 §7).
 *
 * The codes are the backend's domain constants (D-vocabulary), served in `vocabulary` with their chip
 * labels and in the chips' order — never declared here.
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

/** The playbook as stored. `updatedBy` is `null` for the one a company was given when it was created. */
export interface PlaybookDto {
  companyId: string;
  version: number;
  body: PlaybookBody;
  updatedAt: string;
  updatedBy: { name: string } | null;
}

/**
 * **The bounds the API refuses past**, served with the read (invariant §7): the longest any one text may
 * be once trimmed, and the most benefits one candidate type lists. Never re-declared here.
 */
export interface PlaybookLimits {
  textMax: number;
  benefitsMax: number;
}

/** What the tab reads: the company's playbook or none, the AgencyBoost words, the vocabulary, the bounds. */
export interface PlaybookRead {
  playbook: PlaybookDto | null;
  /** The AgencyBoost words (the prototype's, verbatim), for *Start from the AgencyBoost words*. */
  defaults: PlaybookBody;
  vocabulary: RecruitmentVocabulary;
  limits: PlaybookLimits;
}


/** The company's playbook (`company_template:read`). */
export const readRecruitmentPlaybook = (companyId: string) =>
  api<PlaybookRead>(`/admin/companies/${companyId}/recruitment-playbook`);

/**
 * Save the whole playbook (`recruitment_playbook:write`), **pinned to the version it was read at**:
 * `null` only to create one. A version the server has moved past is `409 VERSION_CONFLICT`; a text
 * missing or too long is `400 VALIDATION_FAILED` naming each field.
 */
export const saveRecruitmentPlaybook = (companyId: string, version: number | null, body: PlaybookBody) =>
  api<PlaybookDto>(`/admin/companies/${companyId}/recruitment-playbook`, {
    method: 'PUT',
    body: { version, body },
  });
