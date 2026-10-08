'use client';

import { api } from './api-client';
import { formatCalendarDay } from './format';

/**
 * The Super Admin console's API surface.
 *
 * Mongo documents serialize with `_id`, not `id`. Renaming it here would be a lie the
 * next developer has to unpick when they compare a payload in Swagger against this
 * file, so the wire shape is kept as it is.
 */

export type TenantStatus = 'active' | 'suspended' | 'archived';

export interface Company {
  _id: string;
  name: string;
  slug: string;
  defaultCurrency: string;
  defaultTimezone: string;
  status: 'active' | 'suspended';
  /**
   * False means this company was created blank: no product catalog, no carrier rules, and
   * every Company template tab starts empty rather than from the platform's presets.
   */
  usesPlatformDefaults: boolean;
}

/**
 * A KPM as the console reads it.
 *
 * `ownerName`, `ownerEmail` and `companyName` are resolved by the API (P3.5-T14 AC-7).
 * The screens used to render `ownerUserId` — a 24-character hex string in a column
 * headed **Owner** — because no screen can turn a user id into a name and nothing was
 * asking the server to.
 *
 * `counters` is deliberately absent: the office's internal agent-code sequence used to
 * ride along on the wire and is nobody's business but the server's.
 */
export interface Kpm {
  _id: string;
  companyId: string;
  companyName: string;
  code: string;
  branchName: string;
  address: string | null;
  contactPhone: string | null;
  ownerUserId: string | null;
  /** Null when nobody owns the office. `'Unknown'` when the owner's account has gone. */
  ownerName: string | null;
  ownerEmail: string | null;
  timezone: string;
  locale: string;
  currency: string;
  status: TenantStatus;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  settings: Record<string, number>;
}

