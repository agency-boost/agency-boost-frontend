'use client';

import { StatTile, type StatChip } from '@/components/ui/stat-tile';
import { LineIcon } from '@/components/ui/line-icon';
import { kept } from '@/i18n/kept';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { homeMessages } from '@/i18n/messages/home';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { cn } from '@/lib/cn';
import { formatMonthLong, formatNumber, percentOf } from '@/lib/format';
import type { HomeSplit, HomeView } from '@/lib/home';

/** Where *Jadwal hari ini* and *Aksi hari ini* go: Calendar, on today, in Agenda (UI-100, the owner). */
export const calendarToday = (today: string) => `/calendar?view=agenda&date=${today}`;

/**
 * **Home's tiles** (UI-100): the Unit Dashboard's tile (`StatTile`, UI-003) — a 12px label, the number with its unit
 * small and grey, one row of grey chips, a small grey › top right, **the whole tile one target**.
 *
 * | Tile | Number | Chip | Opens |
 * |---|---|---|---|
 * | *Aktivitas saya* | *2 hari ini*, or the orange *+ Log* when today is 0 | *Kemarin 5* | `/activity/log` |
 * | *Jadwal hari ini* | *2 meeting* | *Tugas 3* | `/calendar`, today in Agenda |
 * | *Active Agent {Bulan}* (leaders) | *4 dari 12* and the ring | *Unit 1/4 · AAB 3/8* | `/unit/dashboard` |
 * | *Coaching 7 hari* (leaders) | *2 dari 12* and the ring | *Unit 1/4 · AAB 1/8* | `/coaching` |
 *
 * **A chip whose count is 0 is hidden; the tile stays** (UI-100). A split chip is hidden only when its scope holds
 * nobody: *Unit 0/4* is the Unit Dashboard's own chip, and Home shows that tile exactly (parity row). Two by two on a
 * phone and from 1024px, four in a row on a tablet. *Active Agent {Bulan}* and *dari 12* are the dashboard's words.
 */
export function HomeTiles({ view, className }: { view: HomeView; className?: string }) {
  const t = useMessages(homeMessages).tiles;
  const unit = useMessages(unitDashboardMessages).v1;
  const figures = useFigureLanguage();
  const number = (n: number) => formatNumber(n, {}, figures);
  const { activity, schedule, leader } = view;
  const chip = (key: string, label: string, n: number): StatChip[] =>
    n > 0 ? [{ key, label: <>{label} <b>{number(n)}</b></> }] : [];

  return (
    <div
      data-home-tiles=""
      className={cn('grid grid-cols-2 gap-2 lg:gap-2.5', leader && 'md:max-lg:grid-cols-4', className)}
    >
      <StatTile
        href="/activity/log"
        label={t.myActivity}
        value={activity.today > 0 ? number(activity.today) : <LogPill label={t.log} />}
        unit={activity.today > 0 ? t.today : undefined}
        chips={chip('yesterday', t.yesterday, activity.yesterday)}
      />
      <StatTile
        href={calendarToday(view.today)}
        label={t.schedule}
        value={number(schedule.meetings)}
        unit={t.meetings({ n: schedule.meetings })}
        chips={chip('tasks', t.tasks, schedule.tasks)}
      />
      {leader && (
        <>
          <StatTile
            href="/unit/dashboard"
            label={unit.activeAgent({ month: formatMonthLong(view.month, figures) })}
            value={number(leader.activeAgent.count)}
            unit={unit.of({ of: number(leader.activeAgent.of) })}
            ring={{ percent: percentOf(leader.activeAgent.count, leader.activeAgent.of) }}
            chips={splitChips(leader.activeAgent, unit.scope.unit, number)}
          />
          <StatTile
            href="/coaching"
            label={t.coached}
            value={number(leader.coached7d.count)}
            unit={unit.of({ of: number(leader.coached7d.of) })}
            ring={{ percent: percentOf(leader.coached7d.count, leader.coached7d.of) }}
            chips={splitChips(leader.coached7d, unit.scope.unit, number)}
          />
        </>
      )}
    </div>
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
 * ***+ Log*** (UI-100): the orange pill, 38px, in the number's place when nothing is logged today. Not a control of its
 * own — the whole tile is the link to today's Log Activity, and this is what it says. Navy on the accent (I-542).
 */
function LogPill({ label }: { label: string }) {
  return (
    <span
      data-log-pill=""
      className="inline-flex h-[2.375rem] items-center gap-1 rounded-pill bg-amber px-4 text-md font-bold leading-none text-navy"
    >
      <LineIcon name="plus" className="h-4 w-4" />
      {label}
    </span>
  );
}
