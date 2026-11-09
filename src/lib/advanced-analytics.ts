/**
 * **The template's *Advanced analytics* section, as the editor holds it** (P19.5-T1; ADR-0214 §2, ADR-0215 §8,
 * ADR-0216 §1). The payload's shape, mirrored from the API's `AdvancedAnalyticsConfig`, and the pure rules the editor
 * draws by — what is new since the published version, the CSV header a KPM downloads, a column's locks.
 *
 * **No bound or default is declared here** (invariant §7): the server serves them on the kind's read
 * (`CompanyTemplate.analytics.limits`, `.nextMonth`, `.held`, `.readers`) and the payload carries every value.
 */

export type SectionKode = 'DEMOGRAPHICS' | 'MAPA' | 'NPS' | 'QUANT' | 'QUAL' | 'SUBGROUP';
export type UploadUnit = 'rp_million' | 'percent' | 'count';
export type YtdRule = 'sum' | 'upload' | 'none';

export interface LabelPair {
  id: string;
  en: string;
}

export interface UploadField {
  kode: string;
  system: boolean;
  label: LabelPair;
  labelAliases: string[];
  unit: UploadUnit;
  ytd: YtdRule;
  min: number | null;
  max: number | null;
  required: boolean;
  rows: 'all' | 'leaders';
  effectiveFrom: string;
  tip: LabelPair;
}

export interface NpsQuestion {
  kode: string;
  text: LabelPair;
  aspect: string;
  askWhy: boolean;
}

export interface QualQuestion {
  kode: string;
  text: LabelPair;
  type: string;
  items?: { kode: string; label: LabelPair }[];
}

export interface QualBlock {
  kode: string;
  title: LabelPair;
  audience: 'all' | 'leader';
  questions: QualQuestion[];
}

export interface AnalyticsThresholds {
  ageBandUpper: [number, number];
  tenureBands: [number, number, number];
  quantPeerBandPct: number;
  quantDiffBand: number;
  quantMinPeers: number;
  qualIssueMaxRating: number;
  qualBigPct: number;
  qualWatchPct: number;
  supportPromMin: number;
  supportPasMin: number;
  coachingGoodPct: number;
  subgroupOkPct: number;
  powerUserDays: number;
  powerUserWindow: number;
  subgroupWeekMultiplier: number;
  subgroupHeadDefaults: { aa: number; rec: number };
}

export interface AdvancedAnalyticsConfig {
  sections: { kode: SectionKode; enabled: boolean }[];
  uploadFields: UploadField[];
  archivedFields: UploadField[];
  derived: { maaActiveIfAnyPositive: string[] };
  uploadRules: {
    agentCodePattern: string;
    agentCodeExample: string;
    unknownAgent: 'flag' | 'reject';
    historyMonthsBeforeJoin: number;
    completePct: number;
    ytdTolerancePct: number;
  };
  nps: {
    cadence: 'quarter' | 'half';
    defaults: { anonymous: boolean; remindHalfway: boolean };
    promoterMin: number;
    passiveMin: number;
    questions: NpsQuestion[];
    openQuestion: { kode: 'OPEN'; text: LabelPair };
  };
  qualitative: {
    months: number[];
    defaults: { anonymous: boolean; perPerson: boolean; remindHalfway: boolean };
    blocks: QualBlock[];
  };
  thresholds: AnalyticsThresholds;
}

/** What the API serves beside the payload (`CompanyTemplate.analytics`). */
export interface AnalyticsEditorView {
  kpms: number;
  held: Record<string, string>;
  nextMonth: string;
  readers: Record<string, { id: string; en: string }[]>;
  limits: {
    uploadFieldsMax: number;
    codePatternMaxLength: number;
    completePctMin: number;
    completePctMax: number;
    ytdTolerancePctMax: number;
    historyMonthsBeforeJoin: number;
    minPeers: number;
    ageLabelFloor: number;
    labelMaxLength: number;
    tipMaxLength: number;
    questionMaxLength: number;
    peerBandPctMax: number;
  };
}

/** The editor's words of a pair: the ID, or the EN where it is written and EN is asked for (the mockup's `nm()`). */
export const pairIn = (pair: LabelPair, language: 'id' | 'en'): string =>
  (language === 'en' ? pair.en || pair.id : pair.id);