export interface AuditEntry {
  _id: string;
  action: string;
  targetCollection: string;
  targetId: string | null;
  /**
   * What the target is called — a person's name, an office's code and branch, a company's
   * name. **Null when the id resolves to nothing, or to a collection nothing names yet**, and
   * the screen shows the id instead: a blank cell would read as nothing happened.
   */
  targetLabel: string | null;
  actorUserId: string | null;
  actorName: string | null;
  effectiveUserId: string | null;
  effectiveName: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AttentionItem {
  tag: string;
  severity: 'structural' | 'approval' | 'template';
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
}

export interface CompanyCard {
  companyId: string;
  name: string;
  initials: string;
  kpmCount: number;
  memberCount: number;
  /** The company's active rungs, junior first. Empty when nobody has defined a ladder. */
  ladder: string[];
}

/** A rung on a company's role ladder (P3.5-T7, ADR-0012). */
export interface OrgLevel {
  orgLevelId: string;
  companyId: string;
  /** Stable and semantic. Never renamed, never reused — not even after archiving. */
  code: string;
  label: string;
  displayOrder: number;
  status: 'active' | 'archived';
  archivedAt: string | null;
}

export const listOrgLevels = () => api<OrgLevel[]>('/admin/org-levels');

export const createOrgLevel = (body: {
  companyId: string;
  code: string;
  label: string;
  displayOrder: number;
}) => api<OrgLevel[]>('/admin/org-levels', { method: 'POST', body });

/** No `code`: it is the identity every membership holds and is never updatable. */
export const updateOrgLevel = (
  orgLevelId: string,
  body: { label?: string; displayOrder?: number; status?: 'active' | 'archived' },
) => api<OrgLevel[]>(`/admin/org-levels/${orgLevelId}`, { method: 'PATCH', body });

export interface PlatformOverview {
  tiles: { companies: number; kpms: number; totalMembers: number; agencyBuilders: number };
  attention: AttentionItem[];
  companies: CompanyCard[];
}

export const readPlatformOverview = () => api<PlatformOverview>('/admin/overview');

export interface KpmRequestRow {
  requestId: string;
  branchName: string;
  companyId: string;
  companyName: string;
  requestedByName: string;
  requestedByEmail: string;
  note: string | null;
  status: 'pending' | 'approved' | 'declined';
  requestedAt: string;
  decidedAt: string | null;
  reason: string | null;
  createdKpmId: string | null;
}

export interface PlatformAdminRow {
  membershipId: string;
  fullName: string;
  email: string;
  initials: string;
  kpmId: string;
  kpmLabel: string;
  isOwner: boolean;
  isAdmin: boolean;
  grantedAt: string | null;
}

export const readTenantAdmins = () => api<PlatformAdminRow[]>('/admin/tenant-admins');

export const readKpmRequests = () => api<KpmRequestRow[]>('/admin/kpm-requests');

export const approveKpmRequest = (requestId: string, code: string) =>
  api<KpmRequestRow[]>(`/admin/kpm-requests/${requestId}/approve`, {
    method: 'POST',
    body: { code },
  });

export const declineKpmRequest = (requestId: string, reason?: string) =>
  api<KpmRequestRow[]>(`/admin/kpm-requests/${requestId}/decline`, {
    method: 'POST',
    body: { reason },
  });

export const listCompanies = () => api<Company[]>('/admin/companies');

export const createCompany = (
  body: { name: string; slug: string; usesPlatformDefaults?: boolean },
) => api<Company>('/admin/companies', { method: 'POST', body });

/** Rename, or change the slug. Both are labels; nothing stores either. */
export const updateCompany = (id: string, body: { name?: string; slug?: string }) =>
  api<Company>(`/admin/companies/${id}`, { method: 'PATCH', body });

/**
 * Suspend a company, or bring it back.
 *
 * A suspended company disappears from the list somebody registering chooses from. It does
 * not sign anybody out or suspend its offices — that is each office's own lifecycle.
 */
export const setCompanyStatus = (id: string, status: 'active' | 'suspended') =>
  api<Company>(`/admin/companies/${id}/status`, { method: 'PATCH', body: { status } });

/**
 * Where an office stands against its subscription's end date, computed by the API from **the office's**
 * today (ADR-0112, P13.2-T3): `none` — no end date; `active` — the end is today or later; `ended` — past
 * it, every member refused; `ended_kept_active` — past it, and kept open.
 */
export type SubscriptionState = 'none' | 'active' | 'ended' | 'ended_kept_active';

/** An office's subscription (ADR-0112 §1). Dates are office dates; money integer IDR sen. */
export interface TenantSubscription {
  startDate: string | null;
  /** The last day the office can be used. */
  endDate: string | null;
  /** Per leader per month, in sen, whole rupiah. Informational: nothing is charged from it. */
  pricePerLeaderMinor: number | null;
  currency: 'IDR';
  /** Null: no leader limit. */
  maxLeaders: number | null;
  keepActiveAfterEnd: boolean;
}

/**
 * What the Super Admin's offices list and detail read beyond the office itself (P13.2-T3 AC-3).
 * `leadersUsed` is ADR-0113's count: active members at AB or AAB, the Owner and an Admin included.
 */
export interface TenantAdminFields {
  subscription: TenantSubscription | null;
  leadersUsed: number;
  subscriptionState: SubscriptionState;
}

/** An office as `/admin/tenants` lists it. */
export type TenantRow = Kpm & TenantAdminFields;

export const listTenants = () => api<TenantRow[]>('/admin/tenants');

export const readTenant = (id: string) => api<TenantRow>(`/admin/tenants/${id}`);

/** The five fields, every time: the API takes the whole subscription, never a part of it. */
export type SubscriptionInput = Omit<TenantSubscription, 'currency'>;

/** Set an office's subscription. The Super Admin's alone; answered with the row as the list reads it. */
export const updateSubscription = (kpmId: string, body: SubscriptionInput) =>
  api<TenantRow>(`/admin/tenants/${kpmId}/subscription`, { method: 'PATCH', body });

/**
 * **Start from** (ADR-0115 §4): one of the company's active templates, the AgencyBoost defaults, or
 * *Empty*. Left out, the company's default template — what approving a KPM request uses.
 */
export type StartFrom =
  | { kind: 'template'; templateId: string }
  | { kind: 'defaults' }
  | { kind: 'empty' };

export interface CreateKpmInput {
  companyId: string;
  code: string;
  branchName: string;
  address?: string;
  contactPhone?: string;
  startFrom?: StartFrom;
}

export const createTenant = (body: CreateKpmInput) =>
  api<Kpm>('/admin/tenants', { method: 'POST', body });

/** By email, which is what a Super Admin knows. The id is accepted too, for Swagger. */
export const assignOwner = (id: string, who: { email?: string; userId?: string }) =>
  api<Kpm>(`/admin/tenants/${id}/owner`, { method: 'PATCH', body: who });

export const setTenantStatus = (id: string, status: TenantStatus, reason?: string) =>
  api<Kpm>(`/admin/tenants/${id}/status`, { method: 'PATCH', body: { status, reason } });

/** Omitting `kpmId` reads the platform-level log — provisioning, companies, impersonation. */
export const readAudit = (kpmId?: string) =>
  api<AuditEntry[]>(kpmId ? `/admin/audit?kpmId=${encodeURIComponent(kpmId)}` : '/admin/audit');

export const startImpersonation = (userId: string, reason: string, durationMinutes?: number) =>
  api<{
    accessToken: string;
    expiresAt: string;
    sessionId: string;
    /** True until a second Super Admin approves writing (§3.13). */
    readOnly: boolean;
  }>(`/admin/impersonate/${userId}`, {
    method: 'POST',
    body: { reason, ...(durationMinutes ? { durationMinutes } : {}) },
  });

export const endImpersonation = () =>
  api<{ status: string }>('/admin/impersonate/end', { method: 'POST' });

/** Tenant status is a lifecycle, not a health signal — so it gets its own labels. */
export const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  archived: 'Archived',
};

