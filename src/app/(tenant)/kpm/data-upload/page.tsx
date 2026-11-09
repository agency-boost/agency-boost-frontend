'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, Row, type Column } from '@/components/ui/data-table';
import { ConsoleCode } from '@/components/ui/console-code';
import { DateField } from '@/components/ui/date-field';
import { Button, buttonClass, Card, ErrorBanner } from '@/components/ui/field';
import { FilterChips, ListCard, ListRow } from '@/components/ui/list-rows';
import { CHECK_LINE_PHONE } from '@/components/ui/phone';
import { SkeletonBar, SkeletonCards, SkeletonTable } from '@/components/ui/skeleton';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { errorReference } from '@/lib/browser-errors';
import { saveFile } from '@/lib/save-file';
import { cn } from '@/lib/cn';
import { dayInZone, formatCalendarDay, formatDayLong, monthInZone } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import { useCan } from '@/lib/session';
import { termDefinition } from '@/lib/terms';
import {
  AGENT_COLUMN, APE_KODE, cellKey, columnHeading, commitUpload, correctionKey, figureLabel,
  previewUpload, readMonth, readTemplate, readTemplateWorkbook, templateHref, workbookFilename, ytdColumns,
  type CorrectionResult, type ImportResult, type MetricCell, type MonthColumn,
  type MonthRow, type MonthState, type MonthStatus, type MonthView, type PreviewCell, type PreviewColumn,
  type TemplateFile, type UnregisteredRow, type UploadPreview, type UploadUnit, type YtdCell,
} from '@/lib/production';
import { readBranchInfo } from '@/lib/tenant-config';
import { missingMonthsWords, YtdFigure } from '@/components/ytd-cell';
import { CorrectionPanel, correctedNote, type Editing, showFigure } from './correction-panel';
import { ActiveMark, Figure, formatFigure } from './figure-marks';
import { correctedWords, FiguresSheet, type Side, useCadenceTabs } from './figures-sheet';
import { FigureCell, FigureTable, opensGroup, type FigureColumn } from './figure-table';
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
 *
 * **Laid out as the client drew it on 3 November** (P19.2-T3 AC-1; UI-139, `kpm-owner-mobile-2026-11-03` screens 2–3
 * and `kpm-owner-desktop-2026-11-03` screen 2): the month a navy pill on the title row; the lock a green strip with
 * *Kunci bulan*; the intro behind one ⓘ; chips *Semua n · Belum dilaporkan n · Dikoreksi n*. **From 1024px** the table
 * under a *Bulan ini | YTD* switch — the name and seven columns at a time, its head and name column held while it scrolls
 * in its own box. **Below 1024px** — a phone and a tablet — one 56px row per member and a sheet of their figures.
 */
/**
 * **The month table's legend, in the client's words** (P18.9-T4 AC-2; UI-023): *"✎ = corrected by hand · — = not
 * reported · Active = APE or policies > 0 this month"*. `spoken` is what a screen reader says for a glyph it would pass
 * over. In the reader's words (P18.10-T4): *Active* is the column's own word, *Aktif* in Indonesian.
 */
function legendIn(t: typeof dataUploadMessages.en): readonly { symbol: string; spoken?: string; meaning: string }[] {
  return [
    { symbol: '✎', meaning: t.legend.corrected },
    { symbol: '—', spoken: t.legend.dash, meaning: t.legend.notReported },
    { symbol: t.active, meaning: t.legend.active },
  ];
}

/** Today's month in UTC, the first render's guess until the office's zone answers. */
const utcMonth = () => new Date().toISOString().slice(0, 7);

/**
 * **Its words are the reader's** (P18.10-T4; `dataUploadMessages`): the page's name and the table's metric headings
 * kept English, the rest the approved glossary's; a member's name and code, a file's name and a reason as typed, and the
 * server's sentences as sent. Its figures were the reader's already (P18.10-T3).
 *
 * **The month lives here, beside the title** (P19.2-T3 AC-1; UI-139: *"month as a navy pill"*), because its pill sits on
 * the title row; what reads the office's zone to pick its default stays inside the permission's gate (`MonthTable`).
 */
export default function DataUploadPage() {
  const t = useMessages(dataUploadMessages);
  const [month, setMonth] = useState(utcMonth);
  /** A month the reader picked is never moved by the office's zone arriving afterwards. */
  const picked = useRef(false);
  /** The office's month once its zone answers: the default an address's locked month falls back to. */
  const zoneMonth = useRef<string | null>(null);
  /**
   * **The month named in the address** (P19.3-T2 AC-7; UI-150, the route registry's `?month=YYYY-MM`): the Overview's
   * *"Okt belum diunggah ›"* and the setup card's step 6 open Data upload on that month. Read from the address once, as
   * the page opens — kept as if the reader had picked it, so the office's zone does not move it — and **a month not open
   * for upload falls back to the page's own default** once its read says it is locked.
   */
  const fromAddress = useRef<string | null>(null);
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get('month');
    if (!asked || !/^\d{4}-(0[1-9]|1[0-2])$/.test(asked)) return;
    fromAddress.current = asked;
    picked.current = true;
    setMonth(asked);
  }, []);
  return (
    <Page
      title={t.title}
      permission="data_upload:read"
      actions={(
        <MonthPill
          month={month}
          onPick={(next) => {
            picked.current = true;
            setMonth(next);
          }}
        />
      )}
    >
      <MonthTable
        month={month}
        onPick={(next) => {
          picked.current = true;
          setMonth(next);
        }}
        onZoneMonth={(next) => {
          zoneMonth.current = next;
          if (!picked.current) setMonth(next);
        }}
        onLocked={(locked) => {
          if (locked !== fromAddress.current) return;
          fromAddress.current = null;
          picked.current = false;
          setMonth(zoneMonth.current ?? utcMonth());
        }}
      />
    </Page>
  );
}

