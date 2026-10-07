'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { DownloadPdfButton } from '@/components/coaching-print';
import {
  ActivityPanel, byDueDate, DateTag, EditAgainButton, EMPTY_LINE, FinalizedBadge, FromLeadTag, GoalRow, GROUP_LABEL,
  NumberDot, RatiosPanel, ReopenDialog,
} from '@/components/coaching-parts';
import {
  BackLink, CoachingTabBar, PersonIdentity, useCoacheeIfAny, useLeadsSomebody,
} from '@/components/coaching-person';
import { SummaryCard } from '@/components/personal-summary';
import { ButtonLink, Card, ErrorBanner } from '@/components/ui/field';
import { useRoleLabel } from '@/components/ui/role-badge';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  agreedVersions, coacheeInitials, coachingArchiveHref, coachingTabHref, firstName, goalHasTarget, myCoachingHref,
  pastSessionSummary, PRONOUN_FORMS, readMySessions, readSession, readSessionShared, reopenWindowClosed, sessionTabHref,
  type ActionItem, type Agreement, type CoachingSession, type CoachingTip, type EarlierVersion, type LastWeekItem,
  type LeadAction, type MySessions, type Pronoun, type SessionSnapshot, type SnapshotGoal,
} from '@/lib/coaching';
import { MY_COACHING_ACTIVATION_HREF } from '@/lib/activation';
import { formatCalendarDayLong, formatDay, formatShortDay } from '@/lib/format';
import { formatRupiah } from '@/lib/goals';
import { useCan, useSession } from '@/lib/session';

/**
 * **The record after the meeting** (P11-T10, `functional/coaching.md`, *Archive* and *`/coaching/me`*):
 * a finalized session as it was agreed, read-only, wherever it is opened.
 *
 * - **The archive** (`/coaching/[membershipId]/archive/[sessionId]`), which a past session's *View →*
 *   opens: the agreement, the figures the 1:1 looked at, every earlier version with who reopened it,
 *   when and why, and the finalized state's own controls — *Edit again* and *⬇ Download as PDF*
 *   (`Overall.html:4309-4312`).
 * - **The reader's own coaching** (`/coaching/me`, `:4384-4600`; ADR-0078): one finalized session about
 *   the reader, chosen from its history, read-only.
 *
 * **Every figure is the snapshot's** (`functional/coaching.md`, *The snapshot*): the goal, the ratios
 * and the last 7 days as they were when the session was first finalized. Nothing here reads the
 * person's goal, leads or log as they are now — a change made since never reaches the record (AC-1).
 * **What was agreed is the latest finalized version**; a session somebody is correcting reads as the
 * version that still counts until the correction is finalized.
 *
 * **The finalized state's idiom** (`Overall.html:1389-1417`): the inputs as text, no add and no remove,
 * the ticks drawn and inert. The archive is a screen the prototype only promised — its rows toasted
 * *"coming next"* (`:10712-10715`) — so its header, the earlier versions and its not-found and draft
 * states are ours, in that idiom (parity L-04). Coaching's own strings use none of ADR-0084's six words.
 */

/*
 * ── The parts of a record ───────────────────────────────────────────────────────────────────────
 */

/**
 * The session header card (`.session-header-card`, `Overall.html:4453-4460`): which session, its tag,
 * who led it — *Coached by {leader}* (`:4458`) — and, where there is a history to choose from,
 * *View past sessions ▾* with the list beneath. *Today's* is not said: a record is any day's.
 */
function RecordHeader({
  date, coach, empty, past,
}: {
  /** The session's own day; `null` before there is one. */
  date: string | null;
  coach: string | null;
  /** In place of the date when there is no session. */
  empty?: string;
  /** The list behind *View past sessions ▾*. */
  past?: ReactNode;
}) {
  const [showPast, setShowPast] = useState(false);
  const listId = useId();
  return (
    <div className="rounded-lg border border-hairline bg-card px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {date ? (
          <p className="text-base text-muted">
            {'Session — '}<strong className="text-navy">{formatCalendarDayLong(date)}</strong>
            {' '}
            <span className="ml-1.5 whitespace-nowrap rounded-pill bg-success/10 px-2.5 py-0.5 text-2xs font-semibold text-success">
              Finalized
            </span>
          </p>
        ) : (
          <p className="text-base text-muted">{empty}</p>
        )}
        {past && (
          <button
            type="button"
            aria-expanded={showPast}
            aria-controls={listId}
            onClick={() => setShowPast((v) => !v)}
            className="rounded-sm text-sm font-semibold text-navy-soft hover:underline"
          >
            {showPast ? 'Hide past sessions' : 'View past sessions'}
            <span aria-hidden="true">{showPast ? ' ▴' : ' ▾'}</span>
          </button>
        )}
      </div>
      {coach && <p className="mt-1 text-sm text-muted">Coached by {coach}</p>}
      {past && (
        <div id={listId} hidden={!showPast} className="mt-3 border-t border-hairline pt-3">
          {past}
        </div>
      )}
    </div>
  );
}

