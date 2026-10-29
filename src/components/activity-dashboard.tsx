'use client';

import Link from 'next/link';
import { Fragment, useEffect, useId, useState, type ReactNode } from 'react';
import { ConfigBadge } from '@/components/ui/config-badge';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { DateField } from '@/components/ui/date-field';
import { ErrorBanner } from '@/components/ui/field';
import { NumberBadge } from '@/components/ui/number-badge';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCards, SkeletonTable } from '@/components/ui/skeleton';
import { TermText } from '@/components/ui/term-tip';
import { SummaryStrip } from '@/components/summary-strip';
import type { MessagesOf } from '@/i18n/catalogue';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { activityMessages } from '@/i18n/messages/activity';
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
import { activityTermMentions, type TermKey } from '@/lib/terms';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { usePhone } from '@/lib/use-phone';

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
 *
 * **Below 768px, each item's total, and a tap for its days** (P18.95-T3 AC-6, ADR-0167 §6; the client's UI
 * review, UI-012: *Total* and every day off the screen to the right). `PhoneTotals`: the table's rows in its
 * order, each a button holding the item's name and total, opening that item's count for each of the period's
 * columns. Asked of the window (`usePhone`) when the panel mounts, before the first answer, so a phone never draws
 * the table first; a tablet and a desktop draw the table they drew (§12).
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
const RANGES = ['ROLLING_7D', 'ROLLING_30D', 'CUSTOM'] as const;

/** The module's words, in the reader's language (`messages/activity.tsx`; P18.98-T4). */
type ActivityWords = MessagesOf<typeof activityMessages.en>;

/**
 * How long a custom date must stay put before it is asked about. A date field typed into a digit at a
 * time passes through `0002`, `0020` and `0202` on its way to `2026`; asking about each is three wasted
 * requests and three refusals read aloud.
 */
const SETTLE_MS = 400;

/**
 * Why a custom range cannot be asked for, or null. Only what needs no server number: the rest is the server's. In the
 * reader's words, its day in the reader's figures (P18.98-T4).
 */
