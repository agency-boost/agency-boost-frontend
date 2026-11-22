'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { billingMessages } from '@/i18n/messages/billing';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { listBillingKpms, readBillingPrices, type BillingKpmRow, type BillingPrices } from '@/lib/billing';
import { formatNumber } from '@/lib/format';
import { Calculator } from './calculator';

/**
 * **A KPM's *Atur*: the calculator in a dialog** (P19.23-T5 AC-4; ADR-0279 §3; frames f50–f51) — *Langganan {KPM}*,
 * *{perusahaan} · n leader aktif*, the calculator filled with that KPM's leaders and its confirmed package, and
 * *Konfirmasi paket*. A centred dialog from 1024px, a bottom sheet below it (§12).
 *
 * **For other screens too**: the KPM page's *Atur* opens it with the KPM's id. `kpmId` absent, it is the tab's calculator
 * in a dialog, with the *KPM* field. It reads the price list and the KPMs itself, and calls `onConfirmed` with the KPM's
 * row as the server answers it once a package is confirmed; the caller closes it.
 */
export function CalculatorDialog({ kpmId, onClose, onConfirmed }: {
  kpmId?: string;
  onClose: () => void;
  onConfirmed?: (row: BillingKpmRow) => void;
}) {
  const T = useMessages(billingMessages);
  const fig = useFigureLanguage();
  const [data, setData] = useState<{ prices: BillingPrices; rows: BillingKpmRow[] } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([readBillingPrices(), listBillingKpms()])
      .then(([prices, list]) => setData({ prices, rows: list.rows }))
      .catch((err) => setError(toDisplayError(err)));
  }, []);
  useEffect(load, [load]);

  const kpm = kpmId ? data?.rows.find((r) => r.kpmId === kpmId) ?? null : null;
  const title = kpm ? T.dialog.title({ branch: kpm.branch }) : T.calc.title;
  const description = kpm
    ? T.dialog.sub({ company: kpm.company.name, n: formatNumber(kpm.leadersUsed, {}, fig) })
    : undefined;

  return (
    <ResponsiveSheet open title={title} description={description} onClose={onClose} className="lg:max-w-[38rem]">
      {error ? (
        <div>
          <ErrorBanner code={error.code} message={T.failed} requestId={error.requestId} />
          <Button variant="secondary" className="mt-3" onClick={load}>{T.retry}</Button>
        </div>
      ) : !data ? (
        <Skeleton label={T.loading}>
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => <SkeletonBar key={i} className="h-10 w-full" />)}
            <SkeletonBar className="h-40 w-full" />
          </div>
        </Skeleton>
      ) : kpmId && !kpm ? (
        <ErrorBanner code="NOT_FOUND" message={T.failed} />
      ) : (
        <Calculator prices={data.prices} kpms={data.rows} kpm={kpm} variant="dialog" onConfirmed={onConfirmed} />
      )}
    </ResponsiveSheet>
  );
}
