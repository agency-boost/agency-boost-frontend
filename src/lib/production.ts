import { messagesIn } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { api, apiBlob } from '@/lib/api-client';

/*
 * **The office's monthly production, as Data upload reads and writes it** — **in the columns of the KPM's template**
 * since P19.5-T2 (ADR-0214 §5, §9 to §12; `functional/production-ingest.md`, *Data contract*). There are no longer six
 * metrics fixed in code: every column is the template's, by its stable `kode`, read live from `view.config.columns`.
 */

/** Which writer a figure came from. `null` when nothing has written it. */
export type Provenance = 'imported' | 'corrected' | 'self_reported';

/**
 * Which writer a figure came from, as a reader is told it (P9-T6) — in English, the catalogue's source
 * (`i18n/messages/data-upload.ts`, `provenance`; P18.10-T4): a screen reads `useMessages(dataUploadMessages)`.
 */
export const PROVENANCE_LABEL: Record<Provenance, string> = messagesIn(dataUploadMessages, SOURCE_LANGUAGE).provenance;

/** A correction by hand — who, when, why. A figure emptied by hand is `corrected` with no value. */
export interface CellCorrection { by: string | null; at: string | null; reason: string | null }

/**
 * One figure and where it came from. **`null` is not zero**: a cell nothing has written is *no data*,
 * a cell the carrier reported as nothing is `0`, and the table shows them differently.
 */
export interface MetricCell {
  value: number | null;
  provenance: Provenance | null;
  correction: CellCorrection | null;
  /**
   * **A stored value outside its column's current limits** (P19.5-T2 AC-11; AA UI-025): the version since which it has
   * been — *"Di luar batas sejak v<n>"*. Flagged, never changed. Absent or `null` within them.
   */
  outOfBounds?: { sinceVersion: number } | null;
}

/**
 * **A column's year to date** (P19.5-T2 AC-7; R4): `calculated` — the sum of the months held from January, never stored
 * and never typed — or the year to date the file uploaded (`ytd: 'upload'`), which may be corrected. Whether it is
 * *Belum lengkap* is its column's `ytdMissingMonths`.
 */
export interface YtdCell extends MetricCell {
  calculated: boolean;
}

/** *Rp juta* (stored as minor units, shown as rupiah in full), a percentage, or a count. */
export type UploadUnit = 'rp_million' | 'percent' | 'count';
/** *Dihitung dari jumlah bulan*, *Diunggah di CSV*, or *Tidak ada YTD*. */
export type YtdRule = 'sum' | 'upload' | 'none';

export interface LabelPair { id: string; en: string }

/** **A column of the KPM's template**, as the month read names it (ADR-0214 §14). */
export interface MonthColumn {
  kode: string;
  /** One of the four system columns (R1): `APE`, `POLICY_COUNT`, `RECRUITMENT`, `NEW_ACTIVE_AGENTS`. */
  system: boolean;
  label: LabelPair;
  unit: UploadUnit;
  ytd: YtdRule;
  min: number | null;
  max: number | null;
  required: boolean;
  /** `leaders`: filled on AB and AAB rows only; an agent's row reads *—*. */
  rows: 'all' | 'leaders';
  /** `YYYY-MM`: months before it read *—* for this column (R2). */
  effectiveFrom: string;
  tip: LabelPair;
  /** `effectiveFrom` is on or before the month the view is of. */
  inForce: boolean;
  /** The months its year to date lacks (R4): *Belum lengkap · <Bul> belum diunggah*. Empty is complete. */
  ytdMissingMonths: string[];
}

/** One member's month: each column's figure by kode, and each year to date. */
export interface MonthRow {
  membershipId: string;
  agentCode: string;
  name: string;
  /** This month's figure per current column, by kode. A column not in force reads empty. */
  values: Record<string, MetricCell>;
  /** The year to date per column whose `ytd` is not `none`, by kode. */
  ytd: Record<string, YtdCell>;
  /** A member of a leader class, `ab` or `aab`: the rows a leaders' column is filled on. */
  leader: boolean;
  /**
   * `MONTHLY_ACTIVE_AGENT` for the month (ADR-0054): `APE` or `POLICY_COUNT` above zero. **The server's answer, never
   * recomputed here** — one definition per metric (invariant §8). `null` is *not reported*, which is not `false`.
   */
  monthlyActiveAgent: boolean | null;
}

/** **A *Belum terdaftar* row** (ADR-0214 §8): a code no member holds yet — read-only, counted in nothing. */
export interface UnregisteredRow {
  agentCode: string;
  /** The name the file gave. */
  fileName: string;
  values: Record<string, MetricCell>;
  ytd: Record<string, YtdCell>;
}

