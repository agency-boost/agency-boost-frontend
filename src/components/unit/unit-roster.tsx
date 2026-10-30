'use client';

import Link from 'next/link';
import { useId, useState, type MouseEvent, type ReactNode } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { PersonRow } from '@/components/ui/person-row';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { cn } from '@/lib/cn';
import { lastOneOnOneLine, rosterStatusLabel, type RosterStatus } from '@/lib/coaching';
import { formatNumber, formatPercent, formatRupiahCompactPair, formatShortDay } from '@/lib/format';
import {
  everyRow, goalMet, goalShare, matchesFilter, rowHref, rowName, rowsOf, statusTally,
  type RosterFilter, type UnitDashboardView, type UnitGroup, type UnitPeriod, type UnitRow, type UnitTotal,
} from '@/lib/unit-dashboard';

/**
 * ***Roster tim Anda*** (UI V1, Phase 18.99 T4; UI-002, UI-005, UI-007, UI-009, UI-011, UI-028;
 * `unit-dashboard-mobile` screens 1–2, `unit-dashboard-desktop` *Overview*). **Three drawings of one roster**, each for
 * its range, never one restyled (the report's *Rules*):
 *
 * - **Below 768px, an accordion by leader** (UI-002): *Unit Anda · 4* first and open, each AAB unit closed, a unit nested
 *   in one inside it; each header 48px with the unit's goal bar and percentage, in place of the old *— Total* card; each
 *   person a 60px row — avatar, NAME, the goal's mini bar, percentage and *Rp 29 jt / 94,7 jt* — with the status pill on
 *   the right. No ⓘ per row, no ⌄, no *Perbarui produksi*, no *+ Tambah agent* (the owner, 30 Oct).
 * - **768–1023px, a table of four** (UI-009): *Nama · Progres goal · Aktivitas · Status*.
 * - **From 1024px, a table of nine and a ›** (UI-009): *Nama · Progres goal · Leads penjualan · Closing · Leads rekrut ·
 *   Potensi rekrut · Aktivitas · 1:1 terakhir · Status*; each unit's header row with its totals and *Active n/m*;
 *   every unit open, its header able to close it; the header sticky; nothing scrolls sideways.
 *
 * **Every row is a link, whole** (UI-011): the reader's own to `/summary`, anybody else's to their agent page on the
 * *Personal Summary* tab, `?from=` this page so its ‹ comes back; somebody whose pages the reader may not open is a
 * row that goes nowhere. **The status pill shows on *Bulan ini* alone** (UI-005), and so do the chips that filter by it
 * (*Semua 12 · Perlu perhatian 5 · Perlu dipantau 3*, UI-002); **one ⓘ** says how a status is decided (UI-007) — beside
 * the title on a phone, on the *Status* heading in a table. *⟳ Last updated 28 Okt 26* is the office's latest production
 * import (UI-028).
 */
export interface RosterProps {
  view: UnitDashboardView;
  period: UnitPeriod;
  /** The address a row's ‹ comes back to: this page, with its period. */
  from: string;
  /** Which range to draw — the screen asks the width before the roster answers. */
  size: 'phone' | 'tablet' | 'desktop';
  /** *+ Tambah agent* and *Perbarui produksi*, on a tablet and a desktop: the screen's. */
  actions?: ReactNode;
  /** A row was followed: the screen keeps the scroll, so ‹ comes back to it (UI-011). */
  onLeave?: () => void;
}

