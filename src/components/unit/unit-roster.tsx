'use client';

import Link from 'next/link';
import { useId, type MouseEvent, type ReactNode } from 'react';
import { TAP_AREA } from '@/components/ui/phone';
import { CardField, CardGroup } from '@/components/ui/row-cards';
import { TermTip } from '@/components/ui/term-tip';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { campaignChasingMessages } from '@/i18n/messages/campaign-chasing';
import { cn } from '@/lib/cn';
import {
  coachingTabHref, lastOneOnOneLine, lastOneOnOneOverdue, rosterStatusLabel, type RosterStatus,
} from '@/lib/coaching';
import {
  firstName, goalBar, goalWords, missingWords, namesMissing, namesNewHires, newHireWords, onPaceWords,
  provenanceWords, recruitLine, rowName, rowsOf, salesLine, totalNote, totalRecruitLine, touchesWords,
  type GoalWords, type LeadsCounts, type UnitDashboardView, type UnitGroup, type UnitPeriod, type UnitRow,
  type UnitTotal,
} from '@/lib/unit-dashboard';
import { DetailTiles, UnitDetail, type ReadRatios } from './unit-detail';

/**
 * *Your team's roster* (`Overall.html:3903-3946`, rows `:7357-7423`, totals `:7426-7476`, CSS
 * `:1643-1736`).
 *
 * **The prototype's eight columns.** *Chasing MDRT* third (ADR-0122, P18.5-T7 AC-7): ✓ for a person chasing
 * the office's MDRT campaign, its header tooltip the server's words about that campaign (OD-152). *Remarks*
 * is the expander column, its heading blank on screen and named for a screen reader, each ⌄ named *View
 * details* for its person (OD-139).
 *
 * **The prototype's own table**, not `DataTable`, as the coaching roster is: rows grouped under
 * full-width dividers and units nested beneath their heads have no place in a one-`<tbody>` table. Each
 * group is a `<tbody>`, headed by a `rowgroup` header; each person's name is their row's header. The
 * table scrolls inside its card on a phone (`.table-scroll`, `:3908`), so the page never does.
 *
 * **Groups, as the server sends them** (D-groups): *Your Unit · {n}* and its total, then *AAB units*,
 * each unit's total, its head's own row tagged *Personal* and their team indented, and any unit nested
 * inside it beneath, one step further in. A group with nobody in it is not drawn.
 *
 * **Below 768px, a card per person instead of the table** (P18.95-T3 AC-1, ADR-0167 §6; the client's UI review,
 * UI-010 and UI-030): `RosterCards`, the same groups, totals, figures, drills and ⌄, in the same order. Asked of
 * the window (`usePhone`, by the screen, before the roster answers, so a phone never draws the table first), so a
 * tablet and a desktop draw the table they drew, to the byte (§12).
 *
 * **Its words are the catalogue's** (`messages/unit-dashboard.ts`, P18.98-T4), in the reader's language; every figure
 * in `useFigureLanguage()`'s. *Chasing MDRT* and its sentences are the campaigns' (`lib/campaigns.ts`).
 */

const CELL = 'px-3.5 py-3.5 align-middle';
/** One step of nesting: `tr.person-row.nested .name-cell{padding-left:46px}` against 20px (`:1677-1679`). */
const INDENT = 26;

export interface RosterProps {
  view: UnitDashboardView;
  period: UnitPeriod;
  expanded: ReadonlySet<string>;
  onToggle: (membershipId: string) => void;
  readRatios: ReadRatios;
}

