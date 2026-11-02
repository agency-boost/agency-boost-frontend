import { messagesIn } from '@/i18n/catalogue';
import { DEFAULT_LANGUAGE, SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { planMessages } from '@/i18n/messages/plan';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import { salesAttackPlanMessages } from '@/i18n/messages/sales-attack-plan';
import { api } from './api-client';
import { formatPercent, formatRupiahCompact, toMinor } from './format';

/**
 * **Sales tools** (`docs/02-specs/functional/sales-tools.md`, Phase 14): the shapes the field reads
 * answer, the calls that ask for them, and the words the two screens draw them with — the Product
 * Catalog (`/product-catalog`, its drawer at `/product-catalog/[productCode]`) and the Sales Attack Plan
 * (`/attack-plan`).
 *
 * **The words are the catalogue's** (P18.98-T4; ADR-0179 §4): `messages/product-catalog.ts`,
 * `messages/sales-attack-plan.tsx` and the two plans' `messages/plan.ts`. A function here that writes words takes the
 * reader's language last — English (`SOURCE_LANGUAGE`) when none is passed, so its spec reads as before; one that
 * writes a figure takes the figures' language — Indonesian (`DEFAULT_LANGUAGE`) when none is passed; one that writes
 * both takes `figures`, then `words`. A screen passes `useFigureLanguage()` and `useLanguage()`.
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

/** A need's code: the domain constants' (`PRODUCT_NEED_LABELS`), the keys of the brief's words. */
export type NeedCode = keyof typeof salesAttackPlanMessages.en.needs;

/** The brief's eight needs, in the chips' order (`Overall.html:3803-3810`). */
const NEED_CODES: readonly NeedCode[] = [
  'life-protection', 'health', 'ci', 'accident', 'education', 'investment', 'retirement', 'legacy',
];

const isNeed = (need: string | undefined): need is NeedCode => NEED_CODES.some((code) => code === need);

/**
 * **The brief's need chips, in the reader's `words`** (P18.98-T4; `Overall.html:3801-3810`): the domain constants'
 * codes, each labelled from the catalogue (`messages/sales-attack-plan.tsx`). English when no language is passed.
 */
export const needChoices = (words: Language = SOURCE_LANGUAGE): Choice<string>[] => {
  const t = messagesIn(salesAttackPlanMessages, words);
  return NEED_CODES.map((value) => ({ value, label: t.needs[value] }));
};

/**
 * The brief's need chips in English, the catalogue's source. Their values are the domain constants' — the eight needs
 * and the band numbers (`backend/src/domain/constants/product-catalog.ts`, `attack-plan.ts`) — and
 * `product-catalog.spec.ts` pins every value and English label to that file.
 */
export const NEED_CHOICES: readonly Choice<string>[] = needChoices();

/** The age bands: figures under a thousand, written alike in both languages (`PRODUCT_AGE_BAND_LABELS`, pinned). */
export const AGE_CHOICES: readonly Choice<number>[] = [
  { value: 1, label: '< 25' },
  { value: 2, label: '25–34' },
  { value: 3, label: '35–49' },
  { value: 4, label: '50–64' },
  { value: 5, label: '65+' },
];

/**
 * **The band that is not a monthly premium**: *Lump-sum*, the backend's `PRODUCT_LUMP_SUM_BUDGET_BAND`
 * (`product-catalog.spec.ts` pins the number to that file). The brief asks it as **its own option** beside
 * *Monthly premium budget*, not as that question's seventh chip (P18.95-T6 AC-3; UI-030, parity I-422). Its
 * number is unchanged, so `?budget=7` and every product's bands mean what they did.
 */
export const LUMP_SUM_BUDGET = 7;

/** The seven budget bands, numbered as the backend's `PRODUCT_BUDGET_BANDS`: six monthly, then the single payment. */
const BUDGET_BANDS = [1, 2, 3, 4, 5, 6, LUMP_SUM_BUDGET] as const;

/**
 * **What each monthly band spans, in rupiah** — the sums its chip writes (P18.98-T4): a band below the first, between
 * two, or above the last. Nothing matches on them: a band is its number, and the scorer is the server's. Written in
 * Indonesian figures, the labels below are the backend's `PRODUCT_BUDGET_BAND_LABELS` to the character, and
 * `product-catalog.spec.ts` pins them to that file, so a band cannot say one sum here and another on the server.
 */
const MONTHLY_BUDGET_SPANS: Readonly<Record<number, { readonly from?: number; readonly to?: number }>> = {
  1: { to: 500_000 },
  2: { from: 500_000, to: 2_000_000 },
  3: { from: 2_000_000, to: 5_000_000 },
  4: { from: 5_000_000, to: 10_000_000 },
  5: { from: 10_000_000, to: 20_000_000 },
  6: { from: 20_000_000 },
};

/**
 * **A budget band as its chip and the brief's summary write it** — its sums **compact**, as a chip's money is (ADR-0167
 * §1, ADR-0174 §4; parity I-394), in the reader's `figures` (P18.98-T3): *< Rp 500 rb*, *Rp 500 rb–Rp 2 jt* in Indonesian,
 * *< IDR 500K*, *IDR 500K–IDR 2M* in English — the prototype's *Rp500K–Rp2M* wrote a million *M*, which in Indonesian is
 * *miliar*. Band 7 is words, *Lump-sum*, in the reader's `words`. Indonesian figures and English words when none is
 * passed: the backend's labels, as before. `undefined` for a band that does not exist.
 */
export function budgetLabel(
  budget: number | undefined,
  figures: Language = DEFAULT_LANGUAGE,
  words: Language = SOURCE_LANGUAGE,
): string | undefined {
  if (budget === LUMP_SUM_BUDGET) return messagesIn(salesAttackPlanMessages, words).lumpSum;
  const span = budget === undefined ? undefined : MONTHLY_BUDGET_SPANS[budget];
  if (!span) return undefined;
  const sum = (rupiah: number) => formatRupiahCompact(toMinor(rupiah), {}, figures);
  if (span.from === undefined) return `< ${sum(span.to ?? 0)}`;
  if (span.to === undefined) return `> ${sum(span.from)}`;
  return `${sum(span.from)}–${sum(span.to)}`;
}

/** **The seven budget chips**, in the reader's figures and words (`budgetLabel`); keyed by `value`, and nothing matches on the words. */
export const budgetChoices = (figures: Language = DEFAULT_LANGUAGE, words: Language = SOURCE_LANGUAGE): Choice<number>[] =>
  BUDGET_BANDS.map((value) => ({ value, label: budgetLabel(value, figures, words) ?? String(value) }));

/** The seven bands as the backend labels them — Indonesian figures, English words — which the spec pins. */
export const BUDGET_CHOICES: readonly Choice<number>[] = budgetChoices();

/** *Monthly premium budget*'s chips: the six monthly bands, 1 to 6. */
export const MONTHLY_BUDGET_CHOICES: readonly Choice<number>[] = BUDGET_CHOICES.filter((c) => c.value !== LUMP_SUM_BUDGET);

/** The option of its own after them: *Lump-sum*. */
export const LUMP_SUM_CHOICES: readonly Choice<number>[] = BUDGET_CHOICES.filter((c) => c.value === LUMP_SUM_BUDGET);

/** A category's code, the domain constants' (`PRODUCT_CATEGORIES`), in the tabs' order (`Overall.html:10116-10122`). */
export type CategoryCode = keyof typeof productCatalogMessages.en.category;
const CATEGORY_CODES: readonly CategoryCode[] = ['life', 'health', 'ci', 'education', 'investment'];

/**
 * **The catalog's category tabs after *All products*, in the reader's `words`** (UI V1, UI-107: *Jiwa*, *Kesehatan*,
 * *Penyakit kritis*, *Pendidikan*, *Unit link* in Indonesian; §A.3 kept them English until 2026-10-30). English when no
 * language is passed.
 */
export const categoryTabs = (words: Language = SOURCE_LANGUAGE): Choice<string>[] => {
  const t = messagesIn(productCatalogMessages, words);
  return CATEGORY_CODES.map((value) => ({ value, label: t.category[value] }));
};

/** The tabs in English, the catalogue's source: what the address's `?category=` is checked against. */
export const CATEGORY_TABS: readonly Choice<string>[] = categoryTabs();

/** A category's name in the reader's `words`, or `undefined` for a code that is not one of the five. */
export const categoryLabel = (code: string, words: Language = SOURCE_LANGUAGE): string | undefined =>
  (CATEGORY_CODES as readonly string[]).includes(code)
    ? messagesIn(productCatalogMessages, words).category[code as CategoryCode]
    : undefined;

/** A product's channel in the reader's `words` (`:9534`): *Conventional*, *Syariah*; English when none is passed. */
export const channelLabel = (channel: ProductChannel, words: Language = SOURCE_LANGUAGE): string =>
  messagesIn(productCatalogMessages, words).channel[channel];

/** The channels in English, the catalogue's source, which `product-catalog.spec.ts` pins to the backend's labels. */
export const CHANNEL_LABELS: Readonly<Record<ProductChannel, string>> = {
  conventional: channelLabel('conventional'),
  syariah: channelLabel('syariah'),
};

const labelOf = <T extends string | number>(choices: readonly Choice<T>[], value: T | undefined) =>
  choices.find((c) => c.value === value)?.label;

/** A need's chip, in the reader's `words`; `undefined` for a code that is not one of the eight. */
export const needLabel = (need: string | undefined, words: Language = SOURCE_LANGUAGE): string | undefined =>
  (isNeed(need) ? messagesIn(salesAttackPlanMessages, words).needs[need] : undefined);
export const ageLabel = (age: number | undefined) => labelOf(AGE_CHOICES, age);

/**
 * The result's tag: the shown product's own need, with its channel (`Overall.html:9682`), in the reader's `words`. The
 * prototype falls back to the category when a need has no label — the server's, a kept term; every need has one here.
 */
export const resultTag = (product: Pick<CatalogProduct, 'needs' | 'category' | 'channel'>, words: Language = SOURCE_LANGUAGE) =>
  `${needLabel(product.needs[0], words) ?? product.category.label} · ${channelLabel(product.channel, words)}`;

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
 * the rate an agent reads is the rate stored. Two at most, the schedule's own (`toFixed(2)`). In the reader's
 * `figures` (P18.98-T3): *12.5%* in English; Indonesian when none is passed.
 */
export const formatRate = (rate: number, figures: Language = DEFAULT_LANGUAGE) =>
  formatPercent(Number((rate * 100).toFixed(2)), { lossless: true }, figures);

/** `{n} product` or `{n} products` (`Overall.html:10170`), in the reader's `words`: *{n} produk* in Indonesian. */
export const productCount = (n: number, words: Language = SOURCE_LANGUAGE) =>
  messagesIn(productCatalogMessages, words).productCount({ n });

/**
 * The fit note (`Overall.html:9669-9675`): the product is outside the brief's *age band*, *budget band*, or both joined by
 * *and* — in the server's order, and the reader's `words`.
 */
export const fitNote = (outside: readonly FitIssue[], words: Language = SOURCE_LANGUAGE): string =>
  messagesIn(salesAttackPlanMessages, words).fitNote({ outside });

/** `"{n} more also match. …"` (`Overall.html:9699`), in the reader's `words`. */
export const moreLine = (n: number, words: Language = SOURCE_LANGUAGE) => messagesIn(salesAttackPlanMessages, words).more({ n });

/** Whether a product has an authored script: D-noscript keys the layout on `fullScript` alone. */
export const hasScript = (script: CatalogScript) => script.fullScript.trim() !== '';

/**
 * **The strings these screens write themselves, in English** (Fills; D-copy) — the catalogue's source
 * (`messages/product-catalog.ts`, `messages/sales-attack-plan.tsx`, `messages/plan.ts`), for code with no reader to ask,
 * as they read before P18.98-T4 moved every word of the two screens into the catalogue, where they are written once: the
 * states the prototype has none of, the commission's not-set line, the accessible names. The screens read them with
 * `useMessages`, in the reader's language. None uses *office*, *KPM*, *reports to*, *tagged to*, *untagged* or
 * *unassigned* (ADR-0084's rule, as ADR-0096 applied it) — `product-catalog.spec.ts` checks the English, and
 * `product-catalog-words.spec.ts` both languages.
 */
const CATALOG = productCatalogMessages.en;
const PLAN = salesAttackPlanMessages.en;

export const OWN_COPY = {
  loadingShelf: CATALOG.loadingShelf,
  loadingProduct: CATALOG.drawer.loading,
  loadingPlan: PLAN.loading,
  tryAgain: CATALOG.tryAgain,
  emptyShelf: CATALOG.emptyShelf,
  emptyShelfHint: CATALOG.emptyShelfHint,
  notFound: CATALOG.drawer.notFound,
  notFoundHint: CATALOG.drawer.notFoundHint,
  backToCatalog: CATALOG.drawer.backToCatalog,
  commissionNotSet: CATALOG.drawer.commissionNotSet,
  /** A document's link, described by its slot (`{label} — opens in a new tab`). */
  opensInNewTab: (label: string) => CATALOG.drawer.opensInNewTab({ label }),
  documentFailed: CATALOG.drawer.documentFailed,
  openingDocument: CATALOG.drawer.opening,
  closeDrawer: CATALOG.drawer.close,
  categories: CATALOG.categories,
  channels: CATALOG.channels,
  steps: planMessages.en.steps,
  productTabs: CATALOG.drawer.tabs,
  /** The second budget group's name: *Lump-sum*, asked apart from the monthly bands (P18.95-T6 AC-3; UI-030). */
  lumpSum: PLAN.lumpSumGroup,
  /** The catalog's search (P18.95-T6 AC-4; UI-023): its name, its placeholder, and what a search that finds nothing says. */
  searchName: CATALOG.searchName,
  searchPlaceholder: CATALOG.searchPlaceholder,
  noSearchMatch: (term: string) => CATALOG.noSearchMatch({ term: term.trim() }),
} as const;
