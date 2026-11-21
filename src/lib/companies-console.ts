import { api } from './api-client';
import type { AttackPlan, Company, Product, ProductFields } from './admin';

/**
 * **Perusahaan & template, the API's side** (P19.23-T4; ADR-0278): *Perusahaan baru*, a product's draft and release,
 * and *Terbitkan ke KPM*. The Super Admin's alone — `company:crud`, `company_template:*`, `product_catalog:crud` — and
 * the API refuses every tenant role whatever a screen renders.
 */

/** *Mulai dari* (ADR-0278 §3): the Default template, or a copy of another company. */
export type CompanyStart = 'default' | 'company';

/** `POST /admin/companies/setup`: the company, and the default template it was given. */
export type SetUpCompany = Company & { templateId: string };

export const setUpCompany = (body: { name: string; slug: string; from: CompanyStart; fromCompanyId?: string }) =>
  api<SetUpCompany>('/admin/companies/setup', { method: 'POST', body });

// ------------------------------------------------------------------------------------ products

/** Where a product stands (ADR-0278 §4): a new product no KPM has yet, published with a draft waiting, or published. */
export type ProductReleaseState = 'unpublished' | 'draft' | 'published';

/** A product's draft fields: what *Info produk* and the *Sales attack plan* save, and *Juga sesuai*. */
export type ProductDraftFields = Partial<
  Pick<ProductFields, 'name' | 'tagline' | 'channel' | 'category' | 'currencies'> & {
    defaultAttackPlan: AttackPlan;
    alsoFits: string[];
  }
>;

export interface ProductDraftView {
  id: string;
  code: string;
  name: string;
  state: ProductReleaseState;
  /** The edits waiting, by field; `null` when none. */
  draft: ProductDraftFields | null;
  /** `null`: every KPM of the company. A list: the KPMs it was published to. */
  releasedTo: string[] | null;
  firstPublishedAt: string | null;
  /** *Juga sesuai*, as published. */
  alsoFits: string[];
  /** The company's brochure for it, or `null`. */
  brochure: { label: string } | null;
}

export const listProductDrafts = (companyId: string) =>
  api<ProductDraftView[]>(`/admin/companies/${companyId}/products/drafts`);

/** *+ Produk baru*: released to no KPM until *Terbitkan ke KPM* adds it to the KPMs chosen. */
export const createProductDraft = (
  companyId: string,
  body: { code: string; name: string; channel: Product['channel']; category: Product['category'] },
) => api<Product>(`/admin/companies/${companyId}/products/drafts`, { method: 'POST', body });

/** *Simpan draf*: merged over the draft already saved; a product no KPM has yet is written at once. */
export const saveProductDraft = (companyId: string, productId: string, body: ProductDraftFields) =>
  api<ProductDraftView>(`/admin/companies/${companyId}/products/${productId}/draft`, { method: 'PUT', body });

export const discardProductDraft = (companyId: string, productId: string) =>
  api<ProductDraftView>(`/admin/companies/${companyId}/products/${productId}/draft`, { method: 'DELETE' });

/** A product as the console shows it: the published row with its draft laid over it. */
export function withDraft(product: Product, draft: ProductDraftView | undefined): Product & { alsoFits: string[] } {
  const fields = draft?.draft ?? {};
  return {
    ...product,
    ...(fields as Partial<Product>),
    alsoFits: fields.alsoFits ?? draft?.alsoFits ?? [],
  };
}

// --------------------------------------------------------------------------- Terbitkan ke KPM

/** A row of *Pengaturan template* (ADR-0278 §5), by the API's key. */
export type PublicationSetting =
  | 'activity_types' | 'lead_statuses' | 'activation_checklist' | 'training' | 'capability_mapping' | 'events'
  | 'campaigns' | 'recruitment';

export interface PublicationChange {
  id: string;
  type: 'setting' | 'product_new' | 'product_change';
  setting: PublicationSetting | null;
  kinds: string[];
  productId: string | null;
  productCode: string | null;
  productName: string | null;
  draft: boolean;
  /** `chosen`: the KPMs ticked in step 2. `all`: every KPM that reads it, by itself. */
  reach: 'chosen' | 'all';
  overwrites: boolean;
  added: number;
  changed: number;
  removed: number;
  missing: number;
}

export interface PublicationKpm {
  id: string;
  code: string;
  name: string;
  /** Changes it made its own version of, which publishing to it would overwrite: *akan tertimpa*. */
  ownEdits: string[];
  upToDate: string[];
}

export interface PublicationView {
  companyId: string;
  templateId: string | null;
  library: boolean;
  changes: PublicationChange[];
  kpms: PublicationKpm[];
}

export interface PublicationSummary {
  companyId: string;
  changes: number;
  templateEmpty: boolean;
  kpms: number;
}

export type PublicationOutcome =
  | { id: string; outcome: 'published' }
  | { id: string; outcome: 'refused'; error: { code: string; message: string } };

export const readPublication = (companyId: string) =>
  api<PublicationView>(`/admin/companies/${companyId}/publication`);

export const readPublicationSummary = (companyId: string) =>
  api<PublicationSummary>(`/admin/companies/${companyId}/publication?summary=true`);

export const publishToKpms = (
  companyId: string,
  body: { changes: string[]; kpmIds: string[]; overwriteConfirmed?: boolean },
) => api<{ results: PublicationOutcome[] }>(`/admin/companies/${companyId}/publication`, { method: 'POST', body });

/**
 * **What the confirmation asks** (AC-5): the KPMs chosen whose own version of a chosen setting would be overwritten. Empty:
 * no tick is needed. Pure, so the rule the server applies again is tested without a screen.
 */
export function overwrittenBy(
  view: Pick<PublicationView, 'changes' | 'kpms'>, changeIds: ReadonlySet<string>, kpmIds: ReadonlySet<string>,
): PublicationKpm[] {
  const overwriting = view.changes.filter((c) => c.overwrites && changeIds.has(c.id)).map((c) => c.id);
  return view.kpms.filter((k) => kpmIds.has(k.id) && k.ownEdits.some((id) => overwriting.includes(id)));
}

/** Whether step 2 is needed: any change chosen that reaches only the KPMs ticked. */
export const needsKpms = (view: Pick<PublicationView, 'changes'>, changeIds: ReadonlySet<string>): boolean =>
  view.changes.some((c) => changeIds.has(c.id) && c.reach === 'chosen');
