'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ProductTags, useCatalogDrawerHost } from '@/components/product-catalog';
import { ProductScript } from '@/components/product-script';
import { Button, ButtonLink, ErrorBanner } from '@/components/ui/field';
import { TAP_AREA, TEXT_TAP } from '@/components/ui/phone';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { TermText } from '@/components/ui/term-tip';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useScrollLock } from '@/lib/use-scroll-lock';
import { CONTENT_TERM_KEYS, firstMentions, type TermKey } from '@/lib/terms';
import {
  formatRate, OWN_COPY, openDocumentLink, productPlanHref, PROTOTYPE_COPY, readCatalogProduct,
  type CatalogDocument, type CatalogProduct,
} from '@/lib/product-catalog';

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

type DrawerTab = 'details' | 'plan' | 'documents';
const TABS: readonly { id: DrawerTab; label: string }[] = [
  { id: 'details', label: PROTOTYPE_COPY.tabDetails },
  { id: 'plan', label: PROTOTYPE_COPY.tabPlan },
  { id: 'documents', label: PROTOTYPE_COPY.tabDocuments },
];

/**
 * **The catalog's drawer** (`/product-catalog/[productCode]`; `Overall.html:4737-4743`, logic
 * `:10192-10394`; P14-T7 AC-4 to AC-7): one product over the grid, with its *Details*, *Attack Plan* and
 * *Documents*.
 *
 * **A dialog, where the prototype's is an `aside`** (contradiction 12, an Improve for accessibility): named
 * by the product, the focus moved into it as it opens and held there, and returned to the product's card
 * when it closes. ✕, the scrim and Escape close it (`:10388-10394`), and so does Back — it has its own
 * address over the grid (D-urls), so a link opens it and a typed address does too. It is the full width
 * of a phone.
 *
 * **Everything it prints is the server's**: the office's display name, its approved words or the
 * company's, the company's commission schedule — not drawn at all for a reader the read leaves it out
 * for, and one line while the company has stated none (OD-135) — and which documents can be opened. A
 * document's link is signed when it is asked for, valid 300 seconds, and opened in a new tab.
 *
 * The drawer's own states are Fills (P14-T7 AC-10): a skeleton while the product loads, an error with a
 * retry, and the not-found state for a product the office does not keep on, or that does not exist.
 */