export function UnitRoster({
  view, period, expanded, onToggle, readRatios, action, phone = false,
}: RosterProps & {
  /** *Update production* (`:3906`), when the reader may use it: the screen's, beside the title. */
  action?: ReactNode;
  /** The window is narrower than 768px: a card per person (P18.95-T3 AC-1). */
  phone?: boolean;
}) {
  const headingId = useId();
  const t = useMessages(unitDashboardMessages);
  // *Chasing MDRT*: the campaigns' words (`campaign-chasing.ts`), in the reader's language.
  const chasing = useMessages(campaignChasingMessages);
  const own = view.head.isReader;
  const unitName = own ? t.prototype.yourUnitGroup : t.unitOf({ name: view.head.name });
  const unitTotal = own ? t.prototype.yourUnitTotal : t.unitTotalOf({ name: view.head.name });
  const rowProps = { period, expanded, onToggle, readRatios };

  return (
    <div className="mt-[22px] overflow-hidden rounded-lg border border-hairline bg-card">
      {/* `.table-card-header` (`:1624-1626`): the title, and the button beside it. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <span className="flex items-center gap-1">
          <h2 id={headingId} className="font-display text-[0.9375rem] font-bold text-navy">{t.prototype.roster}</h2>
          {/* A card has no *Name* heading to carry the ✓'s ⓘ, so on a phone it is beside the roster's own (AC-4). */}
          {phone && <TermTip term="POTENTIAL_MAA" />}
        </span>
        {action}
      </div>
      {phone ? (
        <RosterCards view={view} unitName={unitName} unitTotal={unitTotal} {...rowProps} />
      ) : (
        /* `relative`, so a screen-reader label's `position: absolute` is clipped by this box rather than
           widening the page (the `.table-scroll` of `:3908` scrolls inside its card, never the body). */
        <div className="relative overflow-x-auto">
          {/* The prototype's widths (`:1644-1649`), *Chasing MDRT* back among them (P18.5-T7 AC-7; parity D-18). */}
          <table aria-labelledby={headingId} className="w-full min-w-[1080px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[17%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col className="w-[15%]" />
              <col className="w-[13%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-hairline">
                <th scope="col" className={HEAD}>
                  {/* What a row's ✓ means, once (P18.95-T9 AC-4; UI-028): it was every ✓'s own tooltip. */}
                  <span className="inline-flex items-center gap-1">
                    {t.columns.name}
                    <TermTip term="POTENTIAL_MAA" className={STATUS_TIP} />
                  </span>
                </th>
                <th scope="col" className={HEAD}>{t.columns.goal}</th>
                <th scope="col" className={cn(HEAD, 'text-center')}>
                  {/* `.c-mdrt-h` (`:3917-3922`): the words are the tooltip's trigger, as drawn, and the tooltip is the
                      server's sentence about the MDRT campaign (OD-152) — the heading's description, not its name. */}
                  <TippedGlyph
                    glyph={chasing.chasingMdrt}
                    name={chasing.chasingMdrt}
                    tip={view.mdrt.tooltip}
                    align="fit"
                    className={MDRT_TIP}
                    face="h-auto w-auto px-0.5 text-xs font-semibold uppercase tracking-wide text-muted hover:bg-transparent hover:text-navy"
                  />
                </th>
                <th scope="col" className={HEAD}>{t.columns.leads}</th>
                <th scope="col" className={HEAD}>
                  {/* ADR-0165 §2: the figure is *goal activities*, and the tooltip names the three types it counts. */}
                  <span className="inline-flex items-center gap-1">
                    {t.columns.activity}
                    <TippedGlyph
                      glyph="ⓘ"
                      name={t.own.activityInfo}
                      tip={t.own.activityRule}
                      align="fit"
                      className={STATUS_TIP}
                    />
                  </span>
                </th>
                <th scope="col" className={HEAD}>{t.columns.last}</th>
                <th scope="col" className={HEAD}>
                  <span className="inline-flex items-center gap-1">
                    {t.columns.status}
                    <TippedGlyph
                      glyph="ⓘ"
                      name={t.prototype.statusInfo}
                      tip={t.prototype.statusRules}
                      align="fit"
                      // The rules, as the prototype's 250px bubble lists them, opening **below** the heading:
                      // above it, the table's own scroll box would cut it off.
                      className={STATUS_TIP}
                    />
                  </span>
                </th>
                <th scope="col" className={cn(HEAD, 'text-center')}>
                  {/* The *Remarks* heading, blank on screen (OD-139): the column holds each row's ⌄. */}
                  <span className="sr-only">{t.own.details}</span>
                </th>
              </tr>
            </thead>

            {view.yourUnit.rows.length > 0 && (
              <tbody>
                <GroupDivider label={unitName} count={view.yourUnit.rows.length} />
                <TotalRow label={unitTotal} total={view.yourUnit.total} rows={view.yourUnit.rows} level={0} period={period} />
                {view.yourUnit.rows.map((row) => (
                  <PersonRow key={row.membershipId} row={row} level={0} {...rowProps} />
                ))}
              </tbody>
            )}

            {view.units.length > 0 && (
              <tbody>
                <GroupDivider label={t.prototype.aabUnits} />
              </tbody>
            )}
            {view.units.map((unit) => <UnitBodies key={unit.head.membershipId} unit={unit} level={1} {...rowProps} />)}
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * **A row's ✓, the prototype's green tick beside the name** (`:7382`): a member pacing to Monthly Active Agent this
 * month. Named for a screen reader and **explained once**, by the *Name* heading's ⓘ (on a phone, the roster's), since
 * P18.95-T9 AC-4 (UI-028): each ✓ was a button whose tooltip said the whole sentence again.
 */
function MaaMark() {
  const t = useMessages(unitDashboardMessages).own;
  return (
    <span className="shrink-0 font-bold text-success">
      <span aria-hidden="true">✓</span>
      <span className="sr-only">{t.maaMark}</span>
    </span>
  );
}

/** *Personal*'s chip (`:7384`): the one tag style the roster has, which *New hire* wears too (UI-003). */
const TAG = 'shrink-0 rounded-pill border border-hairline bg-base px-[7px] py-0.5 text-2xs font-bold uppercase tracking-wide text-muted';

/**
 * **A new hire before their first sale** (P18.96-T5 AC-3; ADR-0172 §3): *Personal*'s chip, saying *New hire*, and for a
 * screen reader that there is no first sale yet — which is why the totals above leave the person out. The server
 * decides who (`newHireBeforeFirstSale`), and the tag goes on the first sale's day.
 */
function NewHireTag() {
  const t = useMessages(unitDashboardMessages);
  return (
    <span className={TAG}>
      {t.prototype.newHire}
      <span className="sr-only">{t.own.newHireMark}</span>
    </span>
  );
}

/**
 * **The figure beside *On pace to be active* when the total leaves new hires out** (P18.96-T5 AC-4): the count and its
 * `of` no longer cover every row below, so the total says who it left out, in the ⓘ the goal's figure already uses.
 */
function OnPace({ total, rows }: { total: UnitTotal; rows: readonly UnitRow[] }) {
  const language = useLanguage();
  const note = newHireWords(total.newHires, namesNewHires(rows, language), language);
  return (
    <span className="flex items-start gap-1">
      <span className="text-sm font-semibold text-amber-ink">{onPaceWords(total.potentialActive, language)}</span>
      {note && <TippedGlyph glyph="ⓘ" name={note} tip={note} align="fit" className="-my-1" />}
    </span>
  );
}

/** A total's goal mark: who holds no figure, and who has no first sale yet (ADR-0165 §1, ADR-0172 §2). */
const goalNote = (total: UnitTotal, rows: readonly UnitRow[], language: Language) => totalNote(
  missingWords(total.goal.missing, namesMissing(rows, language), language),
  newHireWords(total.newHires, namesNewHires(rows, language), language),
);

/** `table.roster-table thead th` (`:1650`): small grey capitals. */
const HEAD = 'bg-card px-3.5 py-[13px] text-xs font-semibold uppercase tracking-wide text-muted';

/** *Chasing MDRT*'s bubble, below its glyph for the same reason, in sentence case. */
const MDRT_TIP = cn(
  'normal-case tracking-normal',
  '[&>[role=tooltip]]:bottom-auto [&>[role=tooltip]]:top-full [&>[role=tooltip]]:mb-0 [&>[role=tooltip]]:mt-1',
  '[&>[role=tooltip]]:w-[240px] [&>[role=tooltip]]:font-normal [&>[role=tooltip]]:leading-relaxed',
);

/** The status rules' bubble: the prototype's width, its lines kept, below its glyph. */
const STATUS_TIP = cn(
  'normal-case tracking-normal',
  '[&>[role=tooltip]]:bottom-auto [&>[role=tooltip]]:top-full [&>[role=tooltip]]:mb-0 [&>[role=tooltip]]:mt-1',
  '[&>[role=tooltip]]:w-[250px] [&>[role=tooltip]]:whitespace-pre-line [&>[role=tooltip]]:font-normal',
  '[&>[role=tooltip]]:leading-relaxed',
);

function GroupDivider({ label, count }: { label: string; count?: number }) {
  return (
    <tr>
      {/* `tr.group-divider td` (`:1658-1659`): a full-width band naming the group beneath it. */}
      <th
        scope="rowgroup"
        colSpan={8}
        className="border-y border-hairline bg-navy/[0.045] px-5 py-2.5 text-left font-display text-base font-bold text-navy"
      >
        {label}
        {count !== undefined && (
          <>
            {' '}
            <span className="ml-1.5 font-body font-semibold text-muted">· {count}</span>
          </>
        )}
      </th>
    </tr>
  );
}

/** A unit and every unit nested in it, each its own row group: the total, the head, the team. */
function UnitBodies({ unit, level, ...rowProps }: { unit: UnitGroup; level: number } & Omit<RosterProps, 'view'>) {
  const t = useMessages(unitDashboardMessages);
  return (
    <>
      <tbody>
        <TotalRow
          label={t.unitTotalOf({ name: unit.head.name })}
          total={unit.total}
          rows={rowsOf(unit)}
          level={level - 1}
          period={rowProps.period}
          names
        />
        <PersonRow row={unit.head} level={level} {...rowProps} />
        {unit.members.map((member) => <PersonRow key={member.membershipId} row={member} level={level} {...rowProps} />)}
      </tbody>
      {unit.units.map((inner) => <UnitBodies key={inner.head.membershipId} unit={inner} level={level + 1} {...rowProps} />)}
    </>
  );
}

/** The goal line's colour: green only over target, a muted red short (`:1692-1694`), muted with no figure. */
const GOAL_TONE: Record<GoalWords['tone'], string> = {
  over: 'text-success',
  short: 'text-alert',
  none: 'text-muted',
  missing: 'text-muted',
};

/** A name cell's indent, with `↳` in the step before it (`:1678-1679`). */
function Indented({ steps, children }: { steps: number; children: ReactNode }) {
  return (
    <div className="relative flex min-w-0 items-center gap-2" style={steps ? { paddingLeft: steps * INDENT } : undefined}>
      {steps > 0 && (
        <span aria-hidden="true" className="absolute text-md font-bold leading-none text-hairline" style={{ left: (steps - 1) * INDENT + 6 }}>
          ↳
        </span>
      )}
      {children}
    </div>
  );
}

/**
 * A unit's total (`:7426-7476`): its goal, leads and touches summed by the server's rollup rule, *—* for
 * *Last 1:1*, and *"{n}/{m} potential active"*. **A total of nobody's figures reads *Not uploaded yet***,
 * and one missing some names them in a mark (D-figures).
 */
function TotalRow({
  label, total, rows, level, period, names = false,
}: {
  label: string;
  total: UnitTotal;
  rows: readonly UnitRow[];
  level: number;
  period: UnitPeriod;
  /** A unit's total names its group for a screen reader, as the divider does *Your Unit*'s. */
  names?: boolean;
}) {
  const language = useLanguage();
  const figures = useFigureLanguage();
  const goal = goalWords(total.goal, language, figures);
  const missing = goalNote(total, rows, language);
  return (
    <tr className="border-b border-hairline bg-navy/[0.045]">
      <th
        scope={names ? 'rowgroup' : 'row'}
        className={cn(CELL, 'py-2 pl-5 text-left font-normal shadow-[inset_3px_0_0_var(--color-navy)]')}
      >
        <Indented steps={Math.max(0, level)}>
          <strong className="text-base font-bold text-navy">{label}</strong>
        </Indented>
      </th>
      <td className={cn(CELL, 'py-2')}>
        <div className="flex items-start gap-1">
          <GoalText goal={goal} period={period} />
          {missing && <TippedGlyph glyph="ⓘ" name={missing} tip={missing} align="fit" className="-my-1" />}
        </div>
      </td>
      {/* A total chases nothing (`:7458`). */}
      <td className={cn(CELL, 'py-2 text-center')}><span className="text-sm text-muted">—</span></td>
      <td className={cn(CELL, 'py-2')}>
        <LeadsText counts={total.leadsCounts} recruit={totalRecruitLine(total.leadsCounts, language)} />
      </td>
      <td className={cn(CELL, 'py-2 pl-1.5')}><Touches touches={touchesWords(total.touches, period, language)} /></td>
      <td className={cn(CELL, 'py-2')}><span className="text-sm text-muted">—</span></td>
      <td className={cn(CELL, 'py-2')}>
        <OnPace total={total} rows={rows} />
      </td>
      <td className={cn(CELL, 'py-2')} />
    </tr>
  );
}

function GoalText({ goal, period }: { goal: GoalWords; period: UnitPeriod }) {
  const t = useMessages(unitDashboardMessages).own;
  return (
    <span className="block min-w-0">
      <span className={cn('block text-base font-bold', GOAL_TONE[goal.tone])}>{goal.line}</span>
      {goal.sub && (
        <span className="mt-0.5 block text-xs text-muted">
          {goal.sub}
          {/* Under *Last 7 days* the figures are this month's, and the line says so (D-period). */}
          {period === '7d' && ` · ${t.thisMonth}`}
        </span>
      )}
    </span>
  );
}

function LeadsText({ counts, recruit }: { counts: LeadsCounts; recruit: { count: number; rest: string } | null }) {
  const language = useLanguage();
  const t = useMessages(unitDashboardMessages).leads;
  const sales = salesLine(counts, language);
  return (
    <span className="block text-sm leading-[1.7]">
      <span className="block whitespace-nowrap">
        <span className="text-muted">{t.sales}</span> <strong className="font-bold text-navy">{sales.count}</strong>{' '}
        <span className="text-navy">{sales.rest}</span>
      </span>
      <span className="block whitespace-nowrap">
        <span className="text-muted">{t.recruit}</span>{' '}
        {recruit ? (
          <>
            <strong className="font-bold text-navy">{recruit.count}</strong> <span className="text-navy">{recruit.rest}</span>
          </>
        ) : (
          <span className="text-muted">—</span>
        )}
      </span>
    </span>
  );
}

function Touches({ touches }: { touches: { logged: number; rest: string; pct: number | null } }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 whitespace-nowrap text-base text-navy">
        <strong className="font-bold">{touches.logged}</strong>{' '}
        <span className="font-medium text-muted">{touches.rest}</span>
      </p>
      {touches.pct !== null && (
        // The figures carry it; the bar is their picture (`.mini-progress`, `:1711-1712`).
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-[4px] bg-navy/[0.08]">
          <div className="h-full rounded-[4px] bg-navy-soft" style={{ width: `${touches.pct}%` }} />
        </div>
      )}
    </div>
  );
}

/** `GOAL_PACE_STATUS` in the pill's tones (`:1721-1728`): *Watch closely* amber with navy words (I-116). */
const PILL_TONE: Record<RosterStatus, string> = {
  on_track: 'bg-success/10 text-success hover:bg-success/15 hover:text-success',
  watch_closely: 'bg-amber/15 text-navy hover:bg-amber/20 hover:text-navy',
  needs_attention: 'bg-alert/10 text-alert hover:bg-alert/15 hover:text-alert',
  no_goal_set: 'bg-muted/10 text-muted hover:bg-muted/15 hover:text-muted',
};

/**
 * Where a row's three drills go (D-drill): the reader's own screens, or that person's coaching tabs —
 * or nowhere, for somebody the reader does not coach (an Owner's or an Admin's view of a unit outside
 * their own downline), whose tabs would only say so.
 */
function drillsOf(row: UnitRow) {
  if (row.isReader) return { name: '/summary', goal: '/goals', leads: '/leads' };
  if (!row.coached) return null;
  return {
    name: coachingTabHref(row.membershipId, 'summary'),
    goal: coachingTabHref(row.membershipId, 'goal-setting'),
    // The person's *Coaching Session* tab, where their Leads card is. Opening it starts nothing: the tab
    // reads the history and offers *Start*, and a session begins only when that is pressed.
    leads: coachingTabHref(row.membershipId, 'session'),
  };
}

/** A drill's hover (`.goal-click`, `.leads-click`, `:1696-1697`). */
const DRILL = 'block rounded-md px-1 py-0.5 -mx-1 -my-0.5 text-navy transition-colors hover:bg-navy-soft/[0.06]';

/** A cell's figures as a drill, or as plain text where the row has nowhere to go. */
function Drill({ href, children }: { href: string | undefined; children: ReactNode }) {
  return href
    ? <Link href={href} className={DRILL}>{children}</Link>
    : <div className="px-1 py-0.5 -mx-1 -my-0.5 text-navy">{children}</div>;
}

/**
 * *Chasing MDRT*'s cell (`:7393-7398`): ✓ in MDRT's gold, darkened to 4.03:1 (`gold-ink`, where the
 * prototype's `#C9A227` is 2.42:1, row 44), or —, each with the prototype's tooltip — the reader's own row
 * named by first name, as the prototype strips *You (…)*. Beyond the reader's reach, a plain — that claims
 * nothing.
 */
function MdrtCell({ row }: { row: UnitRow }) {
  // *Chasing MDRT*'s words are the campaigns' (`campaign-chasing.ts`), in the reader's language.
  const chasing = useMessages(campaignChasingMessages);
  if (row.chasingMdrt === null) return <span className="text-sm text-muted">—</span>;
  const words = row.chasingMdrt
    ? chasing.mdrtChasing({ name: row.isReader ? firstName(row.name) : row.name })
    : chasing.mdrtNot;
  return (
    <TippedGlyph
      glyph={row.chasingMdrt ? '✓' : '—'}
      name={words}
      tip={words}
      align="fit"
      className="-my-1.5"
      face={row.chasingMdrt ? 'text-md font-bold text-gold-ink hover:text-gold-ink' : 'text-muted'}
    />
  );
}

function PersonRow({
  row, level, period, expanded, onToggle, readRatios,
}: { row: UnitRow; level: number } & Omit<RosterProps, 'view'>) {
  const language = useLanguage();
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages);
  const detailId = useId();
  const open = expanded.has(row.membershipId);
  const name = rowName(row, language);
  const drills = drillsOf(row);
  const goal = goalWords(row.goal, language, figures);
  const marker = provenanceWords(row.goal.source, row.goal.period, row.isReader, language, figures);
  const last = row.lastOneOnOne;
  const overdue = lastOneOnOneOverdue(last);
  // A unit's head on their own row, apart from the unit's total above it (`:7384`). The reader's own row
  // is starred instead, as the prototype's *You* is.
  const personal = row.leads && !row.isReader;

  /** The row's own click is a convenience the ⌄ repeats; a click on a drill or a control is that control's. */
  const toggleFromRow = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    onToggle(row.membershipId);
  };

  return (
    <>
      <tr
        onClick={toggleFromRow}
        className={cn(
          'cursor-pointer border-b border-hairline',
          'hover:[background-image:linear-gradient(var(--row-hover),var(--row-hover))]',
          row.isReader && 'bg-amber/5',
        )}
      >
        <th
          scope="row"
          className={cn(
            CELL,
            'pl-5 text-left font-normal',
            level > 0 && 'shadow-[inset_3px_0_0_color-mix(in_srgb,var(--color-navy-soft)_22%,transparent)]',
          )}
        >
          <Indented steps={level}>
            <span aria-hidden="true" className={cn('w-2.5 shrink-0 text-[0.5625rem] text-muted transition-transform', open && 'rotate-90')}>
              ▶
            </span>
            {row.isReader && <span aria-hidden="true" className="shrink-0 text-base text-amber-dark">★</span>}
            {drills ? (
              <Link
                href={drills.name}
                className="min-w-[5.5rem] truncate text-[0.84375rem] font-semibold text-navy hover:text-navy-soft hover:underline"
              >
                {name}
              </Link>
            ) : (
              <span className="min-w-[5.5rem] truncate text-[0.84375rem] font-semibold text-navy">{name}</span>
            )}
            {row.pacingToMaa && <MaaMark />}
            {personal && <span className={TAG}>{t.prototype.personal}</span>}
            {row.newHireBeforeFirstSale && <NewHireTag />}
          </Indented>
        </th>
        <td className={CELL}>
          <div className="flex items-start gap-1">
            <Drill href={drills?.goal}>
              <GoalText goal={goal} period={period} />
            </Drill>
            {marker && <TippedGlyph glyph="ⓘ" name={marker} tip={marker} align="fit" className="-my-1" />}
          </div>
        </td>
        <td className={cn(CELL, 'text-center')}><MdrtCell row={row} /></td>
        <td className={CELL}>
          <Drill href={drills?.leads}>
            <LeadsText counts={row.leadsCounts} recruit={recruitLine(row.leadsCounts, language)} />
          </Drill>
        </td>
        <td className={cn(CELL, 'pl-1.5')}><Touches touches={touchesWords(row.activity.touches, period, language)} /></td>
        <td className={CELL}>
          {row.isReader ? (
            <span className="text-sm text-muted">—</span>
          ) : (
            <>
              <span className={cn('text-sm font-semibold', overdue ? 'text-alert' : 'text-success')}>
                {/* *Overdue* in words, not by colour alone (P18.8-T15 AC-7). */}
                {last === null ? t.prototype.noOneOnOne : lastOneOnOneLine(last, language)}
              </span>
              {last?.coach && <span className="mt-0.5 block text-xs text-muted">{t.by({ name: last.coach.name })}</span>}
            </>
          )}
        </td>
        <td className={CELL}>
          <TippedGlyph
            glyph={rosterStatusLabel(row.status, language)}
            name={rosterStatusLabel(row.status, language)}
            tip={t.statusTooltip[row.status]}
            align="fit"
            face={cn('h-auto w-[126px] rounded-pill px-2.5 py-1 text-xs font-semibold leading-normal', PILL_TONE[row.status])}
          />
        </td>
        <td className={cn(CELL, 'text-center')}>
          {/*
            * `.edit-btn` (`:1734-1735`) as a button: open or closed, named for its person (OD-139). On a
            * phone a 44px square centred on it takes the tap while the outlined 28px box stays as drawn
            * (ADR-0167; UI-029). Alone in its cell, so the square reaches over no other control.
            */}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? detailId : undefined}
            aria-label={t.viewDetails({ name: row.isReader ? null : row.name })}
            onClick={() => onToggle(row.membershipId)}
            className={cn(
              'mx-auto flex h-7 w-7 items-center justify-center rounded-[6px] border border-hairline bg-transparent text-sm text-muted hover:bg-navy/[0.05] hover:text-navy',
              'max-md:relative',
              TAP_AREA,
            )}
          >
            <span aria-hidden="true" className={cn('leading-none transition-transform', open && 'rotate-180')}>⌄</span>
          </button>
        </td>
      </tr>
      {open && <UnitDetail id={detailId} row={row} period={period} readRatios={readRatios} />}
    </>
  );
}

