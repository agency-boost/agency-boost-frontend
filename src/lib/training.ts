import { api } from './api-client';

/**
 * **Training, as the learner and the coach read it** (Phase 18.5, P18.5-T1 to T4;
 * `docs/02-specs/functional/training.md`): the shapes the four learner routes answer, the calls that ask
 * for them, and the words the screens draw them with — `/training/[categoryCode]`, the module page
 * `/training/[categoryCode]/[moduleCode]`, and the coaching *Training* tab, the person shell's and
 * `/coaching/me/training`'s.
 *
 * **Offered is the office's published snapshot** (T1 AC-3): the server answers only what the office
 * offers, so nothing here filters a draft or an archived module out. **Every count is served** (T2 AC-2,
 * AC-3): *(done/total)* is `TRAINING_COMPLETION_PCT`'s numerator and denominator from the server's one
 * function, never worked out here, so the coach's tab and the learner's own read cannot disagree (T4 AC-4).
 *
 * The Settings › Training screens (Phase 5) are `tenant-config.ts`'s and `training-view.ts`'s, and read
 * the office's working copy; nothing here touches them.
 *
 * Each interface is spelled out with named nested types, so `contract.spec.ts` can read its fields
 * against `backend/openapi.json`: it reads an interface's body up to the first `}`.
 */

/** A module's status, the prototype's three (`Overall.html:7657-7661`); the member sets it (OD-149). */
export type TrainingStatus = 'not_started' | 'in_progress' | 'done';

/** The kind of one content item, and of a *Format* chip (`:7652-7656`, ADR-0032). */
export type TrainingItemKind = 'file' | 'video' | 'link';

/** One row of a skill card (`:7797-7804`): *No. · Skill · Module · Format · Status*. */
export interface TrainingModuleRow {
  code: string;
  title: string;
  /** The kinds the module's live content holds, *File · Video · Link* order; empty draws *—*. */
  formats: TrainingItemKind[];
  status: TrainingStatus;
  completedAt: string | null;
}

/**
 * A module the member marked done that the office no longer offers (D-history): drawn on a person's
 * *Training* tab under its skill, its pill followed by *Archived*, outside every count. The learner's own
 * list draws only what is offered.
 */
export interface TrainingArchivedModuleRow {
  code: string;
  title: string;
  status: 'done';
  completedAt: string | null;
  /** The withdrawn module's own kinds of material, drawn as an offered row's are. */
  formats: TrainingItemKind[];
}

/** One skill card (ADR-0029: a card per skill), its offered modules in the office's order. */
export interface TrainingSkillProgress {
  code: string;
  label: string;
  /** False only for a skill no longer offered that still holds D-history rows. */
  offered: boolean;
  /** `TRAINING_COMPLETION_PCT` over this scope, served (T2 AC-2): offered modules done, and offered modules. */
  done: number;
  total: number;
  /** `null` when `total` is 0, which a person's tab draws *(0/0)*, never 0%. */
  pct: number | null;
  modules: TrainingModuleRow[];
  archived: TrainingArchivedModuleRow[];
}

/** One category: a subtab, and on a person's tab its *"{Label} ({done}/{total})"* heading. */
export interface TrainingCategoryProgress {
  code: string;
  label: string;
  /** The office's own words under the title; `null` when it wrote none. */
  description: string | null;
  /** False only for a category no longer offered that still holds D-history rows, after the offered ones. */
  offered: boolean;
  /** `TRAINING_COMPLETION_PCT` over this scope, served (T2 AC-2): offered modules done, and offered modules. */
  done: number;
  total: number;
  /** `null` when `total` is 0, which a person's tab draws *(0/0)*, never 0%. */
  pct: number | null;
  skills: TrainingSkillProgress[];
}

/** `GET /training/progress` (and `?for=`): every offered category of the office, in its order. */
export interface TrainingProgressView {
  /** Whose training this is: the reader's own, or the coachee's. */
  membershipId: string;
  /** `TRAINING_COMPLETION_PCT` over the whole catalog, served (T2 AC-2): offered modules done, and offered modules. */
  done: number;
  total: number;
  /** `null` when `total` is 0, which a person's tab draws *(0/0)*, never 0%. */
  pct: number | null;
  categories: TrainingCategoryProgress[];
  allOfferedDone: boolean;
}

