'use client';

import { StatTile, type StatChip } from '@/components/ui/stat-tile';
import { LineIcon } from '@/components/ui/line-icon';
import { kept } from '@/i18n/kept';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { homeMessages } from '@/i18n/messages/home';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { cn } from '@/lib/cn';
import { formatMonthLong, formatMonthName, formatNumber, percentOf } from '@/lib/format';
import type { HomeSplit, HomeView } from '@/lib/home';
import { useSession } from '@/lib/session';

/** Where *Jadwal hari ini* and *Aksi hari ini*'s *Semua ›* go: Calendar, on today, in Agenda (UI-100, the owner). */
export const calendarToday = (today: string) => `/calendar?view=agenda&date=${today}`;

/**
 * **Home's tiles** (UI-100; P19.8-T2 AC-4 to AC-6; ADR-0228 §4; MOB UI-163, UI-166, UI-167, UI-170): the Unit Dashboard's
 * tile (`StatTile`, UI-003) — the label, the number with its unit small and grey, one row of grey chips, a small grey ›
 * top right, **the whole tile one target**. **Six by role, never by data**, two by two at every size:
 *
 * | Tile | Who | Number | Chip | Opens |
 * |---|---|---|---|---|
 * | *Aktivitas saya* | everybody | *2 hari ini*, or the orange *+ Log* across the tile when today is 0 | *Kemarin 5* | `/activity/log` |
 * | *Jadwal hari ini* | everybody | *2 meeting* | *Tugas 3* | `/calendar`, today in Agenda |
 * | *Active Agent* | a leader | *4 dari 12* and the ring; *0 dari –* with nobody | *Unit 1/4 · AAB 3/8* | `/unit/dashboard` |
 * | *Coaching 7 hari* | a leader | the same | the same | `/coaching` |
 * | ***Leads*** | everybody | `OWN_OPEN_LEADS` (OD-283) | — | `/leads` |
 * | ***New hires*** | a leader; an Agent whose menu has New Hires | the Group's before a first sale | — | `/new-hires` |
 *
 * - **A leader** is who the server sends the leader's block to: every leader by role, at zero with nobody (ADR-0189 §4).
 *   **With nobody to count** a leader tile reads ***0 dari –*** — no ring, no chips — and is never hidden (MOB UI-166).
 * - **An Agent** (OD-284's default): *Leads* beside *New hires* where their menu has New Hires (`me.newHires`, as
 *   `field-nav` decides it), otherwise across the row.
 * - **No tile says *Belum ada data* or carries a next step** (MOB UI-170): every figure at zero reads 0.
 * - ***Active Agent*, on a phone, is one line with a 12px grey chip of the month** — *Nov* (MOB UI-167) — so the two
 *   leader tiles are one height; from 768px it reads *Active Agent November*, as it did.
 * - **A chip whose count is 0 is hidden; the tile stays** (UI-100). A split chip is hidden only when its scope holds
 *   nobody: *Unit 0/4* is the Unit Dashboard's own chip.
 */
