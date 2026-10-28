import { api } from './api-client';
import { formatPercent } from './format';

/**
 * **Sales tools** (`docs/02-specs/functional/sales-tools.md`, Phase 14): the shapes the field reads
 * answer, the calls that ask for them, and the words the two screens draw them with — the Product
 * Catalog (`/product-catalog`, its drawer at `/product-catalog/[productCode]`) and the Sales Attack Plan
 * (`/attack-plan`).
 *
 * **Every word an office writes reaches these screens already approved** (ADR-0037, ADR-0120): the
 * server answers the office's approved words field by field, else the company's, and nothing here could
 * ask for a draft. **The recommendation is the server's** (D-scoring): nothing here scores, ranks or
 * judges a fit — a screen prints the verdict it is answered.
 *
 * Each interface is spelled out with named nested types, so `contract.spec.ts` can read its fields
 * against `backend/openapi.json`: it reads an interface's body up to the first `}`.
 */

/** A product's line (`Overall.html:9534`). */
export type ProductChannel = 'conventional' | 'syariah';

/** `closed_to_new_business` is *In run-off*. A withdrawn product is on no field read. */
export type CatalogLifecycle = 'active' | 'closed_to_new_business';

export interface CatalogCategory {
  code: string;
  label: string;
}

/** One card of the office's shelf (`Overall.html:10172-10181`). `name` is the office's display name. */
export interface CatalogCard {
  code: string;
  name: string;
  tagline: string;
  category: CatalogCategory;
  channel: ProductChannel;
  lifecycle: CatalogLifecycle;
  needs: string[];
}

export interface CatalogList {
  products: CatalogCard[];
}

/** One year of the company's schedule: `rate` is a proportion, `0.4` is 40%. */
export interface CommissionRate {
  year: number;
  rate: number;
}

/** The seven script fields, each the office's approved words or the company's. Plain text, always. */
export interface CatalogScript {
  goodFit: string;
  opening: string;
  benefits: string[];
  fullScript: string;
  objectionTheySay: string;
  objectionYouSay: string;
  nextAction: string;
}

export interface CatalogDocument {
  slot: string;
  label: string;
  available: boolean;
}

/**
 * One product as the drawer reads it. `commissionSchedule` is **absent** for a reader without the
 * grant, and empty while the company has stated none (OD-135, F-15).
 */
export interface CatalogProduct {
  code: string;
  name: string;
  tagline: string;
  category: CatalogCategory;
  channel: ProductChannel;
  lifecycle: CatalogLifecycle;
  needs: string[];
  benefits: string[];
  differentiator: string;
  bestFit: string;
  runOffNote: string | null;
  commissionSchedule?: CommissionRate[];
  script: CatalogScript;
  documents: CatalogDocument[];
}

export interface DocumentLink {
  url: string;
  expiresAt: string;
}

/** The customer brief: three questions, as drawn (OD-134). The bands are the domain constants' numbers. */
export interface AttackPlanBrief {
  need: string;
  age: number;
  budget: number;
}

export interface AttackPlanAlternative {
  code: string;
  name: string;
}

export type FitVerdict = 'good_fit' | 'check_fit';
export type FitIssue = 'age' | 'budget';

/** The plan for a brief: the product shown, its fit, and the brief's other matches in order. */
export interface AttackPlan {
  brief: AttackPlanBrief;
  product: CatalogProduct | null;
  verdict: FitVerdict | null;
  outside: FitIssue[];
  alternatives: AttackPlanAlternative[];
  moreCount: number;
  /** The office keeps nothing on: the screen draws the empty shelf, not *no product matches this need*. */
  shelfEmpty: boolean;
}

// ------------------------------------------------------------------------------------------- calls

export const readCatalog = () => api<CatalogList>('/product-catalog');

export const readCatalogProduct = (code: string) =>
  api<CatalogProduct>(`/product-catalog/${encodeURIComponent(code)}`);

/** A link valid 300 seconds, signed when it is asked for — never held on the page. */
export const openDocumentLink = (code: string, slot: string) =>
  api<DocumentLink>(`/product-catalog/${encodeURIComponent(code)}/documents/${encodeURIComponent(slot)}/url`);

/** The plan for a brief, or — with `product` — that alternative re-fitted against it. */
export const readAttackPlan = (brief: AttackPlanBrief, product?: string) =>
  api<AttackPlan>(`/attack-plan?${briefQuery(brief, product)}`);

// ------------------------------------------------------------------------------ the brief's choices

export interface Choice<T extends string | number> {
  readonly value: T;
  readonly label: string;
}

/**
 * The brief's chips, verbatim (`Overall.html:3801-3836`). Their values are the domain constants' — the
 * eight needs and the band numbers (`backend/src/domain/constants/product-catalog.ts`, `attack-plan.ts`)
 * — and `product-catalog.spec.ts` pins every value and label to that file.
 */
