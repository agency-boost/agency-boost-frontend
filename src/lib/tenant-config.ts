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
  /**
   * The summary tile this section counts toward (ADR-0064), and that tile's label. **Both or
   * neither**: sections sharing a code share a tile, and one with neither has a tile of its own
   * under its own label. Presentation only — nothing but the strips reads them. Optional because a
   * configuration published before the fields existed carries neither.
   */
  summaryGroupCode?: string | null;
  summaryGroupLabel?: string | null;
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
  /**
   * A stage the lead is expected to convert from this period (ADR-0043).
   *
   * What the KPM Overview counts as *Expected to close*. Unlike `isTerminal` it is not
   * exclusive, and it is never true on the stage that closes the pipeline.
   */
  isLateStage: boolean;
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

export const setLateStageLeadStatus = (id: string, isLateStage: boolean) =>
  api<LeadStatusRow>(`/kpm/settings/lead-statuses/${id}/late-stage`, {
    method: 'PATCH', body: { isLateStage },
  });

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
  /** 1–12. Stored and shown now; read by the period computations in Phase 18 (the old plan's 14). */
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

/** What an item waits for, resolved — the label and route the hire's *"Go to {label} →"* will use. */
export interface ActivationLink {
  kind: string;
  label: string;
  route: string;
  completesWhen: string;
  /**
   * Whether an evaluator exists yet. Until it does, a leader ticks the item by hand.
   *
   * There is no `livePhase` beside it any more (P10.1-T2 AC-13): the API served the phase that would
   * make a link live, the settings screen printed the same numbers from its own copy, and a phase is
   * our schedule, not the reader's.
   */
  live: boolean;
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
  /** `kpms.settings.activationWindowDays`, shown beside the checklist. No screen edits it (X-45). */
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
  /**
   * Every multipart field storage needs beside the file — for Cloudinary the API key, the timestamp,
   * the public id, the delivery type and the signature over them. Storage refuses an upload that
   * carries the signature alone, which is what was sent before this field existed.
   */
  fields?: Record<string, string>;
}

/**
 * **The one form a signed upload is sent as**, for every upload in the app: the file, then every field
 * the server signed, as the server named them. An older server's answer, with no `fields`, gets the
 * two it used to.
 */
