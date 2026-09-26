'use client';

import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatRupiah } from '@/lib/goals';
import {
  METRIC_LABEL, MONEY_METRICS, PRODUCTION_METRICS, readMonth, type MetricCell, type MonthView,
  type ProductionMetric,
} from '@/lib/production';

/**
 * The office's production, month by month (P9-T1).
 *
 * **The month table, before the file.** The prototype draws the toolbar, the preview and the table on
 * day one over an in-memory array (`KPM_Owner.html:1289-1324`). This task ships the picker and the
 * table; the download and the upload arrive with the tasks that give each a route to call, because a
 * button with nothing behind it is the defect `backend-then-frontend.md` exists to prevent.
 *
 * **Every active member is a row, and a dash is not a zero.** A row of dashes says the carrier has not
 * reported this person; a `0` says it reported nothing produced. An empty table would say the office
 * has nobody, and a table of zeroes that nobody produced — neither is true.
 */
export default function DataUploadPage() {
  return (
    <Page
      title="Data upload"
      subtitle="APE, rolling persistency, recruitment, new active agents, FYP and # of policy — one file per month, matched by agent code."
      permission="data_upload:read"
    >
      <MonthTable />
    </Page>
  );
}

/**
 * **Inside the gate, not around it.** `Page` checks `data_upload:read` and renders its children only
 * once that holds — so the request has to live in a child. With the effect in the page component
 * itself, the table was correctly withheld from an agent and the request for it was sent anyway,
 * which is a permission enforced on the pixels and not on the wire. `KpmOverviewPage` is shaped the
 * same way for the same reason.
 */
function MonthTable() {
  // A convenience for choosing, not a computation over data: the rows for a month are the
  // server's, resolved in the office's zone, and the month is explicit in what the screen asks for.
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [view, setView] = useState<MonthView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    setView(null);
    setError(null);
    readMonth(month)
      .then((next) => { if (live) setView(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [month]);

  const columns: readonly Column[] = [
    'Agent code',
    'Name',
    ...PRODUCTION_METRICS.flatMap((m) => [`${METRIC_LABEL[m]} — month`, `${METRIC_LABEL[m]} — YTD`]),
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Month" htmlFor="upload-month" className="w-44">
          <TextInput
            id="upload-month"
            type="month"
            value={month}
            onChange={(e) => { if (e.target.value) setMonth(e.target.value); }}
          />
        </Field>
      </div>

      {error && <ErrorBanner {...error} />}

      {!error && view === null && (
        <SkeletonTable caption={`Data for ${monthLabel(month)}`} columns={columns} rows={5} />
      )}

      {view && (
        <>
          <h2 className="mb-1 font-display text-md font-bold text-navy">
            Data for {monthLabel(view.month)}
          </h2>
          <p className="mb-3 text-sm text-muted" role="status">
            {view.withData === 0
              ? `Nothing has been uploaded for ${monthLabel(view.month)} yet. Every member is listed so you can see who the file will need to cover.`
              : `${view.withData} of ${view.rows.length} members have figures for this month.`}
          </p>

          <DataTable
            caption={`Data for ${monthLabel(view.month)}`}
            columns={columns}
            density="compact"
            widths={['6rem', '11rem', ...PRODUCTION_METRICS.flatMap(() => ['7.5rem', '7.5rem'])]}
            tableClassName="min-w-[96rem]"
          >
            {view.rows.map((row) => (
              <Row key={row.membershipId}>
                <Cell className="whitespace-nowrap font-semibold text-muted">{row.agentCode}</Cell>
                <Cell className="whitespace-nowrap">{row.name}</Cell>
                {PRODUCTION_METRICS.flatMap((m) => [
                  <Cell key={`${m}-m`} className="whitespace-nowrap text-right">
                    <Figure metric={m} cell={row.metrics[m].monthly} />
                  </Cell>,
                  <Cell key={`${m}-y`} className="whitespace-nowrap text-right">
                    <Figure metric={m} cell={row.metrics[m].ytd} />
                  </Cell>,
                ])}
              </Row>
            ))}
          </DataTable>
        </>
      )}
    </>
  );
}

/**
 * One cell. **A dash for nothing, a number for something — including zero.** The dash is muted so a
 * month nobody has uploaded reads as quiet rather than as a wall of failures.
 */
function Figure({ metric, cell }: { metric: ProductionMetric; cell: MetricCell }) {
  if (cell.value === null) {
    return <span className="text-muted" aria-label="nothing reported">—</span>;
  }
  if (MONEY_METRICS.includes(metric)) return <span className="text-navy">{formatRupiah(cell.value)}</span>;
  if (metric === 'persistency') return <span className="text-navy">{cell.value}%</span>;
  return <span className="text-navy">{cell.value}</span>;
}

/** `2026-09` → `September 2026`. `en-US`, for the reason `lib/format.ts` gives. */
function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}
