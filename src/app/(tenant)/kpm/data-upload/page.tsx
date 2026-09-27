'use client';

import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { Button, buttonClass, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatRupiah } from '@/lib/goals';
import { useCan } from '@/lib/session';
import {
  METRIC_LABEL, MONEY_METRICS, PRODUCTION_METRICS, readMonth, readTemplate, templateHref,
  type MetricCell, type MonthView, type ProductionMetric, type TemplateFile,
} from '@/lib/production';

/**
 * The office's production, month by month (P9-T1, P9-T2).
 *
 * **The month table, before the file.** The prototype draws the toolbar, the preview and the table on
 * day one over an in-memory array (`KPM_Owner.html:1289-1324`). P9-T1 shipped the picker and the
 * table and P9-T2 the download; the upload arrives with the task that gives it a route to call,
 * because a button with nothing behind it is the defect `backend-then-frontend.md` exists to prevent.
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
/**
 * **⬇ Download template** — the prototype's own control (`KPM_Owner.html:1301`).
 *
 * A real `<a download>`, because saving a file is neither an action a `<button>` performs nor a
 * navigation `ButtonLink` should intercept; it wears the secondary button's classes so the toolbar
 * reads as one row of controls. The prototype builds the file in the browser from the array the table
 * reads; ours is the server's, so the header the file carries is the one the importer will know.
 *
 * **Three states, and each looks like itself.** Waiting renders nothing, because a button that would
 * download nothing is worse than no button. Arrived renders the link. **Failed says so, beside the
 * picker, with a way to try again** — not a banner, which would sit over a table that loaded fine,
 * and not silence, which is what this did first: the manual tells the reader to select a control
 * and nothing on the screen said it existed, had failed, or how to get it back.
 *
 * **Its own permission.** §3.9 grants `download_template` apart from `read`; somebody holding only
 * the second sees the table and is neither shown the control nor made to ask for it.
 */
function TemplateDownload({ month }: { month: string }) {
  const allowed = useCan('data_upload:download_template');
  const [template, setTemplate] = useState<TemplateFile | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!allowed) return undefined;
    let live = true;
    setTemplate(null);
    setError(null);
    readTemplate(month)
      .then((next) => { if (live) setTemplate(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [allowed, month, attempt]);

  if (!allowed) return null;

  if (error) {
    return (
      <p role="alert" className="flex min-h-10 flex-wrap items-center gap-x-2 text-sm text-alert">
        <span>The template could not be prepared. {error.message}</span>
        <Button variant="inline" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
        <span className="text-2xs text-muted">
          {error.code}
          {error.requestId && error.requestId !== 'unknown' ? ` · ${error.requestId}` : ''}
        </span>
      </p>
    );
  }

  if (!template) return null;

  return (
    <a href={templateHref(template)} download={template.filename} className={buttonClass('secondary')}>
      ⬇ Download template
    </a>
  );
}

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
        {/*
          * **After the month, not beside it.** Mounted once the table's own read has answered, and
          * for the month it answered for — so the link can never name a month the picker has left,
          * and the screen never sends two requests at once on a token that may have expired.
          */}
        {view && <TemplateDownload month={view.month} />}
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
