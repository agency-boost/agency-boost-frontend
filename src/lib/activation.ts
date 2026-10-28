import { api } from './api-client';
import { formatOfficeDay, formatPercent, formatShortDay } from './format';

/**
 * The 90-day activation (Phase 13, `docs/02-specs/functional/activation.md`): the shapes the API
 * answers, the calls that ask for them, and the words the four screens draw them with — the hire's
 * `/activation`, the leader's `/new-hires` and `/new-hires/[membershipId]`, and the coaching
 * *Activation* tab, the person shell's and `/coaching/me`'s.
 *
 * **Every number on these screens is served.** The read answers the office's today, the day, the
 * window, the percentage, each aspect's status and whether the hire is overdue, so nothing here
 * reads the browser's clock or works out progress (invariant §9, F-01; P13-T2 AC-5, exit criterion 2):
 * one function on the server computes what all four readers see. A screen prints it.
 *
 * Each interface is spelled out with named nested types, so `contract.spec.ts` can read its fields
 * against `backend/openapi.json`: it reads an interface's body up to the first `}`.
 */

/** An activation's life (OD-28, OD-120): open until the hire graduates, or until six months have run. */
export type ActivationState = 'open' | 'graduated' | 'expired';

/** An aspect's verdict, the prototype's three (`Overall.html:6537-6551`). */
export type AspectStatus = 'done' | 'in_progress' | 'not_started';

/** Who or what ticked an item (OD-121): the hire, a leader above them, or the item's link. */
export type ItemSource = 'hire' | 'leader' | 'link';

/** A person as the activation names them: their membership and their full name. */
export interface ActivationPerson {
  membershipId: string;
  name: string;
}

/** What a linked item waits for, from the registry (P5-T3): *"Go to {label} →"* and the *Auto* badge's words. */
export interface ActivationItemLink {
  kind: string;
  label: string;
  /**
   * `null`: nowhere to go — a training module no longer offered (D-orphan), or a data-backed item, whose way in is its
   * own form (P18.96-T4 AC-3); no *Go to* is drawn.
   */
  route: string | null;
  completesWhen: string;
  live: boolean;
  /**
   * **The form a hand tick opens** (P18.96-T4 AC-3): `closing` — *Which case?* — or `one_on_one` — *Log 1:1* — for the
   * three data-backed items, which are ticked by hand only with their record; `null` for every other link.
   */
  form: ActivationRecordForm | null;
}

/** What a data-backed item's hand tick is saved with (P18.96-T4 AC-3). */
export type ActivationRecordForm = 'closing' | 'one_on_one';

/** A record a done data-backed item names (P18.96-T4 AC-2): a lead, a coaching session, or the file's month. */
export interface ActivationItemRecord {
  collection: 'goals' | 'leads' | 'activityLogs' | 'trainingProgress' | 'monthlyAgentData' | 'coachingSessions';
  id: string;
}

/**
 * One item of the pinned checklist, with its state. `note` and `date` are the hire's own and come only
 * in the hire's read; every leader read answers them `null` (P13-T2 AC-4).
 */
export interface ActivationItemProgress {
  code: string;
  label: string;
  link: ActivationItemLink | null;
  done: boolean;
  doneAt: string | null;
  source: ItemSource | null;
  doneBy: ActivationPerson | null;
  note: string | null;
  date: string | null;
  /** *"Ticked by {name}, waiting for data"* (P18.96-T4 AC-4): a data-backed item ticked by hand, not yet confirmed. */
  waiting: boolean;
  /** The record its source line links to (P18.96-T4 AC-2), for a done data-backed item; else `null`. */
  record: ActivationItemRecord | null;
}

/** One of a member's closings (P18.96-T4 AC-3): what *Which case?* offers. */
export interface ActivationClosing {
  leadId: string;
  name: string;
  date: string;
}

/** `GET /activation/me/closings`, `GET /new-hires/:membershipId/closings`. */
export interface ActivationClosings {
  closings: ActivationClosing[];
}

