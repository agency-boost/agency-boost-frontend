'use client';

import { use } from 'react';
import { ProductDrawer } from '@/components/product-drawer';

/**
 * **One product's drawer, over the grid** (`/product-catalog/[productCode]`; P14-T7 AC-4, D-urls): the
 * address a card opens, Back closes, and a link or a typed address opens again. The grid is the layout's.
 * A code the office does not keep on, or that does not exist, is the drawer's not-found state.
 */
export default function ProductDrawerPage({ params }: { params: Promise<{ productCode: string }> }) {
  const { productCode } = use(params);
  return <ProductDrawer key={productCode} code={decodeURIComponent(productCode)} />;
}
