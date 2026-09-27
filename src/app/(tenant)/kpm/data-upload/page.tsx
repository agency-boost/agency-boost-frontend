'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { Button, buttonClass, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { SkeletonBar, SkeletonTable } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatRupiah } from '@/lib/goals';
import { useCan } from '@/lib/session';
import {
  commitUpload, METRIC_LABEL, MONEY_METRICS, PRODUCTION_METRICS, previewUpload, readMonth,
  readTemplate, templateHref, type ImportResult, type MetricCell, type MonthState, type MonthView,
  type PreviewCell, type ProductionMetric, type TemplateFile, type UploadPreview,
} from '@/lib/production';
import { ImportHistory } from './import-history';
import { monthLabel, plural } from './month-label';
import { MonthLock } from './month-lock';

/**
 * The office's production, month by month (P9-T1, P9-T2, P9-T3).
 *
 * **The month table, before the file.** The prototype draws the toolbar, the preview and the table on
 * day one over an in-memory array (`KPM_Owner.html:1289-1324`). P9-T1 shipped the picker and the
 * table, P9-T2 the download, P9-T3 the upload and its preview, P9-T4 Confirm import, the history
 * with its Revert, and the month's lock. Inline correction arrives with P9-T5, the task that gives it
 * a route to call, because a control with nothing behind it is the defect `backend-then-frontend.md`
 * exists to prevent.
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
  const [upload, setUpload] = useState<UploadState>({ kind: 'idle' });
  /** Which reading is current: a file read for a month the picker has left is thrown away. */
  const reading = useRef(0);
  /**
   * Advanced after every write — an import, a revert, a lock — so the table, the history and the
   * month's state are read again. The table stays on screen while they are; only a new month clears it.
   */
  const [generation, setGeneration] = useState(0);
  /** What the last write did, in a sentence. It takes focus, which is how a screen reader hears it. */
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setView(null);
    setNotice(null);
  }, [month]);

  useEffect(() => {
    let live = true;
    setError(null);
    // A preview is of one month's figures, at one revision. Another month, or a write to this one,
    // is another comparison.
    reading.current += 1;
    setUpload({ kind: 'idle' });
    readMonth(month)
      .then((next) => { if (live) setView(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [month, generation]);

  useEffect(() => { if (notice) noticeRef.current?.focus(); }, [notice]);

  const wrote = (sentence: string) => {
    setNotice(sentence);
    setGeneration((g) => g + 1);
  };
  const imported = (result: ImportResult) =>
    wrote(`Imported ${plural(result.batch.writtenRowCount, 'agent record')} for ${monthLabel(result.batch.month)}.`);
  const reverted = (result: ImportResult) => wrote(
    `Reverted “${result.batch.filename}”: ${plural(result.batch.restoredCellCount, 'figure')} put back`
    + `${result.batch.keptCellCount ? `, ${result.batch.keptCellCount} kept because something changed them since` : ''}.`,
  );
  const relocked = (next: MonthState) =>
    wrote(`${monthLabel(next.month)} is ${next.locked ? 'locked' : 'open again'}.`);

  const read = async (file: File) => {
    if (!view) return;
    const mine = ++reading.current;
    setUpload({ kind: 'reading', filename: file.name });
    try {
      const preview = await previewUpload(view.month, file);
      if (reading.current === mine) setUpload({ kind: 'preview', preview, file });
    } catch (err) {
      if (reading.current === mine) setUpload({ kind: 'failed', filename: file.name, error: toDisplayError(err) });
    }
  };
  const dismiss = () => {
    reading.current += 1;
    setUpload({ kind: 'idle' });
  };

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
        {view && <UploadButton busy={upload.kind === 'reading'} onFile={read} />}
      </div>

      {view && <MonthLock state={view.state} onChanged={relocked} />}

      {notice && (
        <p
          ref={noticeRef}
          tabIndex={-1}
          className="mb-4 rounded-md border-l-4 border-success bg-success/5 px-3 py-2 text-sm font-semibold text-navy"
        >
          {notice}
        </p>
      )}

      {view && (
        <UploadResult
          state={upload}
          month={view.month}
          monthState={view.state}
          columns={columns}
          onCancel={dismiss}
          onImported={imported}
        />
      )}

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

          <ImportHistory month={view.month} state={view.state} generation={generation} onReverted={reverted} />
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
  return <span className="text-navy">{formatFigure(metric, cell.value)}</span>;
}

/** Money in full rupiah, persistency with its sign, counts as they are — the table's own formats. */
function formatFigure(metric: ProductionMetric, value: number): string {
  if (MONEY_METRICS.includes(metric)) return formatRupiah(value);
  if (metric === 'persistency') return `${value}%`;
  return String(value);
}

type UploadState =
  | { kind: 'idle' }
  | { kind: 'reading'; filename: string }
  /** The file is kept: Confirm import sends it again, and the server reads it afresh. */
  | { kind: 'preview'; preview: UploadPreview; file: File }
  | { kind: 'failed'; filename: string; error: ApiError };

/**
 * **+ Upload filled template** — the prototype's own control (`KPM_Owner.html:1302`), a file input
 * dressed as the primary button.
 *
 * **The input is the button, transparent and on top of it**, as the switch primitive does it: a
 * click anywhere on the button is a click on the input, the keyboard reaches it, and the amber ring
 * is drawn on what the reader sees. The prototype hides the input with `display:none` inside a
 * `<label>`, which the mouse can use and the keyboard cannot reach.
 *
 * Gated on `data_upload:upload_and_preview`, apart from the table's `read` — §3.9 grants them
 * separately.
 */
function UploadButton({ busy, onFile }: { busy: boolean; onFile: (file: File) => void }) {
  const allowed = useCan('data_upload:upload_and_preview');
  if (!allowed) return null;
  return (
    <span className="relative inline-flex">
      <input
        type="file"
        accept=".csv,text/csv"
        aria-label="+ Upload filled template"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so choosing the same file again — after fixing it — is a change.
          e.target.value = '';
          if (file) onFile(file);
        }}
        className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
      />
      <span
        aria-hidden="true"
        className={cn(
          buttonClass('primary'),
          'peer-disabled:opacity-60',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-amber',
        )}
      >
        {busy ? 'Reading the file…' : '+ Upload filled template'}
      </span>
    </span>
  );
}

/**
 * Between the toolbar and the table, where the prototype puts its preview card (`:1305-1312`).
 *
 * **Nothing here is a live region.** The month table's line is the screen's one `role="status"`; a
 * preview takes focus when it arrives, which is how a screen reader learns of it, and a file that
 * cannot be read is an alert.
 */
function UploadResult({
  state, month, monthState, columns, onCancel, onImported,
}: {
  state: UploadState;
  month: string;
  monthState: MonthState;
  columns: readonly Column[];
  onCancel: () => void;
  onImported: (result: ImportResult) => void;
}) {
  if (state.kind === 'idle') return null;

  if (state.kind === 'reading') {
    return (
      <Card className="mb-5" aria-busy="true">
        <p className="mb-3 text-sm text-muted">Reading “{state.filename}”</p>
        <div aria-hidden="true" className="space-y-2">
          <SkeletonBar className="w-1/3" />
          <SkeletonBar className="w-2/3" />
          <SkeletonBar className="w-full" />
        </div>
      </Card>
    );
  }

  if (state.kind === 'failed') {
    return (
      <Card className="mb-5">
        <p className="mb-2 text-md font-semibold text-navy">“{state.filename}” was not read. Nothing has been saved.</p>
        <ErrorBanner {...state.error} />
        <div className="mt-3">
          <Button variant="secondary" onClick={onCancel}>Dismiss</Button>
        </div>
      </Card>
    );
  }

  return (
    <PreviewCard
      preview={state.preview}
      file={state.file}
      month={month}
      monthState={monthState}
      columns={columns}
      onCancel={onCancel}
      onImported={onImported}
    />
  );
}

/**
 * What the file would change — **a diff, not the file** (P9-T3 AC-8).
 *
 * The summary line is the prototype's own words (`KPM_Owner.html:4771`). Beneath it, what it never
 * said: how many figures are new, changed or already as stored, that a blank cell keeps what is
 * stored (ADR-0051), who the file does not list, and that nothing has been saved. Then every row or
 * figure that is not taken, with its reason, in the prototype's issue-row form (`:4773`); then the
 * rows that are, cell by cell against the month table's own columns.
 */
function PreviewCard({
  preview, file, month, monthState, columns, onCancel, onImported,
}: {
  preview: UploadPreview;
  file: File;
  month: string;
  monthState: MonthState;
  columns: readonly Column[];
  onCancel: () => void;
  onImported: (result: ImportResult) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  useEffect(() => { heading.current?.focus(); }, [preview]);
  const canConfirm = useCan('data_upload:commit_import');
  const [confirming, setConfirming] = useState(false);
  const [refused, setRefused] = useState<ApiError | null>(null);
  const nothing = preview.summary.newCells + preview.summary.changedCells === 0;

  /**
   * **Confirm import** (`KPM_Owner.html:1309`). The same file again with the revision the preview was
   * taken against: if the month has moved since — somebody else imported, reverted or locked it — the
   * server refuses rather than writing a diff nobody saw.
   */
  const confirm = async () => {
    setConfirming(true);
    setRefused(null);
    try {
      onImported(await commitUpload(month, preview.revision, file));
    } catch (err) {
      setRefused(toDisplayError(err));
      setConfirming(false);
    }
  };

  const { summary } = preview;
  const ready = preview.rows.filter((r) => r.status === 'ready');
  const issues = preview.rows.flatMap((r) => r.issues.map((issue, i) => ({ row: r, issue, key: `${r.line}-${i}` })));

  const figures = [
    `${summary.newCells} new`,
    `${summary.changedCells} changed`,
    `${summary.unchangedCells} already as stored`,
    `${summary.notProvidedCells} left blank, which keep what is stored`,
    ...(summary.refusedCells ? [`${summary.refusedCells} not taken`] : []),
  ].join(' · ');

  return (
    <Card className="mb-5" role="region" aria-labelledby={headingId}>
      <h2 ref={heading} id={headingId} tabIndex={-1} className="text-md font-semibold text-navy">
        {plural(summary.ready, 'agent')} ready to import
        {summary.refused ? `, ${plural(summary.refused, 'row')} skipped` : ''}.
      </h2>
      <p className="mt-1 text-sm text-muted">
        From “{preview.filename}”. Figures: {figures}.
        {summary.notInFile > 0 && ` ${plural(summary.notInFile, 'active member is', 'active members are')} not in the file and keep what they have.`}
      </p>
      <p className="mt-2 text-sm text-navy">
        <strong>Nothing has been saved yet.</strong> Confirm import writes the figures in bold into{' '}
        {monthLabel(month)}; a blank keeps what is stored, and what is not taken is left out.
      </p>

      {issues.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-semibold text-navy">Not taken ({issues.length})</h3>
          <ul>
            {issues.map(({ row, issue, key }) => (
              <li key={key} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 border-b border-hairline py-1.5 text-sm last:border-b-0">
                <span className="font-semibold text-navy">
                  Line {row.line} · {row.agentCode || 'no code'}{row.name ? ` · ${row.name}` : ''}
                </span>
                <span className="text-alert">{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ready.length > 0 && (
        <div className="mt-4">
          <DataTable
            caption={`What “${preview.filename}” would change`}
            columns={columns}
            density="compact"
            widths={['6rem', '11rem', ...PRODUCTION_METRICS.flatMap(() => ['7.5rem', '7.5rem'])]}
            tableClassName="min-w-[96rem]"
          >
            {ready.map((row) => (
              <Row key={row.line}>
                <Cell className="whitespace-nowrap font-semibold text-muted">
                  {row.resolvedAgentCode}
                  {row.codeRecovered && (
                    <span className="block text-2xs font-normal">read from “{row.agentCode}”</span>
                  )}
                </Cell>
                <Cell className="whitespace-nowrap">
                  {row.name}
                  {row.nameDiffers && (
                    <span className="block text-2xs text-muted">the file says “{row.fileName}”</span>
                  )}
                </Cell>
                {PRODUCTION_METRICS.flatMap((m) => (['monthly', 'ytd'] as const).map((cadence) => (
                  <Cell key={`${m}-${cadence}`} className="whitespace-nowrap text-right">
                    <Change cell={row.cells.find((c) => c.metric === m && c.cadence === cadence)!} />
                  </Cell>
                )))}
              </Row>
            ))}
          </DataTable>
        </div>
      )}

      {refused && <div className="mt-3"><ErrorBanner {...refused} /></div>}

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {canConfirm && (
          <Button onClick={confirm} disabled={confirming || nothing || monthState.locked}>
            {confirming ? 'Importing…' : 'Confirm import'}
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel} disabled={confirming}>Cancel</Button>
        {canConfirm && monthState.locked && (
          <span className="text-sm text-muted">{monthLabel(month)} is locked — reopen it to import.</span>
        )}
        {canConfirm && !monthState.locked && nothing && (
          <span className="text-sm text-muted">Nothing in this file would change a figure.</span>
        )}
      </div>
    </Card>
  );
}

/**
 * One cell of the diff. **Bold is what the file would write**; muted is what it would not touch —
 * a figure already as stored, or a blank, which keeps what is stored. A refusal shows what the file
 * had, in the alert colour, and its reason is in the list above.
 */
function Change({ cell }: { cell: PreviewCell }) {
  switch (cell.status) {
    case 'new':
      return <span className="font-semibold text-navy">{formatFigure(cell.metric, cell.after!)}</span>;
    case 'changed':
      return (
        <>
          <span className="font-semibold text-navy">{formatFigure(cell.metric, cell.after!)}</span>
          <span className="block text-2xs text-muted">was {formatFigure(cell.metric, cell.before!)}</span>
        </>
      );
    case 'unchanged':
      return <span className="text-muted">{formatFigure(cell.metric, cell.after!)}</span>;
    case 'not_provided':
      return <span className="text-muted" aria-label="left blank">—</span>;
    default:
      return (
        <span className="font-semibold text-alert">
          ✕ {cell.raw}<span className="sr-only"> — not taken</span>
        </span>
      );
  }
}
