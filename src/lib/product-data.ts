'use client';

import { api, apiBlob } from './api-client';
import type {
  ProductCurrency, ProductEntryAge, ProductNeedTag, ProductPayFrequency, ProductPayTerm, ProductPlanRule, ProposalCalcType,
  PlanOption, ProposalField,
} from './admin';
import type { ProposalItem } from './proposals';

/**
 * **An insurer's proposal data: the Proposal tab** (P19.15-T1, T4 AC-1; ADR-0258; `functional/proposal.md`, *Proposal data
 * per insurer*): the overview and the product list, a product's *Isian* and versions, a premium table's upload, columns,
 * *Ketentuan*, three test profiles, activation, turning off and deleting, the template and *Uji coba*. Every route checks
 * who may read and who may manage the company on its own, so what a screen hides is never the control.
 */

export type ProductDataStatus = 'check' | 'manual' | 'ready' | 'withdrawn';
export type ProductDataCheckReason = 'ending' | 'gaps' | 'changed';
export type RateTableStatus = 'draft' | 'scheduled' | 'active' | 'old' | 'off';
export type RateColumnRole =
  | 'age' | 'gender' | 'smoker' | 'plan' | 'payTerm' | 'currency' | 'frequency' | 'rate' | 'premium' | 'bandMin' | 'bandMax' | 'ignore';

/** Every role a column may be given under *Cocokkan kolom*, in the order the select offers them. */
export const RATE_COLUMN_ROLES: readonly RateColumnRole[] = [
  'age', 'gender', 'smoker', 'plan', 'payTerm', 'currency', 'frequency', 'rate', 'premium', 'bandMin', 'bandMax', 'ignore',
];
/** The list's default order (P1b §2). */
export const PRODUCT_DATA_STATUSES: readonly ProductDataStatus[] = ['check', 'manual', 'ready', 'withdrawn'];
/** *Uji 3 contoh* (the API's `PRODUCT_DATA.TEST_PROFILES`). */
export const RATE_TEST_PROFILES = 3;

export interface ProductDataRow {
  productId: string;
  code: string;
  name: string;
  category: string;
  isSyariah: boolean;
  calcType: ProposalCalcType;
  lifecycle: string;
  status: ProductDataStatus;
  checkReasons: ProductDataCheckReason[];
  table: {
    state: 'active' | 'none' | 'ending' | 'gaps';
    id: string | null;
    version: number | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    gapCount: number;
    scheduledFrom: string | null;
  };
  illustration: { state: 'published' | 'none'; blocks: number };
}

export interface ProductDataOverview {
  company: { id: string; name: string };
  canManage: boolean;
  counters: Record<ProductDataStatus, number>;
  lastUpdated: { at: string; by: { id: string; name: string | null } | null } | null;
  products: ProductDataRow[];
}

/** A version's rules (*Ketentuan*), minor units; premium limits per year. */
export interface RateRules {
  upStep: number | null;
  upMin: number | null;
  upMax: number | null;
  premiumMin: number | null;
  premiumMax: number | null;
  entryAgeMin: number | null;
  entryAgeMax: number | null;
  payTermMaxAge: Record<string, number>;
}

export interface FrequencyFactors {
  monthly: number | null;
  quarterly: number | null;
  semiannual: number | null;
  annual: number | null;
}

export interface RateGap {
  kind: 'ages' | 'combination' | 'smoker' | 'gender' | 'plan' | 'payTerm' | 'currency';
  from?: number;
  to?: number;
  plan?: string | null;
  payTerm?: string | null;
  payTermLabel?: string | null;
  gender?: 'male' | 'female' | null;
  smoker?: boolean | null;
  currency?: string | null;
}

export interface RateTestInput {
  age: number;
  gender: 'male' | 'female';
  smoker: boolean | null;
  plan: string | null;
  payTerm: string | null;
  payFrequency: ProductPayFrequency;
  amountMinor: number;
}

