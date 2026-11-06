import { api, apiBlob } from '@/lib/api-client';
import type { LeadGender } from '@/lib/leads';

/**
 * **The simple proposal, as the API answers it** (P19.7-T2; `functional/proposal.md`, *Data contract*; ADR-0221,
 * ADR-0225). One document per proposal, its items inside it, owned by the agent's membership and answered to nobody
 * else: another member's is `404 PROPOSAL_NOT_FOUND`, a leader's downline's included.
 *
 * **Every write is pinned** (`expectedVersion`): a stale one is `409 VERSION_CONFLICT`, and the screen reads the
 * proposal again and says it changed on another device (ADR-0221 §3).
 *
 * **Nothing here computes a figure.** *Total dibayar* (`totalPaid`) and *Total premi* (`totals`) are the server's
 * (§B.34), and so is the client's age (ADR-0224 §2). The screen draws what it is answered.
 *
 * **No inline object types** in an interface `contract.spec.ts` pairs, so its reader sees every field.
 */

export type ProposalChannel = 'conventional' | 'syariah';
export type PayFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual';
export type ProposalStatus = 'draft' | 'done';
export type InsuredRelation = 'client' | 'spouse' | 'child' | 'other';
export type ProposalCurrency = 'IDR' | 'USD';
export type ProposalFieldType = 'chips' | 'money' | 'fixed';
export type ProductCategoryCode = 'life' | 'health' | 'ci' | 'education' | 'investment';

/** The order *Cara bayar* offers them in (the spec: *Bulanan · Kuartalan · Semesteran · Tahunan*), *Bulanan* first. */
export const PAY_FREQUENCIES: readonly PayFrequency[] = ['monthly', 'quarterly', 'semiannual', 'annual'];
export const PROPOSAL_CHANNELS: readonly ProposalChannel[] = ['conventional', 'syariah'];
export const INSURED_RELATIONS: readonly InsuredRelation[] = ['client', 'spouse', 'child', 'other'];

/**
 * **The most products one proposal holds** (`PROPOSAL.ITEMS_MAX`, §B.34; ADR-0221 §1): the API's, held to its document by
 * `contract.spec.ts` (`ProposalResponseDto.items`' `maxItems`). The sixth card is drawn disabled; the API refuses it too.
 */
export const PROPOSAL_ITEMS_MAX = 5;

/** The client's copy, taken from the lead when step 1 is completed (ADR-0221 §1). */
export interface ProposalClient {
  name: string;
  /** The age at the next birthday on the day it was taken. */
  age: number;
  gender: LeadGender;
}

export interface ProposalOptionView {
  label: string;
  years: number | null;
  currency: ProposalCurrency | null;
}

/** One field of a product's panel, as the catalogue holds it — less the Super Admin's *Perlu dicek* mark. */
export interface ProposalFieldView {
  key: string;
  label: string;
  labelSyariah: string | null;
  type: ProposalFieldType;
  options: ProposalOptionView[];
  default: string | null;
  quickAmounts: number[];
  minMinor: number | null;
  showOnPdf: boolean;
  showOnSummary: boolean;
  paymentYears: boolean;
  plan: boolean;
  currency: boolean;
}

export interface PdfDetailRowView {
  label: string;
  note: string | null;
  formula: string | null;
  text: string | null;
}

export interface PdfDetailBlockView {
  block: 'manfaat' | 'jadwal' | 'masa' | 'pengecualian' | 'nilai_tunai';
  rows: PdfDetailRowView[];
  notGuaranteed: boolean;
}

/** What the item copied from the product when it was added, never refreshed (ADR-0225 §6). */
export interface ProposalSnapshot {
  name: string;
  syariahName: string | null;
  typeLabel: string;
  category: string;
  currencies: ProposalCurrency[];
  fields: ProposalFieldView[];
  benefits: string[];
  pdfDetail: PdfDetailBlockView[];
}

export interface ProposalInsured {
  relation: InsuredRelation;
  name: string | null;
  age: number | null;
}

export interface ProposalMoney {
  amountMinor: number | null;
  currency: ProposalCurrency;
}

export interface ProposalTotal {
  currency: ProposalCurrency;
  amountMinor: number;
}

export interface ProposalTotalPaid {
  amountMinor: number;
  years: number;
}

