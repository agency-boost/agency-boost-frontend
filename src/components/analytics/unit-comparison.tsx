'use client';

import Link from 'next/link';
import { useId, type MouseEvent, type ReactNode } from 'react';
import { TermTip } from '@/components/ui/term-tip';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/session';
import { formatRupiahCompact } from '@/lib/format';
import {
  activeWords, agentsSub, drillsAnywhere, headName, leadsWords, manpowerSub, moneyWords, OWN_COPY, PROTOTYPE_COPY,
  rateWords, unitDashboardHref,
  type AabUnitRow, type AgencyRow, type AnalyticsClub, type AnalyticsHead, type AnalyticsMoney, type AnalyticsTotal,
  type KpmAnalyticsView, type UnitFigures,
} from '@/lib/kpm-analytics';
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
 */
export function UnitComparisonTable({
  view,
  labelledBy,
  expanded,
  onToggle,
  listed,
  onToggleList,
  onOpenMoc,
}: {
  view: KpmAnalyticsView;
  /** The section heading's id: the table is named *Unit comparison*. */
  labelledBy: string;
  expanded: ReadonlySet<string>;
  onToggle: (membershipId: string) => void;
  listed: ReadonlySet<string>;
  onToggleList: (membershipId: string) => void;
  onOpenMoc: (open: MocOpen) => void;
}) {
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
                  <TippedGlyph
                    glyph="ⓘ"
                    name={OWN_COPY.mocRulesName}
                    tip={view.mocRulesText}
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
      <Figures figures={total} split={split} />
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
  agency, split, open, onToggle, listOpen, onToggleList, onOpenMoc,
}: {
  agency: AgencyRow;
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
        <Figures figures={agency} split={split} club={agency.club} />
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
function LeaderLink({ head, children }: { head: AnalyticsHead; children: ReactNode }) {
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
      className="font-semibold text-navy hover:text-amber-ink hover:underline"
    >
      {children}
      {newTab && <span className="sr-only">{head.isReader ? OWN_COPY.newTabOwn : OWN_COPY.newTab}</span>}
    </Link>
  );
}

/** The five figure columns every row shares: the two APEs, *Coached (7d)*, *Active* and *Total leads*. */
function Figures({
  figures, split, club = null,
}: {
  figures: Pick<UnitFigures, 'apeMonth' | 'apeAnnual' | 'coached7d' | 'activeAgents' | 'leads' | 'manpower'>;
  split: number;
  club?: AnalyticsClub | null;
}) {
  const coached = rateWords(figures.coached7d);
  const active = activeWords(figures.activeAgents, figures.manpower.total);
  const leads = leadsWords(figures.leads);
  return (
    <>
      <td className={CELL}><Ape money={figures.apeMonth} split={split} /></td>
      <td className={CELL}>
        <Ape money={figures.apeAnnual} split={split} />
        {club && <ClubBadge club={club} />}
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

/** The agency's highest tier, in words (D-clubs); a tier the company adds takes a quiet wash. */
function ClubBadge({ club }: { club: AnalyticsClub }) {
  return (
    <div>
      <span
        className={cn(
          'mt-1 inline-block whitespace-nowrap rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-[0.02em]',
          CLUB_TONE[club.code] ?? 'bg-muted/10 text-muted',
        )}
      >
        {club.label}
      </span>
    </div>
  );
}
