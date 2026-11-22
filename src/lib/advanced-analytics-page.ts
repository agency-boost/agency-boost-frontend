import { api } from './api-client';

/**
 * **The KPM's *Advanced analytics* page, as the app reads it** (P19.5-T3, P19.22; ADR-0215, ADR-0275;
 * `functional/advanced-analytics.md`, *Data contract*): the shell, *Demografi* with its list and upload, *MAPA driver*,
 * *Analisa kuantitatif*, *Informal group* with its sheets, and *Event*. *NPS* and *Kualitatif* are `lib/surveys.ts`'s.
 * Every figure, band, median, colour and target is the server's; this mirrors the shapes and holds no constant of its own
 * (invariant §7).
 *
 * **The Super Admin's *Lihat sebagai KPM*** reads the same sections through `/admin/tenants/:id/advanced-analytics`
 * (ADR-0215 §9): each read takes the KPM's id when it is one, and the answer is the Owner's, nothing writable.
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

/** A person as a row draws them: the name in capitals, the orange *AB* / *AAB* before it, the photo. */
export interface PersonRef {
  membershipId: string;
  name: string;
  photoUrl: string | null;
  /** `ab`, `aab` or `agent`. */
  role: string;
}

/** A colour the server picked by progress: green from 100 %, yellow from 67 %, red below. */
export type Tone = 'green' | 'yellow' | 'red';

// ---------------------------------------------------------------------------------------------------- Demografi

export interface DimensionCount {
  key: string;
  count: number;
  from?: number | null;
  to?: number | null;
  label?: string;
}

export type DemographicField = 'workStatus' | 'dateOfBirth' | 'joinDate';

export interface FieldCompleteness {
  field: DemographicField;
  filled: number;
  of: number;
  pct: number | null;
  leaderPct: number | null;
  agentPct: number | null;
}

export interface DemographicsMember extends PersonRef {
  agentCode: string | null;
  uplineName: string | null;
  workStatus: 'full_time' | 'part_time' | null;
  ageBand: 'gen_z' | 'gen_y' | 'gen_x' | null;
  joinDate: string | null;
  missing: DemographicField[];
  phone: string | null;
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
  asOf: string;
  summary: { manpower: number; complete: number; incomplete: number; completePct: number | null; incompletePct: number | null };
  completeness: FieldCompleteness[];
  members: DemographicsMember[];
  left: number;
  canUpload: boolean;
}

export interface DemographicsFile { filename: string; file: string }

export interface DemographicsUploadResult {
  updated: number;
  unchanged: number;
  skipped: number;
  rows: {
    line: number;
    agentCode: string;
    name: string | null;
    status: 'updated' | 'unchanged' | 'not_found' | 'not_yours' | 'invalid';
    fields: DemographicField[];
    problems: { field: DemographicField; value: string }[];
  }[];
}

// ---------------------------------------------------------------------------------------------------- Event

export interface EventsNps {
  period: { kind: 'ytd' | 'month'; from: string; to: string };
  ab: AbOption | null;
  abs: AbOption[];
  kpm: { nps: number | null; average: number | null; n: number };
  events: { eventId: string; title: string; startsOn: string; nps: number | null; average: number | null; n: number }[];
}

// ---------------------------------------------------------------------------------------------------- MAPA

export type MapaRowKey =
  | 'ape' | 'manpower' | 'rekrut' | 'active_agent' | 'new_agent_3m' | 'policies' | 'policies_per_active_agent' | 'average_case_size';
export type MapaGroup = 'ape' | 'manpower' | 'activation' | 'productivity' | 'case_size';
export type MapaUnit = 'idr_minor' | 'count' | 'percentage' | 'ratio';
export interface MapaChange { value: number | null; kind: 'pct' | 'points' }

export interface MapaRow {
  key: MapaRowKey;
  group: MapaGroup;
  unit: MapaUnit;
  ytdLastYear: number | null;
  ytd: number | null;
  ytdChange: MapaChange;
  sameMonthLastYear: number | null;
  lastMonth: number | null;
  thisMonth: number | null;
  changeVsSameMonth: MapaChange;
  changeVsLastMonth: MapaChange;
  target: number | null;
}

export interface MapaHeadline { value: number | null; target: number | null; pct: number | null; tone: Tone | null }

export interface Mapa {
  month: string;
  currentMonth: string;
  earliestMonth: string;
  asOf: string | null;
  dataThrough: string | null;
  headline: { ape: MapaHeadline; activeAgent: MapaHeadline; rekrut: MapaHeadline };
  rows: MapaRow[];
}

// ---------------------------------------------------------------------------------------------------- Kuantitatif

export type PeerStatus = 'above' | 'in_line' | 'below';

