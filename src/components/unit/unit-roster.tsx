'use client';

import Link from 'next/link';
import { useId, useState, type MouseEvent, type ReactNode } from 'react';
import { MemberContactButtons } from '@/components/contact-buttons';
import { Avatar } from '@/components/ui/avatar';
import { LineIcon } from '@/components/ui/line-icon';
import { RungTag, useIsLeaderRung } from '@/components/ui/rung-tag';
import { SectionTitle } from '@/components/ui/section-title';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { cn } from '@/lib/cn';
import { formatNumber, formatPercent, formatRupiahCompactPair, formatShortDay } from '@/lib/format';
import { useCan } from '@/lib/session';
import {
  goalShare, progressTone, rowHref, rowName, rowsOf,
  type UnitDashboardView, type UnitGroup, type UnitPeriod, type UnitRow, type UnitTotal,
} from '@/lib/unit-dashboard';
import { CoachingStatusTile } from './coaching-status-tile';

/**
 * ***Roster tim Anda*** (P19.18-T1 AC-5 to AC-9; ADR-0271 §4–§6; the brief of 19 November 2026, part A;
 * `unit-overview-{mobile,tablet,laptop}`) — **one drawing of unit cards at every size; no wide table any more**.
 *
 * - **The title row**: *Roster tim Anda · 30*, an ⓘ, *⟳ 27 Okt 26* (the office's latest production import, UI-028), and
 *   on a tablet and a laptop ***+ Tambah agent*** and ***Perbarui produksi*** on the right (the screen's `actions`).
 * - **One header per unit** — the reader's own (*Unit Anda*), then each unit below them, then *Belum punya leader* — with
 *   the leader's photo, *n orang* and the unit's progress (*12% · Rp 605,5 Jt / 5 M* and its bar) **even when closed**.
 *   **Every team inside it**, at any depth, is a **team line** built like the header — the same orange tint, the team
 *   leader's photo, *n orang*, its own progress — never a folder to open (*"one header level only"*).
 * - **The rows in the server's order**: inside every unit and team the AB, then the AAB(s), then the agents (AC-6).
 * - **A person**: photo (initials without one), the orange *AB* / *AAB* label before the NAME in capitals (agents none),
 *   then **% + *Rp x / y* + a thin bar on that line**, or *Belum diunggah* / *Goal belum diatur* there — never a floating
 *   pill — then WhatsApp and ›. **Progress is navy below 100%, green from 100%; never red** (AC-5). **No status pill and
 *   no status chips** (OD-391: *"the % colour carries it"*).
 * - **Phone**: the units an accordion, *Unit Anda* open; **from 768px** every unit open (a tap on its header closes it),
 *   the people two a row on a tablet held upright and **three a row from 1024px**, each with **the coaching status tile
 *   under the bar, exactly as wide** (`COACHING_STATUS`), and *Leads sales n · Leads rekrut n* for the period (AC-8).
 * - **A tap on a person** (AC-9): with `view.personCard` — the KPM Owner, an Admin — the person's card first
 *   (`onPerson`); anybody else straight to the person's Personal Summary (`rowHref`, UI-011), the reader's own row to
 *   their own. A row the reader may not open goes nowhere.
 *
 * Every figure is the server's; this sums nothing.
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
  /** The person card (AC-9): drawn by the screen when the server says the reader opens one. */
  onPerson?: (row: UnitRow, unit: string) => void;
}

