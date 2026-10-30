'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { PlanIcon } from '@/components/plan/plan-icons';
import { Button, ErrorBanner, TextInput } from '@/components/ui/field';
import { TAB_PHONE, TAB_ROW_PHONE } from '@/components/ui/phone';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useTabRow } from '@/components/ui/use-tab-row';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  catalogHref, categoryTabs, drawerHref, filtersFrom, matchesSearch, productCount, readCatalog,
  type CatalogCard, type CatalogFilters, type ProductChannel,
} from '@/lib/product-catalog';
import { usePhone } from '@/lib/use-phone';

/** What the drawer beneath the grid needs from it: how to close, and where the focus goes back to. */
interface CatalogDrawerHost {
  /** Close the drawer: back to the grid the reader came from, or to the grid's own address. */
  close: () => void;
}

const DrawerHost = createContext<CatalogDrawerHost | null>(null);

/** The drawer's way back to the grid. Outside the catalog (a spec, say), it goes to the grid's address. */
export function useCatalogDrawerHost(): CatalogDrawerHost {
  const host = useContext(DrawerHost);
  const router = useRouter();
  return host ?? { close: () => router.push('/product-catalog') };
}

/** The channel tag's words and tint (`.tag.conv`, `.tag.syar`), and the run-off tag (`.tag.runoff`). */
const TAG = 'rounded-pill px-2 py-[3px] text-2xs font-bold uppercase tracking-wide';
const CHANNEL_TAG: Record<ProductChannel, string> = {
  conventional: 'bg-navy/[0.08] text-navy',
  // Navy words on the amber wash, where the prototype's amber-dark is 2.6:1 (`product-catalog.spec.ts`).
  syariah: 'bg-amber/[0.14] text-navy',
};

/**
 * The tags above a product's name: its channel, and *In run-off* where it is (`Overall.html:10174-10178`).
 * A `<span>`, never a `<div>`: it sits inside the card's `<button>`, whose content is phrasing content only.
 */
export function ProductTags({ channel, runOff }: { channel: ProductChannel; runOff: boolean }) {
  const t = useMessages(productCatalogMessages);
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className={cn(TAG, CHANNEL_TAG[channel])}>{t.channel[channel]}</span>
      {runOff && <span className={cn(TAG, 'bg-alert/[0.08] text-alert')}>{t.runOff}</span>}
    </span>
  );
}

/**
 * **The Product Catalog** (`/product-catalog`, `Overall.html:3872-3883`, logic `:10116-10186`; P14-T7): the
 * office's shelf — every product it keeps on, in the company's order, under its display names — by
 * category, filtered by category and channel.
 *
 * **It lives in the route's layout**, so it stays mounted while its drawer opens and closes at
 * `/product-catalog/[productCode]` (D-urls): Back closes the drawer and the grid is where it was, its
 * filters and its scroll with it. The filters are in the address (`?category=…&channel=…`), replaced as
 * they change rather than pushed, so Back leaves the catalog rather than undoing a filter.
 *
 * **The tabs and the toggle say which is on** (`aria-pressed`, P14-T7 AC-11): the prototype marks it with
 * a class alone. Every card is a button that opens the drawer, as drawn; its address is the drawer's.
 *
 * The states the prototype lacks are Fills (P14-T7 AC-10): a skeleton while the shelf loads, an error with
 * a retry, and the empty shelf — an office whose company has no catalog, or which keeps nothing on.
 *
 * **A search by product name** above the filters, at every size (P18.95-T6 AC-4; the client's review, UI-023:
 * 31 products and no search). It filters the shelf already loaded — the one read answers it whole — together
 * with the category and the channel, and is held by the grid rather than the address: it stays while a drawer
 * opens and closes over it, as the grid's scroll does. **On a phone the category pills are one row that scrolls
 * sideways** (UI-015: three lines), fading on the side that has more, the chosen one in view (`use-tab-row.ts`).
 *
 * **Its words are the catalogue's** (P18.98-T4; ADR-0179 §4), `messages/product-catalog.ts`, in the reader's language:
 * the categories, the channels and the states are Indonesian in ID mode (the categories since UI V1, UI-107), and a
 * product's name is the company's or the office's, shown as typed (ADR-0179 §5) — its line the platform's Indonesian
 * where the company still holds the platform's words (the server's, UI-107).
 *
 * **UI V1 on a phone** (UI-107; `attack-plan-mobile` 4; Mobile only): the search a white pill, the categories one
 * swipeable row of white pills, the channel a small segmented *Semua | Konvensional | Syariah*, and each section **a list
 * of compact rows** — the name with a *Syariah* tag, two lines of its description, › — five, then *Tampilkan n lagi*,
 * in place of the tall cards (`PhoneShelf`). From 768px the grid of cards is as before.
 */
