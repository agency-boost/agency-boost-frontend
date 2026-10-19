'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { ConfigBadge } from '@/components/ui/config-badge';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { ErrorBanner, TextInput } from '@/components/ui/field';
import { NumberBadge } from '@/components/ui/number-badge';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonTable } from '@/components/ui/skeleton';
import { SummaryStrip } from '@/components/summary-strip';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  readActivityDashboard, type ActivityDashboard, type DashboardBucket, type DashboardRange,
  type DashboardStanding,
} from '@/lib/activity';
import { cn } from '@/lib/cn';
import { PRONOUN_FORMS, type Pronoun } from '@/lib/coaching';
import { formatShortDay, formatWeekday } from '@/lib/format';
import { useSession } from '@/lib/session';
import { summaryTiles } from '@/lib/summary-tiles';
import { useTenantConfig } from '@/lib/tenant-config-cache';

/**
 * The Activity Dashboard's body (P10-T1): a member's days over a range, types down and time across
 * (`Overall.html:2737-2773`, `activity-management.md` §2.3) — the range, the strip and the table.
 *
 * **Two places draw it** (P13.1-T9): `/activity/dashboard`, the reader's own, under its title and the
 * activity tabs; and coaching's *Activity* tab, a coachee's, under the person shell. The client asked for
 * the second on 2026-10-07: *"the data on /activity/dashboard should also be shown on
 * /coaching/[membershipId] after the Goal Setting tab and before Training"*. One body, so the two cannot
 * come to disagree about what the same days add up to.
 *
 * **Every number is the server's.** The prototype sums `mockData` in the page, and what the agent
 * saves never reaches it; here the counts are the member's own saved days, corrections included, and
 * the columns are the ones the server cut.
 *
 * **The office's today, not the browser's.** A custom range may end no later than `today` from the
 * last answer — the browser's clock would let an agent in another zone ask for a day that has not
 * happened in the office yet, which the server refuses anyway.
 */

/** Whose days, when they are not the reader's: coaching's *Activity* tab's coachee. */
export interface DashboardSubject {
  membershipId: string;
  name: string;
  pronoun: Pronoun;
  /** Their rung's code: the strip's tiles are the sections *they* are shown (ADR-0020). */
  rungCode: string;
}

/**
 * The prototype's three (`Overall.html:2739-2743`). How long a custom range may be is the server's
 * number (`ACTIVITY.DASHBOARD_RANGE_MAX_DAYS`) and is not restated here: a longer one comes back
 * refused, with the server's words.
 */
const RANGES = [
  { id: 'ROLLING_7D', label: 'Last 7 days' },
  { id: 'ROLLING_30D', label: 'Last 30 days' },
  { id: 'CUSTOM', label: 'Custom' },
] as const;

/**
 * How long a custom date must stay put before it is asked about. A date field typed into a digit at a
 * time passes through `0002`, `0020` and `0202` on its way to `2026`; asking about each is three wasted
 * requests and three refusals read aloud.
 */
const SETTLE_MS = 400;

/** Why a custom range cannot be asked for, or null. Only what needs no server number: the rest is the server's. */
function invalid(from: string, to: string, today: string): string | null {
  if (!from || !to) return 'Choose both dates.';
  if (from > to) return 'The range starts after it ends.';
  if (to > today) return `The range ends after today, ${formatShortDay(today, { year: true })}.`;
  return null;
}

/**
 * The range, the strip and the table, for the reader or for `subject`.
 *
 * **A coachee's** is read from `GET /activity/dashboard?for=` — answered only for somebody the reader
 * coaches, drawn on the coachee's rung, and audited (roles §3.5) — and offers no *Log Activity*: nobody
 * logs another person's day (§3.5), so the link would be an action the API refuses.
 */
