'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button, ErrorBanner } from '@/components/ui/field';
import { PickerMenu } from '@/components/ui/picker-menu';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  groupParam, NO_GROUP, officeLine, readKpmOverview, type KpmOverviewView, type OverviewGroupRef,
} from '@/lib/kpm-overview';
import { ComplianceSection } from './compliance-section';
import { PerformanceSection } from './performance-section';
import { ProductionChart } from './production-chart';
import { SettingsCard, settingsWait } from './settings-list';
import { SetupCard } from './setup-card';
import { PeopleSection, UsageSection } from './usage-section';

/** *Semua group*: the whole KPM, as the picker's value. */
const EVERY_GROUP = '';

/**
 * **The KPM Overview, second version** (P19.19; ADR-0272; the approved `kpm-overview-v2-tablet` mockup, the phone and the
 * laptop following its blocks): the page the Owner, the Admins and core leaders land on — **usage first, then compliance,
 * then results**.
 *
 * - **One control**, *Semua group ⌄* — the informal groups, *Tanpa group* — and no page-wide period: sections 1 to 3 read
 *   the last 30 days and today, section 5 has its own month, section 6 its six months. **A group filters the whole page**,
 *   chosen here or by tapping its row in section 1.
 * - **Two free columns that end level** on a tablet held sideways and on a laptop — left *1 Pemakaian AgencyBoost · 2
 *   Pemakaian per orang · 3 Coaching*, right *4 Compliance · 5 Performa vs target · 6 Produksi 6 bulan* — the long lists
 *   showing their first rows and *Lihat semua (n) ›* so neither runs on. **One column on a phone**, in the same order.
 * - A new KPM's ***Siapkan KPM*** card stands above the columns while any step is open; ***Pengaturan KPM ›*** below them
 *   while something on the settings pages waits for the Owner.
 * - **Its states** (L-01): the sections in outline while the read is on its way; an error with *Coba lagi*; a KPM with
 *   nobody yet reads *Belum ada data* in each section's place. Each of sections 4 and 5 reads on its own, with its own
 *   wait and error, so one slow read never blanks the page.
 *
 * Inside the page's gate (`kpm_overview:read`): the request is never sent for somebody the screen is not drawn for; the
 * server refuses anybody who is not a steward of the KPM all the same.
 */
export function KpmOverview() {
  const t = useMessages(kpmOverviewMessages);
  const [group, setGroup] = useState<OverviewGroupRef | null>(null);
  const [view, setView] = useState<KpmOverviewView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** Bumped when an AB's group moves: every section reads again (P19.19-T2 AC-4). */
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    readKpmOverview(groupParam(group))
      .then((next) => { if (live) setView(next); })
      .catch((err: unknown) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [group, attempt, version]);

  const regroup = useCallback(() => setVersion((n) => n + 1), []);
  const toTargets = useCallback(() => {
    document.getElementById('overview-performance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const valueOf = (g: OverviewGroupRef | null) => (g === null ? EVERY_GROUP : g.groupId ?? NO_GROUP);
  const filter = view && (
    <PickerMenu
      label={t.groupFilter}
      value={valueOf(group)}
      options={[
        { value: EVERY_GROUP, label: t.allGroups },
        ...view.groups.map((g) => ({ value: g.groupId ?? NO_GROUP, label: g.name ?? t.noGroup })),
      ]}
      onChange={(value) => {
        if (value === EVERY_GROUP) setGroup(null);
        else {
          const chosen = view.groups.find((g) => (g.groupId ?? NO_GROUP) === value);
          setGroup(chosen ? { groupId: chosen.groupId, name: chosen.name } : null);
        }
      }}
    />
  );

  return (
    <>
      <PageHeader title={t.title} subtitle={view ? officeLine(view.office) : undefined} />
      <div data-overview="" className="pb-6">
        <div className="mb-3 flex min-h-11 items-center">{filter}</div>
        {error ? (
          <div className="rounded-lg bg-card p-4">
            <ErrorBanner {...error} />
            <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
          </div>
        ) : !view ? (
          <Skeleton label={t.loading}>
            <div className="grid gap-4 lg:grid-cols-2">
              {[0, 1].map((col) => (
                <div key={col} className="space-y-4">
                  <SkeletonBar className="h-48 w-full" />
                  <SkeletonBar className="h-64 w-full" />
                </div>
              ))}
            </div>
          </Skeleton>
        ) : (
          <>
            {view.setup && <SetupCard setup={view.setup} onTarget={toTargets} />}
            {view.usage.total.of === 0 && view.group === null ? (
              <p data-empty="" className="rounded-lg bg-card p-4 text-md text-muted">{t.noData}</p>
            ) : (
              <div className="grid items-start gap-4 lg:grid-cols-2" data-columns="">
                <div className="min-w-0 space-y-5" data-column="left">
                  <UsageSection view={view} onGroup={setGroup} />
                  <PeopleSection key={`usage-${valueOf(view.group)}`} view={view} kind="usage" />
                  <PeopleSection key={`coaching-${valueOf(view.group)}`} view={view} kind="coaching" />
                </div>
                <div className="min-w-0 space-y-5" data-column="right">
                  <ComplianceSection view={view} group={group} version={version} />
                  <PerformanceSection group={group} version={version} onRegroup={regroup} />
                  <ProductionChart production={view.production} />
                </div>
              </div>
            )}
            {settingsWait(view.settings) && <div className="mt-5"><SettingsCard settings={view.settings} /></div>}
          </>
        )}
      </div>
    </>
  );
}
