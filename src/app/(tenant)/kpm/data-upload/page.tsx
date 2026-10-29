'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Page } from '@/components/page';
import { TermTip } from '@/components/ui/term-tip';
import { Cell, Row, type Column } from '@/components/ui/data-table';
import { ConsoleCode } from '@/components/ui/console-code';
import { Button, buttonClass, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { CHECK_LINE_PHONE, CONTROL_PHONE } from '@/components/ui/phone';
import { CardField, RowCard, RowCards } from '@/components/ui/row-cards';
import { SkeletonBar, SkeletonCards, SkeletonTable } from '@/components/ui/skeleton';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { errorReference } from '@/lib/browser-errors';
import { cn } from '@/lib/cn';
import type { Language } from '@/i18n/language';
import { formatDayLong, formatNumber, formatPercent, formatRupiah, monthInZone } from '@/lib/format';
import { useCan } from '@/lib/session';
import {
  AGENT_COLUMN, CADENCE_GROUP_LABEL, CADENCES, commitUpload, FIGURE_COLUMNS, figureLabel, METRIC_COLUMN_LABEL, MONEY_METRICS,
  previewUpload, PRODUCTION_METRICS, readMonth, readTemplate, templateHref, type CorrectionResult, type ImportResult,
  type MetricCell, type MonthRow, type MonthState, type MonthView, type PreviewCell, type ProductionMetric,
  type TemplateFile, type UploadPreview,
} from '@/lib/production';
import { usePhone } from '@/lib/use-phone';
import { readBranchInfo } from '@/lib/tenant-config';
import { CorrectionPanel, correctedNote, type Editing, showFigure } from './correction-panel';
import { correctedWords, FiguresSheet } from './figures-sheet';
import { FigureCell, FigureTable, GROUP_DIVIDER, opensGroup } from './figure-table';
import { ImportHistory } from './import-history';
import { monthLabel } from './month-label';
import { MonthLock } from './month-lock';

/**
 * The office's production, month by month (P9-T1, P9-T2, P9-T3).
 *
 * **The month table, before the file.** The prototype draws the toolbar, the preview and the table on
 * day one over an in-memory array (`KPM_Owner.html:1289-1324`). P9-T1 shipped the picker and the
 * table, P9-T2 the download, P9-T3 the upload and its preview, P9-T4 Confirm import, the history
 * with its Revert, and the month's lock, P9-T5 the correction of one figure by hand, and ADR-0054 the
 * *Active (MAA)* column. Each arrived with the route it calls, because a control with nothing behind
 * it is the defect `backend-then-frontend.md` exists to prevent.
 *
 * **Every active member is a row, and a dash is not a zero.** A row of dashes says the carrier has not
 * reported this person; a `0` says it reported nothing produced. An empty table would say the office
 * has nobody, and a table of zeroes that nobody produced — neither is true.
 */
/**
 * **The month table's legend, in the client's words** (P18.97-T4 AC-2; UI-023): *"✎ = corrected by hand · — = not
 * reported · Active = APE or policies > 0 this month"*. `spoken` is what a screen reader says for a glyph it would pass
 * over. In the reader's words (P18.98-T4): *Active* is the column's own word, *Aktif* in Indonesian.
 */
function legendIn(t: typeof dataUploadMessages.en): readonly { symbol: string; spoken?: string; meaning: string }[] {
  return [
    { symbol: '✎', meaning: t.legend.corrected },
    { symbol: '—', spoken: t.legend.dash, meaning: t.legend.notReported },
    { symbol: t.active, meaning: t.legend.active },
  ];
}

/**
 * **Its words are the reader's** (P18.98-T4; `dataUploadMessages`): the page's name and the table's metric headings
 * kept English, the rest the approved glossary's; a member's name and code, a file's name and a reason as typed, and the
 * server's sentences as sent. Its figures were the reader's already (P18.98-T3).
 */
export default function DataUploadPage() {
  const t = useMessages(dataUploadMessages);
  /*
   * *APE*'s first appearance on the screen carries its ⓘ (P18.95-T9 AC-3; UI-028) — **after the sentence, never
   * inside it** (P18.97-T4 AC-2, ADR-0176 §6; UI-023: *"APE ⓘ What is APE? , rolling persistency, …"* read as
   * one broken sentence to the client and to a screen reader).
   */
  const subtitle = <>{t.subtitle} <TermTip term="APE" /></>;
  return (
    <Page title={t.title} subtitle={subtitle} permission="data_upload:read">
      <MonthTable />
    </Page>
  );
}

/**
 * **Inside the gate, not around it.** `Page` checks `data_upload:read` and renders its children only
 * once that holds — so the request has to live in a child. With the effect in the page component
 * itself, the table was correctly withheld from an agent and the request for it was sent anyway,
 * which is a permission enforced on the pixels and not on the wire.
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
  const t = useMessages(dataUploadMessages);
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
    // The server's code and request id for support, and none for a failure the browser detected (P18.97-T4 AC-10).
    const reference = errorReference(error);
    return (
      <p role="alert" className="flex min-h-10 flex-wrap items-center gap-x-2 text-sm text-alert">
        <span>{t.templateFailed({ message: error.message })}</span>
        <Button variant="inline" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
        {reference === null
          ? <ConsoleCode code={error.code} message={error.message} />
          : <span className="text-2xs text-muted">{reference}</span>}
      </p>
    );
  }

  if (!template) return null;

  return (
    // The prototype's glyph before the word, kept out of the link's name as the Summary's ⬇ Download keeps
    // it (ADR-0068): a screen reader says *Download template*, not *downwards black arrow* first.
    <a href={templateHref(template)} download={template.filename} className={buttonClass('secondary', cn('gap-1', CONTROL_PHONE))}>
      <span aria-hidden="true">⬇</span>{t.downloadTemplate}
    </a>
  );
}

function MonthTable() {
  const t = useMessages(dataUploadMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  // A convenience for choosing, not a computation over data: the rows for a month are the
  // server's, resolved in the office's zone, and the month is explicit in what the screen asks for.
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  /**
   * **The office's month, once its zone is known** (invariant §9). The first render offers the UTC
   * month so the table is not held up; branch info then says the office's zone, and the default moves
   * to the office's month — for the first seven hours of a Jakarta month, UTC is still in the last
   * one. A month the reader picked is never moved.
   */
  const picked = useRef(false);
  useEffect(() => {
    let live = true;
    readBranchInfo()
      .then((branch) => { if (live && !picked.current) setMonth(monthInZone(branch.timezone, new Date())); })
      .catch(() => { /* the UTC month stands; the picker is still there */ });
    return () => { live = false; };
  }, []);
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
  /** The figure being corrected, if one is (P9-T5). */
  const [editing, setEditing] = useState<Editing | null>(null);
  const canCorrect = useCan('data_upload:correct_cell');
  /*
   * **Below 768px a card per agent, and a sheet of their figures** (P18.97-T7 AC-2, ADR-0178 §4; the client's UI-034:
   * the month's table, 1816px on a 375px screen; UI-040: 340 tappable cells under 44px). Asked here, where the screen
   * mounts and before the month answers, so a phone never draws the table first. No cell is edited in a table on a
   * phone: a card's tap opens `FiguresSheet`, whose fields save through the same `PATCH /kpm/data-upload/cell`.
   */
  const phone = usePhone();
  /** The agent whose sheet is open, on a phone. */
  const [sheetFor, setSheetFor] = useState<string | null>(null);

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
    setEditing(null);
    setSheetFor(null);
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
  const imported = (result: ImportResult) => {
    const { keptCorrectionCount, replacedCorrectionCount, writtenRowCount } = result.batch;
    wrote(t.imported({
      records: writtenRowCount, month: monthLabel(result.batch.month, figures), kept: keptCorrectionCount, replaced: replacedCorrectionCount,
    }));
  };
  const reverted = (result: ImportResult) => wrote(t.reverted({
    filename: result.batch.filename, restored: result.batch.restoredCellCount, kept: result.batch.keptCellCount,
  }));
  const relocked = (next: MonthState) => wrote(t.relocked({ month: monthLabel(next.month, figures), locked: next.locked }));
  const corrected = (r: CorrectionResult) => {
    const who = editing?.name ?? t.thisMember;
    const label = figureLabel(r.metric, r.cadence, language);
    // Closed here, in the same render as the sentence that replaces it — not by the reload's effect,
    // which would leave the form and the sentence on screen together for a frame.
    setEditing(null);
    wrote(r.changed
      ? t.corrected({
        label, who, before: showFigure(r.metric, r.before.value, figures, language), after: showFigure(r.metric, r.after.value, figures, language),
      })
      : t.unchanged({ label, who, after: showFigure(r.metric, r.after.value, figures, language) }));
  };
  /** A figure is a control only for somebody who may correct it, in a month that is open. */
  const correctable = !!view && canCorrect && !view.state.locked;
  /** The sheet's agent, as the month has them. */
  const sheetRow = sheetFor ? view?.rows.find((r) => r.membershipId === sheetFor) ?? null : null;
  /** The sheet closed: what it saved is said and the month read again; with nothing saved, nothing moves. */
  const sheetClosed = (row: MonthRow, results: CorrectionResult[]) => {
    setSheetFor(null);
    if (results.length > 0) wrote(correctedWords(row.name, results, figures, language));
  };

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

  /**
   * The month table's columns, flat, for the skeleton that stands in for it while it loads — in the
   * table's own order (P13.1-T7): *Agent*, *Agent code*, this month's six, the year's six, and
   * **Active (MAA)** to close the row (`KPM_Owner.html:4836-4848`). The table draws them under its two
   * group headings (`FigureTable`); a placeholder has one row of headings, so each says its group as the
   * file's heading does.
   */
  const tableColumns: readonly Column[] = [
    AGENT_COLUMN,
    t.agentCode,
    ...FIGURE_COLUMNS.map((f) => `${METRIC_COLUMN_LABEL[f.metric]} — ${CADENCE_GROUP_LABEL[f.cadence]}`),
    t.activeColumn,
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label={t.month} htmlFor="upload-month" className="w-44">
          <TextInput
            id="upload-month"
            type="month"
            className={CONTROL_PHONE}
            value={month}
            onChange={(e) => {
              if (!e.target.value) return;
              picked.current = true;
              setMonth(e.target.value);
            }}
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

      {view && editing && (
        <CorrectionPanel
          key={`${editing.membershipId}-${editing.metric}-${editing.cadence}`}
          editing={editing}
          month={view.month}
          revision={view.state.revision}
          onDone={corrected}
          onCancel={() => setEditing(null)}
        />
      )}

      {view && (
        <UploadResult
          state={upload}
          month={view.month}
          monthState={view.state}
          onCancel={dismiss}
          onImported={imported}
        />
      )}

      {error && <ErrorBanner {...error} />}

      {!error && view === null && (phone
        ? <SkeletonCards count={3} label={t.loadingMonth({ month: monthLabel(month, figures) })} />
        : <SkeletonTable caption={t.dataFor({ month: monthLabel(month, figures) })} columns={tableColumns} rows={5} />)}

      {view && (
        <>
          <h2 className="mb-1 font-display text-md font-bold text-navy">
            {t.dataFor({ month: monthLabel(view.month, figures) })}
          </h2>
          <p className="mb-3 text-sm text-muted" role="status">
            {view.withData === 0
              ? t.nothingUploaded({ month: monthLabel(view.month, figures) })
              : t.withFigures({ n: view.withData, of: view.rows.length })}
          </p>
          {correctable && (
            <p className="-mt-2 mb-1 text-sm text-muted">
              {/* On a phone the tap is the agent's card, which opens their figures (P18.97-T7 AC-2). */}
              {phone ? t.tapAgent : t.tapNumber}
            </p>
          )}
          {/*
            * Where every figure came from, said once rather than on every cell (P9-T6 AC-4) — **in the client's one line, at
            * every size** (P18.97-T4 AC-2, ADR-0176 §6; the grey-text table, UI-023: 45 words). Each of its three parts
            * stays whole, so a narrow screen breaks the line between them, never inside one. The dash is said as a
            * dash, as before: a screen reader passes over the glyph.
            */}
          <p className="mb-3 text-xs text-muted">
            {legendIn(t).map((part, i) => (
              <span key={part.symbol}>
                {i > 0 && ' · '}
                <span className="whitespace-nowrap">
                  {part.spoken ? (
                    <><span aria-hidden="true">{part.symbol}</span><span className="sr-only">{part.spoken}</span></>
                  ) : part.symbol}
                  {' = '}{part.meaning}
                </span>
              </span>
            ))}
          </p>

          {/*
            * **The prototype's order** (P13.1-T7): the name, the code, this month's six, the year's six,
            * then *Active (MAA)* — and the rows in the order the org tree reads, which is the server's.
            */}
          {phone ? (
            <AgentCards
              rows={view.rows}
              caption={t.dataFor({ month: monthLabel(view.month, figures) })}
              correctable={correctable}
              onOpen={setSheetFor}
            />
          ) : (
          <FigureTable caption={t.dataFor({ month: monthLabel(view.month, figures) })} active tableClassName="min-w-[102.5rem]">
            {(headersOf) => view.rows.map((row) => (
              <Row key={row.membershipId}>
                <Cell className="whitespace-nowrap">{row.name}</Cell>
                <Cell className="whitespace-nowrap font-semibold text-muted">{row.agentCode}</Cell>
                {FIGURE_COLUMNS.map(({ metric: m, cadence }, i) => {
                  const cell = row.metrics[m][cadence];
                  return (
                    <FigureCell key={`${m}-${cadence}`} headers={headersOf({ metric: m, cadence })} divider={opensGroup(i)}>
                      {correctable ? (
                        <button
                          type="button"
                          onClick={() => setEditing({
                            membershipId: row.membershipId, name: row.name, agentCode: row.agentCode,
                            metric: m, cadence, current: cell,
                          })}
                          aria-label={t.correctFigure({
                            label: figureLabel(m, cadence, language),
                            name: row.name,
                            now: showFigure(m, cell.value, figures, language),
                            note: cell.provenance === 'corrected' ? correctedNote(cell, figures, language) : null,
                          })}
                          className="-mx-1 rounded-sm px-1 underline-offset-2 hover:bg-navy/[0.06] hover:underline"
                        >
                          <Figure metric={m} cell={cell} />
                        </button>
                      ) : (
                        <Figure metric={m} cell={cell} />
                      )}
                    </FigureCell>
                  );
                })}
                <Cell className={cn('text-center', GROUP_DIVIDER)}><ActiveMark active={row.monthlyActiveAgent} /></Cell>
              </Row>
            ))}
          </FigureTable>
          )}
          {/* Opened from a phone's card only; kept open should the window widen, until it is closed and says what it saved. */}
          {correctable && sheetRow && (
            <FiguresSheet
              key={sheetRow.membershipId}
              row={sheetRow}
              month={view.month}
              revision={view.state.revision}
              onClose={(results) => sheetClosed(sheetRow, results)}
            />
          )}

          <ImportHistory month={view.month} state={view.state} generation={generation} onReverted={reverted} />
        </>
      )}
    </>
  );
}

