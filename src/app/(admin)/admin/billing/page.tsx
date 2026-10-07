'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Page } from '@/components/page';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  BILLING_COPY as COPY, BILLING_OWN_COPY as OWN, defaultDates, officeToday, priceQuote, readBillingPrices, toDmy,
  type BillingPrices, type CalculatorInput, type QuoteDetails,
} from '@/lib/billing';
import { printAs, restorePrintTitle } from '@/lib/print';
import { Estimate, TierCards } from './editor';
import { QuoteDialog } from './quote-dialog';
import { QuoteSheet, type GeneratedQuote } from './quote-sheet';

/**
 * **Billing & subscription** — the quote tool (ADR-0111; `functional/billing.md`), from
 * `AgencyBoost_Billing_Subscription.html`, verbatim.
 *
 * **It stores nothing.** Its one request is `GET /admin/billing/prices`; the calculator, the dialog and
 * the quote live in this page's state, and the PDF is the browser's print. Leaving the page loses the
 * quote, as it does in the prototype; the PDF the Super Admin saves is the only copy (ADR-0111 §2).
 *
 * The Super Admin's alone (`billing:read_prices`): the route's own gate, inside the console's.
 */
export default function BillingPage() {
  return (
    <Page permission="billing:read_prices">
      <Billing />
    </Page>
  );
}

/** The page's title and launch line (`:229-232`), on the screen and on the paper, as the prototype prints them. */
function Heading() {
  return (
    <div className="mb-[18px]">
      <h1 className="font-display text-3xl font-bold text-navy">{COPY.title}</h1>
      {/* Copy only: no date in code reads the cut-off (ADR-0111 §6). Amber-ink, where the prototype's 12.5px amber-dark is about 3:1. */}
      <p className="mt-1.5 text-sm font-semibold text-amber-ink">{COPY.launch}</p>
    </div>
  );
}

const INITIAL: CalculatorInput = { leaders: '8', period: 'sixMonth', discountType: 'percent', discount: '0' };
const NO_NAMES = { kpm: '', pic: '', sales: '' };

function Billing() {
  const [prices, setPrices] = useState<BillingPrices | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(() => {
    setError(null);
    readBillingPrices()
      .then(setPrices)
      .catch((err) => setError(toDisplayError(err)));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="max-w-[68.75rem]">
      <Heading />
      {prices ? (
        <QuoteTool prices={prices} />
      ) : error ? (
        // Nothing is priced from nothing: no card, no calculator, until the table has been read (a Fill).
        <div>
          <ErrorBanner code={error.code} message={OWN.failed} requestId={error.requestId} />
          <Button variant="secondary" className="mt-3" onClick={load}>{OWN.retry}</Button>
        </div>
      ) : (
        <Skeleton label={OWN.loading}>
          <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-hairline bg-card p-4">
                <SkeletonBar className="w-2/3" />
                <SkeletonBar className="w-1/2" />
                <SkeletonBar className="h-5 w-4/5" />
              </div>
            ))}
          </div>
          <div className="space-y-3 rounded-lg border border-hairline bg-card p-5 md:p-7">
            <SkeletonBar className="h-4 w-1/3" />
            <SkeletonBar className="h-10 w-full max-w-[220px]" />
            {Array.from({ length: 5 }, (_, i) => <SkeletonBar key={i} className="w-full" />)}
          </div>
        </Skeleton>
      )}
    </div>
  );
}

function QuoteTool({ prices }: { prices: BillingPrices }) {
  const [input, setInput] = useState<CalculatorInput>(INITIAL);
  const pricing = useMemo(() => priceQuote(prices, input), [prices, input]);

  const [discountOpen, setDiscountOpen] = useState(false);
  const [focusDiscount, setFocusDiscount] = useState(0);
  const [names, setNames] = useState(NO_NAMES);
  const [dialog, setDialog] = useState<Pick<QuoteDetails, 'start' | 'end'> | null>(null);
  const [quote, setQuote] = useState<GeneratedQuote | null>(null);
  const [printing, setPrinting] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const quoteHeading = useRef<HTMLHeadingElement>(null);

  /**
   * *Confirm plan*, *Send custom quote*, *Send quote* and *Talk to us*. **A discount out of bounds
   * generates nothing** (ADR-0111 §5): the dialog stays shut, *Manual override* opens, and the focus
   * goes to the field whose sentence says why.
   */
  const openDialog = () => {
    if (pricing.discountError) {
      setDiscountOpen(true);
      setFocusDiscount((n) => n + 1);
      return;
    }
    opener.current = document.activeElement as HTMLElement | null;
    setDialog(defaultDates(input.period));
  };

  const generate = (details: QuoteDetails) => {
    setQuote({ pricing, details, generatedOn: toDmy(officeToday()) });
    setDialog(null);
  };

  // The quote replaces the editor, and the focus goes to its title; *Back to editor* gives it back to
  // the button that opened the dialog, once the editor is shown again.
  const shown = useRef(false);
  useEffect(() => {
    if (quote) quoteHeading.current?.focus();
    else if (shown.current) opener.current?.focus();
    shown.current = quote !== null;
  }, [quote]);
  const back = () => setQuote(null);

  // Printed once the print view is on the page, and taken off it once the window closes.
  useEffect(() => {
    if (printing && quote) printAs(OWN.printTitle(quote.details.kpm.trim()), () => setPrinting(false));
  }, [printing, quote]);
  // Leaving the page puts the title back, for a browser whose `afterprint` never came.
  useEffect(() => restorePrintTitle, []);

  return (
    <>
      {/* The editor stays mounted while the quote shows, as the prototype hides it (`:691`), so
          *Back to editor* finds the calculator as it was. */}
      <div hidden={quote !== null}>
        <TierCards tiers={prices.tiers} current={pricing.tier} onTalkToUs={openDialog} />
        <Estimate
          input={input}
          pricing={pricing}
          onInput={setInput}
          onOpenDialog={openDialog}
          discountOpen={discountOpen}
          onDiscountOpen={setDiscountOpen}
          focusDiscount={focusDiscount}
        />
      </div>

      {quote && (
        <QuoteSheet
          quote={quote}
          headingRef={quoteHeading}
          actions={(
            <>
              <Button onClick={() => setPrinting(true)}>{COPY.print}</Button>
              <Button variant="secondary" onClick={back}>{COPY.back}</Button>
            </>
          )}
        />
      )}

      {dialog && (
        <QuoteDialog
          period={input.period}
          names={names}
          dates={dialog}
          onNames={setNames}
          onCancel={() => setDialog(null)}
          onGenerate={generate}
        />
      )}

      {/*
        * **The paper** (ADR-0111 §7): the page's title and launch line above the quote, as the prototype
        * prints them (`:186-189`), and nothing else — no rail, top bar, bell, support banner or buttons.
        * Off the screen, and while it is mounted the only thing printed (`globals.css`, `[data-print-view]`).
        */}
      {printing && quote && createPortal(
        <div data-print-view="" className="hidden bg-card font-body text-navy print:block">
          <Heading />
          <QuoteSheet quote={quote} />
        </div>,
        document.body,
      )}
    </>
  );
}
