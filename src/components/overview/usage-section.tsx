'use client';

import { useState } from 'react';
import { CoachingStatusTile } from '@/components/unit/coaching-status-tile';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { DEFAULT_SYSTEM_NAME, useSystemName } from '@/i18n/system-name';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { cn } from '@/lib/cn';
import { formatNumber, formatPercent } from '@/lib/format';
import {
  barWidth, visibleRows, BUCKET_TONE, STATUS_BUCKETS, type KpmOverviewView, type OverviewGroupRef, type StatusBucket,
  type UsageCount,
} from '@/lib/kpm-overview';
import { FilterTiles, PeopleTree, UsageTile } from './people-tree';

/** A section's heading: *"1 · Pemakaian AgencyBoost"*, small and bold, as the mockup draws it. */
export function SectionHeading({ id, children, aside }: { id: string; children: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex min-h-9 items-center justify-between gap-2">
      <h2 id={id} className="text-md font-bold text-navy">{children}</h2>
      {aside}
    </div>
  );
}

/**
 * **1 · Pemakaian AgencyBoost** (P19.19-T1 AC-2; the brief's §1; `APP_USE_IN_PERIOD` over the last 30 days): the orange
 * panel — *"Sudah pakai AgencyBoost"*, *"26 dari 30 anggota"* with its % and bar, and two navy tiles *Leader 8/9* and
 * *Agent 18/21* — then **one row per informal group** (*Leader x/y · Agent x/y* and its %), each of which **filters the
 * whole page to it**. A KPM's own system name stands for *AgencyBoost*.
 */
export function UsageSection({
  view, onGroup,
}: { view: KpmOverviewView; onGroup: (group: OverviewGroupRef) => void }) {
  const t = useMessages(kpmOverviewMessages);
  const figures = useFigureLanguage();
  const system = useSystemName() ?? DEFAULT_SYSTEM_NAME;
  const number = (n: number) => formatNumber(n, {}, figures);
  const pct = (count: UsageCount) => (count.pct === null ? '–' : formatPercent(count.pct, {}, figures));
  const { total, leaders, agents } = view.usage;
  return (
    <section aria-labelledby="overview-usage" data-section="usage">
      <SectionHeading id="overview-usage">{t.usageTitle({ system })}</SectionHeading>
      <div
        data-usage-panel=""
        aria-label={t.usedName({ used: number(total.used), of: number(total.of), pct: pct(total), system })}
        role="group"
        className="rounded-[20px] bg-primary p-3.5 text-primary-contrast"
      >
        <div className="flex items-center gap-2">
          <p className="text-[0.9375rem] font-bold">{t.usedHeadline({ system })}</p>
          <span className="ml-auto rounded-pill bg-secondary px-2.5 py-1 text-base font-bold leading-none text-secondary-contrast">{pct(total)}</span>
        </div>
        <p className="mt-1 flex items-baseline gap-1.5">
          <b className="text-[1.625rem] font-extrabold leading-tight">{number(total.used)}</b>
          <span className="text-base font-semibold">{t.usedOf({ of: number(total.of) })}</span>
        </p>
        <span aria-hidden="true" className="mt-2 block h-2 overflow-hidden rounded bg-card/55">
          <span className="block h-full rounded bg-secondary" style={{ width: `${barWidth(total.used, total.of)}%` }} />
        </span>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {([[t.leader, leaders], [t.agent, agents]] as const).map(([label, count]) => (
            <div key={label} className="rounded-xl bg-secondary px-3 py-2 text-secondary-contrast">
              <div className="flex items-baseline gap-1">
                <b className="text-2xl font-extrabold text-primary">{number(count.used)}</b>
                <span className="text-sm">/{number(count.of)}</span>
                <span className="ml-auto text-xs font-bold text-secondary-muted">{pct(count)}</span>
              </div>
              <p className="text-sm font-bold">{label}</p>
            </div>
          ))}
        </div>
      </div>
      {view.usage.byGroup.length > 0 && (
        <ul className="mt-3 overflow-hidden rounded-lg bg-card">
          {view.usage.byGroup.map((group) => {
            const name = group.name ?? t.noGroup;
            return (
              <li key={group.groupId ?? 'none'} className="border-t border-divider first:border-t-0">
                <button
                  type="button"
                  data-group-row={group.groupId ?? 'none'}
                  aria-label={t.filterTo({ name })}
                  aria-pressed={view.group !== null && view.group.groupId === group.groupId}
                  onClick={() => onGroup({ groupId: group.groupId, name: group.name })}
                  className="block w-full px-3.5 py-2.5 text-left lg:hover:bg-hover-row"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-md font-bold text-ink">{name}</span>
                    <span className="text-sm font-bold text-navy">{pct(group.total)}</span>
                  </span>
                  <span className="block text-sm text-muted">
                    {t.groupRow({
                      leaders: `${number(group.leaders.used)}/${number(group.leaders.of)}`,
                      agents: `${number(group.agents.used)}/${number(group.agents.of)}`,
                    })}
                  </span>
                  <span aria-hidden="true" className="mt-1.5 block h-1.5 overflow-hidden rounded bg-divider">
                    <span className="block h-full rounded bg-secondary" style={{ width: `${barWidth(group.total.used, group.total.of)}%` }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * **2 · Pemakaian per orang** and **3 · Coaching** (P19.19-T1 AC-3, AC-4): three tiles with their counts — *Belum
 * pernah …* (red, chosen first), *… > 14 hari lalu* (yellow), *… ≤ 14 hari* (green) — and the tree of whoever matches,
 * a leader whose team matches always shown with *"n orang di timnya"*.
 */
export function PeopleSection({ view, kind }: { view: KpmOverviewView; kind: 'usage' | 'coaching' }) {
  const t = useMessages(kpmOverviewMessages);
  const [bucket, setBucket] = useState<StatusBucket>('never');
  const statusOf = (p: KpmOverviewView['people'][number]) => (kind === 'usage' ? p.usage.status : p.coaching.status);
  const labels: Record<StatusBucket, string> = kind === 'usage'
    ? { never: t.usageNever, lapsed: t.usageLapsed, recent: t.usageRecent }
    : { never: t.coachingNever, lapsed: t.coachingLapsed, recent: t.coachingRecent };
  const groups = view.groups.filter((g) => view.group === null || g.groupId === view.group.groupId);
  const tree = visibleRows(view.people, groups, (p) => statusOf(p) === bucket);
  const id = kind === 'usage' ? 'overview-people' : 'overview-coaching';
  const title = kind === 'usage' ? t.peopleTitle : t.coachingTitle;
  return (
    <section aria-labelledby={id} data-section={kind === 'usage' ? 'people' : 'coaching'}>
      <SectionHeading id={id}>{title}</SectionHeading>
      <div className={cn('overflow-hidden rounded-lg bg-card')}>
        <FilterTiles
          label={title}
          value={bucket}
          onChange={setBucket}
          tiles={STATUS_BUCKETS.map((key) => ({
            key, label: labels[key], tone: BUCKET_TONE[key], count: view.people.filter((p) => statusOf(p) === key).length,
          }))}
        />
        <PeopleTree
          label={labels[bucket]}
          tree={tree}
          tile={(p) => (kind === 'usage'
            ? <UsageTile person={p} />
            : <CoachingStatusTile status={p.coaching.status} days={p.coaching.days} />)}
        />
      </div>
    </section>
  );
}
