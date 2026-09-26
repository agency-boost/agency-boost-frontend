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