/**
 * **The record sent with a data-backed item's tick** (P18.96-T4 AC-3): an existing closing by its lead, a new one by a
 * name and the day it was paid and issued, or a 1:1 by the day it was held and a note.
 */
export interface ActivationRecordInput {
  kind: ActivationRecordForm;
  leadId?: string;
  name?: string;
  date?: string;
  note?: string;
}

export interface ActivationAspectProgress {
  code: string;
  label: string;
  status: AspectStatus;
  done: number;
  total: number;
  items: ActivationItemProgress[];
}

/** A leader's correction of the start date (OD-118): who, and when. */
export interface ActivationCorrection {
  by: ActivationPerson;
  at: string;
}

/** The leader's coaching note, which the hire reads (OD-117). */
export interface ActivationNote {
  text: string;
  by: ActivationPerson;
  at: string;
}

/** One hire's activation, as every reader is served it. */
export interface ActivationView {
  hire: ActivationPerson;
  state: ActivationState;
  startDate: string;
  startCorrected: ActivationCorrection | null;
  today: string;
  day: number;
  window: number;
  overdue: boolean;
  endsOn: string;
  done: number;
  total: number;
  pct: number;
  aspects: ActivationAspectProgress[];
  firstCaseClosed: boolean;
  graduatedAt: string | null;
  graduatedBy: ActivationPerson | null;
  note: ActivationNote | null;
}

/**
 * *Direct Unit*, or the nearest leader's unit below the reader (D-group): an AAB's, or — an AB under an
 * AB (ADR-0014) — an AB's, the card naming the rung (a Fix).
 */
export type NewHireGroupKind = 'direct' | 'aab' | 'ab';

/**
 * A new hire's **3M activation** (`ACTIVATION_3M`, ADR-0171 §2; P18.96-T6): in progress through day 90 of the join date,
 * then activated (a first sale by day 90) or not. The server decides and keeps it; this only draws it.
 */
export type Activation3MResult = 'in_progress' | 'activated' | 'not_activated';

/** The unit a new hire is counted in. */
export interface NewHireUnitRef {
  kind: NewHireGroupKind;
  leader: ActivationPerson | null;
}

/** A new hire's checklist, where they have one: an AB or an AAB placed as a new hire has none (ADR-0103). */
export interface NewHireChecklist {
  state: ActivationState;
  done: number;
  total: number;
  pct: number;
  overdue: boolean;
}

/** One new hire on `/new-hires` (ADR-0173 §2). */
export interface NewHireRow {
  hire: ActivationPerson;
  unit: NewHireUnitRef;
  joinDate: string;
  /** Which day of their first 90 today is. */
  day: number;
  firstSaleDate: string | null;
  activation3M: Activation3MResult;
  leftOn: string | null;
  checklist: NewHireChecklist | null;
}

/** `ACTIVATION_3M_PCT` over a set, as the server computes it: `pct` `null` while nobody is decided. */
export interface Activation3MShare {
  activated: number;
  notActivated: number;
  inProgress: number;
  pct: number | null;
}

/** One join month's share. */
export interface Activation3MMonth {
  month: string;
  activated: number;
  notActivated: number;
  inProgress: number;
  pct: number | null;
}

export interface Activation3MFigures {
  all: Activation3MShare;
  byMonth: Activation3MMonth[];
}

export interface NewHireUnit {
  kind: NewHireGroupKind;
  leader: ActivationPerson | null;
  activation3M: Activation3MFigures;
}

export interface NewHiresSections {
  inProgress: NewHireRow[];
  activated: NewHireRow[];
  notActivated: NewHireRow[];
}

export interface NewHiresWindow {
  from: string;
  to: string;
}

/** `GET /new-hires` (P18.96-T6): a year of new hires by their 3M result, and the 3M activation % at the top. */
export interface NewHiresRoster {
  today: string;
  window: NewHiresWindow;
  /** The day the result is decided after: what *Day 64 of 90* prints. */
  days: number;
  activation3M: Activation3MFigures;
  units: NewHireUnit[];
  sections: NewHiresSections;
}

