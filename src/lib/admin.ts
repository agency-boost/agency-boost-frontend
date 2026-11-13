'use client';

import { messagesIn } from '@/i18n/catalogue';
import { DEFAULT_LANGUAGE, SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { officeSubscriptionMessages } from '@/i18n/messages/office-subscription';
import { api, apiBlob } from './api-client';
import { formatCalendarDay } from './format';
import type { PlaybookBody, PlaybookLimits, RecruitmentVocabulary } from './recruitment-playbook';
import type { AnalyticsEditorView } from './advanced-analytics';

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
  /**
   * **An insurer, or the Template library** (ADR-0164): the one `template` company holds the templates a
   * new company and a new office copy. Nobody registers under it and it holds no office, so the screens
   * that mean *the insurers* leave it out (`insurersOf`).
   */
  kind: 'insurer' | 'template';
  /**
   * ***Dimulai kosong*** (P19.4-T3 AC-12; SA UI-017): made blank and its default template has no published section yet.
   * The list's alone — a write's answer leaves it out, and the page then reads `usesPlatformDefaults`.
   */
  startedBlank?: boolean;
}

/** Whether a company's row carries *Dimulai kosong*: the server's word on the list, else made blank (a write's answer). */
export const startedBlank = (company: Pick<Company, 'startedBlank' | 'usesPlatformDefaults'>) =>
  company.startedBlank ?? !company.usesPlatformDefaults;

/** Whether this is the Template library rather than an insurer (ADR-0164). */
export const isTemplateLibrary = (company: Pick<Company, 'kind'>) => company.kind === 'template';

/** The insurers: every company but the Template library, for a screen that offers a company to work in. */
export const insurersOf = <T extends Pick<Company, 'kind'>>(companies: T[]): T[] =>
  companies.filter((c) => !isTemplateLibrary(c));

/**
 * A KPM as the console reads it.
 *
 * `ownerName`, `ownerEmail` and `companyName` are resolved by the API (P3.1-T14 AC-7).
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
  /**
   * **The action in the reader's words** (P19.4-T3 AC-11; SA UI-016) — *"Draf template disimpan"*, never its code.
   * Absent from a server before it; the page then shows the action as recorded.
   */
  actionLabel?: string;
  targetCollection: string;
  /** What kind of thing the target is, in the reader's words (*"Produk"*); absent from a server before P19.4-T3. */
  targetKind?: string;
  targetId: string | null;
  /**
   * What the target is called — a person's name, *KPM 0417 · Bandung*, a company's, a template's, *"Prudential
   * template · Aktivitas & rasio"*, a product's (P19.4-T3 AC-11). **Null when the id resolves to nothing, or to a
   * collection nothing names yet**, and the screen shows the id instead: a blank cell would read as nothing happened.
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

/**
 * **One line of the audit page** (P19.2-T2 AC-6; `metrics-and-definitions.md` §B.32): the newest row of a run of
 * identical rows — the same actor, action and target within ten minutes of the newest — and how many it stands for
 * (*×28*). The server groups; the screen draws `count` as it is sent and never counts rows itself.
 */
export type AuditGroup = AuditEntry & AuditGroupSpan;

/** What a group adds to its newest row. */
export interface AuditGroupSpan {
  count: number;
  /** The oldest row's time; `createdAt` is the newest's. */
  oldestAt: string;
}

/** One actor the *Pelaku* chip offers. */
export interface AuditActor {
  userId: string;
  name: string | null;
}

/** What the chips offer, within the reach: on the first page only. */
export interface AuditFacets {
  actions: string[];
  /** Each action in the reader's words, for the *Tindakan* chip (P19.4-T3 AC-11). */
  actionLabels?: { action: string; label: string }[];
  actors: AuditActor[];
}

/** Where a page stands: the cursor to ask with next (*Muat lagi*), `null` on the last. */
export interface AuditPageInfo {
  cursor: string | null;
  nextCursor: string | null;
  limit: number;
  hasMore: boolean;
}

/** `GET /admin/audit`: at most fifty groups, newest first. */
export interface AuditPage {
  items: AuditGroup[];
  page: AuditPageInfo;
  facets: AuditFacets | null;
}

