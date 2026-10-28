'use client';

import Link from 'next/link';
import { useId, type MouseEvent, type ReactNode } from 'react';
import { TAP_AREA, TAP_TARGET, TEXT_TAP } from '@/components/ui/phone';
import { CardField, CardFields, RowCard, RowCards } from '@/components/ui/row-cards';
import { TermTip } from '@/components/ui/term-tip';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/session';
import { formatRupiahCompact } from '@/lib/format';
import {
  activeWords, agentsSub, clubTermFirsts, drillsAnywhere, headName, leadsWords, manpowerSub, mocTermName, mocTip, moneyWords,
  OWN_COPY, PROTOTYPE_COPY, rateWords, unitDashboardHref,
  type AabUnitRow, type AgencyRow, type AnalyticsClub, type AnalyticsHead, type AnalyticsMoney, type AnalyticsTotal,
  type KpmAnalyticsView, type UnitFigures,
} from '@/lib/kpm-analytics';
import type { TermKey } from '@/lib/terms';
import { MocCell, type MocOpen } from './moc';

/**
 * *Unit comparison*'s table (`KPM_Owner.html:1246-1251`, rows `:3326-3400`, CSS `:316-349`).
 *
 * **One row per AB agency** (D-units), the total first, as the prototype writes it (`:3399`). An agency
 * with AAB units has an expander — a button, `aria-expanded` — opening its *"{name} (Direct)"* row tagged
 * *AB* and one row per AAB unit tagged *AAB*, on the prototype's faint blue (`.aab-subrow`, `:332-334`).
 * An agency's manpower figure is a second button, opening the row of its people by name
 * (`.agent-list-row`, `:328-331`) — without the prototype's *"example roster"* note, which described its
 * own mock (contradiction 18).
 *
 * **A leader's name opens their Unit Dashboard in a new tab** (D-drill, `:4865`): the AB row's, the
 * *(Direct)* row's and an AAB row's. The link says so to a screen reader; following it writes nothing.
 *
 * Each row's name is its header (`th scope="row"`), so a cell is read with whose it is. The table scrolls
 * inside its card on a phone, never the page; the scroll box is `relative`, so a screen-reader label's
 * `position: absolute` is clipped by it rather than widening the page (Phase 15's lesson).
 *
 * **What each figure counts, said where it stands** (P18.97-T3; ADR-0176 §1, §3): the total's *APE — Annual* reads
 * ***Current members only*** under it (AC-4); *Active this month* is ***Producing this month*** (AC-9), its share the
 * server's (AC-10); and *MOC* and each production club carry an ⓘ where they first show, the glossary's one line (AC-8).
 *
 * **Below 768px the same rows are cards** (`UnitComparisonCards`, P18.97-T7 AC-1): the screen asks the window and draws
 * one or the other, never both.
 */
export interface ComparisonProps {
  view: KpmAnalyticsView;
  /** The section heading's id: the table, or the cards' list, is named *Unit comparison*. */
  labelledBy: string;
  expanded: ReadonlySet<string>;
  onToggle: (membershipId: string) => void;
  listed: ReadonlySet<string>;
  onToggleList: (membershipId: string) => void;
  onOpenMoc: (open: MocOpen) => void;
}