export function HomeTiles({ view, className }: { view: HomeView; className?: string }) {
  const t = useMessages(homeMessages).tiles;
  const unit = useMessages(unitDashboardMessages).v1;
  const figures = useFigureLanguage();
  const { me } = useSession();
  const number = (n: number) => formatNumber(n, {}, figures);
  const { activity, schedule, leader } = view;
  // The menu's own rule for an Agent (`field-nav`): New Hires where they coach a new hire of the last twelve months.
  const newHires = leader !== null || me?.newHires === true;
  const chip = (key: string, label: string, n: number): StatChip[] =>
    n > 0 ? [{ key, label: <>{label} <b>{number(n)}</b></> }] : [];
  const of = (split: HomeSplit) => unit.of({ of: split.of > 0 ? number(split.of) : '–' });
  const ring = (split: HomeSplit) => (split.of > 0 ? { percent: percentOf(split.count, split.of) } : undefined);

  return (
    <div data-home-tiles="" className={cn('grid grid-cols-2 gap-2 lg:gap-2.5', className)}>
      <StatTile
        href="/activity/log"
        label={t.myActivity}
        value={activity.today > 0 ? number(activity.today) : <LogPill label={t.log} />}
        fill={activity.today === 0}
        unit={activity.today > 0 ? t.today : undefined}
        // *+ Log* alone in the tile when today is 0 (MOB UI-164's *"+ Log" spans the tile*); *Kemarin n* beside a count.
        chips={activity.today > 0 ? chip('yesterday', t.yesterday, activity.yesterday) : []}
      />
      <StatTile
        href={calendarToday(view.today)}
        label={t.schedule}
        value={number(schedule.meetings)}
        unit={t.meetings({ n: schedule.meetings })}
        chips={chip('tasks', t.tasks, schedule.tasks)}
      />
      {leader !== null && (
        <>
          <StatTile
            href="/unit/dashboard"
            label={<ActiveAgentLabel short={t.activeAgent} month={formatMonthName(view.month, figures)} long={unit.activeAgent({ month: formatMonthLong(view.month, figures) })} />}
            value={number(leader.activeAgent.count)}
            unit={of(leader.activeAgent)}
            ring={ring(leader.activeAgent)}
            chips={splitChips(leader.activeAgent, unit.scope.unit, number)}
          />
          <StatTile
            href="/coaching"
            label={t.coached}
            value={number(leader.coached7d.count)}
            unit={of(leader.coached7d)}
            ring={ring(leader.coached7d)}
            chips={splitChips(leader.coached7d, unit.scope.unit, number)}
          />
        </>
      )}
      <StatTile
        href="/leads"
        label={t.leads}
        value={number(view.leads)}
        className={newHires ? undefined : 'col-span-2'}
      />
      {newHires && <StatTile href="/new-hires" label={t.newHires} value={number(view.newHires)} />}
    </div>
  );
}

/**
 * ***Active Agent* and its month** (MOB UI-167): on a phone one line, *Active Agent* and a 12px grey chip — *Nov* — where
 * *Active Agent November* wrapped to two and made the leader tiles uneven; from 768px the Unit Dashboard's own words,
 * *Active Agent November*, as before. A screen reader hears the month in full at every size.
 */
function ActiveAgentLabel({ short, month, long }: { short: string; month: string; long: string }) {
  return (
    <>
      <span data-active-agent-short="" aria-hidden="true" className="inline-flex items-center gap-1 whitespace-nowrap md:hidden">
        {short}
        <span data-month-chip="" className="rounded-pill bg-hover-row px-[7px] text-sm font-semibold text-muted">{month}</span>
      </span>
      <span data-active-agent-long="" className="max-md:sr-only">{long}</span>
    </>
  );
}

/** *Unit 1/4 · AAB 3/8*: each scope's figure bold, out of its people — a scope of nobody left out. */
function splitChips(split: HomeSplit, unitLabel: string, number: (n: number) => string): StatChip[] {
  return [
    { key: 'unit', label: unitLabel, part: split.unit },
    { key: 'aab', label: AAB, part: split.aab },
  ]
    .filter(({ part }) => part.of > 0)
    .map(({ key, label, part }) => ({ key, label: <>{label} <b>{number(part.count)}</b>/{number(part.of)}</> }));
}

/** *AAB*, a role, kept in both languages (§A.5). */
const AAB = kept('AAB');

/**
 * ***+ Log*** (UI-100; MOB UI-164): the orange pill in the number's place when nothing is logged today — **across the
 * tile on a phone, 44px**, as the approved mockup draws it; 38px and as wide as its words from 768px, as before. Not a
 * control of its own: the whole tile is the link to today's Log Activity, and this is what it says. Navy on the accent
 * (I-542).
 */
function LogPill({ label }: { label: string }) {
  return (
    <span
      data-log-pill=""
      className="inline-flex h-[2.375rem] items-center justify-center gap-1 rounded-pill bg-primary px-4 text-md font-bold leading-none text-primary-contrast max-md:my-0.5 max-md:flex max-md:h-11 max-md:w-full max-md:gap-1.5"
    >
      <LineIcon name="plus" className="h-4 w-4" />
      {label}
    </span>
  );
}
