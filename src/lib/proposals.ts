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
 * (§B.34), and so is the prefilled client's age (ADR-0254 §4). The screen draws what it is answered.
 *
 * **No inline object types** in an interface `contract.spec.ts` pairs, so its reader sees every field.
 */

export type PayFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'single';
export type ProposalStatus = 'draft' | 'done';
export type InsuredRelation = 'client' | 'spouse' | 'child' | 'other';
export type ProposalCurrency = 'IDR' | 'USD';
export type ProposalFieldType = 'chips' | 'money' | 'fixed' | 'derived';
export type ProductCategoryCode = 'life' | 'health' | 'ci' | 'education' | 'investment';
/** How a product's amounts are worked out (ADR-0255 §4): `up_premium` shows the sum assured beside the premium. */
export type CalcType = 'up_premium' | 'goal' | 'premium_benefit' | 'plan_priced' | 'manual';
export type FixedField = 'up' | 'premium' | 'goal' | 'none';

/** **A calculation's state on a card** (P19.15-T1; ADR-0258 §5; the API's `CALC_STATES`). */
export type CalcState = 'ok' | 'needs_amount' | 'needs_input' | 'missing_combination' | 'no_frequency' | 'age_outside' | 'table_off';
/** **A card's one-line note** (the API's `CALC_NOTES`). */
export type CalcNote = 'up_rounded' | 'rates_updated' | 'table_off';
export type CalcLimitKind = 'up_min' | 'up_max' | 'premium_min' | 'premium_max';

/** A limit the amounts fall outside, and the chip with the nearest allowed value (P1 spec's *Limits*). */
export interface CalcLimit {
  kind: CalcLimitKind;
  /** The limit, minor units — a premium limit per year. */
  limitMinor: number;
  chip: { field: 'up' | 'premium' | 'goal'; amountMinor: number } | null;
}

/** **What the server says of an item's calculation** (P19.15-T1): never worked out on the screen. */
export interface ItemCalc {
  mode: 'table' | 'manual';
  state: CalcState;
  tableId: string | null;
  /** *"Tabel tarif berlaku {tanggal}"*. */
  effectiveFrom: string | null;
  /** The *Cara bayar* the table prices for this item: the card offers no other. */
  frequencies: PayFrequency[];
  limit: CalcLimit | null;
  /** The UP step behind *"Premi disesuaikan karena UP dibulatkan ke {step}"*. */
  stepMinor: number | null;
  missing: 'age' | 'gender' | null;
  ageBounds: { min: number | null; max: number | null } | null;
}

/**
 * **How long the card waits after the last keystroke in an amount before it saves** — and so before the server
 * calculates (P19.15-T1 AC-5; the P1 spec's *"about 300 ms after any change"*). The API's `PRODUCT_DATA.RECALC_DEBOUNCE_MS`
 * (§B.39), held to it by `metrics-and-definitions.md`; a typed (manual) amount keeps `TYPED_SAVE_MS`.
 */
export const PROPOSAL_RECALC_MS = 300;
export type ClientStatus = 'single' | 'married';
/** *Yang dibahas* (ADR-0254 §3), in the spec's order; `OTHER` with its own words. */
export type ClientNeed = 'HOSPITAL' | 'CRITICAL_INCOME' | 'FAMILY' | 'EDUCATION' | 'FUTURE' | 'OTHER';
/** The need tile a product ticks (ADR-0255 §5): the client's needs but *Lainnya*. */
export type NeedTag = Exclude<ClientNeed, 'OTHER'>;

/** *Cara bayar*, in the order a card offers them (the spec: *Bulanan · Kuartalan · Semesteran · Tahunan*), then single. */
export const PAY_FREQUENCIES: readonly PayFrequency[] = ['monthly', 'quarterly', 'semiannual', 'annual', 'single'];
export const INSURED_RELATIONS: readonly InsuredRelation[] = ['client', 'spouse', 'child', 'other'];
export const CLIENT_NEEDS: readonly ClientNeed[] = ['HOSPITAL', 'CRITICAL_INCOME', 'FAMILY', 'EDUCATION', 'FUTURE', 'OTHER'];
export const CLIENT_STATUSES: readonly ClientStatus[] = ['single', 'married'];

/**
 * **The most products one proposal holds** (`PROPOSAL.ITEMS_MAX`, §B.34; ADR-0221 §1): the API's, held to its document by
 * `contract.spec.ts` (`ProposalResponseDto.items`' `maxItems`). The sixth card is drawn disabled; the API refuses it too.
 */
export const PROPOSAL_ITEMS_MAX = 5;

/** *Detail klien (opsional)* (ADR-0254 §3): each prints on the PDF only when filled. */
export interface ProposalClientDetails {
  status: ClientStatus | null;
  /** *Tanggungan*, free text. */
  dependants: string | null;
  occupation: string | null;
  city: string | null;
  needs: ClientNeed[];
  /** *Lainnya*'s words, with `OTHER` only. */
  needsOther: string | null;
}