/** A card's *Activity* label, with the heading's ⓘ: what counts as a goal activity (ADR-0165 §2). */
function ActivityHeading() {
  const t = useMessages(unitDashboardMessages);
  return (
    <span className="inline-flex items-center gap-1">
      {t.columns.activity}
      <TippedGlyph glyph="ⓘ" name={t.own.activityInfo} tip={t.own.activityRule} align="fit" className={STATUS_TIP} />
    </span>
  );
}

/** A card's *Chasing MDRT* label, its words the trigger of the server's sentence about the campaign (OD-152). */
function MdrtHeading({ tip }: { tip: string }) {
  const chasing = useMessages(campaignChasingMessages);
  return (
    <TippedGlyph
      glyph={chasing.chasingMdrt}
      name={chasing.chasingMdrt}
      tip={tip}
      align="fit"
      className={MDRT_TIP}
      face="h-auto w-auto px-0 text-xs font-semibold uppercase tracking-wide text-muted hover:bg-transparent hover:text-navy"
    />
  );
}

/*
 * ── On a phone: a card per person (P18.95-T3 AC-1) ──────────────────────────────────────────────
 *
 * `CardGroup` and `CardField` are the shared card pieces (`components/ui/row-cards.tsx`) since P18.97-T7 AC-1, which
 * the Owner's wide tables draw their cards with too; moving them changed no markup here.
 */

