import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { activationMessages } from '@/i18n/messages/activation';
import { newHiresMessages } from '@/i18n/messages/new-hires';
import { api } from './api-client';
import { formatOfficeDay, formatPercent, formatShortDay, OFFICE_TIME_ZONE } from './format';

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

/** The activation's words in a language (P18.98-T4): the hire's page, its shared parts, the coaching record's. */
const wordsIn = (language: Language) => messagesIn(activationMessages, language);

/** The roster's and one hire's words in a language (P18.98-T4): `/new-hires` and `/new-hires/[membershipId]`. */
const hiresIn = (language: Language) => messagesIn(newHiresMessages, language);

/** Both in English, the catalogue's source: the copy objects below, and every function here given no language. */
const EN = wordsIn(SOURCE_LANGUAGE);
const HIRES = hiresIn(SOURCE_LANGUAGE);

/**
 * **The prototype's strings, verbatim, in English** (D-copy) — the catalogue's source (`i18n/messages/activation.ts`,
 * `new-hires.ts`; P18.98-T4), in the shapes this module has always handed its callers and its spec. **A screen reads
 * the reader's language instead**: `useMessages(activationMessages)`, `useMessages(newHiresMessages)`. Read here by the
 * modules whose words have not moved yet — the coaching record (`activation-record.tsx`) and the Company template's link
 * badge (`template-editor.tsx`) — so they read English, as before, until theirs do.
 *
 * Two are rewritten as D-copy and OD-28 say: the graduation confirm speaks to the hire, without the demo's *"same as
 * when a real agent finishes"*. **Both titles are the nav items' words** since P18.95-T9 AC-2 (ADR-0167 §10, OD-205;
 * UI-027, *menu labels = page titles*): the prototype titled them *90-Day Activation* and *Your New Hires* under nav
 * items reading *Your 90-day activation* and *New hires* (`Overall.html:2638-2647`, `:10408-10409`). **Join date** is
 * one name for the one date (P18.96-T2 AC-5, ADR-0169 §7; UI-009; parity I-454), where the prototype said *Start date*
 * (`:3284`) and *Joined* (`:6734`). **Mark checklist complete** (P18.96-T6 AC-5, ADR-0173 §4; parity I-475) is the
 * prototype's *Mark activation complete →* (`:3285`), renamed so it cannot be read as the 3M result. A placeholder
 * holds no ⓘ, so the note's example spells out *joint field work* (P18.95-T9 AC-3; UI-028). `pctComplete` writes its
 * figure in Indonesian, as every caller of this object did before P18.98-T3.
 */
export const PROTOTYPE_COPY = {
  title: EN.title,
  subtitle: EN.subtitle,
  rosterTitle: HIRES.title,
  rosterSubtitle: HIRES.subtitle,
  progressHeading: EN.progressHeading,
  joinDate: EN.joinDate,
  graduate: EN.graduate,
  day: EN.day,
  completed: EN.completed,
  pctComplete: (pct: number) => EN.pctComplete({ pct: formatPercent(pct) }),
  aspect: EN.aspect,
  items: EN.items,
  status: EN.status,
  footer: EN.footer,
  showNoteAndDate: EN.showNoteAndDate,
  notePlaceholder: EN.notePlaceholder,
  auto: EN.auto,
  goTo: (label: string) => EN.goTo({ label }),
  graduateQuestion: EN.graduateQuestion,
  confirm: EN.confirm,
  cancel: EN.cancel,
  graduated: EN.graduated,
  directUnit: HIRES.directUnit,
  aabUnit: (name: string) => HIRES.aabUnit({ name }),
  // D-group's Fix: the prototype's form for the other rung the nearest leader may stand on.
  abUnit: (name: string) => HIRES.abUnit({ name }),
  name: HIRES.columns.name,
  /** A missing figure: a mark in no language. */
  none: '—',
  back: HIRES.detail.back,
  detailSubtitle: HIRES.detail.subtitle,
  detailHeading: HIRES.detail.heading,
  statusUpdated: HIRES.detail.statusUpdated,
  noteHeading: EN.noteHeading,
  noteHint: HIRES.note.hint,
  noteExample: HIRES.note.example,
  saveNote: HIRES.note.save,
  noteSaved: (name: string) => HIRES.note.saved({ name }),
  cardTitle: EN.record.title,
  doneNewActiveAgent: EN.record.doneNewActiveAgent,
  itemDone: EN.record.done,
  notDone: EN.record.notDone,
} as const;