export function UnitRoster({ view, period, from, size, actions, onLeave }: RosterProps) {
  const headingId = useId();
  const language = useLanguage();
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages);
  const [filter, setFilter] = useState<RosterFilter>('all');
  const month = period === 'month';
  const shownFilter: RosterFilter = month ? filter : 'all';
  const tally = statusTally(everyRow(view));

  const statusInfo = month ? (
    <TippedGlyph glyph="ⓘ" name={t.prototype.statusInfo} tip={t.prototype.statusRules} align="fit" className={STATUS_TIP} />
  ) : null;
  const chips = month ? <StatusChips tally={tally} filter={filter} onFilter={setFilter} language={language} /> : null;

  /** A row's link followed (a click on an `<a>` inside the roster): tell the screen, which keeps the scroll. */
  const leaving = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a[href]')) onLeave?.();
  };

  return (
    <section aria-labelledby={headingId} data-roster={size} onClickCapture={leaving} className="mt-3 overflow-clip rounded-lg bg-card lg:mt-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 pb-2 pt-3 md:px-4">
        <h2 id={headingId} className="font-body text-lg font-semibold text-ink">{t.prototype.roster}</h2>
        {size === 'phone' && statusInfo}
        {view.lastUpload && (
          <span data-last-updated="" className="inline-flex items-center gap-1 text-sm text-signal-grey max-md:ml-auto">
            <LineIcon name="refresh" className="h-3.5 w-3.5" />
            {t.v1.lastUpdated({ day: shortDayWithYear(view.lastUpload, figures) })}
          </span>
        )}
        {size !== 'phone' && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {chips}
            {actions}
          </div>
        )}
      </div>
      {size === 'phone' && chips && <div className="px-3 pb-2.5">{chips}</div>}

      {size === 'phone'
        ? <RosterAccordion view={view} period={period} filter={shownFilter} from={from} />
        : <RosterTable view={view} period={period} filter={shownFilter} from={from} wide={size === 'desktop'} headingId={headingId} statusInfo={statusInfo} />}
    </section>
  );
}

/** *Last updated 28 Okt 26* (UI-028): the day and month as the product writes them, and the year's two digits. */
export const shortDayWithYear = (day: string, figures: Parameters<typeof formatShortDay>[2]) =>
  `${formatShortDay(day, {}, figures)} ${day.slice(2, 4)}`;

/** The status rules' bubble, its lines kept, below its glyph. */
const STATUS_TIP = cn(
  'normal-case tracking-normal',
  '[&>[role=tooltip]]:bottom-auto [&>[role=tooltip]]:top-full [&>[role=tooltip]]:mb-0 [&>[role=tooltip]]:mt-1',
  '[&>[role=tooltip]]:w-[250px] [&>[role=tooltip]]:whitespace-pre-line [&>[role=tooltip]]:font-normal',
  '[&>[role=tooltip]]:leading-relaxed',
);

/** `GOAL_PACE_STATUS` as the shared pill's tone (UI-005): red, amber, green, grey — never a dot. */
export const STATUS_TONE: Record<RosterStatus, PillTone> = {
  needs_attention: 'red',
  watch_closely: 'amber',
  on_track: 'green',
  no_goal_set: 'grey',
};

/** The pill a row carries on *Bulan ini*. */
function StatusPill({ status }: { status: RosterStatus }) {
  const language = useLanguage();
  return <TonePill tone={STATUS_TONE[status]}>{rosterStatusLabel(status, language)}</TonePill>;
}

/**
 * *Semua 12 · Perlu perhatian 5 · Perlu dipantau 3* (UI-002): toggle buttons, one pressed; *Semua* navy, each status on
 * its own tint, its count beside its words. A status nobody holds has no chip.
 */
