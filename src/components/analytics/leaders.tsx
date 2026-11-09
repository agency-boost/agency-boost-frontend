'use client';

import Link from 'next/link';
import { useId, type ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { LineIcon, type LineIconName } from '@/components/ui/line-icon';
import { Avatar, PersonRow } from '@/components/ui/person-row';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { StatTile } from '@/components/ui/stat-tile';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { TonePill } from '@/components/ui/tone-pill';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmAnalyticsMessages } from '@/i18n/messages/kpm-analytics';
import { cn } from '@/lib/cn';
import { formatPercent, formatRupiahCompact } from '@/lib/format';
import {
  LEADER_CHIPS, firstName, groupSplit, groupTreeHref, leadersIn, memberPageHref, mocButtonName, unitDashboardHref,
  type AnalyticsLeader, type AnalyticsPeriod, type LeaderChip,
} from '@/lib/kpm-analytics';
import type { MocOpen } from './moc';

/**
 * **KPM Analytics' *Leader* list** (UI-152 and its Appendix D row; P19.3-T3 AC-1, AC-2, AC-13; the `kpm-leaders`
 * mockups of 3 November, which win over `kpm-mobile` screen 2): *"Per AB"* becomes **Leader** — every AB **and** AAB,
 * chips *Semua n · AB n · AAB n*, in the server's order *"↓ Perlu perhatian dulu"* (lowest APE % first), and the one
 * line saying what the rows count, *"Anggota saat ini"* (ADR-0204 §1, OWN R1).
 *
 * - **Below 1024px, one 60px row each** (`PersonRow`): the name in capitals with a club pill, an *AAB* pill or *Anda*;
 *   the APE % bar, the %, the APE; *"n orang"* for an AB or *"ke <first name>"* for an AAB; a MOC pill for an AB; ›. A
 *   tablet reads the phone's rows (UI-097's rule, carried over).
 * - **From 1024px, a table** that fits 1280 and 1024 without scrolling sideways (UI-097): *Nama · Leader dari · Group ·
 *   APE bulan ini · Active · Coached 7D · Club · MOC · ›*, its headers 12px in sentence case, MOC a tinted pill (D-27).
 * - **A row opens the leader** (`onOpen`): the sheet below 1024px, the side panel from it (`LeaderSheet`). The MOC pill
 *   is its own target, opening the requirements, as UI-109's row did.
 */