/** The page's filters. Each one absent narrows nothing; `kpmId` absent is the platform-level log. */
export interface AuditQuery {
  kpmId?: string;
  companyId?: string;
  action?: string;
  actorUserId?: string;
  /** Office days, `YYYY-MM-DD`, both inclusive. */
  from?: string;
  to?: string;
  cursor?: string;
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

/**
 * Whether a rung leads, and how (ADR-0156): *Senior Leader* (what AB is), *Associate Leader* (what AAB
 * is), or `null` — *Not a leader*. The class a member is given on the rung follows it, and the server
 * refuses a change while anybody stands on the rung (`ORG_LEVEL_TIER_IN_USE`).
 */
export type LeaderTier = 'senior' | 'associate';

/** A rung on a company's role ladder (P3.1-T7, ADR-0012). */
export interface OrgLevel {
  orgLevelId: string;
  companyId: string;
  /** Stable and semantic. Never renamed, never reused — not even after archiving. */
  code: string;
  label: string;
  displayOrder: number;
  leaderTier: LeaderTier | null;
  status: 'active' | 'archived';
  archivedAt: string | null;
  /** `0` for a rung never changed; moves on every write. Sent back as `expectedVersion` (P19-T6). */
  version: number;
}

export const listOrgLevels = (companyId?: string) =>
  api<OrgLevel[]>(`/admin/org-levels?${companyId ? new URLSearchParams({ companyId }) : ''}`);

export const createOrgLevel = (body: {
  companyId: string;
  code: string;
  label: string;
  displayOrder: number;
  leaderTier: LeaderTier | null;
}) => api<OrgLevel[]>('/admin/org-levels', { method: 'POST', body });

/**
 * No `code`: it is the identity every membership holds and is never updatable. `expectedVersion` is the rung's
 * `version` as read: one somebody else has moved past is refused `409 VERSION_CONFLICT`, nothing written (P19-T6).
 */
export const updateOrgLevel = (
  orgLevelId: string,
  body: {
    label?: string;
    displayOrder?: number;
    leaderTier?: LeaderTier | null;
    status?: 'active' | 'archived';
    expectedVersion?: number;
  },
) => api<OrgLevel[]>(`/admin/org-levels/${orgLevelId}`, { method: 'PATCH', body });

/**
 * **Delete an archived rung that nothing names** (ADR-0213 §2, B1-6): a soft delete, answering the company's ladder. A
 * live rung, or one anything in its company names, is `409 ORG_LEVEL_IN_USE` with `details.references` — each `{ kind,
 * count }` — and the sentence saying why; one changed since it was read is `409 VERSION_CONFLICT`.
 */
export const deleteOrgLevel = (orgLevelId: string, expectedVersion?: number) =>
  api<OrgLevel[]>(`/admin/org-levels/${orgLevelId}?${versionQuery(expectedVersion)}`, { method: 'DELETE' });

/** `expectedVersion=` for a query, or nothing: the `?` stays in the path, so the API-consumers gate sees where it ends. */
const versionQuery = (expectedVersion?: number) =>
  (expectedVersion === undefined ? '' : new URLSearchParams({ expectedVersion: String(expectedVersion) }).toString());

export interface PlatformOverview {
  tiles: { companies: number; kpms: number; totalMembers: number; agencyBuilders: number };
  attention: AttentionItem[];
  companies: CompanyCard[];
}

export const readPlatformOverview = () => api<PlatformOverview>('/admin/overview');

export interface KpmRequestRow {
  requestId: string;
  branchName: string;
  /** The company the office is asked for; the card's picker starts on it (P19-T3 AC-2). */
  companyId: string;
  companyName: string;
  requestedByName: string;
  requestedByEmail: string;
  /** P19-T3 AC-1: the applicant's number as they gave it. */
  requestedByPhone: string | null;
  /** The company the applicant signed up with (ADR-0191 §1): an Owner must belong to the office's. */
  requesterCompanyId: string | null;
  requesterCompanyName: string | null;
  /** ADR-0190 §4: only a verified address may own an office. */
  requesterEmailVerified: boolean;
  note: string | null;
  status: 'pending' | 'approved' | 'declined';
  requestedAt: string;
  decidedAt: string | null;
  reason: string | null;
  createdKpmId: string | null;
  /** What an approval made (P19-T3 AC-3); `deleted` once that office has been deleted. */
  createdKpm: { kpmId: string; code: string; branchName: string; deleted: boolean } | null;
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

/**
 * **"Setujui & jadikan Owner"** (ADR-0191 §3, P19-T3 AC-3): the office and its Owner in one step, or nothing. `companyId`
 * when the Super Admin corrected the company on the card. A second press answers the same office.
 */
export const approveKpmRequest = (requestId: string, code: string, companyId?: string, startFrom?: StartFrom) =>
  api<KpmRequestRow[]>(`/admin/kpm-requests/${requestId}/approve`, {
    method: 'POST',
    // *Mulai dari* (ADR-0213 §3): offered on the card only when the company has no template.
    body: { code, ...(companyId ? { companyId } : {}), ...(startFrom ? { startFrom } : {}) },
  });

/** *Hapus*: a wrong or duplicate request, soft-deleted and audited (P19-T3 AC-7). Answers the queue. */
export const deleteKpmRequest = (requestId: string) =>
  api<KpmRequestRow[]>(`/admin/kpm-requests/${requestId}`, { method: 'DELETE' });

/** Whether a KPM code is free in a company, and which live office holds it when not (P19-T3 AC-2). */
export interface CodeAvailability {
  available: boolean;
  takenBy: { kpmId: string; code: string; branchName: string; companyName: string } | null;
}

export const checkKpmCode = (companyId: string, code: string) =>
  api<CodeAvailability>(
    `/admin/tenants/code-availability?companyId=${encodeURIComponent(companyId)}&code=${encodeURIComponent(code)}`,
  );

/** An office an account owns or belongs to, as *Ganti Owner* shows it (P19-T3 AC-5). */
export interface AccountOffice {
  kpmId: string;
  code: string;
  branchName: string;
  companyName: string;
  isOwner: boolean;
  membershipStatus: 'active' | 'pending' | null;
}

/** One account *Ganti Owner* may choose (`GET /admin/accounts`, P19-T3 AC-5). */
export interface AccountChoice {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  companyId: string | null;
  companyName: string | null;
  hasAgentCode: boolean;
  emailVerified: boolean;
  status: 'invited' | 'active' | 'deactivated';
  offices: AccountOffice[];
}

/** By part of a name or an email address, two characters at least; twenty at most. */
export const searchAccounts = (q: string) =>
  api<AccountChoice[]>(`/admin/accounts?q=${encodeURIComponent(q)}`);

export const declineKpmRequest = (requestId: string, reason?: string) =>
  api<KpmRequestRow[]>(`/admin/kpm-requests/${requestId}/decline`, {
    method: 'POST',
    body: { reason },
  });

export const listCompanies = () => api<Company[]>('/admin/companies');

/**
 * `usesPlatformDefaults` true, the default, copies the Template library — its ladder, products, carrier
 * rules, playbook and Default template; false starts the company *Empty* (ADR-0164 §4).
 */
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
  /**
   * *Paket* (ADR-0211 §1; P19.4-T3): *6 bulan* or *Tahunan*; null or absent (a subscription from before), none. Its
   * renewal date is `endDate`. Absent from a write keeps the office's.
   */
  plan?: SubscriptionPlan | null;
}

/** A subscription's plan (ADR-0211 §1): the codes the API carries. */
export type SubscriptionPlan = 'six_months' | 'annual';

/**
 * What the Super Admin's offices list and detail read beyond the office itself (P13.2-T3 AC-3).
 * `leadersUsed` is ADR-0113's count: active members at AB or AAB, the Owner and an Admin included.
 */
export interface TenantAdminFields {
  subscription: TenantSubscription | null;
  leadersUsed: number;
  subscriptionState: SubscriptionState;
  /**
   * **Where the Owner stands** (ADR-0212 §2, §3; P19.4-T3): `none` — no Owner and none named; `not_invited` — *Belum
   * diundang* (never sent one, or named with no email); `invited` — *Diundang*; `active` — *Aktif*, signed in.
   */
  ownerState: OwnerState;
  /** The Owner's WhatsApp number, `+62…` — a number to call, never a channel (ADR-0212 §4). */
  ownerPhone: string | null;
  ownerInvitedAt: string | null;
  /** An Owner named with no email, waiting (`kpms.pendingOwner`). */
  pendingOwner: PendingOwner | null;
  /** Live memberships, the Owner's own included. */
  memberCount: number;
  /** The same without the Owner's: *"Belum ada anggota"* while 0 (SA R5). */
  membersBesidesOwner: number;
}

/** The Owner's state as the console reads it (ADR-0212 §2). */
export type OwnerState = 'none' | 'not_invited' | 'invited' | 'active';

/** An Owner named with no email (ADR-0212 §3). */
export interface PendingOwner {
  fullName: string;
  phone: string;
  agentCode: string | null;
}

/** An office as `/admin/tenants` lists it. */
export type TenantRow = Kpm & TenantAdminFields;

/**
 * ***Data terakhir*** and ***Perlu tindakan*** (P19.4-T3 AC-8): the latest month the office's file holds, and the last
 * ended month when it is missing and the office existed in it — whether a month was uploaded, never a figure.
 */
export interface TenantDataStatus {
  latestMonth: string | null;
  missingMonth: string | null;
}

/** A row of `GET /admin/tenants`: the office, and its data status. */
export type TenantListRow = TenantRow & { dataStatus: TenantDataStatus };

export const listTenants = () => api<TenantListRow[]>('/admin/tenants');

export const readTenant = (id: string) => api<TenantRow>(`/admin/tenants/${id}`);

/** The five fields, every time: the API takes the whole subscription, never a part of it. */
export type SubscriptionInput = Omit<TenantSubscription, 'currency'>;

/** Set an office's subscription. The Super Admin's alone; answered with the row as the list reads it. */
export const updateSubscription = (kpmId: string, body: SubscriptionInput) =>
  api<TenantRow>(`/admin/tenants/${kpmId}/subscription`, { method: 'PATCH', body });

/**
 * **Start from** (ADR-0115 §4): one of the company's active templates, one of the Template library's
 * (`templateLibrary`, ADR-0164 §5), or *Empty*. Left out, the company's default template — what approving a
 * KPM request uses. The AgencyBoost defaults are not a choice: the Template's Default template holds them, and
 * the API refuses `{ kind: 'defaults' }` (ADR-0168 §2).
 */
export type StartFrom =
  | { kind: 'template'; templateId: string }
  | { kind: 'template'; templateLibrary: true; templateId?: string }
  | { kind: 'empty' };

/** *Pemilik KPM* (ADR-0212 §1): a name and a WhatsApp number, required; the email the invitation goes to. */
export interface OwnerInput {
  fullName: string;
  phone: string;
  email?: string;
  agentCode?: string;
}

export interface CreateKpmInput {
  companyId: string;
  code: string;
  branchName: string;
  address?: string;
  contactPhone?: string;
  startFrom?: StartFrom;
  /** Absent: *"Lewati, nanti saja"* — a KPM with no Owner (P19.4-T3 AC-6). */
  owner?: OwnerInput;
  /** *"Kirim undangan … sekarang"*: on unless `false`. */
  sendInvitation?: boolean;
}

/** `invitationSent`: the Owner's invitation is on its way (ADR-0212 §2). */
export const createTenant = (body: CreateKpmInput) =>
  api<Kpm & { invitationSent: boolean }>('/admin/tenants', { method: 'POST', body });

/**
 * By email, which is what a Super Admin knows, or by id from the picker; or `owner`, somebody named with their email,
 * made the Owner and invited (ADR-0212 §3). Answers the office as the list reads it.
 */
export const assignOwner = (
  id: string,
  who: { email?: string; userId?: string; owner?: OwnerInput; sendInvitation?: boolean },
) => api<TenantRow>(`/admin/tenants/${id}/owner`, { method: 'PATCH', body: who });

/** *Kirim ulang undangan* (ADR-0212 §2): a new link to the Owner's email, the old revoked. */
export const resendOwnerInvitation = (id: string) =>
  api<TenantRow>(`/admin/tenants/${id}/owner/invitation`, { method: 'POST' });

export const setTenantStatus = (id: string, status: TenantStatus, reason?: string) =>
  api<Kpm>(`/admin/tenants/${id}/status`, { method: 'PATCH', body: { status, reason } });

/**
 * *Pindahkan ke perusahaan lain* (ADR-0191 §5, P19-T3 AC-6): only an office with no member but its Owner, its settings
 * provisioned again from the new company's default template. Answers the office as the list reads it.
 */
export const moveTenantCompany = (id: string, companyId: string) =>
  api<TenantRow>(`/admin/tenants/${id}/company`, { method: 'PATCH', body: { companyId } });

/** What an office holds — what *Hapus KPM*'s confirmation shows (P19-T3 AC-7). */
export interface TenantContents {
  /** Every membership, the Owner's included. */
  members: number;
  /** Every row carrying the office, apart from its settings and the audit log. */
  records: number;
  deletable: boolean;
}

export const readTenantContents = (id: string) => api<TenantContents>(`/admin/tenants/${id}/contents`);

/** *Hapus KPM*: a soft delete of an empty office (P19-T3 AC-7); one with a member or a record is archived instead. */
export const deleteTenant = (id: string) =>
  api<{ deleted: true; kpmId: string }>(`/admin/tenants/${id}`, { method: 'DELETE' });

/** Omitting `kpmId` reads the platform-level log — provisioning, companies, impersonation. */
/** One page of the audit log, filtered and grouped on the server (§B.32); the query's empty fields are left off. */
export const readAudit = (query: AuditQuery = {}) => {
  const params = new URLSearchParams(
    Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''),
  ).toString();
  return api<AuditPage>(params ? `/admin/audit?${params}` : '/admin/audit');
};