/**
 * **The month as a card per agent** (P18.97-T7 AC-2, ADR-0178 §4; UI-034), through the shared card pieces
 * (`components/ui/row-cards.tsx`), in the table's order and words: the name and the code, then *This Month*'s six and
 * *YTD*'s six, each figure under its heading — money in full, a dash for nothing reported, ✎ on one corrected by hand,
 * as the cells write them — and *Active (MAA)*. **For somebody who may correct a figure, in a month that is open, the
 * name is the card's button**, *Correct figures for {name}*: its tap covers the card and opens the agent's sheet, and the
 * focus ring is drawn round the card. Otherwise the card is read and nothing more.
 */
function AgentCards({
  rows, caption, correctable, onOpen,
}: {
  rows: readonly MonthRow[];
  caption: string;
  correctable: boolean;
  onOpen: (membershipId: string) => void;
}) {
  const t = useMessages(dataUploadMessages);
  return (
    <RowCards label={caption}>
      {rows.map((row) => (
        <RowCard key={row.membershipId} data-row={row.membershipId} className="relative">
          <p className="min-w-0">
            {correctable ? (
              <button
                type="button"
                aria-label={t.correctFiguresFor({ name: row.name })}
                aria-haspopup="dialog"
                onClick={() => onOpen(row.membershipId)}
                className={cn(
                  'break-words text-left text-md font-semibold text-navy underline underline-offset-2',
                  "after:absolute after:inset-0 after:rounded-sm after:content-['']",
                  'focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2',
                  'focus-visible:after:-outline-offset-2 focus-visible:after:outline-amber',
                )}
              >
                {row.name}
              </button>
            ) : (
              <span className="break-words text-md font-semibold text-navy">{row.name}</span>
            )}
            <span className="block whitespace-nowrap text-sm font-semibold text-muted">{row.agentCode}</span>
          </p>
          {CADENCES.map((cadence) => (
            <div key={cadence} role="group" aria-label={CADENCE_GROUP_LABEL[cadence]} className="mt-3 border-t border-hairline pt-2.5">
              <p aria-hidden="true" className="text-xs font-bold uppercase tracking-wide text-navy">{CADENCE_GROUP_LABEL[cadence]}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5">
                {PRODUCTION_METRICS.map((metric) => (
                  <CardField key={metric} label={METRIC_COLUMN_LABEL[metric]}>
                    <span className="text-md"><Figure metric={metric} cell={row.metrics[metric][cadence]} /></span>
                  </CardField>
                ))}
              </dl>
            </div>
          ))}
          <dl className="mt-3 border-t border-hairline pt-2.5">
            <CardField label={t.activeColumn}><ActiveMark active={row.monthlyActiveAgent} /></CardField>
          </dl>
        </RowCard>
      ))}
    </RowCards>
  );
}