/** One step of nesting on a phone: half the table's, so a unit two deep still leaves its card the screen. */
const PHONE_INDENT = 12;
/** A card's 16px gutter, and each step of nesting added to its left. */
const cardIndent = (steps: number) => (steps > 0 ? { paddingLeft: 16 + steps * PHONE_INDENT } : undefined);

/** The goal bar's fill, in the goal line's own tone: green over target, the muted red short. */
const BAR_TONE: Record<'over' | 'short', string> = { over: 'bg-success', short: 'bg-alert' };

/** What every card is drawn with: the row's props, and *Chasing MDRT*'s heading tooltip, which a card carries. */
type CardProps = Omit<RosterProps, 'view'> & { mdrtTip: string };

/**
 * **The roster on a phone** (P18.95-T3 AC-1; the client's UI review, UI-010: only *Name* and *Goal progress* fitted,
 * *Status*, *Last 1:1* and the ⌄ some 760px to the right, the names scrolling away). The table's groups and totals,
 * in its order: *Your Unit · {n}* over its total and its people, then *AAB units*, each unit's total, its head and
 * their team, a unit inside a unit beneath it one step further in. Each group heading is a heading, each unit a list
 * named for it, each person a card.
 */
function RosterCards({
  view, unitName, unitTotal, ...rowProps
}: Omit<RosterProps, 'view'> & { view: UnitDashboardView; unitName: string; unitTotal: string }) {
  const aabUnits = useMessages(unitDashboardMessages).prototype.aabUnits;
  const cardProps: CardProps = { ...rowProps, mdrtTip: view.mdrt.tooltip };
  return (
    <div>
      {view.yourUnit.rows.length > 0 && (
        <CardGroup label={unitName} count={view.yourUnit.rows.length}>
          <ul role="list" aria-label={unitName}>
            <TotalCard label={unitTotal} total={view.yourUnit.total} rows={view.yourUnit.rows} level={0} period={rowProps.period} />
            {view.yourUnit.rows.map((row) => <PersonCard key={row.membershipId} row={row} level={0} {...cardProps} />)}
          </ul>
        </CardGroup>
      )}
      {view.units.length > 0 && (
        <CardGroup label={aabUnits}>
          {view.units.map((unit) => <UnitCards key={unit.head.membershipId} unit={unit} level={1} {...cardProps} />)}
        </CardGroup>
      )}
    </div>
  );
}

