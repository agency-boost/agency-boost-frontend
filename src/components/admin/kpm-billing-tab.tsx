'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Estimate, TierCards } from '@/app/(admin)/admin/billing/editor';
import { QuoteDialog } from '@/app/(admin)/admin/billing/quote-dialog';
import { QuoteSheet, type GeneratedQuote } from '@/app/(admin)/admin/billing/quote-sheet';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { billingMessages } from '@/i18n/messages/billing';
import type { TenantRow } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  defaultDates, maskAmount, officeToday, planPeriodOf, priceQuote, quoteRequestOf, readBillingPrices, sendKpmQuote,
  type BillingPrices, type CalculatorInput, type QuoteDetails,
} from '@/lib/billing';
import { printAs, restorePrintTitle } from '@/lib/print';

/**
 * **A KPM's *Billing* tab** (P19.4-T3 AC-10; ADR-0211 §4; SA UI-015, SA R6): the quote tool of ADR-0111 — its tier cards,
 * *Estimate your price*, the *Send quote* dialog, the quote and its print — **moved from `/admin/billing` to the KPM**,
 * and filled with that KPM's *Leaders used* (ADR-0113) and its plan (*Tahunan* opens on *Annual*).
 *
 * - **The dialog names the KPM and its Owner**: *Name of KPM* is the KPM's own, read-only — the name the Owner receives
 *   is the server's — and *Name of PIC* starts as the Owner's name.
 * - ***Send to {Owner}*** on the generated quote sends it (`POST /admin/tenants/:kpmId/quote`): the server prices it
 *   from the same inputs, through the one function this page's calculator is pinned to by a shared fixture, and mails
 *   it to the Owner's verified address and tells them in the app. A KPM with no Owner draws no such button, and a
 *   refusal — `409 BILLING_QUOTE_NO_OWNER`, *print it instead* — is shown above the quote. *Print / save as PDF* stays.
 * - **Nothing is stored here** but what the server records (ADR-0211 §5): the quote lives in this tab's state.
 */
export function KpmBillingTab({ kpm }: { kpm: TenantRow }) {
  const OWN = useMessages(billingMessages).own;
  const [prices, setPrices] = useState<BillingPrices | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(() => {
    setError(null);
    readBillingPrices()
      .then(setPrices)
      .catch((err) => setError(toDisplayError(err)));
  }, []);
  useEffect(load, [load]);

  if (prices) return <QuoteTool prices={prices} kpm={kpm} />;
  if (error) {
    return (
      <div>
        <ErrorBanner code={error.code} message={OWN.failed} requestId={error.requestId} />
        <Button variant="secondary" className="mt-3" onClick={load}>{OWN.retry}</Button>
      </div>
    );
  }
  return (
    <Skeleton label={OWN.loading}>
      <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-card-edge bg-card p-4">
            <SkeletonBar className="w-2/3" />
            <SkeletonBar className="w-1/2" />
            <SkeletonBar className="h-5 w-4/5" />
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-lg border border-card-edge bg-card p-5 md:p-7">
        <SkeletonBar className="h-4 w-1/3" />
        <SkeletonBar className="h-10 w-full max-w-[220px]" />
        {Array.from({ length: 5 }, (_, i) => <SkeletonBar key={i} className="w-full" />)}
      </div>
    </Skeleton>
  );
}

/** The title and the launch line **on the paper**, as the prototype prints them. */
function PaperHeading() {
  const COPY = useMessages(billingMessages).prototype;
  return (
    <div className="mb-[18px]">
      <h1 className="font-display text-3xl font-bold text-navy">{COPY.title}</h1>
      <p className="mt-1.5 text-sm font-semibold text-primary-ink">{COPY.launch}</p>
    </div>
  );
}