/** The aspect pill's words (`:6547-6551`), in English. */
export const ASPECT_STATUS_LABEL: Record<AspectStatus, string> = EN.aspectStatus;

/** A new hire's 3M result in words (P18.96-T6; the client's report, R2), in English. */
export const ACTIVATION_3M_LABEL: Record<Activation3MResult, string> = HIRES.result3M;

/**
 * **The module's own strings, in English** — the states the prototype lacks (L-01), the attribution, the refusals'
 * frame — from the catalogue's source as `PROTOTYPE_COPY` is. **None of ADR-0084's six words** (D-copy): *office*,
 * *KPM*, *reports to*, *tagged to*, *untagged*, *unassigned*; `activation.spec.ts` holds every one of them to it.
 */
export const OWN_COPY = {
  loading: EN.loading,
  loadingRoster: HIRES.loading,
  loadingHire: HIRES.detail.loading,
  tryAgain: EN.tryAgain,
  noneTitle: EN.noneTitle,
  noneLine: EN.noneLine,
  graduatedTitle: EN.graduatedTitle,
  graduateLocked: (n: number) => EN.graduateLocked({ n }),
  graduatedLine: (on: string) => EN.graduatedLine({ on }),
  expiredTitle: EN.expiredTitle,
  expiredLine: (on: string) => EN.expiredLine({ on }),
  checklistElsewhere: EN.checklistElsewhere,
  ownCoaching: EN.ownCoaching,
  rosterEmpty: HIRES.empty,
  activation3MHeading: HIRES.activation3M,
  activation3MCounts: (activated: number, notActivated: number, inProgress: number) =>
    HIRES.counts({ activated, notActivated, inProgress }),
  /** A share over nobody decided: no figure, never 0% — said in words to a screen reader. */
  noFigure: '—',
  noFigureName: HIRES.noFigureName,
  joinMonth: HIRES.joinMonth,
  allMonths: HIRES.allMonths,
  byUnit: HIRES.byUnit,
  sectionInProgress: HIRES.sections.inProgress,
  sectionActivated: HIRES.sections.activated,
  sectionNotActivated: HIRES.sections.notActivated,
  sectionEmpty: HIRES.sectionEmpty,
  checklist: HIRES.columns.checklist,
  noChecklist: HIRES.noChecklist,
  firstSale: HIRES.columns.firstSale,
  result: HIRES.columns.result,
  actions: HIRES.columns.actions,
  leftOn: (on: string) => HIRES.leftOn({ on }),
  scheduleOneOnOne: HIRES.scheduleOneOnOne,
  scheduleOneOnOneName: (name: string) => HIRES.scheduleOneOnOneName({ name }),
  markLeft: HIRES.markLeft,
  markLeftName: (name: string) => HIRES.markLeftName({ name }),
  markLeftQuestion: (name: string) => HIRES.markLeftQuestion({ name }),
  markedLeft: (name: string) => HIRES.markedLeft({ name }),
  markLeftFailed: (why: string) => HIRES.markLeftFailed({ why }),
  hireNotFoundTitle: HIRES.detail.notFoundTitle,
  hireNotFoundLine: HIRES.detail.notFoundLine,
  closedGraduated: (by: string, on: string) => HIRES.detail.closedGraduated({ by, on }),
  closedExpired: (on: string) => HIRES.detail.closedExpired({ on }),
  coacheeNone: (name: string) => EN.record.coacheeNone({ name }),
  meNone: EN.record.meNone,
  autoTip: (completesWhen: string) => EN.autoTip({ completesWhen }),
  autoName: (completesWhen: string) => EN.autoName({ completesWhen }),
  byHand: EN.byHand,
  byHandTip: EN.byHandTip,
  byHandName: EN.byHandName,
  overdue: EN.overdue,
  dayOf: (day: string, window: number) => HIRES.dayOf({ day, of: window }),
  you: EN.you,
  tickedBy: (who: string, when: string) => EN.tickedBy({ who, when }),
  completedFrom: (label: string, who: string | null, when: string) =>
    (who ? EN.completedFromBy({ label, who, when }) : EN.completedFrom({ label, when })),
  completedAutomatically: (when: string) => EN.completedAutomatically({ when }),
  correctedBy: (who: string, when: string) => EN.correctedBy({ who, when }),
  startDateRange: (from: string) => HIRES.detail.startDateRange({ from }),
  startSaved: HIRES.detail.startSaved,
  noteFrom: (who: string, when: string) => EN.noteFrom({ who, when }),
  noteSavedBy: (who: string, when: string) => HIRES.note.savedBy({ who, when }),
  noteEmpty: HIRES.note.empty,
  saving: EN.saving,
  itemNoteName: (label: string) => EN.itemNoteName({ label }),
  itemDateName: (label: string) => EN.itemDateName({ label }),
  notSaved: (why: string) => EN.notSaved({ why }),
  completedFromData: (label: string, when: string) => EN.completedFrom({ label, when }),
  waitingForData: (who: string) => EN.waitingForData({ who }),
  fromData: (label: string) => EN.fromData({ label }),
  whichCase: EN.whichCase,
  newClosing: EN.newClosing,
  closingName: EN.closingName,
  closingDate: EN.closingDate,
  /** A closing to choose: its name and its day, joined — no word of ours. */
  closingOption: (name: string, when: string) => `${name} · ${when}`,
  noClosings: EN.noClosings,
  loadingClosings: EN.loadingClosings,
  logOneOnOne: EN.logOneOnOne,
  oneOnOneDate: EN.oneOnOneDate,
  oneOnOneNote: EN.oneOnOneNote,
  oneOnOnePlaceholder: EN.oneOnOnePlaceholder,
  saveRecord: EN.save,
  cancelRecord: EN.cancel,
  recordIncomplete: EN.recordIncomplete,
} as const;