/** A unit and every unit nested in it, each its own list: the total, the head, the team (`UnitBodies`). */
function UnitCards({ unit, level, ...rowProps }: { unit: UnitGroup; level: number } & CardProps) {
  const t = useMessages(unitDashboardMessages);
  return (
    <>
      <ul role="list" aria-label={t.unitOf({ name: unit.head.name })}>
        <TotalCard
          label={t.unitTotalOf({ name: unit.head.name })}
          total={unit.total}
          rows={rowsOf(unit)}
          level={level - 1}
          period={rowProps.period}
        />
        <PersonCard row={unit.head} level={level} {...rowProps} />
        {unit.members.map((member) => <PersonCard key={member.membershipId} row={member} level={level} {...rowProps} />)}
      </ul>
      {unit.units.map((inner) => <UnitCards key={inner.head.membershipId} unit={inner} level={level + 1} {...rowProps} />)}
    </>
  );
}

/** The goal's figures, as the table's cell writes them, and on a card the bar under them. */
function GoalWithBar({ goal, bar, period }: { goal: GoalWords; bar: number | null; period: UnitPeriod }) {
  return (
    <>
      <GoalText goal={goal} period={period} />
      {bar !== null && (goal.tone === 'over' || goal.tone === 'short') && (
        // The figures carry it; the bar is their picture, as the activity's is (`.mini-progress`).
        <span aria-hidden="true" data-goal-bar={bar} className="mt-1.5 block h-1.5 overflow-hidden rounded-[4px] bg-navy/[0.08]">
          <span className={cn('block h-full rounded-[4px]', BAR_TONE[goal.tone])} style={{ width: `${bar}%` }} />
        </span>
      )}
    </>
  );
}