/**
 * **What the Status column reads** (ADR-0112 §2, P13.2-T3 AC-7): *Ended* or *Ended — kept active* in
 * place of *Active* when the subscription's end has passed. A suspended or archived office keeps its own
 * word, which says more: its members meet that refusal first.
 */
export function tenantStatusWord(row: Pick<TenantRow, 'status' | 'subscriptionState'>): string {
  if (row.status === 'active' && row.subscriptionState === 'ended') return 'Ended';
  if (row.status === 'active' && row.subscriptionState === 'ended_kept_active') return 'Ended — kept active';
  return TENANT_STATUS_LABEL[row.status];
}

/** The pill's tone for the same: an office its members cannot use reads as alert. */
export function tenantStatusTone(
  row: Pick<TenantRow, 'status' | 'subscriptionState'>,
): 'success' | 'alert' | 'watch' | 'neutral' {
  if (row.status === 'suspended') return 'alert';
  if (row.status === 'archived') return 'neutral';
  if (row.subscriptionState === 'ended') return 'alert';
  // Open, and past its end: the amber `watch` paint, navy words — somebody should look.
  if (row.subscriptionState === 'ended_kept_active') return 'watch';
  return 'success';
}

/**
 * The subscription in one line, for the detail page's *Lifecycle* card (P13.2-T3 AC-8): *No end date*,
 * *Active until January 5, 2027*, *Ended September 25, 2026*, or *Ended October 2, 2026 — kept active*.
 */
export function subscriptionLine(row: Pick<TenantRow, 'subscription' | 'subscriptionState'>): string {
  const end = row.subscription?.endDate;
  if (!end || row.subscriptionState === 'none') return 'No end date';
  const day = formatCalendarDay(end);
  if (row.subscriptionState === 'ended') return `Ended ${day}`;
  if (row.subscriptionState === 'ended_kept_active') return `Ended ${day} — kept active`;
  return `Active until ${day}`;
}

/** *Leaders* (ADR-0112 §2): `"{used} / {max}"`, or the count alone when the office has no limit. */
export function leadersWord(row: Pick<TenantRow, 'leadersUsed' | 'subscription'>): string {
  const max = row.subscription?.maxLeaders ?? null;
  return max === null ? String(row.leadersUsed) : `${row.leadersUsed} / ${max}`;
}