/** Why a month is open or locked (ADR-0050; `history` P19.5-T2, ADR-0214 §11). */
export type LockReason = 'open' | 'schedule' | 'locked_by_hand' | 'reopened' | 'history';

export interface MonthState {
  month: string;
  /** A preview carries it and Confirm import sends it back; any write to the month advances it. */
  revision: number;
  locked: boolean;
  reason: LockReason;
  /** The last day the schedule leaves it open, as an office calendar day. */
  editableUntil: string;
  changedAt: string | null;
  changedBy: string | null;
  /** D8: the office day a running month's latest upload stands at, `YYYY-MM-DD`; `null` for a final one. */
  asOf?: string | null;
}

/** `UPLOAD_MONTH_COMPLETE`: never uploaded, below the share, or complete. */
export type MonthFillStatus = 'missing' | 'incomplete' | 'complete';

/** A month as complete or not, for the month grid (AA UI-010, UI-016). */
export interface MonthStatus {
  month: string;
  status: MonthFillStatus;
  members: number;
  filled: number;
}

/** **The template the columns follow** (P19.5-T1, T2; ADR-0214 §14), read live. */
export interface MonthConfig {
  templateId: string | null;
  /** `null` for the platform's own configuration. */
  templateName: string | null;
  version: number;
  columns: MonthColumn[];
  /** The required history's first month (R5): twelve before the KPM's first. The month grid starts there. */
  historyFrom: string;
  firstMonth: string;
  completePct: number;
}

export interface MonthView {
  month: string;
  rows: MonthRow[];
  /** *Belum terdaftar* rows, after the members. */
  unregistered: UnregisteredRow[];
  /** Rows holding at least one figure. Zero means nothing has been uploaded. */
  withData: number;
  state: MonthState;
  config: MonthConfig;
  completeness: MonthStatus;
  /** The months any year to date lacks: *"YTD belum lengkap: <Bul> <tahun> belum diunggah."* */
  ytdMissingMonths: string[];
  /** From `config.historyFrom` to the KPM's current month, each as complete or not. */
  months: MonthStatus[];
}

/** A template literal, as every parameterised path is: the consumer gate reads `${…}` as `:month`. */
export const readMonth = (month: string) => api<MonthView>(`/kpm/data-upload/${month}`);

// ------------------------------------------------------------------------------------------- the columns

/** The table's first column: the member, by the role every row of it holds — kept (§A.5). */
export const AGENT_COLUMN = kept('Agent');

/** **The kodes the screen itself reads** (R1): this month's APE on a phone's row. A system kode never changes. */
export const APE_KODE = 'APE';

/** A column's name in the reader's language; the ID label stands in for an empty EN one (ADR-0214 §2). */
export const columnLabel = (column: Pick<MonthColumn, 'label'>, language: Language): string =>
  (language === 'en' && column.label.en.trim() !== '' ? column.label.en : column.label.id).trim();

/**
 * **A column's heading** in the table: its name, with *(%)* for a percentage. Money is shown as rupiah in full, so its
 * heading names no unit (I-111): the file's *Rp juta* would misstate it.
 */
export const columnHeading = (column: Pick<MonthColumn, 'label' | 'unit'>, language: Language): string =>
  `${columnLabel(column, language)}${column.unit === 'percent' ? ' (%)' : ''}`;

/** Money among the units — stored in minor units, shown as rupiah in full. */
export const isMoney = (unit: UploadUnit) => unit === 'rp_million';

/** The columns with a year to date, in the template's order: the table's YTD side. */
export const ytdColumns = (columns: readonly MonthColumn[]) => columns.filter((c) => c.ytd !== 'none');

/** A cell's key in a commit's `replace`: the kode, `<KODE>_YTD` for an uploaded year to date (`cellKey`, ADR-0214 §9). */
export const cellKey = (kode: string, ytd: boolean) => (ytd ? `${kode}_YTD` : kode);

/**
 * `APE this month`, `Jumlah polis YTD` — a figure named the way a sentence names it, the column's name in the reader's
 * `language` (P18.10-T4), English when passed none.
 */
export const figureLabel = (
  column: Pick<MonthColumn, 'label'>, ytd: boolean, language: Language = SOURCE_LANGUAGE,
) => messagesIn(dataUploadMessages, language).figureLabel({ metric: columnLabel(column, language), ytd });

// ------------------------------------------------------------------------------------------- the template

/** The file to fill in, and enough about it to offer as a download. */
export interface TemplateFile {
  month: string;
  /** The template's published version the header follows (R6). */
  version: number;
  /** `<kpmCode>-agent-data-<YYYY-MM>.csv` (P19.5-T2 AC-1). */
  filename: string;
  header: string[];
  /** The whole file, ready to save. */
  file: string;
  rowCount: number;
}

