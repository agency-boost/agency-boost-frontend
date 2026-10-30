import type { SubPeriodTarget } from './activity';
import type { Lead } from './leads';
import { shortOfRung } from '@/components/ui/role-badge';
import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { coachingMessages, ENGLISH_PRONOUNS } from '@/i18n/messages/coaching';
import { api } from './api-client';
import { joinInFlight } from './in-flight';
import type { RatioDisplayUnit } from './ratio-format';

/**
 * Coaching (Phase 11, `docs/02-specs/functional/coaching.md`). **Every verdict is the server's**: the
 * roster's *Last 1:1* is `DAYS_SINCE_LAST_COACHING` and its *Status* is `GOAL_PACE_STATUS`, both
 * computed in the office's day. This file names the shapes and turns them into the prototype's words;
 * it does no date arithmetic, because a day counted in the browser's zone is the defect invariant §9
 * exists to prevent.
 *
 * **Its words are the catalogue's** (`i18n/messages/coaching.ts`, P18.98-T4): each function that writes one takes the
 * reader's `language` last — English, the source, when passed none, which its spec reads — and its caller passes
 * `useLanguage()`. A figure inside a sentence is written by the caller, in the figures' language, and handed in.
 */

/** The module's words in a language. */
const wordsIn = (language: Language) => messagesIn(coachingMessages, language);

/** `GOAL_PACE_STATUS`, with ADR-0080's state for a member who has no target this month. */
export type RosterStatus = 'on_track' | 'watch_closely' | 'needs_attention' | 'no_goal_set';

export interface RosterPerson {
  membershipId: string;
  name: string;
}

/** The member's rung on the company's ladder: its stable code, and the ladder's own label for it. */
export interface RosterRung {
  code: string;
  label: string;
}

/** The latest finalized session with this member, whoever led it. */
export interface LastOneOnOne {
  /** Whole days since it, in the office's calendar: 0 is today. */
  days: number;
  /** Its calendar day, `YYYY-MM-DD`, in the office's zone. */
  date: string;
  /** `days` is past the office's `coachingOverdueDays`. Decided by the server, never here. */
  overdue: boolean;
  /** Who led it; `null` when that membership is gone. */
  coach: RosterPerson | null;
}

/**
 * One person on the roster. Verdicts and dates only: **no count of any activity** (P11-T6 AC-6).
 * Its fields are spelled out rather than extended, and `rung` is a named type rather than an inline
 * one, so `contract.spec.ts` can read them: it reads an interface's body up to the first `}`.
 */
export interface RosterRow {
  membershipId: string;
  name: string;
  /** Their profile photo as a signed link (UI V1, UI-111); `null` or absent for none: the avatar draws initials. */
  photoUrl?: string | null;
  rung: RosterRung;
  /** 1 is a direct report; each level further down adds one. */
  depth: number;
  /** `null` until their first finalized session: *No 1:1 yet*. */
  lastOneOnOne: LastOneOnOne | null;
  status: RosterStatus;
}

/** A direct report on a leader rung, and their whole subtree in tree order, beneath them. */
export interface RosterUnit {
  head: RosterRow;
  /** A nested head is followed by its own members, one level deeper. Names A to Z within a level. */
  members: RosterRow[];
}

/** `GET /coaching/coachees`: everyone the reader coaches (ADR-0074), grouped as the prototype groups them. */
export interface Roster {
  /** The office's today, `YYYY-MM-DD`. */
  today: string;
  /** The office's `coachingOverdueDays`. */
  overdueAfterDays: number;
  /** The reader's direct reports on the agent rung. */
  directAgents: RosterRow[];
  units: RosterUnit[];
}

/** The reader's roster. A reader who coaches nobody gets an empty one, not an error. Not paginated. */
export const readRoster = () => api<Roster>('/coaching/coachees');

/** The pill's words, verbatim (`Overall.html:10624`), and ADR-0080's *No goal set*: the catalogue's English. */
export const ROSTER_STATUS_LABEL: Record<RosterStatus, string> = wordsIn(SOURCE_LANGUAGE).status;

/** A status's pill in the reader's `language` (P18.98-T4): *On track*, *Sesuai target*. */
export const rosterStatusLabel = (status: RosterStatus, language: Language = SOURCE_LANGUAGE): string =>
  wordsIn(language).status[status];

/**
 * *Last 1:1*, as the prototype words it (`Overall.html:10619-10623`): *No 1:1 yet*, *Today*, or
 * *{n} day ago* / *{n} days ago*, singular at one — in the reader's `language`, English when passed none.
 */
export function lastOneOnOneText(last: LastOneOnOne | null, language: Language = SOURCE_LANGUAGE): string {
  const t = wordsIn(language).last;
  if (last === null) return t.none;
  if (last.days === 0) return t.today;
  return t.daysAgo({ days: last.days });
}

/**
 * **The cell's words, *overdue* among them when it is** (P18.8-T15 AC-7; the client's UI review, UI-011):
 * *14 days ago · overdue*. Red was the only mark on screen, with *, overdue* told to a screen reader alone — and on a
 * phone that text wrapped onto a line of its own, *, overdue* with its stray comma. Said in words, the colour is no
 * longer the only cue. *No 1:1 yet* says it already.
 */