export interface RateTestCase {
  inputs: RateTestInput;
  expectedMinor: number;
  actualMinor: number | null;
  match: boolean;
}

export interface Actor { id: string; name: string | null }

export interface RateTableView {
  id: string;
  productId: string;
  version: number;
  status: RateTableStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: { fileName: string; type: 'xlsx' | 'csv' | 'pdf' | 'intake' };
  uploadedAt: string;
  uploadedBy: Actor;
  activatedAt: string | null;
  activatedBy: Actor | null;
  turnedOffAt: string | null;
  turnedOffBy: Actor | null;
  basis: 'per_mille' | 'per_plan' | 'per_band' | null;
  mapped: boolean;
  rowCount: number;
  gaps: RateGap[];
  gapCount: number;
  testCases: RateTestCase[];
  overrideReason: string | null;
  rules: RateRules;
  frequencies: FrequencyFactors;
  rulesSource: 'ketentuan' | 'previous' | 'catalogue' | 'typed' | 'intake';
  rulesConfirmed: boolean;
  used: boolean;
  file: {
    header: string[];
    columnMap: Record<string, RateColumnRole>;
    preview: string[][];
    rows: number;
    ketentuan: boolean;
    ketentuanProblems: { row: number; label: string; value: string }[];
  } | null;
  previous: { rules: RateRules; frequencies: FrequencyFactors; from: 'version' | 'catalogue'; version: number | null };
}

/** **What *Isian* edits** — the catalogue's own values, which apply while no table is in force. */
export interface ProductRules {
  proposalFields: ProposalField[];
  planOptions: PlanOption[];
  syariahName: string | null;
  defaultInsured: 'client' | 'child' | null;
  proposalTypeLabel: string | null;
  currencies: ProductCurrency[];
  calcType: ProposalCalcType;
  entryAge: ProductEntryAge | null;
  payTerms: ProductPayTerm[];
  frequencies: ProductPayFrequency[];
  smokerRated: boolean;
  planRule: ProductPlanRule | null;
  upStep: number | null;
  upMin: number | null;
  upMax: number | null;
  premiumMin: number | null;
  premiumMax: number | null;
  needTag: ProductNeedTag | null;
}

export interface ProductDataDetail {
  product: {
    id: string; code: string; name: string; category: string; channel: string; isSyariah: boolean; lifecycle: string;
    version: number; currencies: ProductCurrency[]; kind: string; rules: ProductRules;
  };
  canManage: boolean;
  catalogueRules: RateRules;
  inForce: RateTableView | null;
  scheduled: RateTableView | null;
  versions: RateTableView[];
}

/** A row of the product's PDF box, as the agent's PDF draws it (`proposal-pdf.model.ts`' `PdfItem`). */
export interface PdfBoxRow { label: string; value: string; kind: 'value' | 'detail' | 'benefit' | 'cash'; note?: string | null }
export interface PdfBox {
  title: string;
  typeLabel: string;
  who: string;
  premium: string | null;
  per: string;
  pill: string;
  source: string;
  rows: PdfBoxRow[];
  protection: { label: string; value: string }[];
  facts: { title: string; text: string | null }[];
}

/** *Uji coba*'s answer: the item as the agent's card reads it, and the PDF box. */
export interface TryAnswer {
  item: ProposalItem;
  box: PdfBox;
}

export interface TryBody {
  age: number;
  gender: 'male' | 'female';
  rateTableId?: string | null;
  onDate?: string | null;
  state?: Partial<Pick<ProposalItem, 'fieldValues' | 'smoker' | 'payTerm' | 'payFrequency' | 'up' | 'premium' | 'fixedField'>> | null;
  patch?: Record<string, unknown> | null;
}

export interface DraftPatch {
  columnMap?: Record<string, RateColumnRole>;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  rules?: RateRules;
  frequencies?: FrequencyFactors;
}

