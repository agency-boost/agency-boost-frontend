'use client';

import { Suspense, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { ProposalDataScreen } from '@/components/proposal-data/proposal-data-screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, ErrorBanner } from '@/components/ui/field';
import { FilterChips } from '@/components/ui/list-rows';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { productDataAccessMessages } from '@/i18n/messages/product-data-access';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readReadableCompanies, type ReadableCompany } from '@/lib/product-data-grants';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';

/**
 * ***Data produk*** (`/kpm/data-produk`; P19.15-T4 AC-2, AC-3; ADR-0260 §5; the P1b spec's *Who can do what*): the
 * insurers' proposal data, in the office console — **the company *Proposal* tab** (`ProposalDataScreen`, the Super
 * Admin's own screen) mounted for each company the reader may open:
 *
 * - **a product data manager** (*Kelola data produk*): every insurer ticked, in full, and their own KPM's company
 *   read-only where it is not ticked — *Data produk* in their menu under *Pengaturan*;
 * - **a KPM Owner or KPM Admin without it**: their own company, read-only — status, dates, which products calculate —
 *   reached from *Products*' *Lihat data proposal*, with no menu item;
 * - **agents and leaders**: nothing — the office family is not theirs, and the API refuses `product_data:read`.
 *
 * **The companies are the server's answer on each visit** (`GET /product-data/companies`), read from the grant as that
 * request resolved it: a grant removed since the session was read answers the own company read-only, and the session
 * is read again so *Data produk* leaves the menu; a grant given since adds it. Several companies are chosen with chips,
 * the reader's own first; `?company=` opens one.
 */
export default function DataProdukPage() {
  const t = useMessages(productDataAccessMessages).page;
  return (
    <Page title={t.title} permission="product_data:read">
      {/* `useSearchParams` needs a boundary (`lib/use-query.ts`). */}
      <Suspense fallback={null}>
        <Companies />
      </Suspense>
    </Page>
  );
}

/** The same ids, whatever their order. */
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id) => b.includes(id));

function Companies() {
  const t = useMessages(productDataAccessMessages).page;
  const { me, reload } = useSession();
  const query = useQuery();
  const asked = typeof query.company === 'string' ? query.company : null;
  const [items, setItems] = useState<ReadableCompany[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(asked);
  const [error, setError] = useState<ApiError | null>(null);
  const held = me?.productDataCompanyIds ?? [];
  const looking = me?.isImpersonating === true || me?.user.platformRole === 'super_admin';

  useEffect(() => {
    let live = true;
    readReadableCompanies()
      .then(({ items: answered }) => {
        if (live) setItems(answered);
      })
      .catch((err) => {
        if (!live) return;
        setError(toDisplayError(err));
        setItems([]);
      });
    return () => { live = false; };
  }, []);

  /*
   * **The menu follows the grant** (ADR-0260 §5): the session said one set of companies, this request another — a grant
   * removed, changed or given since the session was read. Read it again, once, so *Data produk* appears or leaves.
   * A support session's answer is read-only whatever it holds, so it is no evidence of a change.
   */
  const managed = items?.filter((c) => c.canManage).map((c) => c.companyId) ?? null;
  const stale = managed !== null && !looking && !sameSet(managed, held);
  useEffect(() => {
    if (stale) void reload();
  }, [stale, reload]);

  if (error) return <ErrorBanner {...error} />;
  if (items === null) return <SkeletonCards count={3} label={t.title} />;
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState title={t.empty} />
      </Card>
    );
  }

  const current = items.find((c) => c.companyId === chosen) ?? items[0];
  return (
    <div className="flex flex-col gap-4">
      {/* Several companies: one chip each, the read-only ones saying so (ADR-0260 §5); one company needs no choice. */}
      {items.length > 1 && (
        <FilterChips
          label={t.companies}
          active={current.companyId}
          onSelect={setChosen}
          chips={items.map((c) => ({ key: c.companyId, label: c.canManage ? c.name : `${c.name} · ${t.readOnly}` }))}
        />
      )}
      {/* Keyed by the company, so a choice starts its screen afresh rather than carrying another company's state. */}
      <ProposalDataScreen key={current.companyId} companyId={current.companyId} canManage={current.canManage} />
    </div>
  );
}
