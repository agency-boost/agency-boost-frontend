import type {
  MetricCell, MonthColumn, MonthConfig, MonthRow, MonthStatus, MonthView, PreviewCell, PreviewColumn, UploadUnit, YtdCell,
} from '@/lib/production';

/*
 * **Data upload's fixtures** (P19.5-T2): a month read as the server answers it since the Data upload took its columns
 * from the KPM's template (ADR-0214 §5, §14) — version 1's seven columns, the backend's `v1UploadFields` — and the
 * adapter that lets a spec still describe a member's month by the six metrics' old names (`ape.monthly`), which is how
 * most of Data upload's specs were written and what a reader of them recognises.
 */

export const column = (
  kode: string, id: string, en: string, unit: UploadUnit, ytd: MonthColumn['ytd'],
  over: Partial<MonthColumn> = {},
): MonthColumn => ({
  kode,
  system: ['APE', 'POLICY_COUNT', 'RECRUITMENT', 'NEW_ACTIVE_AGENTS'].includes(kode),
  label: { id, en },
  unit,
  ytd,
  min: 0,
  max: unit === 'percent' ? 100 : null,
  required: false,
  rows: 'all',
  effectiveFrom: '2024-01',
  tip: { id: '', en: '' },
  inForce: true,
  ytdMissingMonths: [],
  ...over,
});

/** **Version 1's seven columns**, as `backend/src/modules/config/analytics-config.ts` `v1UploadFields` writes them. */
export const V1_COLUMNS: readonly MonthColumn[] = [
  column('APE', 'APE', 'APE', 'rp_million', 'sum'),
  column('PERSISTENCY', 'Persistensi rolling', 'Rolling persistency', 'percent', 'none'),
  column('RECRUITMENT', 'Rekrutmen', 'Recruitment', 'count', 'sum'),
  column('NEW_ACTIVE_AGENTS', 'Agen aktif baru', 'New active agents', 'count', 'sum'),
  column('FYP', 'FYP', 'FYP', 'rp_million', 'sum'),
  column('POLICY_COUNT', 'Jumlah polis (case issued)', '# of policy (case issued)', 'count', 'sum'),
  column('UNIT_PERSISTENCY', 'Unit persistency', 'Unit persistency', 'percent', 'none', { rows: 'leaders' }),
];

/** A custom column the template added, starting after the month a spec reads: *Komisi tahun pertama* `FYC` (AT-1). */
export const FYC_FROM_DEC = column('FYC', 'Komisi tahun pertama', 'First-year commission', 'rp_million', 'sum', {
  effectiveFrom: '2026-12', inForce: false,
});

/**
 * A custom column whose year to date the carrier uploads (`ytd: 'upload'`, ADR-0214 §5): *Komisi* `KOMISI`, in *Rp juta*
 * — the only kind of year to date a file carries and a person corrects since P19.5-T2.
 */
export const KOMISI = column('KOMISI', 'Komisi', 'Commission', 'rp_million', 'upload');
/** And a count whose year to date the carrier uploads: *Kasus* `CASES`. */
export const CASES = column('CASES', 'Kasus', 'Cases', 'count', 'upload');

/** The six metrics' old names, each as the kode version 1 gives it (`KODE_OF_CELL`). */
export const KODE_OF: Record<string, string> = {
  ape: 'APE',
  persistency: 'PERSISTENCY',
  recruitment: 'RECRUITMENT',
  newActiveAgents: 'NEW_ACTIVE_AGENTS',
  fyp: 'FYP',
  policyCount: 'POLICY_COUNT',
  unitPersistency: 'UNIT_PERSISTENCY',
};

const EMPTY: MetricCell = { value: null, provenance: null, correction: null };
const asCell = (c: Partial<MetricCell> | undefined): MetricCell => ({ ...EMPTY, ...(c ?? {}) });

/**
 * **A member's month from the old shape** — `metrics: { ape: { monthly, ytd } … }` and `unitPersistency` — as the month
 * read answers it now: `values` by kode for every column, and `ytd` by kode for each column with a year to date, a
 * summed one `calculated`. A column whose year to date is `none` (a persistency) drops its old YTD.
 */
