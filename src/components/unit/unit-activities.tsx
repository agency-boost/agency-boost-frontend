'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { RatioCard } from '@/components/ratio-card';
import { Avatar } from '@/components/ui/avatar';
import { DateField } from '@/components/ui/date-field';
import { Button, ErrorBanner } from '@/components/ui/field';
import { HEADER_CONTROL } from '@/components/ui/header-control';
import { LineIcon } from '@/components/ui/line-icon';
import { PickerMenu, type PickerItem } from '@/components/ui/picker-menu';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonthLong, formatNumber, formatWeekRange } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import {
  countOf, firstName, readUnitActivities, scopePeople, sectionCount,
  type ActivitiesPerson, type ActivitiesSection, type ActivitiesType, type ActivitySpan, type ScopeTotals,
  type UnitActivitiesView, type UnitScope,
} from '@/lib/unit-dashboard';

/**
 * **The *Aktivitas* tab** (UI V1, Phase 18.11 T4; UI-001, D-17; and the owner's mobile review of 7 November 2026, P19.8-T4:
 * MOB UI-171, UI-180, UI-181, UI-183, UI-184, UI-185; ADR-0229 §1, §5–§7, §9; `unit-mobile-stopmotion-2026-11-07.html`
 * `?tab=aktivitas` and `unit-aktivitas-mobile-2026-11-07.html`): one read, `GET /unit/dashboard/activities`.
 *
 * - **Controls**, the row under the slider (ADR-0229 §1): `[‹] 2 – 8 Nov 2026 [›]` — ‹ › one period, › disabled on the
 *   current one, the date a picker — then *Minggu | Bulan* (a Monday-to-Sunday week by default) and *Unit | Group*. Every
 *   control 13px / 600 / 44px at every size (MOB UI-171, `HEADER_CONTROL`).
 * - **The table**: a sticky *Aktivitas* column, a sticky *Total*, then one column per person — avatar and FIRST NAME.
 *   **On a phone only the person columns slide sideways** (the one sideways scroll, ADR-0227 §6); from 1024px every column
 *   shows. **On a phone a type's name is its *Nama singkat*, on one line** (MOB UI-180) — or, with none, the office's name
 *   on up to two lines — and **a tap on it shows the name in full**; from 768px the office's name, as before. **Each
 *   category row is a subtotal row** (MOB UI-183): its *Total* and one bold count per person (*·* for 0), open or closed;
 *   **activity cells are plain numbers, with no tint** (the heat map, D-17, is gone); the navy *Total* row at the foot.
 *   Counts only, never points; **every figure the server's**, a category's subtotal the sum of its types' counts.
 *   **The two sticky columns are one solid block at every scroll position** (P19.11-T6 AC-2; UX-5): the fixed layout at
 *   every width, the columns sized by a `<colgroup>` and *Total*'s `left` the *Aktivitas* width itself (`STICKY_WIDTHS`).
 * - **The ratio card below** (UI-053's shared card): *Ratio · 30 hari terakhir* at the section titles' size (MOB UI-185),
 *   always the last 30 days, with **one picker, *Unit ⌄*** (MOB UI-184): *Unit*, *Group*, then *PER ORANG* and every
 *   person of the Group. A person is read again with `ratioFor`, and the card shows **their own five ratios** — the table
 *   stays as it is while it is read.
 * - **A leader by role with nobody yet** (MOB UI-181, D-37): the normal table, *0* and *·*, no person column, and the
 *   ratio card with *–* — never a paragraph. Anybody else on a typed address meets the screen's `empty`.
 *
 * Loaded on demand (`next/dynamic`, the screen's): a leader who never opens the tab never downloads it.
 */