/** What *Mark left* answers. */
export interface NewHireMarkedLeft {
  membershipId: string;
  leftAt: string;
  leftOn: string;
  activation3M: 'activated' | 'not_activated';
}

/** What a saved note answers. */
export interface ActivationNoteSaved {
  note: ActivationNote;
}

/** What the hire's tick sends: the state, and their own note and date when they change one — or its record. */
export interface MyItemInput {
  done: boolean;
  note?: string | null;
  date?: string | null;
  /** A data-backed item's tick only (P18.96-T4 AC-3). */
  record?: ActivationRecordInput;
}

/*
 * ── The calls ────────────────────────────────────────────────────────────────────────────────────
 */

/*
 * Every path is written out in full, so `scripts/check-api-consumers.py` — which reads the literal passed
 * to `api(...)` — sees each route this module calls.
 */

/** The reader's own activation, any state. A 404 means they have none. */
export const readMyActivation = () => api<ActivationView>('/activation/me');

/** Tick, untick, or note one of the reader's own manual items. Sets the state; never toggles it. */
export const saveMyItem = (code: string, input: MyItemInput) =>
  api<ActivationView>(`/activation/me/items/${encodeURIComponent(code)}`, { method: 'PUT', body: input });

/** *Mark checklist complete* (OD-28; the button's name since P18.96-T6, ADR-0173 §4): the hire's own, at 100%. */
export const graduateMyActivation = () =>
  api<ActivationView>('/activation/me/graduate', { method: 'POST' });

/** The leader's roster. A 404 means the reader reaches no open activation. */
export const readNewHires = () => api<NewHiresRoster>('/new-hires');

/** *Mark left* (P18.96-T6 AC-4, ADR-0173 §3): the new hire has left, today. Not a removal. */
export const markHireLeft = (membershipId: string) =>
  api<NewHireMarkedLeft>(`/new-hires/${encodeURIComponent(membershipId)}/left`, { method: 'POST' });

/** One hire's activation as a leader reads it — also what the coaching *Activation* tab reads. */
export const readNewHire = (membershipId: string) => api<ActivationView>(`/new-hires/${encodeURIComponent(membershipId)}`);

/** A leader's tick on a hire's manual item — or a data-backed one's, with its record (P18.96-T4 AC-3). */
export const saveHireItem = (membershipId: string, code: string, done: boolean, record?: ActivationRecordInput) =>
  api<ActivationView>(`/new-hires/${encodeURIComponent(membershipId)}/items/${encodeURIComponent(code)}`, {
    method: 'PUT', body: record ? { done, record } : { done },
  });

/** The reader's own closings, for *Which case?* (P18.96-T4 AC-3). */
export const readMyClosings = () => api<ActivationClosings>('/activation/me/closings');

/** A hire's closings, for a leader's *Which case?* (P18.96-T4 AC-3). */
export const readHireClosings = (membershipId: string) =>
  api<ActivationClosings>(`/new-hires/${encodeURIComponent(membershipId)}/closings`);

/** A leader's correction of the start date (OD-118). */
export const correctStartDate = (membershipId: string, startDate: string) =>
  api<ActivationView>(`/new-hires/${encodeURIComponent(membershipId)}/start-date`, { method: 'PUT', body: { startDate } });

/** The leader's coaching note, replacing the one before it (OD-117). */
export const saveActivationNote = (membershipId: string, text: string) =>
  api<ActivationNoteSaved>(`/new-hires/${encodeURIComponent(membershipId)}/note`, { method: 'PUT', body: { text } });

/*
 * ── Limits and codes ─────────────────────────────────────────────────────────────────────────────
 */

/** The hire's note on an item, at most (the contract; `contract.spec.ts` pins it to the document). */
export const ITEM_NOTE_MAX = 500;

/** The leader's coaching note, at most. */
export const ACTIVATION_NOTE_MAX = 1000;