export function lastOneOnOneLine(last: LastOneOnOne | null, language: Language = SOURCE_LANGUAGE): string {
  const text = lastOneOnOneText(last, language);
  return last !== null && last.overdue ? wordsIn(language).last.overdue({ text }) : text;
}

/**
 * Red when there has been no 1:1 at all or the last one is overdue, green otherwise — the
 * prototype's `overdue` and `good`. The threshold is the office's, applied by the server.
 */
export function lastOneOnOneOverdue(last: LastOneOnOne | null): boolean {
  return last === null || last.overdue;
}

/** *Coaching →*, the person's *Coaching Session* tab: in `lib/hrefs.ts`, so a screen can link here without this module. */
export { coachingSessionHref } from './hrefs';

/*
 * ── The person shell (P11-T7) ───────────────────────────────────────────────────────────────────
 */

/** How somebody is referred to, as they set it on their own profile (`users.pronoun`, `they` by default). */
export type Pronoun = 'she' | 'he' | 'they';

/** How many people are below a coachee, and how many of those lead somebody themselves. */
export interface CoacheeDownline {
  members: number;
  leaders: number;
}

/**
 * `GET /coaching/coachees/:membershipId`: one person the reader coaches, as the person shell's header
 * draws them (`Overall.html:3972-3979`). **404 outside `COACH`**, as every subject read is, and the
 * read writes no audit entry: a name, a rung and a leader are what the roster already shows.
 */
export interface Coachee {
  membershipId: string;
  name: string;
  /** Their profile photo as a signed link (UI V1, UI-111); `null` or absent for none: the avatar draws initials. */
  photoUrl?: string | null;
  /** Their own choice, for the sentences the tabs write about them (*Leads that need her*). */
  pronoun: Pronoun;
  rung: RosterRung;
  /** Their leader; `null` when that membership is gone. */
  leader: RosterPerson | null;
  /** The reader is that leader: the prototype's *Direct unit*. */
  direct: boolean;
  downline: CoacheeDownline;
  /** The office's today, `YYYY-MM-DD`: the calendar the Goal Setting tab's year and *Edit again*'s window are read in. */
  today: string;
}

/**
 * One person the reader coaches. A 404 means they are not, or no longer, somebody the reader coaches.
 * The person shell's one read: an identical read made while it is out joins it (F5 of P11's final
 * walk), so StrictMode's second effect run sends no second request. Nothing writes a coachee, so no
 * joined read can be older than a write.
 */
export const readCoachee = (membershipId: string) =>
  joinInFlight(`GET /coaching/coachees/${membershipId}`, () =>
    api<Coachee>(`/coaching/coachees/${encodeURIComponent(membershipId)}`));

/**
 * The person shell's tabs, by their place in the address — **in the owner's order** (UI V1, UI-029): *Coaching Session ·
 * Activity · Leads · Goal Setting · Personal Summary · Activation · Training · Capability mapping*, the session first and
 * the default. *Leads* (`leads`) is the coachee's own leads, read-only — new with UI-029. *Capability mapping* keeps its
 * address, `leader-notes`; only its name changed.
 */
export type CoachingTab =
  | 'session' | 'activity' | 'leads' | 'goal-setting' | 'summary' | 'activation' | 'training' | 'leader-notes';

export const COACHING_TABS: readonly CoachingTab[] = [
  'session', 'activity', 'leads', 'goal-setting', 'summary', 'activation', 'training', 'leader-notes',
];

export const coachingTabHref = (membershipId: string, tab: CoachingTab) =>
  `/coaching/${encodeURIComponent(membershipId)}/${tab}`;

/** Which tab an address is on, or `null` for the person's own address and anything else. */
export function coachingTabOf(pathname: string | null, membershipId: string): CoachingTab | null {
  const prefix = `/coaching/${encodeURIComponent(membershipId)}/`;
  if (!pathname?.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length).split('/')[0];
  return COACHING_TABS.some((tab) => tab === rest) ? (rest as CoachingTab) : null;
}

/**
 * The line under the name: the rung, then whose unit (`Overall.html:3977`, *Agent · Direct unit*).
 *
 * *Direct unit* is the prototype's, for a member of the reader's own unit. Somebody further down is
 * in their own leader's unit, said in the prototype's word for it (ADR-0084: none of *office*, *KPM*,
 * *reports to*, *tagged to*, *untagged*, *unassigned*).
 */
export function coacheeUnitLine(
  coachee: Pick<Coachee, 'rung' | 'direct' | 'leader'>, language: Language = SOURCE_LANGUAGE,
): string {
  // The rung by its badge's name, *AAB · Direct unit* (P18.95-T9 AC-1, ADR-0167 §10).
  const rung = shortOfRung(coachee.rung);
  const t = wordsIn(language).unitLine;
  if (coachee.direct) return t.direct({ rung });
  if (coachee.leader) return t.leaders({ rung, leader: coachee.leader.name });
  return rung;
}

