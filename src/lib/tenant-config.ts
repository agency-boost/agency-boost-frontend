import { api } from './api-client';

export interface ActivityTypeRow {
  id: string;
  code: string;
  categoryCode: string;
  label: string;
  description: string | null;
  /** Inherited from the category and never stored here. Empty means every rung. */
  appliesToOrgLevelCodes: string[];
  displayOrder: number;
  version: number;
  status: 'active' | 'archived';
}

export interface ActivityCategoryRow {
  id: string;
  code: string;
  label: string;
  description: string | null;
  /** The rungs this section is for. **Empty means every rung**; it cascades to its types. */
  appliesToOrgLevelCodes: string[];
  displayOrder: number;
  version: number;
  status: 'active' | 'archived';
  types: ActivityTypeRow[];
}

/**
 * The office's own taxonomy (P4-T1).
 *
 * `includeArchived` is the settings screen's, not the capture screen's: an agent logging
 * today should not be offered a type the office retired, and an Owner needs to see one in
 * order to bring it back.
 */
export const listActivityTypes = (includeArchived = false) =>
  api<ActivityCategoryRow[]>(
    `/kpm/settings/activity-types${includeArchived ? '?includeArchived=true' : ''}`,
  );

export const createActivityCategory = (body: {
  code: string;
  label: string;
  description?: string;
  appliesToOrgLevelCodes?: string[];
}) => api<ActivityCategoryRow>('/kpm/settings/activity-categories', { method: 'POST', body });


/** Every section, once each, in the order wanted. Bumps no version. */
export const reorderActivityCategories = (ids: string[]) =>
  api<ActivityCategoryRow[]>('/kpm/settings/activity-categories/reorder', {
    method: 'PATCH', body: { ids },
  });

export const createActivityType = (body: {
  code: string;
  categoryCode: string;
  label: string;
  description?: string;
}) => api<ActivityTypeRow>('/kpm/settings/activity-types', { method: 'POST', body });


/** Every id, once each, in the order wanted — see the DTO for why it is not a single move. */
export const reorderActivityTypes = (ids: string[]) =>
  api<ActivityTypeRow[]>('/kpm/settings/activity-types/reorder', {
    method: 'PATCH', body: { ids },
  });

/** Archive. There is no delete — an activity log that named this still has to render. */
export const archiveActivityType = (id: string) =>
  api<ActivityTypeRow>(`/kpm/settings/activity-types/${id}`, { method: 'DELETE' });

export const restoreActivityType = (id: string) =>
  api<ActivityTypeRow>(`/kpm/settings/activity-types/${id}/restore`, { method: 'POST' });

export type LeadPipeline = 'sales' | 'recruitment';

export interface LeadStatusRow {
  id: string;
  pipeline: LeadPipeline;
  code: string;
  label: string;
  rank: number;
  /** The stage that closes this pipeline, and what gates marking a lead successful. */
  isTerminal: boolean;
  version: number;
  status: 'active' | 'archived';
}

export interface LeadPipelineRow {
  pipeline: LeadPipeline;
  statuses: LeadStatusRow[];
}

export const listLeadStatuses = (includeArchived = false) =>
  api<LeadPipelineRow[]>(
    `/kpm/settings/lead-statuses${includeArchived ? '?includeArchived=true' : ''}`,
  );

export const createLeadStatus = (body: {
  pipeline: LeadPipeline;
  code: string;
  label: string;
}) => api<LeadStatusRow>('/kpm/settings/lead-statuses', { method: 'POST', body });

/** The label only: the code is what every lead holds. */
export const renameLeadStatus = (id: string, label: string) =>
  api<LeadStatusRow>(`/kpm/settings/lead-statuses/${id}`, { method: 'PATCH', body: { label } });

export const reorderLeadStatuses = (pipeline: LeadPipeline, ids: string[]) =>
  api<LeadPipelineRow>('/kpm/settings/lead-statuses/reorder', {
    method: 'PATCH', body: { pipeline, ids },
  });

export const setTerminalLeadStatus = (id: string) =>
  api<LeadPipelineRow>(`/kpm/settings/lead-statuses/${id}/terminal`, { method: 'POST' });

export const archiveLeadStatus = (id: string) =>
  api<LeadStatusRow>(`/kpm/settings/lead-statuses/${id}`, { method: 'DELETE' });

export const restoreLeadStatus = (id: string) =>
  api<LeadStatusRow>(`/kpm/settings/lead-statuses/${id}/restore`, { method: 'POST' });

export type RatioComparison = 'gte' | 'band';
export type RatioOrigin = 'platform' | 'office';