/** How far back a leader may move a start date, in days (the contract's bound). */
export const START_DATE_BACK_DAYS = 365;

/**
 * The item the roster's *Active Agent* and the coaching renderer's *New Active Agent* read (invariant §4):
 * the backend's `ACTIVATION_FIRST_CASE_CODE`, pinned to it by `activation.spec.ts` reading that constant.
 */
export const FIRST_CASE_CLOSED = 'FIRST_CASE_CLOSED';

/*
 * ── The words ────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * The prototype's strings, verbatim (D-copy), with its straight apostrophes. Two are rewritten as
 * D-copy and OD-28 say: the graduation confirm speaks to the hire, without the demo's *"same as when a
 * real agent finishes"*.
 */
export const PROTOTYPE_COPY = {
  // `Overall.html:10408-10409`. **Both titles are the nav items' words** since P18.95-T9 AC-2 (ADR-0167 §10, OD-205;
  // UI-027, *menu labels = page titles*): the prototype titled them *90-Day Activation* and *Your New Hires* under
  // nav items reading *Your 90-day activation* and *New hires* (`:2638-2647`).
  title: 'Your 90-Day Activation',
  subtitle: 'Your first 90 days, checklist by checklist.',
  rosterTitle: 'New Hires',
  rosterSubtitle: "Track your new agents' 90-day activation progress.",
  // The hire's page (`:3280-3349`).
  progressHeading: 'Your activation progress',
  /*
   * **Join date**, one name for the one date (P18.96-T2 AC-5, ADR-0169 §7; the client's UI-009; parity I-454): the
   * prototype's *Start date* here (`:3284`) and *Joined* on the roster (`:6734`) named the same day twice. The hire's
   * page, the leader's detail and the roster's column all print it.
   */
  joinDate: 'Join date',
  /*
   * **Mark checklist complete** (P18.96-T6 AC-5, ADR-0173 §4; parity I-475): the prototype's *Mark activation complete
   * →* (`:3285`), renamed so it cannot be read as the 3M result — *activated* is a first sale by day 90 (ADR-0171 §2).
   */
  graduate: 'Mark checklist complete',
  day: 'Day',
  completed: 'Completed',
  pctComplete: (pct: number) => `${formatPercent(pct)} complete`,
  aspect: 'Aspect',
  items: 'Items',
  status: 'Status',
  footer: "Visible only to new agents, for their first 6 months. Tenured agents won't see this section.",
  // A row (`:6570-6604`).
  showNoteAndDate: 'Show note and date',
  notePlaceholder: 'Note (optional)',
  auto: 'Auto',
  goTo: (label: string) => `Go to ${label} →`,
  // Graduation (`:6683-6688`, `:4673-4674`; the question per OD-28 and D-copy).
  graduateQuestion: 'Mark your checklist complete? The 90-Day Activation menu will be removed.',
  confirm: 'Confirm',
  cancel: 'Cancel',
  graduated: 'Marked as tenured agent — 90-Day Activation removed from menu.',
  // The roster (`:6742-6783`).
  directUnit: 'Direct Unit',
  aabUnit: (name: string) => `AAB: ${name}`,
  // D-group's Fix: the prototype's form for the other rung the nearest leader may stand on.
  abUnit: (name: string) => `AB: ${name}`,
  name: 'Name',
  progress: 'Progress',
  activeAgent: 'Active Agent',
  closedFirstCase: 'Closed first case',
  none: '—',
  // The detail (`:3367-3414`, `:6793-6794`, `:6869`, `:6891`).
  // The roster's title, as it now reads (P18.95-T9 AC-2): the prototype's *Back to Your New Hires*.
  back: 'Back to New Hires',
  detailSubtitle: 'You can update their 90-Day Activation status, plus your coaching note.',
  detailHeading: 'Activation progress',
  statusUpdated: 'Activation status updated.',
  noteHeading: 'Coaching note',
  noteHint: 'Visible to this agent on their own 90-Day Activation page.',
  // A placeholder holds no ⓘ, so *JFW* is spelled out in place (P18.95-T9 AC-3; UI-028): the prototype's *first JFW*.
  noteExample: "e.g. Great pace on prospecting — let's focus on booking your first joint field work this week.",
  saveNote: 'Save note',
  noteSaved: (name: string) => `Coaching note saved — visible to ${name}.`,
  // The coaching renderer (`:6464-6489`).
  cardTitle: '90-Day Activation',
  doneNewActiveAgent: '✓ Done · New Active Agent',
  itemDone: '✓ Done',
  notDone: 'Not done',
} as const;