function invalid(from: string, to: string, today: string, t: ActivityWords, figures: Language): string | null {
  if (!from || !to) return t.dashboard.chooseBoth;
  if (from > to) return t.dashboard.startsAfterEnd;
  if (to > today) return t.dashboard.endsAfterToday({ day: formatShortDay(today, { year: true }, figures) });
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
  const t = useMessages(activityMessages);
  const figures = useFigureLanguage();
  const [range, setRange] = useState<DashboardRange>('ROLLING_7D');
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [view, setView] = useState<ActivityDashboard | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  /** A range the server refused — its words, shown where the range is. */
  const [refused, setRefused] = useState<string | null>(null);
  const forId = subject?.membershipId;
  const phone = usePhone();

  const today = view?.today ?? null;
  const problem = range === 'CUSTOM' && custom && today ? invalid(custom.from, custom.to, today, t, figures) : null;

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
  const caption = subject ? t.dashboard.theirs({ name: subject.name }) : t.dashboard.yours;
  const ranges = RANGES.map((id) => ({ id, label: t.dashboard.ranges[id] }));

  return (
    <>
      {error && <ErrorBanner {...error} />}

      <Segmented label={t.dashboard.range} tabs={ranges} active={range} onSelect={choose} className="w-fit [&_button]:whitespace-nowrap [&_button]:px-3.5">
        {() => (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              {range === 'CUSTOM' && custom ? (
                <div className="flex items-center gap-2">
                  <DateField
                    aria-label={t.dashboard.from}
                    value={custom.from}
                    max={today ?? undefined}
                    onChange={(from) => setCustom({ ...custom, from })}
                    className="w-40"
                  />
                  <span className="text-sm text-muted">{t.dashboard.toWord}</span>
                  <DateField
                    aria-label={t.dashboard.to}
                    value={custom.to}
                    max={today ?? undefined}
                    onChange={(to) => setCustom({ ...custom, to })}
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
                    <span className="text-alert">{t.dashboard.pickValid({ reason: problem ?? refused ?? '' })}</span>
                  ) : showing ? (
                    <RangeLabel view={showing} />
                  ) : error ? null : t.dashboard.loading}
                </p>
              )}
            </div>

            {/* Shaped like what is coming: on a phone, its lines (P18.95-T3 AC-6). */}
            {!view && !error && (phone ? (
              <SkeletonCards count={3} label={t.dashboard.loadingList({ caption })} />
            ) : (
              <SkeletonTable
                caption={caption}
                columns={[t.dashboard.activity, t.dashboard.total, ...[1, 2, 3, 4, 5].map((n) => t.dashboard.day({ n }))]}
              />
            ))}

            {showing && <Dashboard view={showing} subject={subject} caption={caption} phone={phone} />}
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
  const t = useMessages(activityMessages);
  const figures = useFigureLanguage();
  return t.dashboard.rangeDays({
    days: <strong className="text-navy">{view.days}</strong>,
    n: view.days,
    from: formatShortDay(view.from, {}, figures),
    to: formatShortDay(view.to, { year: true }, figures),
  });
}

/**
 * A column's heading: the day, or the block and its dates (`Overall.html:5000-5050`) — its words the reader's, its
 * weekday and days in the reader's figures (P18.98-T4).
 */
function heading(bucket: DashboardBucket, index: number, t: ActivityWords, figures: Language): { label: string; detail: string } {
  const dates = bucket.from === bucket.to
    ? formatShortDay(bucket.from, {}, figures)
    : `${formatShortDay(bucket.from, {}, figures)}–${formatShortDay(bucket.to, {}, figures)}`;
  if (bucket.kind === 'day') {
    return { label: formatWeekday(bucket.from, figures), detail: bucket.from.slice(8).replace(/^0/, '') };
  }
  if (bucket.kind === 'week') return { label: t.dashboard.week({ n: index + 1 }), detail: dates };
  return { label: t.dashboard.remaining({ n: bucket.days }), detail: dates };
}

/**
 * Why a row is not one of the sections shown today, in the words of whoever's days they are: *your*, or the coachee's
 * pronoun in English (`PRONOUN_FORMS`), and *-nya* for anybody in Indonesian.
 */
function standingNote(standing: Exclude<DashboardStanding, 'shown'>, t: ActivityWords, subject?: DashboardSubject): string {
  if (standing === 'archived') return t.dashboard.archived;
  return subject ? t.dashboard.notTheirs({ possessive: PRONOUN_FORMS[subject.pronoun].possessive }) : t.dashboard.notYours;
}

/**
 * The strip and the table.
 *
 * **A zero is muted, not dimmed out of sight.** The prototype paints it at 28% navy — 1.75:1,
 * which is below every contrast floor for a number that is information: *nothing that day* is an
 * answer, not a blank.
 */
function Dashboard({
  view, subject, caption, phone,
}: { view: ActivityDashboard; subject?: DashboardSubject; caption: string; phone: boolean }) {
  const t = useMessages(activityMessages);
  const figures = useFigureLanguage();
  const { config } = useTenantConfig();
  const { me } = useSession();
  const columns: Column[] = [
    t.dashboard.activity, t.dashboard.total, ...view.buckets.map((bucket, i) => heading(bucket, i, t, figures)),
  ];
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
  // Which activity first names each term, the table's rows in order (P18.95-T9 AC-3). Not on a phone: its rows are buttons.
  const termsIn = activityTermMentions(view.sections);
  const tiles = summaryTiles(
    config?.activity ?? [],
    subject?.rungCode ?? me?.membership?.orgLevelCode ?? '',
    (category) => totals.get(category.code) ?? 0,
    // What a touch is, once, on the strip's total (P18.95-T9 AC-3; UI-028).
    { label: t.dashboard.totalTouches, value: view.total, term: 'TOUCHES' },
  );

  return (
    <>
      <SummaryStrip tiles={tiles} />

      {view.total === 0 && (
        <p className="mb-3 text-sm text-muted">
          {t.dashboard.nothingLogged}
          {!subject && (
            <>
              {' '}
              <Link href="/activity/log" className="font-semibold text-navy underline">{t.dashboard.logActivity}</Link>
            </>
          )}
        </p>
      )}

      {phone ? <PhoneTotals view={view} subject={subject} caption={caption} /> : (
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
              <Cell className="font-display">{t.dashboard.totalAll}</Cell>
              <Cell className="bg-amber/[0.28] text-center">{view.total}</Cell>
              {view.counts.map((n, i) => (
                <Cell key={i} className="text-center">{n}</Cell>
              ))}
            </Row>
          )}
          {view.sections.map((section) => (
            <SectionRows
              key={section.code || section.label}
              section={section}
              count={count}
              subject={subject}
              terms={termsIn.get(section.code)}
            />
          ))}
        </DataTable>
      )}
    </>
  );
}