export function ProductDrawer({ code }: { code: string }) {
  const { close } = useCatalogDrawerHost();
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<DrawerTab>('details');
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // The catalog behind holds still while the drawer is open (P18.96-T1 AC-2); a dialog over it nests the lock.
  useScrollLock(true);

  useEffect(() => {
    let live = true;
    setProduct(null);
    setMissing(false);
    setError(null);
    setTab('details');
    readCatalogProduct(code)
      .then((next) => { if (live) setProduct(next); })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [code, attempt]);

  // Into the dialog as it opens, and back to the product's card as it closes — or wherever the focus was.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.focus();
    return () => {
      const card = document.querySelector<HTMLElement>(`[data-product-card="${code.replace(/["\\]/g, '\\$&')}"]`);
      (card ?? before)?.focus?.();
    };
  }, [code]);

  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab' || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };

  /*
   * **Which of the company's words first names each term** (P18.95-T9 AC-3; UI-028: *CI premium waiver*, *as-billed*):
   * the tagline, then *Details*' benefits, what stands out and the best fit, in reading order. The card on the
   * catalog is one button, so the ⓘ is here, on the product's own page.
   */
  const terms = product
    ? firstMentions([product.tagline, ...product.benefits, product.differentiator, product.bestFit], CONTENT_TERM_KEYS)
    : [];

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-navy/35" onClick={close} data-scrim />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={product ? titleId : undefined}
        aria-label={product ? undefined : PROTOTYPE_COPY.catalogTitle}
        tabIndex={-1}
        onKeyDown={keys}
        className="fixed right-0 top-0 z-50 h-[100dvh] w-full overflow-y-auto overscroll-contain bg-card shadow-modal sm:w-[460px] sm:max-w-[92vw]"
      >
        <div className="px-5 pb-10 pt-[26px] sm:px-7">
          <div className="mb-1.5 flex justify-end">
            <button
              type="button"
              aria-label={OWN_COPY.closeDrawer}
              onClick={close}
              className={cn('flex h-[30px] w-[30px] items-center justify-center rounded-full border border-hairline bg-base text-md text-navy', 'max-md:relative', TAP_AREA)}
            >
              <span aria-hidden="true">{PROTOTYPE_COPY.close}</span>
            </button>
          </div>

          {!product && !missing && !error && (
            <Skeleton label={OWN_COPY.loadingProduct}>
              <SkeletonBar className="w-24" />
              <SkeletonBar className="mt-3 h-6 w-2/3" />
              <SkeletonText lines={3} className="mt-4" />
            </Skeleton>
          )}
          {error && (
            <div>
              <ErrorBanner {...error} />
              <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{OWN_COPY.tryAgain}</Button>
            </div>
          )}
          {missing && (
            <div data-state="not-found">
              <p className="m-0 text-md font-semibold text-navy">{OWN_COPY.notFound}</p>
              <p className="m-0 mt-1 text-base text-muted">{OWN_COPY.notFoundHint}</p>
              <button type="button" onClick={close} className={cn('mt-3 rounded-sm text-base font-semibold text-amber-ink hover:underline', TEXT_TAP)}>
                {OWN_COPY.backToCatalog}
              </button>
            </div>
          )}

          {product && (
            <>
              <ProductTags channel={product.channel} runOff={product.lifecycle === 'closed_to_new_business'} />
              <h2 id={titleId} className="mb-1.5 mt-3 break-words text-2xl font-bold text-navy">{product.name}</h2>
              {/* An ⓘ after a term the company's copy uses (*CI premium waiver*, *as-billed*), the first time (AC-3). */}
              <p className="mb-[22px] text-md text-muted"><TermText text={product.tagline} terms={terms[0]} /></p>
              <DrawerTabs active={tab} onSelect={setTab}>
                {(active) => (
                  <>
                    {active === 'details' && <DetailsTab product={product} terms={terms.slice(1)} />}
                    {active === 'plan' && <PlanTab product={product} />}
                    {active === 'documents' && <DocumentsTab product={product} />}
                  </>
                )}
              </DrawerTabs>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * *Details*, *Attack Plan* and *Documents* (`:10210-10214`), a tab list: ← and → between them, Home and
 * End to the ends, one tab stop, and one panel named by its tab.
 */
function DrawerTabs({ active, onSelect, children }: {
  active: DrawerTab;
  onSelect: (tab: DrawerTab) => void;
  children: (active: DrawerTab) => ReactNode;
}) {
  const group = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const go = (to: number) => {
    const next = TABS[(to + TABS.length) % TABS.length];
    onSelect(next.id);
    refs.current[next.id]?.focus();
  };
  return (
    <>
      <div role="tablist" aria-label={OWN_COPY.productTabs} className="mb-[18px] flex gap-1.5 border-b border-hairline">
        {TABS.map((t, i) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[t.id] = el; }}
              type="button"
              role="tab"
              id={`${group}-${t.id}`}
              aria-selected={on}
              aria-controls={on ? `${group}-panel` : undefined}
              tabIndex={on ? 0 : -1}
              onClick={() => onSelect(t.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') go(i + 1);
                else if (e.key === 'ArrowLeft') go(i - 1);
                else if (e.key === 'Home') go(0);
                else if (e.key === 'End') go(TABS.length - 1);
                else return;
                e.preventDefault();
              }}
              className={cn(
                '-mb-px mr-[18px] border-b-2 px-0.5 pb-2.5 text-md font-semibold',
                on ? 'border-amber text-navy' : 'border-transparent text-muted hover:text-navy',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${group}-panel`} aria-labelledby={`${group}-${active}`}>{children(active)}</div>
    </>
  );
}

/** A block of the *Details* tab: its label in small caps, and what it says (`.d-block`). */
function DetailBlock({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="border-b border-hairline py-[18px] last-of-type:border-b-0">
      <h3 id={id} className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted">{label}</h3>
      {children}
    </section>
  );
}

/** *Details* (`:10238-10280`). */
function DetailsTab({ product, terms }: { product: CatalogProduct; terms: TermKey[][] }) {
  // `terms` in the order `firstMentions` read them: each benefit, then what stands out, then the best fit.
  const benefitTerms = (i: number) => terms[i] ?? [];
  const [standsOut, bestFit] = [terms[product.benefits.length] ?? [], terms[product.benefits.length + 1] ?? []];
  const runOff = product.lifecycle === 'closed_to_new_business';
  return (
    <div>
      {runOff && product.runOffNote && <RunOffNote>{product.runOffNote}</RunOffNote>}
      {product.commissionSchedule !== undefined && (
        <DetailBlock label={PROTOTYPE_COPY.commissionRate}>
          {product.commissionSchedule.length === 0 ? (
            <p className="m-0 text-base text-muted">{OWN_COPY.commissionNotSet}</p>
          ) : (
            <table className="relative w-full max-w-[260px] border-collapse">
              <caption className="sr-only">{PROTOTYPE_COPY.commissionRate}</caption>
              <thead>
                <tr>
                  <th scope="col" className="pb-1.5 text-left text-2xs font-bold uppercase tracking-wide text-muted">{PROTOTYPE_COPY.year}</th>
                  <th scope="col" className="pb-1.5 text-left text-2xs font-bold uppercase tracking-wide text-muted">{PROTOTYPE_COPY.rate}</th>
                </tr>
              </thead>
              <tbody>
                {product.commissionSchedule.map((row) => (
                  <tr key={row.year}>
                    <th scope="row" className="w-[60px] border-t border-hairline py-[7px] text-left text-base font-medium text-muted">Y{row.year}</th>
                    <td className="border-t border-hairline py-[7px] text-base font-semibold text-navy">{formatRate(row.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DetailBlock>
      )}
      <DetailBlock label={PROTOTYPE_COPY.benefits}>
        <ul className="m-0 flex list-none flex-col gap-[9px] p-0">
          {product.benefits.map((b, i) => (
            <li key={`${i}-${b}`} className="flex items-start gap-[9px] text-base text-navy">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
              <span className="min-w-0"><TermText text={b} terms={benefitTerms(i)} /></span>
            </li>
          ))}
        </ul>
      </DetailBlock>
      <DetailBlock label={PROTOTYPE_COPY.standsOut}>
        <p className="m-0 text-base leading-normal text-navy"><TermText text={product.differentiator} terms={standsOut} /></p>
      </DetailBlock>
      <DetailBlock label={PROTOTYPE_COPY.bestFit}>
        <p className="m-0 text-base leading-normal text-navy"><TermText text={product.bestFit} terms={bestFit} /></p>
      </DetailBlock>
      <div className="mt-[22px]">
        {runOff ? (
          <Button className="w-full" disabled>{PROTOTYPE_COPY.noActiveScript}</Button>
        ) : (
          <ButtonLink href={productPlanHref(product.code)} className="w-full">{PROTOTYPE_COPY.openFullPlan}</ButtonLink>
        )}
      </div>
    </div>
  );
}

function RunOffNote({ children }: { children: ReactNode }) {
  return (
    <p className="mb-5 rounded-[10px] border border-alert/25 bg-alert/[0.06] px-3.5 py-3 text-base text-alert">{children}</p>
  );
}

/** *Attack Plan* (`:10282-10357`): the words, or the run-off note; and the plan page's deep link. */
function PlanTab({ product }: { product: CatalogProduct }) {
  if (product.lifecycle === 'closed_to_new_business') {
    return <p className="text-base italic text-muted">{PROTOTYPE_COPY.drawerRunOff}</p>;
  }
  return (
    <div>
      <ProductScript script={product.script} place="drawer" />
      <Link
        href={productPlanHref(product.code)}
        className={cn('mt-4 inline-block rounded-sm text-sm font-semibold text-amber-ink hover:underline', TEXT_TAP)}
      >
        {PROTOTYPE_COPY.openInPlan}
      </Link>
    </div>
  );
}

/** *Documents* (`:10371-10386`): the three slots, in order — *Open link →*, or not uploaded yet. */
function DocumentsTab({ product }: { product: CatalogProduct }) {
  return (
    <div>
      {product.documents.map((doc) => <DocumentRow key={doc.slot} code={product.code} doc={doc} />)}
    </div>
  );
}

/**
 * One slot. **The link is signed when it is asked for** and opened in a new tab (P14-T7 AC-7): a link
 * held on the page would outlive its 300 seconds. The tab is opened as the click lands, so a browser
 * that blocks windows opened later lets it through, and it is cut from this page before it navigates.
 */
function DocumentRow({ code, doc }: { code: string; doc: CatalogDocument }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const labelId = useId();

  const open = async () => {
    // Ignored while it signs, rather than disabled: a disabled button drops the focus out of the modal.
    if (busy) return;
    setBusy(true);
    setError(null);
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const { url } = await openDocumentLink(code, doc.slot);
      if (tab) tab.location.href = url;
      else window.open(url, '_blank', 'noopener');
    } catch (err) {
      tab?.close();
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-hairline py-3.5 last:border-b-0" data-slot={doc.slot}>
      <p className="mb-1.5 text-base font-semibold text-navy">{doc.label}</p>
      {/* The link's description: which document, and that it leaves this page. Its name stays the visible words. */}
      {doc.available && <span id={labelId} className="sr-only">{OWN_COPY.opensInNewTab(doc.label)}</span>}
      {doc.available ? (
        <button
          type="button"
          onClick={() => void open()}
          aria-disabled={busy || undefined}
          aria-describedby={labelId}
          className={cn('rounded-sm text-base font-semibold text-amber-ink hover:underline aria-disabled:opacity-60', TEXT_TAP)}
        >
          {busy ? OWN_COPY.openingDocument : PROTOTYPE_COPY.openLink}
        </button>
      ) : (
        <p className="m-0 text-sm italic text-muted">{PROTOTYPE_COPY.notUploaded}</p>
      )}
      {error && (
        <div className="mt-2">
          <p className="m-0 mb-1.5 text-base text-alert">{OWN_COPY.documentFailed}</p>
          <ErrorBanner {...error} />
        </div>
      )}
    </div>
  );
}