/** The aspect pill's words (`:6547-6551`). */
export const ASPECT_STATUS_LABEL: Record<AspectStatus, string> = {
  done: 'Done',
  in_progress: 'In progress',
  not_started: 'Not started',
};

/** A new hire's 3M result in words (P18.96-T6; the client's report, R2: *in progress*, *activated*, *not activated*). */
export const ACTIVATION_3M_LABEL: Record<Activation3MResult, string> = {
  in_progress: 'In progress',
  activated: 'Activated',
  not_activated: 'Not activated',
};

/**
 * The module's own strings: the states the prototype lacks (L-01), the attribution, and the
 * refusals. **None of ADR-0084's six words** (D-copy): *office*, *KPM*, *reports to*, *tagged to*,
 * *untagged*, *unassigned*.
 */
export const OWN_COPY = {
  loading: 'Loading your activation…',
  loadingRoster: 'Loading your new hires…',
  loadingHire: 'Loading this activation…',
  tryAgain: 'Try again',
  // `/activation` for a reader it is not offered to (T4 AC-7).
  noneTitle: 'You have no 90-day activation.',
  noneLine: 'It is for people in their first months as an agent.',
  graduatedTitle: 'Your 90-day checklist is complete.',
  /** Why *Mark checklist complete* waits (P18.96-T6 AC-5): `n` is the checklist's own total, served with it. */
  graduateLocked: (n: number) => `Unlocks when all ${n} items are done`,
  graduatedLine: (on: string) => `You marked it complete on ${on}.`,
  expiredTitle: 'Your 90-day activation has ended.',
  expiredLine: (on: string) => `It ran for six months, until ${on}.`,
  checklistElsewhere: 'Your checklist stays on your own coaching page.',
  ownCoaching: 'Your own coaching',
  // `/new-hires` with nobody on it — since P18.96-T6, nobody who joined as a new hire in the year it lists.
  rosterEmpty: 'No one you lead joined as a new hire in the last 12 months.',
  /*
   * **3M activation on `/new-hires`** (P18.96-T6 AC-2 to AC-4; ADR-0171 §2, ADR-0173 §2–§3; the client's report of
   * 2026-10-27, R4, R5, UI-005): the figure, its filter, the three sections, a row's result, and the two actions. The
   * report's own words where it has them — *3M activation %*, *In progress (day 1–90)*, *Activated*, *Not activated*,
   * *Left*, *Schedule 1:1*, *Mark left*.
   */
  activation3MHeading: '3M activation %',
  activation3MCounts: (activated: number, notActivated: number, inProgress: number) =>
    `${activated} activated · ${notActivated} not activated · ${inProgress} in progress`,
  // A share over nobody decided: no figure, never 0% — said in words to a screen reader.
  noFigure: '—',
  noFigureName: 'No result yet',
  joinMonth: 'Join month',
  allMonths: 'All',
  byUnit: 'By unit',
  sectionInProgress: 'In progress (day 1–90)',
  sectionActivated: 'Activated',
  sectionNotActivated: 'Not activated',
  sectionEmpty: 'No one here.',
  checklist: 'Checklist',
  noChecklist: 'No checklist',
  firstSale: 'First sale',
  result: 'Result',
  actions: 'Actions',
  leftOn: (on: string) => `Left ${on}`,
  scheduleOneOnOne: 'Schedule 1:1',
  scheduleOneOnOneName: (name: string) => `Schedule 1:1 with ${name}`,
  markLeft: 'Mark left',
  /** The button's name holds its visible words first, so a voice command of *"Mark left"* finds it (WCAG 2.5.3). */
  markLeftName: (name: string) => `Mark left — ${name}`,
  markLeftQuestion: (name: string) =>
    `Mark ${name} as left? They stay in your records with their history, and their 3M activation is decided today. This can't be undone.`,
  markedLeft: (name: string) => `${name} is marked as left.`,
  markLeftFailed: (why: string) => `Not marked as left. ${why}`,
  // `/new-hires/[membershipId]` outside the reader's reach.
  hireNotFoundTitle: 'This person isn’t one of your new hires.',
  hireNotFoundLine: 'They may have moved to another leader, or the address may be mistyped.',
  // A hire whose activation is over, on the detail and the coaching tab.
  closedGraduated: (by: string, on: string) => `Marked complete by ${by} on ${on}.`,
  closedExpired: (on: string) => `Ended on ${on}, six months after it started.`,
  // The coaching tab for somebody with none.
  coacheeNone: (name: string) => `${name} has no 90-day activation.`,
  meNone: 'You have no 90-day activation.',
  // The *Auto* badge (T4 AC-4): the registry's sentence, as its tooltip and in its name.
  autoTip: (completesWhen: string) => `Completes when ${completesWhen}.`,
  autoName: (completesWhen: string) => `Auto — completes when ${completesWhen}`,
  /*
   * The settings row's badge for a link that does not work (P13-T3 AC-1, parity I-80): *whether* the
   * link completes the item, never when (ADR-0062 §3) — so no "yet", no "until", no phase.
   */
  byHand: 'Ticked by hand',
  byHandTip: 'This link does not complete the item on its own, so the hire or one of their leaders ticks it.',
  byHandName: 'Ticked by hand — this link does not complete the item on its own, so the hire or one of their leaders ticks it',
  // The overdue *Day*, after the day, for a screen reader: the red and the bold say it to everybody else.
  overdue: ', overdue',
  /**
   * A hire's *Day* on a phone's card (P18.95-T3 AC-4; the client's UI review, UI-012: *"Day 64 of 90"*): the
   * table's *64 /90* in words, the day as `dayShown` prints it (*90+* past the window).
   */
  dayOf: (day: string, window: number) => `${PROTOTYPE_COPY.day} ${day} of ${window}`,
  // Attribution (OD-121, T4 AC-5).
  you: 'you',
  tickedBy: (who: string, when: string) => `Ticked by ${who} · ${when}`,
  completedFrom: (label: string, who: string | null, when: string) =>
    who ? `Completed from ${label} by ${who} · ${when}` : `Completed from ${label} · ${when}`,
  completedAutomatically: (when: string) => `Completed automatically · ${when}`,
  // The join date's correction (OD-118, ADR-0169 §2): the activation's start is the join date, and moves with it.
  correctedBy: (who: string, when: string) => `Join date corrected by ${who} · ${when}`,
  startDateRange: (from: string) => `Choose a date from ${from} to today.`,
  startSaved: 'Join date updated.',
  // The note.
  noteFrom: (who: string, when: string) => `From ${who} · ${when}`,
  noteSavedBy: (who: string, when: string) => `Last saved by ${who} · ${when}`,
  noteEmpty: 'Write a note before saving.',
  saving: 'Saving…',
  // The hire's note and date, named for a screen reader by the placeholder and the row they belong to.
  itemNoteName: (label: string) => `${PROTOTYPE_COPY.notePlaceholder} — ${label}`,
  itemDateName: (label: string) => `Date — ${label}`,
  // A row whose write failed: it is put back, and this says why.
  notSaved: (why: string) => `Not saved. ${why}`,
  /*
   * The data-backed items (P18.96-T4; the client's report, UI-004): the source line, the waiting line, and the two
   * forms a hand tick opens. The client's own words: *"Completed from Sales data · {date}"*, *"Ticked by {name}, waiting
   * for data"*, *Which case?*, *Log 1:1*.
   */
  completedFromData: (label: string, when: string) => `Completed from ${label} · ${when}`,
  waitingForData: (who: string) => `Ticked by ${who}, waiting for data`,
  // The Owner's checklist settings (P18.96-T7 G2): what one of the three completes from, in its select's place.
  fromData: (label: string) => `From ${label}`,
  whichCase: 'Which case?',
  newClosing: 'Log a new closing',
  closingName: 'Sold to',
  closingDate: 'Paid and issued on',
  closingOption: (name: string, when: string) => `${name} · ${when}`,
  noClosings: 'No closing in Leads Management yet. Log the case below.',
  loadingClosings: 'Loading the closings…',
  logOneOnOne: 'Log 1:1',
  oneOnOneDate: 'Held on',
  oneOnOneNote: 'Note',
  oneOnOnePlaceholder: 'What you covered',
  saveRecord: 'Save',
  cancelRecord: 'Cancel',
  recordIncomplete: 'Fill in every field first.',
} as const;