/**
 * **The month, as a navy pill** (UI-139; `kpm-owner-mobile` 2, `kpm-owner-desktop` 2: *"Nov 2026 ▾"*): the browser's
 * own month picker, dressed as the pill, its name *Month* for a screen reader. 44px tall below 1024px, 36px from it.
 */
function MonthPill({ month, onPick }: { month: string; onPick: (month: string) => void }) {
  const t = useMessages(dataUploadMessages);
  return (
    <label className="inline-flex shrink-0">
      <span className="sr-only">{t.month}</span>
      <input
        id="upload-month"
        type="month"
        value={month}
        onChange={(e) => { if (e.target.value) onPick(e.target.value); }}
        data-month-pill=""
        className={cn(
          'h-9 rounded-pill border-0 bg-secondary px-3.5 text-base font-semibold text-secondary-contrast [color-scheme:dark]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          'max-lg:h-11',
        )}
      />
    </label>
  );
}

/**
 * **The page's controls, 44px tall on a phone and a tablet** (P18.9-T7 AC-6 below 768px; P19.2-T3 AC-1 and AC-4 from
 * 768px too — UI-139 and UI-142 scope *Mobile + Tablet*): a `Button` of a box variant, a link wearing `buttonClass`.
 */
const CONTROL_TOUCH = 'max-lg:h-11';

/**
 * **⬇ Download template** — the prototype's own control (`KPM_Owner.html:1301`), **and since ADR-0184 the Excel
 * template**, the recommended file: its guide on a sheet of its own, its Data sheet the same header and rows as the
 * CSV. **Download CSV** beside it is the CSV as it always was.
 *
 * The workbook is a `<button>`: it is fetched with the token (`apiBlob`) and saved (`saveFile`), because a link to the
 * API would arrive without the token, which lives in memory only. The CSV stays a real `<a download>` over a `data:`
 * URL of the file the JSON carries, as it was, wearing the inline button's classes. The prototype builds the file in
 * the browser from the array the table reads; ours is the server's, so the header the file carries is the one the
 * importer will know.
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
  /** The workbook being fetched, and why the last one could not be (ADR-0184). */
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);

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
    // The server's code and request id for support, and none for a failure the browser detected (P18.9-T4 AC-10).
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

  async function downloadWorkbook(file: TemplateFile) {
    setSaving(true);
    setSaveError(null);
    try {
      saveFile(await readTemplateWorkbook(month), workbookFilename(file));
    } catch (err) {
      setSaveError(toDisplayError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* The prototype's glyph before the word, kept out of the control's name as the Summary's ⬇ Download keeps
          it (ADR-0068): a screen reader says *Download template*, not *downwards black arrow* first. */}
      <Button
        variant="secondary"
        className={cn('gap-1', CONTROL_TOUCH)}
        onClick={() => void downloadWorkbook(template)}
        disabled={saving}
      >
        <span aria-hidden="true">⬇</span>{saving ? t.preparingFile : t.downloadTemplate}
      </Button>
      <a href={templateHref(template)} download={template.filename} className={buttonClass('inline', cn('self-center', CONTROL_TOUCH))}>
        {t.downloadCsv}
      </a>
      {saveError && (
        <p role="alert" className="flex min-h-10 w-full flex-wrap items-center gap-x-2 text-sm text-alert">
          <span>{t.templateFailed({ message: saveError.message })}</span>
          <Button variant="inline" onClick={() => void downloadWorkbook(template)}>{t.tryAgain}</Button>
          {errorReference(saveError) === null
            ? <ConsoleCode code={saveError.code} message={saveError.message} />
            : <span className="text-2xs text-muted">{errorReference(saveError)}</span>}
        </p>
      )}
    </>
  );
}

/** Which members the chips show (UI-139: *"Semua n · Belum dilaporkan n · Dikoreksi n"*). */
type Show = 'all' | 'unreported' | 'corrected';

/**
 * A member with no figure at all this month — a dash in every column, the carrier's silence (the chip's *Belum
 * dilaporkan*). By the template's columns (P19.5-T2), whatever they are.
 */
const unreported = (row: Pick<MonthRow, 'values'>) => Object.values(row.values).every((c) => c.value === null);
/** A member with a figure somebody corrected — or emptied — by hand (the chip's *Dikoreksi*), this month's or an uploaded YTD. */
const mended = (row: Pick<MonthRow, 'values' | 'ytd'>) =>
  [...Object.values(row.values), ...Object.values(row.ytd).filter((c) => !c.calculated)].some((c) => c.provenance === 'corrected');
const SHOWS: Record<Show, (row: MonthRow) => boolean> = { all: () => true, unreported, corrected: mended };

/** The cell a row holds for a column, or an empty one: a column the server answered no cell for reads *—*. */
const EMPTY_CELL: MetricCell = { value: null, provenance: null, correction: null };
const valueOf = (row: Pick<MonthRow, 'values'>, kode: string): MetricCell => row.values[kode] ?? EMPTY_CELL;
const ytdOf = (row: Pick<MonthRow, 'ytd'>, column: MonthColumn): YtdCell =>
  row.ytd[column.kode] ?? { ...EMPTY_CELL, calculated: column.ytd === 'sum' };

