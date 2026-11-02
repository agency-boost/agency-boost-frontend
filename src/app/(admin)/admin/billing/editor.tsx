'use client';

import { useEffect, useId } from 'react';
import { Button, Select, TextInput } from '@/components/ui/field';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { billingMessages } from '@/i18n/messages/billing';
import {
  maskAmount, money, perLeaderDiscount, saveWordsIn, tierLabel,
  type BillingPeriod, type BillingTier, type CalculatorInput, type DiscountType, type Pricing,
} from '@/lib/billing';
import { moneyPrefix } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * The editor (`#editor-view`, `Billing_Subscription.html:234-306`): the five tier cards and *Estimate
 * your price*. Every figure is `priceQuote`'s; this file only draws them.
 */

/** The page's amber words, in the one amber that clears 4.5:1 as small text (a Fix, ADR-0111 §5). */
const AMBER_TEXT = 'text-amber-ink';

/** The cards (`renderTierGrid`, `:436-468`): **the six-month rate on every card, whichever period is chosen** (`:456`). */
export function TierCards({
  tiers, current, onTalkToUs,
}: {
  tiers: readonly BillingTier[];
  current: BillingTier;
  onTalkToUs: () => void;
}) {
  const COPY = useMessages(billingMessages).prototype;
  const language = useLanguage();
  const figures = useFigureLanguage();
  return (
    <ul className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
      {tiers.map((tier) => {
        const isCurrent = tier.code === current.code;
        const range = <span className="text-sm font-bold uppercase tracking-[0.03em] text-navy">{COPY.tierLeaders({ range: tierLabel(tier) })}</span>;
        const flag = isCurrent && (
          <span className={cn('text-2xs font-bold uppercase tracking-[0.04em]', AMBER_TEXT)}>{COPY.yourTier}</span>
        );
        return (
          <li
            key={tier.code}
            className={cn(
              'flex flex-col gap-2 rounded-lg bg-card p-4',
              isCurrent ? 'border-[1.5px] border-amber' : 'border border-hairline',
              // The 101+ card (`.custom-card`, `:84-86`): no rate, a sentence and *Talk to us*.
              tier.customPricing && 'min-h-[150px] items-start justify-center',
            )}
          >
            {range}
            {tier.customPricing ? (
              <>
                <p className="mb-2.5 mt-1.5 text-base text-muted">{COPY.customPricing}</p>
                {/* A Fix: the prototype's button has no handler (`:449`). It opens the dialog. */}
                <Button variant="secondary" onClick={onTalkToUs} className="h-auto px-4 py-2 text-base">
                  {COPY.talkToUs}
                </Button>
              </>
            ) : (
              <>
                <s className="text-sm text-muted">{money(tier.standardMinor, figures)}{COPY.perMonth}</s>
                <span className="font-display text-2xl font-bold text-navy">
                  {money(tier.sixMonthMinor, figures)}
                  <span className="font-body text-xs font-medium text-muted">{COPY.perLeaderMonth}</span>
                </span>
                <span className="self-start rounded-pill bg-success/10 px-[9px] py-[3px] text-xs font-bold text-success">
                  {saveWordsIn(tier, figures, language)}
                </span>
              </>
            )}
            {flag}
          </li>
        );
      })}
    </ul>
  );
}