/**
 * **Start a support session, which only looks** (ADR-0206 §3; P19.4-T2): no purpose is sent, so the API starts the one
 * kind there is. Every write of the session is `403 IMPERSONATION_READ_ONLY`; the setup session is retired.
 */
export const startImpersonation = (userId: string, reason: string, durationMinutes?: number) =>
  api<{
    accessToken: string;
    expiresAt: string;
    sessionId: string;
    /** Always `true`: a session only looks. */
    readOnly: true;
  }>(`/admin/impersonate/${userId}`, {
    method: 'POST',
    body: { reason, ...(durationMinutes ? { durationMinutes } : {}) },
  });

export const endImpersonation = () =>
  api<{ status: string }>('/admin/impersonate/end', { method: 'POST' });

/**
 * Tenant status is a lifecycle, not a health signal — so it gets its own labels. The catalogue's English
 * (`i18n/messages/office-subscription.ts`); a screen reads its reader's with `tenantStatusLabels(language)`.
 */
export const TENANT_STATUS_LABEL: Readonly<Record<TenantStatus, string>> = officeSubscriptionMessages.en.status;

/** The three lifecycle words in the reader's `language` (P18.10-T6), English, the source, when given none. */
export const tenantStatusLabels = (language: Language = SOURCE_LANGUAGE): Readonly<Record<TenantStatus, string>> =>
  messagesIn(officeSubscriptionMessages, language).status;

