import type { AdvancedAnalyticsConfig, UploadField } from '@/lib/advanced-analytics';

/** A column as version 1 holds it (ADR-0214 §9), for the editor's specs. */
const column = (kode: string, id: string, en: string, unit: UploadField['unit'], ytd: UploadField['ytd'], over: Partial<UploadField> = {}): UploadField => ({
  kode, system: ['APE', 'POLICY_COUNT', 'RECRUITMENT', 'NEW_ACTIVE_AGENTS'].includes(kode), label: { id, en },
  labelAliases: [], unit, ytd, min: 0, max: unit === 'percent' ? 100 : null, required: false, rows: 'all',
  effectiveFrom: '2024-01', tip: { id: '', en: '' }, ...over,
});

/**
 * **Version 1 of a template's *Advanced analytics*, as the API answers it** (P19.5-T1; `analyticsConfigV1`): the seven
 * columns, the six sections, the mockup's surveys and the spec's thresholds. A spec's fixture, never a default the app
 * reads.
 */
export function analyticsV1(): AdvancedAnalyticsConfig {
  return {
    sections: ['DEMOGRAPHICS', 'MAPA', 'NPS', 'QUANT', 'QUAL', 'SUBGROUP'].map((kode) => ({ kode, enabled: true })) as AdvancedAnalyticsConfig['sections'],
    uploadFields: [
      column('APE', 'APE', 'APE', 'rp_million', 'sum'),
      column('PERSISTENCY', 'Persistensi rolling', 'Rolling persistency', 'percent', 'none'),
      column('RECRUITMENT', 'Rekrutmen', 'Recruitment', 'count', 'sum'),
      column('NEW_ACTIVE_AGENTS', 'Agen aktif baru', 'New active agents', 'count', 'sum'),
      column('FYP', 'FYP', 'FYP', 'rp_million', 'sum'),
      column('POLICY_COUNT', 'Jumlah polis (case issued)', '# of policy (case issued)', 'count', 'sum'),
      column('UNIT_PERSISTENCY', 'Unit persistency', 'Unit persistency', 'percent', 'none', { rows: 'leaders' }),
    ],
    archivedFields: [],
    derived: { maaActiveIfAnyPositive: ['APE', 'POLICY_COUNT'] },
    uploadRules: {
      agentCodePattern: '^\\d{3,32}$', agentCodeExample: '80777', unknownAgent: 'reject', historyMonthsBeforeJoin: 12,
      completePct: 90, ytdTolerancePct: 1,
    },
    nps: {
      cadence: 'quarter',
      defaults: { anonymous: true, remindHalfway: true },
      promoterMin: 9,
      passiveMin: 7,
      questions: [
        { kode: 'P1', text: { id: 'Seberapa besar kemungkinan Anda merekomendasikan KPM ini?', en: 'How likely are you to recommend this KPM?' }, aspect: 'Keseluruhan', askWhy: true },
        { kode: 'P2', text: { id: 'Seberapa jelas visi dan arah KPM ini bagi Anda?', en: 'How clear is this KPM’s vision?' }, aspect: 'Visi', askWhy: true },
      ],
      openQuestion: { kode: 'OPEN', text: { id: 'Apa satu hal yang paling ingin Anda perbaiki di KPM ini?', en: 'What one thing would you improve?' } },
    },
    qualitative: {
      months: [6, 12],
      defaults: { anonymous: false, perPerson: true, remindHalfway: true },
      blocks: [
        { kode: 'SALES', title: { id: 'A. Penjualan', en: 'A. Sales' }, audience: 'all', questions: [{ kode: 'Q5', type: 'scale_items', text: { id: 'Seberapa yakin?', en: 'How confident?' } }] },
        { kode: 'RECRUIT', title: { id: 'B. Rekrutmen', en: 'B. Recruitment' }, audience: 'leader', questions: [{ kode: 'Q6', type: 'scale_items', text: { id: 'Rekrut?', en: 'Recruit?' } }] },
      ],
    },
    thresholds: {
      ageBandUpper: [29, 45], tenureBands: [3, 7, 10], quantPeerBandPct: 5, quantDiffBand: 2, quantMinPeers: 3,
      qualIssueMaxRating: 3, qualBigPct: 60, qualWatchPct: 40, supportPromMin: 9, supportPasMin: 7, coachingGoodPct: 70,
      subgroupOkPct: 80, powerUserDays: 10, powerUserWindow: 30, subgroupWeekMultiplier: 2,
      subgroupHeadDefaults: { aa: 3, rec: 6 },
    },
  };
}

/** What the API serves beside the payload, for the specs. */
export const EDITOR_VIEW = {
  kpms: 12,
  held: { APE: '2024-01', PERSISTENCY: '2024-01' } as Record<string, string>,
  nextMonth: '2026-12',
  readers: {
    APE: [{ id: 'MAPA', en: 'MAPA' }, { id: 'MAA aktif', en: 'MAA active' }],
    FYP: [{ id: 'Campaign', en: 'Campaigns' }],
  } as Record<string, { id: string; en: string }[]>,
  limits: {
    uploadFieldsMax: 40, codePatternMaxLength: 200, completePctMin: 50, completePctMax: 100, ytdTolerancePctMax: 10,
    historyMonthsBeforeJoin: 12, minPeers: 3, ageLabelFloor: 17, labelMaxLength: 60, tipMaxLength: 200,
    questionMaxLength: 300, peerBandPctMax: 50,
  },
};