/** `GET …/products`: the four counters, one row per product, *Perlu dicek* first. */
export const readProductDataOverview = (companyId: string) => api<ProductDataOverview>(`/product-data/companies/${encodeURIComponent(companyId)}/products`);

/** `GET …/products/:productId`: *Isian*'s values and every version. */
export const readProductData = (companyId: string, productId: string) =>
  api<ProductDataDetail>(`/product-data/companies/${encodeURIComponent(companyId)}/products/${encodeURIComponent(productId)}`);

/** `PATCH …/products/:productId/rules`: *Isian*, pinned to the product's version. */
export const saveProductRules = (companyId: string, productId: string, expectedVersion: number, rules: Partial<ProductRules>) =>
  api<ProductDataDetail>(`/product-data/companies/${encodeURIComponent(companyId)}/products/${encodeURIComponent(productId)}/rules`, {
    method: 'PATCH', body: { expectedVersion, ...rules },
  });

/** `GET …/rate-tables/template`: the product's template, Excel with *Ketentuan*, or the CSV header. */
export const rateTemplate = (companyId: string, productId: string, format: 'xlsx' | 'csv') =>
  apiBlob(`/product-data/companies/${encodeURIComponent(companyId)}/products/${encodeURIComponent(productId)}/rate-tables/template?format=${format}`);

/** `POST …/rate-tables`: an Excel or CSV premium table as a draft, with *Berlaku mulai* and *Berlaku sampai*. */
export function uploadRateTable(
  companyId: string, productId: string, file: File, effectiveFrom: string, effectiveTo: string | null,
): Promise<RateTableView> {
  const form = new FormData();
  form.append('file', file);
  form.append('effectiveFrom', effectiveFrom);
  if (effectiveTo) form.append('effectiveTo', effectiveTo);
  return api<RateTableView>(`/product-data/companies/${encodeURIComponent(companyId)}/products/${encodeURIComponent(productId)}/rate-tables`, { method: 'POST', body: form });
}

export const readRateTable = (companyId: string, id: string) => api<RateTableView>(`/product-data/companies/${encodeURIComponent(companyId)}/rate-tables/${encodeURIComponent(id)}`);

/** `PATCH …/rate-tables/:id`: a draft's columns, dates, rules or factors. */
export const updateRateTable = (companyId: string, id: string, patch: DraftPatch) =>
  api<RateTableView>(`/product-data/companies/${encodeURIComponent(companyId)}/rate-tables/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });

/** `PUT …/rate-tables/:id/tests`: *Uji 3 contoh*. */
export const setRateTests = (companyId: string, id: string, cases: (RateTestInput & { expectedMinor: number })[]) =>
  api<RateTableView>(`/product-data/companies/${encodeURIComponent(companyId)}/rate-tables/${encodeURIComponent(id)}/tests`, { method: 'PUT', body: { cases } });

export const activateRateTable = (companyId: string, id: string, overrideReason: string | null) =>
  api<RateTableView>(`/product-data/companies/${encodeURIComponent(companyId)}/rate-tables/${encodeURIComponent(id)}/activate`, { method: 'POST', body: overrideReason ? { overrideReason } : {} });

export const turnOffRateTable = (companyId: string, id: string) =>
  api<RateTableView>(`/product-data/companies/${encodeURIComponent(companyId)}/rate-tables/${encodeURIComponent(id)}/turn-off`, { method: 'POST' });

export const deleteRateTable = (companyId: string, id: string) => api<void>(`/product-data/companies/${encodeURIComponent(companyId)}/rate-tables/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** `POST …/products/:productId/try`: *Uji coba*, nothing stored. */
export const tryProduct = (companyId: string, productId: string, body: TryBody) =>
  api<TryAnswer>(`/product-data/companies/${encodeURIComponent(companyId)}/products/${encodeURIComponent(productId)}/try`, { method: 'POST', body });