export function UnitComparisonTable({
  view,
  labelledBy,
  expanded,
  onToggle,
  listed,
  onToggleList,
  onOpenMoc,
}: ComparisonProps) {
  // The first badge of each club the reader meets carries its ⓘ (AC-8): the agencies in the table's order.
  const clubTerms = clubTermFirsts(view.agencies);
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card">
      <div className="relative overflow-x-auto">
        <table aria-labelledby={labelledBy} className="w-full min-w-[1180px] border-collapse text-left text-md">
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className={HEAD}>{PROTOTYPE_COPY.headAb}</th>
              <th scope="col" className={HEAD}>{PROTOTYPE_COPY.headManpower}</th>
              <th scope="col" className={HEAD}>
                {/* *APE*'s first appearance on the screen, so its ⓘ is here, opening below (P18.95-T9 AC-3; UI-028). */}
                <span className="inline-flex items-center gap-1">
                  {PROTOTYPE_COPY.headApeMonth(view.period)}
                  <TermTip term="APE" className={RULES_TIP} />
                </span>
              </th>
              <th scope="col" className={HEAD}>{PROTOTYPE_COPY.headApeAnnual}</th>
              <th scope="col" className={HEAD}>{PROTOTYPE_COPY.headCoached}</th>
              <th scope="col" className={HEAD}>{PROTOTYPE_COPY.headActive(view.period)}</th>
              <th scope="col" className={HEAD}>{PROTOTYPE_COPY.headLeads}</th>
              <th scope="col" className={HEAD}>
                <span className="inline-flex items-center gap-1">
                  {PROTOTYPE_COPY.headMoc}
                  {/* One ⓘ, the prototype's tooltip on the heading (`:1248`): what MOC is, then the company's rules (AC-8). */}
                  <TippedGlyph
                    glyph="ⓘ"
                    name={mocTermName}
                    tip={mocTip(view.mocRulesText)}
                    align="fit"
                    // Below the heading: above it, the table's own scroll box would cut the bubble off.
                    className={RULES_TIP}
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <TotalRow total={view.total} split={view.thresholds.statusSplitPct} />
            {view.agencies.map((agency) => (
              <AgencyRows
                key={agency.head.membershipId}
                agency={agency}
                clubTerm={clubTerms.get(agency.head.membershipId) ?? null}
                split={view.thresholds.statusSplitPct}
                open={expanded.has(agency.head.membershipId)}
                onToggle={onToggle}
                listOpen={listed.has(agency.head.membershipId)}
                onToggleList={onToggleList}
                onOpenMoc={onOpenMoc}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** `.directory-table th` (`:317`): small grey capitals on the warm base. */
const HEAD = 'whitespace-nowrap bg-base px-4 py-[11px] text-xs font-semibold uppercase tracking-wide text-muted';

/** `.directory-table td` (`:318`). */
const CELL = 'px-4 py-[11px] align-top text-navy';

/** A bubble opening below its glyph, inside the table's scroll box, which would clip it above. */
const BELOW_TIP = '[&>[role=tooltip]]:bottom-auto [&>[role=tooltip]]:top-full [&>[role=tooltip]]:mb-0 [&>[role=tooltip]]:mt-1';

/** The MOC rules' bubble, opening below its glyph, its two lines kept, at a width that reads. */
const RULES_TIP = cn(
  'normal-case tracking-normal',
  '[&>[role=tooltip]]:bottom-auto [&>[role=tooltip]]:top-full [&>[role=tooltip]]:mb-0 [&>[role=tooltip]]:mt-1',
  '[&>[role=tooltip]]:w-[320px] [&>[role=tooltip]]:whitespace-pre-line [&>[role=tooltip]]:font-normal',
  '[&>[role=tooltip]]:leading-relaxed',
);

/** The total row (`.total-row`, `:342-344`): the warm base, bold, its sub-lines regular. */
function TotalRow({ total, split }: { total: AnalyticsTotal; split: number }) {
  return (
    <tr className="border-b border-hairline bg-base font-bold">
      <th scope="row" className={cn(CELL, 'font-bold')}>
        <span className="inline-flex items-start gap-1">
          {PROTOTYPE_COPY.total(total.abCount)}
          {total.leaversExcludedMinor !== null && total.leaversExcludedMinor > 0 && (
            <TippedGlyph
              glyph="ⓘ"
              name={OWN_COPY.leaversLeftOut(formatRupiahCompact(total.leaversExcludedMinor))}
              tip={OWN_COPY.leaversLeftOut(formatRupiahCompact(total.leaversExcludedMinor))}
              align="fit"
              // Below the row, as the MOC rules' bubble opens: the table's scroll box would clip it above.
              className={cn('-my-1', BELOW_TIP)}
            />
          )}
        </span>
      </th>
      <td className={CELL}>
        <div className="font-bold text-navy">{total.manpower.total}</div>
        {/* *AAB*'s first appearance, in the first row (P18.95-T9 AC-3): opening below, inside the table's scroll box. */}
        <div className={SUB}>{manpowerSub(total.manpower)} <TermTip term="AAB" className={BELOW_TIP} /></div>
      </td>
      <Figures figures={total} split={split} annualNote={OWN_COPY.currentMembersOnly} />
      <td className={CELL}>
        <div className="text-md font-bold text-navy">{total.mocMet} / {total.mocOf}</div>
        <div className={PCT}>{PROTOTYPE_COPY.absMeetingMoc}</div>
      </td>
    </tr>
  );
}

/** `.leads-sub` (`:335`), regular weight even inside the bold total row. */
const SUB = 'mt-1 text-sm font-normal text-navy';
/** `.count-pct` (`:337`). */
const PCT = 'mt-0.5 text-sm font-normal text-muted';

function AgencyRows({
  agency, clubTerm, split, open, onToggle, listOpen, onToggleList, onOpenMoc,
}: {
  agency: AgencyRow;
  /** The club this row's badge is the first to show, whose ⓘ it carries (AC-8); `null` for none. */
  clubTerm: TermKey | null;
  /** The status pill's split, the server's (`thresholds.statusSplitPct`). */
  split: number;
  open: boolean;
  onToggle: (membershipId: string) => void;
  listOpen: boolean;
  onToggleList: (membershipId: string) => void;
  onOpenMoc: (open: MocOpen) => void;
}) {
  const listId = useId();
  const subRowsId = useId();
  const id = agency.head.membershipId;
  const expandable = agency.aabUnits.length > 0;
  /** The rows the expander shows: its *(Direct)* row and each AAB unit's, named for `aria-controls`. */
  const subRowIds = [`${subRowsId}-direct`, ...agency.aabUnits.map((_, i) => `${subRowsId}-${i}`)];
  const name = headName(agency.head);

  /** The row's own click is the expander's, as `.ab-row-clickable` (`:3417-3422`); a link or a button is its own. */
  const fromRow = (e: MouseEvent<HTMLTableRowElement>) => {
    if (!expandable || (e.target as HTMLElement).closest('a, button')) return;
    onToggle(id);
  };

  return (
    <>
      <tr
        onClick={fromRow}
        className={cn('border-b border-hairline', expandable && 'cursor-pointer hover:bg-base')}
      >
        {/* Named by the row's name alone, so a cell is read with whose it is, not with its two controls. */}
        <th scope="row" aria-label={name} className={cn(CELL, 'font-normal')}>
          <span className="flex items-start gap-1">
            {expandable && (
              // `.ab-expand-toggle` (`:322-323`), as a button saying whether it is open.
              <button
                type="button"
                aria-expanded={open}
                aria-controls={open ? subRowIds.join(' ') : undefined}
                aria-label={OWN_COPY.expand(agency.head.name)}
                onClick={() => onToggle(id)}
                className="-ml-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-xs text-muted hover:text-navy"
              >
                <span aria-hidden="true">{open ? '▾' : '▸'}</span>
              </button>
            )}
            <span className="min-w-0">
              <LeaderLink head={agency.head}>{agency.head.name}</LeaderLink>
              {agency.head.isReader && <span className="text-navy"> {PROTOTYPE_COPY.you}</span>}
            </span>
          </span>
        </th>
        <td className={CELL}>
          {/* `.manpower-toggle` (`:326-327`): the figure is the control, opening the agency's people by name. */}
          <button
            type="button"
            aria-expanded={listOpen}
            aria-controls={listOpen ? listId : undefined}
            onClick={() => onToggleList(id)}
            className="font-bold text-navy hover:text-amber-ink hover:underline"
          >
            {agency.manpower.total}
            <span className="sr-only">{OWN_COPY.members(agency.head.name, agency.manpower.total)}</span>
          </button>
          <div className={SUB}>{manpowerSub(agency.manpower)}</div>
        </td>
        <Figures figures={agency} split={split} club={agency.club} clubTerm={clubTerm} />
        <td className={CELL}>
          <MocCell moc={agency.moc} name={agency.head.name} onOpen={onOpenMoc} />
        </td>
      </tr>

      {listOpen && (
        <tr className="border-b border-hairline">
          <td colSpan={8} id={listId} className="bg-card px-[18px] py-3.5">
            {/* `.agent-list-pills` (`:330-331`): each of the agency's people, by name. */}
            <ul aria-label={agency.head.name} className="flex flex-wrap gap-2">
              {agency.members.map((member) => (
                <li
                  key={member.membershipId}
                  className="rounded-pill border border-hairline bg-base px-3 py-[5px] text-sm text-navy"
                >
                  {member.name}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}

      {open && (
        <>
          <SubRow id={subRowIds[0]} row={agency.direct} tag={PROTOTYPE_COPY.tagAb} split={split}>
            <span className="text-sm italic text-muted">{PROTOTYPE_COPY.seeAbove(agency.head.name)}</span>
          </SubRow>
          {agency.aabUnits.map((unit, i) => (
            <SubRow key={unit.head.membershipId} id={subRowIds[i + 1]} row={unit} tag={PROTOTYPE_COPY.tagAab} split={split}>
              <MocCell moc={unit.moc} name={unit.head.name} onOpen={onOpenMoc} />
            </SubRow>
          ))}
        </>
      )}
    </>
  );
}

/**
 * An agency's *(Direct)* row or one of its AAB units (`aabRowHtmlForUnitComparison`, `:3352-3364`): the
 * name indented and tagged, the unit's own manpower and agents, its own figures (contradiction 13), and in
 * the MOC column the AAB's own verdict or *"See {name} above"*.
 */
function SubRow({
  id, row, tag, split, children,
}: {
  id: string;
  row: UnitFigures | AabUnitRow;
  tag: string;
  split: number;
  children: ReactNode;
}) {
  const direct = tag === PROTOTYPE_COPY.tagAb;
  const name = direct ? PROTOTYPE_COPY.direct(row.head.name) : row.head.name;
  return (
    <tr id={id} className="border-b border-hairline bg-info/[0.03]">
      {/* Named by the row's name alone, so a cell is read with whose it is and not with the link's hint. */}
      <th scope="row" aria-label={name} className={cn(CELL, 'pl-7 font-semibold')}>
        <LeaderLink head={row.head}>{name}</LeaderLink>{' '}
        {/* `.role-tag` (`:168-170`): navy words on both tints, which clear 4.5:1 where the prototype's blue does not. */}
        <span
          className={cn(
            'ml-1 inline-block rounded-pill px-[7px] py-0.5 align-[1px] text-2xs font-bold uppercase tracking-wide',
            direct ? 'bg-navy/[0.08] text-navy' : 'bg-info/10 text-navy-soft',
          )}
        >
          {tag}
        </span>
      </th>
      <td className={CELL}>
        <div className="font-bold text-navy">{row.manpower.total}</div>
        <div className={SUB}>{agentsSub(row.manpower)}</div>
      </td>
      <Figures figures={row} split={split} />
      <td className={CELL}>{children}</td>
    </tr>
  );
}

/**
 * A leader's name, opening their Unit Dashboard in a new tab, and saying so (D-drill). **Inside a support
 * session it opens in the same tab**: the session's token lives in this tab's memory only, so a new tab
 * would open as the Super Admin, who has no office, and be refused.
 */
function LeaderLink({ head, children, className }: { head: AnalyticsHead; children: ReactNode; className?: string }) {
  const { me } = useSession();
  const newTab = !me?.isImpersonating;
  // A head who leads nobody has no Unit Dashboard to open (it answers *not found*): the name is plain text. So is
  // another leader's, to a Core Leader (ADR-0159 §2): they read the office's figures, and open no unit but their own.
  if (!head.leads || !drillsAnywhere(me, head.isReader)) return <span className="font-semibold text-navy">{children}</span>;
  return (
    <Link
      href={unitDashboardHref(head)}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      // On a phone's card, 44px tall (P18.97-T7 AC-1); the table's link as it was.
      className={cn('font-semibold text-navy hover:text-amber-ink hover:underline', className)}
    >
      {children}
      {newTab && <span className="sr-only">{head.isReader ? OWN_COPY.newTabOwn : OWN_COPY.newTab}</span>}
    </Link>
  );
}

/** What every row's figures are read from: an agency's, a unit's, the total's. */
type RowFigures = Pick<UnitFigures, 'apeMonth' | 'apeAnnual' | 'coached7d' | 'activeAgents' | 'activePct' | 'leads' | 'manpower'>;

/** The five figure columns every row shares: the two APEs, *Coached (7d)*, *Producing* and *Total leads*. */
function Figures({
  figures, split, club = null, clubTerm = null, annualNote,
}: {
  figures: RowFigures;
  split: number;
  club?: AnalyticsClub | null;
  /** The club whose ⓘ this row's badge carries, the first to show it (AC-8). */
  clubTerm?: TermKey | null;
  /** A line under *APE — Annual* saying what it counts: the total's *Current members only* (AC-4). */
  annualNote?: string;
}) {
  const coached = rateWords(figures.coached7d);
  const active = activeWords(figures);
  const leads = leadsWords(figures.leads);
  return (
    <>
      <td className={CELL}><Ape money={figures.apeMonth} split={split} /></td>
      <td className={CELL}>
        <Ape money={figures.apeAnnual} split={split} />
        {annualNote && <div className={cn(PCT, 'whitespace-nowrap')}>{annualNote}</div>}
        {club && <ClubBadge club={club} term={clubTerm} />}
      </td>
      <td className={CELL}>
        <div className="text-md font-bold text-navy">{coached.main}</div>
        <div className={PCT}>{coached.pct}</div>
      </td>
      <td className={CELL}>
        <div className={cn('text-md font-bold', figures.activeAgents === null ? 'font-semibold text-muted' : 'text-navy')}>
          {active.main}
        </div>
        {active.pct !== null && <div className={PCT}>{active.pct}</div>}
      </td>
      <td className={CELL}>
        <div className="font-bold text-navy">{leads.total}</div>
        <div className={cn(SUB, 'whitespace-nowrap')}>{leads.sub}</div>
      </td>
    </>
  );
}

/** An APE cell (`apeCellHtml`, `:3229-3231`; `.ape-actual`, `.ape-of`, `:320-321`). */
function Ape({ money, split }: { money: AnalyticsMoney; split: number }) {
  const words = moneyWords(money, split);
  return (
    <>
      <div className={cn('whitespace-nowrap text-md font-bold', words.uploaded ? 'text-navy' : 'font-semibold text-muted')}>
        {words.actual}
      </div>
      <div className="mb-1 mt-px whitespace-nowrap text-xs font-normal text-muted">
        {words.of}
        {words.pill && (
          <>
            {' · '}
            {/* `.status-pill` (`:564-566`), at the server's split (the prototype's 70%). */}
            <span
              className={cn(
                'inline-flex rounded-pill px-2.5 py-1 text-sm font-semibold',
                words.pill.tone === 'success' ? 'bg-success/10 text-success' : 'bg-alert/10 text-alert',
              )}
            >
              {words.pill.text}
            </span>
          </>
        )}
      </div>
    </>
  );
}

/**
 * The tiers' paints (`.club-badge`, `:345-348`), by the seeded codes. **Navy words on each tint**: the
 * prototype's amber-dark and blue on their own washes are 2.69:1 and 3.43:1 at 10px, below 4.5:1.
 *
 * *Chairman's Club* is the prototype's `#5B3CC4` (`:348`, contradiction 37), now the token
 * `--color-club-chairman`: its words on its own 12% tint read 6.03:1, so it is drawn as the prototype draws it.
 */
const CLUB_TONE: Record<string, string> = {
  STAR_CLUB: 'bg-amber/[0.14] text-navy',
  ELITE_CLUB: 'bg-info/10 text-navy-soft',
  CHAIRMANS_CLUB: 'bg-club-chairman/[0.12] text-club-chairman',
};

/**
 * The agency's highest tier, in words (D-clubs); a tier the company adds takes a quiet wash. **The first badge of each
 * club carries its ⓘ** after it (P18.97-T3 AC-8, UI-021): the glossary's one line, opening below inside the table's
 * scroll box as the *AAB* term's does.
 */
function ClubBadge({ club, term = null }: { club: AnalyticsClub; term?: TermKey | null }) {
  return (
    <div className="mt-1 flex items-center gap-1">
      <span
        className={cn(
          'inline-block whitespace-nowrap rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-[0.02em]',
          CLUB_TONE[club.code] ?? 'bg-muted/10 text-muted',
        )}
      >
        {club.label}
      </span>
      {term && <TermTip term={term} className={BELOW_TIP} />}
    </div>
  );
}

/*
 * ── On a phone: a card per agency (P18.97-T7 AC-1) ──────────────────────────────────────────────
 */

/** A figure on a card: the table cell's lines, under its column's heading. */
const FIGURE = 'text-md font-bold text-navy';

/** The MOC rules' bubble on a card: its two lines kept, in the card's width rather than the table's 320px. */
const CARD_RULES_TIP = cn(
  'normal-case tracking-normal',
  '[&>[role=tooltip]]:whitespace-pre-line [&>[role=tooltip]]:font-normal [&>[role=tooltip]]:leading-relaxed',
);

/**
 * ***Unit comparison* as cards** (P18.97-T7 AC-1, ADR-0178 §4; the client's KPM Owner review of 2026-10-27, UI-034: the
 * table, 1329px in some 318px of a 375px screen). Below 768px, the table's rows in its order — the total first, then a
 * card per agency — each value **under its column's heading**, through the shared card pieces (`row-cards.tsx`). What
 * the table says, the cards say, in its words:
 *
 * - **The total**, in the total row's tint: *Total — all {n} ABs* and the ⓘ for what leavers produced, *Manpower* with
 *   *AAB*'s ⓘ, both APEs — *APE*'s ⓘ on the first, ***Current members only*** under the annual (P18.97-T3 AC-4) —
 *   *Coached (7d)*, ***Producing this month*** with the server's share (AC-9, AC-10), *Total leads*, and *MOC* with its
 *   ⓘ (AC-8) over *"{n} / {m}"* and *ABs meeting MOC*. A heading's ⓘ is on the first card that names it, as it is on
 *   the table's one header.
 * - **An agency**: its leader's name, opening their Unit Dashboard as the row's does, *(you)*; ▸ opening its
 *   *(Direct)* and AAB units, each a card one step in; the manpower figure opening the agency's people by name; the
 *   figures; the club's badge, the first of each club with its ⓘ (AC-8); and MOC's ✓ ✕ —, opening its dialog. A tap on
 *   the card is the row's own click, the ▸; a link or a button keeps its own.
 *
 * Every control is a 44px target on a phone: the ▸ and MOC's mark by a square that takes the tap, a name and the
 * manpower figure 44px tall.
 */
export function UnitComparisonCards({
  view, labelledBy, expanded, onToggle, listed, onToggleList, onOpenMoc,
}: ComparisonProps) {
  const clubTerms = clubTermFirsts(view.agencies);
  return (
    <RowCards labelledBy={labelledBy}>
      <TotalCard view={view} />
      {view.agencies.map((agency) => (
        <AgencyCard
          key={agency.head.membershipId}
          agency={agency}
          period={view.period}
          clubTerm={clubTerms.get(agency.head.membershipId) ?? null}
          split={view.thresholds.statusSplitPct}
          open={expanded.has(agency.head.membershipId)}
          onToggle={onToggle}
          listOpen={listed.has(agency.head.membershipId)}
          onToggleList={onToggleList}
          onOpenMoc={onOpenMoc}
        />
      ))}
    </RowCards>
  );
}

/** The total as a card (`TotalRow`): the warm base, its name bold, and every heading's ⓘ, which it is the first to show. */
function TotalCard({ view }: { view: KpmAnalyticsView }) {
  const { total } = view;
  const split = view.thresholds.statusSplitPct;
  const leftOut = total.leaversExcludedMinor !== null && total.leaversExcludedMinor > 0
    ? OWN_COPY.leaversLeftOut(formatRupiahCompact(total.leaversExcludedMinor))
    : null;
  return (
    <RowCard className="bg-base">
      <p className="flex items-start gap-1 break-words text-md font-bold text-navy">
        {PROTOTYPE_COPY.total(total.abCount)}
        {leftOut && <TippedGlyph glyph="ⓘ" name={leftOut} tip={leftOut} align="fit" className="-my-1" />}
      </p>
      <CardFields>
        <CardField label={PROTOTYPE_COPY.headManpower}>
          <div className={FIGURE}>{total.manpower.total}</div>
          <div className={SUB}>{manpowerSub(total.manpower)} <TermTip term="AAB" /></div>
        </CardField>
        <FigureFields
          figures={total}
          period={view.period}
          split={split}
          apeTerm
          annualNote={OWN_COPY.currentMembersOnly}
        />
        <CardField
          label={(
            <span className="inline-flex items-center gap-1">
              {PROTOTYPE_COPY.headMoc}
              {/* The table header's one ⓘ, on the first card that names MOC (AC-8). */}
              <TippedGlyph glyph="ⓘ" name={mocTermName} tip={mocTip(view.mocRulesText)} align="fit" className={CARD_RULES_TIP} />
            </span>
          )}
        >
          <div className={FIGURE}>{total.mocMet} / {total.mocOf}</div>
          <div className={PCT}>{PROTOTYPE_COPY.absMeetingMoc}</div>
        </CardField>
      </CardFields>
    </RowCard>
  );
}

/**
 * The five figures every row shares, as fields: the two APEs, *Coached (7d)*, *Producing this month* and *Total leads*
 * — the table's `Figures`, each under its heading. `apeTerm` puts *APE*'s ⓘ on its heading (the first card's); `club`
 * draws the badge under the annual APE, its ⓘ where it is the first of its club.
 */
function FigureFields({
  figures, period, split, apeTerm = false, annualNote, club = null, clubTerm = null,
}: {
  figures: RowFigures;
  period: KpmAnalyticsView['period'];
  split: number;
  apeTerm?: boolean;
  annualNote?: string;
  club?: AnalyticsClub | null;
  clubTerm?: TermKey | null;
}) {
  const coached = rateWords(figures.coached7d);
  const active = activeWords(figures);
  const leads = leadsWords(figures.leads);
  return (
    <>
      <CardField
        label={apeTerm ? (
          <span className="inline-flex items-center gap-1">
            {PROTOTYPE_COPY.headApeMonth(period)}
            <TermTip term="APE" className="normal-case tracking-normal" />
          </span>
        ) : PROTOTYPE_COPY.headApeMonth(period)}
      >
        <Ape money={figures.apeMonth} split={split} />
      </CardField>
      <CardField label={PROTOTYPE_COPY.headApeAnnual}>
        <Ape money={figures.apeAnnual} split={split} />
        {annualNote && <div className={PCT}>{annualNote}</div>}
        {club && <ClubBadge club={club} term={clubTerm} />}
      </CardField>
      <CardField label={PROTOTYPE_COPY.headCoached}>
        <div className={FIGURE}>{coached.main}</div>
        <div className={PCT}>{coached.pct}</div>
      </CardField>
      <CardField label={PROTOTYPE_COPY.headActive(period)}>
        <div className={cn(FIGURE, figures.activeAgents === null && 'font-semibold text-muted')}>{active.main}</div>
        {active.pct !== null && <div className={PCT}>{active.pct}</div>}
      </CardField>
      <CardField label={PROTOTYPE_COPY.headLeads}>
        <div className={FIGURE}>{leads.total}</div>
        <div className={SUB}>{leads.sub}</div>
      </CardField>
    </>
  );
}

/** One agency as a card (`AgencyRows`), and, opened, its *(Direct)* and AAB units as cards one step in. */
function AgencyCard({
  agency, period, clubTerm, split, open, onToggle, listOpen, onToggleList, onOpenMoc,
}: {
  agency: AgencyRow;
  period: KpmAnalyticsView['period'];
  clubTerm: TermKey | null;
  split: number;
  open: boolean;
  onToggle: (membershipId: string) => void;
  listOpen: boolean;
  onToggleList: (membershipId: string) => void;
  onOpenMoc: (open: MocOpen) => void;
}) {
  const listId = useId();
  const unitsId = useId();
  const id = agency.head.membershipId;
  const expandable = agency.aabUnits.length > 0;

  /** The card's own tap is the ▸'s, as the row's click is; a link or a button keeps its own. */
  const fromCard = (e: MouseEvent<HTMLLIElement>) => {
    if (!expandable || (e.target as HTMLElement).closest('a, button')) return;
    onToggle(id);
  };

  return (
    <RowCard onClick={fromCard} data-row={id} className={cn(expandable && 'cursor-pointer')}>
      <p className="flex min-w-0 items-start gap-1">
        {expandable && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? unitsId : undefined}
            aria-label={OWN_COPY.expand(agency.head.name)}
            onClick={() => onToggle(id)}
            className={cn('-ml-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-xs text-muted hover:text-navy', TAP_TARGET)}
          >
            <span aria-hidden="true">{open ? '▾' : '▸'}</span>
          </button>
        )}
        <span className="min-w-0 break-words text-md">
          <LeaderLink head={agency.head} className={TEXT_TAP}>{agency.head.name}</LeaderLink>
          {agency.head.isReader && <span className="text-navy"> {PROTOTYPE_COPY.you}</span>}
        </span>
      </p>
      <CardFields>
        <CardField label={PROTOTYPE_COPY.headManpower}>
          {/* The figure is the control, opening the agency's people by name, as on the table. */}
          <span>
            <button
              type="button"
              aria-expanded={listOpen}
              aria-controls={listOpen ? listId : undefined}
              onClick={() => onToggleList(id)}
              // 44px each way: the figure stays where a figure starts, the box grows to its right (`TEXT_TAP`).
              className={cn('font-bold text-navy hover:text-amber-ink hover:underline', TEXT_TAP, 'max-md:min-w-11')}
            >
              {agency.manpower.total}
              <span className="sr-only">{OWN_COPY.members(agency.head.name, agency.manpower.total)}</span>
            </button>
          </span>
          <div className={SUB}>{manpowerSub(agency.manpower)}</div>
          {listOpen && (
            <ul id={listId} aria-label={agency.head.name} className="mt-2 flex flex-wrap gap-2">
              {agency.members.map((member) => (
                <li key={member.membershipId} className="rounded-pill border border-hairline bg-base px-3 py-[5px] text-sm text-navy">
                  {member.name}
                </li>
              ))}
            </ul>
          )}
        </CardField>
        <FigureFields figures={agency} period={period} split={split} club={agency.club} clubTerm={clubTerm} />
        <CardField label={PROTOTYPE_COPY.headMoc}>
          <span className="relative inline-flex">
            <MocCell moc={agency.moc} name={agency.head.name} onOpen={onOpenMoc} className={TAP_AREA} />
          </span>
        </CardField>
      </CardFields>

      {open && (
        <ul id={unitsId} role="list" aria-label={OWN_COPY.expand(agency.head.name)} className="-mx-4 mt-3 border-t border-hairline">
          <SubCard row={agency.direct} tag={PROTOTYPE_COPY.tagAb} period={period} split={split}>
            <span className="text-sm italic text-muted">{PROTOTYPE_COPY.seeAbove(agency.head.name)}</span>
          </SubCard>
          {agency.aabUnits.map((unit) => (
            <SubCard key={unit.head.membershipId} row={unit} tag={PROTOTYPE_COPY.tagAab} period={period} split={split}>
              <span className="relative inline-flex">
                <MocCell moc={unit.moc} name={unit.head.name} onOpen={onOpenMoc} className={TAP_AREA} />
              </span>
            </SubCard>
          ))}
        </ul>
      )}
    </RowCard>
  );
}

/**
 * An agency's *(Direct)* row or one of its AAB units as a card (`SubRow`): one step in, on the sub-rows' faint blue
 * with the nested rule, its name tagged *AB* or *AAB*, its own manpower and figures, and in *MOC* the AAB's own verdict
 * or *"See {name} above"*.
 */
function SubCard({
  row, tag, period, split, children,
}: {
  row: UnitFigures | AabUnitRow;
  tag: string;
  period: KpmAnalyticsView['period'];
  split: number;
  children: ReactNode;
}) {
  const direct = tag === PROTOTYPE_COPY.tagAb;
  const name = direct ? PROTOTYPE_COPY.direct(row.head.name) : row.head.name;
  return (
    <li
      className={cn(
        'border-b border-hairline bg-info/[0.03] py-3 pl-7 pr-4 last:border-b-0',
        'shadow-[inset_3px_0_0_color-mix(in_srgb,var(--color-navy-soft)_22%,transparent)]',
      )}
    >
      <p className="break-words text-md font-semibold">
        <LeaderLink head={row.head} className={TEXT_TAP}>{name}</LeaderLink>{' '}
        <span
          className={cn(
            'ml-1 inline-block rounded-pill px-[7px] py-0.5 align-[1px] text-2xs font-bold uppercase tracking-wide',
            direct ? 'bg-navy/[0.08] text-navy' : 'bg-info/10 text-navy-soft',
          )}
        >
          {tag}
        </span>
      </p>
      <CardFields className="mt-2">
        <CardField label={PROTOTYPE_COPY.headManpower}>
          <div className={FIGURE}>{row.manpower.total}</div>
          <div className={SUB}>{agentsSub(row.manpower)}</div>
        </CardField>
        <FigureFields figures={row} period={period} split={split} />
        <CardField label={PROTOTYPE_COPY.headMoc}>{children}</CardField>
      </CardFields>
    </li>
  );
}