/**
 * One cell. **A dash for nothing, a number for something — including zero.** The dash is muted so a
 * month nobody has uploaded reads as quiet rather than as a wall of failures.
 *
 * **And whose it is** (P9-T6 AC-4). A figure from the carrier's file is plain — it is most of the
 * table, and marking every one would mark none. A figure corrected by hand carries **✎**, with who,
 * when and why in its tooltip and, for a screen reader, in its text; a figure **emptied** by hand is a
 * dash with the same mark, because *nothing is held* and *somebody decided nothing is held* are two
 * different things to know about a month.
 */
function Figure({ metric, cell }: { metric: ProductionMetric; cell: MetricCell }) {
  const t = useMessages(dataUploadMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const mark = cell.provenance === 'corrected' ? correctedNote(cell, figures, language) : null;
  const shown = cell.value === null
    ? <span className="text-muted" aria-label={mark ? undefined : t.nothingReported}>—</span>
    : <span className="text-navy">{formatFigure(metric, cell.value, figures)}</span>;
  if (!mark) return shown;
  // `relative`, so the screen-reader note is placed inside the table's scroll box and not beside the
  // page: an `sr-only` span is absolutely positioned, and with no positioned ancestor it escaped the
  // box and widened the page by the width of its column — 5px at 400px, found walking the screen.
  return (
    <span title={mark} className="relative">
      {shown}
      <span aria-hidden="true" className="ml-1 text-2xs font-bold text-navy">✎</span>
      <span className="sr-only">{`, ${mark}`}</span>
    </span>
  );
}

/**
 * The Monthly Active Agent (ADR-0054): the prototype's ✓, ✕ and grey dash (`KPM_Owner.html:4830-4832`).
 *
 * **The server's answer, drawn — never worked out here.** The prototype computes it in the page; ours
 * is `MONTHLY_ACTIVE_AGENT`, one function on the server, and a screen re-deriving it is how the
 * product came to hold four definitions of *active* (invariant §8).
 *
 * **The glyph is navy and the wash is the colour.** The prototype's blue ✓ and amber ✕ miss 4.5:1 on
 * their own tints (`a11y.spec.tsx` pins both), which is the leads table's mid-stage status again, and
 * settled the same way. The shape says which, the words say it to a screen reader, and colour is
 * never the only cue.
 */
function ActiveMark({ active }: { active: boolean | null | undefined }) {
  const t = useMessages(dataUploadMessages);
  if (active === null || active === undefined) {
    return <span role="img" aria-label={t.notReported} className="text-muted">—</span>;
  }
  return (
    <span
      role="img"
      aria-label={active ? t.active : t.notActive}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-navy',
        active ? 'bg-info/[0.12]' : 'bg-amber/[0.16]',
      )}
    >
      {active ? '✓' : '✕'}
    </span>
  );
}