export function UnitRoster({ view, period, from, size, actions, onLeave, onPerson }: RosterProps) {
  const headingId = useId();
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages);
  const sections = useSections(view);
  // *Roster tim Anda · 30*: the server's count, the same number as *Tim Anda* (`tiles.team.total`, every row).
  const total = view.tiles.team.total;

  /** A row's link followed (a click on an `<a>` inside the roster): tell the screen, which keeps the scroll. */
  const leaving = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a[href]')) onLeave?.();
  };
  const wide = size !== 'phone';
  const card = view.personCard && onPerson ? onPerson : undefined;

  return (
    <section aria-labelledby={headingId} data-roster={size} onClickCapture={leaving} className="mt-3 overflow-clip rounded-lg bg-card lg:mt-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 pb-2.5 pt-3 md:px-4">
        <SectionTitle id={headingId}>{t.v1.rosterCount({ title: t.prototype.roster, n: total })}</SectionTitle>
        <TippedGlyph glyph="ⓘ" name={t.overview.rosterInfo} tip={t.overview.rosterRules} align="fit" className={TIP} />
        {view.lastUpload && (
          <span data-last-updated="" className="inline-flex items-center gap-1 text-sm text-signal-grey max-md:ml-auto md:ml-auto">
            <LineIcon name="refresh" className="h-3.5 w-3.5" />
            <span className="sr-only">{t.v1.lastUpdatedLabel}</span>
            {shortDayWithYear(view.lastUpload, figures)}
          </span>
        )}
        {wide && actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      </div>
      <Sections sections={sections} view={view} period={period} from={from} wide={wide} card={card} />
    </section>
  );
}

/** *⟳ 28 Okt 26* (UI-028): the day and month as the product writes them, and the year's two digits. */
export const shortDayWithYear = (day: string, figures: Parameters<typeof formatShortDay>[2]) =>
  `${formatShortDay(day, {}, figures)} ${day.slice(2, 4)}`;

/** The ⓘ's bubble, below its glyph, its lines kept. */
const TIP = cn(
  'normal-case tracking-normal',
  '[&>[role=tooltip]]:bottom-auto [&>[role=tooltip]]:top-full [&>[role=tooltip]]:mb-0 [&>[role=tooltip]]:mt-1',
  '[&>[role=tooltip]]:w-[250px] [&>[role=tooltip]]:whitespace-pre-line [&>[role=tooltip]]:font-normal',
);

/** A unit line's or a team line's leader: whose photo it carries. */
interface LineLeader {
  membershipId: string;
  name: string;
  photoUrl: string | null;
}

/** A team inside a unit (an AAB with people, at any depth): its line, then its own rows. */
export interface RosterBlock {
  team: { key: string; label: string; leader: LineLeader; count: number; goal: UnitTotal['goal'] } | null;
  rows: UnitRow[];
}

/** One unit of the roster: its header, then its own rows and each team inside it. */
export interface RosterSection {
  key: string;
  label: string;
  leader: LineLeader | null;
  count: number;
  goal: UnitTotal['goal'];
  blocks: RosterBlock[];
}

const leaderOf = (row: UnitRow): LineLeader => ({ membershipId: row.membershipId, name: row.name, photoUrl: row.photoUrl ?? null });

/**
 * **The roster's units** (AC-6): *Unit Anda* — or *Unit {head}* in a view of a unit below the reader — then each unit below
 * the head with every team nested in it flattened into team lines, in the server's order, then *Belum punya leader*.
 */
export function rosterSections(
  view: Pick<UnitDashboardView, 'head' | 'yourUnit' | 'units'> & { unled?: UnitDashboardView['unled'] },
  words: { own: string; unitOf: (name: string) => string; unled: string },
): RosterSection[] {
  const teams = (groups: readonly UnitGroup[]): RosterBlock[] => groups.flatMap((g) => [
    {
      team: { key: g.head.membershipId, label: words.unitOf(g.head.name), leader: leaderOf(g.head), count: rowsOf(g).length, goal: g.total.goal },
      rows: [g.head, ...g.members],
    },
    ...teams(g.units),
  ]);
  const own: RosterSection[] = view.yourUnit.rows.length > 0 ? [{
    key: 'own',
    label: view.head.isReader ? words.own : words.unitOf(view.head.name),
    leader: leaderOf(view.yourUnit.rows[0]),
    count: view.yourUnit.rows.length,
    goal: view.yourUnit.total.goal,
    blocks: [{ team: null, rows: view.yourUnit.rows }],
  }] : [];
  const units: RosterSection[] = view.units.map((g) => ({
    key: g.head.membershipId,
    label: words.unitOf(g.head.name),
    leader: leaderOf(g.head),
    count: rowsOf(g).length,
    goal: g.total.goal,
    blocks: [{ team: null, rows: [g.head, ...g.members] }, ...teams(g.units)],
  }));
  const unled: RosterSection[] = view.unled && view.unled.rows.length > 0 ? [{
    key: 'unled', label: words.unled, leader: null, count: view.unled.rows.length, goal: view.unled.total.goal,
    blocks: [{ team: null, rows: view.unled.rows }],
  }] : [];
  return [...own, ...units, ...unled];
}

