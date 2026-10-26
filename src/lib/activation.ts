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
  /** `null`: nowhere to go — a training module no longer offered (D-orphan); no *Go to* is drawn. */
  route: string | null;
  completesWhen: string;
  live: boolean;
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

/** A hire on the roster (`Overall.html:6750-6772`). */
export interface NewHireRow {
  hire: ActivationPerson;
  startDate: string;
  day: number;
  window: number;
  overdue: boolean;
  pct: number;
  firstCaseClosed: boolean;
}

/**
 * *Direct Unit*, or the nearest leader's unit below the reader (D-group): an AAB's, or — an AB under an
 * AB (ADR-0014) — an AB's, the card naming the rung (a Fix).
 */
export type NewHireGroupKind = 'direct' | 'aab' | 'ab';

export interface NewHireGroup {
  kind: NewHireGroupKind;
  leader: ActivationPerson | null;
  hires: NewHireRow[];
}

export interface NewHiresRoster {
  groups: NewHireGroup[];
  today: string;
}

/** What a saved note answers. */
export interface ActivationNoteSaved {
  note: ActivationNote;
}

/** What the hire's tick sends: the state, and their own note and date when they change one. */
export interface MyItemInput {
  done: boolean;
  note?: string | null;
  date?: string | null;
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

/** *Mark activation complete →* (OD-28): the hire's own, at 100%. */
export const graduateMyActivation = () =>
  api<ActivationView>('/activation/me/graduate', { method: 'POST' });

/** The leader's roster. A 404 means the reader reaches no open activation. */
export const readNewHires = () => api<NewHiresRoster>('/new-hires');

/** One hire's activation as a leader reads it — also what the coaching *Activation* tab reads. */
export const readNewHire = (membershipId: string) => api<ActivationView>(`/new-hires/${encodeURIComponent(membershipId)}`);

/** A leader's tick on a hire's manual item. */
export const saveHireItem = (membershipId: string, code: string, done: boolean) =>
  api<ActivationView>(`/new-hires/${encodeURIComponent(membershipId)}/items/${encodeURIComponent(code)}`, {
    method: 'PUT', body: { done },
  });

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
  // `Overall.html:10408-10409`
  title: '90-Day Activation',
  subtitle: 'Your first 90 days, checklist by checklist.',
  rosterTitle: 'Your New Hires',
  rosterSubtitle: "Track your new agents' 90-day activation progress.",
  // The hire's page (`:3280-3349`).
  progressHeading: 'Your activation progress',
  startDate: 'Start date',
  graduate: 'Mark activation complete →',
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
  graduateQuestion: 'Mark your activation complete? The 90-Day Activation menu will be removed.',
  confirm: 'Confirm',
  cancel: 'Cancel',
  graduated: 'Marked as tenured agent — 90-Day Activation removed from menu.',
  // The roster (`:6742-6783`).
  directUnit: 'Direct Unit',
  aabUnit: (name: string) => `AAB: ${name}`,
  // D-group's Fix: the prototype's form for the other rung the nearest leader may stand on.
  abUnit: (name: string) => `AB: ${name}`,
  name: 'Name',
  joined: 'Joined',
  progress: 'Progress',
  activeAgent: 'Active Agent',
  closedFirstCase: 'Closed first case',
  none: '—',
  // The detail (`:3367-3414`, `:6793-6794`, `:6869`, `:6891`).
  back: 'Back to Your New Hires',
  detailSubtitle: 'You can update their 90-Day Activation status, plus your coaching note.',
  detailHeading: 'Activation progress',
  statusUpdated: 'Activation status updated.',
  noteHeading: 'Coaching note',
  noteHint: 'Visible to this agent on their own 90-Day Activation page.',
  noteExample: "e.g. Great pace on prospecting — let's focus on booking your first JFW this week.",
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
  graduatedTitle: 'Your 90-day activation is complete.',
  graduatedLine: (on: string) => `You marked it complete on ${on}.`,
  expiredTitle: 'Your 90-day activation has ended.',
  expiredLine: (on: string) => `It ran for six months, until ${on}.`,
  checklistElsewhere: 'Your checklist stays on your own coaching page.',
  ownCoaching: 'Your own coaching',
  // `/new-hires` with nobody on it.
  rosterEmpty: 'No one you lead is in their 90-day activation right now.',
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
  // Attribution (OD-121, T4 AC-5).
  you: 'you',
  tickedBy: (who: string, when: string) => `Ticked by ${who} · ${when}`,
  completedFrom: (label: string, who: string | null, when: string) =>
    who ? `Completed from ${label} by ${who} · ${when}` : `Completed from ${label} · ${when}`,
  completedAutomatically: (when: string) => `Completed automatically · ${when}`,
  // The start date's correction (OD-118).
  correctedBy: (who: string, when: string) => `Start date corrected by ${who} · ${when}`,
  startDateRange: (from: string) => `Choose a date from ${from} to today.`,
  startSaved: 'Start date updated.',
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

/** The roster card's heading (D-group). */
export function groupTitle(group: NewHireGroup): string {
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
    return item.link ? OWN_COPY.completedFrom(item.link.label, who, when) : OWN_COPY.completedAutomatically(when);
  }
  return who ? OWN_COPY.tickedBy(who, when) : null;
}

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