/**
 * **What the Status column reads** (ADR-0112 §2, P13.2-T3 AC-7): *Ended* or *Ended — kept active* in
 * place of *Active* when the subscription's end has passed. A suspended or archived office keeps its own
 * word, which says more: its members meet that refusal first. In the reader's `language` (P18.10-T6).
 */
export function tenantStatusWord(
  row: Pick<TenantRow, 'status' | 'subscriptionState'>,
  language: Language = SOURCE_LANGUAGE,
): string {
  const t = messagesIn(officeSubscriptionMessages, language);
  if (row.status === 'active' && row.subscriptionState === 'ended') return t.ended;
  if (row.status === 'active' && row.subscriptionState === 'ended_kept_active') return t.endedKeptActive;
  return t.status[row.status];
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
 * *Active until 5 Jan 2027*, *Ended 25 Sep 2026*, or *Ended 2 Oct 2026 — kept active*. The date in the
 * figures' language, the words in the words' (P18.10-T6): Indonesian figures and English words when given neither.
 */
export function subscriptionLine(
  row: Pick<TenantRow, 'subscription' | 'subscriptionState'>,
  figures: Language = DEFAULT_LANGUAGE,
  language: Language = SOURCE_LANGUAGE,
): string {
  const t = messagesIn(officeSubscriptionMessages, language);
  const end = row.subscription?.endDate;
  if (!end || row.subscriptionState === 'none') return t.noEndDate;
  const day = formatCalendarDay(end, figures);
  if (row.subscriptionState === 'ended') return t.endedOn({ day });
  if (row.subscriptionState === 'ended_kept_active') return t.endedOnKeptActive({ day });
  return t.activeUntil({ day });
}

/** *Leaders* (ADR-0112 §2): `"{used} / {max}"`, or the count alone when the office has no limit. */
export function leadersWord(row: Pick<TenantRow, 'leadersUsed' | 'subscription'>): string {
  const max = row.subscription?.maxLeaders ?? null;
  return max === null ? String(row.leadersUsed) : `${row.leadersUsed} / ${max}`;
}

/**
 * **How far past its limit an office is** (ADR-0157 §4): AgencyBoost approved leaders beyond it, and the quota did
 * not move — so `13 / 10` is a normal state, and the list says *3 over*. `0` at or under the limit, or with none.
 */
export function leadersOver(row: Pick<TenantRow, 'leadersUsed' | 'subscription'>): number {
  const max = row.subscription?.maxLeaders ?? null;
  return max === null ? 0 : Math.max(0, row.leadersUsed - max);
}

/** The *Leaders* cell in words, for a screen reader: *13 leaders of a limit of 10, 3 over* — in the reader's `language`. */
export function leadersSaid(
  row: Pick<TenantRow, 'leadersUsed' | 'subscription'>,
  language: Language = SOURCE_LANGUAGE,
): string {
  return messagesIn(officeSubscriptionMessages, language).leadersSaid({
    used: row.leadersUsed, max: row.subscription?.maxLeaders ?? null, over: leadersOver(row),
  });
}

/** Filling and updating an office from a spreadsheet (P3.2-T4; the setup spec's §A3 since P19.3-T4, ADR-0205). */
export interface RosterIssue {
  /** The line a spreadsheet shows, header counted — so it can be read straight across. */
  line: number;
  /** `file`, or the column's header name. */
  column: string;
  message: string;
}

/**
 * **Skipped, updated or imported** (A3): what one row of the file comes to — or **invited** (ADR-0250 §4): a new Agent
 * with no email, invited on WhatsApp as *+ Tambah agent* invites, who registers through the link.
 */
export type RosterOutcome = 'imported' | 'updated' | 'invited' | 'skipped';

export interface RosterPreviewRow {
  line: number;
  agentCode: string;
  fullName: string;
  /** The rung as the file names it. */
  role: string;
  /** The upline's agent code; empty for none. */
  leaderAgentCode: string;
  email: string;
  outcome: RosterOutcome;
  /** A3's words for the row, in the reader's language: why it is skipped, or what importing or updating it notes. */
  messages: string[];
  /**
   * **What the row leaves out** (ADR-0250 §2, §3), in the reader's language: an optional cell left empty for its shape,
   * no WhatsApp number, the details neither the row nor the record holds. Empty for a skipped row.
   */
  warnings: string[];
  /** On the import's answer only, for an `invited` row: the link to share on WhatsApp, and the number it goes to. */
  invite?: { link: string; phone: string };
}

export interface RosterPreview {
  /** What makes the file unreadable as a whole; with any, `rows` is empty and nothing would be written. */
  issues: RosterIssue[];
  /** The file's header, as it reads. */
  header: string[];
  /** *"N orang baru siap diimpor, M diperbarui, K baris dilewati"* (A3), and *J diundang lewat WhatsApp* (ADR-0250 §4). */
  counts: { imported: number; updated: number; invited: number; skipped: number };
  rows: RosterPreviewRow[];
  /** The skipped rows as a CSV — the file's columns and `Alasan` — or `null` when none is skipped (A3). */
  skippedCsv: string | null;
}

/** What the import did: the same rows, now done. **No password** — new people are invited to choose their own. */
export interface RosterImportResult extends RosterPreview {
  /** How many new people were emailed an invitation. Those invited on WhatsApp are `counts.invited`. */
  invited: number;
}

export const rosterTemplate = () =>
  api<{
    header: string;
    columns: string[];
    /** The CSV template: the header and nothing else since ADR-0184. */
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

/** The valid rows, as one unit; `invite` mails each new person a link to choose their password (ADR-0205 §10). */
export const importRoster = (kpmId: string, rows: string, invite = true) =>
  api<RosterImportResult>(`/admin/tenants/${kpmId}/roster`, {
    method: 'POST',
    body: { rows, invite },
  });

/** The two files the roster template comes in (ADR-0184): Excel, the recommended one, and CSV. */
export type RosterTemplateFormat = 'xlsx' | 'csv';

/** What each is saved as. */
export const ROSTER_TEMPLATE_FILENAME: Record<RosterTemplateFormat, string> = {
  xlsx: 'roster-template.xlsx',
  csv: 'roster-template.csv',
};

/**
 * **The template as a file** (ADR-0184), fetched with the token and saved by the screen (`saveFile`). `kpmId` names the
 * office whose company ladder fills the workbook's *role* dropdown.
 */
export const downloadRosterTemplate = (format: RosterTemplateFormat, kpmId: string) =>
  apiBlob(`/admin/tenants/roster-template?format=${format}&kpmId=${encodeURIComponent(kpmId)}`);

/**
 * **A roster file — an Excel workbook or a CSV — sent as it is** (ADR-0184): bytes in a form, read on the server by
 * the same parser as a paste. The browser opens nothing, so no spreadsheet code is in the bundle.
 */
const rosterForm = (file: File, invite?: boolean) => {
  const form = new FormData();
  if (invite !== undefined) form.append('invite', invite ? 'true' : 'false');
  form.append('file', file);
  return form;
};

export const previewRosterFile = (kpmId: string, file: File) =>
  api<RosterPreview>(`/admin/tenants/${kpmId}/roster/file/preview`, { method: 'POST', body: rosterForm(file) });

export const importRosterFile = (kpmId: string, file: File, invite = true) =>
  api<RosterImportResult>(`/admin/tenants/${kpmId}/roster/file`, { method: 'POST', body: rosterForm(file, invite) });

/** What the skipped rows are saved as (A3's *"⬇ Unduh baris yang dilewati"*). */
export const SKIPPED_ROWS_FILENAME = 'baris-dilewati.csv';

export type TemplateKind =
  | 'activity_taxonomy'
  | 'lead_pipeline'
  | 'ratio_set'
  | 'activation_checklist'
  | 'training_taxonomy'
  | 'capability_ladder'
  // ADR-0034: types, never occurrences. There is no kind for an event or a campaign itself.
  | 'event_types'
  | 'campaign_kinds'
  // ADR-0210: the recruitment playbook, a template section — read live by each KPM, never copied into one.
  | 'recruitment_playbook'
  // ADR-0214 §1: the *Advanced analytics* section — read live by every KPM on the template, never copied, never pushed.
  | 'advanced_analytics'
  // P19.6-T1 (ADR-0218 §3): the ninth section, *Tampilan* — read live by every KPM on the template, never pushed.
  | 'branding';

export interface CompanyTemplate {
  id: string;
  companyId: string;
  /** The named template this kind belongs to; `null` for `campaign_kinds`, the company's own. */
  templateId: string | null;
  kind: TemplateKind;
  /** The version this is, or will be once published. */
  version: number;
  /**
   * How many times the kind's working copy has been written; `0` for nothing saved. A draft save sends it back
   * (`expectedRevision`), and one somebody else has saved or published past is `409 VERSION_CONFLICT` (P19-T6).
   */
  revision: number;
  status: 'draft' | 'published' | 'archived';
  payload: Record<string, unknown>;
  publishedAt: string | null;
  /** What new offices are seeded from today. Null when nothing is published. */
  publishedVersion: number | null;
  /**
   * The read only (P19-T6): the newest published version beside the draft — what offices are made from today — or
   * `null` where nothing is published.
   */
  published?: {
    id: string;
    version: number;
    revision: number;
    payload: Record<string, unknown>;
    publishedAt: string | null;
  } | null;
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
  /**
   * The activation checklist's links as the server resolves them (P18.2-T3 AC-6, I-80): by kind —
   * `feature:goals`, `feature:leads`, `feature:activity`, and `training` for every `training:<code>`.
   * Only on the `activation_checklist` kind; the badge says *Auto* from `live`, never from an assumption.
   */
  linkKinds?: TemplateLinkKinds | null;
  /**
   * `recruitment_playbook` only (ADR-0210 §1): the AgencyBoost words to start from, the brief's vocabulary the words are
   * keyed by, in the reader's language, and the bounds a publish holds each text to — served, never re-declared.
   */
  playbook?: { defaults: PlaybookBody; vocabulary: RecruitmentVocabulary; limits: PlaybookLimits };
  /**
   * `advanced_analytics` only (ADR-0214 §1): the KPMs that read the template, the kodes they hold data for (locked),
   * *Dipakai di*, next month and the bounds — served, never re-declared.
   */
  analytics?: AnalyticsEditorView;
}

/** One link kind as the server resolves it — the words and whether it completes an item on its own. */
export interface TemplateLinkKind {
  label: string;
  route: string;
  completesWhen: string;
  live: boolean;
}

/** `CompanyTemplate.linkKinds`, keyed by kind (`training` stands for every `training:<code>`). */
export type TemplateLinkKinds = Readonly<Record<string, TemplateLinkKind>>;

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


/**
 * The whole payload, not a patch — see the DTO for why. `expectedRevision` is the `revision` of what the editor holds:
 * somebody else's save or publish since is refused `409 VERSION_CONFLICT`, nothing written (P19-T6).
 */
export const saveTemplateDraft = (
  companyId: string,
  kind: TemplateKind,
  payload: Record<string, unknown>,
  templateId?: string | null,
  expectedRevision?: number,
) => api<CompanyTemplate>(`/admin/companies/${companyId}/template/${kind}?${ofTemplate(templateId)}`, {
  method: 'PUT', body: expectedRevision === undefined ? { payload } : { payload, expectedRevision },
});

/** Becomes what the **next** office made from the template gets. Reaches nothing that already exists. */
export const publishTemplate = (companyId: string, kind: TemplateKind, templateId?: string | null) =>
  api<CompanyTemplate>(`/admin/companies/${companyId}/template/${kind}/publish?${ofTemplate(templateId)}`, {
    method: 'POST',
  });

/**
 * **The seven kinds an office is made from** (ADR-0115 §3): what provisioning copies and a push writes. `campaign_kinds`
 * is the company's; the recruitment playbook is a template's but read live, never copied (ADR-0210 §4).
 */
export type OfficeTemplateKind = Exclude<TemplateKind, 'campaign_kinds' | 'recruitment_playbook' | 'advanced_analytics' | 'branding'>;

/** **Every kind a named template holds** (ADR-0210 §1): the seven and the recruitment playbook — its sections' kinds. */
export type NamedTemplateKind = Exclude<TemplateKind, 'campaign_kinds'>;

/** Whether an office copies the kind, and so whether a push can reach it — every one but the playbook. */
export const isOfficeKind = (kind: TemplateKind): kind is OfficeTemplateKind =>
  kind !== 'campaign_kinds' && kind !== 'recruitment_playbook' && kind !== 'advanced_analytics' && kind !== 'branding';

/**
 * **The *Advanced analytics* editor's live count** (ADR-0214 §7): how many agent codes registered in the KPMs that read
 * the template a pattern does not match, and up to five of them. `400` for a pattern the server's engine refuses.
 */
export const checkAgentCodes = (companyId: string, templateId: string, pattern: string, example?: string) =>
  api<{ mismatched: number; total: number; examples: string[]; exampleMatches?: boolean }>(
    `/admin/companies/${companyId}/template/advanced_analytics/code-check?${new URLSearchParams({
      templateId, pattern, ...(example !== undefined ? { example } : {}),
    })}`,
  );

/** **The survey runs open in the template's KPMs** (ADR-0216 §2): asked before NPS or *kualitatif* is turned off. */
export const readOpenSurveyRuns = (companyId: string, templateId: string) =>
  api<{ nps: { runs: number; kpms: number }; qual: { runs: number; kpms: number } }>(
    `/admin/companies/${companyId}/template/advanced_analytics/open-runs?${ofTemplate(templateId)}`,
  );

/** Where a template came from: a record for the list and the audit, never a link. */
export interface TemplateOrigin {
  kind: 'migration' | 'empty' | 'defaults' | 'copy' | 'office' | 'import';
  templateId?: string | null;
  kpmId?: string | null;
  companyId?: string | null;
}

/**
 * **Where one kind of a template stands** (ADR-0185 §3): its newest published version, `null` where none is, and
 * whether a draft waits — what the card's *x/6 bagian terbit* and the checklist's *Terbit vN · Draf · Kosong* read.
 */
export interface TemplateSectionState {
  publishedVersion: number | null;
  hasDraft: boolean;
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
  publishedVersions: Record<NamedTemplateKind, number | null>;
  /** Each kind: its newest published version and whether a draft waits (ADR-0185 §3). */
  sections: Record<NamedTemplateKind, TemplateSectionState>;
  /** The live offices it answers for. */
  officeCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Every template of a company, archived ones too, the default first. */
export const listTemplates = (companyId: string) =>
  api<NamedTemplate[]>(`/admin/companies/${companyId}/templates`);

/** What *Terbitkan semua* did with one kind (ADR-0185 §3). */
export type PublishAllOutcome =
  | { kind: NamedTemplateKind; outcome: 'published'; version: number }
  | { kind: NamedTemplateKind; outcome: 'skipped'; reason: 'no_changes' }
  /** Refused as its own publish would refuse it, in the reader's language. Still a draft. */
  | { kind: NamedTemplateKind; outcome: 'refused'; error: { code: string; message: string } };

/**
 * **Terbitkan semua** (ADR-0185 §3): every kind of the template holding a draft, published in the API's order —
 * a refusal stops only its own kind. Reaches no office that already exists.
 */
export const publishAllTemplate = (companyId: string, templateId: string) =>
  api<{ template: NamedTemplate; results: PublishAllOutcome[] }>(
    `/admin/companies/${companyId}/templates/${templateId}/publish`, { method: 'POST' },
  );

/** One office a template answers for, and the kinds it is behind on and has no record of (ADR-0185 §4). */
export interface TemplateOffice {
  id: string;
  code: string;
  branchName: string;
  behind: OfficeTemplateKind[];
  unrecorded: OfficeTemplateKind[];
}

/** The offices a template answers for, by code, each with what it is behind on — information only (ADR-0185 §4). */
export const listTemplateOffices = (companyId: string, templateId: string) =>
  api<TemplateOffice[]>(`/admin/companies/${companyId}/templates/${templateId}/offices`);

// ------------------------------------------- the push and the Training section's material (ADR-0208)

/** One thing an office did to a section, against the version it was last given, by code (ADR-0208 §4). */
export interface PushDifference {
  /** `categories`, `types`, `binding`, `ratios`, `statuses`, `skills`, `modules`, `aspects`, `items`, … */
  level: string;
  code: string;
  change: 'added' | 'removed' | 'changed';
  /** `changed` only; `material` for a training module showing the office's own. */
  fields?: string[];
}

/** `current`: on the newest version already. `changed`: changed by the office. `unchanged`: not, however old. */
export type PushState = 'unchanged' | 'changed' | 'current';

export interface KindStanding {
  kind: OfficeTemplateKind;
  state: PushState;
  givenVersion: number | null;
  newestVersion: number;
  differences: PushDifference[];
  /** Training only: *"31 modul memakai materi sendiri"*. */
  ownMaterialModules?: number;
}

/** One office made from the template, with where it stands on the sections asked about (`?kind=`). */
export interface TemplateOfficeStanding extends TemplateOffice {
  state: PushState;
  kinds: KindStanding[];
}

/**
 * **The offices made from the template, each with where it stands** (ADR-0208 §4): what the publish dialog and *Dipakai N
 * KPM* list — *Belum diubah KPM*, *Sudah diubah KPM* with what differs, or already current.
 */
export const listTemplateOfficeStandings = (companyId: string, templateId: string, kinds: readonly OfficeTemplateKind[]) =>
  api<TemplateOfficeStanding[]>(
    `/admin/companies/${companyId}/templates/${templateId}/offices?${new URLSearchParams({ kind: kinds.join(',') })}`,
  );

/** What the push did for one office and one section. */
export type ApplyKindOutcome =
  | { kind: OfficeTemplateKind; outcome: 'applied'; version: number; replaced: boolean }
  | { kind: OfficeTemplateKind; outcome: 'skipped'; reason: 'current' }
  | { kind: OfficeTemplateKind; outcome: 'refused'; error: { code: string; message: string } };

export interface ApplyOfficeResult {
  id: string;
  code: string;
  branchName: string;
  results: ApplyKindOutcome[];
  /** The office had unpublished changes of its own: what was applied waits with them for its publish. */
  awaitingPublish: boolean;
}

/**
 * ***Terapkan juga ke KPM yang sudah ada*** (ADR-0208 §4, §5): the template's newest published `kinds`, written into each
 * office ticked. An office that changed a section itself must also be in `replaceChanged` — the second confirmation —
 * or it is refused `TEMPLATE_APPLY_UNCONFIRMED` and nothing is written for it.
 */
export const applyTemplate = (
  companyId: string,
  templateId: string,
  body: { kinds: OfficeTemplateKind[]; kpmIds: string[]; replaceChanged: string[] },
) => api<{ templateId: string; offices: ApplyOfficeResult[] }>(
  `/admin/companies/${companyId}/templates/${templateId}/apply`, { method: 'POST', body },
);

/** A file or a short video of a template module's material: the key, never a URL. */
export interface TemplateMaterialFile {
  id: string;
  label: string;
  storageKey: string;
  mimeType: string;
  bytes: number;
}

/** One module's material in a template (ADR-0208 §1): the three lists an office's module holds. */
export interface TemplateMaterial {
  files: TemplateMaterialFile[];
  videos: TemplateMaterialFile[];
  links: { id: string; label: string; url: string }[];
}

/** A signed upload for the template's material, in the company's folder (ADR-0040). Sent as `signedUploadForm`. */
export const requestTemplateMaterialUpload = (
  companyId: string, templateId: string, body: { filename: string; mimeType: string; bytes: number },
) => api<{
  uploadUrl: string; storageKey: string; signature: string; expiresAt: string; fields: Record<string, string>;
}>(`/admin/companies/${companyId}/templates/${templateId}/training/uploads`, { method: 'POST', body });

/** Asks storage what landed, and records that. */
export const confirmTemplateMaterialUpload = (companyId: string, templateId: string, storageKey: string) =>
  api<{ storageKey: string; mimeType: string; bytes: number }>(
    `/admin/companies/${companyId}/templates/${templateId}/training/uploads/confirm`,
    { method: 'POST', body: { storageKey } },
  );

/**
 * **A link to one of the template's training files, for the editor's preview** (P19.6-T2, ADR-0217 §4): signed for 300
 * seconds on the storage host, asked for when *Buka* is pressed and drawn only in the sandboxed window.
 */
export const templateMaterialFileUrl = (companyId: string, templateId: string, storageKey: string) =>
  api<{ url: string }>(
    `/admin/companies/${companyId}/templates/${templateId}/training/files/url?storageKey=${encodeURIComponent(storageKey)}`,
  );

/**
 * **One module's material, into the Training section's draft**, by module code (ADR-0208 §1): the whole of it, pinned to
 * the `revision` of the draft the editor holds. Answers the section's draft as it now stands.
 */
export const saveTemplateModuleMaterial = (
  companyId: string, templateId: string, code: string, material: TemplateMaterial, expectedRevision?: number,
) => api<CompanyTemplate>(
  `/admin/companies/${companyId}/templates/${templateId}/training/modules/${encodeURIComponent(code)}/content`,
  {
    method: 'PUT',
    body: {
      files: material.files.map(({ id, label, storageKey, mimeType, bytes }) => ({ id, label, storageKey, mimeType, bytes })),
      videos: material.videos.map(({ id, label, storageKey, mimeType, bytes }) => ({ id, label, storageKey, mimeType, bytes })),
      links: material.links.map(({ id, label, url }) => ({ id, label, url })),
      ...(expectedRevision === undefined ? {} : { expectedRevision }),
    },
  },
);

/**
 * *New template*: empty, or **a copy** of one of the company's templates — each kind's newest published version as the
 * copy's version 1 (P13.2-T7). The API still admits `from: 'defaults'`; no screen sends it since ADR-0185 §5 — the
 * built-in templates hold the defaults, copied through *Salin dari…* (`importTemplate`).
 */
export const createTemplate = (
  companyId: string,
  body: { name: string; from: 'empty' | 'defaults' | { templateId: string; rungMap?: RungMap } },
) => api<NamedTemplate>(`/admin/companies/${companyId}/templates`, { method: 'POST', body });

/**
 * **A rung map** (ADR-0213 §4, B1-7): each rung the source names that this company's ladder lacks, to one of its active
 * rungs — `{ SBP: 'BP' }`. A target that is not an active rung is `400`, naming it.
 */
export type RungMap = Record<string, string>;

/**
 * *Import from another company* (ADR-0115 §5, P13.2-T7): one of `fromCompanyId`'s templates becomes a new
 * template of this company. Refused `409 TEMPLATE_RUNG_UNKNOWN` when it names a role this company's ladder
 * lacks.
 */
export const importTemplate = (
  companyId: string,
  body: { fromCompanyId: string; templateId: string; name: string; rungMap?: RungMap },
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


// ---------------------------------------------------------------- the product catalog (P5-T4)

/** One objection card: what the customer says, and the reply (ADR-0209 §9). Plain text, line breaks kept. */
export interface ObjectionCard {
  objection: string;
  answer: string;
}

export interface AttackPlan {
  goodFit: string;
  opening: string;
  benefits: string[];
  fullScript: string;
  /** *4 · If they push back*: every card, in order — the one pair it replaced (P19.4-T4 AC-1). */
  objections: ObjectionCard[];
  nextAction: string;
}

/**
 * The most objection cards a product holds: the API refuses one more (`AttackPlanDto.objections`, `@ArrayMaxSize`,
 * `PRODUCT_OBJECTIONS_MAX`). Held to the API document by `contract.spec.ts`.
 */
export const OBJECTIONS_MAX = 10;

/** *Produk dasar* or *Rider* (ADR-0209 §1). */
export type ProductKind = 'base' | 'rider';

/** What a product's policies are sold in, in the order the API stores them (ADR-0209 §8). */
export const PRODUCT_CURRENCIES = ['IDR', 'USD'] as const;
export type ProductCurrency = (typeof PRODUCT_CURRENCIES)[number];

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
  /** A base or a rider (ADR-0209 §1). */
  kind: ProductKind;
  /** A rider's base products, by id; `[]` for a base. */
  attachesTo: string[];
  /** `IDR`, `USD` or both, `IDR` first — a label, not money (ADR-0209 §8). */
  currencies: ProductCurrency[];
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
  /*
   * **What the proposal reads from it** (P19.7-T1 AC-2; ADR-0225 §1): always sent since P19.7, optional here so an older
   * answer reads as none set. The rules are the API's (`checkProposalSettings`); the editor stops at the counts below.
   */
  proposalFields?: ProposalField[];
  planOptions?: PlanOption[];
  faq?: FaqEntry[];
  pdfDetail?: PdfDetailBlock[];
  syariahName?: string | null;
  /** As stored: `null` reads *Anak* for education, *Klien* for the rest. */
  defaultInsured?: 'client' | 'child' | null;
  /** As stored: `null` reads the category's (*KESEHATAN* …). */
  proposalTypeLabel?: string | null;
  sortOrder: number;
  version: number;
}

// ----------------------------------------------- a product's proposal fields (P19.7-T1; ADR-0225 §1, §2)

/** How a proposal field is drawn: one-tap choices, a money box, or a sentence. */
export type ProposalFieldType = 'chips' | 'money' | 'fixed';
export const PROPOSAL_FIELD_TYPES: readonly ProposalFieldType[] = ['chips', 'money', 'fixed'];

export interface ProposalOption {
  label: string;
  /** On the `paymentYears` field: the term's whole years, `null` where it is none. */
  years: number | null;
  /** On the `currency` field: what the option sells in. */
  currency: ProductCurrency | null;
}

export interface ProposalField {
  key: string;
  label: string;
  labelSyariah: string | null;
  type: ProposalFieldType;
  options: ProposalOption[];
  default: string | null;
  /** IDR minor units, smallest first. */
  quickAmounts: number[];
  /** IDR minor units, or `null`. */
  minMinor: number | null;
  showOnPdf: boolean;
  showOnSummary: boolean;
  paymentYears: boolean;
  plan: boolean;
  currency: boolean;
  /** *Perlu dicek*: the Super Admin's mark (OD-273), never an agent's. */
  draft: boolean;
}

export interface PlanHighlight { label: string; value: string }
export interface PlanOption { name: string; highlights: PlanHighlight[]; popular: boolean }
export interface FaqEntry { question: string; answer: string }
export interface PdfDetailRow { label: string; note: string | null; formula: string | null; text: string | null }
export type PdfDetailBlockKind = 'manfaat' | 'jadwal' | 'masa' | 'pengecualian' | 'nilai_tunai';
export const PDF_DETAIL_BLOCKS: readonly PdfDetailBlockKind[] = ['manfaat', 'jadwal', 'masa', 'pengecualian', 'nilai_tunai'];
export interface PdfDetailBlock {
  block: PdfDetailBlockKind;
  rows: PdfDetailRow[];
  source: { file: string; page: number; date: string };
  notGuaranteed: boolean;
}

/**
 * **The counts the *Proposal* editor stops at** (`PROPOSAL`, §B.34; ADR-0225 §2): the API's own bounds, held to its
 * document by `contract.spec.ts` (each list's `maxItems`). Past one, the API refuses the save naming the path.
 */
export const PROPOSAL_LIMITS = {
  FIELDS: 8,
  CHIP_OPTIONS: 8,
  QUICK_AMOUNTS: 4,
  PLAN_OPTIONS: 8,
  PLAN_HIGHLIGHTS: 4,
  FAQ: 20,
  DETAIL_ROWS: 8,
} as const;

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

/**
 * `expectedVersion` is the product's `version` as the editor read it: a product somebody else saved, closed or
 * withdrew since is refused `409 VERSION_CONFLICT`, nothing written (P19-T6).
 */
export const updateProduct = (
  companyId: string, productId: string, body: ProductFields & { expectedVersion?: number },
) =>
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

/**
 * **Delete a withdrawn product nothing references** (P19.4-T4 AC-13; B1-5; ADR-0209 §10): a soft delete, its code
 * never reused. One on sale is `400`; one an office sells, scripted or a rider names is `409 PRODUCT_IN_USE`, its
 * message saying what still names it.
 */
export const deleteProduct = (companyId: string, productId: string) =>
  api<void>(`/admin/companies/${companyId}/products/${productId}`, { method: 'DELETE' });

/** The whole shelf, once each: two people dragging rows cannot interleave into a third order. */
export const reorderProducts = (companyId: string, productIds: string[]) =>
  api<Product[]>(`/admin/companies/${companyId}/products/reorder`, {
    method: 'PATCH', body: { productIds },
  });