/** The sections in the reader's words: unit names in capitals (the naming rule), *Unit Anda* the reader's own. */
function useSections(view: UnitDashboardView): RosterSection[] {
  const t = useMessages(unitDashboardMessages);
  return rosterSections(view, {
    own: t.prototype.yourUnitGroup,
    unitOf: (name) => t.unitOf({ name: name.toLocaleUpperCase('id-ID') }),
    unled: t.views.unled,
  });
}

function Sections({
  sections, view, period, from, wide, card,
}: {
  sections: RosterSection[]; view: UnitDashboardView; period: UnitPeriod; from: string; wide: boolean;
  card?: (row: UnitRow, unit: string) => void;
}) {
  // A phone opens *Unit Anda* alone; from 768px every unit is open, and a tap on its header closes it (AC-8).
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(wide ? sections.map((s) => s.key) : sections.slice(0, 1).map((s) => s.key)));
  const toggle = (key: string) => setOpen((now) => {
    const next = new Set(now);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  return (
    <div data-roster-units="">
      {sections.map((section) => (
        <UnitSection
          key={section.key}
          section={section}
          open={open.has(section.key)}
          onToggle={() => toggle(section.key)}
          view={view}
          period={period}
          from={from}
          wide={wide}
          card={card}
        />
      ))}
    </div>
  );
}

function UnitSection({
  section, open, onToggle, view, period, from, wide, card,
}: {
  section: RosterSection; open: boolean; onToggle: () => void; view: UnitDashboardView; period: UnitPeriod; from: string;
  wide: boolean; card?: (row: UnitRow, unit: string) => void;
}) {
  const bodyId = useId();
  return (
    <div data-unit-section={section.key}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          data-unit-line=""
          className="flex min-h-14 w-full items-center gap-2.5 border-t border-divider bg-primary/[0.12] px-3.5 py-2 text-left text-md font-bold text-ink md:px-4"
        >
          <LineIcon name={open ? 'chevronDown' : 'chevronRight'} className="h-4 w-4 shrink-0 text-signal-grey" />
          <LineContent label={section.label} leader={section.leader} count={section.count} goal={section.goal} wide={wide} />
        </button>
      </h3>
      {open && (
        <div id={bodyId}>
          {section.blocks.map((block, i) => (
            <div key={block.team?.key ?? `own-${i}`} data-roster-block={block.team?.key ?? 'own'}>
              {block.team && (
                <div data-team-line={block.team.key} className="flex min-h-12 items-center gap-2.5 border-t border-divider bg-primary/[0.12] py-2 pl-9 pr-3.5 text-md font-bold text-ink md:pl-10 md:pr-4">
                  <LineContent label={block.team.label} leader={block.team.leader} count={block.team.count} goal={block.team.goal} wide={wide} />
                </div>
              )}
              <ul role="list" className={cn('border-t border-divider', wide && 'grid md:grid-cols-2 lg:grid-cols-3')}>
                {block.rows.map((row) => (
                  <PersonCell
                    key={row.membershipId}
                    row={row}
                    unit={section.label}
                    period={period}
                    from={from}
                    wide={wide}
                    readOnly={view.readOnly}
                    card={card}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * **A unit's or a team's line** (UI-206): the leader's photo, the label, *n orang*, and the progress — under the label on
 * a phone, on the right from 768px — the same pieces a person's row draws.
 */
function LineContent({
  label, leader, count, goal, wide,
}: { label: string; leader: LineLeader | null; count: number; goal: UnitTotal['goal']; wide: boolean }) {
  const words = useMessages(unitDashboardMessages);
  const people = <span data-line-count="" className="shrink-0 text-sm font-semibold text-signal-grey">{words.overview.people({ n: count })}</span>;
  return (
    <>
      {leader && <Avatar name={leader.name} photoUrl={leader.photoUrl} seed={leader.membershipId} size={28} />}
      {wide ? (
        <>
          <span className="min-w-0 truncate">{label}</span>
          <span aria-hidden="true" className="text-signal-grey">·</span>
          {people}
          <span className="ml-auto w-60 shrink-0"><Progress goal={goal} align="end" /></span>
        </>
      ) : (
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {people}
          </span>
          <span className="mt-0.5 block max-w-[12rem] font-medium"><Progress goal={goal} /></span>
        </span>
      )}
    </>
  );
}

/**
 * **A goal's progress, on its line** (AC-5, AC-7): the % — navy below 100%, green from 100%, never red, judged on the
 * server's unrounded figure — and *Rp x / y* in grey, a thin bar under them in the same colour. No goal: a dashed bar and
 * *Goal belum diatur*; nothing uploaded: the dashed bar and *Belum diunggah*; a year made before the month: *Target tahun
 * ini tercapai*. **No figure is shown as 0.**
 */
function Progress({
  goal, align = 'start',
}: {
  goal: { set?: boolean; targetMinor: number | null; actualMinor: number | null; attainmentPct: number | null };
  align?: 'start' | 'end';
}) {
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages);
  const { targetMinor: target, actualMinor: actual } = goal;
  const dashed = (words: string) => (
    <span className={cn('flex min-w-0 items-center gap-1.5 text-sm font-medium text-signal-grey', align === 'end' && 'justify-end')}>
      <span aria-hidden="true" data-goal-bar="none" className="h-1.5 w-9 shrink-0 rounded-sm border border-dashed border-line" />
      {words}
    </span>
  );
  if (goal.set === false || target === null) return dashed(t.own.noGoal);
  if (target === 0) return <span className="text-sm font-semibold text-signal-green">{t.own.targetMade}</span>;
  if (actual === null) return dashed(t.own.notUploaded);
  const pct = goal.attainmentPct ?? 0;
  const tone = progressTone(pct);
  const share = goalShare({ ...goal, set: true }) ?? 0;
  const width = pct > 0 ? Math.max(share, 2) : 0;
  return (
    <span className="flex w-full min-w-0 flex-col">
      <span className={cn('flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium', align === 'end' && 'justify-end')}>
        <b data-progress-tone={tone} className={cn('font-bold', tone === 'green' ? 'text-signal-green' : 'text-navy')}>
          {formatPercent(pct, {}, figures)}
        </b>
        <span className="min-w-0 truncate text-signal-grey">{formatRupiahCompactPair(actual, target, '/', figures)}</span>
      </span>
      <span aria-hidden="true" data-goal-bar={share} className="mt-[5px] block h-[5px] w-full overflow-hidden rounded-sm bg-base">
        <span className={cn('block h-full rounded-sm', tone === 'green' ? 'bg-signal-green' : 'bg-secondary')} style={{ width: `${width}%` }} />
      </span>
    </span>
  );
}

/** The person card's progress figure and line: the same rule as a row's, for `unit-person-card.tsx`. */
export { Progress as GoalProgress };

/**
 * **A row's WhatsApp** (P19.9-T4 AC-1; R6, ADR-0235, OD-291) — Home's rule: the 36px green circle straight to WhatsApp with
 * a number on file; without one, *Isi nomor WhatsApp* for a reader who may save it (`member:update_phone`) — and nothing
 * for one who may not. **Never on the reader's own row, and never in the office's read-only view** (P19.3-T3 AC-3).
 */
function RowWhatsApp({ row, readOnly }: { row: UnitRow; readOnly: boolean }) {
  const canSavePhone = useCan('member:update_phone');
  const [saved, setSaved] = useState<string | null>(null);
  if (readOnly) return null;
  const phone = saved ?? row.phone;
  if (row.isReader || !(canSavePhone || phone)) return <span aria-hidden="true" className="w-9 shrink-0" />;
  return (
    <span data-row-whatsapp="" className="-mx-1 flex">
      <MemberContactButtons
        membershipId={row.membershipId}
        name={row.name}
        phone={phone}
        channels={['whatsapp']}
        size={36}
        onSaved={setSaved}
      />
    </span>
  );
}

/**
 * **One person** (AC-7, AC-8): photo, the orange label and the NAME, the progress on its line — and from 768px the
 * coaching status tile as wide as the bar and *Leads sales n · Leads rekrut n* — then WhatsApp and ›. **The name is the
 * row's target, stretched over it**, so WhatsApp stays its own control above it.
 */
function PersonCell({
  row, unit, period, from, wide, readOnly, card,
}: {
  row: UnitRow; unit: string; period: UnitPeriod; from: string; wide: boolean; readOnly: boolean;
  card?: (row: UnitRow, unit: string) => void;
}) {
  const language = useLanguage();
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages);
  const isLeader = useIsLeaderRung();
  const href = rowHref(row, from);
  const name = rowName(row, language);
  // The reader's own row goes to their own Summary; anybody else's card first where the server says so (AC-9).
  const opensCard = card !== undefined && !row.isReader;
  const target = 'text-left uppercase after:absolute after:inset-0 after:content-[\'\'] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-focus-ring';
  const nameEl = opensCard ? (
    <button type="button" aria-haspopup="dialog" onClick={() => card(row, unit)} className={target}>{name}</button>
  ) : href ? (
    <Link href={href} className={target}>{name}</Link>
  ) : (
    <span className="uppercase">{name}</span>
  );
  const number = (n: number) => formatNumber(n, {}, figures);
  return (
    <li
      data-person={row.membershipId}
      data-period={period}
      className={cn(
        'relative flex min-h-16 items-center gap-2.5 border-b border-divider px-3 py-2 md:px-3.5',
        wide && 'md:border-r md:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0',
        (opensCard || href) && 'lg:hover:bg-hover-row',
      )}
    >
      <Avatar name={row.name} photoUrl={row.photoUrl ?? null} seed={row.membershipId} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold leading-tight text-ink [overflow-wrap:anywhere]">
          {isLeader(row.rung) && <RungTag rung={row.rung} className="mr-1.5" />}
          {nameEl}
        </p>
        <div className="mt-0.5 max-w-[11.5rem]">
          <Progress goal={row.goal} />
          {wide && (
            <>
              <CoachingStatusTile status={row.coaching.status} days={row.coaching.days} fill className="mt-1.5" />
              <p data-period-leads="" className="mt-1 flex flex-wrap gap-x-3 whitespace-nowrap text-sm text-muted">
                <span>{t.overview.salesLeads} <b className="text-ink">{number(row.periodLeads.sales)}</b></span>
                <span>{t.overview.recruitLeads} <b className="text-ink">{number(row.periodLeads.recruitment)}</b></span>
              </p>
            </>
          )}
        </div>
      </div>
      <RowWhatsApp row={row} readOnly={readOnly} />
      {opensCard || href
        ? <LineIcon name="chevronRight" className="h-4 w-4 shrink-0 text-signal-grey" />
        : <span aria-hidden="true" className="w-4 shrink-0" />}
    </li>
  );
}
