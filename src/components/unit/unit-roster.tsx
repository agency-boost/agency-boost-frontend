'use client';

import Link from 'next/link';
import { useId, useState, type MouseEvent, type ReactNode } from 'react';
import { MemberContactButtons } from '@/components/contact-buttons';
import { HEADER_CONTROL } from '@/components/ui/header-control';
import { LineIcon } from '@/components/ui/line-icon';
import { PersonRow } from '@/components/ui/person-row';
import { RungTag } from '@/components/ui/rung-tag';
import { SectionTitle } from '@/components/ui/section-title';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { cn } from '@/lib/cn';
import { lastOneOnOneLine, rosterStatusLabel, type RosterStatus } from '@/lib/coaching';
import { formatNumber, formatPercent, formatRupiahCompactPair, formatShortDay } from '@/lib/format';
import { useCan } from '@/lib/session';
import {
  everyRow, goalMet, goalShare, matchesFilter, rowHref, rowName, rowsOf, statusShown, statusTally,
  type RosterFilter, type UnitDashboardView, type UnitGroup, type UnitPeriod, type UnitRow, type UnitTotal,
} from '@/lib/unit-dashboard';

/**
 * ***Roster tim Anda*** (UI V1, Phase 18.11 T4; UI-002, UI-005, UI-007, UI-009, UI-011, UI-028;
 * `unit-dashboard-mobile` screens 1–2, `unit-dashboard-desktop` *Overview*). **Three drawings of one roster**, each for
 * its range, never one restyled (the report's *Rules*):
 *
 * - **Below 768px, an accordion by leader** (UI-002): *Unit Anda · 4* first and open, each AAB unit closed, a unit nested
 *   in one inside it; each header 48px with the unit's goal bar and percentage, in place of the old *— Total* card; each
 *   person a 60px row — avatar, NAME, the goal's mini bar, percentage and *Rp 29 jt / 94,7 jt* — with the status pill on
 *   the right. No ⓘ per row, no ⌄, no *Perbarui produksi*, no *+ Tambah agent* (the owner, 30 Oct). **Since the owner's
 *   mobile review of 7 November** (P19.8-T4 AC-3, MOB UI-178; ADR-0229 §3): the NAME on up to two lines, never cut; under
 *   it the percentage in colour and *Rp 68 / 94,7 jt*, and under that **a 5px bar across the name column, for every
 *   person**; the whole row a target with ›; and the chips **equal count tiles**, the count over its words.
 * - **768–1023px, a table of four** (UI-009): *Nama · Progres goal · Aktivitas · Status*.
 * - **From 1024px, a table of nine and a ›** (UI-009): *Nama · Progres goal · Leads penjualan · Closing · Leads rekrut ·
 *   Potensi rekrut · Aktivitas · 1:1 terakhir · Status*; each unit's header row with its totals and *Active n/m*;
 *   every unit open, its header able to close it; the header sticky; nothing scrolls sideways.
 *
 * ***Proposal*** (P19.7-T2 AC-13; ADR-0221 §7): how many proposals each person first saved as a PDF in the period
 * (`PROPOSALS_MADE`), and nothing about the clients — a column after *Potensi rekrut* on a laptop and a tablet (before
 * *Aktivitas* on a tablet, which draws no lead columns), its unit's sum on the header row; on a phone the document icon
 * and the count beside the person's name, only above zero, heard as *"{n} proposal"*. The coaching roster carries none.
 *
 * **Every row is a link, whole** (UI-011): the reader's own to `/summary`, anybody else's to their agent page on the
 * *Personal Summary* tab, `?from=` this page so its ‹ comes back; somebody whose pages the reader may not open is a
 * row that goes nowhere. **The status pill shows on *Bulan ini* alone** (UI-005), and so do the chips that filter by it
 * (*Semua 12 · Perlu perhatian 5 · Perlu dipantau 3*, UI-002); **one ⓘ** says how a status is decided (UI-007) — beside
 * the title on a phone, on the *Status* heading in a table. *⟳ Last updated 28 Okt 26* is the office's latest production
 * import (UI-028) — on a phone *⟳ 28 Okt 26*, its words for a screen reader.
 *
 * **No status without production** (P19.8-T4 AC-2, MOB UI-177; ADR-0229 §2, at every size): a row whose figure is not
 * uploaded shows the dashed bar and *Belum diunggah* and **no pill**, and counts in no status chip; a chip at 0 is not
 * drawn, and **when only *Semua* would remain the chip row is not drawn at all — the title reads *Roster tim Anda · 12***.
 * The title is the section titles' one size, 14px / 700 (MOB UI-185); the chips are header controls (MOB UI-171).
 *
 * **Since the owner's requests of 6 November** (P19.9-T4; R6, R7; ADR-0235, OD-291): **every row, at every period and
 * size, carries the person's level** — the navy tag *Potensi* draws (`RungTag`), before the name — **and a WhatsApp
 * button** (`RowWhatsApp`), Home's rule: with a number on file, or for a reader who may save one; never on the reader's
 * own row, never in the office's read-only view. **Each unit's header carries its amount**, *Rp x / y*, under its label
 * on a phone and on its own line on a laptop below 1280px, where it was read only by a screen reader.
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
  const tally = statusTally(everyRow(view));
  // Only *Semua* would remain (MOB UI-177): no chip row, and the count joins the title.
  const onlyAll = tally.needs_attention === 0 && tally.watch_closely === 0;
  const shownFilter: RosterFilter = month && !onlyAll ? filter : 'all';

  const statusInfo = month ? (
    <TippedGlyph glyph="ⓘ" name={t.prototype.statusInfo} tip={t.prototype.statusRules} align="fit" className={STATUS_TIP} />
  ) : null;
  const chips = month && !onlyAll
    ? size === 'phone'
      ? <CountTiles tally={tally} filter={shownFilter} onFilter={setFilter} language={language} />
      : <StatusChips tally={tally} filter={shownFilter} onFilter={setFilter} language={language} />
    : null;
  const title = month && onlyAll ? t.v1.rosterCount({ title: t.prototype.roster, n: tally.all }) : t.prototype.roster;

  /** A row's link followed (a click on an `<a>` inside the roster): tell the screen, which keeps the scroll. */
  const leaving = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a[href]')) onLeave?.();
  };

  return (
    <section aria-labelledby={headingId} data-roster={size} onClickCapture={leaving} className="mt-3 overflow-clip rounded-lg bg-card lg:mt-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 pb-2 pt-3 md:px-4">
        <SectionTitle id={headingId}>{title}</SectionTitle>
        {size === 'phone' && statusInfo}
        {view.lastUpload && (
          <span data-last-updated="" className="inline-flex items-center gap-1 text-sm text-signal-grey max-md:ml-auto">
            <LineIcon name="refresh" className="h-3.5 w-3.5" />
            {size === 'phone' ? (
              // The phone's *⟳ 27 Okt 26* (the Unit mockup); its words for a screen reader.
              <>
                <span className="sr-only">{t.v1.lastUpdatedLabel}</span>
                {shortDayWithYear(view.lastUpload, figures)}
              </>
            ) : t.v1.lastUpdated({ day: shortDayWithYear(view.lastUpload, figures) })}
          </span>
        )}
        {size !== 'phone' && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {chips}
            {actions}
          </div>
        )}
      </div>
      {size === 'phone' && chips && <div className="px-2.5 pb-3 pt-1">{chips}</div>}

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

