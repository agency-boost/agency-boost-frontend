'use client';

import dynamic from 'next/dynamic';
import { use } from 'react';
import { BackLink, CompanyFrame, useCompany } from '@/components/kpm-template/company-frame';
import { SkeletonCards } from '@/components/ui/skeleton';
import { productsHref } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminCompaniesConsoleMessages } from '@/i18n/messages/admin-companies-console';

const ProductsTab = dynamic(
  () => import('@/components/products-tab').then((m) => m.ProductsTab),
  { loading: () => <SkeletonCards count={4} /> },
);

/**
 * ***Detail lengkap*** (`/admin/companies/[companyId]/products/details`; P19.23-T4 AC-3; ADR-0278 §4, OD-423): the
 * catalogue's full editor, kept from the old *Pengaturan perusahaan › Produk* — a rider and its bases, the needs and the
 * bands, the commission schedule, the lifecycle, the shelf's order — **saving as it always did**, live, for the fields
 * *Info produk* and the *Sales attack plan* do not hold. Opened from a card's ⋯.
 */
export default function ProductDetailsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const t = useMessages(adminCompaniesConsoleMessages).products;
  const company = useCompany(companyId);
  return (
    <CompanyFrame companyId={companyId} company={company} permission="product_catalog:crud" active="products">
      <div className="mb-3"><BackLink href={productsHref(companyId)}>{t.back}</BackLink></div>
      <ProductsTab companyId={companyId} />
    </CompanyFrame>
  );
}
