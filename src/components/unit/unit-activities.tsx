'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { RatioCard } from '@/components/ratio-card';
import { Avatar } from '@/components/ui/person-row';
import { DateField } from '@/components/ui/date-field';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonthLong, formatNumber, formatWeekRange } from '@/lib/format';
import {
  countOf, firstName, heatStep, readUnitActivities, scopePeople,
  type ActivitiesPerson, type ActivitiesSection, type ActivitySpan, type ScopeTotals, type UnitActivitiesView,
  type UnitScope,
} from '@/lib/unit-dashboard';

/**
 * **The *Activities* tab** (UI V1, Phase 18.99 T4; UI-001, D-17; `unit-dashboard-mobile` screen 3,
 * `unit-dashboard-desktop` *Activities*): one read, `GET /unit/dashboard/activities`.
 *
 * - **Controls**: `[‹] 26 Okt – 1 Nov 2026 [›]` — ‹ › one period, › disabled on the current one, the date a picker —
 *   then *Minggu | Bulan* (a Monday-to-Sunday week by default) and *Unit | Group*. The Overview's period is not here.
 * - **The table**: a sticky *Aktivitas* column (the office's own names, one line), a sticky tinted *Total*, then one
 *   column per person — avatar and FIRST NAME. **On a phone only the person columns slide sideways** (the one sideways
 *   scroll the report allows); from 1024px every column shows. Collapsible section rows, the office's (*Leads
 *   generation*, *Selling*, …), the first two open; a zero is a light *·*, anything else tinted by its size; a navy
 *   *Total* row. Counts only, never points. **The *Total* column and row are the server's sums.**
 * - **The ratio card below** (UI-053's shared card, rows, O-3): *Ratio · 30 hari terakhir* with its own *Unit | Group*,
 *   Unit first, always the last 30 days — it does not follow ‹ ›.
 *
 * Loaded on demand (`next/dynamic`, the screen's): a leader who never opens the tab never downloads it.
 */
export function UnitActivities({
  forId, onHead, empty,
}: {
  forId?: string;
  /** The unit's head, once read: the screen titles a unit below the reader by it. */
  onHead?: (head: UnitActivitiesView['head']) => void;
  /** The head leads nobody: what the screen draws instead. */
  empty: ReactNode;
}) {
  const t = useMessages(unitDashboardMessages);
  const [span, setSpan] = useState<ActivitySpan>('week');
  const [date, setDate] = useState<string | undefined>(undefined);
  const [scope, setScope] = useState<UnitScope>('unit');
  const [ratioScope, setRatioScope] = useState<UnitScope>('unit');
  const [view, setView] = useState<UnitActivitiesView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    readUnitActivities({ span, date, for: forId })
      .then((answer) => {
        if (!live) return;
        setView(answer);
        onHead?.(answer.head);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [span, date, forId, attempt, onHead]);

  if (error) {
    return (
      <div className="mt-3">
        <ErrorBanner {...error} />
        <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.own.tryAgain}</Button>
      </div>
    );
  }
  if (!view) return <ActivitiesSkeleton />;
  if (view.empty) return <>{empty}</>;

  return (
    <div data-unit-activities="">
      <Controls
        view={view}
        span={span}
        onSpan={(next) => { setSpan(next); setDate(undefined); }}
        onDate={setDate}
        scope={scope}
        onScope={setScope}
      />
      <ActivityTable view={view} scope={scope} />
      <RatioCard
        className="mt-3 lg:max-w-xl"
        ratios={view.ratios[ratioScope]}
        days={view.ratios.days}
        headerRight={(
          <Segmented
            label={t.v1.scopeLabel}
            value={ratioScope}
            onChange={setRatioScope}
            options={[{ id: 'unit', label: t.v1.scope.unit }, { id: 'group', label: t.v1.scope.group }]}
            onNavy
          />
        )}
      />
    </div>
  );
}