export const readTemplate = (month: string) =>
  api<TemplateFile>(`/kpm/data-upload/template?month=${encodeURIComponent(month)}`);

/**
 * **The month's template as an Excel workbook** (ADR-0184): the same header and rows on its *Data* sheet, the guide on a
 * sheet of its own. Fetched with the token and saved by the screen (`saveFile`); named as the CSV is, with `.xlsx`.
 */
export const readTemplateWorkbook = (month: string) =>
  apiBlob(`/kpm/data-upload/template?month=${encodeURIComponent(month)}&format=xlsx`);

/** `0417-agent-data-2026-09.xlsx`: the server's name for the CSV, the workbook's extension (`templateFilename`). */
export const workbookFilename = (t: Pick<TemplateFile, 'filename'>) => t.filename.replace(/\.csv$/i, '.xlsx');

// ------------------------------------------------------------------------------------------- the preview

/** `not_provided` is a blank cell — it changes nothing, because a file never clears a figure. */
export type CellStatus = 'new' | 'changed' | 'unchanged' | 'not_provided' | 'refused';

export interface PreviewIssue {
  code: string;
  /** Names the column in the header's own words, and what is wrong. */
  message: string;
  /** The cell's kode, or `null` for the row. */
  kode: string | null;
  ytd: boolean | null;
}

export interface PreviewCell {
  kode: string;
  /** A `ytd: 'upload'` column's year to date (`[KODE_YTD]`). */
  ytd: boolean;
  status: CellStatus;
  /** Stored now. Money in minor units, as everywhere. */
  before: number | null;
  after: number | null;
  /** As the file has it — money in *Rp juta*. */
  raw: string | null;
  /**
   * Set when the stored figure was corrected by hand and the file would change it — replaced only if
   * whoever imports ticks it (ADR-0053).
   */
  correction: {
    by: string | null;
    at: string | null;
    reason: string | null;
    /** The figure the correction replaced: the file carrying it again is probably the old file. */
    replacedValue: number | null;
  } | null;
}

/** `held`: a code no member holds, kept apart as *Belum terdaftar* (ADR-0214 §8). */
export type PreviewRowStatus = 'ready' | 'refused' | 'held';

export interface PreviewRow {
  line: number;
  agentCode: string;
  membershipId: string | null;
  resolvedAgentCode: string | null;
  name: string | null;
  fileName: string;
  nameDiffers: boolean;
  codeRecovered: boolean;
  status: PreviewRowStatus;
  issues: PreviewIssue[];
  /** One per `columns` entry, in its order; empty when the row is refused. */
  cells: PreviewCell[];
}

export interface PreviewSummary {
  rows: number;
  ready: number;
  refused: number;
  /** *Belum terdaftar* rows held apart. */
  held: number;
  newCells: number;
  changedCells: number;
  unchangedCells: number;
  notProvidedCells: number;
  refusedCells: number;
  /** Figures corrected by hand the file would change. */
  correctionCells: number;
  notInFile: number;
}

/** A column the file is read for, in the template's order. */
export interface PreviewColumn {
  kode: string;
  ytd: boolean;
  /** The file's own header. */
  header: string;
  /** The column's name in the reader's language. */
  label: string;
  unit: UploadUnit;
}

/** What the header says about the file's columns (AA UI-013): not a refusal — the file still imports. */
export interface PreviewNote {
  code: 'column_missing' | 'column_retired' | 'column_unknown' | 'column_not_in_force';
  kode: string | null;
  header: string | null;
  message: string;
}

/** What a filled file would change. Nothing has been saved when this arrives. */
export interface UploadPreview {
  month: string;
  filename: string;
  /** The template's version the file was read against (R6). */
  templateVersion: number;
  analyticsConfig?: { templateId: string | null; version: number };
  /** A CSV, or an Excel workbook whose Data sheet was read (ADR-0184). */
  format: 'csv' | 'xlsx';
  encoding: 'utf-8' | 'windows-1252';
  delimiter: ',' | ';' | '\t';
  /** The month's revision the preview was taken against. */
  revision: number;
  columns: PreviewColumn[];
  notes: PreviewNote[];
  summary: PreviewSummary;
  rows: PreviewRow[];
}

/**
 * How a ticked correction is named in the commit's `replace` (ADR-0053): the member — or, for a held row, `held:<CODE>`
 * — and the cell's key.
 */
export const correctionKey = (row: Pick<PreviewRow, 'status' | 'membershipId' | 'agentCode'>, cell: Pick<PreviewCell, 'kode' | 'ytd'>) =>
  `${row.status === 'held' ? `held:${row.agentCode.trim().toUpperCase()}` : row.membershipId}:${cellKey(cell.kode, cell.ytd)}`;