/** **The client, on the proposal and nowhere else** (ADR-0254 §1): the lead's name, and what step 1 entered. */
export interface ProposalClient {
  name: string;
  /** The age at the next birthday on `ageSetOn`. */
  age: number | null;
  /** The KPM's day the age was entered, `YYYY-MM-DD`. */
  ageSetOn: string | null;
  gender: LeadGender | null;
  details: ProposalClientDetails;
}

/** What step 1 sends of the client: the name is the lead's, never sent. */
export interface ProposalClientInput {
  age?: number;
  gender?: LeadGender;
  details?: ProposalClientDetails;
}

export interface ProposalOptionView {
  label: string;
  years: number | null;
  currency: ProposalCurrency | null;
}

/** One field of a product's card, as the catalogue holds it — less the Super Admin's *Perlu dicek* mark. */
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

/**
 * **One pay term of a product** (ADR-0255 §2): its years, the age it is paid to, or single — and the oldest age at the
 * next birthday it is offered at. An older insured sees it crossed out.
 */
export interface PayTermView {
  key: string;
  label: string;
  years: number | null;
  toAge: number | null;
  single: boolean;
  maxEntryAge: number | null;
  default: boolean;
}

export interface PlanRuleEntryView {
  when: Record<string, string>;
  value: string;
}

/** How a `derived` field is worked out: the server's; the card only shows it, *otomatis*. */
export interface PlanRuleView {
  field: string;
  rules: PlanRuleEntryView[];
}

export interface EntryAgeView {
  min: number;
  max: number;
}

export interface SnapshotLimits {
  upStep: number | null;
  upMin: number | null;
  upMax: number | null;
  premiumMin: number | null;
  premiumMax: number | null;
}

/** What the item copied from the product when it was added, never refreshed (ADR-0225 §6; ADR-0255 §6). */
export interface ProposalSnapshot {
  name: string;
  syariahName: string | null;
  typeLabel: string;
  category: string;
  needTag: NeedTag;
  /** A syariah product: *Kontribusi*, *Santunan asuransi*, *Peserta*. */
  isSyariah: boolean;
  calcType: CalcType;
  currencies: ProposalCurrency[];
  fields: ProposalFieldView[];
  planRule: PlanRuleView | null;
  payTerms: PayTermView[];
  frequencies: PayFrequency[];
  smokerRated: boolean;
  entryAge: EntryAgeView | null;
  limits: SnapshotLimits;
  benefits: string[];
  pdfDetail: PdfDetailBlockView[];
}

export interface ProposalInsured {
  relation: InsuredRelation;
  name: string | null;
  age: number | null;
  gender: LeadGender | null;
}

export interface ProposalMoney {
  amountMinor: number;
  currency: ProposalCurrency;
}

/** ***Total premi***, per currency **and per *Cara bayar*** (ADR-0255 §7): never a monthly and an annual figure in one. */
export interface ProposalTotal {
  currency: ProposalCurrency;
  payFrequency: PayFrequency;
  amountMinor: number;
  items: number;
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
  name: string;
  /** The `plan` field's value — chosen, fixed or derived. */
  plan: string | null;
  currency: ProposalCurrency;
  snapshot: ProposalSnapshot;
  insured: ProposalInsured;
  /** *Merokok?*: `false` by default on a smoker-rated product, else `null`. */
  smoker: boolean | null;
  /** A `chips` field's option label; a `money` field's minor units; a `derived` field's value. */
  fieldValues: Record<string, string | number>;
  /** The chosen pay term's `key`, or `null`. */
  payTerm: string | null;
  payFrequency: PayFrequency;
  /** The sum assured, on an `up_premium` product. */
  up: ProposalMoney | null;
  premium: ProposalMoney | null;
  /** The amount typed last, which the server's calculation keeps (P19.15-T1); outlined on the card. */
  fixedField: FixedField;
  /** The premium table version the amounts came from, and its *Berlaku mulai*; `null` — typed. */
  rateTableVersionId: string | null;
  rateTableEffectiveFrom: string | null;
  /** The card's one-line note, a code (`CalcNote`). */
  calcNote: CalcNote | string | null;
  /** **What the card shows of its calculation** (P19.15-T1; ADR-0258 §5); `null` on a typed item. */
  calc?: ItemCalc | null;
  totalPaid: ProposalTotalPaid | null;
  /** Always `null`: the compare mode is *Later*. */
  choice: null;
}