/**
 * Money in full rupiah, persistency with its sign, counts as they are — the table's own formats, in `id-ID`
 * (ADR-0167 §1). **The file's own figures, so in full** (ADR-0174 §3, §4: Data upload's cells are where precision
 * matters): money to the rupiah, and a persistency with every decimal the file had — *87,35%*, *87%* — never rounded.
 */
function formatFigure(metric: ProductionMetric, value: number, figures: Language): string {
  if (MONEY_METRICS.includes(metric)) return formatRupiah(value, figures);
  if (metric === 'persistency') return formatPercent(value, { lossless: true }, figures);
  return formatNumber(value, { maxDecimals: 4 }, figures);
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
  const t = useMessages(dataUploadMessages);
  const allowed = useCan('data_upload:upload_and_preview');
  if (!allowed) return null;
  return (
    <span className="relative inline-flex">
      <input
        type="file"
        accept=".csv,text/csv"
        aria-label={t.upload}
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
          CONTROL_PHONE,
          'peer-disabled:opacity-60',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-amber',
        )}
      >
        {busy ? t.readingFile : t.upload}
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
  state, month, monthState, onCancel, onImported,
}: {
  state: UploadState;
  month: string;
  monthState: MonthState;
  onCancel: () => void;
  onImported: (result: ImportResult) => void;
}) {
  const t = useMessages(dataUploadMessages);
  if (state.kind === 'idle') return null;

  if (state.kind === 'reading') {
    return (
      <Card className="mb-5" aria-busy="true">
        <p className="mb-3 text-sm text-muted">{t.reading({ filename: state.filename })}</p>
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
        <p className="mb-2 text-md font-semibold text-navy">{t.notRead({ filename: state.filename })}</p>
        <ErrorBanner {...state.error} />
        <div className="mt-3">
          <Button variant="secondary" onClick={onCancel} className={CONTROL_PHONE}>{t.dismiss}</Button>
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
  preview, file, month, monthState, onCancel, onImported,
}: {
  preview: UploadPreview;
  file: File;
  month: string;
  monthState: MonthState;
  onCancel: () => void;
  onImported: (result: ImportResult) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const figures = useFigureLanguage();
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  useEffect(() => { heading.current?.focus(); }, [preview]);
  const canConfirm = useCan('data_upload:commit_import');
  const [confirming, setConfirming] = useState(false);
  const [refused, setRefused] = useState<ApiError | null>(null);

  /**
   * **Figures somebody corrected by hand that the file would change** (ADR-0053). Each is replaced
   * only if ticked, and none is ticked to begin with: re-uploading a file must never undo a correction
   * unless somebody chose that, with who corrected it and why in front of them.
   */
  const corrections = preview.rows.flatMap((row) => row.cells
    .filter((c) => c.correction && (c.status === 'new' || c.status === 'changed'))
    .map((cell) => ({ row, cell, key: `${row.membershipId}:${fieldOf(cell)}` })));
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string, on: boolean) => setTicked((now) => {
    const next = new Set(now);
    if (on) next.add(key); else next.delete(key);
    return next;
  });
  const written = preview.summary.newCells + preview.summary.changedCells - (corrections.length - ticked.size);
  const nothing = written === 0;

  /**
   * **Confirm import** (`KPM_Owner.html:1309`). The same file again with the revision the preview was
   * taken against: if the month has moved since — somebody else imported, reverted or locked it — the
   * server refuses rather than writing a diff nobody saw.
   */
  const confirm = async () => {
    setConfirming(true);
    setRefused(null);
    try {
      onImported(await commitUpload(month, preview.revision, file, [...ticked]));
    } catch (err) {
      setRefused(toDisplayError(err));
      setConfirming(false);
    }
  };

  const { summary } = preview;
  const ready = preview.rows.filter((r) => r.status === 'ready');
  const issues = preview.rows.flatMap((r) => r.issues.map((issue, i) => ({ row: r, issue, key: `${r.line}-${i}` })));

  const counted = t.figures({
    fresh: summary.newCells, changed: summary.changedCells, unchanged: summary.unchangedCells,
    blank: summary.notProvidedCells, refused: summary.refusedCells, corrections: summary.correctionCells,
  });

  return (
    <Card className="mb-5" role="region" aria-labelledby={headingId}>
      <h2 ref={heading} id={headingId} tabIndex={-1} className="text-md font-semibold text-navy">
        {t.ready({ ready: summary.ready, skipped: summary.refused })}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {t.fromFile({ filename: preview.filename, figures: counted })}
        {summary.notInFile > 0 && ` ${t.notInFile({ n: summary.notInFile })}`}
      </p>
      <p className="mt-2 text-sm text-navy">
        <strong>{t.nothingSavedYet}</strong> {t.confirmWrites({ month: monthLabel(month, figures) })}
      </p>

      {corrections.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="text-sm font-semibold text-navy">{t.correctedByHand({ n: corrections.length })}</h3>
            <span className="flex gap-3">
              <Button variant="inline" onClick={() => setTicked(new Set(corrections.map((c) => c.key)))}>{t.replaceAll}</Button>
              <Button variant="inline" onClick={() => setTicked(new Set())}>{t.keepAll}</Button>
            </span>
          </div>
          <p className="mb-1 text-sm text-muted">{t.correctionsNote}</p>
          <ul>
            {corrections.map(({ row, cell, key }) => (
              <CorrectionChoice
                key={key}
                name={row.name ?? row.agentCode}
                cell={cell}
                ticked={ticked.has(key)}
                onChange={(on) => toggle(key, on)}
              />
            ))}
          </ul>
        </div>
      )}

      {issues.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-sm font-semibold text-navy">{t.notTaken({ n: issues.length })}</h3>
          <ul>
            {issues.map(({ row, issue, key }) => (
              <li key={key} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 border-b border-hairline py-1.5 text-sm last:border-b-0">
                <span className="font-semibold text-navy">{t.line({ line: row.line, code: row.agentCode, name: row.name })}</span>
                <span className="text-alert">{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ready.length > 0 && (
        <div className="mt-4">
          {/* The month table's columns and order, without *Active (MAA)* (P13.1-T7, I-128). */}
          <FigureTable caption={t.wouldChange({ filename: preview.filename })} tableClassName="min-w-[96rem]">
            {(headersOf) => ready.map((row) => (
              <Row key={row.line}>
                <Cell className="whitespace-nowrap">
                  {row.name}
                  {row.nameDiffers && (
                    <span className="block text-2xs text-muted">{t.fileSays({ name: row.fileName })}</span>
                  )}
                </Cell>
                <Cell className="whitespace-nowrap font-semibold text-muted">
                  {row.resolvedAgentCode}
                  {row.codeRecovered && (
                    <span className="block text-2xs font-normal">{t.readFrom({ code: row.agentCode })}</span>
                  )}
                </Cell>
                {FIGURE_COLUMNS.map(({ metric: m, cadence }, i) => (
                  <FigureCell key={`${m}-${cadence}`} headers={headersOf({ metric: m, cadence })} divider={opensGroup(i)}>
                    <Change
                      cell={row.cells.find((c) => c.metric === m && c.cadence === cadence)!}
                      replacing={ticked.has(`${row.membershipId}:${m}${cadence === 'monthly' ? 'Monthly' : 'Ytd'}`)}
                    />
                  </FigureCell>
                ))}
              </Row>
            ))}
          </FigureTable>
        </div>
      )}

      {refused && <div className="mt-3"><ErrorBanner {...refused} /></div>}

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {canConfirm && (
          <Button onClick={confirm} disabled={confirming || nothing || monthState.locked} className={CONTROL_PHONE}>
            {confirming ? t.importing : t.confirmImport}
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel} disabled={confirming} className={CONTROL_PHONE}>{t.cancel}</Button>
        {canConfirm && monthState.locked && (
          <span className="text-sm text-muted">{t.lockedImport({ month: monthLabel(month, figures) })}</span>
        )}
        {canConfirm && !monthState.locked && nothing && (
          <span className="text-sm text-muted">
            {corrections.length ? t.nothingWouldChangeCorrected : t.nothingWouldChange}
          </span>
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
function Change({ cell, replacing }: { cell: PreviewCell; replacing: boolean }) {
  const t = useMessages(dataUploadMessages);
  const figures = useFigureLanguage();
  // A correction the file would change: kept unless ticked, and the cell says which (ADR-0053).
  if (cell.correction && !replacing) {
    return (
      <>
        <span className="text-muted">{cell.before === null ? '—' : formatFigure(cell.metric, cell.before, figures)}</span>
        <span className="block text-2xs text-muted">{t.correctionKept}</span>
      </>
    );
  }
  if (cell.correction && replacing) {
    return (
      <>
        <span className="font-semibold text-navy">{formatFigure(cell.metric, cell.after!, figures)}</span>
        <span className="block text-2xs text-alert">{t.replacesCorrection}</span>
      </>
    );
  }
  switch (cell.status) {
    case 'new':
      return <span className="font-semibold text-navy">{formatFigure(cell.metric, cell.after!, figures)}</span>;
    case 'changed':
      return (
        <>
          <span className="font-semibold text-navy">{formatFigure(cell.metric, cell.after!, figures)}</span>
          <span className="block text-2xs text-muted">{t.was({ figure: formatFigure(cell.metric, cell.before!, figures) })}</span>
        </>
      );
    case 'unchanged':
      return <span className="text-muted">{formatFigure(cell.metric, cell.after!, figures)}</span>;
    case 'not_provided':
      return <span className="text-muted" aria-label={t.leftBlank}>—</span>;
    default:
      return (
        <span className="font-semibold text-alert">
          ✕ {cell.raw}<span className="sr-only">{t.notTakenCell}</span>
        </span>
      );
  }
}

/** The month row's field for a cell — `apeMonthly` — which is how a ticked correction is named. */
const fieldOf = (c: { metric: ProductionMetric; cadence: 'monthly' | 'ytd' }) =>
  `${c.metric}${c.cadence === 'monthly' ? 'Monthly' : 'Ytd'}`;

/**
 * One figure somebody corrected, that the file would change — and the choice (ADR-0053).
 *
 * Everything needed to decide is on the line: what the correction made it, who, when and why, and
 * what the file says — with a note when the file's figure is **the one the correction replaced**,
 * which is how an old file uploaded again looks.
 */
function CorrectionChoice({
  name, cell, ticked, onChange,
}: {
  name: string;
  cell: PreviewCell;
  ticked: boolean;
  onChange: (on: boolean) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const detailId = useId();
  const c = cell.correction!;
  const label = figureLabel(cell.metric, cell.cadence, language);
  return (
    <li className="border-b border-hairline py-2 text-sm last:border-b-0">
      <p className="font-semibold text-navy">{name} · {label}</p>
      <p id={detailId} className="text-muted">
        {t.choice({
          now: cell.before === null ? null : formatFigure(cell.metric, cell.before, figures),
          by: c.by,
          day: c.at ? formatDayLong(c.at, figures) : null,
          reason: c.reason,
          file: formatFigure(cell.metric, cell.after!, figures),
          // The figure the correction replaced: the file carrying it again is probably the old file.
          old: c.replacedValue !== null && c.replacedValue === cell.after,
        })}
      </p>
      <label className={cn('mt-1 inline-flex cursor-pointer items-center gap-2 text-navy', CHECK_LINE_PHONE)}>
        <input
          type="checkbox"
          className="h-4 w-4 accent-navy"
          checked={ticked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={detailId}
        />
        <span><span className="sr-only">{t.choiceFor({ label, name })}</span>{t.replaceWithFile}</span>
      </label>
    </li>
  );
}