export const NEED_CHOICES: readonly Choice<string>[] = [
  { value: 'life-protection', label: 'Life protection' },
  { value: 'health', label: 'Health' },
  { value: 'ci', label: 'Critical illness' },
  { value: 'accident', label: 'Accident-only' },
  { value: 'education', label: 'Education' },
  { value: 'investment', label: 'Investment' },
  { value: 'retirement', label: 'Retirement income' },
  { value: 'legacy', label: 'Legacy / inheritance' },
];

export const AGE_CHOICES: readonly Choice<number>[] = [
  { value: 1, label: '< 25' },
  { value: 2, label: '25–34' },
  { value: 3, label: '35–49' },
  { value: 4, label: '50–64' },
  { value: 5, label: '65+' },
];

/**
 * The monthly budget bands, **compact** as a chip's money is (ADR-0167 §1, parity I-394): the prototype's
 * *Rp500K–Rp2M* wrote a million *M*, which in Indonesian is *miliar* — a thousand times more. Keyed by `value`;
 * nothing matches on the words.
 */
export const BUDGET_CHOICES: readonly Choice<number>[] = [
  { value: 1, label: '< Rp 500 rb' },
  { value: 2, label: 'Rp 500 rb–Rp 2 jt' },
  { value: 3, label: 'Rp 2 jt–Rp 5 jt' },
  { value: 4, label: 'Rp 5 jt–Rp 10 jt' },
  { value: 5, label: 'Rp 10 jt–Rp 20 jt' },
  { value: 6, label: '> Rp 20 jt' },
  { value: 7, label: 'Lump-sum' },
];

/**
 * **The band that is not a monthly premium**: *Lump-sum*, the backend's `PRODUCT_LUMP_SUM_BUDGET_BAND`
 * (`product-catalog.spec.ts` pins the number to that file). The brief asks it as **its own option** beside
 * *Monthly premium budget*, not as that question's seventh chip (P18.95-T6 AC-3; UI-030, parity I-422). Its
 * number is unchanged, so `?budget=7` and every product's bands mean what they did.
 */
export const LUMP_SUM_BUDGET = 7;

/** *Monthly premium budget*'s chips: the six monthly bands, 1 to 6. */
export const MONTHLY_BUDGET_CHOICES: readonly Choice<number>[] = BUDGET_CHOICES.filter((c) => c.value !== LUMP_SUM_BUDGET);

/** The option of its own after them: *Lump-sum*. */
export const LUMP_SUM_CHOICES: readonly Choice<number>[] = BUDGET_CHOICES.filter((c) => c.value === LUMP_SUM_BUDGET);

/** The catalog's category tabs after *All products*, in order (`Overall.html:10116-10122`). */
export const CATEGORY_TABS: readonly Choice<string>[] = [
  { value: 'life', label: 'Life' },
  { value: 'health', label: 'Health' },
  { value: 'ci', label: 'Critical illness' },
  { value: 'education', label: 'Education' },
  { value: 'investment', label: 'Investment-linked' },
];

export const CHANNEL_LABELS: Readonly<Record<ProductChannel, string>> = {
  conventional: 'Conventional',
  syariah: 'Syariah',
};

const labelOf = <T extends string | number>(choices: readonly Choice<T>[], value: T | undefined) =>
  choices.find((c) => c.value === value)?.label;

export const needLabel = (need: string | undefined) => labelOf(NEED_CHOICES, need);
export const ageLabel = (age: number | undefined) => labelOf(AGE_CHOICES, age);
export const budgetLabel = (budget: number | undefined) => labelOf(BUDGET_CHOICES, budget);

/**
 * The result's tag: the shown product's own need, with its channel (`Overall.html:9682`). The prototype
 * falls back to the category when a need has no label; every need has one here.
 */
export const resultTag = (product: Pick<CatalogProduct, 'needs' | 'category' | 'channel'>) =>
  `${needLabel(product.needs[0]) ?? product.category.label} · ${CHANNEL_LABELS[product.channel]}`;

// ------------------------------------------------------------------------------------- addresses

type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (typeof value === 'string' && value ? value : undefined);

function bandOf(value: string | undefined, choices: readonly Choice<number>[]): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return choices.some((c) => c.value === n) ? n : undefined;
}

/**
 * The brief an address holds (D-urls): `?need=&age=&budget=` all three valid, or nothing — a band out of
 * range opens the brief with nothing chosen (P14-T8 AC-7) rather than half a brief.
 */
export function briefFromQuery(query: Query): AttackPlanBrief | null {
  const need = one(query.need);
  const age = bandOf(one(query.age), AGE_CHOICES);
  const budget = bandOf(one(query.budget), BUDGET_CHOICES);
  if (!need || !NEED_CHOICES.some((c) => c.value === need) || age === undefined || budget === undefined) return null;
  return { need, age, budget };
}