/** One content item of a module (ADR-0032), a tile on its page. `url` is a link's own address. */
export interface TrainingItemView {
  id: string;
  kind: TrainingItemKind;
  /** The item's own label, printed as the tile's name (contradiction 6: no *.pdf* added). */
  label: string;
  mimeType: string | null;
  bytes: number | null;
  url: string | null;
}

/** A category or a skill as a module names it. */
export interface TrainingRef {
  code: string;
  label: string;
}

/** What the reader may do on the page: set the status, never in a support session (D-support). */
export interface TrainingModuleCan {
  update: boolean;
}

/** `GET /training/modules/:code`: one module as offered, with the reader's status and what they opened. */
export interface TrainingModulePage {
  code: string;
  title: string;
  category: TrainingRef;
  skill: TrainingRef;
  /** Files, then videos, then links. */
  items: TrainingItemView[];
  status: TrainingStatus;
  startedAt: string | null;
  completedAt: string | null;
  /** The items the reader has opened, kept on their record (D-opened). */
  openedItemIds: string[];
  can: TrainingModuleCan;
}

/** `POST …/items/:itemId/open`: where to go, and what the reader has opened now. */
export interface TrainingOpenAnswer {
  url: string;
  openedItemIds: string[];
  /** False when nothing was written: opened before, or a support session, which records nothing (T1 AC-6). */
  recorded: boolean;
}

/*
 * ── The calls ─────────────────────────────────────────────────────────────────────────────────────
 * Each a literal path, so `contract.spec.ts` and `check-api-consumers.py` see every route it calls.
 */

const moduleCode = (code: string) => encodeURIComponent(code);

/** The reader's own offered catalog with their statuses (T1, and `/coaching/me/training`, T4 AC-3). */
export const readTrainingProgress = () => api<TrainingProgressView>('/training/progress');

/** A coachee's, through `CoachResolver` (T4 AC-1): 404 outside the reader's reach. */
export const readCoacheeTraining = (membershipId: string) =>
  api<TrainingProgressView>(`/training/progress?for=${encodeURIComponent(membershipId)}`);

/** One offered module (T1 AC-5); 404 when the office does not offer it. */
export const readTrainingModule = (code: string) => api<TrainingModulePage>(`/training/modules/${moduleCode(code)}`);

/** Open one item (T1 AC-6): a signed URL for a file or a video, the address itself for a link. */
export const openTrainingItem = (code: string, itemId: string) =>
  api<TrainingOpenAnswer>(`/training/modules/${moduleCode(code)}/items/${encodeURIComponent(itemId)}/open`, { method: 'POST' });

/** Set the reader's status (T1 AC-7): sets, never toggles. Answers the module view. */
export const setTrainingStatus = (code: string, status: TrainingStatus) =>
  api<TrainingModulePage>(`/training/modules/${moduleCode(code)}/progress`, { method: 'PUT', body: { status } });

/*
 * ── Addresses ─────────────────────────────────────────────────────────────────────────────────────
 */

/** A category's list: `/training/{categoryCode}`, by the stored code (*Settled already*, the addresses). */
export const trainingCategoryHref = (categoryCode: string) => `/training/${encodeURIComponent(categoryCode)}`;

/** A module's page: `/training/{categoryCode}/{moduleCode}`. */
export const trainingModuleHref = (categoryCode: string, code: string) =>
  `${trainingCategoryHref(categoryCode)}/${encodeURIComponent(code)}`;

/** `/coaching/me`'s *Training* tab (T4 AC-3), a tab route as `/coaching/me/activation` is. */
export const MY_COACHING_TRAINING_HREF = '/coaching/me/training';

/*
 * ── The words ─────────────────────────────────────────────────────────────────────────────────────
 * The screens' words are the catalogue's (`i18n/messages/training.ts`, P18.98-T4), in the reader's language: the
 * prototype's verbatim (`Overall.html:3708-3778`, `:7625-7918`) and the module's own. Only the order is here.
 */

/** The order the toggle draws the statuses in (`:3757-3761`). */
export const TRAINING_STATUSES: readonly TrainingStatus[] = ['not_started', 'in_progress', 'done'];
