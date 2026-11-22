'use client';

import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { billingMessages } from '@/i18n/messages/billing';
import { tierRange, tierSavePct, type BillingTier } from '@/lib/billing';
import { cn } from '@/lib/cn';
import { formatPercent, formatRupiah } from '@/lib/format';

/**
 * **The plan cards** (P19.23-T5 AC-2; frames f43–f46): one per tier — *1–10 leader*, the standard price struck through,
 * the offer price per leader per month, *Hemat n%* — and *101+ leader*, *Harga khusus · untuk tim besar*. The tier the
 * calculator's leaders fall in is filled and marked ***PAKET INI***. Above the calculator from 1024px, below it on a phone
 * (§12), two to a row there.
 */
export function PlanCards({ tiers, current, label }: { tiers: readonly BillingTier[]; current: string; label: string }) {
  const T = useMessages(billingMessages).cards;
  const fig = useFigureLanguage();
  return (
    <ul aria-label={label} className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {tiers.map((tier) => {
        const on = tier.code === current;
        const save = tierSavePct(tier);
        return (
          <li
            key={tier.code}
            aria-current={on ? 'true' : undefined}
            className={cn(
              'relative flex min-w-0 flex-col items-start gap-1 rounded-2xl p-3.5',
              on ? 'bg-primary text-primary-contrast' : 'bg-card text-navy',
              tier.customPricing && !on && 'border border-dashed border-hairline bg-transparent',
            )}
          >
            {on && (
              <span className="absolute -top-2.5 right-3 rounded-pill bg-secondary px-2 py-0.5 text-2xs font-extrabold tracking-[0.04em] text-secondary-contrast">
                {T.thisPlan}
              </span>
            )}
            <span className={cn('rounded-pill px-2 py-0.5 text-xs font-bold', on ? 'bg-card/40' : 'bg-base')}>
              {T.range({ range: tierRange(tier) })}
            </span>
            {tier.standardMinor !== null && tier.offerMinor !== null ? (
              <>
                <s className={cn('text-xs', on ? 'text-primary-contrast' : 'text-muted')}>{formatRupiah(tier.standardMinor, fig)}</s>
                <b className={cn('text-xl font-extrabold leading-tight', !on && 'text-primary-ink')}>{formatRupiah(tier.offerMinor, fig)}</b>
                <span className={cn('text-xs', on ? 'text-primary-contrast' : 'text-muted')}>{T.perLeaderMonth}</span>
                {save !== null && (
                  <span className="mt-0.5 rounded-pill bg-success px-2 py-0.5 text-xs font-bold text-secondary-contrast">
                    {T.save({ pct: formatPercent(save, {}, fig) })}
                  </span>
                )}
              </>
            ) : (
              <>
                <b className="mt-2 text-md font-extrabold">{T.custom}</b>
                <span className={cn('text-xs', on ? 'text-primary-contrast' : 'text-muted')}>{T.customFor}</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