/** The unit as a CSV header writes it: *Rp juta* (EN *Rp M*), *%*, or nothing for a whole number (ADR-0214 §5). */
export const unitShort = (unit: UploadUnit, language: 'id' | 'en'): string =>
  unit === 'rp_million' ? (language === 'id' ? 'Rp juta' : 'Rp M') : unit === 'percent' ? '%' : '';

/**
 * **Exactly the header a KPM downloads** (AC-12; ADR-0214 §5): `Agent Code`, `Agent Name`, then `<label> (<satuan>)
 * [KODE]` for each column in order, then `<label> YTD [KODE_YTD]` for `ytd: 'upload'` columns only. Each cell says
 * whether its column is new since the published version.
 */
export function csvHeader(
  config: AdvancedAnalyticsConfig, language: 'id' | 'en', fresh: ReadonlySet<string>,
): { text: string; fresh: boolean }[] {
  const out = [{ text: 'Agent Code', fresh: false }, { text: 'Agent Name', fresh: false }];
  for (const f of config.uploadFields) {
    const unit = unitShort(f.unit, language);
    out.push({ text: `${pairIn(f.label, language)}${unit ? ` (${unit})` : ''} [${f.kode}]`, fresh: fresh.has(f.kode) });
  }
  for (const f of config.uploadFields.filter((x) => x.ytd === 'upload')) {
    out.push({ text: `${pairIn(f.label, language)} YTD [${f.kode}_YTD]`, fresh: fresh.has(f.kode) });
  }
  return out;
}

/** The kodes current now that the published version did not have: *Baru · mulai <bulan>* (§6). */
export function freshKodes(published: AdvancedAnalyticsConfig | null, draft: AdvancedAnalyticsConfig): Set<string> {
  const had = new Set((published?.uploadFields ?? []).map((f) => f.kode));
  return new Set(draft.uploadFields.filter((f) => !had.has(f.kode)).map((f) => f.kode));
}

/** `YYYY-MM` as the mockup writes it: *Des 2026*, or *Dec 2026*. */
export function monthLabel(month: string, language: 'id' | 'en'): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  const names = language === 'id'
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[m - 1]} ${y}`;
}

/** The checklist row's summary (AC-1): *"N dari 6 bagian aktif · M kolom data upload"*. */
export function sectionSummary(config: Pick<AdvancedAnalyticsConfig, 'sections' | 'uploadFields'>): {
  on: number; total: number; columns: number;
} {
  return {
    on: config.sections.filter((s) => s.enabled).length,
    total: config.sections.length,
    columns: config.uploadFields.length,
  };
}

/** A kode as it may be typed: capitals, digits and `_` — the mockup's `oninput` (§6). */
export const kodeTyped = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9_]/g, '');

/**
 * **A column's form, checked as the mockup checks it** (AC-6): each error beside its field. The server checks the same
 * and more; this is so a mistake is said under the field, before anything is sent.
 */
export function columnErrors(
  form: { kode: string; label: LabelPair; unit: UploadUnit; min: number | null; max: number | null },
  isNew: boolean,
  taken: ReadonlySet<string>,
): Partial<Record<'kode' | 'labelId' | 'min' | 'max', 'kodeRequired' | 'kodeTaken' | 'kodeShape' | 'nameRequired' | 'percent' | 'minAboveMax'>> {
  const out: ReturnType<typeof columnErrors> = {};
  if (isNew) {
    if (!form.kode) out.kode = 'kodeRequired';
    else if (taken.has(form.kode)) out.kode = 'kodeTaken';
    else if (!/^[A-Z][A-Z0-9_]{0,39}$/.test(form.kode) || form.kode.endsWith('_YTD')) out.kode = 'kodeShape';
  }
  if (!form.label.id.trim()) out.labelId = 'nameRequired';
  if (form.unit === 'percent') {
    if (form.min !== null && (form.min < 0 || form.min > 100)) out.min = 'percent';
    if (form.max !== null && (form.max < 0 || form.max > 100)) out.max = 'percent';
  }
  if (!out.min && form.min !== null && form.max !== null && form.min > form.max) out.min = 'minAboveMax';
  return out;
}
