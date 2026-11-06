import { api } from './api-client';

/**
 * **The KPM's *Advanced analytics* page, as the app reads it** (P19.5-T3; ADR-0215; `functional/advanced-analytics.md`,
 * *Data contract*): the shell, *Demografi KPM*, *MAPA driver*, *Analitik kuantitatif*, *Perbaikan sub-group* and
 * *Event*, and the two targets. *NPS* and *Kualitatif* are `lib/surveys.ts`'s. Every figure, band, median and default
 * is the server's; this mirrors the shapes and holds no constant of its own (invariant §7).
 *
 * **The Super Admin's *Lihat sebagai KPM*** reads the same sections through `/admin/tenants/:id/advanced-analytics`
 * (ADR-0215 §9): each read takes the KPM's id when it is one, and the answer is the Owner's, `canWrite` false.
 */

export type SectionSlug = 'demographics' | 'mapa' | 'nps' | 'quant' | 'qual' | 'subgroup' | 'events';
export const SECTION_SLUGS: readonly SectionSlug[] = ['demographics', 'mapa', 'nps', 'quant', 'qual', 'subgroup', 'events'];
export const isSectionSlug = (value: string | undefined | null): value is SectionSlug =>
  value !== undefined && value !== null && (SECTION_SLUGS as readonly string[]).includes(value);

export interface Shell {
  templateName: string | null;
  version: number;
  sections: { kode: string; slug: SectionSlug }[];
  canWrite: boolean;
  canUpload: boolean;
}

export interface AbOption { membershipId: string; name: string }

export interface DimensionCount {
  key: string;
  count: number;
  from?: number | null;
  to?: number | null;
  label?: string;
}

export interface Demographics {
  month: string;
  ab: AbOption | null;
  abs: AbOption[];
  manpower: number;
  role: DimensionCount[];
  workStatus: DimensionCount[];
  gender: DimensionCount[];
  ageBand: DimensionCount[];
  tenureBand: DimensionCount[];
}

export interface EventsNps {
  period: { kind: 'ytd' | 'month'; from: string; to: string };
  ab: AbOption | null;
  abs: AbOption[];
  kpm: { nps: number | null; average: number | null; n: number };
  events: { eventId: string; title: string; startsOn: string; nps: number | null; average: number | null; n: number }[];
}

export type MapaRowKey =
  | 'ape' | 'manpower' | 'flc' | 'producing_agents' | 'new_agent_3m' | 'avg_monthly_aa' | 'case_submission'
  | 'cases_per_producing_agent' | 'average_case_size';
export type MapaCell = { kind: 'figure'; value: number } | { kind: 'pending' | 'none' | 'blocked' | 'not_uploaded' | 'future' };

export interface MapaRow {
  row: MapaRowKey;
  unit: 'idr_minor' | 'count' | 'percentage' | 'ratio';
  monthly: boolean;
  targetable: boolean;
  months: { month: string; value: MapaCell; lastYear: MapaCell; target: number | null; joined?: number }[];
  ytd: MapaCell;
  ytdLastYear: MapaCell;
}

export interface Mapa {
  year: string;
  through: string;
  ytdMissingMonths: string[];
  ytdLastYearMissingMonths: string[];
  rows: MapaRow[];
  canWrite: boolean;
}

export type PeerStatus = 'above' | 'in_line' | 'below';

export interface QuantMetric {
  code: string;
  metric: string;
  value: number | null;
  complete: boolean;
  missingMonths: string[];
  reason: 'no_leader' | 'not_enough_data' | null;
  median: number | null;
  peers: number;
  status: PeerStatus | null;
}

export interface Quant {
  periodEnd: string | null;
  runs: string[];
  freezesAt: string | null;
  frozenAt: string | null;
  lateWriteAt: string | null;
  needed: number;
  bands: { peerBandPct: number; diffBand: number };
  metrics: QuantMetric[];
}