/**
 * A unit's total as a card (`TotalRow`): its name, its goal, leads and goal activities, and *"{n}/{m} potential
 * active"* — what the table's total row says, each under its column's name. *—* for *Last 1:1* and *Chasing MDRT*
 * is a line with nothing in it, and is not drawn.
 */
function TotalCard({
  label, total, rows, level, period,
}: { label: string; total: UnitTotal; rows: readonly UnitRow[]; level: number; period: UnitPeriod }) {
  const language = useLanguage();
  const figures = useFigureLanguage();
  const { columns } = useMessages(unitDashboardMessages);
  const goal = goalWords(total.goal, language, figures);
  const missing = goalNote(total, rows, language);
  return (
    <li
      className="border-b border-hairline bg-navy/[0.045] px-4 py-3 shadow-[inset_3px_0_0_var(--color-navy)]"
      style={cardIndent(Math.max(0, level))}
    >
      <p className="break-words text-base font-bold text-navy">{label}</p>
      <dl className="mt-2 flex flex-col gap-2.5">
        <CardField label={columns.goal}>
          <div className="flex items-start gap-1">
            <span className="block min-w-0 flex-1">
              <GoalWithBar goal={goal} bar={goalBar(total.goal)} period={period} />
            </span>
            {missing && <TippedGlyph glyph="ⓘ" name={missing} tip={missing} align="fit" className="-my-1" />}
          </div>
        </CardField>
        <CardField label={columns.leads}>
          <LeadsText counts={total.leadsCounts} recruit={totalRecruitLine(total.leadsCounts, language)} />
        </CardField>
        <CardField label={columns.activity}><Touches touches={touchesWords(total.touches, period, language)} /></CardField>
        <CardField label={columns.status}>
          <OnPace total={total} rows={rows} />
        </CardField>
      </dl>
    </li>
  );
}

