'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { KpmActions } from '@/components/admin/kpm-actions';
import { NewKpmSheet } from '@/components/admin/new-kpm-sheet';
import { Page } from '@/components/page';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner } from '@/components/ui/field';
import { NavIcon } from '@/components/ui/nav-icon';
import { PickerMenu } from '@/components/ui/picker-menu';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminConsoleMessages, type AdminConsoleWords } from '@/i18n/messages/admin-console';
import {
  countsFor, kpmInitials, needsAction, readConsoleDashboard, toneOf, TONE_PILL, wholePct,
  type ConsoleDashboard, type ConsoleKpm, type KpmIssue,
} from '@/lib/admin-console';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonthName, formatNumber } from '@/lib/format';
import { enterKpm, leaveKpm } from '@/lib/super-admin-kpm';
import { useQuery } from '@/lib/use-query';

type Words = AdminConsoleWords['kpms'];
type Filter = 'all' | 'action' | string;

/**
 * **KPM** (`/admin/tenants`; P19.23-T2 AC-1 to AC-3; ADR-0277 §2; the Super Admin spec §5; `superadmin-tablet` f05–f10,
 * `superadmin-mobile` f05–f10): the navy tiles *KPM · Perusahaan · Anggota · Perlu tindakan*; the search (*nama KPM atau
 * owner*) and *Semua · Perlu tindakan · <perusahaan>* — chips from 768px, a dropdown on a phone; *+ KPM baru*; then one
 * card per KPM: its initials, name and company, ⋯, the Owner and its members, *Pakai 14 hari terakhir* on the scale, one
 * line saying what it needs (or *Tidak ada yang perlu*) and *Masuk ke KPM*. No *Aktif* pill.
 *
 * The figures are the Dashboard's (`GET /admin/dashboard`): one read, the same numbers on both pages. Arriving here
 * leaves the KPM a tab had entered; *Masuk ke KPM* enters one. `?baru=1` opens *KPM baru* (the old `/admin/tenants/new`
 * sends people here).
 */
export default function KpmListPage() {
  return (
    <Suspense fallback={null}>
      <KpmList />
    </Suspense>
  );
}