/** What a badge says: its face, its accessible name and its tooltip. */
export interface BadgeWords {
  glyph: string;
  name: string;
  tip: string;
}

/**
 * **The link badge's words, in `language`** (P18.98-T4): ***Auto*** for a link that completes its item (T4 AC-4), its
 * tooltip and the end of its name the registry's sentence as the server sends it — on the hire's rows, the leader's,
 * and the office's checklist settings (P13-T3 AC-1, parity I-80). Its caller passes `useLanguage()`; English when
 * given none.
 */
export function autoBadge(completesWhen: string, language: Language = SOURCE_LANGUAGE): BadgeWords {
  const t = wordsIn(language);
  return { glyph: t.auto, name: t.autoName({ completesWhen }), tip: t.autoTip({ completesWhen }) };
}

/** ***Ticked by hand***: a link that does not complete its item — whether, never when (P13-T3 AC-1, parity I-80). */
export function byHandBadge(language: Language = SOURCE_LANGUAGE): BadgeWords {
  const t = wordsIn(language);
  return { glyph: t.byHand, name: t.byHandName, tip: t.byHandTip };
}

/** *From {label}*: what a data-backed item completes from, in the office's settings (P18.96-T7 G2), in `language`. */
export const fromDataWords = (label: string, language: Language = SOURCE_LANGUAGE) => wordsIn(language).fromData({ label });

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