function StatusChips({
  tally, filter, onFilter, language,
}: { tally: Record<RosterFilter, number>; filter: RosterFilter; onFilter: (f: RosterFilter) => void; language: Parameters<typeof rosterStatusLabel>[1] }) {
  const t = useMessages(unitDashboardMessages).v1;
  const chip = (id: RosterFilter, label: string, tint: string) => (
    <button
      key={id}
      type="button"
      aria-pressed={filter === id}
      onClick={() => onFilter(id)}
      className={cn(
        'inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-3 text-sm font-semibold lg:min-h-8',
        tint,
        filter === id && 'outline outline-2 outline-offset-1 outline-navy',
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label={t.filterLabel} className="flex flex-wrap gap-1.5">
      {chip('all', t.all({ n: tally.all }), filter === 'all' ? 'bg-navy text-white' : 'border border-line bg-card text-ink')}
      {tally.needs_attention > 0 && chip(
        'needs_attention', t.withCount({ status: rosterStatusLabel('needs_attention', language), n: tally.needs_attention }),
        'bg-pill-red text-pill-red-ink',
      )}
      {tally.watch_closely > 0 && chip(
        'watch_closely', t.withCount({ status: rosterStatusLabel('watch_closely', language), n: tally.watch_closely }),
        'bg-pill-amber text-pill-amber-ink',
      )}
    </div>
  );
}

/**
 * **A goal's line** (UI-002, UI-005): the 44px mini bar, the percentage — red under 100%, green from it, judged on the
 * server's unrounded figure — and *Rp 29 jt / 94,7 jt* in grey. No goal: *Goal belum diatur*; no upload: a dashed empty
 * bar and *Belum diunggah*; a year made before the month: *Target tahun ini tercapai*. **No figure is shown as 0.**
 */
function GoalLine({ goal, pair = true }: {
  goal: { set?: boolean; targetMinor: number | null; actualMinor: number | null; attainmentPct: number | null };
  /** The *Rp x / y* beside it. */
  pair?: boolean;
}) {
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages);
  const { targetMinor: target, actualMinor: actual } = goal;
  if (goal.set === false || target === null) return <span className="text-signal-grey">{t.own.noGoal}</span>;
  if (target === 0) return <span className="font-semibold text-signal-green">{t.own.targetMade}</span>;
  if (actual === null) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span aria-hidden="true" data-goal-bar="none" className="h-[5px] w-11 shrink-0 rounded-sm border border-dashed border-line" />
        <span className="text-signal-grey">{t.own.notUploaded}</span>
      </span>
    );
  }
  const pct = goal.attainmentPct ?? 0;
  const met = goalMet(pct);
  const bar = goalShare({ ...goal, set: true }) ?? 0;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span aria-hidden="true" data-goal-bar={bar} className="h-[5px] w-11 shrink-0 overflow-hidden rounded-sm bg-base">
        <span className={cn('block h-full', met ? 'bg-signal-green' : 'bg-signal-red')} style={{ width: `${bar}%` }} />
      </span>
      <span className={cn('font-semibold', met ? 'text-signal-green' : 'text-signal-red')}>{formatPercent(pct, {}, figures)}</span>
      {pair && (
        <span className="min-w-0 truncate text-signal-grey">{formatRupiahCompactPair(actual, target, '/', figures)}</span>
      )}
    </span>
  );
}

/** A row's ✓ (`PACING_TO_MAA`), named for a screen reader. */
function MaaMark() {
  const t = useMessages(unitDashboardMessages).own;
  return (
    <span className="shrink-0 font-bold text-signal-green">
      <span aria-hidden="true">✓</span>
      <span className="sr-only">{t.maaMark}</span>
    </span>
  );
}

/** *New hire* before a first sale (ADR-0172 §3): a grey pill, and for a screen reader why the totals leave them out. */
function NewHireTag() {
  const t = useMessages(unitDashboardMessages);
  return (
    <TonePill tone="grey">
      {t.prototype.newHire}
      <span className="sr-only">{t.own.newHireMark}</span>
    </TonePill>
  );
}

/** The marks beside a name: the ✓ and *New hire*. `null` with neither. */
function marksOf(row: UnitRow): ReactNode {
  if (!row.pacingToMaa && !row.newHireBeforeFirstSale) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {row.pacingToMaa && <MaaMark />}
      {row.newHireBeforeFirstSale && <NewHireTag />}
    </span>
  );
}

/** One unit of the roster, as both drawings walk it: its name, its people, its total, the units inside it. */
interface Section {
  key: string;
  label: string;
  /** Everybody its total covers: its own rows and every unit inside it. */
  count: number;
  rows: UnitRow[];
  total: UnitTotal;
  inner: Section[];
}