/** A history row: *{date} — {summary}*, then what is on the right (`Overall.html:10708`, `:11373`). */
function HistoryRow({
  href, date, summary, right, current,
}: { href: string; date: string; summary: string; right: string; current?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? 'true' : undefined}
        className={cn(
          'flex items-center justify-between gap-3 rounded-sm py-[7px] text-sm hover:text-navy',
          current ? 'text-navy' : 'text-muted',
        )}
      >
        <span>
          <strong className="text-navy">{formatShortDay(date, { year: true })}</strong> — {summary}
        </span>
        <span className="whitespace-nowrap text-navy-soft">{right}</span>
      </Link>
    </li>
  );
}

const ROW = 'flex min-h-10 flex-wrap items-center gap-2.5 border-b border-hairline py-[9px] last:border-b-0';

/** Last week's items as they were ticked: inert boxes, as the finalized lock leaves them (`:1389-1417`). */
function LastWeekRows({ items }: { items: readonly LastWeekItem[] }) {
  const uid = useId();
  return (
    <ul>
      {items.map((item, i) => (
        <li key={item.itemId} className={ROW}>
          <input
            type="checkbox"
            aria-labelledby={`${uid}-${i}`}
            checked={item.done}
            disabled
            readOnly
            className="h-4 w-4 shrink-0 accent-success opacity-70"
          />
          <DateTag day={item.dueDate} />
          {item.lead && <FromLeadTag name={item.lead.name} />}
          <span id={`${uid}-${i}`} className={cn('min-w-[10rem] flex-1 text-md', item.done ? 'text-muted line-through' : 'text-navy')}>
            {item.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TipRows({ tips }: { tips: readonly CoachingTip[] }) {
  if (tips.length === 0) return <p className={EMPTY_LINE}>No tips were added this session.</p>;
  return (
    <ol>
      {tips.map((tip, i) => (
        <li key={tip.tipId} className="flex items-start gap-2.5 border-b border-hairline py-[9px] text-base text-navy last:border-b-0">
          <NumberDot n={i + 1} />
          <span className="min-w-0 flex-1">{tip.text}</span>
        </li>
      ))}
    </ol>
  );
}

function LeadActionRows({ actions }: { actions: readonly LeadAction[] }) {
  if (actions.length === 0) return <p className={EMPTY_LINE}>No leads have a next action date set yet.</p>;
  return (
    <ul>
      {actions.map((a) => (
        <li key={a.leadId} className={ROW}>
          <DateTag day={a.dueDate} />
          <FromLeadTag name={a.leadName} />
          <span className="min-w-[10rem] flex-1 text-md text-navy">{a.text || `Follow up with ${a.leadName}`}</span>
        </li>
      ))}
    </ul>
  );
}

function ActionRows({ items }: { items: readonly ActionItem[] }) {
  if (items.length === 0) return <p className={EMPTY_LINE}>No other action items were added this session.</p>;
  return (
    <ol>
      {[...items].sort(byDueDate).map((item, i) => (
        <li key={item.itemId} className={ROW}>
          <NumberDot n={i + 1} />
          <DateTag day={item.dueDate} />
          <span className="min-w-[10rem] flex-1 text-md text-navy">{item.text}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The Goal card as the 1:1 saw it (`Overall.html:4192-4214`): the month's and the year's figures from
 * the snapshot, in the one money formatter (F-02). No control and no hint: it is a record. *No goal
 * set* by `goalHasTarget`, the condition the print follows too.
 */
function FrozenGoalCard({ goal }: { goal: SnapshotGoal | null }) {
  return (
    <SummaryCard id="record-goal" title="Goal" className="min-w-0">
      {goalHasTarget(goal) ? (
        <>
          <GoalRow
            figures={goal.monthly}
            period="month"
            target={goal.monthly.targetMinor === null ? '—' : formatRupiah(goal.monthly.targetMinor)}
          />
          <GoalRow figures={goal.yearly} period="year" className="mt-3.5" target={formatRupiah(goal.yearly.targetMinor)} />
        </>
      ) : (
        <p className="font-body text-[1.1875rem] font-bold text-navy">No goal set</p>
      )}
    </SummaryCard>
  );
}

/** What a record draws of a session: the agreement, and the snapshot's figures. */
function RecordBody({
  session, agreement, lastWeekCoach, tipsTitle, ratiosEmpty, withActivity,
}: {
  session: CoachingSession;
  agreement: Agreement;
  /** Who led last week's session, for its tag on the reader's own page (`Overall.html:4463`). */
  lastWeekCoach?: string | null;
  tipsTitle: string;
  ratiosEmpty: string;
  /** The archive draws the Activity card; the reader's own page has none (`Overall.html:4491-4500`). */
  withActivity: boolean;
}) {
  const snapshot: SessionSnapshot | null = session.snapshot ?? null;
  const from = session.lastWeek;
  return (
    <>
      {from && agreement.lastWeekItems.length > 0 && (
        <SummaryCard
          id="record-last-week"
          title="Last week's action items"
          tag={`From ${formatShortDay(from.date)} session${lastWeekCoach ? ` · ${lastWeekCoach}` : ''}`}
        >
          <LastWeekRows items={agreement.lastWeekItems} />
        </SummaryCard>
      )}

      {snapshot && (
        <>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <FrozenGoalCard goal={snapshot.goal} />
            <RatiosPanel rows={snapshot.ratios?.rows ?? []} error={null} emptyLine={ratiosEmpty} />
          </div>
          {withActivity && (
            <ActivityPanel
              name={session.coachee.name}
              week={{ targets: snapshot.activity?.targets ?? [], sections: snapshot.activity?.sections ?? [] }}
              error={null}
            />
          )}
        </>
      )}

      <SummaryCard id="record-tips" title={tipsTitle}>
        <TipRows tips={agreement.tips} />
      </SummaryCard>

      <SummaryCard id="record-next" title="Next action items">
        <h3 className={GROUP_LABEL}>From leads (automatic)</h3>
        <LeadActionRows actions={agreement.leadActions} />
        <h3 className={GROUP_LABEL}>Other action items</h3>
        <ActionRows items={agreement.actionItems} />
      </SummaryCard>
    </>
  );
}

/** `formatDay` for an instant, and the name when the server could give one. */
const byWhom = (when: string, person: { name: string }) =>
  `${formatDay(when)}${person.name ? ` by ${person.name}` : ''}`;

/**
 * **Every earlier version, with who reopened it, when and why** (ADR-0079, ADR-0042; P11-T10 AC-1). A
 * correction replaces what was agreed and keeps what it replaced: each is listed oldest first, with the
 * reason the coachee was told they would read, and opens to what it agreed. The prototype's *Edit
 * again* left no trace (`Overall.html:11132-11143`); ours to draw, in the record's idiom.
 */
function EarlierVersions({ versions }: { versions: readonly EarlierVersion[] }) {
  if (versions.length === 0) return null;
  return (
    <SummaryCard id="record-earlier" title="Earlier versions">
      <ol>
        {versions.map((version, i) => <EarlierVersionRow key={`${version.reopenedAt}-${i}`} version={version} />)}
      </ol>
    </SummaryCard>
  );
}

function EarlierVersionRow({ version }: { version: EarlierVersion }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <li className="border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0">
      <p className="text-md font-semibold text-navy">Finalized {byWhom(version.finalizedAt, version.finalizedBy)}</p>
      <p className="mt-0.5 text-sm text-muted">Reopened {byWhom(version.reopenedAt, version.reopenedBy)}</p>
      <p className="mt-1 text-sm text-navy">Reason: {version.reason}</p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className="mt-1.5 rounded-sm text-sm font-semibold text-navy-soft hover:underline"
      >
        {open ? 'Hide what it agreed' : 'View what it agreed'}
        <span aria-hidden="true">{open ? ' ▴' : ' ▾'}</span>
      </button>
      <div id={bodyId} hidden={!open} className="mt-2">
        {version.lastWeekItems.length > 0 && (
          <>
            <h3 className={GROUP_LABEL}>Last week&apos;s action items</h3>
            <LastWeekRows items={version.lastWeekItems} />
          </>
        )}
        <h3 className={GROUP_LABEL}>Coaching tips</h3>
        <TipRows tips={version.tips} />
        <h3 className={GROUP_LABEL}>From leads (automatic)</h3>
        <LeadActionRows actions={version.leadActions} />
        <h3 className={GROUP_LABEL}>Other action items</h3>
        <ActionRows items={version.actionItems} />
      </div>
    </li>
  );
}

function RecordSkeleton({ label }: { label: string }) {
  return (
    <Skeleton label={label} className="rounded-lg border border-hairline bg-card px-[22px] py-[18px]">
      <SkeletonBar className="h-4 w-1/3" />
      <SkeletonText lines={3} className="mt-3" />
    </Skeleton>
  );
}

const ratiosFor = (pronoun: Pronoun) => `There are no ratios for ${PRONOUN_FORMS[pronoun].possessive} role yet.`;

/*
 * ── The archive ─────────────────────────────────────────────────────────────────────────────────
 */

/**
 * One past session (`/coaching/[membershipId]/archive/[sessionId]`, P11-T10 AC-1, AC-2, AC-9): what it
 * agreed, the figures the 1:1 looked at, its earlier versions, *Edit again* for a reader who may reopen
 * it, and *⬇ Download as PDF*.
 *
 * **One read**, `GET /coaching/sessions/:sessionId`, which the server answers to whoever may read the
 * session and audits: joined, not repeated, by an identical read while it is out (`readSessionShared`,
 * F5 of P11's final walk), and made once the page has its address, which it reads without suspending
 * (the route's page). Inside the person shell for a reader who coaches the person; **on its own, under
 * the way back, for a former coach** whose edge has closed, which the shell decides (ADR-0082). A
 * session the reader may not read, or one the address puts under somebody else, is not found.
 *
 * ***Edit again*** asks the reason, reopens, and opens the correction on the *Coaching Session* tab
 * (`?session=`), where its coach finishes it. A correction already open is reached by the same button.
 */
export function SessionArchive({ membershipId, sessionId }: { membershipId: string; sessionId: string }) {
  const coachee = useCoacheeIfAny();
  const { me } = useSession();
  const canReopen = useCan('coaching_session:reopen');
  const router = useRouter();
  const [session, setSession] = useState<CoachingSession | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [missing, setMissing] = useState(false);
  const [asking, setAsking] = useState(false);

  const load = useCallback(async () => {
    try {
      const read = await readSessionShared(sessionId);
      // An address that puts the session under somebody else is not this session's address.
      if (read.coachee.membershipId !== membershipId) setMissing(true);
      else setSession(read);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
      else setError(toDisplayError(err));
    }
  }, [membershipId, sessionId]);

  useEffect(() => { void load(); }, [load]);

  if (missing) return <ArchiveNotFound />;

  const record = session ? agreedVersions(session) : null;
  const mine = session !== null && session.coach.membershipId === me?.membership?.membershipId;
  const closed = reopenWindowClosed(coachee?.today ?? '', session?.reopenableUntil ?? null);
  const until = session?.reopenableUntil ? formatShortDay(session.reopenableUntil, { year: true }) : '';

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {!coachee && session && (
        <PersonIdentity initials={coacheeInitials(session.coachee.name)} name={session.coachee.name} line={null} />
      )}
      {error && <ErrorBanner {...error} />}
      {!session && !error && <RecordSkeleton label="Opening the session…" />}

      {session && !record && (
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">This session hasn’t been finalized yet.</h2>
          <p className="mt-1 text-md text-muted">Until it is, it is open on Coaching Session.</p>
          <ButtonLink href={coachingTabHref(membershipId, 'session')} variant="secondary" className="mt-3">
            Coaching Session
          </ButtonLink>
        </Card>
      )}

      {session && record && (
        <>
          <RecordHeader date={session.date} coach={session.coach.name} />
          <RecordBody
            session={session}
            agreement={record.agreed}
            tipsTitle="Coaching tips"
            ratiosEmpty={ratiosFor(coachee?.pronoun ?? 'they')}
            withActivity
          />

          <div className="rounded-lg border border-hairline bg-card px-[22px] py-[18px] text-center">
            <FinalizedBadge date={session.date} />
            <div className="mt-3.5 flex flex-wrap justify-center gap-2.5 empty:hidden">
              {session.status === 'reopened' && mine ? (
                // Already reopened, by this reader: the correction is open on the tab.
                <ButtonLink href={sessionTabHref(membershipId, session.sessionId)} variant="secondary">Edit again</ButtonLink>
              ) : canReopen && session.reopenableUntil !== null && (
                <EditAgainButton closed={closed} until={until} onClick={() => setAsking(true)} />
              )}
              <DownloadPdfButton sessionId={session.sessionId} showCoach={!mine} />
            </div>
            <ReopenDialog
              open={asking}
              coacheeName={session.coachee.name}
              session={session}
              onClose={() => setAsking(false)}
              onReopened={async (next) => {
                setAsking(false);
                // Its coach finishes the correction on the tab; anybody else reads the version that still counts.
                if (next.coach.membershipId === me?.membership?.membershipId) router.push(sessionTabHref(membershipId, next.sessionId));
                else await load();
              }}
              onConflict={() => {
                setAsking(false);
                void load();
              }}
            />
          </div>

          <EarlierVersions versions={record.earlier} />
        </>
      )}
    </div>
  );
}

/**
 * Not found (L-01): one sentence for every reason, so it says nothing about who exists. None of the six
 * words. *Everyone you coach is on Coaching Session* only to a reader who leads somebody: for anybody
 * else the roster is empty, and the way back above goes to their own coaching (F4 of P11's final walk).
 */
function ArchiveNotFound() {
  const leads = useLeadsSomebody();
  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-navy">This session isn’t one you can open.</h2>
      <p className="mt-1 text-md text-muted">
        The address may be mistyped.{leads && ' Everyone you coach is on Coaching Session.'}
      </p>
    </Card>
  );
}

/*
 * ── /coaching/me ────────────────────────────────────────────────────────────────────────────────
 */

/** `/coaching/me`'s tabs, by key. */
export type MyCoachingTab = 'session' | 'activation';

/**
 * `/coaching/me`'s head (`Overall.html:4384-4404`): the way back for a reader who leads somebody, the
 * reader's initials, name and *{rung} · Your own coaching*, and the tabs — the session's page and the
 * *Activation* tab's (P13-T9 AC-4) each marking itself current.
 */
export function MyCoachingHeader({ current }: { current: MyCoachingTab }) {
  const { me } = useSession();
  const rung = useRoleLabel(me?.membership?.orgLevelCode ?? '');
  const name = me?.user.fullName ?? '';
  const leads = useLeadsSomebody();
  return (
    <>
      {leads && <BackLink />}
      <PersonIdentity initials={me?.user.initials ?? coacheeInitials(name)} name={name} line={`${rung} · Your own coaching`} />
      <CoachingTabBar
        items={[
          { key: 'summary', label: 'Personal Summary', href: '/summary' },
          { key: 'goal-setting', label: 'Goal Setting', href: '/goals' },
          // P13.1-T9: the person shell's *Activity* tab, mirrored as the two before it are — the reader's own screen.
          { key: 'activity', label: 'Activity', href: '/activity/dashboard' },
          { key: 'training', label: 'Training', href: null },
          { key: 'activation', label: 'Activation', href: MY_COACHING_ACTIVATION_HREF, current: current === 'activation' },
          { key: 'session', label: 'Coaching Session', href: myCoachingHref(), current: current === 'session' },
        ]}
      />
    </>
  );
}

/**
 * The reader's own coaching (`/coaching/me`, `Overall.html:4384-4600`; ADR-0078, P11-T10 AC-4, AC-8,
 * AC-10). **Read-only**: no *Start*, no *Finalize*, no *Edit again*, no Leads card, no Activity card,
 * no Leader Notes tab, and no note in any payload.
 *
 * - **The header** is the reader's: their initials, their name, and *{rung} · Your own coaching*. The
 *   way back to the roster only for a reader who leads somebody: for anybody else the roster is empty.
 * - **The tabs**, without *🔒 Leader Notes*: *Personal Summary* and *Goal Setting* open the reader's own
 *   `/summary` and `/goals`, and *Activity* their own `/activity/dashboard` (P13.1-T9); *Training* cannot
 *   be followed yet, as in the person shell; *Activation*
 *   opens the reader's own checklist (P13-T9 AC-4); *Coaching Session* is this page.
 * - **One finalized session**: the latest, or the one the address names (`?session=`, the finalize
 *   notice's address). *View past sessions ▾* lists the others, each *Coached by {leader}*
 *   (`:11373`), and opens the one chosen.
 * - **Sessions you led** (ADR-0088, AC-10): a reader who led somebody they no longer coach finds those
 *   sessions in the same list, under their own heading, each opening its archive. The smallest form,
 *   inside a control the page already has.
 * - **The session**: last week's items with their ticks, the goal and the ratios as frozen,
 *   *Coaching tips from {coach}* (`:4532`), the next actions, every earlier version with its reason (the
 *   reason is written for the coachee to read, ADR-0079), and *⬇ Download as PDF*.
 */
export function MyCoaching({ selected }: { selected?: string }) {
  const [mine, setMine] = useState<MySessions | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [session, setSession] = useState<CoachingSession | null>(null);
  const [sessionError, setSessionError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    readMySessions()
      .then((next) => { if (live) setMine(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, []);

  const chosen = mine ? (mine.sessions.find((s) => s.sessionId === selected) ?? mine.sessions[0] ?? null) : null;
  const chosenId = chosen?.sessionId ?? null;

  useEffect(() => {
    if (!chosenId) return;
    let live = true;
    setSession(null);
    setSessionError(null);
    readSession(chosenId)
      .then((next) => { if (live) setSession(next); })
      .catch((err) => { if (live) setSessionError(toDisplayError(err)); });
    return () => { live = false; };
  }, [chosenId]);

  const record = session ? agreedVersions(session) : null;
  const coachOf = (sessionId: string) => mine?.sessions.find((s) => s.sessionId === sessionId)?.coach.name ?? null;
  const hasPast = mine !== null && (mine.sessions.length > 0 || mine.ledFormerly.length > 0);

  return (
    <div>
      <MyCoachingHeader current="session" />

      {error && <ErrorBanner {...error} />}
      {!mine && !error && <RecordSkeleton label="Reading your coaching…" />}

      {mine && (
        <div className="flex min-w-0 flex-col gap-4">
          <RecordHeader
            date={chosen?.date ?? null}
            coach={chosen?.coach.name ?? null}
            empty="No coaching sessions yet."
            past={hasPast ? (
              <>
                {mine.sessions.length > 0 && (
                  <ul>
                    {mine.sessions.map((past) => (
                      <HistoryRow
                        key={past.sessionId}
                        href={myCoachingHref(past.sessionId)}
                        date={past.date}
                        summary={pastSessionSummary(past)}
                        right={`Coached by ${past.coach.name}`}
                        current={past.sessionId === chosenId}
                      />
                    ))}
                  </ul>
                )}
                {mine.ledFormerly.length > 0 && (
                  <>
                    <h3 className={cn(GROUP_LABEL, mine.sessions.length > 0 && 'mt-3.5')}>Sessions you led</h3>
                    <ul>
                      {mine.ledFormerly.map((led) => (
                        <HistoryRow
                          key={led.sessionId}
                          href={coachingArchiveHref(led.coachee.membershipId, led.sessionId)}
                          date={led.date}
                          summary={`${led.coachee.name} · ${pastSessionSummary(led)}`}
                          right="View →"
                        />
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : undefined}
          />

          {chosen && sessionError && <ErrorBanner {...sessionError} />}
          {chosen && !session && !sessionError && <RecordSkeleton label="Opening the session…" />}

          {session && record && (
            <>
              <RecordBody
                session={session}
                agreement={record.agreed}
                lastWeekCoach={session.lastWeek ? coachOf(session.lastWeek.sessionId) : null}
                tipsTitle={`Coaching tips from ${firstName(session.coach.name)}`}
                ratiosEmpty="There are no ratios for your role yet."
                withActivity={false}
              />
              <div className="rounded-lg border border-hairline bg-card px-[22px] py-[18px] text-center">
                <FinalizedBadge date={session.date} />
                <div className="mt-3.5 flex flex-wrap justify-center gap-2.5 empty:hidden">
                  <DownloadPdfButton sessionId={session.sessionId} showCoach />
                </div>
              </div>
              <EarlierVersions versions={record.earlier} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