/**
 * The file as **bytes**, in a form — a CSV or an Excel workbook (ADR-0184). `FileReader.readAsText` would decode it in
 * the browser first, and a byte the encoding cannot explain would already be U+FFFD when it reached the server that
 * knows how to read it (ADR-0052); a workbook is opened on the server only.
 */
export const previewUpload = (month: string, file: File) => {
  const form = new FormData();
  form.append('month', month);
  form.append('file', file);
  return api<UploadPreview>('/kpm/data-upload/preview', { method: 'POST', body: form });
};

/** An import, as the history lists it. Names, not ids — the server resolves them. */
export interface BatchView {
  id: string;
  month: string;
  filename: string;
  status: 'committed' | 'reverting' | 'reverted';
  /** The template's version the file was read against (R6): the history's *v<n>*. */
  templateVersion: number;
  /** D8: the office day a running month's upload stood at; `null` for a final one. */
  asOf?: string | null;
  /** *Belum terdaftar* rows it held apart. */
  heldRowCount?: number;
  rowCount: number;
  writtenRowCount: number;
  cellCount: number;
  issueCount: number;
  committedAt: string | null;
  committedBy: string | null;
  revertedAt: string | null;
  revertedBy: string | null;
  restoredCellCount: number;
  keptCellCount: number;
  keptCorrectionCount: number;
  replacedCorrectionCount: number;
  /** The month's latest standing import — the only one revert takes. */
  canRevert: boolean;
}

export interface ImportResult {
  batch: BatchView;
  state: MonthState;
}

/**
 * **Confirm import.** The same file again, with the revision its preview was taken against — the
 * server reads it afresh and refuses it if the month has moved since (P9-T4). An upload into the current month carries
 * its *as of* day (D8; P19.5-T2 AC-9), today when none is chosen.
 */
export const commitUpload = (
  month: string, revision: number, file: File, replace: readonly string[] = [], asOf?: string | null,
) => {
  const form = new FormData();
  form.append('month', month);
  form.append('revision', String(revision));
  // The corrections by hand to replace, `membershipId:KODE`; none named, every one stays (ADR-0053).
  if (replace.length) form.append('replace', replace.join(','));
  if (asOf) form.append('asOf', asOf);
  form.append('file', file);
  return api<ImportResult>('/kpm/data-upload/commit', { method: 'POST', body: form });
};

export const revertImport = (batchId: string) =>
  api<ImportResult>('/kpm/data-upload/revert', { method: 'POST', body: { batchId } });

export const readHistory = (month: string) =>
  api<{ month: string; batches: BatchView[] }>(`/kpm/data-upload/history?month=${encodeURIComponent(month)}`);

export const lockMonth = (month: string) =>
  api<MonthState>(`/kpm/data-upload/months/${month}/lock`, { method: 'POST' });

export const reopenMonth = (month: string) =>
  api<MonthState>(`/kpm/data-upload/months/${month}/reopen`, { method: 'POST' });

/**
 * One figure, corrected by hand — the unit it is stored in, money in sen; `null` clears it (P9-T5). By the column's
 * `kode`; `ytd` only for a column whose year to date is uploaded — a summed one is calculated (P19.5-T2; R4).
 */
export interface CorrectionInput {
  month: string;
  membershipId: string;
  kode: string;
  ytd: boolean;
  value: number | null;
  /** The month's revision the reader saw: a month that moved since refuses the correction. */
  revision: number;
  reason: string;
}

export interface CorrectionResult {
  membershipId: string;
  kode: string;
  ytd: boolean;
  /** `false` when the figure already held that value — nothing was written. */
  changed: boolean;
  before: Pick<MetricCell, 'value' | 'provenance'> & Partial<MetricCell>;
  after: Pick<MetricCell, 'value' | 'provenance'> & Partial<MetricCell>;
  state: MonthState;
}

export const correctCell = (input: CorrectionInput) =>
  api<CorrectionResult>('/kpm/data-upload/cell', { method: 'PATCH', body: input });

/** The UTF-8 byte-order mark, percent-encoded: `EF BB BF`. */
const UTF8_BOM = '%EF%BB%BF';

/**
 * A `data:` URL for an `<a download>`, which is how the roster template is offered too.
 *
 * Not `URL.createObjectURL`: the prototype uses it and it works, but a blob URL has to be revoked
 * and jsdom does not implement it, so the one control on this screen that saves a file would be the
 * one control no test could exercise. A `data:` URL is inert until clicked and needs no cleanup.
 *
 * **The saved file opens with a byte-order mark**, so a spreadsheet on Windows reads the header's own words — a
 * column's Indonesian name — in UTF-8 and not the machine's own code page.
 */
export const templateHref = (t: TemplateFile) =>
  `data:text/csv;charset=utf-8,${UTF8_BOM}${encodeURIComponent(t.file)}`;