/** A row's pill: on *Bulan ini*, and only when its figure is uploaded (MOB UI-177) — `null` otherwise. */
const pillOf = (row: UnitRow, period: UnitPeriod) =>
  (period === 'month' && statusShown(row) ? <StatusPill status={row.status} /> : null);

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
        'inline-flex items-center whitespace-nowrap rounded-pill px-3',
        HEADER_CONTROL,
        tint,
        filter === id && 'outline outline-2 outline-offset-1 outline-secondary',
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label={t.filterLabel} className="flex flex-wrap gap-1.5">
      {chip('all', t.all({ n: tally.all }), filter === 'all' ? 'bg-secondary text-secondary-contrast' : 'border border-line bg-card text-ink')}
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
 * **The phone's count tiles** (P19.8-T4 AC-3, MOB UI-178; ADR-0229 §3; OD-281's default, as drawn): the chips as equal
 * tiles on one row — the count on top, 16px / 800, its words under it, 12px — *12 Semua · 3 Perlu perhatian · 5 Perlu
 * dipantau*; *Semua* navy when chosen, each status on its own tint. A status nobody holds has no tile. Toggle buttons,
 * one pressed, as the chips are.
 */
function CountTiles({
  tally, filter, onFilter, language,
}: { tally: Record<RosterFilter, number>; filter: RosterFilter; onFilter: (f: RosterFilter) => void; language: Parameters<typeof rosterStatusLabel>[1] }) {
  const t = useMessages(unitDashboardMessages).v1;
  const figures = useFigureLanguage();
  const tiles: { id: RosterFilter; label: string; tint: string }[] = [
    { id: 'all', label: t.allTile, tint: filter === 'all' ? 'bg-secondary text-secondary-contrast' : 'bg-hover-row text-ink' },
    ...(tally.needs_attention > 0
      ? [{ id: 'needs_attention' as const, label: rosterStatusLabel('needs_attention', language), tint: 'bg-pill-red text-pill-red-ink' }]
      : []),
    ...(tally.watch_closely > 0
      ? [{ id: 'watch_closely' as const, label: rosterStatusLabel('watch_closely', language), tint: 'bg-pill-amber text-pill-amber-ink' }]
      : []),
  ];
  return (
    <div role="group" aria-label={t.filterLabel} data-count-tiles="" className={cn('grid gap-1.5', tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
      {tiles.map(({ id, label, tint }) => (
        <button
          key={id}
          type="button"
          aria-pressed={filter === id}
          aria-label={`${formatNumber(tally[id], {}, figures)} ${label}`}
          onClick={() => onFilter(id)}
          className={cn(
            'flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center rounded-[14px] px-1.5 text-sm font-semibold leading-tight',
            tint,
            filter === id && id !== 'all' && 'outline outline-2 outline-offset-1 outline-secondary',
          )}
        >
          <span data-count="" className="text-lg font-extrabold tabular-nums">{formatNumber(tally[id], {}, figures)}</span>
          <span className="max-w-full truncate">{label}</span>
        </button>
      ))}
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

/**
 * **A phone row's goal** (P19.8-T4 AC-3, MOB UI-178; ADR-0229 §3): the percentage in colour — green from 100%, red under
 * it — and *Rp 68 jt / 94,7 jt* in grey, and under them **a 5px bar across the name column**, for every person with a
 * figure, in the same colour. No goal: *Goal belum diatur*; no upload: the dashed bar and *Belum diunggah*; a year made
 * before the month: *Target tahun ini tercapai*. **No figure is shown as 0.**
 */
function PhoneGoalLine({ goal }: { goal: UnitRow['goal'] }) {
  const figures = useFigureLanguage();
  const { targetMinor: target, actualMinor: actual } = goal;
  if (goal.set === false || target === null || target === 0 || actual === null) return <GoalLine goal={goal} />;
  const pct = goal.attainmentPct ?? 0;
  const met = goalMet(pct);
  const bar = goalShare({ ...goal, set: true }) ?? 0;
  return (
    <span className="flex w-full min-w-0 flex-col">
      <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
        <span className={cn('font-bold', met ? 'text-signal-green' : 'text-signal-red')}>{formatPercent(pct, {}, figures)}</span>
        <span className="min-w-0 truncate text-signal-grey">{formatRupiahCompactPair(actual, target, '/', figures)}</span>
      </span>
      <span aria-hidden="true" data-goal-bar={bar} className="mt-[5px] block h-[5px] w-full overflow-hidden rounded-sm bg-base">
        <span className={cn('block h-full rounded-sm', met ? 'bg-signal-green' : 'bg-signal-red')} style={{ width: `${bar}%` }} />
      </span>
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

/**
 * **A phone row's proposal count** (P19.7-T2 AC-13): the document icon and the number, only above zero — one image to a
 * screen reader, *"3 proposal"*.
 */
function ProposalsMark({ n }: { n: number }) {
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages).own;
  return (
    <span role="img" aria-label={t.proposalsMade({ n })} data-proposals-made={n} className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-navy">
      <LineIcon name="document" className="h-3.5 w-3.5" />
      <span aria-hidden="true">{formatNumber(n, {}, figures)}</span>
    </span>
  );
}

/** A phone row's marks: the ✓, *New hire*, and its proposals above zero (P19.7-T2 AC-13). `null` with none. */
function phoneMarksOf(row: UnitRow): ReactNode {
  const marks = marksOf(row);
  if (!(row.proposalsMade > 0)) return marks;
  return (
    <span className="inline-flex items-center gap-1.5">
      {marks}
      <ProposalsMark n={row.proposalsMade} />
    </span>
  );
}

/**
 * **A row's WhatsApp** (P19.9-T4 AC-1; R6, ADR-0235, OD-291) — Home's *Laporan aktivitas tim* rule (`home-team.tsx`):
 * the 36px green circle straight to WhatsApp with a number on file; without one, *Isi nomor WhatsApp* for a reader who
 * may save it on the person's account (`member:update_phone`, an AB's and an AAB's) — and nothing for one who may not.
 * **Never on the reader's own row, and never in the office's read-only view** (P19.3-T3 AC-3), whose rows carry no
 * number. Where a row has none, an equal blank keeps the column straight — none at all in the read-only view.
 */
function RowWhatsApp({ row, readOnly }: { row: UnitRow; readOnly: boolean }) {
  const canSavePhone = useCan('member:update_phone');
  const [saved, setSaved] = useState<string | null>(null);
  if (readOnly) return null;
  const phone = saved ?? row.phone;
  if (row.isReader || !(canSavePhone || phone)) return <span aria-hidden="true" className="w-9 shrink-0" />;
  return (
    // A 36px circle in a 36px column; its 44px target reaches 4px into the gap either side (as Home's).
    <span data-row-whatsapp="" className="-mx-1 flex lg:mx-0">
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
 * **A unit's amount** (P19.9-T4 AC-2; R7, ADR-0235): *Rp 262,4 jt / 320 jt* — the shared pair, beside its percentage —
 * or *Belum diunggah* while none of its production is uploaded; nothing without a target. Each figure kept whole, so a
 * narrow column wraps after the slash and never cuts a sum.
 */
function UnitAmount({ goal, className }: { goal: UnitTotal['goal']; className?: string }) {
  const t = useMessages(unitDashboardMessages);
  const figures = useFigureLanguage();
  if (!goal.targetMinor) return null;
  if (goal.actualMinor === null) return <span data-unit-amount="" className={className}>{t.own.notUploaded}</span>;
  const [first, second] = formatRupiahCompactPair(goal.actualMinor, goal.targetMinor, '/', figures).split(' / ');
  return (
    <span data-unit-amount="" className={className}>
      <span className="whitespace-nowrap">{first} /</span> <span className="whitespace-nowrap">{second}</span>
    </span>
  );
}

/**
 * **A phone row's right side** (P19.9-T4 AC-1): the status pill on *Bulan ini* and **WhatsApp under it**, the two right-
 * aligned in one column — side by side they left the name ~40px at 375px — and WhatsApp alone on the other periods. The
 * row's › stays beside them.
 */
function PhoneTrailing({ row, period, readOnly }: { row: UnitRow; period: UnitPeriod; readOnly: boolean }) {
  const pill = pillOf(row, period);
  // The office's read-only view: the row's right side as it was, the pill alone.
  if (readOnly) return pill;
  const whatsApp = <RowWhatsApp row={row} readOnly={readOnly} />;
  if (!pill) return whatsApp;
  return (
    <span className="flex flex-col items-end gap-1">
      {pill}
      <span className="-my-1 flex">{whatsApp}</span>
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
        <AccordionSection key={s.key} section={s} depth={0} open={open} onToggle={toggle} period={period} filter={filter} from={from} readOnly={view.readOnly} />
      ))}
    </div>
  );
}

function AccordionSection({
  section, depth, open, onToggle, period, filter, from, readOnly,
}: {
  section: Section; depth: number; open: ReadonlySet<string>; onToggle: (key: string) => void;
  period: UnitPeriod; filter: RosterFilter; from: string; readOnly: boolean;
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
            expanded && 'bg-primary/[0.06]',
          )}
        >
          <LineIcon name={expanded ? 'chevronDown' : 'chevronRight'} className="h-4 w-4 shrink-0 text-signal-grey" />
          <span className="min-w-0 flex-1 py-1">
            <span className="block truncate">{t.v1.unitCount({ label: section.label, n: section.count })}</span>
            {/* P19.9-T4 AC-2 (R7): the unit's amount under its label, the bar and the % kept. */}
            <UnitAmount goal={goal} className="block text-sm font-normal text-signal-grey" />
          </span>
          {bar !== null && (
            <span aria-hidden="true" className="h-1.5 w-[60px] shrink-0 overflow-hidden rounded-sm bg-base">
              <span className="block h-full bg-secondary" style={{ width: `${bar}%` }} />
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
                  // 13px / 700, on up to two lines and never cut (MOB UI-178; PersonRow wraps it below 768px).
                  nameClassName="text-base"
                  tag={<RungTag rung={row.rung} className="mr-1.5" />}
                  badge={phoneMarksOf(row)}
                  meta={<PhoneGoalLine goal={row.goal} />}
                  trailing={<PhoneTrailing row={row} period={period} readOnly={readOnly} />}
                  chevron
                  className="rounded-none"
                />
              </li>
            ))}
          </ul>
          {section.inner.filter((s) => holds(s, filter)).map((inner) => (
            <AccordionSection key={inner.key} section={inner} depth={depth + 1} open={open} onToggle={onToggle} period={period} filter={filter} from={from} readOnly={readOnly} />
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
/** The laptop's second header row (UI-114): stuck under the groups' 2rem row, its names right-aligned over the figures. */
const SUB_HEAD = 'text-right !top-[calc(env(safe-area-inset-top)+2rem)]';

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
      {/*
       * P19.9-T4 AC-1 (R6): the last column holds WhatsApp and the row's ›, ~64px. Its width comes from the count columns,
       * which gave one to three digits up to 70px, measured against their headings in Inter (2026-11-08): at 1024px beside
       * the rail every heading still fits whole, and *Status* holds its longest pill.
       */}
      {wide ? (
        <colgroup>
          <col className="w-[16%] xl:w-[16%]" />
          <col className="w-[11%] xl:w-[15%]" />
          <col className="w-[5.5%] xl:w-[6%]" />
          <col className="w-[6.5%] xl:w-[6%]" />
          <col className="w-[5.5%] xl:w-[6%]" />
          <col className="w-[8%] xl:w-[6.5%]" />
          {/* P19.7-T2 AC-13: *Proposal*, after *Potensi rekrut*. */}
          <col className="w-[7.5%] xl:w-[6.5%]" />
          <col className="w-[9%] xl:w-[7.5%]" />
          <col className="w-[8%] xl:w-[9%]" />
          <col className="w-[15.5%] xl:w-[14.5%]" />
          <col className="w-[7.5%] xl:w-[7%]" />
        </colgroup>
      ) : (
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[24%]" />
          {/* P19.7-T2 AC-13: *Proposal*, before *Aktivitas*. */}
          <col className="w-[10%]" />
          <col className="w-[14%]" />
          <col className="w-[15%]" />
          <col className="w-[9%]" />
        </colgroup>
      )}
      {/* The head sticks below the top inset, never under a Home Screen app's clock (staging review, 2026-10-31). */}
      <thead className="[&_th]:sticky [&_th]:top-[env(safe-area-inset-top)] [&_th]:z-[1]">
        <tr>
          <th scope="col" rowSpan={wide ? 2 : undefined} className={HEAD}>{t.columns.name}</th>
          <th scope="col" rowSpan={wide ? 2 : undefined} className={HEAD}>{t.columns.goal}</th>
          {/*
           * **Grouped headers on a laptop** (P19.1-T1 AC-3, UI-114: *Leads penjualan → Leads | Closing, Leads rekrut →
           * Leads | Potensi*): two groups over four short columns, so no header breaks inside a word at 1024; the one long
           * name left, *Potensi rekrut*, is the short column's ⓘ.
           */}
          {wide && (
            <>
              <th scope="colgroup" colSpan={2} className={cn(HEAD, 'h-8 whitespace-nowrap text-center')}>{t.v1.columns.salesLeads}</th>
              <th scope="colgroup" colSpan={2} className={cn(HEAD, 'h-8 whitespace-nowrap text-center')}>{t.v1.columns.recruitLeads}</th>
            </>
          )}
          <th scope="col" rowSpan={wide ? 2 : undefined} className={cn(HEAD, 'text-right')}>{t.v1.columns.proposal}</th>
          <th scope="col" rowSpan={wide ? 2 : undefined} className={cn(HEAD, 'text-right')}>
            <span className="inline-flex items-center gap-1">
              {t.columns.activity}
              {/* ADR-0165 §2: the figure is *goal activities*; the heading's ⓘ names the three types it counts. */}
              <TippedGlyph glyph="ⓘ" name={t.own.activityInfo} tip={t.own.activityRule} align="fit" className={STATUS_TIP} />
            </span>
          </th>
          {wide && <th scope="col" rowSpan={2} className={HEAD}>{t.columns.last}</th>}
          <th scope="col" rowSpan={wide ? 2 : undefined} className={HEAD}>
            <span className="inline-flex items-center gap-1">
              {t.columns.status}
              {statusInfo}
            </span>
          </th>
          <th scope="col" rowSpan={wide ? 2 : undefined} className={HEAD}><span className="sr-only">{t.own.details}</span></th>
        </tr>
        {wide && (
          // Under the groups, stuck below their row (2rem): the four short names.
          <tr>
            <th scope="col" className={cn(HEAD, SUB_HEAD)}>{t.v1.columns.leads}</th>
            <th scope="col" className={cn(HEAD, SUB_HEAD)}>{t.v1.columns.closing}</th>
            <th scope="col" className={cn(HEAD, SUB_HEAD)}>{t.v1.columns.leads}</th>
            <th scope="col" className={cn(HEAD, SUB_HEAD)}>
              <span className="inline-flex items-center gap-1">
                {t.v1.columns.potensi}
                <TippedGlyph glyph="ⓘ" name={t.v1.columns.potentialRecruits} tip={t.v1.columns.potentialRecruits} align="fit" className={STATUS_TIP} />
              </span>
            </th>
          </tr>
        )}
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
          readOnly={view.readOnly}
        />
      ))}
    </table>
  );
}

function UnitRows({
  section, depth, open, onToggle, period, filter, from, wide, readOnly,
}: {
  section: Section; depth: number; open: boolean; onToggle: () => void; period: UnitPeriod; filter: RosterFilter;
  from: string; wide: boolean; readOnly: boolean;
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
      <tr className="border-t border-divider bg-primary/[0.06] font-semibold text-ink">
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
        <td className={cn(CELL, wide ? 'xl:truncate' : 'truncate')}>
          {pct ?? '–'}
          {goal.actualMinor !== null && goal.targetMinor ? (
            /*
             * P19.9-T4 AC-2 (R7): the amount beside the % — on a laptop below 1280px on its own line under it, where it was
             * read only by a screen reader, each figure whole.
             */
            <span className={cn('font-normal text-signal-grey', wide && 'max-xl:block max-xl:text-sm max-xl:leading-tight')}>
              <span className={cn(wide && 'max-xl:hidden')}>{' · '}</span>
              <UnitAmount goal={goal} />
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
        <td className={cn(CELL, 'text-right')} data-proposals-made={total.proposalsMade}><Count n={total.proposalsMade} /></td>
        <td className={cn(CELL, 'text-right')}><Touches touches={total.touches} /></td>
        {wide && <td className={CELL} />}
        <td className={cn(CELL, 'whitespace-nowrap')}>{t.v1.active({ count: total.potentialActive.count, of: total.potentialActive.of })}</td>
        <td className={CELL} />
      </tr>
      {open && section.rows.filter((r) => matchesFilter(r, filter)).map((row) => (
        <PersonTableRow key={row.membershipId} row={row} period={period} from={from} wide={wide} depth={depth} readOnly={readOnly} />
      ))}
    </tbody>
  );
}

function PersonTableRow({
  row, period, from, wide, depth, readOnly,
}: { row: UnitRow; period: UnitPeriod; from: string; wide: boolean; depth: number; readOnly: boolean }) {
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
              className="min-w-0 truncate font-semibold uppercase text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-focus-ring"
            >
              {name}
            </Link>
          ) : (
            <span className="min-w-0 truncate font-semibold uppercase text-ink">{name}</span>
          )}
          {marks}
        </span>
        {/*
         * P19.9-T4 AC-1 (R6): the level on a line of its own under the name — the row keeps its height, and the name the
         * width it had, where nine columns share the laptop's line.
         */}
        <span className="mt-px flex" style={depth ? { paddingLeft: depth * 14 } : undefined}>
          <RungTag rung={row.rung} className="text-2xs leading-tight" />
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
      <td className={cn(CELL, 'text-right tabular-nums')} data-proposals-made={row.proposalsMade}><Count n={row.proposalsMade} /></td>
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
      <td className={CELL}>{pillOf(row, period)}</td>
      <td className="px-1 text-right">
        {/* P19.9-T4 AC-1 (R6): WhatsApp, then the row's ›. */}
        <span className="flex items-center justify-end gap-1">
          <RowWhatsApp row={row} readOnly={readOnly} />
          {href ? <LineIcon name="chevronRight" className="h-4 w-4 shrink-0 text-signal-grey" /> : <span aria-hidden="true" className="w-4 shrink-0" />}
        </span>
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