export interface QuantLeader {
  membershipId: string;
  role: 'ab' | 'aab';
  name: string;
  photoUrl: string | null;
  value: number;
}

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
  previous: number | null;
  distribution: { leaders: QuantLeader[]; median: number | null; atOrAbove: number };
}

export interface Quant {
  periodEnd: string | null;
  fromMonth: string | null;
  runs: { periodEnd: string; fromMonth: string }[];
  freezesAt: string | null;
  frozenAt: string | null;
  lateWriteAt: string | null;
  needed: number;
  bands: { peerBandPct: number; diffBand: number };
  companyName: string;
  metrics: QuantMetric[];
}

// ---------------------------------------------------------------------------------------------------- Informal group

export interface DriverFigure { value: number | null; target: number | null; pct: number | null; tone: Tone | null }
export interface UsageFigure { downlinePct: number | null; leaderPct: number | null; tone: Tone | null }
export interface InformalDrivers { maa: DriverFigure; usage: UsageFigure; oneOnOne: DriverFigure; rekrut: DriverFigure }

export interface InformalAbGroup {
  ab: PersonRef & { agentCode: string | null; isGroupLeader: boolean; isCoreLeader: boolean };
  people: number;
  leaders: number;
  drivers: InformalDrivers;
}

export interface InformalGroupCard {
  group: { groupId: string; name: string } | null;
  leaders: { membershipId: string; name: string; photoUrl: string | null }[];
  counts: { leaders: number; people: number; abGroups: number };
  drivers: InformalDrivers;
  abGroups: InformalAbGroup[];
}

export interface Subgroup {
  month: string;
  currentMonth: string;
  earliestMonth: string;
  total: { groups: number; leaders: number; people: number; drivers: InformalDrivers };
  groups: InformalGroupCard[];
  canWrite: boolean;
}

export type SheetDriver = 'maa' | 'usage' | 'coaching' | 'rekrut';
export interface SheetPerson extends PersonRef { phone: string | null }

export interface InformalSheet {
  driver: SheetDriver;
  month: string;
  ab: SheetPerson;
  drivers: InformalDrivers;
  maa?: {
    active: { person: SheetPerson; apeMinor: number | null; policies: number | null }[];
    notYet: { person: SheetPerson; potensi: number; lastActiveMonth: string | null }[];
  };
  usage?: {
    notUsed: { person: SheetPerson; lastLoggedOn: string | null; daysSince: number | null }[];
    used: { person: SheetPerson; powerUser: boolean; daysLogged: number; daysSince: number | null }[];
  };
  coaching?: { person: SheetPerson; status: 'never' | 'lapsed' | 'recent'; daysSince: number | null }[];
  rekrut?: {
    joined: { person: SheetPerson; joinDate: string; recruiter: { membershipId: string; name: string } | null }[];
    potential: number;
  };
}

// ---------------------------------------------------------------------------------------------------- the reads

/** A section's query: each section reads the ones it takes, and the server refuses any other by name. */
export interface SectionQuery {
  month?: string;
  ab?: string;
  periodEnd?: string;
  driver?: string;
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
export const readMapa = (query: { month?: string }, platformKpmId?: string) => readSection<Mapa>('mapa', query, platformKpmId);
export const readQuant = (query: { periodEnd?: string }, platformKpmId?: string) => readSection<Quant>('quant', query, platformKpmId);
export const readSubgroup = (query: { month?: string }, platformKpmId?: string) =>
  readSection<Subgroup>('subgroup', query, platformKpmId);
export const readEventsNps = (query: { month?: string; ab?: string }, platformKpmId?: string) =>
  readSection<EventsNps>('events', query, platformKpmId);

/** *Informal group*: the people behind one number of an AB group (P19.22-T5 AC-4). */
export const readInformalSheet = (ab: string, driver: SheetDriver, month: string) =>
  api<InformalSheet>(`/kpm/advanced-analytics/subgroup/people?${queryOf({ ab, driver, month })}`);

/** *Demografi › Unduh daftar (CSV)*. */
export const readDemographicsFile = () => api<DemographicsFile>('/kpm/advanced-analytics/demographics/file');

/** *Demografi › Upload*: the filled list, as text. */
export const uploadDemographics = (file: string) =>
  api<DemographicsUploadResult>('/kpm/advanced-analytics/demographics/upload', { method: 'POST', body: { file } });

/** The month a page opens on: `YYYY-MM` from the address when it is one, else the server's default. */
export function monthFrom(value: string | undefined): string | undefined {
  return value !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : undefined;
}

/** The months from `from` to `to`, newest first: a month picker's choices. */
export function monthsBetween(from: string, to: string): string[] {
  const index = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
  const out: string[] = [];
  for (let i = index(to); i >= index(from); i -= 1) out.push(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
  return out;
}