/** The product an address names — the catalog's deep link, or an alternative switched to. */
export const productFromQuery = (query: Query): string | undefined => one(query.product);

function briefQuery(brief: AttackPlanBrief, product?: string): string {
  const params = new URLSearchParams({ need: brief.need, age: String(brief.age), budget: String(brief.budget) });
  if (product) params.set('product', product);
  return params.toString();
}

/** The two Sales tools screens' own addresses: the sidebar's one entry and the tabs over both (P18.8-T12). */
export const SALES_ATTACK_PLAN_HREF = '/attack-plan';
export const PRODUCT_CATALOG_HREF = '/product-catalog';

/** `/attack-plan?need=…&age=…&budget=…`, with `&product=` for an alternative. */
export const planHref = (brief: AttackPlanBrief, product?: string) => `/attack-plan?${briefQuery(brief, product)}`;

/** The catalog's deep link into the plan, with no brief (`Overall.html:9858-9866`). */
export const productPlanHref = (code: string) => `/attack-plan?${new URLSearchParams({ product: code })}`;

/** The catalog's filters, as its address carries them (D-urls). `all` is the absence of one. */
export interface CatalogFilters {
  category: string;
  channel: 'all' | ProductChannel;
}

export function filtersFrom(params: { get(name: string): string | null }): CatalogFilters {
  const category = params.get('category');
  const channel = params.get('channel');
  return {
    category: category && CATEGORY_TABS.some((c) => c.value === category) ? category : 'all',
    channel: channel === 'conventional' || channel === 'syariah' ? channel : 'all',
  };
}

/** `?category=…&channel=…`, or nothing for *All* and *All*. */
export function filtersQuery(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.category !== 'all') params.set('category', filters.category);
  if (filters.channel !== 'all') params.set('channel', filters.channel);
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const catalogHref = (filters: CatalogFilters) => `/product-catalog${filtersQuery(filters)}`;

/**
 * **The catalog's search, by product name** (P18.95-T6 AC-4; UI-023: 31 products, no search). The name the card
 * shows — the office's display name, else the company's — contains what was typed, ignoring case, accents and
 * the spaces around it; nothing typed matches everything. Over the shelf already loaded: `GET /product-catalog`
 * answers the whole shelf in one read, so a search asks the server nothing.
 */
export function matchesSearch(name: string, term: string): boolean {
  const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('id-ID');
  const wanted = fold(term.trim());
  return wanted === '' || fold(name).includes(wanted);
}
export const drawerHref = (code: string, filters: CatalogFilters) =>
  `/product-catalog/${encodeURIComponent(code)}${filtersQuery(filters)}`;

// ------------------------------------------------------------------------------------------ words

/**
 * A commission rate as the drawer prints it: `0.4` is `40%`, `0.125` is `12,5%`, `0.0725` is `7,25%` — **the places
 * it was stored with and no more** (ADR-0174 §3: a figure stated as a rule keeps its places, and has no *,0*), so
 * the rate an agent reads is the rate stored. Two at most, the schedule's own (`toFixed(2)`).
 */
export const formatRate = (rate: number) => formatPercent(Number((rate * 100).toFixed(2)), { lossless: true });

/** `{n} product` or `{n} products` (`Overall.html:10170`). */
export const productCount = (n: number) => `${n} product${n === 1 ? '' : 's'}`;

/** The fit note's words (`Overall.html:9669-9675`): *age band*, *budget band*, or both joined by *and*. */
export function fitNote(outside: readonly FitIssue[]): string {
  const issues = outside.map((issue) => (issue === 'age' ? 'age band' : 'budget band'));
  return `Outside the typical ${issues.join(' and ')} for this product — still workable, but check eligibility and premium sizing before quoting.`;
}

/** `"{n} more also match. …"` (`Overall.html:9699`). */
export const moreLine = (n: number) => `${n} more also match. Open the Product Catalog to browse the full shelf.`;

/** Whether a product has an authored script: D-noscript keys the layout on `fullScript` alone. */
export const hasScript = (script: CatalogScript) => script.fullScript.trim() !== '';

/**
 * The two screens' words, verbatim (`Overall.html`; D-copy). *"Not uploaded by KPM yet."* keeps *KPM*, and
 * goes to the client with OD-39. **Two say *Tap* where the prototype says *click*** (P18.95-T9 AC-5; ADR-0167 §10,
 * the client's UI review UI-027): `catalogSubtitle` and `alsoMatches`.
 */