/**
 * A unit's name on `/new-hires` (D-group): *Direct Unit*, *AAB: {name}* or *AB: {name}* — in the reader's `language`
 * (P18.98-T4; `useLanguage()`), English when given none.
 */
export function groupTitle(group: NewHireUnitRef, language: Language = SOURCE_LANGUAGE): string {
  const t = hiresIn(language);
  if (!group.leader || group.kind === 'direct') return t.directUnit;
  return group.kind === 'ab' ? t.abUnit({ name: group.leader.name }) : t.aabUnit({ name: group.leader.name });
}

/** A person as these lines name them: by name, or *you* for the reader. */
const whoOf = (person: ActivationPerson, reader: string | null | undefined, language: Language) =>
  (person.membershipId === reader ? wordsIn(language).you : person.name);

/**
 * Who ticked a done item and when, or which link completed it (OD-121, T4 AC-5): the attribution
 * marker's words, which are its accessible name too. `null` for an item that is not done.
 *
 * `reader` is the reader's membership, so their own tick reads *you*. **Its words in `language`, its day in
 * `figures`** (P18.98-T4): its caller passes `useLanguage()` and `useFigureLanguage()`; given neither, English words
 * and an Indonesian day, as before.
 */
export function attributionOf(
  item: ActivationItemProgress, reader: string | null | undefined, language: Language = SOURCE_LANGUAGE, figures?: Language,
): string | null {
  if (!item.done) return null;
  const t = wordsIn(language);
  const when = item.doneAt ? formatOfficeDay(item.doneAt, OFFICE_TIME_ZONE, figures) : '';
  const who = item.doneBy ? whoOf(item.doneBy, reader, language) : null;
  if (item.source === 'link') {
    // A data-backed item names its data, not a person (P18.96-T4 AC-2): *"Completed from Sales data · {date}"*.
    if (item.link?.form) return t.completedFrom({ label: item.link.label, when });
    if (!item.link) return t.completedAutomatically({ when });
    return who ? t.completedFromBy({ label: item.link.label, who, when }) : t.completedFrom({ label: item.link.label, when });
  }
  return who ? t.tickedBy({ who, when }) : null;
}

/**
 * **A data-backed item** (P18.96-T4): one of the three the office's sales and coaching data complete — *Close first
 * case independently*, *Reach Independent Agent milestone*, *Weekly 1-on-1 check-in* — which a hand tick opens a form
 * for. The server says which, through the link's `form`; nothing here knows the codes.
 */
export const isDataBacked = (item: ActivationItemProgress) => item.link?.form != null;

/**
 * Its source line (AC-2, AC-4): where it was completed from, or who ticked it and that it waits; `null` undone. Its
 * words in `language`, its day in `figures`, as `attributionOf`.
 */
export function sourceLineOf(
  item: ActivationItemProgress, reader: string | null | undefined, language: Language = SOURCE_LANGUAGE, figures?: Language,
): string | null {
  if (!item.done || !isDataBacked(item)) return null;
  if (item.waiting) {
    const who = item.doneBy ? whoOf(item.doneBy, reader, language) : wordsIn(language).you;
    return wordsIn(language).waitingForData({ who });
  }
  return attributionOf(item, reader, language, figures);
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

/** The correction's words, or `null` when nobody moved the date: in `language`, its day in `figures`. */
export function correctionOf(
  view: ActivationView, reader: string | null | undefined, language: Language = SOURCE_LANGUAGE, figures?: Language,
): string | null {
  const c = view.startCorrected;
  if (!c) return null;
  return wordsIn(language).correctedBy({ who: whoOf(c.by, reader, language), when: formatOfficeDay(c.at, OFFICE_TIME_ZONE, figures) });
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

/** The bound's sentence, in the product's date: its words in `language`, its day in `figures`. */
export const startDateRangeText = (today: string, language: Language = SOURCE_LANGUAGE, figures?: Language) =>
  hiresIn(language).detail.startDateRange({ from: formatShortDay(earliestStart(today), { year: true }, figures) });