/*
 * ── Small readings of the shapes ─────────────────────────────────────────────────────────────────
 */

/**
 * An aspect's name as these screens draw it, beside its number: *Introduction*, under ①.
 *
 * The office's checklist names its aspects as the Owner's prototype does, with the number in the label
 * — *1. Introduction* (`KPM_Owner.html:1525-1560`, P5-T3) — while `Overall.html` draws the number in
 * its own circle and the name alone (`:3319-3347`, `:6533`). The circle is the position, which an office
 * may reorder (invariant §4), so the label's own leading number is the one dropped.
 */
export function aspectTitle(label: string): string {
  const bare = label.replace(/^\s*\d+[.)]\s+/, '');
  return bare || label;
}

/** *Day* as the tile and the roster print it: the day, or the window and a plus past it (`:6616`, `:6753`). */
export const dayShown = (day: number, window: number) => (day > window ? `${window}+` : String(day));

/** The way back to a hire's detail, and the detail's own address. */
export const newHireHref = (membershipId: string) => `/new-hires/${encodeURIComponent(membershipId)}`;

/** `/coaching/me`'s *Activation* tab (D-coaching-me). */
export const MY_COACHING_ACTIVATION_HREF = '/coaching/me/activation';

/** A unit's name on `/new-hires` (D-group): *Direct Unit*, *AAB: {name}* or *AB: {name}*. */
export function groupTitle(group: NewHireUnitRef): string {
  if (!group.leader || group.kind === 'direct') return PROTOTYPE_COPY.directUnit;
  return group.kind === 'ab' ? PROTOTYPE_COPY.abUnit(group.leader.name) : PROTOTYPE_COPY.aabUnit(group.leader.name);
}

