'use client';

import { useEffect, useState } from 'react';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { ListCard, ListRow } from '@/components/ui/list-rows';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminPlatformReadsMessages } from '@/i18n/messages/admin-platform-reads';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonth, formatShortDay } from '@/lib/format';
import { readKpmData, type KpmDataMonth, type KpmDataView } from '@/lib/platform-reads';
import { useMediaQuery } from '@/lib/use-media-query';

/** *Lengkap · Belum · —*: the word carries the meaning, the tint only repeats it. */
const MONTH_TONE: Record<KpmDataMonth['status'], string> = {
  complete: 'border-success/40 bg-success/10 text-navy',
  missing: 'border-alert/40 bg-alert/10 text-navy',
  none: 'border-hairline bg-base text-muted',
};

/** The KPM's months and uploads, read once for a tab: `GET /admin/tenants/:id/data`, audited by the server per read. */
export function useKpmData(kpmId: string) {
  const [view, setView] = useState<KpmDataView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    readKpmData(kpmId)
      .then((next) => { if (live) setView(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [kpmId, attempt]);
  return { view, error, retry: () => setAttempt((n) => n + 1) };
}

/**
 * ***Data bulanan · 12 bulan terakhir*** (P19.4-T3 AC-9; the setup spec's A2): twelve months ending with the KPM's own,
 * each *Lengkap*, *Belum* or *—* (before the KPM). *"Oleh HQ"* never appears: no company-wide upload exists (A-R7 not
 * built). Read-only: the KPM's Owner and Admins upload.
 */
export function KpmMonthGrid({ months }: { months: readonly KpmDataMonth[] }) {
  const t = useMessages(adminPlatformReadsMessages).kpm;
  const figures = useFigureLanguage();
  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-navy">{t.grid}</h2>
      <ol className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {months.map((m) => (
          <li key={m.month} className={cn('rounded-md border px-2 py-1.5 text-center text-sm', MONTH_TONE[m.status])}>
            <span className="block font-semibold">{formatMonth(m.month, figures)}</span>
            {m.status === 'none' ? (
              // *—* as A2 draws it, and what it means said to a screen reader.
              <small className="block text-xs"><span aria-hidden="true">—</span><span className="sr-only">{t.month.none}</span></small>
            ) : <small className="block text-xs">{t.month[m.status]}</small>}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-muted">{t.gridHint}</p>
    </Card>
  );
}

/** The grid's place while it is read: twelve cells' worth. */
export function KpmMonthGridSkeleton() {
  const t = useMessages(adminPlatformReadsMessages).kpm;
  return (
    <Skeleton label={t.loading}>
      <div className="rounded-lg border border-card-edge bg-card p-5">
        <SkeletonBar className="h-5 w-56" />
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => <SkeletonBar key={i} className="h-11" />)}
        </div>
      </div>
    </Skeleton>
  );
}

/**
 * ***Data bulanan*** (`/admin/tenants/[kpmId]?tab=data`; P19.4-T3 AC-9; A2): the month grid and ***Riwayat unggahan*** —
 * the month, who uploaded it, when, the agents' rows written and the note — read-only, with no upload. **Below 1024px
 * a row per upload** (P19.2-T2 AC-1; UI-126): the month, *by · when* under it, the rows and the note after their words.
 */
export function KpmDataTab({ kpmId }: { kpmId: string }) {
  const all = useMessages(adminPlatformReadsMessages);
  const t = all.kpm;
  const figures = useFigureLanguage();
  const { view, error, retry } = useKpmData(kpmId);
  const rows = useMediaQuery(['phone', 'tablet']);

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        <ErrorBanner {...error} />
        <Button variant="secondary" className="self-start" onClick={retry}>{all.members.retry}</Button>
      </div>
    );
  }
  if (!view) return <KpmMonthGridSkeleton />;

  const when = (iso: string | null) => (iso ? formatShortDay(iso.slice(0, 10), { year: true }, figures) : '—');
  return (
    <div className="flex flex-col gap-4">
      <KpmMonthGrid months={view.months} />
      <h2 className="font-display text-lg font-bold text-navy">{t.uploads}</h2>
      {view.uploads.length === 0 ? (
        <Card><p className="text-md text-muted">{t.noUploads}</p></Card>
      ) : rows ? (
        <ListCard label={t.uploads}>
          {view.uploads.map((u, i) => (
            <ListRow
              key={`${u.month}-${u.at ?? i}`}
              title={formatMonth(u.month, figures)}
              meta={`${u.by ?? '—'} · ${when(u.at)}`}
              note={(
                <span className="text-muted">
                  {`${t.uploadColumns.agents} ${u.agents} · ${t.note[u.note.status]}`}
                  {u.note.asOf && ` · ${t.note.asOf({ date: formatShortDay(u.note.asOf, {}, figures) })}`}
                </span>
              )}
            />
          ))}
        </ListCard>
      ) : (
        <DataTable
          caption={t.uploads}
          columns={[t.uploadColumns.month, t.uploadColumns.by, t.uploadColumns.at, t.uploadColumns.agents, t.uploadColumns.note]}
        >
          {view.uploads.map((u, i) => (
            <Row key={`${u.month}-${u.at ?? i}`}>
              <Cell className="whitespace-nowrap">{formatMonth(u.month, figures)}</Cell>
              <Cell>{u.by ?? '—'}</Cell>
              <Cell className="whitespace-nowrap">{when(u.at)}</Cell>
              <Cell className="tabular-nums">{u.agents}</Cell>
              <Cell className="text-sm text-muted">
                {t.note[u.note.status]}
                {u.note.asOf && ` · ${t.note.asOf({ date: formatShortDay(u.note.asOf, {}, figures) })}`}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}