function SectionRows({
  section,
  count,
  subject,
  terms,
}: {
  section: ActivityDashboard['sections'][number];
  count: (n: number, key: string) => ReactNode;
  subject?: DashboardSubject;
  /** Which of this section's words first name a term on the screen (`activityTermMentions`, P18.95-T9 AC-3). */
  terms?: Map<string, TermKey[]>;
}) {
  const t = useMessages(activityMessages);
  return (
    <>
      <Row className="bg-navy/5 font-bold">
        <Cell className="font-display">
          {section.label}
          {section.standing !== 'shown' && (
            <ConfigBadge tone="navy" className="ml-2 align-middle">{standingNote(section.standing, t, subject)}</ConfigBadge>
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
                <span className="block"><TermText text={type.label} terms={terms?.get(`${type.code}:label`) ?? []} /></span>
                {type.description && (
                  <span className="mt-0.5 block text-xs italic text-muted">
                    <TermText text={type.description} terms={terms?.get(`${type.code}:description`) ?? []} />
                  </span>
                )}
                {type.standing !== 'shown' && section.standing === 'shown' && (
                  <ConfigBadge tone="navy" className="mt-1">{standingNote(type.standing, t, subject)}</ConfigBadge>
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

/*
 * ── On a phone: totals, and a tap for the days (P18.95-T3 AC-6) ─────────────────────────────────
 */

/** What one line of the phone's list holds: a row of the table. */
interface PhoneItem {
  kind: 'all' | 'section' | 'type';
  label: string;
  /** The type's display number (`NumberBadge`), 0 for none. */
  order: number;
  description: string | null;
  /** Why it is not one of the sections shown today (`standingNote`), or null. */
  note: string | null;
  total: number;
  counts: readonly number[];
}

/**
 * **The table on a phone** (P18.95-T3 AC-6): *Activity* and *Total*, the table's two first columns, a line per row
 * in the table's order — *Total — all categories* first in 30-day mode, then each section and its items — and **a
 * tap on a line shows its count for each column of the period** (a day, or under a longer range a week and the
 * days remaining), each column's name above its count. Each line is a button (`aria-expanded`), so a keyboard opens
 * it as a tap does. The figures are the same answer's, the zero muted as in the table.
 */
function PhoneTotals({ view, subject, caption }: { view: ActivityDashboard; subject?: DashboardSubject; caption: string }) {
  const t = useMessages(activityMessages);
  const figures = useFigureLanguage();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) => setOpen((was) => {
    const next = new Set(was);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const columns = view.buckets.map((bucket, i) => ({ kind: bucket.kind, ...heading(bucket, i, t, figures) }));
  const line = (key: string, item: PhoneItem) => (
    <PhoneLine key={key} item={item} columns={columns} open={open.has(key)} onToggle={() => toggle(key)} />
  );

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card">
      {/* The table's first two headings, over the lines: each line's name is its own. */}
      <p aria-hidden="true" className="flex justify-between border-b border-hairline px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <span>{t.dashboard.activity}</span>
        <span className="pr-6">{t.dashboard.total}</span>
      </p>
      <ul role="list" aria-label={caption}>
        {view.range === 'ROLLING_30D' && line('all', {
          kind: 'all', label: t.dashboard.totalAll, order: 0, description: null, note: null, total: view.total, counts: view.counts,
        })}
        {view.sections.map((section) => {
          const sectionKey = section.code || section.label;
          return (
            <Fragment key={sectionKey}>
              {line(`section:${sectionKey}`, {
                kind: 'section',
                label: section.label,
                order: 0,
                description: null,
                note: section.standing !== 'shown' ? standingNote(section.standing, t, subject) : null,
                total: section.total,
                counts: section.counts,
              })}
              {section.types.map((type) => line(`type:${sectionKey}:${type.code}`, {
                kind: 'type',
                label: type.label,
                order: type.displayOrder,
                description: type.description,
                note: type.standing !== 'shown' && section.standing === 'shown' ? standingNote(type.standing, t, subject) : null,
                total: type.total,
                counts: type.counts,
              }))}
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}

/** One line: its name and total as a button, and under it, once opened, the count for each column. */
function PhoneLine({
  item, columns, open, onToggle,
}: {
  item: PhoneItem;
  columns: readonly { kind: DashboardBucket['kind']; label: string; detail: string }[];
  open: boolean;
  onToggle: () => void;
}) {
  const t = useMessages(activityMessages);
  const panelId = useId();
  return (
    <li
      className={cn(
        'border-b border-hairline last:border-b-0',
        item.kind === 'all' && 'bg-amber/[0.16]',
        item.kind === 'section' && 'bg-navy/5',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={onToggle}
        className="flex min-h-11 w-full items-start gap-2 px-4 py-2.5 text-left text-base text-navy"
      >
        {item.order > 0 && <NumberBadge n={item.order} className="mt-0.5" />}
        <span className="min-w-0 flex-1">
          <span className={cn('block', item.kind !== 'type' && 'font-display font-bold')}>{item.label}</span>
          {item.description && <span className="mt-0.5 block text-xs italic text-muted">{item.description}</span>}
          {item.note && <ConfigBadge tone="navy" className="mt-1">{item.note}</ConfigBadge>}
        </span>
        <span className="shrink-0 font-bold">
          <span className="sr-only">{t.dashboard.totalSaid}</span>
          {item.total}
        </span>
        <span aria-hidden="true" className={cn('w-4 shrink-0 text-center leading-normal text-muted transition-transform', open && 'rotate-180')}>⌄</span>
      </button>
      {open && (
        <dl id={panelId} className="grid grid-cols-4 gap-x-2 gap-y-2.5 px-4 pb-3 pt-0.5">
          {columns.map((column, i) => {
            const n = item.counts[i] ?? 0;
            return (
              <div key={i} className="min-w-0">
                <dt className="text-xs text-muted">
                  {column.kind === 'day' ? `${column.label} ${column.detail}` : (
                    <>
                      <span className="block font-semibold">{column.label}</span>
                      <span className="block">{column.detail}</span>
                    </>
                  )}
                </dt>
                <dd className={cn('text-base', n === 0 ? 'text-muted' : 'font-semibold text-navy')}>{n}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </li>
  );
}