/** Filling a new office from a spreadsheet (P3.6-T4). */
export interface RosterIssue {
  /** The line a spreadsheet shows, header counted — so it can be read straight across. */
  line: number;
  column: string;
  message: string;
}

export interface RosterPreviewRow {
  line: number;
  fullName: string;
  email: string;
  agentCode: string;
  role: string;
}

export interface RosterPreview {
  issues: RosterIssue[];
  /** Zero the moment anything is wrong: the commit is all or nothing. */
  willCreate: number;
  rows: RosterPreviewRow[];
}

export interface ImportedPerson {
  fullName: string;
  email: string;
  agentCode: string;
  /**
   * **The only place this exists.** Not stored in plaintext and not recoverable — if it
   * is lost before it reaches the person, they use Forgot your password instead.
   */
  temporaryPassword: string;
}

export const rosterTemplate = () =>
  api<{
    header: string;
    columns: string[];
    /** The whole file, with worked examples commented out so they never import. */
    template: string;
    /**
     * The same three example rows, as cells — what the paste box shows, joined with tabs.
     *
     * Cells rather than the CSV lines above, so this screen never splits a quoted field.
     * That would be a second parser, and it would disagree with the server's over exactly
     * the row that is there to demonstrate quoting.
     */
    examples: string[][];
  }>('/admin/tenants/roster-template');

/** `rows`, not `csv`: it is also the tab-separated text a spreadsheet paste produces. */
export const previewRoster = (kpmId: string, rows: string) =>
  api<RosterPreview>(`/admin/tenants/${kpmId}/roster/preview`, { method: 'POST', body: { rows } });

export const importRoster = (kpmId: string, rows: string) =>
  api<{ created: ImportedPerson[] }>(`/admin/tenants/${kpmId}/roster`, {
    method: 'POST',
    body: { rows },
  });

export type TemplateKind =
  | 'activity_taxonomy'
  | 'lead_pipeline'
  | 'ratio_set'
  | 'activation_checklist'
  | 'training_taxonomy'
  | 'capability_ladder'
  // ADR-0034: types, never occurrences. There is no kind for an event or a campaign itself.
  | 'event_types'
  | 'campaign_kinds';

export interface CompanyTemplate {
  id: string;
  companyId: string;
  /** The named template this kind belongs to; `null` for `campaign_kinds`, the company's own. */
  templateId: string | null;
  kind: TemplateKind;
  /** The version this is, or will be once published. */
  version: number;
  status: 'draft' | 'published' | 'archived';
  payload: Record<string, unknown>;
  publishedAt: string | null;
  /** What new offices are seeded from today. Null when nothing is published. */
  publishedVersion: number | null;
  /**
   * Offices of this company built from an older version of **this kind**, or from the platform
   * defaults because nothing of it was published (P5-T12).
   */
  officesBehind: number;
  /**
   * Offices created before the version of this kind they started from was recorded. Whether
   * they are current is not known, so they are never counted as behind.
   */
  officesUnrecorded: number;
}

/**
 * The query of a kind route: `templateId=` the template named, or nothing — the company's default. The
 * `?` stays in the path whichever, so a reader and the API-consumers gate both see where the path ends.
 */
const ofTemplate = (templateId?: string | null) =>
  (templateId ? new URLSearchParams({ templateId }).toString() : '');

/**
 * One kind of one of a company's templates (P4-T8, ADR-0018, ADR-0115).
 *
 * The draft if there is one, else the newest published, else nothing — version 0 and an empty
 * payload, which is what an office made from the template gets of the kind. `templateId` absent:
 * the company's default.
 */
export const readTemplate = (companyId: string, kind: TemplateKind, templateId?: string | null) =>
  api<CompanyTemplate>(`/admin/companies/${companyId}/template/${kind}?${ofTemplate(templateId)}`);


/** The whole payload, not a patch — see the DTO for why. */
export const saveTemplateDraft = (
  companyId: string,
  kind: TemplateKind,
  payload: Record<string, unknown>,
  templateId?: string | null,
) => api<CompanyTemplate>(`/admin/companies/${companyId}/template/${kind}?${ofTemplate(templateId)}`, {
  method: 'PUT', body: { payload },
});