function QuoteTool({ prices, kpm }: { prices: BillingPrices; kpm: TenantRow }) {
  const { prototype: COPY, own: OWN, perKpm: T } = useMessages(billingMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const plan = kpm.subscription?.plan ?? null;
  // The KPM's own count and plan (ADR-0211 §4): under one leader the calculator prices one, as it reads any count.
  const [input, setInput] = useState<CalculatorInput>(() => ({
    leaders: String(Math.max(kpm.leadersUsed, 1)),
    period: plan ? planPeriodOf(plan) : 'sixMonth',
    discountType: 'percent',
    discount: '0',
  }));
  const pricing = useMemo(() => priceQuote(prices, input, figures, language), [prices, input, figures, language]);

  useEffect(() => {
    setInput((i) => (i.discountType === 'flat' ? { ...i, discount: maskAmount(i.discount, figures) } : i));
  }, [figures]);

  const kpmName = `KPM ${kpm.code} · ${kpm.branchName}`;
  const [discountOpen, setDiscountOpen] = useState(false);
  const [focusDiscount, setFocusDiscount] = useState(0);
  const [names, setNames] = useState({ kpm: kpmName, pic: kpm.ownerName ?? '', sales: '' });
  const [dialog, setDialog] = useState<Pick<QuoteDetails, 'start' | 'end'> | null>(null);
  const [quote, setQuote] = useState<GeneratedQuote | null>(null);
  /** The input the shown quote was generated from: what is sent, never the calculator as it is now. */
  const [quoteInput, setQuoteInput] = useState<CalculatorInput | null>(null);
  const [printing, setPrinting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [sendError, setSendError] = useState<ApiError | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const quoteHeading = useRef<HTMLHeadingElement>(null);

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
    setQuote({ pricing, details: { ...details, kpm: kpmName }, generatedOn: officeToday() });
    setQuoteInput(input);
    setSent(null);
    setSendError(null);
    setDialog(null);
  };

  const shown = useRef(false);
  useEffect(() => {
    if (quote) quoteHeading.current?.focus();
    else if (shown.current) opener.current?.focus();
    shown.current = quote !== null;
  }, [quote]);

  useEffect(() => {
    if (printing && quote) printAs(OWN.printTitle({ kpm: quote.details.kpm.trim() }), () => setPrinting(false));
  }, [printing, quote, OWN]);
  useEffect(() => restorePrintTitle, []);

  async function send() {
    if (!quote || !quoteInput) return;
    setSending(true);
    setSendError(null);
    setSent(null);
    try {
      const answer = await sendKpmQuote(kpm._id, quoteRequestOf(quoteInput, quote.pricing, quote.details));
      setSent(T.sent({ name: answer.recipient.fullName }));
    } catch (err) {
      setSendError(toDisplayError(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
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
        <>
          {sendError && <div className="mb-4"><ErrorBanner {...sendError} /></div>}
          <p role="status" className={sent ? 'mb-4 text-md font-semibold text-success' : 'sr-only'}>{sent ?? ''}</p>
          <QuoteSheet
            quote={quote}
            headingRef={quoteHeading}
            actions={(
              <>
                {kpm.ownerUserId && kpm.ownerName && (
                  <Button onClick={() => void send()} disabled={sending || sent !== null}>
                    {sending ? T.sending : T.sendToOwner({ name: kpm.ownerName })}
                  </Button>
                )}
                <Button variant={kpm.ownerUserId ? 'secondary' : 'primary'} onClick={() => setPrinting(true)}>{COPY.print}</Button>
                <Button variant="secondary" onClick={() => setQuote(null)}>{COPY.back}</Button>
              </>
            )}
          />
        </>
      )}

      {dialog && (
        <QuoteDialog
          period={input.period}
          names={names}
          dates={dialog}
          kpmReadOnly
          onNames={(next) => setNames({ ...next, kpm: kpmName })}
          onCancel={() => setDialog(null)}
          onGenerate={generate}
        />
      )}

      {printing && quote && createPortal(
        <div data-print-view="" className="hidden bg-card font-body text-navy print:block">
          <PaperHeading />
          <QuoteSheet quote={quote} />
        </div>,
        document.body,
      )}
    </>
  );
}