export interface ProposalItem {
  itemId: string;
  productId: string;
  productCode: string;
  productVersion: number;
  /** The name this proposal shows: the syariah name on a *Syariah* proposal where the product has one. */
  name: string;
  /** The `plan` field's value, where the product has one. */
  plan: string | null;
  currency: ProposalCurrency;
  snapshot: ProposalSnapshot;
  insured: ProposalInsured;
  /** A `chips` field's option label; a `money` field's minor units of `currency`. A `fixed` field holds nothing. */
  fieldValues: Record<string, string | number>;
  premium: ProposalMoney;
  totalPaid: ProposalTotalPaid | null;
  /** Always `null`: the compare mode is *Later* (AC-15). */
  choice: null;
}

export interface Proposal {
  id: string;
  version: number;
  leadId: string;
  leadDeleted: boolean;
  client: ProposalClient;
  channel: ProposalChannel;
  payFrequency: PayFrequency;
  showTotal: boolean;
  status: ProposalStatus;
  doneAt: string | null;
  firstDoneAt: string | null;
  /** `YYYY-MM-DD`, the KPM's calendar: the day it was finished, else today. */
  date: string;
  /** **The PDF's file name**, `Proposal-{Nama klien}-{date}.pdf` (ADR-0222 §6): the server's, which *Simpan PDF* saves under. */
  fileName: string;
  items: ProposalItem[];
  totals: ProposalTotal[];
  duplicatedFrom: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `PATCH /proposals/:id`'s answer: the items a channel or age change took out, by id. */
export type PatchedProposal = Proposal & { removedItemIds: string[] };

/** `POST /proposals/:id/duplicate`'s answer: the products left out because they are no longer offered. */
export type DuplicatedProposal = Proposal & { droppedProductIds: string[] };

export interface ProposalRowClient {
  name: string;
}

export interface ProposalRowProduct {
  name: string;
  plan: string | null;
}

/** One line of *Riwayat*. */
export interface ProposalRow {
  id: string;
  version: number;
  client: ProposalRowClient;
  /** `YYYY-MM-DD`: the day it was finished, else the day it last changed. */
  date: string;
  /** The file name *Unduh lagi* saves the PDF under (ADR-0222 §6). */
  fileName: string;
  products: ProposalRowProduct[];
  status: ProposalStatus;
  totals: ProposalTotal[];
  leadId: string;
  leadDeleted: boolean;
  updatedAt: string;
}

export interface ProposalPage {
  rows: ProposalRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProposalQuery {
  search?: string;
  status?: ProposalStatus;
  leadId?: string;
  page?: number;
  pageSize?: number;
}

export interface CatalogPlanHighlight {
  label: string;
  value: string;
}

export interface CatalogPlan {
  name: string;
  highlights: CatalogPlanHighlight[];
  popular: boolean;
}

export interface CatalogFaq {
  question: string;
  answer: string;
}

export interface CatalogRiderName {
  code: string;
  name: string;
}

/** The currency rule (ADR-0225 §8): fixed by the product, or decided by its `currency` field's chosen option. */
export type CatalogCurrency = { fixed: ProposalCurrency } | { byField: string };

/** A product step 2 may add, for this channel and this client's age (ADR-0225 §7). */
export interface CatalogProduct {
  productId: string;
  code: string;
  name: string;
  category: ProductCategoryCode;
  typeLabel: string;
  defaultInsured: 'client' | 'child';
  currency: CatalogCurrency;
  fields: ProposalFieldView[];
  plans: CatalogPlan[];
  faq: CatalogFaq[];
  riders: CatalogRiderName[];
}

export interface ProposalCatalog {
  products: CatalogProduct[];
}

/** What a proposal's settings write may carry. */
export interface ProposalSettingsPatch {
  channel?: ProposalChannel;
  payFrequency?: PayFrequency;
  showTotal?: boolean;
  leadId?: string;
}

/** What an item's write may carry. A `null` field value clears a money field. */
export interface ProposalItemPatch {
  insured?: { relation: InsuredRelation; name?: string | null; age?: number | null };
  fieldValues?: Record<string, string | number | null>;
  premium?: { amountMinor: number | null };
}

// ------------------------------------------------------------------------------------------------ addresses

/** *Riwayat*, the Sales tools strip's third tab (ADR-0221 §8). */
export const PROPOSAL_HREF = '/proposal';

/** Step 1 with nothing stored: `?leadId=` chooses that lead (*Buat proposal* on a lead's card and sheet). */
export function newProposalHref(leadId?: string): string {
  return leadId ? `/proposal/new?leadId=${encodeURIComponent(leadId)}` : '/proposal/new';
}

/** A stored proposal at one of its three steps. */
export function proposalHref(id: string, step?: 1 | 2 | 3): string {
  return step ? `/proposal/${encodeURIComponent(id)}?step=${step}` : `/proposal/${encodeURIComponent(id)}`;
}

/** The step a `?step=` asks for: 1, 2 or 3, and 2 for anything else (a stored proposal opens on its products). */
export function stepOf(value: string | undefined | null): 1 | 2 | 3 {
  return value === '1' ? 1 : value === '3' ? 3 : 2;
}

// ------------------------------------------------------------------------------------------------ words

/** A field's label on this proposal: its `labelSyariah` on a *Syariah* proposal, where it has one (ADR-0221 §9). */
export function fieldLabel(field: Pick<ProposalFieldView, 'label' | 'labelSyariah'>, channel: ProposalChannel): string {
  return channel === 'syariah' && field.labelSyariah ? field.labelSyariah : field.label;
}

/** *"PRUWell Medical +1"*: the first product, then how many more (ADR-0221 §6). `null` for none. */
export function productsPill(products: readonly string[]): string | null {
  if (products.length === 0) return null;
  return products.length === 1 ? products[0] : `${products[0]} +${products.length - 1}`;
}

// ------------------------------------------------------------------------------------------------ calls

const qs = (query: Record<string, string | number | boolean | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
};

/** *Riwayat*: the reader's own live proposals, newest change first. */
export const listProposals = (query: ProposalQuery = {}) =>
  api<ProposalPage>('/proposals' + qs({ ...query }));

/** The draft, created at step 1's *Lanjut* for one of the reader's own Sales leads. */
export const createProposal = (leadId: string) =>
  api<Proposal>('/proposals', { method: 'POST', body: { leadId } });

export const readProposal = (id: string) => api<Proposal>(`/proposals/${encodeURIComponent(id)}`);

/** The products step 2 may add for this channel and this client's age. */
export const proposalCatalog = (channel: ProposalChannel, age: number) =>
  api<ProposalCatalog>('/proposals/catalog' + qs({ channel, age }));

export const patchProposal = (id: string, expectedVersion: number, body: ProposalSettingsPatch) =>
  api<PatchedProposal>(`/proposals/${encodeURIComponent(id)}`, { method: 'PATCH', body: { ...body, expectedVersion } });

export const addProposalItem = (id: string, expectedVersion: number, productId: string) =>
  api<Proposal>(`/proposals/${encodeURIComponent(id)}/items`, { method: 'POST', body: { expectedVersion, productId } });

export const patchProposalItem = (id: string, itemId: string, expectedVersion: number, body: ProposalItemPatch) =>
  api<Proposal>(`/proposals/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH', body: { ...body, expectedVersion },
  });

export const removeProposalItem = (id: string, itemId: string, expectedVersion: number) =>
  api<Proposal>(
    `/proposals/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}?expectedVersion=${expectedVersion}`,
    { method: 'DELETE' },
  );

/**
 * ***Simpan PDF*'s first half** (ADR-0221 §4; ADR-0222 §5): *Selesai*, and the lead's note. Step 3's button calls it
 * before it saves the file; a refusal (`422 PROPOSAL_INCOMPLETE`, `PROPOSAL_PRODUCT_WITHDRAWN`) saves nothing.
 */
export const finishProposal = (id: string, expectedVersion: number) =>
  api<Proposal>(`/proposals/${encodeURIComponent(id)}/done`, { method: 'POST', body: { expectedVersion } });

/**
 * **The proposal's PDF** (P19.7-T3; ADR-0222): the file the API builds now, from the stored proposal and the KPM's
 * branding as it shows today — through `apiBlob`, with the session, never a link (no route serves it without one). Step 3
 * draws these very bytes and *Simpan PDF* saves them; *Riwayat*'s *Unduh lagi* saves a fresh one. A view-only session is
 * refused it (`403 PERM_DENIED`).
 */
export const proposalPdf = (id: string) => apiBlob(`/proposals/${encodeURIComponent(id)}/pdf`);

export const duplicateProposal = (id: string) =>
  api<DuplicatedProposal>(`/proposals/${encodeURIComponent(id)}/duplicate`, { method: 'POST' });

export const deleteProposal = (id: string, expectedVersion: number) =>
  api<void>(`/proposals/${encodeURIComponent(id)}?expectedVersion=${expectedVersion}`, { method: 'DELETE' });
