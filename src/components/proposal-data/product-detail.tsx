'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonText } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { productDataMessages } from '@/i18n/messages/product-data';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readProductData, type ProductDataDetail } from '@/lib/product-data';
import { IllustrationTab } from './illustration-tab';
import { RateTableTab } from './rate-table-tab';
import { RulesTab } from './rules-tab';
import { TryTab } from './try-tab';

type DetailTab = 'isian' | 'table' | 'illustration' | 'try';

/**
 * **One product of the *Proposal* tab** (P19.15-T1; the P1b spec's §3): four tabs — ***Isian*** (the fields and rules),
 * ***Tabel premi*** (the upload, its columns, gaps, *Ketentuan*, three test profiles, activation and every version),
 * ***Ilustrasi*** (T2's, `IllustrationTab`) and ***Uji coba*** (the agent's card, tried). Read once, and again after
 * every save, so each tab shows what the server holds.
 */
export function ProductDetail({ companyId, productId, name, canManage, onBack }: {
  companyId: string; productId: string; name: string; canManage: boolean; onBack: () => void;
}) {
  const t = useMessages(productDataMessages).detail;
  const [detail, setDetail] = useState<ProductDataDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [tab, setTab] = useState<DetailTab>('isian');

  const load = useCallback(async () => {
    try {
      setDetail(await readProductData(companyId, productId));
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [companyId, productId]);
  useEffect(() => { void load(); }, [load]);

  const manage = canManage && (detail?.canManage ?? false);

  return (
    <section data-product-detail={productId} aria-labelledby={`${productId}-name`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="inline" onClick={onBack}>
          <LineIcon name="chevronLeft" className="h-4 w-4" />
          {t.back}
        </Button>
      </div>
      <h3 id={`${productId}-name`} className="font-display text-lg font-bold text-navy">{detail?.product.name ?? name}</h3>
      {error && <ErrorBanner {...error} />}
      {!detail && !error && <SkeletonText lines={6} />}
      {detail && (
        <Segmented
          label={t.tabs}
          tabs={[
            { id: 'isian', label: t.isian }, { id: 'table', label: t.table },
            { id: 'illustration', label: t.illustration }, { id: 'try', label: t.try },
          ]}
          active={tab}
          onSelect={(next) => setTab(next as DetailTab)}
        >
          {(active) => (
            <div className="pt-4">
              {active === 'isian' && <RulesTab companyId={companyId} detail={detail} canManage={manage} onSaved={setDetail} />}
              {active === 'table' && <RateTableTab companyId={companyId} detail={detail} canManage={manage} onChanged={load} />}
              {active === 'illustration' && <IllustrationTab companyId={companyId} productId={productId} canManage={manage} />}
              {active === 'try' && <TryTab companyId={companyId} detail={detail} />}
            </div>
          )}
        </Segmented>
      )}
    </section>
  );
}