function MonthTable({
  month, onPick, onZoneMonth, onLocked,
}: {
  month: string;
  /** A month picked from the month grid (P19.5-T2 AC-8), as the pill picks one. */
  onPick: (month: string) => void;
  onZoneMonth: (month: string) => void;
  /** A month read and found locked: the page's address month falls back to the default (P19.3-T2 AC-7). */
  onLocked?: (month: string) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  /**
   * **The office's month, once its zone is known** (invariant §9). The first render offers the UTC
   * month so the table is not held up; branch info then says the office's zone, and the default moves
   * to the office's month — for the first seven hours of a Jakarta month, UTC is still in the last
   * one. A month the reader picked is never moved (the page's `picked`).
   */
  /** The office's zone, once known: today's day there is the *as of* day an upload into the current month defaults to (D8). */
  const [zone, setZone] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    readBranchInfo()
      .then((branch) => {
        if (!live) return;
        setZone(branch.timezone);
        onZoneMonth(monthInZone(branch.timezone, new Date()));
      })
      .catch(() => { /* the UTC month stands; the picker is still there */ });
    return () => { live = false; };
    // Once, as the page opens: the zone does not change under it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** The office's today, `YYYY-MM-DD`: the UTC day until its zone answers. */
  const today = dayInZone(zone ?? 'UTC', new Date());
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
   * **Below 1024px a row per member, and a sheet of their figures** (P18.9-T7 AC-2, ADR-0178 §4 below 768px; *changed
   * 2026-11-05, P19.2-T3 AC-1*: a tablet too — UI-139, *"Mobile + Tablet: one 56px row per person"*; the table was 1,816px
   * in 617px at 768). Asked here, where the screen mounts and before the month answers, so a phone or a tablet never
   * draws the table first. No cell is edited in a table there: a row's tap opens `FiguresSheet`, whose fields save
   * through the same `PATCH /kpm/data-upload/cell`.
   */
  const rows = useMediaQuery(['phone', 'tablet']);
  /** The member whose sheet is open, below 1024px. */
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  /** The chips' choice, and the switch's side on the table (UI-139). */
  const [show, setShow] = useState<Show>('all');
  const [cadence, setCadence] = useState<Side>('monthly');
  const tabs = useCadenceTabs();

  useEffect(() => {
    setView(null);
    setNotice(null);
    setShow('all');
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
      .then((next) => {
        if (!live) return;
        setView(next);
        if (next.state.locked) onLocked?.(next.month);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
    // `onLocked` is the page's, and reads refs: a new function each render asks for nothing new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const column = editing?.column ?? columns.find((c) => c.kode === r.kode);
    const unit: UploadUnit = column?.unit ?? 'count';
    const label = figureLabel(column ?? { label: { id: r.kode, en: r.kode } }, r.ytd, language);
    // Closed here, in the same render as the sentence that replaces it — not by the reload's effect,
    // which would leave the form and the sentence on screen together for a frame.
    setEditing(null);
    wrote(r.changed
      ? t.corrected({
        label, who, before: showFigure(unit, r.before.value, figures, language), after: showFigure(unit, r.after.value, figures, language),
      })
      : t.unchanged({ label, who, after: showFigure(unit, r.after.value, figures, language) }));
  };
  /** The template's columns, as the month read names them (P19.5-T2; ADR-0214 §14). */
  const columns: readonly MonthColumn[] = view?.config?.columns ?? [];
  /** A figure is a control only for somebody who may correct it, in a month that is open. */
  const correctable = !!view && canCorrect && !view.state.locked;
  /** The sheet's member, as the month has them. */
  const sheetRow = sheetFor ? view?.rows.find((r) => r.membershipId === sheetFor) ?? null : null;
  /** The sheet closed: what it saved is said and the month read again; with nothing saved, nothing moves. */
  const sheetClosed = (row: MonthRow, results: CorrectionResult[]) => {
    setSheetFor(null);
    if (results.length > 0) wrote(correctedWords(row.name, results, columns, figures, language));
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
   * The month table's columns, for the skeleton that stands in for it while it loads — the member and **Active (MAA)**
   * (`KPM_Owner.html:4836-4848`, P13.1-T7; P19.2-T3). The template's own columns arrive with the month (P19.5-T2).
   */
  const tableColumns: readonly Column[] = [AGENT_COLUMN, t.activeColumn];
  /** The table's name: the month asked for while it loads, then the month the server answered for. */
  const caption = t.dataFor({ month: monthLabel(view?.month ?? month, figures) });
  const shown = view ? view.rows.filter(SHOWS[show]) : [];

  return (
    <>
      {/*
        * **The toolbar** (UI-139): the month's lock as a strip with *Kunci bulan*, the intro's ⓘ, then the template and
        * the upload — after the strip on a laptop, as `kpm-owner-desktop` 2 draws them, and over it below 1024px, the two
        * buttons side by side as `kpm-owner-mobile` 2 draws them.
        */}
      <div className="mb-3 flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex min-w-0 items-center gap-2 lg:flex-1">
          {view && <MonthLock state={view.state} onChanged={relocked} />}
          {/* D8 (P19.5-T2 AC-9): a month uploaded while it runs, and the day its figures stand at. */}
          {view?.state.asOf && (
            <span data-as-of="" className="shrink-0 text-sm font-semibold text-muted">
              {t.perDay({ day: formatCalendarDay(view.state.asOf, figures) })}
            </span>
          )}
          <TippedGlyph glyph="ⓘ" name={t.aboutPage} tip={`${t.subtitle} ${termDefinition('APE', language)}`} align="fit" />
        </div>
        {/*
          * **After the month, not beside it.** Mounted once the table's own read has answered, and
          * for the month it answered for — so the link can never name a month the picker has left,
          * and the screen never sends two requests at once on a token that may have expired.
          */}
        <div className="flex flex-wrap items-center gap-2 max-lg:order-first max-lg:[&>*]:flex-1">
          {view && <TemplateDownload month={view.month} />}
          {view && <UploadButton busy={upload.kind === 'reading'} onFile={read} />}
        </div>
      </div>

      {/*
        * **The template the columns follow** (P19.5-T1 AC-17; AA UI-019; the template mockup's KPM side): its name and
        * version, read live — a Super Admin's publish changes the columns, and this says which version is in force.
        */}
      {view?.config && (
        <p className="mb-3 flex items-start gap-2 rounded-md border border-card-edge bg-card px-3 py-2 text-sm text-navy">
          <span aria-hidden="true">ⓘ</span>
          <span>
            <span className="font-semibold">
              {t.columnsFollow({ name: view.config.templateName ?? t.platformTemplate, version: view.config.version })}
            </span>
            {/* The template mockup's KPM side: how many columns, and what a greyed YTD is (R4). */}
            {view.config.columns && ` ${t.columnsPerAgent({ n: view.config.columns.length })} ${t.ytdGreyed}`}
          </span>
        </p>
      )}

      {/*
        * **"YTD belum lengkap: <Bul> <tahun> belum diunggah."** (P19.5-T2 AC-7; R4, AA UI-012; the mockup's amber banner):
        * a month from January to this one is missing or below `completePct`, so every summed year to date is partial.
        */}
      {view && (view.ytdMissingMonths?.length ?? 0) > 0 && (
        <p data-ytd-banner="" className="mb-3 flex items-start gap-2 rounded-md bg-pill-amber px-3 py-2 text-sm font-semibold text-pill-amber-ink">
          <span aria-hidden="true">!</span>
          <span>{t.ytdBanner({ months: missingMonthsWords(view.ytdMissingMonths, figures) })}</span>
        </p>
      )}

      {view && (view.months?.length ?? 0) > 0 && (
        <MonthStatusGrid months={view.months} historyFrom={view.config?.historyFrom ?? view.months[0].month} current={view.month} onPick={onPick} />
      )}

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
          key={`${editing.membershipId}-${cellKey(editing.column.kode, editing.ytd)}`}
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
          today={today}
          monthState={view.state}
          onCancel={dismiss}
          onImported={imported}
        />
      )}

      {error && <ErrorBanner {...error} />}

      {!error && view === null && (rows
        ? <SkeletonCards count={3} label={t.loadingMonth({ month: monthLabel(month, figures) })} />
        : <SkeletonTable caption={caption} columns={tableColumns} rows={5} />)}

      {view && (
        <>
          {/* Named for a screen reader; the chips and the list say it to the eye (`kpm-owner-mobile` 2). */}
          <h2 className="sr-only">{t.dataFor({ month: monthLabel(view.month, figures) })}</h2>
          <p className="sr-only" role="status">
            {view.withData === 0
              ? t.nothingUploaded({ month: monthLabel(view.month, figures) })
              : t.withFigures({ n: view.withData, of: view.rows.length })}
          </p>

          <div className="mb-3 flex flex-col gap-2.5 lg:flex-row lg:items-center">
            {/* The switch is the table's; below 1024px it is in the member's sheet. */}
            {!rows && (
              <div className="shrink-0" data-cadence-switch="">
                <CadenceSwitch tabs={tabs} active={cadence} onSelect={setCadence} label={t.switchLabel} />
              </div>
            )}
            <FilterChips<Show>
              label={t.chipsLabel}
              active={show}
              onSelect={setShow}
              chips={[
                { key: 'all', label: t.chipAll, count: view.rows.length },
                { key: 'unreported', label: t.notReported, count: view.rows.filter(unreported).length },
                { key: 'corrected', label: t.chipCorrected, count: view.rows.filter(mended).length },
              ]}
            />
          </div>

          {/*
            * **The prototype's order** (P13.1-T7): the name, then the figures in the template's order — and the rows in
            * the order the org tree reads, which is the server's.
            */}
          {shown.length === 0 ? (
            <p className="rounded-lg bg-card px-4 py-3.5 text-base text-muted">{t.noneHere}</p>
          ) : rows ? (
            <AgentRows rows={shown} unregistered={view.unregistered ?? []} caption={caption} correctable={correctable} onOpen={setSheetFor} />
          ) : (
            <MonthGrid
              rows={shown}
              unregistered={view.unregistered ?? []}
              columns={columns}
              caption={caption}
              cadence={cadence}
              correctable={correctable}
              onCorrect={setEditing}
            />
          )}

          {/* *Belum terdaftar* (P19.5-T2 AC-5; ADR-0214 §8): how many codes the file held apart, and that they count in nothing. */}
          {(view.unregistered?.length ?? 0) > 0 && (
            <p data-unregistered-count="" className="mt-2 text-sm text-muted">{t.unregisteredCount({ n: view.unregistered.length })}</p>
          )}

          {/*
            * Where every figure came from, said once rather than on every cell (P9-T6 AC-4) — **in the client's one line, at
            * every size** (P18.9-T4 AC-2, ADR-0176 §6; the grey-text table, UI-023: 45 words), under the table or the rows,
            * where `kpm-owner-desktop` 2 writes it. Each of its three parts stays whole, so a narrow screen breaks the line
            * between them, never inside one. The dash is said as a dash, as before: a screen reader passes over the glyph.
            */}
          <p className="mt-2.5 text-xs text-muted">
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
          {/* On the table a number is the control, which nothing else says; below 1024px the row's › does. */}
          {correctable && !rows && <p className="mt-1 text-xs text-muted">{t.tapNumber}</p>}

          {/* Opened from a row only; kept open should the window widen, until it is closed and says what it saved. */}
          {sheetRow && (
            <FiguresSheet
              key={sheetRow.membershipId}
              row={sheetRow}
              columns={columns}
              month={view.month}
              revision={view.state.revision}
              correctable={correctable}
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
 * **The table's *Bulan ini | YTD* switch** (UI-139): the shared `Segmented` track, as a pill. It draws no panel of its
 * own — the table under it is the panel — so it is a group of two pressed buttons, never a `tablist` with no `tabpanel`.
 */
function CadenceSwitch({
  tabs, active, onSelect, label,
}: {
  tabs: readonly { id: Side; label: string }[];
  active: Side;
  onSelect: (cadence: Side) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-pill bg-card p-[3px]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={tab.id === active}
          onClick={() => onSelect(tab.id)}
          className={cn(
            'min-h-9 rounded-pill px-4 text-base font-semibold',
            tab.id === active ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/**
 * **The month on a phone and a tablet: one 56px row per member** (P19.2-T3 AC-1; UI-139, `kpm-owner-mobile` 2), through
 * the shared rows (`components/ui/list-rows.tsx`): the NAME in capitals, the agent code under it, and on the right this
 * month's APE — in full, as Data upload writes money (ADR-0174 §4) — or a grey *Belum dilaporkan* pill for a member
 * with nothing reported at all; **✎** after it when a figure of theirs was corrected by hand. **The whole row opens the
 * member's sheet**, with a ›: their figures as fields for somebody who may correct them in an open month, read
 * otherwise. *Replaces ADR-0178 §4's card per agent* (P18.9-T7), which ran to ~600px a member.
 *
 * *Since P19.5-T2* (ADR-0214 §8): **the *Belum terdaftar* rows follow the members**, read-only — the code, the file's
 * name and an amber *Belum terdaftar* pill — opening nothing: they are nobody's yet.
 */
function AgentRows({
  rows, unregistered, caption, correctable, onOpen,
}: {
  rows: readonly MonthRow[];
  unregistered: readonly UnregisteredRow[];
  caption: string;
  correctable: boolean;
  onOpen: (membershipId: string) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const figures = useFigureLanguage();
  return (
    <ListCard label={caption}>
      {rows.map((row) => {
        const ape = valueOf(row, APE_KODE);
        const silent = unreported(row);
        return (
          <ListRow
            key={row.membershipId}
            data-row={row.membershipId}
            title={row.name}
            caps
            meta={<span className="whitespace-nowrap font-semibold">{row.agentCode}</span>}
            onSelect={() => onOpen(row.membershipId)}
            haspopup
            ariaLabel={correctable ? t.correctFiguresFor({ name: row.name }) : t.figuresOf({ name: row.name })}
            trailing={(
              <span className="flex items-center gap-1 text-base font-semibold">
                {silent
                  ? <TonePill tone="grey">{t.notReported}</TonePill>
                  : ape.value === null
                    ? <span className="text-muted" aria-label={t.nothingReported}>—</span>
                    : <span className="whitespace-nowrap text-ink">{formatFigure('rp_million', ape.value, figures)}</span>}
                {mended(row) && (
                  <>
                    <span aria-hidden="true" className="text-sm font-bold text-navy">✎</span>
                    <span className="sr-only">{t.correctedRow}</span>
                  </>
                )}
              </span>
            )}
          />
        );
      })}
      {unregistered.map((row) => (
        <ListRow
          key={`held-${row.agentCode}`}
          data-row={`held:${row.agentCode}`}
          title={row.fileName || row.agentCode}
          caps
          meta={<span className="whitespace-nowrap font-semibold">{row.agentCode}</span>}
          trailing={<TonePill tone="amber">{t.unregistered}</TonePill>}
        />
      ))}
    </ListCard>
  );
}

/**
 * **The month from 1024px: the name and one side of the switch at a time** (P19.2-T3 AC-1; UI-139, `kpm-owner-desktop`
 * 2: *"a 'Bulan ini | YTD' switch shows 7 columns at a time instead of 15, so the table fits the page"*). *Agent* — the
 * name, its code beside it — then **the template's columns** (P19.5-T2; ADR-0214 §5) in its order, then *Active (MAA)*
 * on this month's side; the YTD side holds each column with a year to date, in the shared `YtdFigure`. **The head and the
 * name column stay in place** while the table scrolls in its own box (`sticky`), a box no taller than the window. For
 * somebody who may correct a figure, in a month that is open, every figure that can be corrected is a button that opens
 * the correction panel above the table (P9-T5): this month's in a column in force — a leaders' column on a leader's row
 * — and an uploaded year to date. **A summed year to date is never a button** (R4): it is the months'.
 *
 * - **A column before its start month** (R2, AA UI-010) reads *—*, *Berlaku mulai <bulan>* on its tooltip.
 * - **A stored value outside its column's limits** (AA UI-025) carries a red outline, *Di luar batas sejak v<n>*.
 * - **The *Belum terdaftar* rows** (ADR-0214 §8) follow the members, read-only, an amber pill where a name would be.
 */
function MonthGrid({
  rows, unregistered, columns, caption, cadence, correctable, onCorrect,
}: {
  rows: readonly MonthRow[];
  unregistered: readonly UnregisteredRow[];
  columns: readonly MonthColumn[];
  caption: string;
  cadence: Side;
  correctable: boolean;
  onCorrect: (editing: Editing) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const head = 'sticky top-0 bg-hover-row px-3 py-2.5 align-bottom text-xs font-semibold text-muted';
  const shown = cadence === 'monthly' ? columns : ytdColumns(columns);
  const cellClass = 'whitespace-nowrap px-3 py-2.5 text-right align-middle text-navy';

  /** This month's figure in a column, as the row may hold it. */
  const monthly = (row: { leader?: boolean } & Pick<MonthRow, 'values'>, column: MonthColumn) => {
    if (!column.inForce) {
      const from = t.startsIn({ month: monthLabel(column.effectiveFrom, figures) });
      return <span className="text-muted" title={from} aria-label={from} data-not-in-force="">—</span>;
    }
    // A leaders' column on an agent's row: *—*, as the file's agent rows leave it blank (ADR-0201 §2).
    if (column.rows === 'leaders' && row.leader === false) return <span className="text-muted" aria-label={t.nothingReported}>—</span>;
    return <Figure unit={column.unit} cell={valueOf(row, column.kode)} />;
  };
  /** A year to date: the shared cell — greyed when summed, amber when a month is missing. */
  const yearToDate = (row: Pick<MonthRow, 'ytd'>, column: MonthColumn) => {
    const cell = ytdOf(row, column);
    const mark = cell.provenance === 'corrected' && !cell.calculated
      ? <span aria-hidden="true" className="ml-1 text-2xs font-bold text-navy">✎</span>
      : null;
    return (
      <YtdFigure
        text={cell.value === null ? null : formatFigure(column.unit, cell.value, figures)}
        calculated={cell.calculated}
        missingMonths={cell.calculated ? column.ytdMissingMonths : []}
        mark={mark}
      />
    );
  };
  /** Whether a figure is a control: this month's in force and the row's to fill, or an uploaded year to date. */
  const canCorrect = (row: MonthRow, column: MonthColumn) => correctable && column.inForce && (cadence === 'monthly'
    ? column.rows === 'all' || row.leader
    : column.ytd === 'upload');

  return (
    <div data-month-grid="" className="max-h-[calc(100dvh-12rem)] overflow-auto rounded-lg border border-card-edge bg-card">
      <table className="relative w-full border-separate border-spacing-0 text-left text-base">
        {/* Named as it always was; which side of the switch it shows, the switch's pressed button says. */}
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(head, 'left-0 z-[2] min-w-[12rem]')}>{AGENT_COLUMN}</th>
            {shown.map((column) => (
              <th key={column.kode} scope="col" className={cn(head, 'z-[1] text-right')}>{columnHeading(column, language)}</th>
            ))}
            {cadence === 'monthly' && <th scope="col" className={cn(head, 'z-[1] text-center')}>{t.activeColumn}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.membershipId} className="lg:hover:bg-hover-row [&>td]:border-t [&>td]:border-divider">
              <td className="sticky left-0 z-[1] bg-card px-3 py-2.5">
                <span className="font-bold text-ink">{row.name}</span>{' '}
                <span className="whitespace-nowrap text-sm text-muted">{row.agentCode}</span>
              </td>
              {shown.map((column) => {
                const ytd = cadence === 'ytd';
                const cell: MetricCell = ytd ? ytdOf(row, column) : valueOf(row, column.kode);
                const drawn = ytd ? yearToDate(row, column) : monthly(row, column);
                return (
                  <td key={column.kode} data-kode={column.kode} className={cellClass}>
                    {canCorrect(row, column) ? (
                      <button
                        type="button"
                        onClick={() => onCorrect({
                          membershipId: row.membershipId, name: row.name, agentCode: row.agentCode,
                          column, ytd, current: cell,
                        })}
                        aria-label={t.correctFigure({
                          label: figureLabel(column, ytd, language),
                          name: row.name,
                          now: showFigure(column.unit, cell.value, figures, language),
                          note: cell.provenance === 'corrected' ? correctedNote(cell, figures, language) : null,
                        })}
                        className="-mx-1 rounded-sm px-1 underline-offset-2 hover:bg-secondary/[0.06] hover:underline"
                      >
                        {drawn}
                      </button>
                    ) : drawn}
                  </td>
                );
              })}
              {cadence === 'monthly' && <td className="px-3 py-2.5 text-center"><ActiveMark active={row.monthlyActiveAgent} /></td>}
            </tr>
          ))}
          {unregistered.map((row) => (
            <tr key={`held-${row.agentCode}`} data-unregistered={row.agentCode} className="[&>td]:border-t [&>td]:border-divider">
              <td className="sticky left-0 z-[1] bg-card px-3 py-2.5">
                <TonePill tone="amber">{t.unregistered}</TonePill>{' '}
                <span className="whitespace-nowrap text-sm font-semibold text-muted">{row.agentCode}</span>
                {row.fileName && <span className="block text-2xs text-muted">{t.fileSays({ name: row.fileName })}</span>}
              </td>
              {shown.map((column) => (
                <td key={column.kode} className={cellClass}>
                  {cadence === 'ytd' ? yearToDate(row, column) : monthly(row, column)}
                </td>
              ))}
              {/* Counted in nothing (ADR-0214 §8): no answer to *active*. */}
              {cadence === 'monthly' && <td className="px-3 py-2.5 text-center"><ActiveMark active={null} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * **The months from the required history on, each as complete or not** (P19.5-T2 AC-8; R5, AA UI-010, UI-016): the
 * grid starts at the history's first month — twelve before the KPM's first — and runs to the KPM's current month, each
 * *Lengkap*, *Belum lengkap* (below `completePct`) or *Belum diunggah*, and picks the month it names. **Behind the pill's
 * own disclosure**, one line until opened, so the page keeps the client's toolbar (UI-139); open while a month is not
 * complete is the reader's choice, never forced.
 */
function MonthStatusGrid({
  months, historyFrom, current, onPick,
}: {
  months: readonly MonthStatus[];
  historyFrom: string;
  current: string;
  onPick: (month: string) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const figures = useFigureLanguage();
  const open = months.filter((m) => m.status !== 'complete').length;
  const tone = (status: MonthStatus['status']): PillTone => (status === 'complete' ? 'green' : status === 'incomplete' ? 'amber' : 'grey');
  return (
    <details data-month-status="" className="mb-3 rounded-md border border-card-edge bg-card px-3 py-2 text-sm">
      <summary className="cursor-pointer font-semibold text-navy">
        {t.monthsHeading({ from: monthLabel(historyFrom, figures) })}
        {open > 0 && <span className="font-normal text-muted">{` · ${t.monthsOpen({ n: open })}`}</span>}
      </summary>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {months.map((m) => (
          <li key={m.month}>
            <button
              type="button"
              onClick={() => onPick(m.month)}
              aria-current={m.month === current ? 'true' : undefined}
              data-status={m.status}
              className={cn(
                'inline-flex min-h-9 items-center gap-1.5 rounded-pill border px-2.5 text-xs max-lg:min-h-11',
                m.month === current ? 'border-secondary font-bold' : 'border-card-edge',
              )}
            >
              <span className="font-semibold text-navy">{monthLabel(m.month, figures)}</span>
              <TonePill tone={tone(m.status)}>{t.monthStatus[m.status]}</TonePill>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
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
        // A filled template as Excel or as CSV (ADR-0184): either is read on the server, the browser opens neither.
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
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
          CONTROL_TOUCH,
          'peer-disabled:opacity-60',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring',
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
  state, month, today, monthState, onCancel, onImported,
}: {
  state: UploadState;
  month: string;
  /** The office's today, `YYYY-MM-DD`: an upload into its month carries an *as of* day (D8). */
  today: string;
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
          <Button variant="secondary" onClick={onCancel} className={CONTROL_TOUCH}>{t.dismiss}</Button>
        </div>
      </Card>
    );
  }

  return (
    <PreviewCard
      preview={state.preview}
      file={state.file}
      month={month}
      today={today}
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
  preview, file, month, today, monthState, onCancel, onImported,
}: {
  preview: UploadPreview;
  file: File;
  month: string;
  today: string;
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
   * **The *as of* day of an upload into the current month** (P19.5-T2 AC-9; D8): a day of the month, no later than
   * today, today to begin with. A month that has ended takes its final upload, with none.
   */
  const running = month === today.slice(0, 7);
  const [asOf, setAsOf] = useState(today);
  const asOfId = useId();
  const asOfHintId = useId();
  /** The preview's columns by their cell's key, for the table's heads and each cell's unit. */
  const columnOf = (kode: string, ytd: boolean): PreviewColumn | undefined =>
    (preview.columns ?? []).find((c) => c.kode === kode && c.ytd === ytd);
  const unitOf = (cell: Pick<PreviewCell, 'kode' | 'ytd'>): UploadUnit => columnOf(cell.kode, cell.ytd)?.unit ?? 'count';

  /**
   * **Figures somebody corrected by hand that the file would change** (ADR-0053). Each is replaced
   * only if ticked, and none is ticked to begin with: re-uploading a file must never undo a correction
   * unless somebody chose that, with who corrected it and why in front of them.
   */
  const corrections = preview.rows.flatMap((row) => row.cells
    .filter((c) => c.correction && (c.status === 'new' || c.status === 'changed'))
    .map((cell) => ({ row, cell, key: correctionKey(row, cell) })));
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
      onImported(await commitUpload(month, preview.revision, file, [...ticked], running ? asOf : null));
    } catch (err) {
      setRefused(toDisplayError(err));
      setConfirming(false);
    }
  };

  const { summary } = preview;
  // The rows the file would write: members, and — kept apart — the codes not registered yet (ADR-0214 §8).
  const ready = preview.rows.filter((r) => r.status === 'ready' || r.status === 'held');
  const figureColumns: FigureColumn[] = (preview.columns ?? []).map((c) => ({
    key: cellKey(c.kode, c.ytd), label: `${c.label}${c.unit === 'percent' ? ' (%)' : ''}${c.ytd ? ' YTD' : ''}`, ytd: c.ytd,
  }));
  const notes = preview.notes ?? [];
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
        {(summary.held ?? 0) > 0 && ` ${t.heldRows({ n: summary.held })}`}
      </p>

      {/*
        * **What the header says about the file's columns** (P19.5-T2 AC-3; AA UI-013, the mockup's preview card): a column
        * of the template the file lacks — *"Kolom <nama> kosong di file ini. Baris tetap diimpor."*, in amber — and a header
        * nothing stores — *"Kolom <nama> tidak dipakai lagi"*. Not refusals: the file still imports.
        */}
      {notes.length > 0 && (
        <div className="mt-2" data-column-notes="">
          <h3 className="sr-only">{t.columnNotes}</h3>
          <ul className="text-sm">
            {notes.map((note) => (
              <li
                key={`${note.code}-${note.kode ?? ''}-${note.header ?? ''}`}
                data-note={note.code}
                className={note.code === 'column_missing' ? 'font-semibold text-pill-amber-ink' : 'text-muted'}
              >
                {note.message}
              </li>
            ))}
          </ul>
        </div>
      )}
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
                column={columnOf(cell.kode, cell.ytd)}
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
          <FigureTable caption={t.wouldChange({ filename: preview.filename })} columns={figureColumns} tableClassName="min-w-[56rem]">
            {(headersOf) => ready.map((row) => (
              <Row key={row.line}>
                <Cell className="whitespace-nowrap">
                  {row.status === 'held' ? (
                    <>
                      <TonePill tone="amber">{t.unregistered}</TonePill>
                      {row.fileName && <span className="block text-2xs text-muted">{t.fileSays({ name: row.fileName })}</span>}
                    </>
                  ) : row.name}
                  {row.status !== 'held' && row.nameDiffers && (
                    <span className="block text-2xs text-muted">{t.fileSays({ name: row.fileName })}</span>
                  )}
                </Cell>
                <Cell className="whitespace-nowrap font-semibold text-muted">
                  {row.resolvedAgentCode ?? row.agentCode}
                  {row.codeRecovered && (
                    <span className="block text-2xs font-normal">{t.readFrom({ code: row.agentCode })}</span>
                  )}
                </Cell>
                {figureColumns.map((column, i) => {
                  const cell = row.cells.find((c) => cellKey(c.kode, c.ytd) === column.key);
                  return (
                    <FigureCell key={column.key} headers={headersOf(column.key)} divider={opensGroup(figureColumns, i)}>
                      {cell
                        ? <Change cell={cell} unit={unitOf(cell)} replacing={ticked.has(correctionKey(row, cell))} />
                        : <span className="text-muted" aria-label={t.leftBlank}>—</span>}
                    </FigureCell>
                  );
                })}
              </Row>
            ))}
          </FigureTable>
        </div>
      )}

      {/* D8: the current month's upload stands at a day — today unless chosen (P19.5-T2 AC-9). */}
      {canConfirm && running && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <label htmlFor={asOfId} className="text-sm font-semibold text-navy">{t.asOfLabel}</label>
          <DateField
            id={asOfId}
            value={asOf}
            min={`${month}-01`}
            max={today}
            aria-describedby={asOfHintId}
            onChange={(next) => { if (next) setAsOf(next); }}
            density="compact"
            className="max-lg:min-h-11"
          />
          <span id={asOfHintId} className="text-2xs text-muted">{t.asOfHint}</span>
        </div>
      )}

      {refused && <div className="mt-3"><ErrorBanner {...refused} /></div>}

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {canConfirm && (
          <Button onClick={confirm} disabled={confirming || nothing || monthState.locked} className={CONTROL_TOUCH}>
            {confirming ? t.importing : t.confirmImport}
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel} disabled={confirming} className={CONTROL_TOUCH}>{t.cancel}</Button>
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
function Change({ cell, unit, replacing }: { cell: PreviewCell; unit: UploadUnit; replacing: boolean }) {
  const t = useMessages(dataUploadMessages);
  const figures = useFigureLanguage();
  // A correction the file would change: kept unless ticked, and the cell says which (ADR-0053).
  if (cell.correction && !replacing) {
    return (
      <>
        <span className="text-muted">{cell.before === null ? '—' : formatFigure(unit, cell.before, figures)}</span>
        <span className="block text-2xs text-muted">{t.correctionKept}</span>
      </>
    );
  }
  if (cell.correction && replacing) {
    return (
      <>
        <span className="font-semibold text-navy">{formatFigure(unit, cell.after!, figures)}</span>
        <span className="block text-2xs text-alert">{t.replacesCorrection}</span>
      </>
    );
  }
  switch (cell.status) {
    case 'new':
      return <span className="font-semibold text-navy">{formatFigure(unit, cell.after!, figures)}</span>;
    case 'changed':
      return (
        <>
          <span className="font-semibold text-navy">{formatFigure(unit, cell.after!, figures)}</span>
          <span className="block text-2xs text-muted">{t.was({ figure: formatFigure(unit, cell.before!, figures) })}</span>
        </>
      );
    case 'unchanged':
      return <span className="text-muted">{formatFigure(unit, cell.after!, figures)}</span>;
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

/**
 * One figure somebody corrected, that the file would change — and the choice (ADR-0053).
 *
 * Everything needed to decide is on the line: what the correction made it, who, when and why, and
 * what the file says — with a note when the file's figure is **the one the correction replaced**,
 * which is how an old file uploaded again looks.
 */
function CorrectionChoice({
  name, cell, column, ticked, onChange,
}: {
  name: string;
  cell: PreviewCell;
  /** The preview's column the cell is in: its name and unit. */
  column: PreviewColumn | undefined;
  ticked: boolean;
  onChange: (on: boolean) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const detailId = useId();
  const c = cell.correction!;
  const unit: UploadUnit = column?.unit ?? 'count';
  const named = column?.label ?? cell.kode;
  const label = figureLabel({ label: { id: named, en: named } }, cell.ytd, language);
  return (
    <li className="border-b border-hairline py-2 text-sm last:border-b-0">
      <p className="font-semibold text-navy">{name} · {label}</p>
      <p id={detailId} className="text-muted">
        {t.choice({
          now: cell.before === null ? null : formatFigure(unit, cell.before, figures),
          by: c.by,
          day: c.at ? formatDayLong(c.at, figures) : null,
          reason: c.reason,
          file: formatFigure(unit, cell.after!, figures),
          // The figure the correction replaced: the file carrying it again is probably the old file.
          old: c.replacedValue !== null && c.replacedValue === cell.after,
        })}
      </p>
      <label className={cn('mt-1 inline-flex cursor-pointer items-center gap-2 text-navy', CHECK_LINE_PHONE)}>
        <input
          type="checkbox"
          className="h-4 w-4 accent-secondary"
          checked={ticked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={detailId}
        />
        <span><span className="sr-only">{t.choiceFor({ label, name })}</span>{t.replaceWithFile}</span>
      </label>
    </li>
  );
}

