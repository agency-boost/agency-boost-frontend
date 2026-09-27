import { api } from '@/lib/api-client';

/** Which writer a figure came from. `null` when nothing has written it. */
export type Provenance = 'imported' | 'corrected' | 'self_reported';

/**
 * One figure and where it came from. **`null` is not zero**: a cell nothing has written is *no data*,
 * a cell the carrier reported as nothing is `0`, and the table shows them differently.
 */
export interface MetricCell {
  value: number | null;
  provenance: Provenance | null;
}

export const PRODUCTION_METRICS = [
  'ape', 'persistency', 'recruitment', 'newActiveAgents', 'fyp', 'policyCount',
] as const;
export type ProductionMetric = (typeof PRODUCTION_METRICS)[number];

/** The prototype's own column labels (`KPM_Owner.html:1293`), minus its unit suffix. */
export const METRIC_LABEL: Record<ProductionMetric, string> = {
  ape: 'APE',
  persistency: 'Rolling persistency',
  recruitment: 'Recruitment',
  newActiveAgents: 'New active agents',
  fyp: 'FYP',
  policyCount: '# of policy',
};

/** Money among them — stored in minor units, shown as rupiah in full. */
export const MONEY_METRICS: readonly ProductionMetric[] = ['ape', 'fyp'];

export interface MonthRow {
  membershipId: string;
  agentCode: string;
  name: string;
  metrics: Record<ProductionMetric, { monthly: MetricCell; ytd: MetricCell }>;
}

export interface MonthView {
  month: string;
  rows: MonthRow[];
  /** Rows holding at least one figure. Zero means nothing has been uploaded. */
  withData: number;
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