/**
 * The avatar's letters (`Overall.html:3974`, *RW*): the first and last names' first letters, or a
 * one-word name's first two. The rule the server derives every other avatar by (`initialsOf`,
 * `users/user.schema.ts`); the person read carries a name, not its initials.
 */
export function coacheeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Whose screen a leader has open inside the person shell: the coachee, and how a sentence about them
 * reads. The Summary and the goal calculator take it; without it, each is the reader's own screen.
 */
export interface CoacheeSubject {
  membershipId: string;
  pronoun: Pronoun;
}

/**
 * The words a sentence about somebody needs, by their pronoun — the prototype's coaching copy is
 * *Her sales activity targets*, *Leads that need her*, *At her current pace, she's tracking*
 * (`Overall.html:4052`, `:4058`, `:4115`), and *him* / *he* for a man (§8).
 */
export interface PronounForms {
  /** she · he · they */
  subject: string;
  /** her · him · them */
  object: string;
  /** her · his · their */
  possessive: string;
  /** *has* · *has* · *have*: *she hasn’t*, *they haven’t*. */
  have: string;
  /** What a present-tense verb ends in: *she logs*, *they log*. */
  s: string;
  /** *she’s* · *he’s* · *they’re*: *she’s tracking*. */
  isShort: string;
  /** *she’s* · *he’s* · *they’ve*: *she’s closed*. */
  hasShort: string;
}

/**
 * **English's** forms, the catalogue's (`ENGLISH_PRONOUNS`, `i18n/messages/coaching.ts`): a sentence about somebody is a
 * message, and in Indonesian a person is *dia* whatever their pronoun (§B.0 rule 8), so only English needs them.
 */
export const PRONOUN_FORMS: Record<Pronoun, PronounForms> = ENGLISH_PRONOUNS;

/** A sentence's first word: *she* → *She*. */
export const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/*
 * ── The session (P11-T5's lifecycle, P11-T8's workspace) ────────────────────────────────────────
 */

/**
 * Where a session is in its life (`functional/coaching.md`, *The lifecycle*): a draft never
 * finalized, a finalized one, or one reopened for a correction — editable again, its last finalized
 * version still the one that counts (ADR-0079).
 */
export type SessionStatus = 'draft' | 'finalized' | 'reopened';

/** The lead an item came from, for its *Leads · {name}* tag. */
export interface SessionLeadTag {
  leadId: string;
  name: string;
}

/**
 * One of last week's action items, as this session reviews it: the tick and the date are this
 * session's. Its nested shapes are named types, as the roster's are, so `contract.spec.ts` can read
 * every field.
 */
export interface LastWeekItem {
  itemId: string;
  text: string;
  /** `YYYY-MM-DD`, or `null` undated. */
  dueDate: string | null;
  /** `null` for a typed one. */
  lead: SessionLeadTag | null;
  done: boolean;
}

/**
 * *From leads (automatic)*: a coachee's lead with a next action date. Derived live while the session
 * is open, frozen at finalize (`functional/coaching.md`, *The draft*).
 */
export interface LeadAction {
  leadId: string;
  leadName: string;
  dueDate: string;
  /**
   * The lead's next-action note, or the server's *Follow up with {name}* (`Overall.html:11054-11059`).
   * The screen still says it should the server ever send an empty one.
   */
  text: string | null;
}

/** One of *Other action items*: typed in the session. */
export interface ActionItem {
  itemId: string;
  text: string;
  dueDate: string | null;
}

export interface CoachingTip {
  tipId: string;
  text: string;
}

/** The finalized session a draft reviews as *last week*. */
export interface LastWeekRef {
  sessionId: string;
  date: string;
}

/** `GET /coaching/sessions/:sessionId` — one session, as this reader may see it. */
export interface CoachingSession {
  sessionId: string;
  coachee: RosterPerson;
  coach: RosterPerson;
  status: SessionStatus;
  /** The pin every write sends back (`functional/coaching.md`, *Data contract*). */
  version: number;
  /** The office's calendar day of the first finalize; `null` until then. */
  date: string | null;
  startedAt: string;
  finalizedAt: string | null;
  finalizedBy: RosterPerson | null;
  /** The last day this reader may reopen it, `YYYY-MM-DD`; `null` when they may not at all. */
  reopenableUntil: string | null;
  /**
   * The date a new action item starts with (UI-060): the office's today plus a week, the server's. `null` where no row
   * can be added.
   */
  defaultDueDate: string | null;
  /** The finalized session this one reviews; `null` for a coachee's first. */
  lastWeek: LastWeekRef | null;
  lastWeekItems: LastWeekItem[];
  leadActions: LeadAction[];
  actionItems: ActionItem[];
  tips: CoachingTip[];
  /** What the 1:1 looked at, frozen at the first finalize; `null` until then. Never a live figure. */
  snapshot: SessionSnapshot | null;
  /** Every finalized version a reopen replaced, oldest first, with who reopened it, when and why. */
  earlier: EarlierVersion[];
}

/*
 * ── What finalize freezes (`functional/coaching.md`, *The snapshot*) ──────────────────────────────
 *
 * Each nested shape is a named type, as the roster's are, so `contract.spec.ts` can read every field.
 */