function sectionsOf(view: UnitDashboardView, own: string, unitOf: (name: string) => string): Section[] {
  const unit = (group: UnitGroup): Section => ({
    key: group.head.membershipId,
    label: unitOf(group.head.name),
    count: rowsOf(group).length,
    rows: [group.head, ...group.members],
    total: group.total,
    inner: group.units.map(unit),
  });
  const first: Section[] = view.yourUnit.rows.length > 0
    ? [{ key: 'own', label: own, count: view.yourUnit.rows.length, rows: view.yourUnit.rows, total: view.yourUnit.total, inner: [] }]
    : [];
  return [...first, ...view.units.map(unit)];
}

/** A section with somebody the filter keeps, in it or in a unit inside it. */
const holds = (section: Section, filter: RosterFilter): boolean =>
  section.rows.some((r) => matchesFilter(r, filter)) || section.inner.some((s) => holds(s, filter));

/*
 * ── Below 768px: the accordion (UI-002) ─────────────────────────────────────────────────────────
 */

function RosterAccordion({ view, period, filter, from }: { view: UnitDashboardView; period: UnitPeriod; filter: RosterFilter; from: string }) {
  const t = useMessages(unitDashboardMessages);
  const own = view.head.isReader ? t.prototype.yourUnitGroup : t.unitOf({ name: view.head.name });
  const sections = sectionsOf(view, own, (name) => t.unitOf({ name }));
  // Your own unit open, every AAB unit closed (UI-002); a filter opens every unit that holds a match.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(sections[0] ? [sections[0].key] : []));
  const toggle = (key: string) => setOpen((now) => {
    const next = new Set(now);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  return (
    <div data-roster-accordion="">
      {sections.filter((s) => holds(s, filter)).map((s) => (
        <AccordionSection key={s.key} section={s} depth={0} open={open} onToggle={toggle} period={period} filter={filter} from={from} />
      ))}
    </div>
  );
}

function AccordionSection({
  section, depth, open, onToggle, period, filter, from,
}: {
  section: Section; depth: number; open: ReadonlySet<string>; onToggle: (key: string) => void;
  period: UnitPeriod; filter: RosterFilter; from: string;
}) {
  const t = useMessages(unitDashboardMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const bodyId = useId();
  const expanded = filter !== 'all' || open.has(section.key);
  const goal = section.total.goal;
  const bar = goalShare(goal);
  return (
    <div data-unit-section={section.key} style={depth ? { paddingLeft: depth * 12 } : undefined}>
      <h3>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => onToggle(section.key)}
          className={cn(
            'flex min-h-12 w-full items-center gap-2 border-t border-divider px-3 text-left text-md font-semibold text-ink',
            expanded && 'bg-amber/[0.06]',
          )}
        >
          <LineIcon name={expanded ? 'chevronDown' : 'chevronRight'} className="h-4 w-4 shrink-0 text-signal-grey" />
          <span className="min-w-0 flex-1 truncate">{t.v1.unitCount({ label: section.label, n: section.count })}</span>
          {bar !== null && (
            <span aria-hidden="true" className="h-1.5 w-[60px] shrink-0 overflow-hidden rounded-sm bg-base">
              <span className="block h-full bg-navy" style={{ width: `${bar}%` }} />
            </span>
          )}
          <span className="shrink-0 tabular-nums">
            {goal.attainmentPct !== null && goal.actualMinor !== null && goal.targetMinor
              ? formatPercent(goal.attainmentPct, {}, figures)
              : '–'}
          </span>
        </button>
      </h3>
      {expanded && (
        <div id={bodyId}>
          <ul role="list">
            {section.rows.filter((r) => matchesFilter(r, filter)).map((row) => (
              <li key={row.membershipId} className="border-t border-divider">
                <PersonRow
                  name={rowName(row, language)}
                  photoUrl={row.photoUrl ?? null}
                  seed={row.membershipId}
                  href={rowHref(row, from) ?? undefined}
                  height={60}
                  nameClassName="text-md md:max-lg:text-md"
                  badge={marksOf(row)}
                  meta={<GoalLine goal={row.goal} />}
                  trailing={period === 'month' ? <StatusPill status={row.status} /> : undefined}
                  className="rounded-none"
                />
              </li>
            ))}
          </ul>
          {section.inner.filter((s) => holds(s, filter)).map((inner) => (
            <AccordionSection key={inner.key} section={inner} depth={depth + 1} open={open} onToggle={onToggle} period={period} filter={filter} from={from} />
          ))}
        </div>
      )}
    </div>
  );
}

/*
 * ── From 768px: the table (UI-009) ──────────────────────────────────────────────────────────────
 */

/** A count: right-aligned, a light *·* for zero (a screen reader hears 0), a tone when it is above zero. */
function Count({ n, tone }: { n: number; tone?: string }) {
  const figures = useFigureLanguage();
  if (n === 0) {
    return (
      <>
        <span aria-hidden="true" className="text-line">·</span>
        <span className="sr-only">{formatNumber(0, {}, figures)}</span>
      </>
    );
  }
  return <span className={tone}>{formatNumber(n, {}, figures)}</span>;
}

/** *162 / 51* — the goal activities against their target, or the count alone without one. */
function Touches({ touches }: { touches: { logged: number; target: number | null } }) {
  const figures = useFigureLanguage();
  const n = (v: number) => formatNumber(v, {}, figures);
  return (
    <span className="whitespace-nowrap tabular-nums">
      {touches.target === null ? n(touches.logged) : `${n(touches.logged)} / ${n(touches.target)}`}
    </span>
  );
}

const HEAD = 'bg-hover-row px-2 py-2 text-xs font-semibold leading-tight text-muted [overflow-wrap:anywhere] lg:px-1.5 xl:px-2.5';
const CELL = 'px-2 lg:px-1.5 xl:px-2.5';

function RosterTable({
  view, period, filter, from, wide, headingId, statusInfo,
}: {
  view: UnitDashboardView; period: UnitPeriod; filter: RosterFilter; from: string; wide: boolean; headingId: string;
  statusInfo: ReactNode;
}) {
  const t = useMessages(unitDashboardMessages);
  const own = view.head.isReader ? t.prototype.yourUnitGroup : t.unitOf({ name: view.head.name });
  const flat: { section: Section; depth: number }[] = [];
  const walk = (s: Section, depth: number) => { flat.push({ section: s, depth }); s.inner.forEach((i) => walk(i, depth + 1)); };
  sectionsOf(view, own, (name) => t.unitOf({ name })).forEach((s) => walk(s, 0));
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) => setClosed((now) => {
    const next = new Set(now);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return (
    <table aria-labelledby={headingId} data-roster-table={wide ? 'desktop' : 'tablet'} className="relative w-full table-fixed border-collapse text-left text-base">
      {wide ? (
        <colgroup>
          <col className="w-[16%] xl:w-[17%]" />
          <col className="w-[12%] xl:w-[19%]" />
          <col className="w-[9%] xl:w-[7%]" />
          <col className="w-[8%] xl:w-[6.5%]" />
          <col className="w-[9%] xl:w-[7%]" />
          <col className="w-[9%] xl:w-[7%]" />
          <col className="w-[9%] xl:w-[8%]" />
          <col className="w-[10%] xl:w-[10%]" />
          <col className="w-[16%] xl:w-[15.5%]" />
          <col className="w-[2%] xl:w-[3%]" />
        </colgroup>
      ) : (
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[32%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
          <col className="w-[4%]" />
        </colgroup>
      )}
      <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[1]">
        <tr>
          <th scope="col" className={HEAD}>{t.columns.name}</th>
          <th scope="col" className={HEAD}>{t.columns.goal}</th>
          {wide && (
            <>
              <th scope="col" className={cn(HEAD, 'text-right')}>{t.v1.columns.salesLeads}</th>
              <th scope="col" className={cn(HEAD, 'text-right')}>{t.v1.columns.closing}</th>
              <th scope="col" className={cn(HEAD, 'text-right')}>{t.v1.columns.recruitLeads}</th>
              <th scope="col" className={cn(HEAD, 'text-right')}>{t.v1.columns.potentialRecruits}</th>
            </>
          )}
          <th scope="col" className={cn(HEAD, 'text-right')}>
            <span className="inline-flex items-center gap-1">
              {t.columns.activity}
              {/* ADR-0165 §2: the figure is *goal activities*; the heading's ⓘ names the three types it counts. */}
              <TippedGlyph glyph="ⓘ" name={t.own.activityInfo} tip={t.own.activityRule} align="fit" className={STATUS_TIP} />
            </span>
          </th>
          {wide && <th scope="col" className={HEAD}>{t.columns.last}</th>}
          <th scope="col" className={HEAD}>
            <span className="inline-flex items-center gap-1">
              {t.columns.status}
              {statusInfo}
            </span>
          </th>
          <th scope="col" className={HEAD}><span className="sr-only">{t.own.details}</span></th>
        </tr>
      </thead>
      {flat.filter(({ section }) => section.rows.some((r) => matchesFilter(r, filter)) || filter === 'all').map(({ section, depth }) => (
        <UnitRows
          key={section.key}
          section={section}
          depth={depth}
          open={!closed.has(section.key)}
          onToggle={() => toggle(section.key)}
          period={period}
          filter={filter}
          from={from}
          wide={wide}
        />
      ))}
    </table>
  );
}

function UnitRows({
  section, depth, open, onToggle, period, filter, from, wide,
}: {
  section: Section; depth: number; open: boolean; onToggle: () => void; period: UnitPeriod; filter: RosterFilter;
  from: string; wide: boolean;
}) {
  const t = useMessages(unitDashboardMessages);
  const figures = useFigureLanguage();
  const bodyId = useId();
  const { total } = section;
  const goal = total.goal;
  const pct = goal.attainmentPct !== null && goal.actualMinor !== null && goal.targetMinor
    ? formatPercent(goal.attainmentPct, {}, figures)
    : null;
  return (
    <tbody id={bodyId} data-unit-rows={section.key}>
      <tr className="border-t border-divider bg-amber/[0.06] font-semibold text-ink">
        <th scope="rowgroup" className={cn(CELL, 'h-11 text-left font-semibold')} colSpan={1}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={onToggle}
            className="flex min-h-8 w-full min-w-0 items-center gap-1.5 text-left md:max-lg:min-h-11"
            style={depth ? { paddingLeft: depth * 14 } : undefined}
          >
            <LineIcon name={open ? 'chevronDown' : 'chevronRight'} className="h-4 w-4 shrink-0 text-signal-grey" />
            <span className="min-w-0 truncate">{t.v1.unitCount({ label: section.label, n: section.count })}</span>
          </button>
        </th>
        <td className={cn(CELL, 'truncate')}>
          {pct ?? '–'}
          {goal.actualMinor !== null && goal.targetMinor ? (
            <span className={cn('font-normal text-signal-grey', wide && 'max-xl:sr-only')}>
              {' · '}{formatRupiahCompactPair(goal.actualMinor, goal.targetMinor, '/', figures)}
            </span>
          ) : null}
        </td>
        {wide && (
          <>
            <td className={cn(CELL, 'text-right')}><Count n={total.leadsCounts.salesOpen} /></td>
            <td className={cn(CELL, 'text-right')}><Count n={total.closings} /></td>
            <td className={cn(CELL, 'text-right')}><Count n={total.leadsCounts.recruitOpen} /></td>
            <td className={cn(CELL, 'text-right')}><Count n={total.leadsCounts.recruitNominated} /></td>
          </>
        )}
        <td className={cn(CELL, 'text-right')}><Touches touches={total.touches} /></td>
        {wide && <td className={CELL} />}
        <td className={cn(CELL, 'whitespace-nowrap')}>{t.v1.active({ count: total.potentialActive.count, of: total.potentialActive.of })}</td>
        <td className={CELL} />
      </tr>
      {open && section.rows.filter((r) => matchesFilter(r, filter)).map((row) => (
        <PersonTableRow key={row.membershipId} row={row} period={period} from={from} wide={wide} depth={depth} />
      ))}
    </tbody>
  );
}

function PersonTableRow({ row, period, from, wide, depth }: { row: UnitRow; period: UnitPeriod; from: string; wide: boolean; depth: number }) {
  const language = useLanguage();
  const t = useMessages(unitDashboardMessages);
  const href = rowHref(row, from);
  const name = rowName(row, language);
  const last = row.lastOneOnOne;
  const marks = marksOf(row);
  return (
    <tr
      data-membership={row.membershipId}
      className={cn('relative h-11 border-t border-divider', href && 'cursor-pointer lg:hover:bg-hover-row', 'md:max-lg:h-12')}
    >
      <th scope="row" className={cn(CELL, 'text-left font-normal')}>
        <span className="flex min-w-0 items-center gap-1.5" style={depth ? { paddingLeft: depth * 14 } : undefined}>
          {href ? (
            <Link
              href={href}
              className="min-w-0 truncate font-semibold uppercase text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-amber"
            >
              {name}
            </Link>
          ) : (
            <span className="min-w-0 truncate font-semibold uppercase text-ink">{name}</span>
          )}
          {marks}
        </span>
      </th>
      <td className={CELL}>
        <span className="flex min-w-0">
          <GoalLine goal={row.goal} pair={!wide} />
          {wide && <GoalPairWide goal={row.goal} />}
        </span>
      </td>
      {wide && (
        <>
          <td className={cn(CELL, 'text-right tabular-nums')}><Count n={row.leadsCounts.salesOpen} /></td>
          <td className={cn(CELL, 'text-right tabular-nums')}><Count n={row.closings} tone="font-semibold text-pill-amber-ink" /></td>
          <td className={cn(CELL, 'text-right tabular-nums')}><Count n={row.leadsCounts.recruitOpen} /></td>
          <td className={cn(CELL, 'text-right tabular-nums')}><Count n={row.leadsCounts.recruitNominated} tone="font-semibold text-lavender" /></td>
        </>
      )}
      <td className={cn(CELL, 'text-right')}><Touches touches={row.activity.touches} /></td>
      {wide && (
        <td className={cn(CELL, 'truncate')}>
          {row.isReader
            ? <span className="text-signal-grey">—</span>
            : last === null
              ? <span className="text-signal-grey">{t.prototype.noOneOnOne}</span>
              : <span className={last.overdue ? 'font-semibold text-signal-red' : 'text-ink'}>{lastOneOnOneLine(last, language)}</span>}
        </td>
      )}
      <td className={CELL}>{period === 'month' && <StatusPill status={row.status} />}</td>
      <td className={cn(CELL, 'text-right')}>
        {href && <LineIcon name="chevronRight" className="ml-auto h-4 w-4 text-signal-grey" />}
      </td>
    </tr>
  );
}

/**
 * On a desktop the *Rp x / y* beside the bar from 1280px; between 1024 and 1279px, where nine columns share ~690px, it
 * is read by a screen reader and left off the line, so nothing scrolls sideways (UI-009).
 */
function GoalPairWide({ goal }: { goal: UnitRow['goal'] }) {
  const figures = useFigureLanguage();
  if (!goal.set || goal.targetMinor === null || goal.targetMinor === 0 || goal.actualMinor === null) return null;
  return (
    <span className="ml-1.5 min-w-0 truncate text-signal-grey max-xl:sr-only">
      {formatRupiahCompactPair(goal.actualMinor, goal.targetMinor, '/', figures)}
    </span>
  );
}