/**
 * Who ticked a done item and when, or which link completed it (OD-121, T4 AC-5): the attribution
 * marker's words, which are its accessible name too. `null` for an item that is not done.
 *
 * `reader` is the reader's membership, so their own tick reads *you*.
 */
export function attributionOf(item: ActivationItemProgress, reader: string | null | undefined): string | null {
  if (!item.done) return null;
  const when = item.doneAt ? formatOfficeDay(item.doneAt) : '';
  const who = item.doneBy ? (item.doneBy.membershipId === reader ? OWN_COPY.you : item.doneBy.name) : null;
  if (item.source === 'link') {
    // A data-backed item names its data, not a person (P18.96-T4 AC-2): *"Completed from Sales data · {date}"*.
    if (item.link?.form) return OWN_COPY.completedFromData(item.link.label, when);
    return item.link ? OWN_COPY.completedFrom(item.link.label, who, when) : OWN_COPY.completedAutomatically(when);
  }
  return who ? OWN_COPY.tickedBy(who, when) : null;
}

/**
 * **A data-backed item** (P18.96-T4): one of the three the office's sales and coaching data complete — *Close first
 * case independently*, *Reach Independent Agent milestone*, *Weekly 1-on-1 check-in* — which a hand tick opens a form
 * for. The server says which, through the link's `form`; nothing here knows the codes.
 */
