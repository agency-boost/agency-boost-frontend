'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BillingTabs, billingTabOf } from '@/components/admin/billing/billing-tabs';
import { Calculator } from '@/components/admin/billing/calculator';
import { KpmSubscriptions } from '@/components/admin/billing/kpm-subscriptions';
import { PriceList } from '@/components/admin/billing/price-list';
import { Page } from '@/components/page';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { billingMessages } from '@/i18n/messages/billing';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { listBillingKpms, readBillingPrices, type BillingKpmRow, type BillingPrices } from '@/lib/billing';

/**
 * ***Langganan & akses*** (P19.23-T5; ADR-0279; frames f43–f51): three tabs — ***Kalkulator*** (the default),
 * ***Paket & harga*** and ***Langganan per KPM*** (`?tab=harga`, `?tab=kpm`).
 *
 * The Super Admin's alone (`billing:read_prices`): the route's own gate, inside the console's; the API refuses every other
 * role as well. The price list is read once for all three tabs; the calculator also reads the KPMs, for its *KPM* field.
 */
export default function BillingPage() {
  const T = useMessages(billingMessages);
  return (
    <Page title={T.title} permission="billing:read_prices">
      {/* `useSearchParams` needs a boundary (`lib/use-query.ts`). */}
      <Suspense fallback={null}>
        <Billing />
      </Suspense>
    </Page>
  );
}

function Billing() {
  const T = useMessages(billingMessages);
  const tab = billingTabOf(useSearchParams()?.get('tab') ?? null);
  const [prices, setPrices] = useState<BillingPrices | null>(null);
  const [kpms, setKpms] = useState<BillingKpmRow[]>([]);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(() => {
    setError(null);
    readBillingPrices().then(setPrices).catch((err) => setError(toDisplayError(err)));
  }, []);
  useEffect(load, [load]);

  // The calculator's *KPM* field: the list it picks from. A failure leaves the field typing a new name only.
  useEffect(() => {
    if (tab !== 'calculator') return;
    listBillingKpms().then((list) => setKpms(list.rows)).catch(() => setKpms([]));
  }, [tab]);

  return (
    <div className="max-w-[80rem]">
      <BillingTabs current={tab} />
      {error ? (
        <div>
          <ErrorBanner code={error.code} message={T.failed} requestId={error.requestId} />
          <Button variant="secondary" className="mt-3" onClick={load}>{T.retry}</Button>
        </div>
      ) : !prices ? (
        <Skeleton label={T.loading}>
          <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => <SkeletonBar key={i} className="h-28 w-full" />)}
          </div>
          <SkeletonBar className="h-96 w-full" />
        </Skeleton>
      ) : tab === 'prices' ? (
        <PriceList prices={prices} />
      ) : tab === 'kpms' ? (
        <KpmSubscriptions prices={prices} />
      ) : (
        <Calculator prices={prices} kpms={kpms} variant="page" />
      )}
    </div>
  );
}