/** Becomes what the **next** office made from the template gets. Reaches nothing that already exists. */
export const publishTemplate = (companyId: string, kind: TemplateKind, templateId?: string | null) =>
  api<CompanyTemplate>(`/admin/companies/${companyId}/template/${kind}/publish?${ofTemplate(templateId)}`, {
    method: 'POST',
  });

/** The seven kinds a named template holds; `campaign_kinds` is the company's (ADR-0115 §3). */
export type OfficeTemplateKind = Exclude<TemplateKind, 'campaign_kinds'>;

/** Where a template came from: a record for the list and the audit, never a link. */
export interface TemplateOrigin {
  kind: 'migration' | 'empty' | 'defaults' | 'copy' | 'office' | 'import';
  templateId?: string | null;
  kpmId?: string | null;
  companyId?: string | null;
}

/** One of a company's named templates (ADR-0115 §3). */
export interface NamedTemplate {
  id: string;
  companyId: string;
  name: string;
  /** The company's default: exactly one, and what a KPM request's approval starts an office from. */
  isDefault: boolean;
  status: 'active' | 'archived';
  archivedAt: string | null;
  origin: TemplateOrigin;
  /** Each kind's newest published version; `null` where none is, which its offices get empty. */
  publishedVersions: Record<OfficeTemplateKind, number | null>;
  /** The live offices it answers for. */
  officeCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Every template of a company, archived ones too, the default first. */
export const listTemplates = (companyId: string) =>
  api<NamedTemplate[]>(`/admin/companies/${companyId}/templates`);

/**
 * *New template*: empty, each kind a published version 1 of the AgencyBoost defaults, or **a copy** of one
 * of the company's templates — each kind's newest published version as the copy's version 1 (P13.2-T7).
 */
export const createTemplate = (
  companyId: string,
  body: { name: string; from: 'empty' | 'defaults' | { templateId: string } },
) => api<NamedTemplate>(`/admin/companies/${companyId}/templates`, { method: 'POST', body });

/**
 * *Import from another company* (ADR-0115 §5, P13.2-T7): one of `fromCompanyId`'s templates becomes a new
 * template of this company. Refused `409 TEMPLATE_RUNG_UNKNOWN` when it names a role this company's ladder
 * lacks.
 */
export const importTemplate = (
  companyId: string,
  body: { fromCompanyId: string; templateId: string; name: string },
) => api<NamedTemplate>(`/admin/companies/${companyId}/templates/import`, { method: 'POST', body });

/**
 * Something the office held that *Save as template* left out or changed because it names something
 * archived — a ratio's archived activity type, a stage's archived milestones, a checklist link to a module
 * no longer offered (P13.2's exit review). `reason` is the API's sentence, shown as it is.
 */
export interface DroppedSetting {
  kind: OfficeTemplateKind;
  /** The ratio, stage, grid or checklist item; `null` when the whole kind was left out. */
  code: string | null;
  reason: string;
}

/** *Save as template*'s answer: the template, and what it left out. Empty `dropped` when nothing was. */
export type SavedOfficeTemplate = NamedTemplate & { dropped: DroppedSetting[] };

/**
 * *Save as template* (ADR-0115 §5, P13.2-T7): what an office's agents read becomes a new template of
 * `companyId` — the office's own company, or another.
 */
export const saveOfficeAsTemplate = (kpmId: string, body: { name: string; companyId: string }) =>
  api<SavedOfficeTemplate>(`/admin/tenants/${kpmId}/template`, { method: 'POST', body });

/** *Rename*, or *Make default* — which moves the default here. */
export const updateTemplate = (
  companyId: string, templateId: string, body: { name?: string; isDefault?: boolean },
) => api<NamedTemplate>(`/admin/companies/${companyId}/templates/${templateId}`, { method: 'PATCH', body });

/** *Archive*: kept and readable, no longer offered. Refused for the default. */
export const archiveTemplate = (companyId: string, templateId: string) =>
  api<NamedTemplate>(`/admin/companies/${companyId}/templates/${templateId}/archive`, { method: 'POST' });


/**
 * Approve a session to write — **a different Super Admin from the one running it**.
 *
 * The API refuses the session's own starter. That is the control, not a formality: an
 * admin session can rewrite the configuration every member of an office depends on.
 */
export const elevateImpersonation = (sessionId: string, reason: string) =>
  api<void>(`/admin/impersonation/${sessionId}/elevate`, { method: 'POST', body: { reason } });

// ---------------------------------------------------------------- the product catalog (P5-T4)

export interface AttackPlan {
  goodFit: string;
  opening: string;
  benefits: string[];
  fullScript: string;
  objectionTheySay: string;
  objectionYouSay: string;
  nextAction: string;
}

export interface CommissionYear {
  year: number;
  /** A proportion: `0.4` is 40%. The company states it; nothing here invents one (F-15). */
  rate: number;
}

/**
 * The most policy years a commission schedule holds: the API refuses a year past it
 * (`CommissionYearDto.year`, `@Max(50)`). Held to the API document by `contract.spec.ts`.
 */
export const COMMISSION_MAX_YEARS = 50;

export type ProductLifecycle = 'active' | 'closed_to_new_business' | 'withdrawn';

export interface Product {
  id: string;
  companyId: string;
  /** The identity. Typed once, never changed, never reused (ADR-0006). */
  code: string;
  name: string;
  tagline: string;
  channel: 'conventional' | 'syariah';
  category: 'life' | 'health' | 'ci' | 'education' | 'investment';
  primaryNeeds: string[];
  eligibleAgeBands: number[];
  eligibleBudgetBands: number[];
  benefits: string[];
  differentiator: string;
  bestFor: string;
  defaultAttackPlan: AttackPlan;
  /** Absent for a reader without `commission_rates:read` — never sent rather than hidden. */
  commissionSchedule?: CommissionYear[];
  lifecycle: ProductLifecycle;
  replacedByProductId: string | null;
  /** What an office sells before its Owner has an opinion about it (ADR-0033). */
  activeByDefault: boolean;
  sortOrder: number;
  version: number;
}

/** Everything a write may set. Never the code, never the lifecycle. */
export type ProductFields = Partial<Omit<
  Product, 'id' | 'companyId' | 'code' | 'lifecycle' | 'replacedByProductId' | 'sortOrder' | 'version'
>>;

/**
 * A company's whole catalog, in order, withdrawn rows included (P5-T4, ADR-0033).
 *
 * **Read live, not from a template.** This is why the Products tab has no draft and no version:
 * what is written here reaches every office of the company on their next read.
 */
export const readProducts = (companyId: string) =>
  api<Product[]>(`/admin/companies/${companyId}/products`);

export const createProduct = (companyId: string, body: ProductFields & { code: string }) =>
  api<Product>(`/admin/companies/${companyId}/products`, { method: 'POST', body });

export const updateProduct = (companyId: string, productId: string, body: ProductFields) =>
  api<Product>(`/admin/companies/${companyId}/products/${productId}`, {
    method: 'PATCH', body,
  });

/** Closing, withdrawing and reopening are named acts, because each reaches every office. */
export const closeProductToNewBusiness = (
  companyId: string, productId: string, replacedByProductId?: string,
) => api<Product>(
  `/admin/companies/${companyId}/products/${productId}/close-to-new-business`,
  { method: 'POST', body: replacedByProductId ? { replacedByProductId } : {} },
);

export const withdrawProduct = (
  companyId: string, productId: string, replacedByProductId?: string,
) => api<Product>(`/admin/companies/${companyId}/products/${productId}/withdraw`, {
  method: 'POST', body: replacedByProductId ? { replacedByProductId } : {},
});

export const reopenProduct = (companyId: string, productId: string) =>
  api<Product>(`/admin/companies/${companyId}/products/${productId}/reopen`, { method: 'POST' });

/** The whole shelf, once each: two people dragging rows cannot interleave into a third order. */
export const reorderProducts = (companyId: string, productIds: string[]) =>
  api<Product[]>(`/admin/companies/${companyId}/products/reorder`, {
    method: 'PATCH', body: { productIds },
  });
