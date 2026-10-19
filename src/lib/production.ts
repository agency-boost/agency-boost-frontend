import { api } from '@/lib/api-client';

/** Which writer a figure came from. `null` when nothing has written it. */
export type Provenance = 'imported' | 'corrected' | 'self_reported';

/**
 * One figure and where it came from. **`null` is not zero**: a cell nothing has written is *no data*,
 * a cell the carrier reported as nothing is `0`, and the table shows them differently.
 */
/** Which writer a figure came from, as a reader is told it (P9-T6). */
export const PROVENANCE_LABEL: Record<'imported' | 'corrected' | 'self_reported', string> = {
  imported: 'the carrier’s file',
  corrected: 'corrected by hand',
  self_reported: 'the agent’s own figure',
};

export interface MetricCell {
  value: number | null;
  provenance: Provenance | null;
  /** A correction by hand — who, when, why. A figure emptied by hand is `corrected` with no value. */
  correction: { by: string | null; at: string | null; reason: string | null } | null;
}

/**
 * The six metrics, **in the prototype's order** (`METRIC_KEYS`, `KPM_Owner.html:4679`) — the order of
 * the table's columns within each group, and of the template's within each cadence. The backend's
 * `PRODUCTION_METRICS` is the same list; `production.spec.ts` reads it to hold the two together.
 */
export const PRODUCTION_METRICS = [
  'ape', 'persistency', 'recruitment', 'newActiveAgents', 'fyp', 'policyCount',
] as const;
export type ProductionMetric = (typeof PRODUCTION_METRICS)[number];

/**
 * A metric as a sentence names it — *Correct APE this month for Rina Wijaya* — after the prototype's
 * own subtitle (`KPM_Owner.html:1293`), minus its unit suffix. The table's headings are
 * `METRIC_COLUMN_LABEL`.
 */
export const METRIC_LABEL: Record<ProductionMetric, string> = {
  ape: 'APE',
  persistency: 'Rolling persistency',
  recruitment: 'Recruitment',
  newActiveAgents: 'New active agents',
  fyp: 'FYP',
  policyCount: '# of policy',
};

/**
 * The table's column headings: the prototype's `METRIC_LABELS` (`KPM_Owner.html:4680`), verbatim but
 * for APE's and FYP's *(Rp M)*. The table shows rupiah in full (I-111), and a heading that said
 * millions over a figure in rupiah would misstate it; the file keeps *(Rp M)*, because it is in
 * millions (`production-template.ts`). Persistency keeps its *(%)*, which is true of both.
 */
export const METRIC_COLUMN_LABEL: Record<ProductionMetric, string> = {
  ape: 'APE',
  persistency: 'Rolling Persistency (%)',
  recruitment: 'Recruitment',
  newActiveAgents: 'New Active Agents',
  fyp: 'FYP',
  policyCount: '# of Policy',
};

/**
 * **This month's six, then the same six for the year** — the prototype's two groups, in its order and
 * its words (`KPM_Owner.html:4840-4842`), and the template's (`:4683`, *"Monthly columns come first,
 * then the same 6 metrics again as annual (YTD) figures"*).
 */
export const CADENCES = ['monthly', 'ytd'] as const;
export const CADENCE_GROUP_LABEL: Record<Cadence, string> = { monthly: 'This Month', ytd: 'YTD' };

/** The twelve figures in the order the table draws them and the template lists them (P13.1-T7). */
export const FIGURE_COLUMNS: readonly { cadence: Cadence; metric: ProductionMetric }[] = CADENCES.flatMap(
  (cadence) => PRODUCTION_METRICS.map((metric) => ({ cadence, metric })),
);

/** Money among them — stored in minor units, shown as rupiah in full. */
export const MONEY_METRICS: readonly ProductionMetric[] = ['ape', 'fyp'];

export interface MonthRow {
  membershipId: string;
  agentCode: string;
  name: string;
  metrics: Record<ProductionMetric, { monthly: MetricCell; ytd: MetricCell }>;
  /**
   * `MONTHLY_ACTIVE_AGENT` for the month (ADR-0054): APE or a policy above zero. **The server's
   * answer, never recomputed here** — one definition per metric (invariant §8). `null` is *not
   * reported*, which is not `false`.
   */
  monthlyActiveAgent: boolean | null;
}

/** Why a month is open or locked (ADR-0050). */
export type LockReason = 'open' | 'schedule' | 'locked_by_hand' | 'reopened';

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
}

export interface MonthView {
  month: string;
  rows: MonthRow[];
  /** Rows holding at least one figure. Zero means nothing has been uploaded. */
  withData: number;
  state: MonthState;
}

/** A template literal, as every parameterised path is: the consumer gate reads `${…}` as `:month`. */
export const readMonth = (month: string) => api<MonthView>(`/kpm/data-upload/${month}`);

