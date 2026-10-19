'use client';

import type { ReactNode, Ref } from 'react';
import {
  BILLING_COPY as COPY, money, perLeaderDiscount, tierLabel, type Pricing, type QuoteDetails,
} from '@/lib/billing';
import { cn } from '@/lib/cn';

/** What *Generate quote* froze: the calculator's figures, the dialog's five values, and the day (`lastCalc`, `:535-546`). */
export interface GeneratedQuote {
  pricing: Pricing;
  details: QuoteDetails;
  /** The office's today when it was generated, `DD/MM/YYYY` (`:653`). */
  generatedOn: string;
}

/** The quote's mark (`.quote-brand`, `:312-321`): the product's three nodes, navy where the sidebar's are light. */
function QuoteMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M12 8L6 15M12 8L18 15" strokeWidth="1.6" className="stroke-navy/40" />
      <circle cx="12" cy="5" r="3" className="fill-navy" />
      <circle cx="6" cy="18" r="3" className="fill-navy" />
      <circle cx="18" cy="18" r="3" className="fill-amber" />
    </svg>
  );
}

const SECTION = 'mb-2.5 mt-6 text-base font-bold uppercase tracking-[0.03em] text-navy';

function QuoteRow({ label, children, grand = false }: { label: string; children: ReactNode; grand?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-hairline py-2">
      <dt className={grand ? 'text-lg font-bold text-navy' : 'text-md text-muted'}>{label}</dt>
      <dd className={cn('m-0', grand ? 'font-display text-2xl font-bold text-amber-ink' : 'text-md font-semibold text-navy')}>
        {children}
      </dd>
    </div>
  );
}

/**
 * *Subscription quote* (`#quote-page`, `:308-372`, filled by `generateQuote`, `:625-690`), drawn twice
 * from one component: on the page with its two buttons, and in the print view without them.
 *
 * *Discounts* is hidden when neither discount applies (`:680`); *Final price / leader / mo* shows
 * either way, as drawn. *Generated* is the office's day, not the browser's (a Fix).
 */
export function QuoteSheet({
  quote, actions, headingRef,
}: {
  quote: GeneratedQuote;
  /** *Print / save as PDF* and *Back to editor*: on the page, never on the paper. */
  actions?: ReactNode;
  /** The title takes the focus when the quote replaces the editor. */
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { pricing, details } = quote;
  const annual = pricing.period === 'annual';
  const hasAnnual = pricing.annualDiscountMinor > 0;
  const hasManual = pricing.manualDiscountMinor > 0;
  const meta: [string, string][] = [
    [COPY.kpm, details.kpm.trim()],
    [COPY.pic, details.pic.trim()],
    [COPY.planStart, details.start.trim()],
    [COPY.planEnd, details.end.trim()],
    [COPY.salesBy, details.sales.trim()],
  ];

  return (
    <article className="rounded-lg border border-hairline bg-card px-5 py-7 md:px-10 md:py-9">
      <header className="mb-[22px] flex flex-wrap items-center justify-between gap-3 border-b-2 border-navy pb-[18px]">
        <div className="flex items-center gap-2.5">
          <QuoteMark />
          <span className="font-display text-lg font-extrabold tracking-tight text-navy">AgencyBoost</span>
        </div>
        <div className="text-right">
          <h2 ref={headingRef} tabIndex={-1} className="text-sm font-bold uppercase tracking-[0.05em] text-muted">
            {COPY.quoteTitle}
          </h2>
          <p className="mt-0.5 text-base font-bold text-navy">{COPY.generated(quote.generatedOn)}</p>
        </div>
      </header>

      <dl className="mb-[26px] grid grid-cols-2 gap-x-6 gap-y-3.5">
        {meta.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs uppercase tracking-[0.03em] text-muted">{label}</dt>
            <dd className="m-0 mt-0.5 break-words text-md font-semibold text-navy">{value}</dd>
          </div>
        ))}
      </dl>

      <h3 className={SECTION}>{COPY.planDetails}</h3>
      <dl>
        <QuoteRow label={COPY.tier}>
          {tierLabel(pricing.tier)}{COPY.leadersSuffix}{pricing.tier.customPricing ? COPY.custom : ''}
        </QuoteRow>
        <QuoteRow label={COPY.leadersOnPlan}>{pricing.leaders}</QuoteRow>
        <QuoteRow label={COPY.billingPeriod}>{annual ? COPY.annualPlan : COPY.sixMonthPlan}</QuoteRow>
        <QuoteRow label={COPY.standardRow}>{money(pricing.standardMinor)}</QuoteRow>
        <QuoteRow label={COPY.offerRow}>{money(pricing.offerMinor)}</QuoteRow>
      </dl>

      {(hasAnnual || hasManual) && <h3 className={SECTION}>{COPY.discounts}</h3>}
      <dl className={hasAnnual || hasManual ? undefined : 'mt-6'}>
        {hasAnnual && <QuoteRow label={COPY.annualDiscount}>{perLeaderDiscount(pricing.annualDiscountMinor)}</QuoteRow>}
        {hasManual && <QuoteRow label={COPY.manualDiscount}>{perLeaderDiscount(pricing.manualDiscountMinor)}</QuoteRow>}
        <QuoteRow label={COPY.finalRow}>{money(pricing.finalMinor)}</QuoteRow>
      </dl>

      <h3 className={SECTION}>{COPY.total}</h3>
      <dl>
        <QuoteRow label={COPY.monthlyRow}>{money(pricing.monthlyTotalMinor)}</QuoteRow>
        <QuoteRow label={annual ? COPY.annualTotal : COPY.sixMonthTotal} grand>{money(pricing.periodTotalMinor)}</QuoteRow>
      </dl>

      <p className="mt-[26px] text-sm text-muted">{COPY.footer}</p>

      {actions && <div className="mt-[26px] flex flex-wrap gap-3 print:hidden">{actions}</div>}
    </article>
  );
}
