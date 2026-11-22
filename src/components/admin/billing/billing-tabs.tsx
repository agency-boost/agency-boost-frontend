'use client';

import Link from 'next/link';
import { HEADER_CONTROL } from '@/components/ui/header-control';
import { useMessages } from '@/i18n/language-provider';
import { billingMessages } from '@/i18n/messages/billing';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/lib/use-media-query';

/** The three tabs, in the client's order (AC-1): *Kalkulator* first, the default. */
export const BILLING_TABS = ['calculator', 'prices', 'kpms'] as const;
export type BillingTab = (typeof BILLING_TABS)[number];

/** A tab's address: `/admin/billing` for the calculator, `?tab=harga` and `?tab=kpm` for the other two. */
export const billingTabHref = (tab: BillingTab) =>
  (tab === 'calculator' ? '/admin/billing' : `/admin/billing?tab=${tab === 'prices' ? 'harga' : 'kpm'}`);

/** The tab a `?tab=` names; anything else is the calculator. */
export const billingTabOf = (query: string | null): BillingTab =>
  (query === 'harga' ? 'prices' : query === 'kpm' ? 'kpms' : 'calculator');

/**
 * ***Langganan & akses*'s three tabs** (P19.23-T5 AC-1; frames f43, f47, f48): *Kalkulator · Paket & harga · Langganan per
 * KPM*. A pill track of links, the one the reader is on navy (`aria-current="page"`), as *Platform*'s; **on a phone one
 * row of three equal widths** (§12), the third *Langganan*.
 */
export function BillingTabs({ current }: { current: BillingTab }) {
  const T = useMessages(billingMessages).tabs;
  const phone = useMediaQuery('phone');
  const label = (tab: BillingTab) => (tab === 'calculator' ? T.calculator : tab === 'prices' ? T.prices : (phone ? T.kpmsShort : T.kpms));
  return (
    <nav
      aria-label={T.label}
      className={cn(
        'rounded-pill border border-hairline bg-card p-[3px]',
        phone ? 'mb-3 grid grid-cols-3' : 'mb-4 inline-flex max-w-full flex-wrap',
      )}
    >
      {BILLING_TABS.map((tab) => {
        const on = tab === current;
        return (
          <Link
            key={tab}
            href={billingTabHref(tab)}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-pill px-3.5 transition-colors',
              HEADER_CONTROL,
              phone && 'px-1.5',
              on ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
            )}
          >
            {label(tab)}
          </Link>
        );
      })}
    </nav>
  );
}