export const PROTOTYPE_COPY = {
  catalogTitle: 'Product Catalog',
  catalogSubtitle:
    'The full individual shelf — conventional and syariah. Tap any product for benefits, positioning, and its sales script.',
  allProducts: 'All products',
  all: 'All',
  runOff: 'In run-off',
  viewDetail: 'View detail →',
  noFilterMatch: 'No products match this filter.',
  close: '✕',
  tabDetails: 'Details',
  tabPlan: 'Attack Plan',
  tabDocuments: 'Documents',
  commissionRate: 'Commission rate',
  year: 'Year',
  rate: 'Rate',
  benefits: 'Benefits',
  standsOut: 'How it stands out',
  bestFit: 'Best-fit customer',
  openFullPlan: 'Open full Attack Plan page',
  noActiveScript: 'No active sales script',
  drawerRunOff: 'This product is in run-off — no active sales script. Use the Details tab for reference information only.',
  drawerNoScript: 'No authored script yet for this product.',
  openInPlan: 'Open in Sales Attack Plan page (add customer age & budget for a fit check) →',
  openLink: 'Open link →',
  notUploaded: 'Not uploaded by KPM yet.',
  goodFitFor: 'Good fit for',
  openingLine: 'Opening line',
  leadWithBenefits: 'Lead with these benefits',
  fullScript: 'Full script — how to narrate it',
  pushBack: 'If they push back',
  theySay: 'They say:',
  youSay: 'You say:',
  nextAction: 'Next action',
  planTitle: 'Sales Attack Plan',
  stepBrief: 'Customer brief',
  stepPlan: 'Attack plan',
  briefTitle: 'Who are we talking to?',
  /**
   * **One line where there were two** (P18.95-T7 AC-1, grey text row 10; ADR-0167 §7): the page's sub-line *"Tell us
   * about the customer. Get the product, the pitch, and the objection response."* and this hint, *"Three questions.
   * Enough to get a defensible recommendation, fast."*, became the client's one sentence at every size — here, beside
   * the three questions it counts, as on Recruitment's brief.
   */
  briefHint: 'Answer 3 questions to get your pitch.',
  primaryNeed: 'Primary need',
  ageBand: 'Age band',
  budget: 'Monthly premium budget',
  pickAll: 'Pick a need, age band, and budget to continue.',
  build: 'Build attack plan',
  back: 'Back',
  bannerLead: 'Opened from the ',
  bannerStrong: 'Product Catalog',
  bannerTail: ' — no customer profile set yet, so fit isn\'t checked.',
  addProfile: 'Add age & budget',
  needIs: 'Need: ',
  ageIs: 'Age: ',
  budgetIs: 'Budget: ',
  goodFit: 'Good fit',
  checkFit: 'Check fit',
  fromCatalog: 'From catalog',
  planRunOff:
    'This product is in run-off and not actively issued to new applicants. No active sales script — shown for reference against existing policyholders only.',
  planNoScriptNext: 'No authored script yet for this product — confirm details manually before proposing.',
  alsoMatches: 'Also matches this need — tap to switch the plan above:',
  noMatch: 'No active product matches this need. Try a different need in the brief.',
} as const;

/**
 * **The strings these screens write themselves** (Fills; D-copy): the states the prototype has none of,
 * and the commission's not-set line. None uses *office*, *KPM*, *reports to*, *tagged to*, *untagged* or
 * *unassigned* (ADR-0084's rule, as ADR-0096 applied it) — `product-catalog.spec.ts` checks.
 */
export const OWN_COPY = {
  loadingShelf: 'Loading products…',
  loadingProduct: 'Loading this product…',
  loadingPlan: 'Building your attack plan…',
  tryAgain: 'Try again',
  emptyShelf: 'There are no products on your shelf yet.',
  emptyShelfHint: 'Products appear here once they are made available to you.',
  notFound: 'This product isn\'t on your shelf.',
  notFoundHint: 'It may have been withdrawn or switched off, or the address may be mistyped.',
  backToCatalog: 'Back to Product Catalog',
  commissionNotSet: 'Not set yet — the company has not given a rate for this product.',
  /** A document's link, described by its slot (`{label} — opens in a new tab`). */
  opensInNewTab: (label: string) => `${label} — opens in a new tab`,
  documentFailed: 'Could not open this document.',
  openingDocument: 'Opening…',
  closeDrawer: 'Close',
  categories: 'Category',
  channels: 'Channel',
  steps: 'Steps',
  productTabs: 'Product details',
  /** The second budget group's name: *Lump-sum*, asked apart from the monthly bands (P18.95-T6 AC-3; UI-030). */
  lumpSum: 'Or pay once',
  /** The catalog's search (P18.95-T6 AC-4; UI-023): its name, its placeholder, and what a search that finds nothing says. */
  searchName: 'Search products by name',
  searchPlaceholder: 'Search products…',
  noSearchMatch: (term: string) => `No products match “${term.trim()}”.`,
} as const;