export interface SubgroupRow {
  head: AbOption;
  manpower: number;
  leaders: number;
  maa: { baseline: number | null; lastMonth: number | null; mtd: number | null; asOf: string | null };
  targets: { aa: number; rec: number; isDefault: boolean };
  adoption: { headDays: number; downlinePct: number | null };
  powerUsers: number;
  oneOnOnesPerWeek: number;
  weeklyActivityTarget: number;
  recruitment: { baseline: number | null; ytd: number | null; missingMonths: string[] };
  attainment: { aaPct: number | null; aaOk: boolean | null; recPct: number | null; recOk: boolean | null };
}

export interface Subgroup {
  month: string;
  thresholds: { okPct: number; powerUserDays: number; powerUserWindow: number };
  rows: SubgroupRow[];
  canWrite: boolean;
}

/** A section's query: each section reads the ones it takes, and the server refuses any other by name. */
export interface SectionQuery {
  month?: string;
  ab?: string;
  year?: string;
  periodEnd?: string;
}

/** The query's parameters, `a=1&b=2` — after a literal `?`, so the address stays a path the API gates can read. */
const queryOf = (query: SectionQuery): string => Object.entries(query)
  .filter(([, v]) => v !== undefined && v !== '')
  .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
  .join('&');

/** The tabs: the KPM's own, or a KPM's for the Super Admin (`platformKpmId`). */
export function readShell(platformKpmId?: string): Promise<Shell> {
  return platformKpmId === undefined
    ? api<Shell>('/kpm/advanced-analytics')
    : api<Shell>(`/admin/tenants/${encodeURIComponent(platformKpmId)}/advanced-analytics`);
}

/** One section's read, the KPM's own or a KPM's for the Super Admin. */
function readSection<T>(section: 'demographics' | 'mapa' | 'quant' | 'subgroup' | 'events', query: SectionQuery, platformKpmId?: string): Promise<T> {
  const q = queryOf(query);
  if (platformKpmId !== undefined) {
    return api<T>(`/admin/tenants/${encodeURIComponent(platformKpmId)}/advanced-analytics/${section}?${q}`);
  }
  switch (section) {
    case 'demographics': return api<T>(`/kpm/advanced-analytics/demographics?${q}`);
    case 'mapa': return api<T>(`/kpm/advanced-analytics/mapa?${q}`);
    case 'quant': return api<T>(`/kpm/advanced-analytics/quant?${q}`);
    case 'subgroup': return api<T>(`/kpm/advanced-analytics/subgroup?${q}`);
    case 'events': return api<T>(`/kpm/advanced-analytics/events?${q}`);
  }
}

export const readDemographics = (query: { month?: string; ab?: string }, platformKpmId?: string) =>
  readSection<Demographics>('demographics', query, platformKpmId);
export const readMapa = (query: { year?: string }, platformKpmId?: string) => readSection<Mapa>('mapa', query, platformKpmId);
export const readQuant = (query: { periodEnd?: string }, platformKpmId?: string) => readSection<Quant>('quant', query, platformKpmId);
export const readSubgroup = (platformKpmId?: string) => readSection<Subgroup>('subgroup', {}, platformKpmId);
export const readEventsNps = (query: { month?: string; ab?: string }, platformKpmId?: string) =>
  readSection<EventsNps>('events', query, platformKpmId);

/** *MAPA driver*'s target: a month, a row, the value in the row's unit — or `null`, *TBD*. */
export const saveMapaTarget = (month: string, row: MapaRowKey, value: number | null) =>
  api<{ month: string; row: string; value: number | null }>('/kpm/advanced-analytics/targets/mapa', { method: 'PUT', body: { month, row, value } });

/** A head of group's AA and recruitment targets. */
export const saveSubgroupTarget = (headMembershipId: string, aaTarget: number, recTarget: number) =>
  api<{ headMembershipId: string; aaTarget: number; recTarget: number }>(
    `/kpm/advanced-analytics/targets/subgroup/${encodeURIComponent(headMembershipId)}`,
    { method: 'PUT', body: { aaTarget, recTarget } },
  );

/** The month a page opens on: `YYYY-MM` from the address when it is one, else the server's default. */
export function monthFrom(value: string | undefined): string | undefined {
  return value !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : undefined;
}