/**
 * **A person as a card** (P18.95-T3 AC-1): the name **in full**, wrapping rather than cut (*Indah Permat…*, UI-030),
 * its ★, ✓, *Personal* and *New hire* tags after it on the same wrapping line — a tag never over the goal, which has a
 * line of its own (UI-030) — then the status pill, *Goal progress* with its bar, and *Last 1:1*, each under its column's name.
 *
 * **⌄ opens the rest**, the table's own button: *Leads*, *Activity* and *Chasing MDRT*, then the detail's tiles,
 * each label above its value (`DetailTiles` `stacked`), nothing cut — *"≈ 4 policies needed at their avg case size
 * of Rp 10 jt."* wraps in the card's width. A tap on the card does what the row's click does, and a tap on a drill
 * or a control is that control's. Every drill the row has, the card has.
 */
function PersonCard({
  row, level, period, expanded, onToggle, readRatios, mdrtTip,
}: { row: UnitRow; level: number } & CardProps) {
  const language = useLanguage();
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages);
  const detailId = useId();
  const open = expanded.has(row.membershipId);
  const name = rowName(row, language);
  const drills = drillsOf(row);
  const goal = goalWords(row.goal, language, figures);
  const marker = provenanceWords(row.goal.source, row.goal.period, row.isReader, language, figures);
  const last = row.lastOneOnOne;
  const overdue = lastOneOnOneOverdue(last);
  const personal = row.leads && !row.isReader;

  /** The card's own tap is the ⌄'s convenience, as the row's click is; a drill or a control keeps its own. */
  const toggleFromCard = (e: MouseEvent<HTMLLIElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    onToggle(row.membershipId);
  };

  return (
    <li
      onClick={toggleFromCard}
      data-membership={row.membershipId}
      className={cn(
        'cursor-pointer border-b border-hairline px-4 py-3.5',
        row.isReader && 'bg-amber/5',
        level > 0 && 'shadow-[inset_3px_0_0_color-mix(in_srgb,var(--color-navy-soft)_22%,transparent)]',
      )}
      style={cardIndent(level)}
    >
      <div className="flex items-start gap-2">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 py-0.5">
          {row.isReader && <span aria-hidden="true" className="shrink-0 text-base text-amber-dark">★</span>}
          {drills ? (
            <Link
              href={drills.name}
              className="min-w-0 break-words text-md font-semibold text-navy hover:text-navy-soft hover:underline"
            >
              {name}
            </Link>
          ) : (
            <span className="min-w-0 break-words text-md font-semibold text-navy">{name}</span>
          )}
          {row.pacingToMaa && <MaaMark />}
          {personal && <span className={TAG}>{t.prototype.personal}</span>}
          {row.newHireBeforeFirstSale && <NewHireTag />}
        </p>
        {/* The table's ⌄, in the card's corner: the outlined 28px box, a 44px square taking the tap (UI-029). */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? detailId : undefined}
          aria-label={t.viewDetails({ name: row.isReader ? null : row.name })}
          onClick={() => onToggle(row.membershipId)}
          className={cn(
            'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-transparent text-sm text-muted hover:bg-navy/[0.05] hover:text-navy',
            TAP_AREA,
          )}
        >
          <span aria-hidden="true" className={cn('leading-none transition-transform', open && 'rotate-180')}>⌄</span>
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1">
        <TippedGlyph
          glyph={rosterStatusLabel(row.status, language)}
          name={rosterStatusLabel(row.status, language)}
          tip={t.statusTooltip[row.status]}
          align="fit"
          face={cn('h-auto w-[126px] rounded-pill px-2.5 py-1 text-xs font-semibold leading-normal', PILL_TONE[row.status])}
        />
        {/* The *Status* heading's rules, beside the pill they decide, as there is no heading on a card. */}
        <TippedGlyph glyph="ⓘ" name={t.prototype.statusInfo} tip={t.prototype.statusRules} align="fit" className={STATUS_TIP} />
      </div>

      <dl className="mt-3 flex flex-col gap-2.5">
        <CardField label={t.columns.goal}>
          <div className="flex items-start gap-1">
            <span className="block min-w-0 flex-1">
              <Drill href={drills?.goal}>
                <GoalWithBar goal={goal} bar={goalBar(row.goal)} period={period} />
              </Drill>
            </span>
            {marker && <TippedGlyph glyph="ⓘ" name={marker} tip={marker} align="fit" className="-my-1" />}
          </div>
        </CardField>
        {/* The reader's own row has no *Last 1:1* (the table's —): a line with nothing in it is not drawn. */}
        {!row.isReader && (
          <CardField label={t.columns.last}>
            <span className={cn('text-sm font-semibold', overdue ? 'text-alert' : 'text-success')}>
              {/* *Overdue* in words, not by colour alone (P18.8-T15 AC-7). */}
              {last === null ? t.prototype.noOneOnOne : lastOneOnOneLine(last, language)}
            </span>
            {last?.coach && <span className="mt-0.5 block text-xs text-muted">{t.by({ name: last.coach.name })}</span>}
          </CardField>
        )}
      </dl>

      {open && (
        <div id={detailId} className="-mx-4 mt-3 border-t border-hairline bg-base px-4 pb-1 pt-3">
          <dl className="flex flex-col gap-2.5">
            <CardField label={t.columns.leads}>
              <Drill href={drills?.leads}>
                <LeadsText counts={row.leadsCounts} recruit={recruitLine(row.leadsCounts, language)} />
              </Drill>
            </CardField>
            <CardField label={<ActivityHeading />}>
              <Touches touches={touchesWords(row.activity.touches, period, language)} />
            </CardField>
            <CardField label={<MdrtHeading tip={mdrtTip} />}>
              <MdrtCell row={row} />
            </CardField>
          </dl>
          <DetailTiles row={row} period={period} readRatios={readRatios} stacked className="mt-3 flex flex-col gap-3" />
        </div>
      )}
    </li>
  );
}
