'use client';

import { Suspense, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Page } from '@/components/page';
import { CatalogSkeleton, ProductCatalog } from '@/components/product-catalog';
import { SalesToolsTabs } from '@/components/sales-tools-tabs';
import { useMessages } from '@/i18n/language-provider';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import { PRODUCT_CATALOG_HREF } from '@/lib/product-catalog';

/**
 * **Product Catalog** (`/product-catalog`, and its drawer at `/product-catalog/[productCode]`;
 * `Overall.html:3872-3883`, title `:10416`; P14-T7).
 *
 * **A layout, so the grid is mounted once** for both addresses: opening a product pushes the drawer's
 * address over the grid and Back closes it, the grid where it was (D-urls). The pages beneath are
 * nothing — the grid's own address — and the drawer.
 *
 * Gated by `product_catalog:read`, which every member of the office holds: the Owner and the Admin reach
 * it through their field view (ADR-0114). The API answers the office's own shelf whatever this decides.
 * The grid reads its filters from the address, which needs the boundary below.
 *
 * **Under the tabs *Sales Attack Plan | Product Catalog*** (P18.8-T12, ADR-0161 §5), the catalog's current over its
 * drawer too. Behind an open drawer the strip, like the grid, takes no focus and no click: the dialog is modal.
 */
export default function ProductCatalogLayout({ children }: { children: ReactNode }) {
  const t = useMessages(productCatalogMessages);
  const drawerOpen = usePathname() !== PRODUCT_CATALOG_HREF;
  return (
    // The sub-line is not drawn on a phone: the client's *Remove* (P18.95-T7 AC-1, grey text row 13), its search above
    // the grid since P18.95-T6.
    <Page
      title={t.title}
      subtitle={t.subtitle}
      subtitleOnPhone={false}
      permission="product_catalog:read"
    >
      <div inert={drawerOpen || undefined}>
        <SalesToolsTabs />
      </div>
      <Suspense fallback={<CatalogSkeleton />}>
        <ProductCatalog>{children}</ProductCatalog>
      </Suspense>
    </Page>
  );
}
