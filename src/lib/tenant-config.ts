import { api } from './api-client';
import type { RatioDisplayUnit } from './ratio-format';

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
  /**
   * How `benchmark` is written (P4-T25). Always sent by the settings API; absent on a
   * published snapshot rendered before units existed, so read it through `unitFor`.
   */
  displayUnit?: RatioDisplayUnit;
  displayOrder: number;
  version: number;
  status: 'active' | 'archived';
  /**
   * Where the row came from (ADR-0021, revised by ADR-0024). `platform` means provisioned;
   * its formula is the office's to change, like everything else on it.
   */
  origin: RatioOrigin;
  /**
   * The formula this office was provisioned with, and whether the row still matches it
   * (ADR-0024). Optional because a snapshot published before the column has neither.
   */
  standardNumerator?: string[] | null;
  standardDenominator?: string[] | null;
  divergesFromStandard?: boolean;
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
  displayUnit?: RatioDisplayUnit;
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
  | 'ratio.create' | 'ratio.update' | 'ratio.archive' | 'ratio.restore'
  | 'trainingCategory.create' | 'trainingCategory.update'
  | 'trainingCategory.archive' | 'trainingCategory.restore'
  | 'trainingSkill.create' | 'trainingSkill.update'
  | 'trainingSkill.archive' | 'trainingSkill.restore'
  | 'trainingModule.create' | 'trainingModule.update'
  | 'trainingModule.archive' | 'trainingModule.restore';

/** Whether agents are offered a module **at all** — not when; that is the office's publish. */
export type TrainingPublishState = 'draft' | 'published';

export interface TrainingModuleRow {
  id: string;
  code: string;
  /** Its category is this skill's, and is not stored on the module (ADR-0029). */
  skillCode: string;
  title: string;
  publishState: TrainingPublishState;
  displayOrder: number;
  version: number;
  status: 'active' | 'archived';
}

export interface TrainingSkillRow {
  id: string;
  code: string;
  categoryCode: string;
  label: string;
  displayOrder: number;
  version: number;
  status: 'active' | 'archived';
  modules: TrainingModuleRow[];
}

export interface TrainingCategoryRow {
  id: string;
  code: string;
  label: string;
  /** The subtitle an agent's category page shows. */
  description: string | null;
  displayOrder: number;
  version: number;
  status: 'active' | 'archived';
  skills: TrainingSkillRow[];
}

/**
 * The office's training taxonomy (P5-T1), nested and in display order. **Drafts included** —
 * this is the office's configuration, not what agents are offered. `includeArchived` is the
 * settings screen's. Every write goes through {@link applyConfigChanges}.
 */
export const listTraining = (includeArchived = false) =>
  api<TrainingCategoryRow[]>(
    `/kpm/settings/training${includeArchived ? '?includeArchived=true' : ''}`,
  );

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
    /**
     * What agents would be offered — published, active modules only. **Not** the settings
     * list: a screen showing drafts and archived rows reads {@link listTraining} again.
     */
    training: TrainingCategoryRow[];
    version: number;
  }>('/kpm/settings/changes', { method: 'POST', body: { ops: sequenceVersions(ops) } });

/**
 * The version each op will find its row at, rather than the version the screen read (P5-T1).
 *
 * **The batch moves a row's version on after every op against it** — that is how two ops on
 * one row both hold (`changes.service.ts`, pinned by *lets two ops touch one row*). So the
 * second op on a row must name the version the first one left, and every screen sent the one
 * it had read. Editing a type and then archiving it, in one Save, answered
 * `409 VERSION_CONFLICT` about a row nobody else had touched; the training screen made that
 * the ordinary case, because publishing a module and archiving another's skill are both
 * edits somebody makes in one sitting.
 *
 * Done here, at the moment of sending, rather than in {@link stageChange}: what is staged
 * stays what the reader did, and Undo can drop any op without renumbering the rest.
 */
export function sequenceVersions(ops: ConfigChange[]): ConfigChange[] {
  const earlier = new Map<string, number>();
  return ops.map((change) => {
    if (!change.id || change.expectedVersion === undefined) return change;
    // By entity as well as id: the batch keeps each kind of row in a map of its own.
    const key = `${change.op.split('.')[0]}:${change.id}`;
    const before = earlier.get(key) ?? 0;
    earlier.set(key, before + 1);
    return before === 0 ? change : { ...change, expectedVersion: change.expectedVersion + before };
  });
}

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


// ----------------------------------------------------- the activation checklist (P5-T3)

/** What an item waits for, resolved — the label and route Phase 11's *"Go to {label} →"* uses. */
export interface ActivationLink {
  kind: string;
  label: string;
  route: string;
  completesWhen: string;
  /** Whether an evaluator exists yet. Until it does, a leader ticks the item by hand. */
  live: boolean;
  livePhase: number;
}