export function ProductCatalog({ children }: { children?: ReactNode }) {
  const t = useMessages(productCatalogMessages);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = useMemo(() => filtersFrom(params), [params]);

  const [products, setProducts] = useState<CatalogCard[] | null>(null);
  const [term, setTerm] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** Whether this grid pushed the drawer's address — so closing it can go back rather than forward. */
  const openedHere = useRef(false);

  useEffect(() => {
    let live = true;
    setError(null);
    readCatalog()
      .then((list) => { if (live) setProducts(list.products); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [attempt]);

  const setFilters = (next: Partial<CatalogFilters>) => {
    router.replace(catalogHref({ ...filters, ...next }), { scroll: false });
  };

  const open = (code: string) => {
    openedHere.current = true;
    router.push(drawerHref(code, filters), { scroll: false });
  };

  const close = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false;
      router.back();
    } else {
      router.replace(catalogHref(filters), { scroll: false });
    }
  }, [router, filters]);

  const host = useMemo(() => ({ close }), [close]);
  const drawerOpen = pathname !== '/product-catalog';

  return (
    <DrawerHost.Provider value={host}>
      {/* Behind the open drawer the grid takes no focus and no click: the dialog is modal (P14-T7 AC-11). */}
      <div className="min-w-0" inert={drawerOpen || undefined}>
        <div className="relative mb-3.5 max-md:mb-2.5">
          <PlanIcon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-signal-grey md:hidden" />
          <TextInput
            type="search"
            aria-label={t.searchName}
            placeholder={t.searchPlaceholder}
            className="w-full max-w-sm max-md:h-11 max-md:max-w-none max-md:rounded-pill max-md:border-transparent max-md:pl-10"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <FilterBar filters={filters} onChange={setFilters} />
        {error && (
          <div>
            <ErrorBanner {...error} />
            <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
          </div>
        )}
        {!products && !error && <CatalogSkeleton />}
        {products && products.length === 0 && <EmptyShelf />}
        {products && products.length > 0 && <Shelf products={products} filters={filters} term={term} onOpen={open} />}
      </div>
      {children}
    </DrawerHost.Provider>
  );
}