export interface Proposal {
  id: string;
  version: number;
  leadId: string;
  leadDeleted: boolean;
  client: ProposalClient;
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

/** `PATCH /proposals/:id`'s answer: the items a change of the client's age took out, by id. */
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

/** One line of *Riwayat*, and of the lead sheet's *Proposal* section. */
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

/** A product step 2 may add (ADR-0225 §7; ADR-0255 §8): conventional and syariah alike, greyed when out of age. */
export interface CatalogProduct {
  productId: string;
  code: string;
  name: string;
  category: ProductCategoryCode;
  /** Step 2's category chip, and the card's label. */
  typeLabel: string;
  needTag: NeedTag;
  isSyariah: boolean;
  calcType: CalcType;
  defaultInsured: 'client' | 'child';
  currency: CatalogCurrency;
  fields: ProposalFieldView[];
  payTerms: PayTermView[];
  frequencies: PayFrequency[];
  smokerRated: boolean;
  planRule: PlanRuleView | null;
  entryAge: EntryAgeView | null;
  /** The client's age is outside `entryAge`: greyed, *"Usia {n} di luar batas ({min}–{max})"*, never added. */
  outOfAge: boolean;
  plans: CatalogPlan[];
  faq: CatalogFaq[];
  riders: CatalogRiderName[];
}

export interface ProposalCatalog {
  products: CatalogProduct[];
}

/** What a proposal's write may carry: *Tampilkan total*, and step 1's lead and client. */
export interface ProposalSettingsPatch {
  showTotal?: boolean;
  leadId?: string;
  client?: ProposalClientInput;
}

/** What an item's write may carry. A `null` field value clears a money field. */
export interface ProposalItemPatch {
  insured?: { relation: InsuredRelation; name?: string | null; age?: number | null; gender?: LeadGender | null };
  fieldValues?: Record<string, string | number | null>;
  smoker?: boolean;
  payTerm?: string;
  payFrequency?: PayFrequency;
  up?: { amountMinor: number | null };
  premium?: { amountMinor: number | null };
}

// ------------------------------------------------------------------------------------------------ addresses

/** *Riwayat*, the Sales tools strip's third tab (ADR-0221 §8). */
export const PROPOSAL_HREF = '/proposal';

/** Step 1 with nothing stored: `?leadId=` chooses that lead (*Buat proposal* on a lead's card and sheet). */
export function newProposalHref(leadId?: string): string {
  return leadId ? `/proposal/new?leadId=${encodeURIComponent(leadId)}` : '/proposal/new';
}

/** Where a stored proposal opens (P19.14-T1 AC-1): step 1 *Untuk siapa*, step 2 *Produk*, or the result, the PDF. */
export type ProposalView = 1 | 2 | 'pdf';

/** A stored proposal at a step, or at its result (`?step=pdf`). */
export function proposalHref(id: string, view?: ProposalView): string {
  return view ? `/proposal/${encodeURIComponent(id)}?step=${view}` : `/proposal/${encodeURIComponent(id)}`;
}

/**
 * **Where a proposal's row opens** (P19.14-T4 AC-3; ADR-0257 §3): a *Selesai* one at its result, the PDF; a *Draf* at
 * its products, where it is finished. *Riwayat*'s rows and the lead sheet's read the same rule.
 */
export function proposalRowHref(row: { id: string; status: ProposalStatus }): string {
  return proposalHref(row.id, row.status === 'done' ? 'pdf' : 2);
}

/**
 * The view a `?step=` asks for: `1`, `pdf` — and `3`, an address saved before P19.14, for the PDF — and step 2 for anything
 * else (a stored proposal opens on its products).
 */
export function stepOf(value: string | undefined | null): ProposalView {
  if (value === '1') return 1;
  if (value === 'pdf' || value === '3') return 'pdf';
  return 2;
}

// ------------------------------------------------------------------------------------------------ words

/** A field's label on this item: its `labelSyariah` on a syariah product, where it has one (ADR-0255 §1). */
export function fieldLabel(field: Pick<ProposalFieldView, 'label' | 'labelSyariah'>, isSyariah: boolean): string {
  return isSyariah && field.labelSyariah ? field.labelSyariah : field.label;
}

const HONORIFICS = ['pak', 'bapak', 'bu', 'ibu', 'bpk', 'bpk.', 'sdr', 'sdr.', 'sdri', 'sdri.', 'mas', 'mbak', 'kak', 'dr', 'dr.'];

/** **The first name** a *Tertanggung* chip shows for the client (*"Budi"* of *"Pak Budi Santoso"*): honorifics skipped. */
export function firstNameOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.find((word) => !HONORIFICS.includes(word.toLowerCase())) ?? words[0] ?? name;
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

/**
 * The draft, created at step 1's *Lanjut* for one of the reader's own Sales leads with step 1's client — **or the lead's
 * empty draft the reader already has**, its client taken from this call, which the server answers rather than making
 * another (P19.11-T3 AC-8; P19.14-T1).
 */
export const createProposal = (leadId: string, client: ProposalClientInput) =>
  api<Proposal>('/proposals', { method: 'POST', body: { leadId, client } });

export const readProposal = (id: string) => api<Proposal>(`/proposals/${encodeURIComponent(id)}`);

/** The products step 2 may add, each `outOfAge` for this client's age. */
export const proposalCatalog = (age: number | null) =>
  api<ProposalCatalog>('/proposals/catalog' + qs({ age: age ?? undefined }));

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
 * ***Simpan PDF*'s first half** (ADR-0221 §4; ADR-0222 §5): *Selesai*, and the lead's note. The result's button calls it
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