export function rowOf(
  legacy: {
    membershipId: string; agentCode: string; name: string;
    /** By the six metrics' old names (or a custom column's kode): `{ monthly, ytd }`, each a cell's fields. */
    metrics?: Record<string, unknown>;
    unitPersistency?: unknown;
    leader?: boolean;
    monthlyActiveAgent?: boolean | null;
    values?: Record<string, MetricCell>;
    ytd?: Record<string, YtdCell>;
  },
  columns: readonly MonthColumn[] = V1_COLUMNS,
): MonthRow {
  if (legacy.values) {
    return {
      membershipId: legacy.membershipId, agentCode: legacy.agentCode, name: legacy.name, values: legacy.values,
      ytd: legacy.ytd ?? {}, leader: legacy.leader ?? false, monthlyActiveAgent: legacy.monthlyActiveAgent ?? null,
    };
  }
  const values: Record<string, MetricCell> = {};
  const ytd: Record<string, YtdCell> = {};
  for (const c of columns) {
    // A custom column is named by its kode: `metrics.KOMISI`.
    const name = Object.keys(KODE_OF).find((k) => KODE_OF[k] === c.kode) ?? c.kode;
    const pair = legacy.metrics?.[name] as { monthly?: Partial<MetricCell>; ytd?: Partial<MetricCell> } | undefined;
    values[c.kode] = c.kode === 'UNIT_PERSISTENCY' ? asCell(legacy.unitPersistency as Partial<MetricCell> | undefined) : asCell(pair?.monthly);
    if (c.ytd !== 'none') ytd[c.kode] = { ...asCell(pair?.ytd), calculated: c.ytd === 'sum' };
  }
  return {
    membershipId: legacy.membershipId, agentCode: legacy.agentCode, name: legacy.name, values, ytd,
    leader: legacy.leader ?? false, monthlyActiveAgent: legacy.monthlyActiveAgent ?? null,
  };
}

/** The template a month follows: version 1 of the Prudential template, its history from Sep 2025. */
export function configOf(over: Partial<MonthConfig> = {}): MonthConfig {
  return {
    templateId: 'tpl-pru', templateName: 'Prudential template', version: 1, columns: [...V1_COLUMNS],
    historyFrom: '2025-09', firstMonth: '2026-09', completePct: 90, ...over,
  };
}

/** A month status, complete unless said. */
export const statusOf = (month: string, status: MonthStatus['status'] = 'complete'): MonthStatus =>
  ({ month, status, members: 2, filled: status === 'complete' ? 2 : 0 });

/**
 * **A month read as the server answers it** (ADR-0214 §14), from rows in either shape: version 1's columns, no *Belum
 * terdaftar* row, nothing missing, and no month grid unless given.
 */
export function viewOf(
  rows: readonly Parameters<typeof rowOf>[0][],
  withData: number,
  month: string,
  state: unknown,
  over: Partial<MonthView> = {},
): MonthView {
  const config = over.config ?? configOf();
  return {
    month,
    rows: rows.map((r) => rowOf(r, config.columns)),
    unregistered: [],
    withData,
    state: state as MonthView['state'],
    config,
    completeness: statusOf(month),
    ytdMissingMonths: [],
    months: [],
    ...over,
  };
}

/** The columns a version 1 file is read for: this month's six (a summed YTD is never in a file, R4). */
export const V1_FILE_COLUMNS: readonly PreviewColumn[] = V1_COLUMNS
  .filter((c) => c.kode !== 'UNIT_PERSISTENCY')
  .map((c) => ({ kode: c.kode, ytd: false, header: c.label.en, label: c.label.en, unit: c.unit }));

/** And a version 2 file's: version 1's six and *Unit persistency*. */
export const V2_FILE_COLUMNS: readonly PreviewColumn[] = V1_COLUMNS
  .map((c) => ({ kode: c.kode, ytd: false, header: c.label.en, label: c.label.en, unit: c.unit }));

/** A preview row's cells, one per column, not provided unless given — keyed by the old names, `ape`, `policyCount`. */
export function cellsOf(
  given: Record<string, Partial<PreviewCell>> = {},
  columns: readonly PreviewColumn[] = V1_FILE_COLUMNS,
): PreviewCell[] {
  return columns.map((c) => {
    const name = Object.keys(KODE_OF).find((k) => KODE_OF[k] === c.kode) ?? c.kode;
    return {
      kode: c.kode, ytd: c.ytd, status: 'not_provided', before: null, after: null, raw: null, correction: null,
      ...given[name],
    };
  });
}