function FilterBar({ filters, onChange }: { filters: CatalogFilters; onChange: (next: Partial<CatalogFilters>) => void }) {
  const t = useMessages(productCatalogMessages);
  const language = useLanguage();
  // On a phone (UI-107): white pills, the chosen one navy, borderless; 44px to the touch through a 4px reach above and below.
  const tab = (on: boolean) => cn(
    'rounded-md border px-3.5 py-2 text-base font-semibold',
    on ? 'border-navy bg-navy text-white' : 'border-hairline bg-card text-muted hover:text-navy max-md:border-transparent max-md:text-navy',
    'max-md:flex max-md:h-9 max-md:items-center max-md:rounded-pill max-md:py-0',
  );
  const toggle = (on: boolean) => cn(
    'rounded-[6px] px-[13px] py-[7px] text-base font-semibold',
    on ? 'bg-navy text-white' : 'text-muted hover:text-navy',
    'max-md:flex max-md:min-h-[2.375rem] max-md:items-center max-md:rounded-pill max-md:px-3 max-md:py-0 max-md:text-sm',
  );
  const channels: ['all' | ProductChannel, string][] = [
    ['all', t.all], ['conventional', t.channel.conventional], ['syariah', t.channel.syariah],
  ];
  // On a phone the pills are one row that scrolls inside its own box (P18.95-T6 AC-4), the chosen one in view.
  const row = useTabRow<HTMLDivElement>(filters.category);
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 max-md:mb-1 max-md:gap-2">
      <div
        ref={row.ref}
        role="group"
        aria-label={t.categories}
        data-fade={row.fade}
        className={cn('flex flex-wrap gap-1.5', TAB_ROW_PHONE, 'max-md:w-full max-md:min-w-0')}
      >
        {[{ value: 'all', label: t.allProducts }, ...categoryTabs(language)].map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={filters.category === c.value}
            className={cn(tab(filters.category === c.value), TAB_PHONE)}
            onClick={() => onChange({ category: c.value })}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div role="group" aria-label={t.channels} className="inline-flex rounded-[9px] border border-hairline bg-card p-[3px] max-md:rounded-pill max-md:border-transparent">
        {channels.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filters.channel === value}
            className={toggle(filters.channel === value)}
            onClick={() => onChange({ channel: value })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A section per category, in the tabs' order, each hidden when the filter leaves it empty (`:10161-10186`) — the
 * search's too (P18.95-T6 AC-4), so a section's count is what it shows. Nothing left: the prototype's line for a
 * filter, or, while a search is typed, one that names what was searched for.
 */
function Shelf({ products, filters, term, onOpen }: {
  products: readonly CatalogCard[];
  filters: CatalogFilters;
  term: string;
  onOpen: (code: string) => void;
}) {
  const t = useMessages(productCatalogMessages);
  const language = useLanguage();
  const phone = usePhone();
  const sections = categoryTabs(language)
    .filter((c) => filters.category === 'all' || c.value === filters.category)
    .map((c) => ({
      ...c,
      items: products.filter((p) => p.category.code === c.value
        && (filters.channel === 'all' || p.channel === filters.channel)
        && matchesSearch(p.name, term)),
    }))
    .filter((s) => s.items.length > 0);

  if (sections.length === 0) {
    return (
      // A status, so a search that empties the shelf is heard as it happens (WCAG 4.1.3), not only seen.
      <p role="status" className="text-md text-muted" data-state="no-match">
        {term.trim() ? t.noSearchMatch({ term: term.trim() }) : t.noFilterMatch}
      </p>
    );
  }

  if (phone) return <PhoneShelf sections={sections} onOpen={onOpen} />;

  return (
    <>
      {sections.map((section) => (
        <section key={section.value} className="mb-[30px]" aria-labelledby={`cat-${section.value}`}>
          <div className="mb-3.5 flex items-baseline gap-2.5 border-b border-hairline pb-2">
            <h2 id={`cat-${section.value}`} className="m-0 text-xl font-bold text-navy">{section.label}</h2>
            <span className="text-base text-muted">{productCount(section.items.length, language)}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3.5">
            {section.items.map((p) => (
              <button
                key={p.code}
                type="button"
                data-product-card={p.code}
                onClick={() => onOpen(p.code)}
                className={cn(
                  'flex flex-col gap-2 rounded-lg border border-card-edge bg-card px-[18px] py-4 text-left',
                  'transition-[border-color,box-shadow] hover:border-navy hover:shadow-modal',
                  // Faded as drawn (`.prod-card.legacy`): the tag says it, the fade only repeats it.
                  p.lifecycle === 'closed_to_new_business' && 'opacity-60',
                )}
              >
                <ProductTags channel={p.channel} runOff={p.lifecycle === 'closed_to_new_business'} />
                <span className="m-0 text-lg font-bold text-navy">{p.name}</span>
                <span className="m-0 text-base leading-snug text-muted">{p.tagline}</span>
                <span className="mt-auto pt-1 text-base font-semibold text-amber-ink">{t.viewDetail}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/** How many products a section shows on a phone before *Tampilkan n lagi* (UI-107; `attack-plan-mobile` 4). */
export const PHONE_SECTION_SHOWN = 5;

/**
 * **The shelf on a phone** (UI V1, UI-107; `attack-plan-mobile` 4; Mobile only): each category its heading with its
 * count, then one white card of compact rows — the product's name, a *Syariah* tag where it is one, two lines of its
 * description, and › — the whole row the target that opens the drawer, as a card does wider. Five rows, then
 * *Tampilkan n lagi*, which unfolds the rest in place. A product in run-off is faded, its tag saying so.
 */
function PhoneShelf({ sections, onOpen }: {
  sections: readonly { value: string; label: string; items: readonly CatalogCard[] }[];
  onOpen: (code: string) => void;
}) {
  return (
    <>
      {sections.map((section) => <PhoneSection key={section.value} section={section} onOpen={onOpen} />)}
    </>
  );
}

function PhoneSection({ section, onOpen }: {
  section: { value: string; label: string; items: readonly CatalogCard[] };
  onOpen: (code: string) => void;
}) {
  const t = useMessages(productCatalogMessages);
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const more = section.items.length - PHONE_SECTION_SHOWN;
  const rows = open || more <= 0 ? section.items : section.items.slice(0, PHONE_SECTION_SHOWN);
  return (
    <section className="mb-1" aria-labelledby={`cat-${section.value}`} data-phone-section={section.value}>
      <div className="mx-0.5 mb-1.5 mt-3.5 flex items-baseline gap-1.5">
        <h2 id={`cat-${section.value}`} className="m-0 text-lg font-bold text-navy">{section.label}</h2>
        <span className="text-sm font-semibold text-muted">{productCount(section.items.length, language)}</span>
      </div>
      <div className="overflow-hidden rounded-lg bg-card">
        <ul id={listId} className="m-0 list-none p-0">
          {rows.map((p) => {
            const runOff = p.lifecycle === 'closed_to_new_business';
            return (
              <li key={p.code} className="border-t border-divider first:border-t-0">
                <button
                  type="button"
                  data-product-card={p.code}
                  onClick={() => onOpen(p.code)}
                  className={cn('flex min-h-14 w-full items-center gap-2.5 px-3 py-1.5 text-left', runOff && 'opacity-60')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-md font-bold text-ink">
                      {p.name}
                      {p.channel === 'syariah' && (
                        <span className="rounded-pill bg-teal/[0.12] px-[7px] py-px text-sm font-bold text-teal-ink">{t.channel.syariah}</span>
                      )}
                      {runOff && <span className="rounded-pill bg-pill-grey px-[7px] py-px text-sm font-bold text-pill-grey-ink">{t.runOff}</span>}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted">{p.tagline}</span>
                  </span>
                  <PlanIcon name="chevronRight" className="h-[1.125rem] w-[1.125rem] text-line" />
                </button>
              </li>
            );
          })}
        </ul>
        {more > 0 && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((now) => !now)}
            className="flex min-h-11 w-full items-center justify-center gap-1 border-t border-divider text-base font-bold text-navy"
          >
            {open ? t.showFewer : t.showMore({ n: more })}
            <PlanIcon name={open ? 'chevronUp' : 'chevronDown'} className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * **The empty shelf** (a Fill; P14-T7 AC-10, P14-T8 AC-10): an office whose company has no catalog — a
 * company created blank (ADR-0115) — or which keeps nothing on. A state, not an error. The plan page draws
 * the same two lines in its brief's place.
 */
export function EmptyShelf() {
  const t = useMessages(productCatalogMessages);
  return (
    <div className="rounded-lg border border-card-edge bg-card px-6 py-[22px]" data-state="empty-shelf">
      <p className="m-0 text-md font-semibold text-navy">{t.emptyShelf}</p>
      <p className="m-0 mt-1 text-base text-muted">{t.emptyShelfHint}</p>
    </div>
  );
}

/** Two sections of cards, shaped like the shelf that is coming. */
export function CatalogSkeleton() {
  const t = useMessages(productCatalogMessages);
  return (
    <Skeleton label={t.loadingShelf}>
      {[0, 1].map((s) => (
        <div key={s} className="mb-[30px]">
          <SkeletonBar className="mb-3.5 h-5 w-32" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border border-card-edge bg-card px-[18px] py-4">
                <SkeletonBar className="w-20" />
                <SkeletonBar className="mt-3 h-4 w-2/3" />
                <SkeletonBar className="mt-2 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Skeleton>
  );
}