/** The file to fill in, and enough about it to offer as a download. */
export interface TemplateFile {
  month: string;
  /** The header is the version — there is no version line, and an importer matches its cells. */
  version: number;
  filename: string;
  header: string[];
  /** The whole file, ready to save. */
  file: string;
  rowCount: number;
}

export const readTemplate = (month: string) =>
  api<TemplateFile>(`/kpm/data-upload/template?month=${encodeURIComponent(month)}`);

export type Cadence = 'monthly' | 'ytd';

/** `not_provided` is a blank cell — it changes nothing, because a file never clears a figure. */
export type CellStatus = 'new' | 'changed' | 'unchanged' | 'not_provided' | 'refused';

export interface PreviewIssue {
  code: string;
  /** Names the column in the header's own words, and what is wrong. */
  message: string;
  metric: ProductionMetric | null;
  cadence: Cadence | null;
}

export interface PreviewCell {
  metric: ProductionMetric;
  cadence: Cadence;
  status: CellStatus;
  /** Stored now. Money in minor units, as everywhere. */
  before: number | null;
  after: number | null;
  /** As the file has it — money in Rp M. */
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

export interface PreviewRow {
  line: number;
  agentCode: string;
  membershipId: string | null;
  resolvedAgentCode: string | null;
  name: string | null;
  fileName: string;
  nameDiffers: boolean;
  codeRecovered: boolean;
  status: 'ready' | 'refused';
  issues: PreviewIssue[];
  cells: PreviewCell[];
}

export interface PreviewSummary {
  rows: number;
  ready: number;
  refused: number;
  newCells: number;
  changedCells: number;
  unchangedCells: number;
  notProvidedCells: number;
  refusedCells: number;
  /** Figures corrected by hand the file would change. */
  correctionCells: number;
  notInFile: number;
}

/** What a filled file would change. Nothing has been saved when this arrives. */
export interface UploadPreview {
  month: string;
  filename: string;
  templateVersion: number;
  encoding: 'utf-8' | 'windows-1252';
  delimiter: ',' | ';' | '\t';
  /** The month's revision the preview was taken against. */
  revision: number;
  summary: PreviewSummary;
  rows: PreviewRow[];
}

/**
 * The file as **bytes**, in a form. `FileReader.readAsText` — what the roster import does — would
 * decode it in the browser first, and a byte the encoding cannot explain would already be U+FFFD
 * when it reached the server that knows how to read it (ADR-0052).
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
  templateVersion: number;
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
 * server reads it afresh and refuses it if the month has moved since (P9-T4).
 */
export const commitUpload = (month: string, revision: number, file: File, replace: readonly string[] = []) => {
  const form = new FormData();
  form.append('month', month);
  form.append('revision', String(revision));
  // The corrections by hand to replace, `membershipId:field`; none named, every one stays (ADR-0053).
  if (replace.length) form.append('replace', replace.join(','));
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

/** One figure, corrected by hand — the unit it is stored in, money in sen; `null` clears it (P9-T5). */
export interface CorrectionInput {
  month: string;
  membershipId: string;
  metric: ProductionMetric;
  cadence: Cadence;
  value: number | null;
  /** The month's revision the reader saw: a month that moved since refuses the correction. */
  revision: number;
  reason: string;
}

export interface CorrectionResult {
  membershipId: string;
  metric: ProductionMetric;
  cadence: Cadence;
  /** `false` when the figure already held that value — nothing was written. */
  changed: boolean;
  before: MetricCell;
  after: MetricCell;
  state: MonthState;
}

export const correctCell = (input: CorrectionInput) =>
  api<CorrectionResult>('/kpm/data-upload/cell', { method: 'PATCH', body: input });

/** `APE this month`, `# of policy year to date` — a figure named the way a sentence names it. */
export const figureLabel = (metric: ProductionMetric, cadence: Cadence) =>
  `${METRIC_LABEL[metric]} ${cadence === 'monthly' ? 'this month' : 'year to date'}`;

/** The UTF-8 byte-order mark, percent-encoded: `EF BB BF`. */
const UTF8_BOM = '%EF%BB%BF';

/**
 * A `data:` URL for an `<a download>`, which is how the roster template is offered too.
 *
 * Not `URL.createObjectURL`: the prototype uses it and it works, but a blob URL has to be revoked
 * and jsdom does not implement it, so the one control on this screen that saves a file would be the
 * one control no test could exercise. A `data:` URL is inert until clicked and needs no cleanup.
 *
 * **The saved file opens with a byte-order mark.** Twelve of the fourteen headings carry an em dash,
 * and a spreadsheet on Windows reads a `.csv` with no mark in the machine's own code page — so every
 * one of them would read `â€”`. The prototype's file has the same defect (`KPM_Owner.html:4717`).
 * The mark is added here, where text becomes bytes, and not in the API's `file`: that is a string,
 * and its first line is the header.
 */
export const templateHref = (t: TemplateFile) =>
  `data:text/csv;charset=utf-8,${UTF8_BOM}${encodeURIComponent(t.file)}`;