/** One period of the goal, as the Summary showed it the day of the 1:1. Money in IDR sen. */
export interface SnapshotPeriod {
  targetMinor: number | null;
  /** `null` when nothing was held yet: never a 0 in its place. */
  actualMinor: number | null;
  attainmentPct: number | null;
  gapMinor: number | null;
  targetMet: boolean;
}

/** Whose APE figure it was, and for which month. */
export interface SnapshotSource {
  provenance: 'imported' | 'corrected' | 'self_reported';
  month: string | null;
}

export interface SnapshotGoal {
  /** The year, `YYYY`. */
  period: string;
  /** The month, `YYYY-MM`. */
  month: string;
  currency: string;
  monthly: SnapshotPeriod;
  yearly: SnapshotPeriod;
  source: SnapshotSource;
}

/**
 * Whether a frozen goal has a target to be measured against. Without one the archive's Goal card and
 * the print both say *No goal set*: for a session that froze no goal, and for one whose goal has no
 * yearly target (F2 of P11's final walk), where the print had written *Not uploaded yet / —*.
 */
export function goalHasTarget<G extends { yearly: { targetMinor: number | null } }>(
  goal: G | null,
): goal is G & { yearly: G['yearly'] & { targetMinor: number } } {
  return !!goal && goal.yearly.targetMinor !== null;
}

/** One ratio on the coachee's rung, with the label it read that day. No side names: those are not frozen. */
export interface SnapshotRatioRow {
  code: string;
  label: string;
  comparison: 'gte' | 'band';
  displayUnit: RatioDisplayUnit;
  benchmark: number | null;
  value: number | null;
  share: number | null;
  status: 'success' | 'alert' | 'neutral';
  /**
   * The sides a balance leans between, as the live read names them; `null` on a rate. Absent on a
   * snapshot taken before the field existed, which then says how far it leans and not which way.
   */
  sides?: { numerator: string | null; denominator: string | null } | null;
}

/** The last 30 days' ratios, frozen. */
export interface SnapshotRatios {
  from: string;
  to: string;
  days: number;
  rows: SnapshotRatioRow[];
}

/** One of the three cascade codes over the last 7 days, against its pro-rated target. */
export interface SnapshotTarget {
  key: SubPeriodTarget['key'];
  code: string;
  logged: number;
  target: number | null;
}

export interface SnapshotSectionRow {
  code: string;
  label: string;
  count: number;
}

/** One of the office's summary tiles over the 7 days, with its rows. */
export interface SnapshotSection {
  code: string;
  label: string;
  total: number;
  rows: SnapshotSectionRow[];
}

/** The last 7 days' activity, frozen. */
export interface SnapshotActivity {
  from: string;
  to: string;
  targets: SnapshotTarget[];
  sections: SnapshotSection[];
}

/** What the 1:1 looked at: taken once, at the first finalize, and never again (ADR-0042). */
export interface SessionSnapshot {
  takenAt: string;
  goal: SnapshotGoal | null;
  ratios: SnapshotRatios | null;
  activity: SnapshotActivity | null;
}

/** A finalized version a reopen replaced, whole, with who reopened it, when and why (ADR-0079). */
export interface EarlierVersion {
  finalizedAt: string;
  finalizedBy: RosterPerson;
  reopenedAt: string;
  reopenedBy: RosterPerson;
  reason: string;
  lastWeekItems: LastWeekItem[];
  leadActions: LeadAction[];
  actionItems: ActionItem[];
  tips: CoachingTip[];
}

/** What was agreed in one version: the ticks, the next actions and the tips. */
export type Agreement = Pick<EarlierVersion, 'lastWeekItems' | 'leadActions' | 'actionItems' | 'tips'>;

/**
 * The version a session's record shows, and the versions before it, oldest first.
 *
 * A finalized session shows itself. A session under correction reads to its coach as the correction
 * in progress, with the version being corrected as the last of `earlier` (`functional/coaching.md`,
 * *Who reads a session*): the record is that version, and the correction is the workspace's to show.
 * A draft has agreed nothing yet, so it has no record.
 */
export function agreedVersions(session: CoachingSession): { agreed: Agreement; earlier: EarlierVersion[] } | null {
  if (session.status === 'draft') return null;
  const earlier = session.earlier ?? [];
  if (session.status === 'reopened') {
    const replaced = earlier.at(-1);
    return replaced ? { agreed: replaced, earlier: earlier.slice(0, -1) } : null;
  }
  return { agreed: session, earlier };
}

/** A row of *View past sessions*: one finalized session about the coachee. */
export interface PastSession {
  sessionId: string;
  date: string;
  coach: RosterPerson;
  actionItemCount: number;
  completedCount: number;
}

/** The session the workspace opens on. */
export interface SessionCurrent {
  sessionId: string;
  status: SessionStatus;
}

/** `GET /coaching/coachees/:membershipId/sessions`: what the workspace opens on, and the history. */
export interface SessionHistory {
  /** The office's today, `YYYY-MM-DD`. */
  today: string;
  /**
   * The reader's open draft with the coachee; else the session they are correcting; else the one they
   * finalized today; else `null`, and the workspace opens on *▶ Start coaching session*.
   */
  current: SessionCurrent | null;
  /** Every finalized session about the coachee this reader may read, newest first. */
  sessions: PastSession[];
}