export function LeaderList({
  leaders, period, split, desktop, chip, onChip, onOpen, onOpenMoc,
}: {
  leaders: readonly AnalyticsLeader[];
  period: AnalyticsPeriod;
  /** The status split the bars are coloured by: the server's `thresholds.statusSplitPct` (invariant §7). */
  split: number;
  desktop: boolean;
  chip: LeaderChip;
  onChip: (chip: LeaderChip) => void;
  onOpen: (leader: AnalyticsLeader) => void;
  onOpenMoc: (open: MocOpen) => void;
}) {
  const t = useMessages(kpmAnalyticsMessages);
  const headId = useId();
  const shown = leadersIn(leaders, chip);
  return (
    <section aria-labelledby={headId} className="mt-3.5 overflow-hidden rounded-lg bg-card" data-leaders="">
      <div className="flex flex-wrap items-center gap-2 px-3 pb-2 pt-3 lg:px-4">
        <h2 id={headId} className="mr-2 text-md font-bold text-navy">{t.leaders.title}</h2>
        <div role="group" aria-label={t.leaders.chipsName} className="flex flex-wrap gap-1.5 max-lg:order-last max-lg:basis-full">
          {LEADER_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={chip === c}
              onClick={() => onChip(c)}
              className={cn(
                'flex min-h-11 items-center rounded-pill px-3 text-sm font-semibold lg:min-h-8',
                chip === c ? 'bg-secondary text-secondary-contrast' : 'bg-hover-row text-pill-grey-ink',
              )}
            >
              {t.leaders.chip({ chip: c, n: leadersIn(leaders, c).length })}
            </button>
          ))}
        </div>
        <p className="ml-auto text-sm text-muted"><span aria-hidden="true">↓ </span>{t.leaders.attentionFirst}</p>
      </div>
      {/* What the rows count, said once (ADR-0204 §1, OWN R1): the total above counts the KPM, leavers included. */}
      <p className="px-3 pb-2 text-xs text-muted lg:px-4" data-current-members="">{t.currentMembersOnly}</p>
      {leaders.length === 0 ? (
        <EmptyState title={t.leaders.empty} action={<p>{t.leaders.emptyLine}</p>} />
      ) : desktop ? (
        <LeaderTable leaders={shown} period={period} split={split} labelledBy={headId} onOpen={onOpen} onOpenMoc={onOpenMoc} />
      ) : (
        <ul aria-labelledby={headId} className="divide-y divide-divider">
          {shown.map((leader) => (
            <li key={leader.head.membershipId}>
              <LeaderRow leader={leader} split={split} onOpen={onOpen} onOpenMoc={onOpenMoc} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The share's bar, 44 × 5px, green at or above the server's split and red below. */
function ShareBar({ pct, good }: { pct: number; good: boolean }) {
  return (
    <span aria-hidden="true" className="inline-block h-[5px] w-11 shrink-0 overflow-hidden rounded-sm bg-base align-middle">
      <span className={cn('block h-full', good ? 'bg-signal-green' : 'bg-signal-red')} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </span>
  );
}

/** The name's pill: the AB's club, *AAB*, or *Anda* on the reader's own row (the mockup's one pill). */
function NamePill({ leader }: { leader: AnalyticsLeader }) {
  const t = useMessages(kpmAnalyticsMessages);
  if (leader.head.isReader) return <TonePill tone="blue">{t.v1.you}</TonePill>;
  if (leader.role === 'aab') return <TonePill tone="amber">{t.tagAab}</TonePill>;
  if (leader.club) return <TonePill tone="amber">{leader.club.label}</TonePill>;
  return null;
}

/** MOC as a tinted pill (D-27), ✓ when met, its own target opening the requirements; an AAB's row draws none. */
function MocPill({ leader, onOpenMoc }: { leader: AnalyticsLeader; onOpenMoc: (open: MocOpen) => void }) {
  const t = useMessages(kpmAnalyticsMessages);
  const language = useLanguage();
  const { moc } = leader;
  if (leader.role !== 'ab' || !moc) return null;
  return (
    <button
      type="button"
      onClick={() => onOpenMoc({ name: leader.head.name, moc })}
      aria-label={mocButtonName(moc, leader.head.name, language)}
      className="relative z-[1] flex min-h-11 shrink-0 items-center lg:min-h-8"
      data-moc-pill={moc.status}
    >
      <TonePill tone={moc.status === 'met' ? 'green' : 'grey'}>
        {moc.status === 'met' && <LineIcon name="check" className="mr-0.5 h-3 w-3" />}
        {t.headMoc}
      </TonePill>
    </button>
  );
}

/** The APE line: the bar and % (when there is a target), the sum, then *n orang* or *ke Agus* — or *Goal belum diatur*. */
function ApeMeta({ leader, split, withPeople }: { leader: AnalyticsLeader; split: number; withPeople: boolean }) {
  const t = useMessages(kpmAnalyticsMessages);
  const figures = useFigureLanguage();
  const { apeMonth } = leader;
  const good = apeMonth.pct !== null && apeMonth.pct >= split;
  const sum = apeMonth.achievedMinor === null ? t.notUploaded : formatRupiahCompact(apeMonth.achievedMinor, {}, figures);
  const who = leader.role === 'aab' && leader.above
    ? t.leaders.toLeader({ name: firstName(leader.above.name) })
    : t.v1.people({ n: leader.group });
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted">
      {apeMonth.pct !== null && (
        <>
          <ShareBar pct={apeMonth.pct} good={good} />
          <span className={cn('font-semibold', good ? 'text-signal-green' : 'text-signal-red')}>{formatPercent(apeMonth.pct, {}, figures)}</span>
        </>
      )}
      <span className="min-w-0">
        {sum}
        {withPeople && <>{' · '}{who}</>}
        {apeMonth.targetMinor === null && <>{' · '}{t.noGoal}</>}
      </span>
    </span>
  );
}

/** One leader below 1024px: 60px, the whole row opening the leader. */
function LeaderRow({ leader, split, onOpen, onOpenMoc }: {
  leader: AnalyticsLeader; split: number; onOpen: (leader: AnalyticsLeader) => void; onOpenMoc: (open: MocOpen) => void;
}) {
  return (
    <PersonRow
      name={leader.head.name}
      seed={leader.head.membershipId}
      height={60}
      onSelect={() => onOpen(leader)}
      chevron
      badge={<NamePill leader={leader} />}
      meta={<ApeMeta leader={leader} split={split} withPeople />}
      trailing={<MocPill leader={leader} onOpenMoc={onOpenMoc} />}
      className="rounded-none"
    />
  );
}

/** The table's header cell: 12px, sentence case (UI-097), right-aligned for a figure. */
const TH = 'whitespace-nowrap bg-base px-2 py-2 text-xs font-semibold text-muted xl:px-3';
const TD = 'h-[52px] whitespace-nowrap border-t border-divider px-2 xl:px-3';

/** From 1024px: the leaders as a table, fitting its card — no sideways scroll (UI-097, P19.3-T3 AC-13). */
function LeaderTable({
  leaders, period, split, labelledBy, onOpen, onOpenMoc,
}: {
  leaders: readonly AnalyticsLeader[];
  period: AnalyticsPeriod;
  split: number;
  labelledBy: string;
  onOpen: (leader: AnalyticsLeader) => void;
  onOpenMoc: (open: MocOpen) => void;
}) {
  const t = useMessages(kpmAnalyticsMessages);
  const h = t.leaders;
  return (
    // `relative`, so the sr-only header's absolute position is the table's, never the page's (P10.1-T4).
    <table aria-labelledby={labelledBy} className="relative w-full table-fixed border-collapse text-md" data-leader-table="">
      <colgroup>
        <col className="w-[30%]" />
        <col className="w-[9%]" />
        <col className="w-[7%]" />
        <col className="w-[20%]" />
        <col className="w-[8%]" />
        <col className="w-[9%]" />
        <col className="w-[9%]" />
        <col className="w-[6%]" />
        <col className="w-[2.25rem]" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className={cn(TH, 'pl-4 text-left')}>{h.headName}</th>
          <th scope="col" className={cn(TH, 'text-left')}>{h.headLeaderOf}</th>
          <th scope="col" className={cn(TH, 'text-right')}>{h.headGroup}</th>
          <th scope="col" className={cn(TH, 'text-left')}>{h.headApeMonth({ period })}</th>
          <th scope="col" className={cn(TH, 'text-right')}>{h.headActive}</th>
          <th scope="col" className={cn(TH, 'text-right')}>{h.headCoached}</th>
          <th scope="col" className={cn(TH, 'text-left')}>{h.headClub}</th>
          <th scope="col" className={cn(TH, 'text-left')}>{t.headMoc}</th>
          <th scope="col" className={TH}><span className="sr-only">{h.open({ name: '' }).trim()}</span></th>
        </tr>
      </thead>
      <tbody>
        {leaders.map((leader) => (
          <tr key={leader.head.membershipId} className="relative lg:hover:bg-hover-row" data-leader={leader.head.membershipId}>
            <th scope="row" className={cn(TD, 'pl-4 text-left font-normal')}>
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={leader.head.name} seed={leader.head.membershipId} size={32} />
                {/* The row's target, stretched over it: the name is what a screen reader hears it by. */}
                <button
                  type="button"
                  onClick={() => onOpen(leader)}
                  className="min-w-0 truncate text-left text-md font-bold uppercase tracking-[0.2px] text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                >
                  {leader.head.name}
                </button>
                {(leader.head.isReader || leader.role === 'aab') && <span className="shrink-0"><NamePill leader={leader} /></span>}
              </span>
            </th>
            <td className={cn(TD, 'truncate text-sm text-muted')}>{leader.above ? firstName(leader.above.name) : '—'}</td>
            <td className={cn(TD, 'text-right tabular-nums')}>{leader.group}</td>
            <td className={cn(TD, 'overflow-hidden')}><ApeMeta leader={leader} split={split} withPeople={false} /></td>
            <td className={cn(TD, 'text-right tabular-nums')}><ActiveCell leader={leader} /></td>
            <td className={cn(TD, 'text-right tabular-nums')}>{leader.coached7d.count} / {leader.coached7d.of}</td>
            <td className={TD}>{leader.club && <TonePill tone="amber">{leader.club.label}</TonePill>}</td>
            <td className={TD}><MocPill leader={leader} onOpenMoc={onOpenMoc} /></td>
            <td className={cn(TD, 'pr-3 text-right')}><LineIcon name="chevronRight" className="ml-auto h-5 w-5 text-signal-grey" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** *4 / 12*, or *—* while the month is not uploaded (D1 is tri-state). */
function ActiveCell({ leader }: { leader: AnalyticsLeader }) {
  const t = useMessages(kpmAnalyticsMessages);
  if (leader.active.count === null) {
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t.notUploaded}</span>
      </>
    );
  }
  return <>{leader.active.count} / {leader.active.of}</>;
}

/**
 * **The leader, opened** (UI-152; `kpm-leaders-mobile` screen 3; P19.3-T3 AC-2, AC-10, AC-13): a sheet below 1024px and
 * a side panel from it (`ResponsiveSheet side`). Who they are — *AB · 12 di Group · 4 di Unit · Elite Club*, and the
 * Group's split in one format (*"3 AAB · 7 Agents"*, UI-094); four tiles in the Unit Dashboard's style — *APE bulan ini*
 * against target, *Active this month* with *"Unit n/m · AAB n/m"*, *Coached 7 hari*, *MOC* with *"n dari m syarat"*;
 * the Group's leads with *"(n potensial)"* behind ⓘ (UI-097's leads cell, carried over); then the links.
 *
 * **The links go where the reader may go** (AC-3, ADR-0159 §2): *Unit Dashboard ›* and *Group Tree ›* when the server
 * says the reader may open this leader's views (`opens`) — the Unit Dashboard only for somebody who leads, since one of
 * nobody is no unit — and *Member page ›* for the Owner and an Admin, whose route it is. Each in the same tab (UI-095).
 */
export function LeaderSheet({
  leader, period, split, office, onClose, onLeave,
}: {
  leader: AnalyticsLeader | null;
  period: AnalyticsPeriod;
  split: number;
  /** The Owner or an Admin: *Member page ›* is theirs. */
  office: boolean;
  onClose: () => void;
  /** A link is followed: the screen keeps its scroll and this leader open for *Back* (UI-095). */
  onLeave: () => void;
}) {
  const t = useMessages(kpmAnalyticsMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  if (!leader) return null;
  const s = t.sheet;
  const { apeMonth, active, coached7d, moc, leads } = leader;
  const role = leader.role === 'ab' ? t.tagAb : t.tagAab;
  const meta = [s.meta({ role, group: leader.group, unit: leader.unit }), leader.club?.label].filter(Boolean).join(' · ');
  const count = (n: number | null) => (n === null ? '–' : String(n));
  const metCount = moc ? moc.criteria.filter((c) => c.met === true).length : 0;
  const potential = leads.salesPotential + leads.recruitPotential;
  const good = apeMonth.pct !== null && apeMonth.pct >= split;
  return (
    <ResponsiveSheet open side title={leader.head.name.toUpperCase()} description={meta} onClose={onClose}>
      <div data-leader-sheet={leader.head.membershipId}>
        <p className="text-sm text-muted">{groupSplit(leader, language)}</p>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <StatTile
            className="bg-base"
            label={s.apeMonth({ period })}
            value={apeMonth.achievedMinor === null ? t.notUploaded : formatRupiahCompact(apeMonth.achievedMinor, {}, figures)}
            bar={apeMonth.pct}
            sub={apeMonth.targetMinor === null ? t.noGoal
              : apeMonth.pct === null ? undefined
                : <span className={good ? 'text-signal-green' : 'text-signal-red'}>{s.pctOfTarget({ pct: formatPercent(apeMonth.pct, {}, figures) })}</span>}
          />
          <StatTile
            className="bg-base"
            label={s.active({ period })}
            value={count(active.count)}
            unit={active.count === null ? undefined : `/ ${active.of}`}
            sub={active.count === null ? t.notUploaded : s.activeSplit({
              unit: count(active.unit.count), unitOf: active.unit.of, aab: count(active.aab.count), aabOf: active.aab.of,
            })}
          />
          <StatTile
            className="bg-base"
            label={s.coached}
            value={String(coached7d.count)}
            unit={`/ ${coached7d.of}`}
            sub={coached7d.pct === null ? '—' : formatPercent(coached7d.pct, {}, figures)}
          />
          <StatTile
            className="bg-base"
            label={t.headMoc}
            value={!moc ? '—' : moc.status === 'met' ? s.mocMet : moc.status === 'not_met' ? s.mocNotYet : '—'}
            sub={moc ? s.criteria({ met: metCount, of: moc.criteria.length }) : undefined}
          />
        </div>
        <p className="mt-2.5 flex items-center gap-1 text-sm text-muted" data-leads="">
          <span>{s.leads({ total: leads.sales + leads.recruit, sales: leads.sales, recruit: leads.recruit })}</span>
          {potential > 0 && <TippedGlyph glyph="ⓘ" name={s.potential({ n: potential })} tip={s.potential({ n: potential })} align="fit" />}
        </p>
        <nav aria-label={leader.head.name} className="mt-2 flex flex-col">
          {leader.opens && (leader.head.leads || leader.head.isReader) && (
            <Go href={unitDashboardHref(leader.head)} icon="barChart" onLeave={onLeave}>{s.unitDashboard}</Go>
          )}
          {leader.opens && <Go href={groupTreeHref(leader.head)} icon="tree" onLeave={onLeave}>{s.groupTree}</Go>}
          {office && <Go href={memberPageHref(leader.head.membershipId)} icon="user" onLeave={onLeave}>{s.memberPage}</Go>}
        </nav>
      </div>
    </ResponsiveSheet>
  );
}

/** One of the sheet's links: 48px, its icon, its words and ›, the whole row the target — in the same tab. */
function Go({ href, icon, onLeave, children }: { href: string; icon: LineIconName; onLeave: () => void; children: ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onLeave}
      className="flex min-h-12 items-center gap-2.5 border-t border-divider px-1 text-base font-semibold text-navy first:border-t-0 hover:bg-hover-row"
    >
      <LineIcon name={icon} className="h-5 w-5 text-primary-ink" />
      <span className="min-w-0 flex-1">{children}</span>
      <LineIcon name="chevronRight" className="h-5 w-5 text-signal-grey" />
    </Link>
  );
}
