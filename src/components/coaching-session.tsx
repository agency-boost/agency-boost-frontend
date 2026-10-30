'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { DownloadPdfButton } from '@/components/coaching-print';
import {
  ActivityTilesCard, byDueDate, EditAgainButton, EMPTY_LINE, NumberDot,
} from '@/components/coaching-parts';
import { SessionLeadsCard, useCoacheeLeads } from '@/components/coaching-leads';
import { useSessionHistoryPrefetch } from '@/components/coaching-person';
import { PersonalRatioCard } from '@/components/ratio-card';
import { ActionRow, actionDay } from '@/components/ui/action-row';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { AutoMarker } from '@/components/ui/auto-marker';
import { Button, ErrorBanner, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import {
  InlineSaveField, InlineSaveStatus, useInlineSave, type InlineSaveStatusProps,
} from '@/components/ui/inline-save-status';
import { TonePill } from '@/components/ui/tone-pill';
import { Toast, useToast } from '@/components/ui/toast';
import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { coachingSessionMessages } from '@/i18n/messages/coaching-session';
import { uiMessages } from '@/i18n/messages/ui';
import { readActivitySummary, type ActivitySummary } from '@/lib/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { withDetail } from '@/lib/confirmations';
import { cn } from '@/lib/cn';
import {
  coachingArchiveHref, finalizeRefusal, finalizeSession, leadActionText, pastSessionSummary,
  readSession, readSessionHistory, reopenWindowClosed, saveSessionDraft, startSession,
  type Coachee, type CoachingSession, type LeadAction, type SessionDraftBody, type SessionHistory,
} from '@/lib/coaching';
import { formatCalendarDayLong, formatPercent, formatRupiahCompact, formatShortDay, moneyPrefix } from '@/lib/format';
import {
  goalInputsOf, groupDigits, parseDigits, readGoal, saveGoal, toMajor, toMinor,
} from '@/lib/goals';
import { readLead, type Lead } from '@/lib/leads';
import { useCan, useSession } from '@/lib/session';
import { useOpenedOnce } from '@/lib/use-opened-once';
import { readSummary, type PeriodFigures, type Summary } from '@/lib/summary';

/**
 * **The lead sheet, downloaded when a lead is first opened** (P18.99-T16, the bundle), and mounted from then on
 * (`useOpenedOnce`): it was the largest thing on this route that the first paint does not draw.
 */
const LeadSheet = dynamic(() => import('@/components/lead-sheet').then((m) => m.LeadSheet), { ssr: false });
/** *Edit again*'s dialog, downloaded when it is first opened and mounted from then on (`useOpenedOnce`; P18.99-T16). */
const ReopenDialog = dynamic(() => import('@/components/coaching-reopen-dialog').then((m) => m.ReopenDialog), { ssr: false });

/**
 * A coachee's *Coaching Session* tab (`Overall.html:4167-4319`, logic `:10666-11187`; P11-T8): the
 * 1-on-1 itself, inside the person shell.
 *
 * **UI V1 (UI-032, UI-060, UI-061, UI-062, UI-081): the page is a 1-on-1 script** — review (last week), look (the goal,
 * the ratios, the activity), plan (the leads, the next actions), finalise:
 *
 * - **One session card** (UI-032): *Sesi hari ini*, the day, its tag and *Mulai sesi coaching*, and the past sessions
 *   as rows under it, three and then *Semua* — no dropdown, and no line under the button.
 * - **One compact action row everywhere** (UI-061, `ActionRow`): *Tindakan minggu lalu* with a checkbox, *Dari leads*
 *   with the ⚡ and a link into the lead, *Lainnya* with a ✕; one date format, sentence-case labels, 16px boxes.
 * - **The Leads card** (UI-062, `SessionLeadsCard`): compact rows, *Isi tindakan* / *Isi tanggal* where a lead has no
 *   next action, five and then *Tampilkan semua*, WhatsApp and Call always live (UI-081); a row opens the lead sheet.
 * - **The ratio card as rows** (O-3, `PersonalRatioCard`), all five ratios; *Goal* as two tiles; *Aktivitas* as three.
 * - **Finalkan is always in reach** (UI-060, UI-062): a pinned bar above the tab bar on a phone and a tablet, the foot of
 *   the sticky right column on a desktop. Every action has a date (the server's `defaultDueDate`); a refusal for a
 *   missing one scrolls to the first such row, outlines each in red and says the count above the button. Finalized,
 *   a green *Difinalkan* strip and *Ubah lagi*.
 * - **The layout per size** (UI-062): one column on a phone; on a tablet *Goal | Ratio* side by side; on a desktop the
 *   work on the left two thirds and the context — goal, ratio, activity, *Finalkan* — in a sticky right third.
 *
 * **What it opens on is the server's** (`GET /coaching/coachees/:membershipId/sessions`, *What the
 * workspace opens on*): the reader's open draft with this person, else the session they are
 * correcting, else the one they finalized today, else the pre-start state, *Mulai sesi coaching*. Nothing is
 * read about the person — no goal, no ratios, no leads — until a session is open, because each of those reads is
 * audited (roles §3.5) and the pre-start state shows none of them.
 *
 * **The draft is the server's record, saved as it is edited** (`functional/coaching.md`, *The
 * draft*): each change to last week's ticks and dates, the action items and the tips sends the whole
 * editable state with the version it was read at, one save at a time. A save another device has moved
 * past is refused with `VERSION_CONFLICT`; the screen reads the session again and says so in one line.
 * Typing writes nothing until the box is left, as the prototype's blur handlers do.
 *
 * **The reads go out together** (P11-T8's browser walk). The history is read beside the person, when
 * the shell starts it (`useSessionHistoryPrefetch`); once it names the session to open, the cards'
 * reads — the Summary, the ratios, the last 7 days, the leads — go out beside the session's own.
 *
 * **What it opens on** is the server's `current`, unless the address names a session (`?session=`):
 * the correction the archive's *Edit again* started (`functional/coaching.md`, *Reopen*; parity L-64).
 *
 * Coaching's own strings use none of ADR-0084's six words, and none names a phase, an id or a code. They are the
 * catalogue's (`messages/coaching-session.tsx`, P18.98-T4), in the reader's language; every figure is written in
 * `useFigureLanguage()`'s.
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
  const t = useMessages(coachingSessionMessages);
  const confirmed = useMessages(confirmationMessages);
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
  /** *Finalkan*'s refusal, said above the button; for a missing date, the rows it names are outlined (UI-060). */
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  /** The lead sheet: a lead, or `null` for a new one. */
  const [sheet, setSheet] = useState<{ lead: Lead | null; focus?: 'nextAction' } | null>(null);
  const sheetOpened = useOpenedOnce(sheet !== null);

  const draft = useSessionDraft();
  const { reset, onConflict } = draft;
  const shownId = session?.sessionId ?? openingId;
  const leads = useCoacheeLeads(membershipId, shownId !== null);

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
      show(withDetail(confirmed.sessionStarted, started.lastWeek ? t.carried : null));
    } catch (err) {
      setStartError(toDisplayError(err));
    } finally {
      setStarting(false);
    }
  }

  const mine = session !== null && session.coach.membershipId === myMembership;
  const finalized = session?.status === 'finalized';
  const locked = !session || finalized || !mine || !canEdit;

  /**
   * After a lead write, *Dari leads* may no longer be what the leads say — a date moved, a note changed, a lead was
   * named. While the session is open it is derived on every read, so it is read again then, and only then: each read
   * of the session is audited.
   */
  const leadWritten = useCallback(async (lead: Lead) => {
    leads.put(lead);
    if (!session || session.status === 'finalized' || !leadActionsStale(session.leadActions, lead)) return;
    try {
      const fresh = await readSession(session.sessionId);
      setSession((s) => (s && s.sessionId === fresh.sessionId ? { ...s, leadActions: fresh.leadActions } : s));
    } catch { /* the list stays as it was; the next read brings it up to date */ }
  }, [session, leads]);

  /** *Dari leads*' › opens the lead's sheet: the lead as held, or read when the card has not arrived yet. */
  const openLead = useCallback(async (leadId: string) => {
    const held = leads.leads?.find((lead) => lead.id === leadId);
    if (held) {
      setSheet({ lead: held });
      return;
    }
    try {
      setSheet({ lead: await readLead(leadId) });
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [leads.leads]);

  const opened = history !== null && shownId !== null && !error;
  const ready = session !== null && draft.state !== null;
  const bar = ready && (finalized || (mine && canFinalize));
  // Below 1024px every card spans the tablet's two columns, but *Goal* and *Ratio* (UI-062).
  const SPAN = 'md:max-lg:col-span-2';

  return (
    <div data-session-workspace="" className={cn('min-w-0', bar && 'max-lg:pb-28')}>
      {error && <ErrorBanner {...error} />}
      {!history && !error && <SessionSkeleton />}
      {history && !error && (
        <div
          className={cn(
            'flex min-w-0 flex-col gap-2.5',
            opened && 'md:max-lg:grid md:max-lg:grid-cols-2 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-4',
          )}
        >
          {/* The work: left two thirds on a desktop; below it, its cards take their places in one flow (`order`). */}
          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
            <SessionCard
              className={SPAN}
              coachee={coachee}
              history={history}
              session={session}
              start={!shownId && canStart ? { starting, error: startError, onStart: () => void start() } : null}
            />
            {opened && (
              <>
                {reloaded && (
                  <p role="status" className={cn(SPAN, 'order-1 rounded-row bg-card px-3.5 py-2.5 text-base text-navy lg:order-none')}>
                    {t.reloaded}
                  </p>
                )}
                {draft.error && <div className={cn(SPAN, 'order-1 lg:order-none')}><ErrorBanner {...draft.error} /></div>}
                {!ready && <AgreementSkeleton className={cn(SPAN, 'order-2 lg:order-none')} />}
                {ready && session.lastWeek && (
                  <LastWeekCard className={cn(SPAN, 'order-2 lg:order-none')} session={session} draft={draft} locked={locked} />
                )}
                <SessionLeadsCard
                  className={cn(SPAN, 'order-6 lg:order-none')}
                  leads={leads.leads}
                  error={leads.error}
                  locked={locked}
                  onOpen={(lead, focus) => setSheet({ lead, focus })}
                  onSaved={(lead) => void leadWritten(lead)}
                />
                {ready && (
                  <>
                    <NextActionsCard
                      className={cn(SPAN, 'order-8 md:max-lg:order-7 lg:order-none')}
                      draft={draft}
                      leadActions={session.leadActions}
                      locked={locked}
                      newRowDate={session.defaultDueDate ?? history.today}
                      refusal={refusal}
                      onOpenLead={(id) => void openLead(id)}
                    />
                    <TipsCard className={cn(SPAN, 'order-7 md:max-lg:order-8 lg:order-none')} draft={draft} locked={locked} />
                  </>
                )}
              </>
            )}
          </div>

          {/* The context: a sticky right third on a desktop, *Finalkan* at its foot (UI-062). */}
          {opened && (
            <div className="contents lg:sticky lg:top-4 lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
              <GoalCard
                className="order-3 lg:order-none"
                coachee={coachee}
                sessionId={shownId}
                editable={!locked && canSetGoal}
                onSaved={() => {
                  setGoalSaves((n) => n + 1);
                  show(t.goalUpdated);
                }}
              />
              <PersonalRatioCard membershipId={membershipId} className="order-4 min-w-0 lg:order-none" />
              <ActivityCard className={cn(SPAN, 'order-5 lg:order-none')} coachee={coachee} refresh={goalSaves} />
              {bar && (
                <FinalizeBar
                  coachee={coachee}
                  session={session}
                  today={history.today}
                  draft={draft}
                  refusal={refusal}
                  onRefusal={setRefusal}
                  canFinalize={mine && canFinalize}
                  canReopen={canReopen}
                  onFinalized={async (next) => {
                    open(next);
                    setReloaded(false);
                    show(t.finalizedToast);
                    await refreshHistory().catch(() => undefined);
                  }}
                  onReopened={async (next) => {
                    open(next);
                    setReloaded(false);
                    show(t.reopenedToast);
                    await refreshHistory().catch(() => undefined);
                  }}
                  onConflict={reload}
                />
              )}
              {/* *Unduh sebagai PDF* below 1024px: the pinned bar holds the strip and *Ubah lagi* only. */}
              {finalized && (
                <div className={cn(SPAN, 'order-9 lg:hidden')}>
                  <DownloadPdfButton sessionId={session.sessionId} showCoach={!mine} className="w-full" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {sheetOpened && (
        <LeadSheet
          open={sheet !== null}
          lead={sheet?.lead ?? null}
          focus={sheet?.focus}
          owner={membershipId}
          readOnly={locked}
          offerDelete={false}
          onClose={() => setSheet(null)}
          onSaved={(lead) => void leadWritten(lead)}
          onClosedLead={(lead) => void leadWritten(lead)}
        />
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

/**
 * *Finalkan*'s refusal (UI-060): the prototype's sentence for the rule the server named, and — for a missing date — how
 * many rows lack one, which the rows themselves then show.
 */
interface Refusal {
  sentence: string;
  rule: string | null;
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
 * ── The cards' frame ────────────────────────────────────────────────────────────────────────────
 */

/**
 * **A V1 card** (UI-008): white, borderless on the V1 surface, 16px corners, 14px of room; its title 16px/700 and
 * whatever sits at the right of it. A region named by its title.
 */
function SessionPanel({
  title, aside, className, card, children,
}: { title: React.ReactNode; aside?: React.ReactNode; className?: string; card: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-session-card={card} className={cn('min-w-0 rounded-lg border border-card-edge bg-card p-3.5', className)}>
      <div className="mb-1 flex min-h-8 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h2 id={id} className="text-lg font-bold text-navy">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/*
 * ── The session card ────────────────────────────────────────────────────────────────────────────
 */

/** How many past sessions the card lists before *Semua* (UI-032: *Show 3, then "Semua ›"*). A layout count. */
const PAST_SHOWN = 3;

/**
 * **The session card** (UI V1, UI-032): one card for one action. *Sesi hari ini*, the day — the office's today until the
 * session is first finalized, the session's own from then on (a Fix) — and its tag; ***Mulai sesi coaching***, 48px,
 * before a session is open; and **the past sessions as rows under it**, *29 Okt 2026 · 6 tindakan · 0 selesai ›*, each
 * 52px and wholly a link to its archive — three, then *Semua (n)*. No dropdown, and no line under the button.
 */
function SessionCard({
  coachee, history, session, start, className,
}: {
  coachee: Coachee;
  history: SessionHistory;
  session: CoachingSession | null;
  start: { starting: boolean; error: ApiError | null; onStart: () => void } | null;
  className?: string;
}) {
  const figures = useFigureLanguage();
  const language = useLanguage();
  const t = useMessages(coachingSessionMessages);
  const [all, setAll] = useState(false);
  const titleId = useId();
  const pastId = useId();
  const day = session?.date ?? history.today;
  const finalized = session?.status === 'finalized';
  const past = history.sessions;
  const shown = all ? past : past.slice(0, PAST_SHOWN);

  return (
    <section aria-labelledby={titleId} data-session-card="session" className={cn('min-w-0 rounded-lg border border-card-edge bg-card px-3.5 py-2.5', className)}>
      <div className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1">
        <h2 id={titleId} className="flex flex-wrap items-baseline gap-x-1.5 text-md font-bold text-navy">
          <span className="text-sm font-normal text-muted">{t.sessionCard.label}</span>
          {formatCalendarDayLong(day, figures)}
        </h2>
        <TonePill tone={finalized ? 'green' : session ? 'amber' : 'grey'}>{sessionTag(session, language)}</TonePill>
      </div>
      {start && (
        <>
          <Button onClick={start.onStart} disabled={start.starting} className="mt-2.5 h-12 w-full gap-2 rounded-pill text-lg md:w-auto md:px-6">
            <LineIcon name="play" className="h-4 w-4" />
            {t.start.button}
          </Button>
          {start.error && <div className="mt-2.5"><ErrorBanner {...start.error} /></div>}
        </>
      )}
      {past.length > 0 && (
        <div className="mt-2 border-t border-divider">
          <h3 id={pastId} className="sr-only">{t.sessionCard.past}</h3>
          <ul aria-labelledby={pastId} className="divide-y divide-divider">
            {shown.map((row) => (
              <li key={row.sessionId}>
                <Link
                  href={coachingArchiveHref(coachee.membershipId, row.sessionId)}
                  className="-mx-3.5 flex min-h-[52px] items-center gap-2 px-3.5 text-base text-ink hover:bg-hover-row"
                >
                  <span className="min-w-0 flex-1">
                    {t.sessionCard.row({ day: formatShortDay(row.date, { year: true }, figures), summary: pastSessionSummary(row, language) })}
                  </span>
                  <LineIcon name="chevronRight" className="h-4 w-4 text-signal-grey" />
                </Link>
              </li>
            ))}
          </ul>
          {past.length > PAST_SHOWN && (
            <button
              type="button"
              aria-expanded={all}
              onClick={() => setAll((v) => !v)}
              className="flex min-h-11 items-center gap-1 text-base font-semibold text-navy-soft hover:underline"
            >
              {all ? t.sessionCard.fewer : t.sessionCard.all({ n: past.length })}
              <LineIcon name={all ? 'chevronUp' : 'chevronRight'} className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * **The session's tag**: *Not started* before *Start coaching session* has opened one (P18.95-T7 AC-2; the client's
 * UI review, UI-021), *Draft* while it is open, *Finalized* once it is. In the reader's `language`, English when passed
 * none (P18.98-T4).
 */
export function sessionTag(session: Pick<CoachingSession, 'status'> | null, language: Language = SOURCE_LANGUAGE): string {
  const t = messagesIn(coachingSessionMessages, language).tag;
  if (session === null) return t.notStarted;
  return session.status === 'finalized' ? t.finalized : t.draft;
}

function SessionSkeleton() {
  const t = useMessages(coachingSessionMessages);
  return (
    <Skeleton label={t.opening} className="rounded-lg border border-card-edge bg-card px-3.5 py-3">
      <SkeletonBar className="h-5 w-2/3" />
      <SkeletonBar className="mt-3 h-12 w-full rounded-pill" />
    </Skeleton>
  );
}

/** Where last week's items will be, while the session is read beside the cards below it. */
function AgreementSkeleton({ className }: { className?: string }) {
  const t = useMessages(coachingSessionMessages);
  return (
    <Skeleton label={t.opening} className={cn('rounded-lg border border-card-edge bg-card p-3.5', className)}>
      <SkeletonBar className="h-4 w-1/3" />
      <SkeletonText lines={2} className="mt-3" />
    </Skeleton>
  );
}

/*
 * ── Last week's action items ────────────────────────────────────────────────────────────────────
 */

/**
 * *Tindakan minggu lalu* (`Overall.html:4186-4189`, `:10717-10734`; UI-061): the items of the coachee's latest finalized
 * session, whoever led it, each **the compact action row with a checkbox** — the date (changeable while the session is
 * open), the words, the lead after a person icon. **Ticking one writes the tick on this session** — the session it came
 * from is frozen (P11-T5 AC-2). Each row says its save under it (P18.95-T1 AC-5). Not drawn for a coachee with no
 * earlier session.
 */
function LastWeekCard({
  session, draft, locked, className,
}: { session: CoachingSession; draft: SessionDraft; locked: boolean; className?: string }) {
  const figures = useFigureLanguage();
  const t = useMessages(coachingSessionMessages).agreement;
  const rows = draft.state?.lastWeek ?? [];
  return (
    <SessionPanel
      card="last-week"
      className={className}
      title={t.lastWeek}
      aside={session.lastWeek ? (
        <span className="text-sm text-muted">{t.fromSession({ day: actionDay(session.lastWeek.date, figures), coach: null })}</span>
      ) : undefined}
    >
      <ul className="divide-y divide-divider">
        {session.lastWeekItems.map((item, i) => {
          const row = rows.find((r) => r.itemId === item.itemId) ?? { itemId: item.itemId, done: item.done, dueDate: item.dueDate };
          const field = `lastWeek:${item.itemId}`;
          const set = (patch: Partial<DraftLastWeek>) => draft.commit(
            (d) => ({ ...d, lastWeek: d.lastWeek.map((r) => (r.itemId === item.itemId ? { ...r, ...patch } : r)) }),
            field,
          );
          return (
            <li key={item.itemId}>
              <ActionRow
                date={row.dueDate}
                onDateChange={locked ? undefined : (dueDate) => set({ dueDate })}
                text={item.text}
                person={item.lead?.name}
                control={{ kind: 'check', checked: row.done, disabled: locked, onChange: (done) => set({ done }) }}
              />
              <InlineSaveStatus {...draft.status(field)} label={item.text || t.item({ n: i + 1 })} className="-mt-1 mb-1.5 pl-[58px]" />
            </li>
          );
        })}
      </ul>
    </SessionPanel>
  );
}

/*
 * ── The Goal card ───────────────────────────────────────────────────────────────────────────────
 */

/**
 * *Goal* (`Overall.html:4192-4214`; ADR-0075, contradiction #1; UI-062: **two tiles side by side**, *Bulan ini* and
 * *Tahun ini*): what was produced, over the target, the percentage — whole (UI-080) — and the bar, **each the figure the
 * Summary shows for the same period**, from the coachee's `GET /summary?for=`, *Belum diunggah* included.
 *
 * **Only the annual target is editable, and only by a deliberate save** — never on a keystroke or a blur — through
 * `PUT /goals/:period?for=&session=`, which carries the leader's name and makes every save in this session one notice
 * to the coachee. The target in the year's tile is the control (a dotted underline); the box opens under the tiles.
 * This month's target moves only by its formula (ADR-0056). **One money formatter** (F-02): `formatRupiahCompact`.
 *
 * **It says so once the card shows it** (P11-T8's browser walk): the figures are read again first, and only then does
 * the box close and the toast say the goal was updated — never over the old target.
 */
function GoalCard({
  coachee, sessionId, editable, onSaved, className,
}: { coachee: Coachee; sessionId: string; editable: boolean; onSaved: () => void; className?: string }) {
  const figures = useFigureLanguage();
  const t = useMessages(coachingSessionMessages).goal;
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
    <form onSubmit={(e) => void save(e)} className="mt-2.5 flex flex-wrap items-center gap-2">
      <TextInput
        id={inputId}
        prefix={moneyPrefix(figures)}
        aria-label={t.annualTarget}
        inputMode="numeric"
        className="w-48"
        value={typed === '' ? '' : groupDigits(parseDigits(typed), figures)}
        readOnly={saving}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
      />
      <Button type="submit" disabled={saving}>{t.save}</Button>
      <Button variant="secondary" onClick={cancel} disabled={saving}>{t.cancel}</Button>
    </form>
  );

  const money = (minor: number) => formatRupiahCompact(minor, {}, figures);
  return (
    <SessionPanel
      card="goal"
      className={className}
      title={t.title}
      aside={editable && !noGoal && summary && !editing ? <span className="text-xs text-muted max-md:hidden">{t.tapToEdit}</span> : undefined}
    >
      {error && <ErrorBanner {...error} />}
      {!summary && !error && (
        <Skeleton label={t.reading}>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {[0, 1].map((i) => <SkeletonBar key={i} className="h-[84px] rounded-row" />)}
          </div>
        </Skeleton>
      )}
      {summary && (noGoal ? (
        <div className="flex flex-col gap-2">
          <p className="text-xl font-bold text-navy">{t.none}</p>
          {editable && (editing ? editor : (
            <Button ref={trigger} variant="inline" className="self-start" onClick={edit}>{t.set}</Button>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <GoalTile
              label={t.monthTile}
              barLabel={t.month}
              figures={summary.monthly}
              target={summary.monthly.targetMinor === null ? '—' : money(summary.monthly.targetMinor)}
            />
            <GoalTile
              label={t.yearTile}
              barLabel={t.year}
              figures={summary.yearly}
              target={editable && !editing ? (
                <button
                  ref={trigger}
                  type="button"
                  onClick={edit}
                  className="rounded-[3px] border-b-[1.5px] border-dashed border-line px-px hover:border-amber focus:border-amber"
                >
                  {money(summary.yearly.targetMinor!)}
                  <span className="sr-only">{t.editTarget}</span>
                </button>
              ) : money(summary.yearly.targetMinor!)}
            />
          </div>
          {editing && editor}
        </>
      ))}
      {saveError && <div className="mt-3"><ErrorBanner {...saveError} /></div>}
    </SessionPanel>
  );
}

/** One of the Goal card's two tiles (UI-062): the period, what was produced, *of* the target and the %, the bar. */
function GoalTile({
  label, barLabel, figures, target,
}: {
  label: string;
  barLabel: string;
  figures: Pick<PeriodFigures, 'actualMinor' | 'attainmentPct'>;
  target: React.ReactNode;
}) {
  const figureLanguage = useFigureLanguage();
  const t = useMessages(coachingSessionMessages).goal;
  const pct = figures.attainmentPct;
  return (
    <div data-goal-tile="" className="min-w-0 rounded-row bg-base px-3 py-2.5">
      <span className="block text-xs text-muted">{label}</span>
      <span className="mt-0.5 block truncate text-xl font-bold text-navy">
        {figures.actualMinor === null
          ? <span className="text-base font-semibold text-muted">{t.notUploaded}</span>
          : formatRupiahCompact(figures.actualMinor, {}, figureLanguage)}
      </span>
      <span className="block text-xs text-muted">
        / {target}
        {pct !== null && <> · <strong className="font-bold text-ink">{formatPercent(pct, {}, figureLanguage)}</strong></>}
      </span>
      {pct !== null && (
        <div
          role="progressbar"
          aria-label={barLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, pct)}
          aria-valuetext={formatPercent(pct, {}, figureLanguage)}
          className="mt-2 h-1.5 overflow-hidden rounded-pill bg-hairline"
        >
          <div className="h-full rounded-pill bg-amber" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
    </div>
  );
}

/*
 * ── Activity ────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * *Aktivitas* · *7 hari terakhir* (`Overall.html:4221-4254`, contradiction #6; UI-062): **the coachee's saved week
 * against pro-rated targets** as three small tiles and the sections' one line (`ActivityTilesCard`). Read again after
 * the annual target is saved (`refresh`): the pro-rated targets are this month's, and this month's follows the goal.
 */
function ActivityCard({ coachee, refresh, className }: { coachee: Coachee; refresh: number; className?: string }) {
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
    <ActivityTilesCard
      className={className}
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
 * The round *+* in a card's head (`Overall.html:4290`, `:4298`) — the primary button made round: it adds, and an
 * action is amber (ADR-0137), its words navy (parity I-542).
 */
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button title={label} aria-label={label} onClick={onClick} className="h-8 w-8 shrink-0 rounded-full px-0">
      <LineIcon name="plus" className="h-[18px] w-[18px]" />
    </Button>
  );
}

/** A row's ✕, a line icon, a 44px target below 1024px. */
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="-my-2 -mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-signal-grey hover:bg-hover-row hover:text-navy lg:h-8 lg:w-8 lg:-my-1 lg:mr-0"
    >
      <LineIcon name="close" className="h-4 w-4" />
    </button>
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

/** The words of a row typed in place (UI-061): 16px so iOS does not zoom, wrapping as they grow, never cut. */
const EDITOR = 'min-h-0 w-full px-0 py-0 text-md leading-snug text-ink';

/**
 * *Tips coaching* (`Overall.html:4287-4293`, `:11011-11038`): *+* adds a blank row and focuses it, *Tulis tipsnya…*,
 * *✕*. No categories (ADR-0083). Each row numbered, its words typed in place, saved when left.
 */
function TipsCard({ draft, locked, className }: { draft: SessionDraft; locked: boolean; className?: string }) {
  const { agreement, tips: t } = useMessages(coachingSessionMessages);
  const tips = draft.state?.tips ?? [];
  const { focus, idOf } = useFocusNew();
  return (
    <SessionPanel
      card="tips"
      className={className}
      title={agreement.tips}
      aside={locked ? undefined : (
        <AddButton
          label={t.add}
          onClick={() => {
            const key = newKey();
            draft.change((d) => ({ ...d, tips: [...d.tips, { key, text: '' }] }));
            focus(key);
          }}
        />
      )}
    >
      {tips.length === 0 ? (
        <p className={EMPTY_LINE}>{locked ? agreement.noTips : t.emptyOpen}</p>
      ) : (
        <ol className="divide-y divide-divider">
          {tips.map((tip, i) => (
            <li key={tip.key} className="flex min-h-10 items-start gap-2.5 py-2">
              <NumberDot n={i + 1} />
              {locked ? (
                <span className="min-w-0 flex-1 text-md text-ink">{tip.text}</span>
              ) : (
                <>
                  {/* The tip says its save under its words, and a retry puts the focus back in it (P18.95-T1 AC-5). */}
                  <InlineSaveField status={draft.status(`tip:${tip.key}`)} label={t.tip({ n: i + 1 })} className="min-w-0 flex-1">
                    <AutoGrowTextarea
                      id={idOf(tip.key)}
                      aria-label={t.tip({ n: i + 1 })}
                      placeholder={t.placeholder}
                      className={EDITOR}
                      value={tip.text}
                      onChange={(e) => {
                        const text = e.target.value;
                        draft.change((d) => ({ ...d, tips: d.tips.map((x) => (x.key === tip.key ? { ...x, text } : x)) }));
                      }}
                      onBlur={() => draft.saveField(`tip:${tip.key}`)}
                    />
                  </InlineSaveField>
                  <RemoveButton
                    label={t.remove({ n: i + 1 })}
                    onClick={() => draft.commit((d) => ({ ...d, tips: d.tips.filter((x) => x.key !== tip.key) }))}
                  />
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </SessionPanel>
  );
}

/**
 * *Tindakan berikutnya* (`Overall.html:4295-4301`, `:11040-11102`; UI-060, UI-061), in the compact action row.
 *
 * - ***Dari leads*** with the ⚡ (D-25; its ⓘ says where they come from): each of the coachee's leads with a next action
 *   date, nearest first, its note or *Follow up with {name}*, the lead's name after it — and a link icon and › that open
 *   the lead's sheet, where it is changed. Not removed here: it is the lead's.
 * - ***Lainnya***: a date and the words, typed in place, by date, undated last, each with a ✕. **A new one is dated a
 *   week from the office's today**, the server's `defaultDueDate` (UI-060: every action always has a date).
 * - **A refusal for a missing date** (UI-060) outlines every undated row in red, its date reading *Pilih tanggal* in
 *   red, and scrolls to the first.
 *
 * *+* refuses to start a second blank row, in the prototype's sentence, said beside the list, and the focus goes to the
 * row already started.
 */
function NextActionsCard({
  draft, leadActions, locked, newRowDate, refusal, onOpenLead, className,
}: {
  draft: SessionDraft;
  leadActions: readonly LeadAction[];
  locked: boolean;
  newRowDate: string;
  refusal: Refusal | null;
  onOpenLead: (leadId: string) => void;
  className?: string;
}) {
  const language = useLanguage();
  const ui = useMessages(uiMessages);
  const { agreement, actions: t } = useMessages(coachingSessionMessages);
  const actions = [...(draft.state?.actions ?? [])].sort(byDueDate);
  const { focus, idOf } = useFocusNew();
  const [guard, setGuard] = useState(false);
  const undated = refusal?.rule === 'UNDATED_ACTION_ITEM';

  // *Finalkan* refused for a missing date: bring the first such row into view (UI-060).
  useEffect(() => {
    if (!undated) return;
    document.querySelector<HTMLElement>('[data-next-actions] [data-action-row][data-invalid]')
      ?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [undated, refusal]);

  function add() {
    const blank = draft.state?.actions.find((a) => !a.text.trim());
    if (blank) {
      setGuard(true);
      document.getElementById(idOf(blank.key))?.focus();
      return;
    }
    setGuard(false);
    const key = newKey();
    draft.change((d) => ({ ...d, actions: [...d.actions, { key, text: '', dueDate: newRowDate }] }));
    focus(key);
  }

  const SUB = 'mt-2 flex items-center gap-1.5 text-base font-semibold text-pill-grey-ink first:mt-0';
  return (
    <SessionPanel card="next" className={className} title={agreement.next} aside={locked ? undefined : <AddButton label={t.add} onClick={add} />}>
      <div data-next-actions="">
        <h3 className={SUB}>
          <AutoMarker name={agreement.fromLeadsShort} explanation={agreement.autoWhy} />
          {agreement.fromLeadsShort}
        </h3>
        {leadActions.length === 0 ? (
          <p className={cn(EMPTY_LINE, 'py-1.5')}>{agreement.noLeadDates}</p>
        ) : (
          <ul className="divide-y divide-divider">
            {leadActions.map((a) => (
              <li key={a.leadId}>
                <ActionRow
                  date={a.dueDate}
                  text={leadActionText(a, language)}
                  person={a.leadName}
                  control={{ kind: 'lead', name: a.leadName, onOpen: () => onOpenLead(a.leadId) }}
                />
              </li>
            ))}
          </ul>
        )}

        <h3 className={SUB}>{agreement.otherShort}</h3>
        {actions.length === 0 ? (
          <p className={cn(EMPTY_LINE, 'py-1.5')}>{locked ? agreement.noOther : t.emptyOpen}</p>
        ) : (
          <ol className="divide-y divide-divider">
            {actions.map((item, i) => {
              const field = `action:${item.key}`;
              return (
                <li key={item.key}>
                  {locked ? (
                    <ActionRow date={item.dueDate} text={item.text} />
                  ) : (
                    <>
                      <ActionRow
                        date={item.dueDate}
                        invalid={undated && !item.dueDate}
                        emptyText={ui.chooseDate}
                        onDateChange={(dueDate) => draft.commit(
                          (d) => ({ ...d, actions: d.actions.map((a) => (a.key === item.key ? { ...a, dueDate } : a)) }),
                          field,
                        )}
                        text={item.text || t.item({ n: i + 1 })}
                        editor={(
                          <InlineSaveField status={draft.status(field)} label={t.item({ n: i + 1 })}>
                          <AutoGrowTextarea
                            id={idOf(item.key)}
                            aria-label={t.item({ n: i + 1 })}
                            placeholder={t.placeholder}
                            className={EDITOR}
                            value={item.text}
                            onChange={(e) => {
                              const text = e.target.value;
                              if (text.trim()) setGuard(false);
                              draft.change((d) => ({ ...d, actions: d.actions.map((a) => (a.key === item.key ? { ...a, text } : a)) }));
                            }}
                            onBlur={() => draft.saveField(field)}
                          />
                          </InlineSaveField>
                        )}
                        control={{
                          kind: 'remove',
                          onRemove: () => {
                            setGuard(false);
                            draft.commit((d) => ({ ...d, actions: d.actions.filter((a) => a.key !== item.key) }));
                          },
                        }}
                      />
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {guard && !locked && (
          <p role="alert" className="mt-2 text-base font-semibold text-alert">{t.guard}</p>
        )}
      </div>
    </SessionPanel>
  );
}

/*
 * ── Finalkan, and Ubah lagi ─────────────────────────────────────────────────────────────────────
 */

/**
 * **Finalkan, always in reach** (UI V1, UI-060, UI-062; D-01): **a bar pinned above the tab bar below 1024px** — the
 * message and the button seen together — and **the foot of the sticky right column on a desktop**.
 *
 * **Open**: *Draf · 6 tindakan* and ***Finalkan sesi ini***. Whatever is unsaved is saved first, then finalize goes with
 * the version that save answered. **A refusal is the server's** — the prototype's five checks, in its order — said
 * **right above the button**, 14px, red, with the alert icon, in an alert region, the button still enabled; a missing
 * date adds **how many rows lack one**, which counts down as each is dated and goes when none is left.
 *
 * **Finalized**: toast *Tersimpan*, then the green ***Difinalkan 30 Okt*** strip and ***Ubah lagi*** (44px), which asks
 * why in a dialog that says the coachee reads the reason (ADR-0079) and reopens the same session as a draft with every
 * field as it was; finalizing again keeps the session's date and counts once (the server's, W1-C). Past the seven days
 * *Ubah lagi* stays, drawn locked, its title saying until when. *Unduh sebagai PDF* under it on a desktop.
 */
function FinalizeBar({
  coachee, session, today, draft, refusal, onRefusal, canFinalize, canReopen, onFinalized, onReopened, onConflict,
}: {
  coachee: Coachee;
  session: CoachingSession;
  today: string;
  draft: SessionDraft;
  refusal: Refusal | null;
  onRefusal: (refusal: Refusal | null) => void;
  canFinalize: boolean;
  canReopen: boolean;
  onFinalized: (session: CoachingSession) => Promise<void>;
  onReopened: (session: CoachingSession) => Promise<void>;
  onConflict: () => void;
}) {
  const figures = useFigureLanguage();
  const language = useLanguage();
  const { me } = useSession();
  const t = useMessages(coachingSessionMessages);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [asking, setAsking] = useState(false);
  const reopenOpened = useOpenedOnce(asking);
  const finalized = session.status === 'finalized';
  const mine = session.coach.membershipId === me?.membership?.membershipId;

  // Below 1024px, pinned above the tab bar (`--tab-bar-space`); from 1024px, a card at the sticky column's foot.
  const FRAME = cn(
    'fixed inset-x-0 bottom-[var(--tab-bar-space,0px)] z-[9] border-t border-hairline bg-card px-3.5 pt-2.5',
    'pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] shadow-bar',
    'lg:static lg:z-auto lg:rounded-lg lg:border lg:border-card-edge lg:p-3.5 lg:shadow-none',
  );

  async function finalize() {
    setBusy(true);
    onRefusal(null);
    setError(null);
    try {
      if (!(await draft.save())) return;
      const next = await finalizeSession(session.sessionId, draft.version());
      await onFinalized(next);
    } catch (err) {
      const shown = toDisplayError(err);
      const sentence = shown.code === 'COACHING_SESSION_INCOMPLETE' ? finalizeRefusal(shown.details, language) : null;
      if (sentence) onRefusal({ sentence, rule: typeof shown.details?.rule === 'string' ? shown.details.rule : null });
      else if (shown.code === 'VERSION_CONFLICT' || shown.code === 'COACHING_SESSION_FINALIZED') onConflict();
      else setError(shown);
    } finally {
      setBusy(false);
    }
  }

  if (!finalized) {
    if (!canFinalize) return null;
    const undated = draft.state?.actions.filter((a) => !a.dueDate).length ?? 0;
    const message = !refusal ? null
      : refusal.rule === 'UNDATED_ACTION_ITEM'
        ? (undated > 0 ? t.bar.count({ sentence: refusal.sentence, n: undated }) : null)
        : refusal.sentence;
    const count = session.leadActions.length + (draft.state?.actions.length ?? 0);
    return (
      <div data-finalize-bar="draft" className={FRAME}>
        {message && (
          <p role="alert" data-finalize-refusal="" className="mb-2 flex items-start gap-1.5 text-md font-medium text-pill-red-ink">
            <LineIcon name="alert" className="mt-px h-[18px] w-[18px]" />
            {message}
          </p>
        )}
        {error && <div className="mb-2"><ErrorBanner {...error} /></div>}
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-base text-muted">{t.bar.draft({ n: count })}</span>
          <Button onClick={() => void finalize()} disabled={busy} className="h-[50px] min-w-0 flex-1 gap-2 rounded-pill text-lg max-lg:h-[50px]">
            <LineIcon name="check" className="h-5 w-5" />
            {t.finalize.button}
          </Button>
        </div>
      </div>
    );
  }

  const closed = reopenWindowClosed(today, session.reopenableUntil);
  const until = session.reopenableUntil ? formatShortDay(session.reopenableUntil, { year: true }, figures) : '';
  return (
    <div data-finalize-bar="finalized" className={FRAME}>
      <div className="flex items-center gap-3">
        <p className="flex h-[50px] min-w-0 flex-1 items-center gap-2 rounded-row bg-pill-green px-3 text-md font-semibold text-pill-green-ink">
          <LineIcon name="checkCircle" className="h-5 w-5" />
          <span className="truncate">{t.bar.finalized({ day: session.date ? actionDay(session.date, figures) : '' })}</span>
        </p>
        {canReopen && session.reopenableUntil !== null && (
          <EditAgainButton closed={closed} until={until} onClick={() => setAsking(true)} className="h-11 shrink-0 rounded-pill px-4" />
        )}
      </div>
      <div className="mt-2.5 max-lg:hidden">
        <DownloadPdfButton sessionId={session.sessionId} showCoach={!mine} className="w-full" />
      </div>
      {reopenOpened && (
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
      )}
    </div>
  );
}