export function UnitActivities({
  forId, onHead, empty,
}: {
  forId?: string;
  /** The unit's head, once read: the screen titles a unit below the reader by it. */
  onHead?: (head: UnitActivitiesView['head']) => void;
  /**
   * What the screen draws when the head leads nobody — or `null`, for a leader by role, who sees the normal table at 0
   * (MOB UI-181).
   */
  empty: ReactNode | null;
}) {
  const t = useMessages(unitDashboardMessages);
  const [span, setSpan] = useState<ActivitySpan>('week');
  const [date, setDate] = useState<string | undefined>(undefined);
  const [scope, setScope] = useState<UnitScope>('unit');
  /** The ratio card's choice: the *Unit*, the *Group*, or one person's membership (MOB UI-184). */
  const [who, setWho] = useState<string>('unit');
  const [view, setView] = useState<UnitActivitiesView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const ratioFor = who === 'unit' || who === 'group' ? undefined : who;

  useEffect(() => {
    let live = true;
    setError(null);
    readUnitActivities({ span, date, for: forId, ratioFor })
      .then((answer) => {
        if (!live) return;
        setView(answer);
        onHead?.(answer.head);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [span, date, forId, ratioFor, attempt, onHead]);

  if (error) {
    return (
      <div className="mt-3">
        <ErrorBanner {...error} />
        <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.own.tryAgain}</Button>
      </div>
    );
  }
  if (!view) return <ActivitiesSkeleton />;
  if (view.empty && empty !== null) return <>{empty}</>;

  const personRatios = ratioFor === undefined
    ? null
    : view.ratios.person?.membershipId === ratioFor ? view.ratios.person.ratios : null;
  const ratios = who === 'unit' ? view.ratios.unit : who === 'group' ? view.ratios.group : personRatios;
  const choices: PickerItem[] = [
    { value: 'unit', label: t.v1.scope.unit },
    { value: 'group', label: t.v1.scope.group },
    ...(view.people.length > 0
      ? [{ group: t.v1.perPerson, options: view.people.map((p) => ({ value: p.membershipId, label: p.name })) }]
      : []),
  ];

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
        ratios={ratios}
        days={view.ratios.days}
        headerRight={(
          <PickerMenu
            label={t.v1.ratioFilter}
            value={who}
            options={choices}
            onChange={setWho}
            tone="on-secondary"
            align="end"
            className="ml-auto max-w-[10.5rem]"
          />
        )}
      />
    </div>
  );
}

/**
 * A small segmented control of toggle buttons, one pressed (UI-001): *Minggu | Bulan*, *Unit | Group* — a header control,
 * 13px / 600 / 44px at every size (MOB UI-171, ADR-0227 §1).
 */
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
            'flex-1 whitespace-nowrap rounded-pill px-3',
            HEADER_CONTROL,
            onNavy
              ? value === option.id ? 'bg-white text-navy' : 'text-secondary-contrast'
              : value === option.id ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
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
  const round = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-ink disabled:text-line';
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
          className="h-11 min-w-0 flex-1 rounded-pill border border-hairline bg-card lg:w-56 lg:flex-none"
          faceClassName="justify-center px-4 text-center text-base font-semibold text-ink no-underline"
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

/**
 * **The two sticky columns' widths, said once** (P19.11-T6 AC-2; UX-5): *Aktivitas* `--act` — 132px on a phone, the
 * mockup's, so a short name fits on its line; 120px from 768px; 200px from 1024px — and *Total* `--tot`, 44px, 64px from
 * 1024px. The table wears them; its `<colgroup>` sizes the two columns by them, and *Total*'s `left` **is** `--act`, so
 * the two meet at every breakpoint by construction. A person's column is at least `PERSON_REM` (56px): the table's
 * `min-width` is the sum, so once the people overflow, the table scrolls and each person's column is exactly that.
 *
 * *Changed 2026-11-10 (P19.11-T6 AC-2; UX-5, the owner's screenshot of 9 Nov):* the table was **auto layout below
 * 1024px**, where a cell's width is only a preference. Once the people overflowed, the two sticky columns shrank to their
 * content while *Total* stayed pinned at `left: 8.25rem`, and the people scrolling by showed through the gap between
 * them. Now the **fixed layout at every width**: the columns are the `<colgroup>`'s, never the content's.
 */
const STICKY_WIDTHS = '[--act:8.25rem] [--tot:2.75rem] md:[--act:7.5rem] lg:[--act:12.5rem] lg:[--tot:4rem]';
/** A person's column, at least: the mockup's 56px. */
const PERSON_REM = 3.5;
/**
 * The sticky columns, every row type alike. *Aktivitas*'s words are clipped inside its cell by the words themselves
 * (`truncate`, a phone's face `overflow-hidden`), never by the cell: a phone's tap bubble rises out of it.
 */
const ACTIVITY_COL = 'sticky left-0 z-[1] bg-card';
const TOTAL_COL = 'sticky left-[var(--act)] z-[1] bg-hover-row text-center font-semibold';

/** A count: the number plain, or a light *·* a screen reader hears as 0. `strong` for a category's subtotal. */
function Count({ n, strong = false }: { n: number; strong?: boolean }) {
  const figures = useFigureLanguage();
  if (n === 0) {
    return <><span aria-hidden="true" className="font-normal text-line">·</span><span className="sr-only">{formatNumber(0, {}, figures)}</span></>;
  }
  return <span className={strong ? 'font-extrabold text-ink' : 'text-ink'}>{formatNumber(n, {}, figures)}</span>;
}

/**
 * **The activity table** — exported for `unit-activities.browser.spec.ts` (P19.11-T6 AC-2), which draws it in a real
 * Chrome. `phone` stands in for the width where there is no window to ask (`renderToStaticMarkup`); the screen passes
 * nothing and the table asks `useMediaQuery`.
 */
export function ActivityTable({ view, scope, phone: drawnAsPhone }: { view: UnitActivitiesView; scope: UnitScope; phone?: boolean }) {
  const t = useMessages(unitDashboardMessages);
  const figures = useFigureLanguage();
  const captionId = useId();
  const phoneNow = useMediaQuery('phone');
  const phone = drawnAsPhone ?? phoneNow;
  const people = scopePeople(view, scope);
  const totals: ScopeTotals = view.totals[scope];
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(view.sections.slice(0, 2).map((s) => s.code)));
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
        <table
          aria-labelledby={captionId}
          className={cn('relative w-full table-fixed border-collapse text-base', STICKY_WIDTHS)}
          style={{ minWidth: `calc(var(--act) + var(--tot) + ${people.length * PERSON_REM}rem)` }}
        >
          <caption id={captionId} className="sr-only">{`${t.v1.tabs.activities} · ${t.v1.scope[scope]}`}</caption>
          {/* The columns' widths are these, never the cells' content (P19.11-T6 AC-2): a person's column takes its share. */}
          <colgroup>
            <col data-col="activity" className="w-[var(--act)]" />
            <col data-col="total" className="w-[var(--tot)]" />
            {people.map((person) => <col key={person.membershipId} data-col="person" />)}
          </colgroup>
          <thead>
            <tr className="h-14">
              <th scope="col" className={cn(ACTIVITY_COL, 'truncate px-2.5 text-left text-xs font-semibold text-muted')}>{t.columns.activity}</th>
              <th scope="col" className={cn(TOTAL_COL, 'text-xs text-muted')}>{t.v1.total}</th>
              {people.map((person) => (
                <th key={person.membershipId} scope="col" className="px-0.5 align-middle text-xs font-semibold text-ink">
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
              open={open.has(section.code)}
              onToggle={() => toggle(section.code)}
              phone={phone}
            />
          ))}
          <tfoot>
            <tr className="h-10 bg-secondary text-secondary-contrast">
              <th scope="row" className={cn(ACTIVITY_COL, 'truncate bg-secondary px-2.5 text-left font-semibold')}>{t.v1.total}</th>
              <td className={cn(TOTAL_COL, 'bg-secondary font-semibold')}>{n(totals.total)}</td>
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

/**
 * **A category and its types** (MOB UI-183): the category row is a subtotal row — the button that opens and closes it,
 * its *Total*, and each person's count of its types, bold — whether it is open or closed; its types under it when open.
 */
function SectionRows({
  section, people, totals, open, onToggle, phone,
}: {
  section: ActivitiesSection; people: ActivitiesPerson[]; totals: ScopeTotals; open: boolean; onToggle: () => void;
  phone: boolean;
}) {
  const t = useMessages(unitDashboardMessages);
  const figures = useFigureLanguage();
  const bodyId = useId();
  const n = (v: number) => formatNumber(v, {}, figures);
  return (
    <tbody id={bodyId} data-section={section.code}>
      <tr className="h-11 border-t border-divider bg-hover-row" data-subtotal={section.code}>
        <th scope="row" className={cn(ACTIVITY_COL, 'bg-hover-row p-0 text-left')}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={open ? t.v1.hideSection({ label: section.label }) : t.v1.showSection({ label: section.label })}
            onClick={onToggle}
            className="flex min-h-11 w-full items-center gap-1.5 px-2.5 text-left text-base font-bold text-ink"
          >
            <LineIcon name={open ? 'chevronDown' : 'chevronRight'} className="h-4 w-4 shrink-0 text-signal-grey" />
            <span aria-hidden="true" className="min-w-0 [overflow-wrap:anywhere]">{section.label}</span>
          </button>
        </th>
        <td className={cn(TOTAL_COL, 'bg-base font-bold tabular-nums')}>{n(sectionCount(totals.counts, section))}</td>
        {people.map((person) => (
          <td key={person.membershipId} className="text-center tabular-nums">
            <Count n={sectionCount(person.counts, section)} strong />
          </td>
        ))}
      </tr>
      {open && section.types.map((type) => (
        <tr key={type.code} className="h-11 border-t border-divider" data-type={type.code}>
          <th scope="row" className={cn(ACTIVITY_COL, 'px-2.5 text-left font-normal text-ink')}>
            {phone ? <ShortName type={type} /> : (
              <span title={type.label} className="block truncate">{type.label}</span>
            )}
          </th>
          <td className={cn(TOTAL_COL, 'tabular-nums')}>{n(countOf(totals.counts, type.code))}</td>
          {people.map((person) => (
            <td key={person.membershipId} className="text-center tabular-nums">
              <Count n={countOf(person.counts, type.code)} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

/**
 * **A type's name on a phone** (MOB UI-180; ADR-0229 §5): the office's *Nama singkat* on one line — or its name on up
 * to two lines where it gave none — and a tap shows the name in full. A screen reader hears the full name.
 */
function ShortName({ type }: { type: ActivitiesType }) {
  const short = type.shortLabel?.trim() || null;
  return (
    <TippedGlyph
      glyph={short ?? type.label}
      name={type.label}
      tip={type.label}
      align="fit"
      className="max-w-full"
      face={cn(
        // `max-w-full overflow-hidden`: clipped inside the column, the bubble beside the face untouched (P19.11-T6 AC-2).
        'h-auto min-h-0 w-auto min-w-0 max-w-full justify-start overflow-hidden rounded-none p-0 text-left text-base font-medium leading-snug text-ink',
        short ? 'whitespace-nowrap' : 'line-clamp-2 whitespace-normal [overflow-wrap:anywhere]',
      )}
    />
  );
}

/** The table and the card in outline, while the activities are read. */
function ActivitiesSkeleton() {
  const t = useMessages(unitDashboardMessages).v1;
  return (
    <Skeleton label={t.loadingActivities}>
      <div className="mb-2 flex gap-2"><SkeletonBar className="h-11 flex-1 rounded-pill lg:max-w-xs" /></div>
      <div className="rounded-lg bg-card p-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonBar key={i} className="mt-3 h-4 first:mt-0" />)}
      </div>
      <div className="mt-3 h-40 rounded-lg bg-secondary/20 lg:max-w-xl" />
    </Skeleton>
  );
}
