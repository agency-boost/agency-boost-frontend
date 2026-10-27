'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { DownloadPdfButton } from '@/components/coaching-print';
import {
  ActivityPanel, byDueDate, DateTag, EditAgainButton, EMPTY_LINE, FinalizedBadge, FromLeadTag, GoalRow, GROUP_LABEL,
  NumberDot, RatiosPanel, ReopenDialog,
} from '@/components/coaching-parts';
import { useSessionHistoryPrefetch } from '@/components/coaching-person';
import { LeadsTable } from '@/components/leads-table';
import { SummaryCard } from '@/components/personal-summary';
import { Button, ErrorBanner, TextInput } from '@/components/ui/field';
import { REMOVED_ON_PHONE, TAP_HEIGHT, TEXT_TAP } from '@/components/ui/phone';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { InlineSaveField, InlineSaveStatus, useInlineSave, type InlineSaveStatusProps } from '@/components/ui/inline-save-status';
import { Toast, useToast } from '@/components/ui/toast';
import {
  readActivityRatios, readActivitySummary, type ActivityRatios, type ActivitySummary,
} from '@/lib/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { CONFIRMED, withDetail } from '@/lib/confirmations';
import { cn } from '@/lib/cn';
import {
  capitalized, coachingArchiveHref, finalizeRefusal, finalizeSession, pastSessionSummary, PRONOUN_FORMS,
  readSession, readSessionHistory, reopenWindowClosed, saveSessionDraft, startSession,
  type Coachee, type CoachingSession, type LeadAction, type SessionDraftBody, type SessionHistory,
} from '@/lib/coaching';
import { formatCalendarDayLong, formatRupiahCompact, formatShortDay } from '@/lib/format';
import {
  goalInputsOf, groupDigits, parseDigits, readGoal, saveGoal, toMajor, toMinor,
} from '@/lib/goals';
import type { Lead } from '@/lib/leads';
import { useCan, useSession } from '@/lib/session';
import { readSummary, type Summary } from '@/lib/summary';

/**
 * A coachee's *Coaching Session* tab (`Overall.html:4167-4319`, logic `:10666-11187`; P11-T8): the
 * 1-on-1 itself, inside the person shell.
 *
 * **What it opens on is the server's** (`GET /coaching/coachees/:membershipId/sessions`, *What the
 * workspace opens on*): the reader's open draft with this person, else the session they are
 * correcting, else the one they finalized today, else the prototype's pre-start state, *▶ Start
 * coaching session*. Nothing is read about the person — no goal, no ratios, no leads — until a
 * session is open, because each of those reads is audited (roles §3.5) and the pre-start state shows
 * none of them.
 *
 * **The draft is the server's record, saved as it is edited** (`functional/coaching.md`, *The
 * draft*): each change to last week's ticks and dates, the action items and the tips sends the whole
 * editable state with the version it was read at, one save at a time. A save another device has moved
 * past is refused with `VERSION_CONFLICT`; the screen reads the session again and says so in one line.
 * Typing writes nothing until the box is left, as the prototype's blur handlers do.
 *
 * **Every figure is read live** while the session is open — the Goal card from the coachee's Summary,
 * the Ratios card on their rung, the Activity card's last 7 days against pro-rated targets — and each
 * card fails in its own place. Finalize freezes what the server snapshots; nothing here reads a
 * snapshot (*A snapshot is evidence, not duplication*): the archive does.
 *
 * **The reads go out together** (P11-T8's browser walk). The history is read beside the person, when
 * the shell starts it (`useSessionHistoryPrefetch`); once it names the session to open, the cards'
 * reads — the Summary, the ratios, the last 7 days, the leads — go out beside the session's own, since
 * each needs only the person. Not before: the pre-start state reads nothing about the person.
 *
 * **What it opens on** is the server's `current`, unless the address names a session (`?session=`):
 * the correction the archive's *Edit again* started, which a draft open beside it would otherwise hide
 * (`functional/coaching.md`, *Reopen*; parity L-64).
 *
 * **Finalized, it locks what the prototype locks** (`Overall.html:1389-1417`): the inputs become
 * text, the add and remove controls go, the annual target is no longer a control and the Leads card's
 * controls go inert. Past sessions, the closed leads and the Activity drill still open, and
 * *⬇ Download as PDF* prints the frozen session (ADR-0077).
 *
 * Coaching's own strings use none of ADR-0084's six words, and none names a phase, an id or a code.
 */
