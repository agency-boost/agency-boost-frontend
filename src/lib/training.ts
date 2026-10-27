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
 */

/**
 * **The prototype's own words, verbatim** (`Overall.html:3708-3778`, `:7625-7918`). *"{label} Training"* is
 * Sales's title drawn for every category (contradiction 14, a Fill). **Not shipped** (OD-150): the two
 * footers that promise *"…your Skill Tracker"* (`:3730`, `:3763`).
 */
export const PROTOTYPE_COPY = {
  skillsList: 'Skills List',
  columns: { no: 'No.', skill: 'Skill', module: 'Module', format: 'Format', status: 'Status' },
  categoryTitle: (label: string) => `${label} Training`,
  comingSoon: 'Modules for this category are coming soon.',
  moduleSubtitle: 'Structured training module.',
  back: (title: string) => `Back to ${title}`,
  skillTag: (label: string) => `Skill: ${label}`,
  opened: 'Opened',
  markedOpened: 'Marked as opened.',
  marked: (title: string, status: TrainingStatus) => `Marked "${title}" as ${STATUS_LABEL[status].toLowerCase()}.`,
  tab: 'Training',
} as const;

/** The status words (`:7657-7661`), on the pills and on the three buttons. */
export const STATUS_LABEL: Record<TrainingStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
};

/** The order the toggle draws them in (`:3757-3761`). */
export const TRAINING_STATUSES: readonly TrainingStatus[] = ['not_started', 'in_progress', 'done'];

/** The *Format* chip's word (`:7652-7656`). */
export const FORMAT_LABEL: Record<TrainingItemKind, string> = { file: 'File', video: 'Video', link: 'Link' };

/** A tile's caption and button (`RESOURCE_TYPE_META`, `:7812-7816`). */
export const TILE: Record<TrainingItemKind, { caption: string; button: string }> = {
  file: { caption: 'Uploaded by admin', button: 'Open File' },
  video: { caption: 'Uploaded by admin', button: 'Play Video' },
  link: { caption: 'External resource', button: 'Open Link' },
};

/**
 * **Ours** (L-01's states, and D-history's word): none of OD-39's six words, no phase, no code. Each is
 * registered with its parity row in `functional/training.md`.
 */
export const OWN_COPY = {
  /** A module that holds no content yet (contradiction 5, a Fill). */
  nothingToOpen: 'Nothing to open in this module yet.',
  /** D-history: a module done and since withdrawn, after its pill on a person's tab. */
  archived: 'Archived',
  /** No category offered at all (0701 *Empty*): the list, and a person's tab. */
  noTraining: 'No training to show yet.',
  noTrainingSub: 'Modules appear here once they are published for you.',
  categoryNotFound: 'This category can’t be found.',
  moduleNotFound: 'This module can’t be found.',
  notFoundSub: 'It may have been withdrawn, or the address may be mistyped.',
  /** The not-found card's way back: the nav item's own words, to `/training`. */
  trainingModules: 'Training modules',
  /**
   * **Every learner page's title: the nav item's words** (P18.95-T9 AC-2; ADR-0167 §10, OD-205; the client's UI
   * review, UI-027 — menu *Training modules* over a page titled *Sales Training*). The category is the tab below it.
   */
  title: 'Training Modules',
  loadingCatalog: 'Loading training…',
  loadingModule: 'Loading this module…',
  tryAgain: 'Try again',
  /** The table's caption, for a screen reader: which skill's modules these are. */
  tableCaption: (skill: string) => `${skill} modules`,
  /** The status buttons' group, for a screen reader. */
  statusGroup: (title: string) => `Status of ${title}`,
  /** A tile's button, named for a screen reader: its words first (WCAG 2.5.3), the item, and that it leaves. */
  openName: (button: string, label: string) => `${button}: ${label} (opens in a new tab)`,
  /** An open that failed, under its tile. */
  openFailed: (label: string) => `Couldn’t open ${label}. Try again.`,
  /** A status the server refused, under the toggle. */
  notSaved: (why: string) => `Not saved. ${why}`,
  /** No content in a module: the *Format* cell's dash, named. */
  noFormat: '—',
  noFormatName: 'No material yet',
} as const;