export interface RatioRow {
  id: string;
  code: string;
  label: string;
  /** Activity type codes, summed. Codes — never the prototype's item numbers. */
  numerator: string[];
  denominator: string[];
  benchmark: number;
  comparison: RatioComparison;
  displayOrder: number;
  version: number;
  status: 'active' | 'archived';
  /**
   * Whose formula it is (ADR-0021). A `platform` row's numerator and denominator are
   * fixed — that is what lets two offices' figures mean the same thing.
   */
  origin: RatioOrigin;
  /** Ladder rung codes. **Empty means every rung** (ADR-0020). */
  appliesToOrgLevelCodes: string[];
}

export const listRatios = (includeArchived = false) =>
  api<RatioRow[]>(
    `/kpm/settings/ratio-benchmarks${includeArchived ? '?includeArchived=true' : ''}`,
  );

export const createRatio = (body: {
  code: string;
  label: string;
  numerator: string[];
  denominator: string[];
  benchmark: number;
  comparison: RatioComparison;
  appliesToOrgLevelCodes?: string[];
}) => api<RatioRow>('/kpm/settings/ratio-benchmarks', { method: 'POST', body });


export const archiveRatio = (id: string) =>
  api<RatioRow>(`/kpm/settings/ratio-benchmarks/${id}`, { method: 'DELETE' });

export const restoreRatio = (id: string) =>
  api<RatioRow>(`/kpm/settings/ratio-benchmarks/${id}/restore`, { method: 'POST' });

export interface BranchInfo {
  _id: string;
  companyId: string;
  companyName: string;
  code: string;
  branchName: string;
  address: string | null;
  contactPhone: string | null;
  ownerName: string | null;
  timezone: string;
  locale: string;
  currency: string;
  /** 1–12. Stored and shown now; read by the period computations in Phase 14. */
  fiscalYearStartMonth: number;
}

export const readBranchInfo = () => api<BranchInfo>('/kpm/settings/branch-info');

/** Not company, not owner, and not locale, timezone or currency (ADR-0016). */
export const updateBranchInfo = (body: Partial<{
  branchName: string;
  address: string;
  contactPhone: string;
  fiscalYearStartMonth: number;
}>) => api<BranchInfo>('/kpm/settings/branch-info', { method: 'PATCH', body });

export interface PublishState {
  /** What agents are on. 0 when nothing is published. */
  publishedVersion: number;
  workingVersion: number;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
}

export const readPublishState = () => api<PublishState>('/kpm/settings/publish-state');

/** Renders the live rows into the copy agents read. Until then they stay on the last one. */
export const publishConfig = () =>
  api<PublishState>('/kpm/settings/publish', { method: 'POST' });

export type ConfigChangeOp =
  | 'category.create' | 'category.update' | 'category.archive' | 'category.restore'
  | 'type.create' | 'type.update' | 'type.archive' | 'type.restore'
  | 'ratio.create' | 'ratio.update' | 'ratio.archive' | 'ratio.restore';

export interface ConfigChange {
  op: ConfigChangeOp;
  id?: string;
  /** The `version` the screen read. Required on anything that changes an existing row. */
  expectedVersion?: number;
  body?: Record<string, unknown>;
}

/**
 * Send every staged edit at once (P4-T19).
 *
 * Validated entirely before anything is written, so a refusal leaves the office exactly as
 * it was — which is what lets the screen hold edits until the reader presses Save changes
 * rather than writing on each one. A row somebody else moved returns `409`, naming what
 * changed, instead of quietly overwriting their work.
 */
export const applyConfigChanges = (ops: ConfigChange[]) =>
  api<{
    activity: ActivityCategoryRow[];
    ratios: RatioRow[];
    leadPipelines: LeadPipelineRow[];
    version: number;
  }>('/kpm/settings/changes', { method: 'POST', body: { ops } });

/**
 * Fold one staged change into the list a screen is holding.
 *
 * **Two ops on one row collapse into the later one**, so three tweaks to a benchmark send
 * one change rather than three — and the `expectedVersion` the first read still guards it,
 * because the row has not moved in between. A create has no id, so it never collapses:
 * adding two types is two changes, which is what the reader did.
 *
 * A pure reducer rather than a hook, because two screens need exactly this rule and a
 * second copy of it would be a second answer to what Save sends.
 */
export function stageChange(now: ConfigChange[], change: ConfigChange): ConfigChange[] {
  if (!change.id) return [...now, change];

  const same = (c: ConfigChange) => c.op === change.op && c.id === change.id;
  const previous = now.find(same);
  const body = { ...previous?.body, ...change.body };

  return [
    ...now.filter((c) => !same(c)),
    // An empty body is absent, not `{}` — an archive says everything in its `op`.
    { ...previous, ...change, ...(Object.keys(body).length ? { body } : {}) },
  ];
}