export function SessionWorkspace({ coachee, opening }: { coachee: Coachee; opening?: string }) {
  const { me } = useSession();
  const myMembership = me?.membership?.membershipId;
  const canStart = useCan('coaching_session:create');
  const canEdit = useCan('coaching_session:edit');
  const canFinalize = useCan('coaching_session:finalize');
  const canReopen = useCan('coaching_session:reopen');
  const canSetGoal = useCan('goal:update');
  const { toast, show } = useToast();
  const takePrefetched = useSessionHistoryPrefetch();
  const { membershipId } = coachee;

  const [history, setHistory] = useState<SessionHistory | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [session, setSession] = useState<CoachingSession | null>(null);
  /** The session being opened, known before it arrives: the cards read beside it. */
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<ApiError | null>(null);
  /** The one line a version conflict leaves: the session changed somewhere else and was read again. */
  const [reloaded, setReloaded] = useState(false);
  /** Each annual target saved here: the Activity card's pro-rated targets follow the goal. */
  const [goalSaves, setGoalSaves] = useState(0);

  const draft = useSessionDraft();
  const { reset, onConflict } = draft;

  /** Show a session as the server answered it, and start editing from there. */
  const open = useCallback((next: CoachingSession) => {
    setSession(next);
    reset(next);
  }, [reset]);

  const refreshHistory = useCallback(async () => {
    const next = await readSessionHistory(membershipId);
    setHistory(next);
    return next;
  }, [membershipId]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const historyRead = takePrefetched?.(membershipId) ?? readSessionHistory(membershipId);
        // A session the address names goes out with the history; its failure is the one awaited below.
        const named = opening ? readSession(opening) : null;
        named?.catch(() => undefined);
        const opened = await historyRead;
        if (!live) return;
        setHistory(opened);
        const id = opening ?? opened.current?.sessionId ?? null;
        if (!id) return;
        setOpeningId(id);
        const current = await (named ?? readSession(id));
        if (live) open(current);
      } catch (err) {
        if (live) setError(toDisplayError(err));
      }
    })();
    return () => { live = false; };
  }, [membershipId, opening, open, takePrefetched]);

  /** Somebody else's write won: read the session again, and say so. */
  const reload = useCallback(async () => {
    if (!session) return;
    try {
      open(await readSession(session.sessionId));
      setReloaded(true);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [session, open]);

  useEffect(() => onConflict(reload), [onConflict, reload]);

  async function start() {
    setStarting(true);
    setStartError(null);
    try {
      const started = await startSession(membershipId);
      setOpeningId(started.sessionId);
      open(started);
      /*
       * *Session started ✓* (P18.95-T1 AC-6, ADR-0167 §5; UI-008), and the prototype's own sentence after it
       * for what was carried; with no session before this one, nothing was.
       */
      show(withDetail(
        CONFIRMED.sessionStarted,
        started.lastWeek ? 'unfinished items and tips from last week carried forward.' : null,
      ));
    } catch (err) {
      setStartError(toDisplayError(err));
    } finally {
      setStarting(false);
    }
  }

  const mine = session !== null && session.coach.membershipId === myMembership;
  const finalized = session?.status === 'finalized';
  const locked = !session || finalized || !mine || !canEdit;
  const shownId = session?.sessionId ?? openingId;

  /**
   * After a lead write, *From leads (automatic)* may no longer be what the leads say — a date moved, a
   * note changed, a lead was named. While the session is open it is derived on every read, so it is
   * read again then, and only then: each read of the session is audited.
   */
  const leadWritten = useCallback(async (lead: Lead) => {
    if (!session || session.status === 'finalized' || !leadActionsStale(session.leadActions, lead)) return;
    try {
      const fresh = await readSession(session.sessionId);
      setSession((s) => (s && s.sessionId === fresh.sessionId ? { ...s, leadActions: fresh.leadActions } : s));
    } catch { /* the list stays as it was; the next read brings it up to date */ }
  }, [session]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SessionHeader coachee={coachee} history={history} session={session} />

      {error && <ErrorBanner {...error} />}
      {!history && !error && <SessionSkeleton />}

      {history && !shownId && !error && (
        canStart ? (
          <StartCard starting={starting} error={startError} onStart={() => void start()} />
        ) : null
      )}

      {history && shownId && !error && (
        <>
          {reloaded && (
            <p role="status" className="rounded-md border border-hairline bg-base px-3.5 py-2.5 text-sm text-navy">
              This session was changed somewhere else, so it has been read again.
            </p>
          )}
          {draft.error && <ErrorBanner {...draft.error} />}

          {!(session && draft.state) && <AgreementSkeleton />}
          {session && draft.state && session.lastWeek && (
            <LastWeekCard session={session} draft={draft} locked={locked} />
          )}

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <GoalCard
              coachee={coachee}
              sessionId={shownId}
              editable={!locked && canSetGoal}
              onSaved={() => {
                setGoalSaves((n) => n + 1);
                show('Goal updated — reflected across both tabs.');
              }}
            />
            <RatiosCard coachee={coachee} />
          </div>

          <ActivityCard coachee={coachee} refresh={goalSaves} />

          <SummaryCard id="session-leads" title="Leads" className="min-w-0">
            <LeadsTable
              filters
              offerDelete={false}
              owner={membershipId}
              readOnly={locked}
              caption={`${capitalized(PRONOUN_FORMS[coachee.pronoun].possessive)} leads`}
              onNotice={show}
              onWrite={(lead) => void leadWritten(lead)}
            />
          </SummaryCard>

          {session && draft.state && (
            <>
              <TipsCard draft={draft} locked={locked} />
              <NextActionsCard draft={draft} leadActions={session.leadActions} locked={locked} today={history.today} />

              <FinalizeCard
                coachee={coachee}
                session={session}
                today={history.today}
                draft={draft}
                canFinalize={mine && canFinalize}
                canReopen={canReopen}
                showCoach={!mine}
                onFinalized={async (next) => {
                  open(next);
                  setReloaded(false);
                  show('Session finalized — this coaching is now marked done, and locked to view-only.');
                  await refreshHistory().catch(() => undefined);
                }}
                onReopened={async (next) => {
                  open(next);
                  setReloaded(false);
                  show('Reopened for editing — finalize again when you’re done.');
                  await refreshHistory().catch(() => undefined);
                }}
                onConflict={reload}
              />
            </>
          )}
        </>
      )}

      <Toast toast={toast} />
    </div>
  );
}

/** Whether a lead's write leaves *From leads (automatic)* saying something the lead no longer does. */
export function leadActionsStale(actions: readonly LeadAction[], lead: Pick<Lead, 'id' | 'name' | 'nextActionDate' | 'nextActionNote'>): boolean {
  const entry = actions.find((a) => a.leadId === lead.id);
  if (!lead.nextActionDate) return entry !== undefined;
  if (!entry) return true;
  return entry.dueDate !== lead.nextActionDate
    || entry.leadName !== lead.name
    || (lead.nextActionNote !== null && entry.text !== lead.nextActionNote);
}

/*
 * ── The draft ───────────────────────────────────────────────────────────────────────────────────
 */

interface DraftAction { key: string; itemId?: string; text: string; dueDate: string | null }
interface DraftTip { key: string; tipId?: string; text: string }
interface DraftLastWeek { itemId: string; done: boolean; dueDate: string | null }

interface Draft {
  lastWeek: DraftLastWeek[];
  actions: DraftAction[];
  tips: DraftTip[];
}

let drafted = 0;
/** A key for a row the server has not named yet. Kept once it is named, so the row keeps its focus. */
const newKey = () => `new-${(drafted += 1)}`;

function draftOf(session: CoachingSession): Draft {
  return {
    lastWeek: session.lastWeekItems.map((i) => ({ itemId: i.itemId, done: i.done, dueDate: i.dueDate })),
    actions: session.actionItems.map((a) => ({ key: a.itemId, itemId: a.itemId, text: a.text, dueDate: a.dueDate })),
    tips: session.tips.map((t) => ({ key: t.tipId, tipId: t.tipId, text: t.text })),
  };
}

/** The draft as the server takes it: the whole editable state. */
function bodyOf(draft: Draft): Omit<SessionDraftBody, 'version'> {
  return {
    lastWeekItems: draft.lastWeek.map(({ itemId, done, dueDate }) => ({ itemId, done, dueDate })),
    actionItems: draft.actions.map((a) => ({ ...(a.itemId ? { itemId: a.itemId } : {}), text: a.text, dueDate: a.dueDate })),
    tips: draft.tips.map((t) => ({ ...(t.tipId ? { tipId: t.tipId } : {}), text: t.text })),
  };
}

/** What a save would change, by row and not by id: a row the server has just named is not a change. */
const snapshotOf = (draft: Draft) => JSON.stringify([
  draft.lastWeek,
  draft.actions.map(({ key, text, dueDate }) => [key, text, dueDate]),
  draft.tips.map(({ key, text }) => [key, text]),
]);

interface Held {
  sessionId: string;
  version: number;
  draft: Draft;
  /** The snapshot the server last accepted. */
  saved: string;
}

export interface SessionDraft {
  state: Draft | null;
  error: ApiError | null;
  reset: (session: CoachingSession) => void;
  /** Change the draft on screen, without saving: typing. */
  change: (fn: (draft: Draft) => Draft) => void;
  /**
   * Change it and save: a tick, a date, a row removed. With `field`, that field's row says *Saving… →
   * Saved ✓* (P18.95-T1 AC-5); a row removed has no field left to say it beside.
   */
  commit: (fn: (draft: Draft) => Draft, field?: string) => void;
  /**
   * Save whatever is unsaved, one save at a time. Resolves `true` once saved, `false` when a save was
   * refused (the banner says why), `null` when the session was read again under it (a conflict, a finalize
   * elsewhere) and the draft it held is gone.
   */
  save: () => Promise<boolean | null>;
  /** A text field left: saved, with its confirmation, **when anything is unsaved** — an untouched box says nothing. */
  saveField: (field: string) => void;
  /** A field's *Saving…*, *Saved ✓* or *Couldn't save — retry* (P18.95-T1 AC-5). */
  status: (field: string) => InlineSaveStatusProps;
  version: () => number;
  onConflict: (handler: () => void) => void;
}

/**
 * The draft and its saves. **One save in flight at a time**, each carrying the version the last one
 * answered; a change made while one is out is sent by the next, whole. Nothing is sent when nothing
 * changed, so leaving a box untouched writes nothing.
 */
function useSessionDraft(): SessionDraft {
  const [state, setState] = useState<Draft | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const held = useRef<Held | null>(null);
  const inFlight = useRef<Promise<boolean | null> | null>(null);
  const again = useRef(false);
  const conflict = useRef<() => void>(() => undefined);
  /**
   * **Each field says its save** (P18.95-T1 AC-5, ADR-0167 §5; UI-007). The draft is saved whole, so a save
   * that lands has saved every field: one that failed before it has nothing unsaved left, and its
   * *Couldn't save — retry* goes. Its retry is a save of the draft as it is now, which still holds the
   * value that failed.
   */
  const { save: track, clear, statusOf } = useInlineSave();
  const failedFields = useRef(new Set<string>());
  const trackedFields = useRef(new Set<string>());

  const reset = useCallback((session: CoachingSession) => {
    const draft = draftOf(session);
    held.current = { sessionId: session.sessionId, version: session.version, draft, saved: snapshotOf(draft) };
    again.current = false;
    setError(null);
    setState(draft);
    // A session read again is a new draft: nothing said about the old one's fields still stands.
    for (const field of trackedFields.current) clear(field);
    trackedFields.current.clear();
    failedFields.current.clear();
  }, [clear]);

  const change = useCallback((fn: (draft: Draft) => Draft) => {
    const current = held.current;
    if (!current) return;
    current.draft = fn(current.draft);
    setState(current.draft);
  }, []);

  const save = useCallback((): Promise<boolean | null> => {
    if (inFlight.current) {
      again.current = true;
      return inFlight.current;
    }
    const run = async (): Promise<boolean | null> => {
      const mine = held.current;
      if (!mine) return true;
      do {
        again.current = false;
        const sent = mine.draft;
        const snapshot = snapshotOf(sent);
        if (snapshot === mine.saved) continue;
        try {
          const saved = await saveSessionDraft(mine.sessionId, { version: mine.version, ...bodyOf(sent) });
          // A session read again meanwhile is a new draft; this answer belongs to the old one.
          if (held.current !== mine) return null;
          mine.version = saved.version;
          mine.saved = snapshot;
          // The server names the rows it was sent, in the order it was sent them.
          const actionIds = new Map(sent.actions.map((a, i) => [a.key, saved.actionItems[i]?.itemId]));
          const tipIds = new Map(sent.tips.map((t, i) => [t.key, saved.tips[i]?.tipId]));
          mine.draft = {
            ...mine.draft,
            actions: mine.draft.actions.map((a) => (a.itemId || !actionIds.get(a.key) ? a : { ...a, itemId: actionIds.get(a.key) })),
            tips: mine.draft.tips.map((t) => (t.tipId || !tipIds.get(t.key) ? t : { ...t, tipId: tipIds.get(t.key) })),
          };
          setState(mine.draft);
          setError(null);
        } catch (err) {
          const shown = toDisplayError(err);
          if (shown.code === 'VERSION_CONFLICT' || shown.code === 'COACHING_SESSION_FINALIZED') {
            conflict.current();
            return null;
          }
          setError(shown);
          return false;
        }
      } while (again.current);
      return true;
    };
    inFlight.current = run().finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, []);

  /** A save with `field`'s confirmation; a landed one takes every earlier failure's retry away (see above). */
  const saveTracked = useCallback((field: string) => {
    trackedFields.current.add(field);
    void track(field, async () => {
      const outcome = await save();
      if (outcome === false) {
        failedFields.current.add(field);
        return false;
      }
      for (const other of failedFields.current) if (other !== field) clear(other);
      failedFields.current.clear();
      return outcome;
    });
  }, [clear, save, track]);

  const commit = useCallback((fn: (draft: Draft) => Draft, field?: string) => {
    change(fn);
    if (field) saveTracked(field);
    else void save();
  }, [change, save, saveTracked]);

  const saveField = useCallback((field: string) => {
    const current = held.current;
    if (!current || snapshotOf(current.draft) === current.saved) return;
    saveTracked(field);
  }, [saveTracked]);

  const version = useCallback(() => held.current?.version ?? 0, []);
  const onConflict = useCallback((handler: () => void) => { conflict.current = handler; }, []);

  return { state, error, reset, change, commit, save, saveField, status: statusOf, version, onConflict };
}

/*
 * ── The header and the pre-start state ──────────────────────────────────────────────────────────
 */

/**
 * `.session-header-card` (`Overall.html:4169-4175`): *Today's session — {date}*, its tag, and the past
 * sessions.
 *
 * **The date is the office's today until the session is first finalized, and the session's own date
 * from then on** (a Fix): the prototype prints the browser's today whatever it shows. Both are the
 * server's calendar days.
 *
 * **A past session opens its archive** (`/coaching/[membershipId]/archive/[sessionId]`), where the
 * prototype toasted that the archive was *"coming next"* (`:10712-10715`, contradiction #5).
 */
function SessionHeader({ coachee, history, session }: { coachee: Coachee; history: SessionHistory | null; session: CoachingSession | null }) {
  const [showPast, setShowPast] = useState(false);
  const listId = useId();
  const day = session?.date ?? history?.today ?? null;
  const finalized = session?.status === 'finalized';

  return (
    <div className="rounded-lg border border-hairline bg-card px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-base text-muted">
          {"Today's session — "}<strong className="text-navy">{day ? formatCalendarDayLong(day) : ''}</strong>
          {' '}
          <span
            className={cn(
              'ml-1.5 whitespace-nowrap rounded-pill px-2.5 py-0.5 text-2xs font-semibold',
              finalized ? 'bg-success/10 text-success' : 'bg-base text-muted',
            )}
          >
            {sessionTag(session)}
          </span>
        </p>
        <button
          type="button"
          aria-expanded={showPast}
          aria-controls={listId}
          onClick={() => setShowPast((v) => !v)}
          className={cn('rounded-sm text-sm font-semibold text-navy-soft hover:underline', TEXT_TAP)}
        >
          {showPast ? 'Hide past sessions' : 'View past sessions'}
          <span aria-hidden="true">{showPast ? ' ▴' : ' ▾'}</span>
        </button>
      </div>
      <div id={listId} hidden={!showPast} className="mt-3 border-t border-hairline pt-3">
        {!history ? null : history.sessions.length === 0 ? (
          <p className="py-1.5 text-sm text-muted">No past sessions yet.</p>
        ) : (
          <ul>
            {history.sessions.map((past) => (
              <li key={past.sessionId}>
                <Link
                  href={coachingArchiveHref(coachee.membershipId, past.sessionId)}
                  className={cn('flex items-center justify-between gap-3 rounded-sm py-[7px] text-sm text-muted hover:text-navy', TAP_HEIGHT)}
                >
                  <span>
                    <strong className="text-navy">{formatShortDay(past.date, { year: true })}</strong> — {pastSessionSummary(past)}
                  </span>
                  <span className="whitespace-nowrap">View →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * **The session's tag**: *Not started* before *Start coaching session* has opened one (P18.95-T7 AC-2; the client's
 * UI review, UI-021), *Draft* while it is open, *Finalized* once it is. The prototype's tag reads *Draft* from the
 * start (`Overall.html:4171`), before there is anything to be a draft of.
 */
export function sessionTag(session: Pick<CoachingSession, 'status'> | null): 'Not started' | 'Draft' | 'Finalized' {
  if (session === null) return 'Not started';
  return session.status === 'finalized' ? 'Finalized' : 'Draft';
}

function StartCard({ starting, error, onStart }: { starting: boolean; error: ApiError | null; onStart: () => void }) {
  return (
    <div className="rounded-lg border border-hairline bg-card px-[22px] py-[18px] text-center">
      <div className="py-3.5">
        <Button onClick={onStart} disabled={starting} className="h-auto px-[22px] py-[11px]">
          <span aria-hidden="true">▶&nbsp;</span>Start coaching session
        </Button>
        {/* The client's *Remove* on a phone (P18.95-T7 AC-1, grey text row 24): from 768px it reads as before. */}
        <p className={cn('mt-2.5 text-sm text-muted', REMOVED_ON_PHONE)}>
          {"Opens last week's items, goals, leads, and everything else for today's 1-on-1."}
        </p>
      </div>
      {error && <div className="text-left"><ErrorBanner {...error} /></div>}
    </div>
  );
}

function SessionSkeleton() {
  return (
    <Skeleton label="Opening the session…" className="rounded-lg border border-hairline bg-card px-[22px] py-[18px]">
      <SkeletonBar className="mx-auto h-10 w-56" />
      <SkeletonText lines={1} className="mx-auto mt-3 w-2/3" />
    </Skeleton>
  );
}

/** Where last week's items will be, while the session is read beside the cards below it. */
function AgreementSkeleton() {
  return (
    <Skeleton label="Opening the session…" className="rounded-lg border border-hairline bg-card px-[22px] py-[18px]">
      <SkeletonBar className="h-4 w-1/3" />
      <SkeletonText lines={2} className="mt-3" />
    </Skeleton>
  );
}

/*
 * ── Last week's action items ────────────────────────────────────────────────────────────────────
 */

/**
 * *Last week's action items* (`Overall.html:4186-4189`, `:10717-10734`): the items of the coachee's
 * latest finalized session, whoever led it. **Ticking one writes the tick on this session** — the
 * session it came from is frozen (P11-T5 AC-2). Not drawn for a coachee with no earlier session (a
 * Fill): the prototype's card always has rows.
 */
function LastWeekCard({ session, draft, locked }: { session: CoachingSession; draft: SessionDraft; locked: boolean }) {
  const rows = draft.state?.lastWeek ?? [];
  const uid = useId();
  return (
    <SummaryCard
      id="session-last-week"
      title="Last week's action items"
      tag={session.lastWeek ? `From ${formatShortDay(session.lastWeek.date)} session` : undefined}
    >
      <ul>
        {session.lastWeekItems.map((item, i) => {
          const row = rows.find((r) => r.itemId === item.itemId) ?? { itemId: item.itemId, done: item.done, dueDate: item.dueDate };
          const textId = `${uid}-text-${i}`;
          return (
            <li key={item.itemId} className="flex min-h-10 flex-wrap items-center gap-2.5 border-b border-hairline py-[9px] last:border-b-0">
              <input
                type="checkbox"
                aria-labelledby={textId}
                checked={row.done}
                disabled={locked}
                className={cn('h-4 w-4 shrink-0 accent-success', locked ? 'opacity-70' : 'cursor-pointer')}
                onChange={(e) => {
                  const done = e.target.checked;
                  draft.commit((d) => ({ ...d, lastWeek: d.lastWeek.map((r) => (r.itemId === item.itemId ? { ...r, done } : r)) }), `lastWeek:${item.itemId}`);
                }}
              />
              {locked ? (
                <DateTag day={row.dueDate} />
              ) : (
                <TextInput
                  type="date"
                  density="cell"
                  aria-label={`Date, ${item.text || `item ${i + 1}`}`}
                  className="w-[8.5rem] border-hairline"
                  value={row.dueDate ?? ''}
                  onChange={(e) => {
                    const dueDate = e.target.value || null;
                    draft.commit((d) => ({ ...d, lastWeek: d.lastWeek.map((r) => (r.itemId === item.itemId ? { ...r, dueDate } : r)) }), `lastWeek:${item.itemId}`);
                  }}
                />
              )}
              {item.lead && <FromLeadTag name={item.lead.name} />}
              {/* At least 10rem, so on a phone the words take a line of their own rather than a sliver beside the date. */}
              <span id={textId} className={cn('min-w-[10rem] flex-1 text-md', row.done ? 'text-muted line-through' : 'text-navy')}>
                {item.text}
              </span>
              {/* The row's tick and date say their save at its end (P18.95-T1 AC-5). */}
              <InlineSaveStatus {...draft.status(`lastWeek:${item.itemId}`)} label={item.text || `item ${i + 1}`} />
            </li>
          );
        })}
      </ul>
    </SummaryCard>
  );
}

/*
 * ── The Goal card ───────────────────────────────────────────────────────────────────────────────
 */

/**
 * *Goal* (`Overall.html:4192-4214`; ADR-0075, contradiction #1): this month's and this year's APE
 * produced over the target, the percentage, the bar and what remains — **each the figure the Summary
 * shows for the same period**, from the coachee's `GET /summary?for=`, *Not uploaded yet* included.
 *
 * **Only the annual target is editable, and only by a deliberate save** — never on a keystroke or a
 * blur — through `PUT /goals/:period?for=&session=`, which carries the leader's name and makes every
 * save in this session one notice to the coachee. The plan sent is the one `GET /goals/:period?for=`
 * answers, set to a direct target. This month's target moves only by its formula (ADR-0056), so it is
 * a figure here like the others. The hint says only what is true.
 *
 * **One money formatter** (F-02, contradiction #13): `formatRupiahCompact` everywhere on the card, the
 * *remaining* lines included — a card's figures are compact (ADR-0167 §1, `Rp 1,2 M`), where the
 * prototype had a second formatter that wrote a billion as *Rp1.2M+*. The editor's box holds the target
 * in full, as every input does.
 *
 * **It says so once the card shows it** (P11-T8's browser walk): the figures are read again first, the
 * box stays open on what was saved meanwhile, and only then does it close and the toast say the goal
 * was updated — never over the old target.
 */
function GoalCard({
  coachee, sessionId, editable, onSaved,
}: { coachee: Coachee; sessionId: string; editable: boolean; onSaved: () => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const inputId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const { membershipId } = coachee;

  useEffect(() => {
    let live = true;
    readSummary(membershipId)
      .then((next) => { if (live) setSummary(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [membershipId]);

  useEffect(() => {
    if (editing) document.getElementById(inputId)?.focus();
  }, [editing, inputId]);

  // A session that locks while the box is open closes it.
  useEffect(() => {
    if (!editable) setEditing(false);
  }, [editable]);

  const noGoal = summary !== null && (!summary.goal.set || summary.yearly.targetMinor === null);

  function edit() {
    setTyped(!noGoal && summary?.yearly.targetMinor ? String(toMajor(summary.yearly.targetMinor)) : '');
    setSaveError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setSaveError(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!summary || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const plan = await readGoal(summary.year, membershipId);
      await saveGoal(
        summary.year,
        { ...goalInputsOf(plan), mode: 'direct', annualApeTargetMinor: toMinor(parseDigits(typed)) },
        membershipId,
        sessionId,
      );
    } catch (err) {
      setSaveError(toDisplayError(err));
      setSaving(false);
      return;
    }
    // Saved. The new figures first, so the card never shows the old target under the toast.
    try {
      setSummary(await readSummary(membershipId));
    } catch (err) {
      setSummary(null);
      setError(toDisplayError(err));
    }
    setEditing(false);
    setSaving(false);
    onSaved();
  }

  const editor = (
    <form onSubmit={(e) => void save(e)} className="flex flex-wrap items-center gap-2">
      <TextInput
        id={inputId}
        prefix="Rp"
        aria-label="Annual APE target"
        inputMode="numeric"
        className="w-48"
        value={typed === '' ? '' : groupDigits(parseDigits(typed))}
        readOnly={saving}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
      />
      <Button type="submit" disabled={saving}>Save</Button>
      <Button variant="secondary" onClick={cancel} disabled={saving}>Cancel</Button>
    </form>
  );

  return (
    <SummaryCard
      id="session-goal"
      title="Goal"
      className="min-w-0"
      aside={editable && !noGoal && summary && !editing
        ? <span className="text-xs text-muted">Tap this year’s target to edit</span>
        : undefined}
    >
      {error && <ErrorBanner {...error} />}
      {!summary && !error && (
        <Skeleton label="Reading the goal…">
          <SkeletonBar className="h-6 w-2/3" />
          <SkeletonBar className="mt-3 h-1.5 w-full" />
          <SkeletonBar className="mt-6 h-6 w-2/3" />
          <SkeletonBar className="mt-3 h-1.5 w-full" />
        </Skeleton>
      )}
      {summary && (noGoal ? (
        <div className="flex flex-col gap-3">
          <p className="font-body text-[1.1875rem] font-bold text-navy">No goal set</p>
          {editable && (editing ? editor : (
            <Button ref={trigger} variant="inline" className="self-start" onClick={edit}>Set this year’s target</Button>
          ))}
        </div>
      ) : (
        <>
          <GoalRow figures={summary.monthly} period="month" target={
            summary.monthly.targetMinor === null ? '—' : formatRupiahCompact(summary.monthly.targetMinor)
          } />
          <GoalRow
            figures={summary.yearly}
            period="year"
            className="mt-3.5"
            target={editing ? null : editable ? (
              <button
                ref={trigger}
                type="button"
                onClick={edit}
                className="rounded-[3px] border-b-[1.5px] border-dashed border-hairline px-px hover:border-amber focus:border-amber"
              >
                {formatRupiahCompact(summary.yearly.targetMinor!)}
                <span className="sr-only">, this year’s target — edit</span>
              </button>
            ) : formatRupiahCompact(summary.yearly.targetMinor!)}
            editor={editing ? editor : null}
          />
        </>
      ))}
      {saveError && <div className="mt-3"><ErrorBanner {...saveError} /></div>}
    </SummaryCard>
  );
}

/*
 * ── Ratios and Activity ─────────────────────────────────────────────────────────────────────────
 */

/**
 * *Ratios*, *Last 30 days* (`Overall.html:4215-4218`, `:10906-10920`): **the coachee's ratios on the
 * coachee's rung** (ADR-0020), where the prototype's were markup. A rate is coloured against its
 * benchmark and says it; the balance says which way it leans, in points, and its band.
 */
function RatiosCard({ coachee }: { coachee: Coachee }) {
  const [ratios, setRatios] = useState<ActivityRatios | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    readActivityRatios(coachee.membershipId)
      .then((next) => { if (live) setRatios(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [coachee.membershipId]);

  return (
    <RatiosPanel
      rows={ratios?.ratios ?? null}
      error={error}
      emptyLine={`There are no ratios for ${PRONOUN_FORMS[coachee.pronoun].possessive} role yet.`}
    />
  );
}

/**
 * *Activity → view full dashboard* · *Last 7 days* (`Overall.html:4221-4254`, contradiction #6): **the
 * coachee's saved week against pro-rated targets**, where the prototype's card was static.
 *
 * The three chips are `SUB_PERIOD_ACTIVITY_TARGET`: this month's cascade target scaled to seven days,
 * which metrics §B.3 asks every screen to **label as pro-rated**, so each target says so where it is
 * printed. Below them the section chips, grouped by the office's summary tiles exactly as the Summary's
 * are (ADR-0064, I-140), and the drill, a dialog in the page (`ActivityPanel`).
 *
 * **Read again after the annual target is saved** (`refresh`, P11-T8's browser walk): the pro-rated
 * targets are this month's, and this month's follows the goal. What it showed stays until the new
 * week arrives.
 */
function ActivityCard({ coachee, refresh }: { coachee: Coachee; refresh: number }) {
  const [week, setWeek] = useState<ActivitySummary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    readActivitySummary({ membershipId: coachee.membershipId, period: 'ROLLING_7D' })
      .then((next) => {
        if (!live) return;
        setWeek(next);
        setError(null);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [coachee.membershipId, refresh]);

  return (
    <ActivityPanel
      name={coachee.name}
      week={week ? { targets: week.targets ?? [], sections: week.sections ?? [] } : null}
      error={error}
    />
  );
}

/*
 * ── Tips and action items ───────────────────────────────────────────────────────────────────────
 */

/**
 * The round *+* in a card's head (`Overall.html:4290`, `:4298`) — the prototype's `.btn-primary`, so the
 * primary button made round: it adds, and an action is amber (ADR-0137).
 */
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="h-[30px] w-[30px] shrink-0 rounded-full px-0 text-lg leading-none"
    >
      <span aria-hidden="true">+</span>
    </Button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="icon" tone="alert" title={label} onClick={onClick}>
      <span aria-hidden="true">✕</span>
      <span className="sr-only">{label}</span>
    </Button>
  );
}

/** Focus the row a *+* just added, once it is in the page. */
function useFocusNew() {
  const [key, setKey] = useState<string | null>(null);
  const uid = useId();
  const idOf = (k: string) => `${uid}-${k}`;
  useEffect(() => {
    if (key) document.getElementById(idOf(key))?.focus();
    // `idOf` is fixed for the life of the card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { focus: setKey, idOf };
}

/**
 * *Coaching tips* (`Overall.html:4287-4293`, `:11011-11038`): *+* adds a blank row and focuses it,
 * *Type the tip…*, *✕*. No categories (ADR-0083). The empty line points up at the *+*, which is above
 * it — the prototype's pointed below (contradiction #14, a Fix in its sibling's words).
 */
function TipsCard({ draft, locked }: { draft: SessionDraft; locked: boolean }) {
  const tips = draft.state?.tips ?? [];
  const { focus, idOf } = useFocusNew();
  return (
    <SummaryCard
      id="session-tips"
      title="Coaching tips"
      aside={locked ? undefined : (
        <AddButton
          label="Add tip"
          onClick={() => {
            const key = newKey();
            draft.change((d) => ({ ...d, tips: [...d.tips, { key, text: '' }] }));
            focus(key);
          }}
        />
      )}
    >
      {tips.length === 0 ? (
        <p className={EMPTY_LINE}>
          {locked ? 'No tips were added this session.' : 'No tips added yet — tap + above to add one.'}
        </p>
      ) : (
        <ol>
          {tips.map((tip, i) => (
            <li key={tip.key} className="flex items-start gap-2.5 border-b border-hairline py-[9px] text-base text-navy last:border-b-0">
              <NumberDot n={i + 1} />
              {locked ? (
                <span className="min-w-0 flex-1">{tip.text}</span>
              ) : (
                <>
                  <InlineSaveField status={draft.status(`tip:${tip.key}`)} label={`Tip ${i + 1}`} className="min-w-0 flex-1">
                    <TextInput
                      id={idOf(tip.key)}
                      aria-label={`Tip ${i + 1}`}
                      placeholder="Type the tip…"
                      className="h-8 w-full min-w-0"
                      value={tip.text}
                      onChange={(e) => {
                        const text = e.target.value;
                        draft.change((d) => ({ ...d, tips: d.tips.map((t) => (t.key === tip.key ? { ...t, text } : t)) }));
                      }}
                      onBlur={() => draft.saveField(`tip:${tip.key}`)}
                    />
                  </InlineSaveField>
                  <RemoveButton
                    label={`Remove tip ${i + 1}`}
                    onClick={() => draft.commit((d) => ({ ...d, tips: d.tips.filter((t) => t.key !== tip.key) }))}
                  />
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </SummaryCard>
  );
}

/**
 * *Next action items* (`Overall.html:4295-4301`, `:11040-11102`).
 *
 * - *From leads (automatic)*: each of the coachee's leads with a next action date, nearest first, with
 *   its note or *Follow up with {name}*. Read-only: it is the leads', and the Leads card above edits it.
 * - *Other action items*: a date and *What needs to happen…*, by date, undated last. A new one is
 *   dated the office's today — the prototype dated it with the browser's UTC day, which in Jakarta is
 *   yesterday until 07:00 (F-01).
 *
 * *+* refuses to start a second blank row, in the prototype's sentence — said beside the list, where
 * the reader can act on it, rather than in a toast that leaves (`components-and-patterns.md`, *Toast*),
 * and the focus goes to the row already started.
 */
function NextActionsCard({
  draft, leadActions, locked, today,
}: { draft: SessionDraft; leadActions: readonly LeadAction[]; locked: boolean; today: string }) {
  const actions = [...(draft.state?.actions ?? [])].sort(byDueDate);
  const { focus, idOf } = useFocusNew();
  const [guard, setGuard] = useState(false);

  function add() {
    const blank = draft.state?.actions.find((a) => !a.text.trim());
    if (blank) {
      setGuard(true);
      document.getElementById(idOf(blank.key))?.focus();
      return;
    }
    setGuard(false);
    const key = newKey();
    draft.change((d) => ({ ...d, actions: [...d.actions, { key, text: '', dueDate: today }] }));
    focus(key);
  }

  const label = GROUP_LABEL;
  return (
    <SummaryCard
      id="session-next"
      title="Next action items"
      aside={locked ? undefined : <AddButton label="Add action" onClick={add} />}
    >
      <h3 className={label}>From leads (automatic)</h3>
      {leadActions.length === 0 ? (
        <p className={EMPTY_LINE}>No leads have a next action date set yet.</p>
      ) : (
        <ul>
          {leadActions.map((a) => (
            <li key={a.leadId} className="flex min-h-10 flex-wrap items-center gap-2.5 border-b border-hairline py-[9px] last:border-b-0">
              <DateTag day={a.dueDate} />
              <FromLeadTag name={a.leadName} />
              <span className="min-w-[10rem] flex-1 text-md text-navy">{a.text || `Follow up with ${a.leadName}`}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className={label}>Other action items</h3>
      {actions.length === 0 ? (
        <p className={EMPTY_LINE}>
          {locked ? 'No other action items were added this session.' : 'No other action items yet — tap + above to add one.'}
        </p>
      ) : (
        <ol>
          {actions.map((item, i) => (
            <li key={item.key} className="flex min-h-10 flex-wrap items-center gap-2.5 border-b border-hairline py-[9px] last:border-b-0">
              <NumberDot n={i + 1} />
              {locked ? (
                <>
                  <DateTag day={item.dueDate} />
                  <span className="min-w-[10rem] flex-1 text-md text-navy">{item.text}</span>
                </>
              ) : (
                <>
                  <TextInput
                    type="date"
                    aria-label={`Date, action item ${i + 1}`}
                    className="h-8 w-[118px] px-2"
                    value={item.dueDate ?? ''}
                    onChange={(e) => {
                      const dueDate = e.target.value || null;
                      draft.commit((d) => ({ ...d, actions: d.actions.map((a) => (a.key === item.key ? { ...a, dueDate } : a)) }), `action:${item.key}`);
                    }}
                  />
                  {/* The row's date and words say their save under the words (P18.95-T1 AC-5). */}
                  <InlineSaveField status={draft.status(`action:${item.key}`)} label={`Action item ${i + 1}`} className="min-w-[140px] flex-1">
                    <TextInput
                      id={idOf(item.key)}
                      aria-label={`Action item ${i + 1}`}
                      placeholder="What needs to happen…"
                      className="h-8 w-full"
                      value={item.text}
                      onChange={(e) => {
                        const text = e.target.value;
                        if (text.trim()) setGuard(false);
                        draft.change((d) => ({ ...d, actions: d.actions.map((a) => (a.key === item.key ? { ...a, text } : a)) }));
                      }}
                      onBlur={() => draft.saveField(`action:${item.key}`)}
                    />
                  </InlineSaveField>
                  <RemoveButton
                    label={`Remove action item ${i + 1}`}
                    onClick={() => {
                      setGuard(false);
                      draft.commit((d) => ({ ...d, actions: d.actions.filter((a) => a.key !== item.key) }));
                    }}
                  />
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      {guard && !locked && (
        <p role="alert" className="mt-2 text-sm font-semibold text-alert">
          Fill in the action item you already started before adding another.
        </p>
      )}
    </SummaryCard>
  );
}

/*
 * ── Finalize, and Edit again ────────────────────────────────────────────────────────────────────
 */

/**
 * The finalize card (`Overall.html:4303-4315`).
 *
 * **Open**: *✓ Finalize this session* and its line. Whatever is unsaved is saved first, then finalize
 * goes with the version that save answered. **A refusal is the server's** — the prototype's five
 * checks, in its order — **in the prototype's sentence**, said under the button where the reader can
 * act on it rather than in a toast (`details.rule`, `functional/coaching.md`).
 *
 * **Finalized**: *✓ Finalized {date}*, *Edit again*, which asks why in a dialog that says the coachee
 * reads the reason (ADR-0079, a Fill), and *⬇ Download as PDF*, the print of the frozen session
 * (ADR-0077, P11-T10 AC-3), which closes parity D-17. Past the seven days *Edit again* stays where it
 * is, drawn locked with a title saying until when it could have been used.
 */
function FinalizeCard({
  coachee, session, today, draft, canFinalize, canReopen, showCoach, onFinalized, onReopened, onConflict,
}: {
  coachee: Coachee;
  session: CoachingSession;
  today: string;
  draft: SessionDraft;
  canFinalize: boolean;
  canReopen: boolean;
  /** The reader did not lead it: the print says who did. */
  showCoach: boolean;
  onFinalized: (session: CoachingSession) => Promise<void>;
  onReopened: (session: CoachingSession) => Promise<void>;
  onConflict: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [asking, setAsking] = useState(false);
  const finalized = session.status === 'finalized';

  async function finalize() {
    setBusy(true);
    setRefusal(null);
    setError(null);
    try {
      if (!(await draft.save())) return;
      const next = await finalizeSession(session.sessionId, draft.version());
      await onFinalized(next);
    } catch (err) {
      const shown = toDisplayError(err);
      const sentence = shown.code === 'COACHING_SESSION_INCOMPLETE' ? finalizeRefusal(shown.details) : null;
      if (sentence) setRefusal(sentence);
      else if (shown.code === 'VERSION_CONFLICT' || shown.code === 'COACHING_SESSION_FINALIZED') onConflict();
      else setError(shown);
    } finally {
      setBusy(false);
    }
  }

  if (!finalized) {
    if (!canFinalize) return null;
    return (
      <div className="rounded-lg border border-hairline bg-card px-[22px] py-[18px] text-center">
        <Button onClick={() => void finalize()} disabled={busy}>
          <span aria-hidden="true">✓&nbsp;</span>Finalize this session
        </Button>
        <p className="mt-2.5 text-sm text-muted">
          Coaching is only counted as done once finalized. You can keep editing everything until then.
        </p>
        {refusal && <p role="alert" className="mt-2.5 text-sm font-semibold text-alert">{refusal}</p>}
        {error && <div className="mt-3 text-left"><ErrorBanner {...error} /></div>}
      </div>
    );
  }

  const closed = reopenWindowClosed(today, session.reopenableUntil);
  const until = session.reopenableUntil ? formatShortDay(session.reopenableUntil, { year: true }) : '';
  return (
    <div className="rounded-lg border border-hairline bg-card px-[22px] py-[18px] text-center">
      <FinalizedBadge date={session.date} />
      <div className="mt-3.5 flex flex-wrap justify-center gap-2.5 empty:hidden">
        {canReopen && session.reopenableUntil !== null && (
          <EditAgainButton closed={closed} until={until} onClick={() => setAsking(true)} />
        )}
        <DownloadPdfButton sessionId={session.sessionId} showCoach={showCoach} />
      </div>
      <ReopenDialog
        open={asking}
        coacheeName={coachee.name}
        session={session}
        onClose={() => setAsking(false)}
        onReopened={async (next) => {
          setAsking(false);
          await onReopened(next);
        }}
        onConflict={() => {
          setAsking(false);
          onConflict();
        }}
      />
    </div>
  );
}