function KpmList() {
  const t = useMessages(adminConsoleMessages).kpms;
  const query = useQuery();
  const [data, setData] = useState<ConsoleDashboard | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [creating, setCreating] = useState(query.baru === '1');

  const load = useCallback(async () => {
    try {
      setData(await readConsoleDashboard());
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => {
    leaveKpm();
    void load();
  }, [load]);

  const add = (
    <Button onClick={() => setCreating(true)} disabled={!data} className="gap-1.5 max-md:w-full" data-new-kpm-button="">
      <NavIcon name="ti-plus" className="h-[18px] w-[18px]" />
      {t.newKpm}
    </Button>
  );

  return (
    <Page title={t.title}>
      {error && <ErrorBanner {...error} />}
      {!data && !error && <SkeletonCards count={4} label={t.loading} />}
      {data && <Kpms data={data} t={t} add={add} onChanged={load} />}
      {creating && data && (
        <NewKpmSheet companies={data.companies} onClose={() => setCreating(false)} onCreated={() => void load()} />
      )}
    </Page>
  );
}

function Kpms({ data, t, add, onChanged }: { data: ConsoleDashboard; t: Words; add: React.ReactNode; onChanged: () => void }) {
  const fig = useFigureLanguage();
  const n = (v: number) => formatNumber(v, {}, fig);
  const searchId = useId();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const live = data.kpms;
  const actionCount = live.filter(needsAction).length;
  // *Anggota* is the Dashboard's tile, read from the same answer (§B.45): the members of the **active** KPMs. Summing every
  // card here counted a suspended KPM's and an ended subscription's members too — 57 beside the Dashboard's 54 under one
  // label (found 2026-11-20).
  const members = data.overall.leaders + data.overall.agents;
  // The companies that hold a KPM, as the filter offers them.
  const withKpms = data.companies.filter((c) => live.some((k) => k.companyId === c.companyId));
  const options = [
    { value: 'all', label: t.all({ n: n(live.length) }) },
    { value: 'action', label: t.action({ n: n(actionCount) }) },
    ...withKpms.map((c) => ({ value: c.companyId, label: c.name })),
  ];

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return live.filter((k) => (filter === 'all' || (filter === 'action' ? needsAction(k) : k.companyId === filter))
      && (!needle || k.name.toLowerCase().includes(needle) || (k.ownerName ?? '').toLowerCase().includes(needle)));
  }, [live, q, filter]);

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 rounded-[20px] bg-secondary p-4 text-secondary-contrast md:grid-cols-4" data-kpm-tiles="">
        {([
          [t.tiles.kpm, n(data.overall.kpms), 'text-primary'],
          [t.tiles.companies, n(data.overall.companies), 'text-primary'],
          [t.tiles.members, n(members), 'text-primary'],
          [t.tiles.action, n(actionCount), 'text-on-navy-red'],
        ] as const).map(([label, value, tone]) => (
          <div key={label} className="min-w-0">
            <dt className="text-sm font-semibold">{label}</dt>
            <dd className={cn('text-[1.75rem] font-extrabold leading-tight', tone)}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <label htmlFor={searchId} className="sr-only">{t.search}</label>
        <span className="relative flex min-w-0 md:w-72">
          <NavIcon name="ti-search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id={searchId}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            className="h-11 w-full rounded-pill border border-hairline bg-card pl-9 pr-3 text-md text-navy placeholder:text-muted"
          />
        </span>
        {/* From 768px the chips; on a phone a dropdown beside the search (§12). */}
        <div role="group" aria-label={t.filter} className="flex flex-wrap gap-1 rounded-pill bg-card p-1 max-md:hidden">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={filter === o.value}
              onClick={() => setFilter(o.value)}
              className={cn(
                'h-10 rounded-pill px-3.5 text-sm font-semibold',
                filter === o.value ? 'bg-secondary text-secondary-contrast' : 'text-navy hover:bg-pill-grey',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="md:hidden">
          <PickerMenu label={t.filter} value={filter} options={options} onChange={setFilter} className="w-full" />
        </div>
        <div className="md:ml-auto">{add}</div>
      </div>

      {live.length === 0 ? (
        <EmptyState title={t.none} />
      ) : shown.length === 0 ? (
        <EmptyState title={t.noMatch} variant="filtered" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" data-kpm-cards="">
          {shown.map((kpm) => (
            <KpmCard key={kpm.kpmId} kpm={kpm} data={data} t={t} onChanged={onChanged} />
          ))}
        </ul>
      )}
      <ul className="flex flex-col gap-1 text-sm text-muted md:flex-row md:gap-x-5">
        <li>{t.notes.tap}</li>
        <li>{t.notes.menu}</li>
      </ul>
    </div>
  );
}

/** The line a KPM's first issue says, and its tone (`superadmin-tablet` f05). */
function issueLine(issue: KpmIssue | undefined, missingMonth: string | null, t: Words, language: 'id' | 'en') {
  switch (issue) {
    case undefined: return { text: t.issue.none, tone: 'bg-pill-green text-pill-green-ink', icon: 'ti-check' as const };
    case 'suspended': return { text: t.issue.suspended, tone: 'bg-pill-grey text-pill-grey-ink', icon: 'ti-alert-circle' as const };
    case 'archived': return { text: t.issue.archived, tone: 'bg-pill-grey text-pill-grey-ink', icon: 'ti-alert-circle' as const };
    case 'subscription_ended': return { text: t.issue.subscription_ended, tone: 'bg-pill-grey text-pill-grey-ink', icon: 'ti-alert-circle' as const };
    case 'owner_not_invited': return { text: t.issue.owner_not_invited, tone: 'bg-pill-red text-pill-red-ink', icon: 'ti-alert-circle' as const };
    case 'no_members': return { text: t.issue.no_members, tone: 'bg-pill-red text-pill-red-ink', icon: 'ti-alert-circle' as const };
    case 'data_missing': return {
      text: t.issue.data_missing({ month: missingMonth ? formatMonthName(missingMonth, language) : '' }),
      tone: 'bg-pill-amber text-pill-amber-ink',
      icon: 'ti-alert-circle' as const,
    };
  }
}

function KpmCard({ kpm, data, t, onChanged }: { kpm: ConsoleKpm; data: ConsoleDashboard; t: Words; onChanged: () => void }) {
  const fig = useFigureLanguage();
  const all = countsFor(kpm.usage, 'all');
  const pct = wholePct(all.used14, all.members);
  const line = issueLine(kpm.issues[0], kpm.missingMonth, t, fig);
  // A KPM nobody can use, or with nobody in it, has no share to give: *–*.
  const usable = kpm.status === 'active' && all.members > 0;
  return (
    <li className="flex flex-col gap-2.5 rounded-xl bg-card p-4" data-kpm-card={kpm.kpmId}>
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-extrabold text-secondary-contrast">
          {kpmInitials(kpm.name)}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-md text-navy">{kpm.name}</b>
          <span className="block truncate text-xs text-muted">{kpm.companyName}</span>
        </span>
        <KpmActions kpm={kpm} companies={data.companies} onChanged={onChanged} />
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy">
        <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold uppercase">
          <NavIcon name="ti-crown" className="h-4 w-4 shrink-0 text-muted" />
          <span className="truncate">{kpm.ownerName ?? '—'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <NavIcon name="ti-users" className="h-4 w-4 shrink-0 text-muted" />
          {t.membersN({ n: formatNumber(all.members, {}, fig) })}
        </span>
      </p>
      <p className="flex items-center justify-between gap-2 text-sm text-muted">
        <span>{t.used14}</span>
        {usable ? (
          <b className={cn('rounded-pill px-2 py-0.5 text-sm tabular-nums', TONE_PILL[toneOf(pct, data.scale)])}>{pct}%</b>
        ) : (
          <b className="text-muted">–</b>
        )}
      </p>
      <p className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold', line.tone)} data-kpm-issue={kpm.issues[0] ?? 'none'}>
        <NavIcon name={line.icon} className="h-4 w-4 shrink-0" />
        {line.text}
      </p>
      <Link
        href={`/admin/tenants/${kpm.kpmId}`}
        onClick={() => enterKpm(kpm.kpmId)}
        className="inline-flex min-h-10 items-center gap-1 self-start text-md font-bold text-primary-ink"
      >
        {t.enter}
        <NavIcon name="ti-arrow-right" className="h-4 w-4" />
        <span className="sr-only">{` · ${kpm.name}`}</span>
      </Link>
    </li>
  );
}