/** What a draft save sends: the whole editable state, at the version it was read. */
export interface SessionDraftBody {
  version: number;
  lastWeekItems: { itemId: string; done: boolean; dueDate: string | null }[];
  actionItems: { itemId?: string; text: string; dueDate: string | null }[];
  tips: { tipId?: string; text: string }[];
}

/** What a draft save answers: the new version, and the rows with the ids the server gave new ones. */
export interface SessionDraftSaved {
  sessionId: string;
  version: number;
  actionItems: ActionItem[];
  tips: CoachingTip[];
}

/** The coachee's finalized sessions, and the session the workspace opens on. Not paginated. */
export const readSessionHistory = (membershipId: string) =>
  api<SessionHistory>(`/coaching/coachees/${encodeURIComponent(membershipId)}/sessions`);

/**
 * *▶ Start coaching session*: a new draft, with last week's items and tips carried forward — or, when
 * the reader already has one open with this coachee, that one (ADR-0081): a second *Start* resumes.
 */
export const startSession = (membershipId: string) =>
  api<CoachingSession>(`/coaching/coachees/${encodeURIComponent(membershipId)}/sessions`, { method: 'POST' });

export const readSession = (sessionId: string) =>
  api<CoachingSession>(`/coaching/sessions/${encodeURIComponent(sessionId)}`);

/**
 * `readSession` for the archive, which only reads: an identical read made while one is out joins it
 * rather than sending another (F5 of P11's final walk). The server audits each read by anybody who is
 * not the session's coachee, so StrictMode's second effect run, or a remount while the read is out,
 * would write a second entry. **Not for the workspace**, which reads after it writes and must never be
 * handed a read that started before the write.
 */
export const readSessionShared = (sessionId: string) =>
  joinInFlight(`GET /coaching/sessions/${sessionId}`, () => readSession(sessionId));

/** A draft save. A stale `version` is refused with `VERSION_CONFLICT`; a finalized session, `COACHING_SESSION_FINALIZED`. */
export const saveSessionDraft = (sessionId: string, body: SessionDraftBody) =>
  api<SessionDraftSaved>(`/coaching/sessions/${encodeURIComponent(sessionId)}`, { method: 'PUT', body });

/** Finalize, pinned. The prototype's five checks refuse with `COACHING_SESSION_INCOMPLETE` and `details.rule`. */
export const finalizeSession = (sessionId: string, version: number) =>
  api<CoachingSession>(`/coaching/sessions/${encodeURIComponent(sessionId)}/finalize`, { method: 'POST', body: { version } });

/** *Edit again*, with the reason the coachee will read (ADR-0079). Refused past the window. */
export const reopenSession = (sessionId: string, version: number, reason: string) =>
  api<CoachingSession>(`/coaching/sessions/${encodeURIComponent(sessionId)}/reopen`, { method: 'POST', body: { version, reason } });

/** A past session's archive (`/coaching/[membershipId]/archive/[sessionId]`). */
export const coachingArchiveHref = (membershipId: string, sessionId: string) =>
  `/coaching/${encodeURIComponent(membershipId)}/archive/${encodeURIComponent(sessionId)}`;

/**
 * The *Coaching Session* tab, opened on one session rather than on what the server would open it on:
 * the correction the archive's *Edit again* started, beside a draft that would otherwise win.
 */
export const sessionTabHref = (membershipId: string, sessionId: string) =>
  `${coachingTabHref(membershipId, 'session')}?session=${encodeURIComponent(sessionId)}`;

/*
 * ── The print (ADR-0077) ────────────────────────────────────────────────────────────────────────
 */

export interface PrintPerson {
  name: string;
}

/** Printed with its tick, as the prototype's export prints it. */
export interface PrintLastWeekItem {
  text: string;
  done: boolean;
}

/** IDR sen. `null` target for somebody with no goal, `null` actual when nothing was held yet. */
export interface PrintPeriod {
  targetMinor: number | null;
  actualMinor: number | null;
}

export interface PrintGoal {
  currency: string;
  monthly: PrintPeriod;
  yearly: PrintPeriod;
}

export interface PrintTip {
  text: string;
}

export interface PrintLeadAction {
  dueDate: string;
  /** The lead's note, or the server's sentence for a lead with none. */
  text: string;
  leadName: string;
}

export interface PrintActionItem {
  dueDate: string | null;
  text: string;
}

/**
 * `GET /coaching/sessions/:sessionId/print`: the latest finalized version of a session as the print
 * holds it, from what was frozen at finalize, dated the day it was held. Its own read, audited, and
 * holding no leader note (ADR-0077).
 */
export interface SessionPrint {
  sessionId: string;
  version: number;
  /** The day it was held, `YYYY-MM-DD`: never today's. */
  date: string;
  coachee: PrintPerson;
  coach: PrintPerson;
  lastWeekItems: PrintLastWeekItem[];
  /** `null` for a session that holds no snapshot. */
  goal: PrintGoal | null;
  tips: PrintTip[];
  leadActions: PrintLeadAction[];
  actionItems: PrintActionItem[];
}