export function ActivityDashboardPanel({ subject }: { subject?: DashboardSubject }) {
  const [range, setRange] = useState<DashboardRange>('ROLLING_7D');
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [view, setView] = useState<ActivityDashboard | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  /** A range the server refused — its words, shown where the range is. */
  const [refused, setRefused] = useState<string | null>(null);
  const forId = subject?.membershipId;

  const today = view?.today ?? null;
  const problem = range === 'CUSTOM' && custom && today ? invalid(custom.from, custom.to, today) : null;

  useEffect(() => {
    if (range === 'CUSTOM' && custom && problem) return undefined;
    let live = true;
    setError(null);
    setRefused(null);
    /*
     * Custom chosen before any answer has said what today is: ask for the last seven days, which is
     * the custom range's own default, and take its dates as the custom range's starting point.
     */
    const params = range !== 'CUSTOM' ? { range } : custom ? { range, ...custom } : { range: 'ROLLING_7D' as const };
    const ask = () => readActivityDashboard({ ...params, for: forId })
      .then((next) => {
        if (!live) return;
        setView(next);
        if (range === 'CUSTOM' && !custom) setCustom({ from: next.from, to: next.to });
      })
      .catch((err) => {
        if (!live) return;
        const shown = toDisplayError(err);
        if (shown.code === 'VALIDATION_FAILED') setRefused(shown.message);
        else setError(shown);
      });
    // A preset is one click and is asked at once; a custom date waits until it stops changing.
    const timer = range === 'CUSTOM' && custom ? setTimeout(ask, SETTLE_MS) : (void ask(), null);
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [range, custom, problem, forId]);

  const choose = (id: string) => {
    const next = id as DashboardRange;
    // The prototype's default custom range is the last seven days. Taken from an answer for them rather
    // than worked out here, so the length of that period stays the server's number (invariant §7).
    if (next === 'CUSTOM' && !custom && view?.range === 'ROLLING_7D') setCustom({ from: view.from, to: view.to });
    setRange(next);
  };

  /** The answer for exactly what is asked: a custom answer for other dates is not this one. */
  const current = view && view.range === range
    && (range !== 'CUSTOM' || (custom !== null && view.from === custom.from && view.to === custom.to));
  const showing = current && !problem && !refused ? view : null;
  const caption = subject ? `${subject.name}’s activity` : 'Your activity';

  return (
    <>
      {error && <ErrorBanner {...error} />}

      <Segmented label="Range" tabs={RANGES} active={range} onSelect={choose} className="w-fit [&_button]:whitespace-nowrap [&_button]:px-3.5">
        {() => (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              {range === 'CUSTOM' && custom ? (
                <div className="flex items-center gap-2">
                  <TextInput
                    type="date"
                    aria-label="From"
                    value={custom.from}
                    max={today ?? undefined}
                    onChange={(e) => setCustom({ ...custom, from: e.target.value })}
                    className="w-40"
                  />
                  <span className="text-sm text-muted">to</span>
                  <TextInput
                    type="date"
                    aria-label="To"
                    value={custom.to}
                    max={today ?? undefined}
                    onChange={(e) => setCustom({ ...custom, to: e.target.value })}
                    className="w-40"
                  />
                </div>
              ) : <span />}
              {/*
                * The screen's one live region. It says what the table is showing — or, for a range
                * that cannot be shown, why not, where the dates are (the prototype's *Pick a valid
                * range*, with the reason it never gave).
                *
                * **Mounted from the first answer on, and never again unmounted.** A live region
                * inserted with its text already in it is often not announced, so switching to *Last
                * 30 days* would have said nothing. Until that first answer the skeleton is the one
                * live region; after it, this one says *Loading…* while the next range arrives.
                */}
              {view && (
                <p role="status" className="text-sm text-muted">
                  {problem || refused ? (
                    <span className="text-alert">Pick a valid range — {problem ?? refused}</span>
                  ) : showing ? (
                    <RangeLabel view={showing} />
                  ) : error ? null : 'Loading…'}
                </p>
              )}
            </div>

            {!view && !error && (
              <SkeletonTable
                caption={caption}
                columns={['Activity', 'Total', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5']}
              />
            )}

            {showing && <Dashboard view={showing} subject={subject} caption={caption} />}
          </>
        )}
      </Segmented>
    </>
  );
}

/**
 * How many days, and which.
 *
 * **No *· {n} corrected days* suffix** (P10.1-T5 AC-6). The Dashboard shows sums, not a corrected
 * record: a correction is counted here like any other figure, and Log Activity is where a corrected
 * day says so (ADR-0042). The payload still carries `correctedDays`; nothing here reads it.
 */
function RangeLabel({ view }: { view: ActivityDashboard }) {
  return (
    <>
      <strong className="text-navy">{view.days}</strong> {view.days === 1 ? 'day' : 'days'}
      {' · '}
      {formatShortDay(view.from)} – {formatShortDay(view.to, { year: true })}
    </>
  );
}

/** A column's heading: the day, or the block and its dates (`Overall.html:5000-5050`). */
function heading(bucket: DashboardBucket, index: number): Column {
  const dates = bucket.from === bucket.to
    ? formatShortDay(bucket.from)
    : `${formatShortDay(bucket.from)}–${formatShortDay(bucket.to)}`;
  if (bucket.kind === 'day') return { label: formatWeekday(bucket.from), detail: bucket.from.slice(8).replace(/^0/, '') };
  if (bucket.kind === 'week') return { label: `Week ${index + 1}`, detail: dates };
  return { label: `Remaining ${bucket.days} ${bucket.days === 1 ? 'day' : 'days'}`, detail: dates };
}

/** Why a row is not one of the sections shown today, in the words of whoever's days they are. */
function standingNote(standing: Exclude<DashboardStanding, 'shown'>, subject?: DashboardSubject): string {
  if (standing === 'archived') return 'Archived';
  return `No longer in ${subject ? PRONOUN_FORMS[subject.pronoun].possessive : 'your'} sections`;
}

/**
 * The strip and the table.
 *
 * **A zero is muted, not dimmed out of sight.** The prototype paints it at 28% navy — 1.75:1,
 * which is below every contrast floor for a number that is information: *nothing that day* is an
 * answer, not a blank.
 */
function Dashboard({ view, subject, caption }: { view: ActivityDashboard; subject?: DashboardSubject; caption: string }) {
  const { config } = useTenantConfig();
  const { me } = useSession();
  const columns: Column[] = ['Activity', 'Total', ...view.buckets.map(heading)];
  const count = (n: number, key: string) => (
    <Cell key={key} className={cn('text-center', n === 0 ? 'text-muted' : 'font-medium')}>{n}</Cell>
  );
  /*
   * **The same strip as Log Activity, over the range** (ADR-0064, `Overall.html:2752-2757`).
   *
   * The tiles and their labels are the office's configuration; the numbers are this answer's. A
   * section the server no longer shows this member adds to no tile — its history is in the table
   * and in the total, which is the server's and counts everything. **The member's rung**, which for
   * a coachee is theirs, not the reader's: the server drew the sections on it too.
   */
  const totals = new Map(view.sections
    .filter((s) => s.standing === 'shown')
    .map((s) => [s.code, s.total]));
  const tiles = summaryTiles(
    config?.activity ?? [],
    subject?.rungCode ?? me?.membership?.orgLevelCode ?? '',
    (category) => totals.get(category.code) ?? 0,
    { label: 'Total touches', value: view.total },
  );

  return (
    <>
      <SummaryStrip tiles={tiles} />

      {view.total === 0 && (
        <p className="mb-3 text-sm text-muted">
          Nothing logged in this range yet.
          {!subject && (
            <>
              {' '}
              <Link href="/activity/log" className="font-semibold text-navy underline">Log Activity</Link>
            </>
          )}
        </p>
      )}

      <DataTable
        caption={caption}
        columns={columns}
        density="compact"
        widths={['18.75rem', '4rem', ...view.buckets.map(() => '4.75rem')]}
        tableClassName="min-w-[40rem] [&_td]:py-2 [&_th]:text-center [&_th:first-child]:text-left"
      >
        {/*
          * **In 30-day mode only, as the prototype draws it** (`renderDashboard`, `:5101-5116`).
          * It was on every range as an Improvement (I-135), which ADR-0062 §4 no longer licenses;
          * the strip's total says the same number above the table on every range.
          */}
        {view.range === 'ROLLING_30D' && (
          <Row className="bg-amber/[0.16] font-bold">
            <Cell className="font-display">Total — all categories</Cell>
            <Cell className="bg-amber/[0.28] text-center">{view.total}</Cell>
            {view.counts.map((n, i) => (
              <Cell key={i} className="text-center">{n}</Cell>
            ))}
          </Row>
        )}
        {view.sections.map((section) => (
          <SectionRows key={section.code || section.label} section={section} count={count} subject={subject} />
        ))}
      </DataTable>
    </>
  );
}

function SectionRows({
  section,
  count,
  subject,
}: {
  section: ActivityDashboard['sections'][number];
  count: (n: number, key: string) => ReactNode;
  subject?: DashboardSubject;
}) {
  return (
    <>
      <Row className="bg-navy/5 font-bold">
        <Cell className="font-display">
          {section.label}
          {section.standing !== 'shown' && (
            <ConfigBadge tone="navy" className="ml-2 align-middle">{standingNote(section.standing, subject)}</ConfigBadge>
          )}
        </Cell>
        <Cell className="bg-amber/[0.12] text-center">{section.total}</Cell>
        {section.counts.map((n, i) => (
          <Cell key={i} className="text-center">{n}</Cell>
        ))}
      </Row>
      {section.types.map((type) => (
        <Row key={type.code}>
          <Cell>
            <span className="flex items-start gap-2">
              {type.displayOrder > 0 && <NumberBadge n={type.displayOrder} className="mt-0.5" />}
              <span className="min-w-0">
                <span className="block">{type.label}</span>
                {type.description && (
                  <span className="mt-0.5 block text-xs italic text-muted">{type.description}</span>
                )}
                {type.standing !== 'shown' && section.standing === 'shown' && (
                  <ConfigBadge tone="navy" className="mt-1">{standingNote(type.standing, subject)}</ConfigBadge>
                )}
              </span>
            </span>
          </Cell>
          <Cell className="bg-amber/[0.06] text-center font-bold">{type.total}</Cell>
          {type.counts.map((n, i) => count(n, String(i)))}
        </Row>
      ))}
    </>
  );
}