export const isDataBacked = (item: ActivationItemProgress) => item.link?.form != null;

/** Its source line (AC-2, AC-4): where it was completed from, or who ticked it and that it waits; `null` undone. */
export function sourceLineOf(item: ActivationItemProgress, reader: string | null | undefined): string | null {
  if (!item.done || !isDataBacked(item)) return null;
  if (item.waiting) {
    const who = item.doneBy ? (item.doneBy.membershipId === reader ? OWN_COPY.you : item.doneBy.name) : OWN_COPY.you;
    return OWN_COPY.waitingForData(who);
  }
  return attributionOf(item, reader);
}

/**
 * **Where the source line goes** (AC-2): the record it names, on a page its reader may open — the hire's own Leads and
 * coaching sessions, or a leader's archive of a session with them. `null` for a month of the production file, and for a
 * lead to a leader, which no page of theirs opens by itself.
 */
export function recordHref(
  item: ActivationItemProgress, audience: 'hire' | 'leader', hireMembershipId: string,
): string | null {
  const record = item.record;
  if (!record || !item.done) return null;
  if (record.collection === 'coachingSessions') {
    return audience === 'hire'
      ? `/coaching/me?session=${encodeURIComponent(record.id)}`
      : `/coaching/${encodeURIComponent(hireMembershipId)}/archive/${encodeURIComponent(record.id)}`;
  }
  if (record.collection === 'leads' && audience === 'hire') return '/leads';
  return null;
}

/**
 * Whether a data-backed item takes a hand write now (P18.96-T4 AC-3): a tick, through its form, or an untick of a tick
 * saved by hand. Never one its data completed: that is the link's (`409 ACTIVATION_ITEM_AUTOMATIC`).
 */
export const takesHandWrite = (item: ActivationItemProgress) => isDataBacked(item) && !(item.done && item.source === 'link');

/** The correction's words, or `null` when nobody moved the date. */
export function correctionOf(view: ActivationView, reader: string | null | undefined): string | null {
  const c = view.startCorrected;
  if (!c) return null;
  return OWN_COPY.correctedBy(c.by.membershipId === reader ? OWN_COPY.you : c.by.name, formatOfficeDay(c.at));
}

/**
 * Whether an item is one the hire or a leader ticks: it has no link, or its link does not complete it now —
 * a training link whose module the office no longer offers (D-orphan, P18.5-T3 AC-4). **An item its link
 * already completed is never ticked by hand**, offered or not: the record is the link's, sticky (ADR-0031),
 * and the server refuses a hand edit with 409 `ACTIVATION_ITEM_AUTOMATIC`.
 */
export const isManual = (item: ActivationItemProgress) =>
  !item.link?.live && !(item.done && item.source === 'link');

/** D-orphan: a manual item that still carries a link — the badge says *Ticked by hand*, as Settings does. */
export const isTickedByHandLink = (item: ActivationItemProgress) => isManual(item) && item.link !== null;

/**
 * Whether every item is done — the server's own test for the nav's amber check (`me.activation.complete`,
 * `done === total`), not the rounded `pct`, so the screen and the nav cannot disagree about it.
 */
export const isComplete = (view: Pick<ActivationView, 'done' | 'total'>) => view.done === view.total;

/** The earliest start date a leader may choose, from the office's today (the contract's bound). */
export function earliestStart(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d - START_DATE_BACK_DAYS));
  return at.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` with a four-digit year: a date somebody finished typing, not one they are halfway through. */
export const isWholeDate = (value: string) => /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value);

/** The date a start may be corrected to: whole, not after today, and within the bound. */
export function startDateAllowed(value: string, today: string): boolean {
  return isWholeDate(value) && value <= today && value >= earliestStart(today);
}

/** The bound's sentence, in the product's date. */
export const startDateRangeText = (today: string) => OWN_COPY.startDateRange(formatShortDay(earliestStart(today), { year: true }));