/** *⬇ Download as PDF*'s read. A coach's never-finalized draft is `COACHING_SESSION_NOT_FINALIZED`. */
export const readSessionPrint = (sessionId: string) =>
  api<SessionPrint>(`/coaching/sessions/${encodeURIComponent(sessionId)}/print`);

/**
 * The print's goal line: *This month: {produced} / {target}*, in the one money formatter (F-02) — its figures in
 * `money`'s language, its words in `language`'s.
 */
export function printGoalLine(
  span: 'month' | 'year', period: PrintPeriod, money: (minor: number) => string, language: Language = SOURCE_LANGUAGE,
): string {
  return wordsIn(language).print.goalLine({
    period: span,
    actual: period.actualMinor === null ? null : money(period.actualMinor),
    target: period.targetMinor === null ? '—' : money(period.targetMinor),
  });
}

/** A lead's next action: its note, or *Follow up with {name}* where it has none (`Overall.html:11054-11059`). */
export const leadActionText = (action: { text: string | null; leadName: string }, language: Language = SOURCE_LANGUAGE) =>
  action.text || wordsIn(language).followUpWith({ name: action.leadName });

/*
 * ── The session's Leads card and the Leads tab (UI V1, UI-062, UI-029) ──────────────────────────
 */

/**
 * **How many leads the session's Leads card shows before *Tampilkan semua (n)*** (UI-062: *show the first 5*; fewer than
 * six, no toggle). A layout count, like a page size — not a domain constant.
 */
export const SESSION_LEADS_SHOWN = 5;

/**
 * **What a lead's next action is missing** (UI-062): `action` when it has neither a note nor a date — *Isi tindakan*,
 * which opens the lead sheet — `date` when it has a note and no date — *Isi tanggal*, which opens the date picker — and
 * `null` when it is dated. A lead with no date never drops out of the card for it (Ibu Shinta, the report's example).
 */
export type LeadGap = 'action' | 'date' | null;

export function leadGap(lead: Pick<Lead, 'nextActionDate' | 'nextActionNote'>): LeadGap {
  if (lead.nextActionDate) return null;
  return lead.nextActionNote?.trim() ? 'date' : 'action';
}

/**
 * **The Leads card's order** (UI-062): the leads missing a next action first (*Isi tindakan*, *Isi tanggal*), then the
 * overdue — the server's flag, in the office's days — then by next-action date, nearest first. A stable sort: leads that
 * tie keep the order the server sent. Compares the stored `YYYY-MM-DD` strings; it counts no days.
 */
export function sessionLeadOrder<L extends Pick<Lead, 'nextActionDate' | 'nextActionNote' | 'flags'>>(
  leads: readonly L[],
): L[] {
  const rank = (lead: L) => (leadGap(lead) !== null ? 0 : lead.flags.includes('overdue') ? 1 : 2);
  return [...leads].sort((a, b) => rank(a) - rank(b) || (a.nextActionDate ?? '').localeCompare(b.nextActionDate ?? ''));
}

/** *{i}. {Oct 3} — {note} (Leads: {name})* (`Overall.html:11178`). */
export const printLeadActionLine = (
  i: number, action: PrintLeadAction, day: (d: string) => string, language: Language = SOURCE_LANGUAGE,
) => wordsIn(language).print.leadLine({
  n: i + 1, day: day(action.dueDate), text: leadActionText(action, language), lead: action.leadName,
});

/** *{i}. {Oct 7} — {text}*, with no date part when it has none (`Overall.html:11182`). */
export const printActionLine = (i: number, item: PrintActionItem, day: (d: string) => string) =>
  `${i + 1}. ${item.dueDate ? `${day(item.dueDate)} — ` : ''}${item.text}`;

/*
 * ── `/coaching/me` (ADR-0078, ADR-0088) ─────────────────────────────────────────────────────────
 */

/** A finalized session the reader led with somebody they no longer coach: theirs to read, never to change. */
export interface LedSession {
  sessionId: string;
  date: string;
  coachee: RosterPerson;
  actionItemCount: number;
  completedCount: number;
}

/**
 * `GET /coaching/me/sessions`: the finalized sessions about the reader, newest first, each with who led
 * it; and the ones they led with somebody they no longer coach (ADR-0088). Not paginated, not audited.
 */
export interface MySessions {
  sessions: PastSession[];
  ledFormerly: LedSession[];
}

export const readMySessions = () => api<MySessions>('/coaching/me/sessions');

/** The reader's own coaching, on one session: the finalize notice's address (P11-T10 AC-8). */
export const myCoachingHref = (sessionId?: string) =>
  (sessionId ? `/coaching/me?session=${encodeURIComponent(sessionId)}` : '/coaching/me');

/** A first name, for *Coaching tips from Wilson* (`Overall.html:4532`). */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/** A history row's summary, as the prototype words it: *3 action items · 1 completed* (`Overall.html:10688`). */
export const pastSessionSummary = (
  session: Pick<PastSession, 'actionItemCount' | 'completedCount'>, language: Language = SOURCE_LANGUAGE,
) => wordsIn(language).pastSummary({ items: session.actionItemCount, completed: session.completedCount });