export interface ActivationItem {
  code: string;
  label: string;
  displayOrder: number;
  autoLink: string | null;
  link: ActivationLink | null;
}

export interface ActivationAspect {
  code: string;
  label: string;
  displayOrder: number;
  items: ActivationItem[];
}

export interface ActivationVersion {
  id: string;
  version: number;
  status: 'draft' | 'published';
  publishedAt: string | null;
  aspects: ActivationAspect[];
}

export interface ActivationChecklist {
  /** What hires starting now are given. `null` before the first publish. */
  published: ActivationVersion | null;
  /** The office's working copy. `null` when nothing has changed since publishing. */
  draft: ActivationVersion | null;
  /** `kpms.settings.activationWindowDays`, shown beside the checklist and changed in Branch info. */
  windowDays: number;
}

/** What a save sends: the whole document, in the order the lists are in. */
export interface ActivationDraft {
  aspects: {
    code: string;
    label: string;
    items: { code: string; label: string; autoLink: string | null }[];
  }[];
}

/**
 * The office's checklist (P5-T3).
 *
 * **Not part of the office's snapshot**, unlike every other setting: a hire's activation pins the
 * version it was created against, so this document publishes on its own (ADR-0031, ADR-0039).
 */
export const readActivationChecklist = () =>
  api<ActivationChecklist>('/kpm/settings/activation-checklist');

/** Save the working draft. The whole checklist, because its order is part of what is saved. */
export const saveActivationDraft = (draft: ActivationDraft) =>
  api<ActivationChecklist>('/kpm/settings/activation-checklist', { method: 'PUT', body: draft });

/** Publish the draft as the next version — given to hires who start after it, and to nobody else. */
export const publishActivationChecklist = () =>
  api<ActivationChecklist>('/kpm/settings/activation-checklist/publish', { method: 'POST' });

// ------------------------------------------------ a training module's content (P5-T2, ADR-0032)

export interface ContentFile {
  id: string;
  label: string;
  /** The key, never a URL: a URL is minted per request, signed, and expires in 300 seconds. */
  storageKey: string;
  mimeType: string;
  bytes: number;
}

export interface ContentLink {
  id: string;
  label: string;
  url: string;
}

export interface ModuleContent {
  files: ContentFile[];
  videos: ContentFile[];
  links: ContentLink[];
}

export interface ModuleContentView {
  moduleCode: string;
  title: string;
  /** What agents in this office are shown. */
  content: ModuleContent;
  /** The company's material, always — so the screen can say what "use theirs again" restores. */
  companyContent: ModuleContent;
  overridden: boolean;
}

export interface SignedUpload {
  uploadUrl: string;
  storageKey: string;
  signature: string;
  expiresAt: string;
}

export const readModuleContent = (code: string) =>
  api<ModuleContentView>(`/kpm/settings/training/modules/${encodeURIComponent(code)}/content`);

/** The whole document, not a patch: every edit is held until Save and sent together. */
export const saveModuleContent = (code: string, content: ModuleContent) =>
  api<ModuleContentView>(`/kpm/settings/training/modules/${encodeURIComponent(code)}/content`, {
    method: 'PUT',
    body: {
      files: content.files.map(({ id, label, storageKey, mimeType, bytes }) =>
        ({ id, label, storageKey, mimeType, bytes })),
      videos: content.videos.map(({ id, label, storageKey, mimeType, bytes }) =>
        ({ id, label, storageKey, mimeType, bytes })),
      links: content.links.map(({ id, label, url }) => ({ id, label, url })),
    },
  });

/** Removes this office's replacement and falls back to the company's material. */
export const resetModuleContent = (code: string) =>
  api<ModuleContentView>(`/kpm/settings/training/modules/${encodeURIComponent(code)}/content`, {
    method: 'DELETE',
  });

export const requestTrainingUpload = (body: { filename: string; mimeType: string; bytes: number }) =>
  api<SignedUpload>('/kpm/settings/training/uploads', { method: 'POST', body });

/** Asks storage what actually landed and records that, not what this browser claimed. */
export const confirmTrainingUpload = (storageKey: string) =>
  api<{ storageKey: string; mimeType: string; bytes: number }>(
    '/kpm/settings/training/uploads/confirm', { method: 'POST', body: { storageKey } },
  );

export const moduleContentUrl = (code: string, storageKey: string) =>
  api<{ url: string }>(
    `/kpm/settings/training/modules/${encodeURIComponent(code)}/content/url`
    + `?storageKey=${encodeURIComponent(storageKey)}`,
  );