export function signedUploadForm(signed: SignedUpload, file: Blob): FormData {
  const form = new FormData();
  const fields = signed.fields ?? { public_id: signed.storageKey, signature: signed.signature };
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  form.append('file', file);
  return form;
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

// ------------------------------------------------ what this office sells (P5-T5, ADR-0033)

export interface EffectiveField<T> {
  value: T;
  /** True when this office has replaced its company's value for this field. */
  overridden: boolean;
}

export interface ProductDocumentSlotView {
  slot: string;
  label: string;
  storageKey: string | null;
  filename: string | null;
  /** The prototype's own *"Uploaded by KPM"* against *"From the catalog"*. */
  source: 'kpm' | 'company' | 'none';
}

export type ScriptReviewState = 'none' | 'pending' | 'approved' | 'rejected';

export interface KpmProductRow {
  productId: string;
  code: string;
  /** What the company calls it, always — so a screen can say what a rename replaced. */
  companyName: string;
  channel: string;
  category: string;
  lifecycle: string;
  /** False once the company withdraws it, whatever this office decided. */
  sellable: boolean;
  active: EffectiveField<boolean>;
  displayName: EffectiveField<string>;
  /**
   * *Short description (shown to agents)* (OD-136): this office's **draft**, else the company's
   * tagline. Held for approval with the script, so agents read the effective read's instead.
   */
  description: EffectiveField<string>;
  script: Record<string, EffectiveField<string | string[]>>;
  reviewState: ScriptReviewState;
  rejectionReason: string | null;
  documents: ProductDocumentSlotView[];
}

export const listKpmProducts = () => api<KpmProductRow[]>('/kpm/settings/products');

/** `null` gives the decision back to the company's default, which may change later. */
export const setKpmProductActive = (productId: string, active: boolean | null) =>
  api<KpmProductRow>(`/kpm/settings/products/${productId}/active`, {
    method: 'PUT', body: { active },
  });

/**
 * The longest *Short description (shown to agents)* the API takes: the company tagline's own bound
 * (OD-136). Held to the API document by `contract.spec.ts`, so the two cannot drift.
 */
export const PRODUCT_DESCRIPTION_MAX = 300;

/** One field or a few; `description: null` gives the description back to the company. */
export const saveKpmProductOverrides = (
  productId: string, overrides: Record<string, unknown>,
) => api<KpmProductRow>(`/kpm/settings/products/${productId}/overrides`, {
  method: 'PATCH', body: overrides,
});

/** An unset, not a copy: the field follows the company again from the next read. */
export const resetKpmProductOverride = (productId: string, field: string) =>
  api<KpmProductRow>(`/kpm/settings/products/${productId}/overrides/${field}`, {
    method: 'DELETE',
  });

/**
 * A signature for one product document, a PDF into the office's own `products` folder the server
 * picks (P17-T9, D-productdocs). `setKpmProductDocument` then attaches the stored key.
 */
export const requestProductUpload = (body: { filename: string; mimeType: string; bytes: number }) =>
  api<SignedUpload>('/kpm/settings/products/uploads', { method: 'POST', body });

export const setKpmProductDocument = (
  productId: string, slot: string, body: { storageKey: string; label: string },
) => api<KpmProductRow>(`/kpm/settings/products/${productId}/documents/${slot}`, {
  method: 'PUT', body,
});

export const resetKpmProductDocument = (productId: string, slot: string) =>
  api<KpmProductRow>(`/kpm/settings/products/${productId}/documents/${slot}`, {
    method: 'DELETE',
  });

export const kpmProductDocumentUrl = (productId: string, slot: string) =>
  api<{ url: string }>(`/kpm/settings/products/${productId}/documents/${slot}/url`);

// ------------------------------------------------------ the events an office runs (P5-T6)

export interface EventTypeRow {
  id: string;
  code: string;
  label: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  displayOrder: number;
  status: 'active' | 'archived';
  /** How many events name it — what archiving would affect. */
  events: number;
}

export interface EventAudience {
  issuer: 'company' | 'kpm' | 'group';
  scope: 'all_agents' | 'select_agents' | 'leaders' | 'select_leaders';
  inviteeMembershipIds: string[];
}

export interface EventRow {
  id: string;
  code: string;
  typeCode: string;
  title: string;
  blurb: string;
  description: string;
  startsAt: string;
  endsAt: string;
  /** The calendar day in the office's timezone, so no browser re-derives it in its own. */
  startsOn: string;
  location: string;
  locationUrl: string | null;
  audience: EventAudience;
  /** Derived on every read, never stored. */
  phase: 'upcoming' | 'running' | 'past';
  status: 'active' | 'archived';
  version: number;
}

export const listEventTypes = (includeArchived = false) =>
  api<EventTypeRow[]>(`/kpm/settings/events/types${includeArchived ? '?includeArchived=true' : ''}`);

export const createEventType = (body: Record<string, unknown>) =>
  api<EventTypeRow>('/kpm/settings/events/types', { method: 'POST', body });

export const updateEventType = (id: string, body: Record<string, unknown>) =>
  api<EventTypeRow>(`/kpm/settings/events/types/${id}`, { method: 'PATCH', body });

export const archiveEventType = (id: string) =>
  api<EventTypeRow>(`/kpm/settings/events/types/${id}/archive`, { method: 'POST' });

export const restoreEventType = (id: string) =>
  api<EventTypeRow>(`/kpm/settings/events/types/${id}/restore`, { method: 'POST' });

export const listEvents = (includeArchived = false) =>
  api<EventRow[]>(`/kpm/settings/events${includeArchived ? '?includeArchived=true' : ''}`);

export const createEvent = (body: Record<string, unknown>) =>
  api<EventRow>('/kpm/settings/events', { method: 'POST', body });

export const updateEvent = (id: string, body: Record<string, unknown>) =>
  api<EventRow>(`/kpm/settings/events/${id}`, { method: 'PATCH', body });

export const archiveEvent = (id: string) =>
  api<EventRow>(`/kpm/settings/events/${id}/archive`, { method: 'POST' });

export const restoreEvent = (id: string) =>
  api<EventRow>(`/kpm/settings/events/${id}/restore`, { method: 'POST' });

// ---------------------------------------- campaigns and the carrier rules (P5-T7, ADR-0026)

export interface RequirementView {
  metricKey: string;
  /** The registry's own name, so no screen holds a second copy of the vocabulary. */
  metricName: string;
  comparator: string;
  value: number;
  /** `idr_minor` means integer sen. */
  unit: string;
  /**
   * A campaign's requirement only (P18.5-T8, D-evaluable): `false` for one stored before the evaluable set,
   * naming a metric a campaign cannot measure — the badge *Not measured yet*.
   */
  measured?: boolean;
}

/** P18.5-T7, D-fields: the agent's card draws each of these. */
export type CampaignKindCode = 'seasonal' | 'structural';
export type CampaignSubtypeCode = 'promotion' | 'ongoing';
export type CampaignWindowCode = 'campaign_dates' | 'calendar_year' | 'rolling_12m';

export interface CampaignRow {
  id: string;
  code: string;
  title: string;
  description: string;
  startsAt: string;
  /** `null` for a structural campaign, which runs on. */
  endsAt: string | null;
  /** Derived on every read, never stored. */
  phase: 'upcoming' | 'running' | 'ended';
  requirements: RequirementView[];
  reward: string;
  status: 'active' | 'archived';
  version: number;
  kind: CampaignKindCode;
  subtype: CampaignSubtypeCode | null;
  window: CampaignWindowCode;
  /** The company's rung codes the campaign is for; empty is everybody (ADR-0035's shape). */
  appliesToOrgLevelCodes: string[];
  poster: CampaignRowPoster;
  blurb: string;
}

/** An emoji and a token name of the poster palette (`lib/campaigns.ts`, `POSTER_COLORS`). */
export interface CampaignRowPoster {
  emoji: string;
  color: string;
}

export interface QualificationRuleRow {
  id: string;
  kind: 'moc' | 'production_club' | 'promotion_path';
  code: string;
  name: string;
  appliesToOrgLevelCodes: string[];
  criteriaGroups: { mode: string; criteria: RequirementView[] }[];
  groupMode: string;
  reward: string;
  rank: number;
  /** Metric keys the product does not compute yet. A rule with any can never pass. */
  waitingOnMetrics: string[];
}

export const listCampaigns = (includeArchived = false) =>
  api<CampaignRow[]>(`/kpm/settings/campaigns${includeArchived ? '?includeArchived=true' : ''}`);

export const listQualificationRules = (kind?: string) =>
  api<QualificationRuleRow[]>(
    `/kpm/settings/campaigns/rules${kind ? `?kind=${kind}` : ''}`,
  );

export const createCampaign = (body: Record<string, unknown>) =>
  api<CampaignRow>('/kpm/settings/campaigns', { method: 'POST', body });

export const updateCampaign = (id: string, body: Record<string, unknown>) =>
  api<CampaignRow>(`/kpm/settings/campaigns/${id}`, { method: 'PATCH', body });

export const archiveCampaign = (id: string) =>
  api<CampaignRow>(`/kpm/settings/campaigns/${id}/archive`, { method: 'POST' });

export const restoreCampaign = (id: string) =>
  api<CampaignRow>(`/kpm/settings/campaigns/${id}/restore`, { method: 'POST' });

// ------------------------------------------- the capability catalog (P5-T8, ADR-0025)

export interface CapabilityEntry {
  /** The identity. A rename never moves it, and it is never reused. */
  code: string;
  label: string;
  displayOrder: number;
  status: 'active' | 'archived';
}

export interface CapabilityStage extends CapabilityEntry {
  requiredMilestoneCodes: string[];
  /** How senior the stage is — **not** its position on screen. */
  stageOrder: number;
}

export interface CapabilityGrid extends CapabilityEntry {
  requiresDownline: boolean;
  items: CapabilityEntry[];
}

export interface CapabilityCatalog {
  stages: CapabilityStage[];
  milestones: CapabilityEntry[];
  grids: CapabilityGrid[];
  version: number;
}

export const readCapabilityCatalog = () =>
  api<CapabilityCatalog>('/kpm/settings/capability-mapping');

export const renameCapability = (
  body: { part: string; code: string; label: string; gridCode?: string },
) => api<CapabilityCatalog>('/kpm/settings/capability-mapping/label', {
  method: 'PATCH', body,
});

export const setCapabilityStatus = (
  body: { part: string; code: string; status: 'active' | 'archived'; gridCode?: string },
) => api<CapabilityCatalog>('/kpm/settings/capability-mapping/status', {
  method: 'PATCH', body,
});

export const addCapabilityItem = (
  body: { part: 'milestone' | 'item'; code: string; label: string; gridCode?: string },
) => api<CapabilityCatalog>('/kpm/settings/capability-mapping/items', {
  method: 'POST', body,
});

export const reorderCapability = (body: { part: string; codes: string[] }) =>
  api<CapabilityCatalog>('/kpm/settings/capability-mapping/order', { method: 'PATCH', body });

// -------------------------------------- the script approval gate (P5-T10, ADR-0037)

export const listScriptReviews = () =>
  api<KpmProductRow[]>('/kpm/settings/products/script-reviews');

/** The approved words are frozen at this moment; a later edit returns the row to pending. */
export const approveScript = (productId: string) =>
  api<KpmProductRow>(`/kpm/settings/products/${productId}/script/approve`, { method: 'POST' });

/** A reason is required: "no" on its own is not something the writer can act on. */
export const rejectScript = (productId: string, reason: string) =>
  api<KpmProductRow>(`/kpm/settings/products/${productId}/script/reject`, {
    method: 'POST', body: { reason },
  });

/** The words an agent is actually served, and whose they are. */
export interface EffectiveScript {
  source: 'kpm' | 'company';
  script: Record<string, string | string[]>;
  /** The office's approved description (OD-136), else the company's tagline. */
  description: string;
}

/**
 * What an agent is actually served — the office's words only once approved.
 *
 * The return type is **named** rather than written inline: `api<…>` with a nested generic is
 * invisible to `check-api-consumers.py`, which reported this endpoint orphaned while the screen
 * was calling it. A contract with a name is the better code either way.
 */
export const readEffectiveScript = (productId: string) =>
  api<EffectiveScript>(`/kpm/settings/products/${productId}/script/effective`);

// -------------------------------------------- the metric registry, served rather than re-declared

/** One entry of the platform's metric vocabulary (P5-T9, invariant 7). */
export interface MetricDefinition {
  key: string;
  /** The registry's own name, so no screen holds a second copy of the vocabulary. */
  name: string;
  /** `idr_minor` means integer sen. */
  unit: string;
  phase: number;
  /** Whether it is measured by the time campaigns are evaluated — the server's answer, never derived from `phase`. */
  computed: boolean;
  /**
   * Whether a campaign requirement may name it (P18.5-T8 AC-1, D-evaluable): the Owner's picker offers only
   * these. A carrier rule may name any metric, so the Company template reads every row.
   */
  campaign: boolean;
}

/**
 * Every metric this product defines.
 *
 * Read rather than listed in a `<select>`: the campaigns screen carried five of the thirty-five
 * hard-coded, which is a second definition of the product's own vocabulary and could not name
 * the rest.
 */
export const listMetrics = () => api<MetricDefinition[]>('/metrics');