/** `COACHING_SESSION_INCOMPLETE`'s `details.rule`: the first of the prototype's five checks that failed. */
export type FinalizeRule =
  | 'NO_ACTION_ITEM' | 'EMPTY_TIP' | 'EMPTY_ACTION_ITEM' | 'UNDATED_ACTION_ITEM' | 'LEAD_THIS_MONTH_UNDATED';

/**
 * The prototype's own sentence for a refused finalize (`Overall.html:11111-11117`), from the rule the
 * server named — never parsed out of its message. `null` for a rule this screen does not know, which
 * then shows the server's own words.
 */
export function finalizeRefusal(
  details: Record<string, unknown> | undefined, language: Language = SOURCE_LANGUAGE,
): string | null {
  const t = wordsIn(language).refusal;
  switch (details?.rule) {
    case 'NO_ACTION_ITEM':
    case 'EMPTY_TIP':
    case 'EMPTY_ACTION_ITEM':
    case 'UNDATED_ACTION_ITEM':
      return t[details.rule];
    case 'LEAD_THIS_MONTH_UNDATED':
      return t.LEAD_THIS_MONTH_UNDATED({
        name: typeof details.leadName === 'string' && details.leadName ? details.leadName : null,
      });
    default: return null;
  }
}

/**
 * Whether *Edit again* is past its window: the office's today is after the last day the reader could
 * reopen it. Both are the server's calendar days, compared as `YYYY-MM-DD` — no clock is read here.
 */
export const reopenWindowClosed = (today: string, reopenableUntil: string | null) =>
  reopenableUntil !== null && today > reopenableUntil;

/*
 * ── Leader Notes (P11-T9) ───────────────────────────────────────────────────────────────────────
 */

/** A catalog row's standing: an archived one still renders where it was ticked, and is ticked anew nowhere. */
export type CapabilityStatus = 'active' | 'archived';

/** A milestone, or one item of a skill grid, as the profile read carries it. */
export interface CapabilityRow {
  code: string;
  label: string;
  displayOrder: number;
  status: CapabilityStatus;
}

/** A rung of the ladder. `stageOrder` is how senior it is, `displayOrder` only where it is drawn. */
export interface CapabilityStageRow {
  code: string;
  label: string;
  displayOrder: number;
  status: CapabilityStatus;
  stageOrder: number;
  /** What must be ticked to be at this stage, cumulatively, by milestone code. */
  requiredMilestoneCodes: string[];
}

/** One of the *Skill tracker*'s sections. */
export interface CapabilityGridRow {
  code: string;
  label: string;
  displayOrder: number;
  status: CapabilityStatus;
  /** Applies only to somebody with people below them (`Overall.html:4364-4372`). */
  requiresDownline: boolean;
  items: CapabilityRow[];
}

/**
 * The catalog **as the profile read carries it, archived rows included** (P11-T9 AC-3) — not the
 * config snapshot, whose type has no `status`: an item the office has since archived still renders on
 * a profile that ticked it.
 */
export interface CapabilityProfileCatalog {
  stages: CapabilityStageRow[];
  milestones: CapabilityRow[];
  grids: CapabilityGridRow[];
}

/**
 * `GET /coaching/coachees/:membershipId/profile`: the *Capability mapping* and the *Skill tracker*, one
 * profile per coachee, shared by their current coaches. **404 outside `COACH`**, and the coachee never
 * reads it.
 */
export interface CoachingProfile {
  catalog: CapabilityProfileCatalog;
  milestoneCodes: string[];
  skillCodes: string[];
  /** The stage the server derived from the ticks; `null` below the first. Never worked out here. */
  stageCode: string | null;
  /** 0 before the first save. Every save sends it back. */
  version: number;
  updatedAt: string | null;
  updatedBy: RosterPerson | null;
}

/** A profile save: the whole tick set, at the version it was read. */
export interface CoachingProfileBody {
  version: number;
  milestoneCodes: string[];
  skillCodes: string[];
}

/** What a profile save answers: the new version, and the stage the server derived. */
export interface CoachingProfileSaved {
  version: number;
  stageCode: string | null;
  updatedAt: string;
}

export const readCoachingProfile = (membershipId: string) =>
  api<CoachingProfile>(`/coaching/coachees/${encodeURIComponent(membershipId)}/profile`);

/**
 * A profile save. Two coaches ticking at once: the second is `VERSION_CONFLICT`; an item archived
 * since it was read and ticked anew, `CONFIG_ARCHIVED`.
 */
export const saveCoachingProfile = (membershipId: string, body: CoachingProfileBody) =>
  api<CoachingProfileSaved>(`/coaching/coachees/${encodeURIComponent(membershipId)}/profile`, { method: 'PUT', body });

/** The reader's own note about the coachee. */
export interface MyLeaderNote {
  noteId: string;
  text: string;
  version: number;
  updatedAt: string;
}

/** A note somebody below the reader wrote about the coachee: read-only here (ADR-0073). */
export interface LeaderNote {
  noteId: string;
  author: RosterPerson;
  text: string;
  updatedAt: string;
}