/** One row of the final-price block (`.final-row`, `:98-108`). */
function Row({ label, children, hero = false }: { label: string; children: React.ReactNode; hero?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 py-[7px]">
      <dt className={hero ? 'text-md font-semibold text-navy' : 'text-md text-muted'}>{label}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}

/** *Estimate your price* (`:237-304`). */
export function Estimate({
  input, pricing, onInput, onOpenDialog, discountOpen, onDiscountOpen, focusDiscount,
}: {
  input: CalculatorInput;
  pricing: Pricing;
  onInput: (next: CalculatorInput) => void;
  /** *Confirm plan*, *Send custom quote* and *Send quote* all open the dialog (ADR-0111 §5). */
  onOpenDialog: () => void;
  /** *Manual override*, open or closed: the page opens it to show a discount that stops a quote. */
  discountOpen: boolean;
  onDiscountOpen: (open: boolean) => void;
  /** Bumped by the page to move the focus to the discount field, once the disclosure is open. */
  focusDiscount: number;
}) {
  const { prototype: COPY, own: OWN } = useMessages(billingMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const id = useId();
  const ids = {
    heading: `${id}-heading`, leaders: `${id}-leaders`, period: `${id}-period`,
    discount: `${id}-discount`, discountError: `${id}-discount-error`,
  };
  useEffect(() => {
    if (focusDiscount > 0) document.getElementById(ids.discount)?.focus();
  }, [focusDiscount, ids.discount]);
  const set = (patch: Partial<CalculatorInput>) => onInput({ ...input, ...patch });
  const { tier } = pricing;
  const furtherDiscount = pricing.finalMinor < pricing.offerMinor;

  const periodButton = (period: BillingPeriod, label: string) => (
    <button
      type="button"
      aria-pressed={input.period === period}
      onClick={() => set({ period })}
      className={cn(
        'rounded-[7px] px-4 py-2 text-base font-semibold',
        input.period === period ? 'bg-navy text-white' : 'text-muted hover:text-navy',
      )}
    >
      {label}
    </button>
  );

  return (
    <section aria-labelledby={ids.heading} className="mb-5 rounded-lg border border-card-edge bg-card p-5 md:p-7">
      <h2 id={ids.heading} className="mb-1 font-display text-lg font-bold text-navy">{COPY.estimate}</h2>

      <div className="mt-4 flex flex-wrap items-end gap-5">
        <div className="flex w-full max-w-[220px] flex-col">
          <label htmlFor={ids.leaders} className="mb-1.5 text-sm font-semibold text-navy">{COPY.leaderCount}</label>
          <TextInput
            id={ids.leaders}
            type="number"
            min={1}
            value={input.leaders}
            onChange={(e) => set({ leaders: e.target.value })}
            className="w-full bg-base text-lg"
          />
        </div>
        <div className="flex flex-col">
          {/* The prototype's label names nothing (`:246`); here it names the group. */}
          <span id={ids.period} className="mb-1.5 text-sm font-semibold text-navy">{COPY.billingPeriod}</span>
          <div role="group" aria-labelledby={ids.period} className="inline-flex rounded-[10px] border border-hairline bg-base p-[3px]">
            {periodButton('sixMonth', COPY.sixMonth)}
            {periodButton('annual', COPY.annual)}
          </div>
        </div>
      </div>

      {tier.customPricing ? (
        <p className={cn('mt-2.5 text-sm font-semibold', AMBER_TEXT)}>
          {COPY.fallsInCustom({ n: pricing.leaders, range: tierLabel(tier) })}
        </p>
      ) : (
        <p className="mt-2.5 text-sm text-muted">
          {COPY.fallsIn({
            n: pricing.leaders, range: tierLabel(tier), bold: (words) => <b className="text-navy">{words}</b>,
          })}
        </p>
      )}

      <dl className="mt-[18px] border-y border-hairline py-4">
        <Row label={COPY.standardRow}>
          <s className="text-lg font-medium text-muted">{money(pricing.standardMinor, figures)}</s>
        </Row>
        <Row label={COPY.offerRow}>
          {furtherDiscount
            ? <s className={cn('font-display text-lg font-medium', AMBER_TEXT)}>{money(pricing.offerMinor, figures)}</s>
            : <span className={cn('font-display text-lg font-bold', AMBER_TEXT)}>{money(pricing.offerMinor, figures)}</span>}
        </Row>
        {/* Shown only when the final rate is below the six-month rate: always on Annual (`:510-511`). */}
        {furtherDiscount && (
          <Row label={COPY.offerAfterRow}>
            <span className={cn('font-display text-lg font-bold', AMBER_TEXT)}>{money(pricing.finalMinor, figures)}</span>
          </Row>
        )}
        <Row label={COPY.monthlyRow}>
          <span className="text-lg font-semibold text-navy">{money(pricing.monthlyTotalMinor, figures)}</span>
        </Row>
        <Row label={input.period === 'annual' ? COPY.annualTotal : COPY.sixMonthTotal} hero>
          <span className={cn('font-display text-3xl font-bold', AMBER_TEXT)}>{money(pricing.periodTotalMinor, figures)}</span>
        </Row>
      </dl>

      <div className="mt-5">
        <h3 className="mb-2.5 text-base font-bold uppercase tracking-[0.03em] text-navy">{COPY.discountsApplied}</h3>
        <div className="flex flex-wrap items-center justify-between gap-3.5 border-b border-hairline py-[9px]">
          <span className="min-w-[160px] flex-1 text-base text-muted">
            {input.period === 'annual' ? COPY.annualDiscountOn : COPY.annualDiscount}
          </span>
          {input.period === 'annual'
            ? <span className="whitespace-nowrap text-md font-semibold text-success">{perLeaderDiscount(pricing.annualDiscountMinor, figures, language)}</span>
            : <span className="text-md font-medium text-muted">{OWN.notApplied}</span>}
        </div>

        <details
          open={discountOpen}
          onToggle={(e) => onDiscountOpen(e.currentTarget.open)}
          className="group mt-0.5"
        >
          <summary className="cursor-pointer list-none py-2 text-sm text-muted before:content-['+_'] group-open:before:content-['–_'] [&::-webkit-details-marker]:hidden">
            {COPY.manualOverride}
          </summary>
          <div className="flex flex-wrap items-center justify-between gap-3.5 pt-1">
            <label htmlFor={ids.discount} className="min-w-[160px] flex-1 text-base text-muted">{COPY.arbitraryDiscount}</label>
            <div className="flex flex-wrap items-center gap-2.5">
              <TextInput
                id={ids.discount}
                type="text"
                inputMode={input.discountType === 'percent' ? 'decimal' : 'numeric'}
                value={input.discount}
                invalid={pricing.discountError !== null}
                aria-describedby={pricing.discountError ? ids.discountError : undefined}
                onChange={(e) => set({
                  discount: input.discountType === 'flat' ? maskAmount(e.target.value, figures) : e.target.value,
                })}
                className="w-[7.5rem] bg-base text-lg"
              />
              {/* A Fix: changing the type sets the value to 0, where the prototype kept the number (`:565-570`). */}
              <Select
                aria-label={OWN.discountType}
                value={input.discountType}
                onChange={(e) => set({ discountType: e.target.value as DiscountType, discount: '0' })}
                className="w-[9.375rem] bg-base text-lg"
              >
                <option value="percent">%</option>
                <option value="flat">{COPY.flatOption({ mark: moneyPrefix(figures) })}</option>
              </Select>
            </div>
          </div>
          {pricing.discountError && (
            <p id={ids.discountError} role="alert" className="mt-1.5 text-xs font-semibold text-alert">
              {pricing.discountError}
            </p>
          )}
        </details>
      </div>

      <div className="mt-[22px] flex flex-wrap items-center gap-3">
        {/* A Fix: *Confirm plan* and *Send custom quote* have no handler (`:301`, `:533`). Both open the dialog. */}
        <Button onClick={onOpenDialog}>{tier.customPricing ? COPY.sendCustomQuote : COPY.confirmPlan}</Button>
        <Button variant="secondary" onClick={onOpenDialog}>{COPY.sendQuote}</Button>
      </div>
      <p className="mt-3.5 text-sm text-muted">{COPY.finePrint}</p>
    </section>
  );
}