/** A small segmented control of toggle buttons, one pressed (UI-001): *Minggu | Bulan*, *Unit | Group*. */
export function Segmented<T extends string>({
  label, value, onChange, options, onNavy = false, className,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly { id: T; label: string }[];
  /** On the ratio card's navy: the pressed one white. */
  onNavy?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex rounded-pill p-[3px]', onNavy ? 'bg-white/15' : 'bg-card', className)}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'min-h-11 flex-1 whitespace-nowrap rounded-pill px-3 text-sm font-semibold lg:min-h-8',
            onNavy
              ? value === option.id ? 'bg-white text-navy' : 'text-white'
              : value === option.id ? 'bg-navy text-white' : 'text-muted hover:text-navy',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** `[‹] 26 Okt – 1 Nov 2026 [›]`, *Minggu | Bulan*, *Unit | Group*. */
function Controls({
  view, span, onSpan, onDate, scope, onScope,
}: {
  view: UnitActivitiesView; span: ActivitySpan; onSpan: (s: ActivitySpan) => void; onDate: (d: string) => void;
  scope: UnitScope; onScope: (s: UnitScope) => void;
}) {
  const t = useMessages(unitDashboardMessages);
  const figures = useFigureLanguage();
  const { period } = view;
  const label = period.span === 'week'
    ? formatWeekRange(period.from, period.to, figures)
    : `${formatMonthLong(period.from.slice(0, 7), figures)} ${period.from.slice(0, 4)}`;
  const round = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-ink disabled:text-line lg:h-9 lg:w-9';
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 lg:mb-3">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 max-lg:basis-full lg:flex-none">
        <button type="button" aria-label={t.v1.previous} onClick={() => onDate(period.previous)} className={round}>
          <LineIcon name="chevronLeft" className="h-5 w-5" />
        </button>
        {/* The date opens a calendar (UI-001): the shared `DateField`, its face the period's words. */}
        <DateField
          value={period.from}
          onChange={(day) => { if (day) onDate(day > view.today ? view.today : day); }}
          max={view.today}
          density="text"
          glyph="none"
          format={() => label}
          aria-label={`${t.v1.pickDate}: ${label}`}
          className="h-11 min-w-0 flex-1 rounded-pill bg-card lg:h-9 lg:w-56 lg:flex-none"
          faceClassName="justify-center px-4 text-center font-semibold text-ink no-underline max-md:text-base"
        />
        <button
          type="button"
          aria-label={t.v1.next}
          disabled={period.next === null}
          onClick={() => period.next && onDate(period.next)}
          className={round}
        >
          <LineIcon name="chevronRight" className="h-5 w-5" />
        </button>
      </div>
      <Segmented
        className="max-lg:flex-1"
        label={t.period}
        value={span}
        onChange={onSpan}
        options={[{ id: 'week', label: t.v1.span.week }, { id: 'month', label: t.v1.span.month }]}
      />
      <Segmented
        className="max-lg:flex-1"
        label={t.v1.scopeLabel}
        value={scope}
        onChange={onScope}
        options={[{ id: 'unit', label: t.v1.scope.unit }, { id: 'group', label: t.v1.scope.group }]}
      />
    </div>
  );
}

/** The heat map's tints, by step: none, light, middle, strong — the accent, never a raw hex. */
const HEAT = ['', 'bg-amber/10', 'bg-amber/25', 'bg-amber/45'] as const;

/** The sticky columns: *Aktivitas* at the left edge, *Total* right of it. */
const ACTIVITY_COL = 'sticky left-0 z-[1] w-[7.5rem] bg-card lg:w-[12.5rem]';
const TOTAL_COL = 'sticky left-[7.5rem] z-[1] w-11 bg-hover-row text-center font-semibold lg:left-[12.5rem] lg:w-16';

function ActivityTable({ view, scope }: { view: UnitActivitiesView; scope: UnitScope }) {
  const t = useMessages(unitDashboardMessages);
  const figures = useFigureLanguage();
  const captionId = useId();
  const people = scopePeople(view, scope);
  const totals: ScopeTotals = view.totals[scope];
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(view.sections.slice(0, 2).map((s) => s.code)));
  const largest = useMemo(
    () => Math.max(0, ...people.flatMap((p) => p.counts.map((c) => c.count))),
    [people],
  );
  const n = (v: number) => formatNumber(v, {}, figures);
  const toggle = (code: string) => setOpen((now) => {
    const next = new Set(now);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    return next;
  });

  return (
    <div className="overflow-clip rounded-lg bg-card">
      <div className="overflow-x-auto" data-activity-scroll="">
        <table aria-labelledby={captionId} className="relative w-full border-collapse text-base lg:table-fixed">
          <caption id={captionId} className="sr-only">{`${t.v1.tabs.activities} · ${t.v1.scope[scope]}`}</caption>
          <thead>
            <tr className="h-14">
              <th scope="col" className={cn(ACTIVITY_COL, 'px-2.5 text-left text-xs font-semibold text-muted')}>{t.columns.activity}</th>
              <th scope="col" className={cn(TOTAL_COL, 'text-xs text-muted')}>{t.v1.total}</th>
              {people.map((person) => (
                <th key={person.membershipId} scope="col" className="w-14 min-w-14 px-0.5 align-middle text-xs font-semibold text-ink">
                  <span className="flex flex-col items-center gap-0.5">
                    <Avatar name={person.name} seed={person.membershipId} photoUrl={person.photoUrl ?? null} size={28} />
                    <span aria-hidden="true" className="block max-w-full truncate uppercase">{firstName(person.name)}</span>
                    <span className="sr-only">{person.name}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {view.sections.map((section) => (
            <SectionRows
              key={section.code}
              section={section}
              people={people}
              totals={totals}
              largest={largest}
              open={open.has(section.code)}
              onToggle={() => toggle(section.code)}
              span={people.length + 2}
            />
          ))}
          <tfoot>
            <tr className="h-10 bg-navy text-white">
              <th scope="row" className={cn(ACTIVITY_COL, 'bg-navy px-2.5 text-left font-semibold')}>{t.v1.total}</th>
              <td className={cn(TOTAL_COL, 'bg-navy font-semibold')}>{n(totals.total)}</td>
              {people.map((person) => (
                <td key={person.membershipId} className="text-center tabular-nums">{n(person.total)}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function SectionRows({
  section, people, totals, largest, open, onToggle, span,
}: {
  section: ActivitiesSection; people: ActivitiesPerson[]; totals: ScopeTotals; largest: number; open: boolean;
  onToggle: () => void; span: number;
}) {
  const t = useMessages(unitDashboardMessages);
  const figures = useFigureLanguage();
  const bodyId = useId();
  const n = (v: number) => formatNumber(v, {}, figures);
  const sectionTotal = section.types.reduce((sum, type) => sum + countOf(totals.counts, type.code), 0);
  return (
    <tbody id={bodyId} data-section={section.code}>
      <tr className="h-10 bg-hover-row">
        <th scope="rowgroup" colSpan={span} className="p-0 text-left">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={open ? t.v1.hideSection({ label: section.label }) : t.v1.showSection({ label: section.label })}
            onClick={onToggle}
            className="sticky left-0 flex min-h-10 items-center gap-1.5 px-2.5 text-sm font-semibold text-muted"
          >
            <LineIcon name={open ? 'chevronDown' : 'chevronRight'} className="h-4 w-4 shrink-0" />
            <span aria-hidden="true">{open ? section.label : `${section.label} · ${n(sectionTotal)}`}</span>
          </button>
        </th>
      </tr>
      {open && section.types.map((type) => (
        <tr key={type.code} className="h-10 border-t border-divider" data-type={type.code}>
          <th scope="row" title={type.label} className={cn(ACTIVITY_COL, 'max-w-[7.5rem] truncate px-2.5 text-left font-normal text-ink lg:max-w-[12.5rem]')}>
            {type.label}
          </th>
          <td className={cn(TOTAL_COL, 'tabular-nums')}>{n(countOf(totals.counts, type.code))}</td>
          {people.map((person) => {
            const count = countOf(person.counts, type.code);
            return (
              <td key={person.membershipId} className={cn('text-center tabular-nums', HEAT[heatStep(count, largest)])}>
                {count === 0
                  ? <><span aria-hidden="true" className="text-line">·</span><span className="sr-only">{n(0)}</span></>
                  : n(count)}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}

/** The table and the card in outline, while the activities are read. */
function ActivitiesSkeleton() {
  const t = useMessages(unitDashboardMessages).v1;
  return (
    <Skeleton label={t.loadingActivities}>
      <div className="mb-2 flex gap-2"><SkeletonBar className="h-11 flex-1 rounded-pill lg:h-9 lg:max-w-xs" /></div>
      <div className="rounded-lg bg-card p-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonBar key={i} className="mt-3 h-4 first:mt-0" />)}
      </div>
      <div className="mt-3 h-40 rounded-lg bg-navy/20 lg:max-w-xl" />
    </Skeleton>
  );
}