/**
 * `GET /coaching/coachees/:membershipId/leader-notes`: what the reader may read about the coachee —
 * their own note and those somebody below them wrote. **Never the coachee's to read**; refused in a
 * support session.
 */
export interface LeaderNotes {
  mine: MyLeaderNote | null;
  others: LeaderNote[];
}

/** A note save: the reader's own note, at the version it was read (0 for a first one). Blank is allowed. */
export interface LeaderNoteBody {
  version: number;
  text: string;
}

export interface LeaderNoteSaved {
  noteId: string;
  version: number;
  updatedAt: string;
}

/**
 * The longest note the server keeps (`functional/coaching.md`, *Data contract*). A validation limit, not
 * a domain constant (invariant §7): its source is the backend's `NOTE_LIMITS.TEXT_MAX`
 * (`coaching-profile.dto.ts`), which OpenAPI carries as `maxLength`; `contract.spec.ts` is where a drift shows.
 */
export const LEADER_NOTE_MAX = 4000;

export const readLeaderNotes = (membershipId: string) =>
  api<LeaderNotes>(`/coaching/coachees/${encodeURIComponent(membershipId)}/leader-notes`);

/** Save the reader's own note. Pinned: a stale version is `VERSION_CONFLICT`. */
export const saveLeaderNote = (membershipId: string, body: LeaderNoteBody) =>
  api<LeaderNoteSaved>(`/coaching/coachees/${encodeURIComponent(membershipId)}/leader-notes`, { method: 'PUT', body });

const byDisplayOrder = <T extends { displayOrder: number }>(rows: readonly T[]) =>
  [...rows].sort((a, b) => a.displayOrder - b.displayOrder);

/**
 * The ladder's stages as drawn, in the office's display order: the active ones, and an archived one
 * only while it is the coachee's current stage. Its number on screen is its place here.
 */
export function ladderStages(catalog: CapabilityProfileCatalog, stageCode: string | null): CapabilityStageRow[] {
  return byDisplayOrder(catalog.stages).filter((s) => s.status === 'active' || s.code === stageCode);
}

/**
 * A stage's milestones as drawn, in the milestones' display order: the active ones, and an archived
 * one only where it is ticked. A milestone is one code, so one ticked is ticked in every stage that
 * lists it (`Overall.html:11208-11222`).
 */
export function stageMilestones(
  stage: CapabilityStageRow, catalog: CapabilityProfileCatalog, ticked: ReadonlySet<string>,
): CapabilityRow[] {
  const required = new Set(stage.requiredMilestoneCodes);
  return byDisplayOrder(catalog.milestones)
    .filter((m) => required.has(m.code) && (m.status === 'active' || ticked.has(m.code)));
}

/**
 * The *Capability mapping* tag (`Overall.html:4349`, `:11221`): *Current: {stage}*, or *Not yet at
 * {first stage}* below the first — the most junior active stage by `stageOrder`, never by where it is
 * drawn. The stage is the server's.
 */
export function capabilityTag(
  catalog: CapabilityProfileCatalog, stageCode: string | null, language: Language = SOURCE_LANGUAGE,
): string | null {
  const t = wordsIn(language).capability;
  if (stageCode !== null) {
    const current = catalog.stages.find((s) => s.code === stageCode);
    return current ? t.current({ stage: current.label }) : null;
  }
  const active = catalog.stages.filter((s) => s.status === 'active');
  const first = [...(active.length ? active : catalog.stages)].sort((a, b) => a.stageOrder - b.stageOrder)[0];
  return first ? t.notYet({ stage: first.label }) : null;
}

/** The *Skill tracker*'s sections as drawn: the active ones, and an archived one only where an item of it is ticked. */
export function trackerGrids(catalog: CapabilityProfileCatalog, ticked: ReadonlySet<string>): CapabilityGridRow[] {
  return byDisplayOrder(catalog.grids)
    .filter((g) => g.status === 'active' || g.items.some((i) => ticked.has(i.code)));
}

/** A section's items as drawn: the active ones, and an archived one only where it is ticked. */
export function gridItems(grid: CapabilityGridRow, ticked: ReadonlySet<string>): CapabilityRow[] {
  return byDisplayOrder(grid.items).filter((i) => i.status === 'active' || ticked.has(i.code));
}

/**
 * The note a downline section carries when it does not apply (`Overall.html:4366`, `:4371`), in the
 * coachee's pronoun; `null` when it applies. *Developing downline leader* needs somebody below them who
 * leads somebody; any other section that requires a downline, anybody below them at all.
 */
export function gridNotApplicable(
  grid: CapabilityGridRow, downline: CoacheeDownline, pronoun: Pronoun, language: Language = SOURCE_LANGUAGE,
): string | null {
  if (!grid.requiresDownline) return null;
  const t = wordsIn(language).notApplicable;
  if (grid.code === 'DEVELOPING_DOWNLINE_LEADER') {
    return downline.leaders > 0 ? null : t.leaders({ pronoun });
  }
  return downline.members > 0 ? null : t.agents({ pronoun });
}
