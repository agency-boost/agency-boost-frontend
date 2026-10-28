'use client';

import { Suspense } from 'react';
import { AttackPlanScreen, type PlanAddress } from '@/components/attack-plan';
import { Page } from '@/components/page';
import { SalesToolsTabs } from '@/components/sales-tools-tabs';
import { briefFromQuery, productFromQuery, PROTOTYPE_COPY } from '@/lib/product-catalog';
import { useQuery } from '@/lib/use-query';

/**
 * **Sales Attack Plan** (`/attack-plan`; `Overall.html:3786-3866`, title `:10415`; P14-T8).
 *
 * **The address** (D-urls, `route-registry.md`): `?need=&age=&budget=` is the plan for that brief, with
 * `&product=` one of its alternatives switched to; `?product=` alone is the catalog's deep link; anything
 * else — nothing, or a band out of range — is the brief with nothing chosen (P14-T8 AC-7), never an error
 * page. Gated by `product_catalog:read`, every field member's; the API answers the office's own shelf.
 *
 * **Under the tabs *Sales Attack Plan | Product Catalog*** (P18.8-T12, ADR-0161 §5): the sidebar's one *Sales
 * tools* entry opens here, and the strip reaches the catalog.
 */
export default function AttackPlanPage() {
  return (
    // `useSearchParams` needs a boundary (`lib/use-query.ts`). Nothing in its place: a prerender draws the shell's gate, never this.
    <Suspense fallback={null}>
      <AttackPlan />
    </Suspense>
  );
}

function AttackPlan() {
  const query = useQuery();
  const brief = briefFromQuery(query);
  const product = productFromQuery(query);
  const address: PlanAddress = brief
    ? { kind: 'plan', brief, product }
    : product && query.need === undefined && query.age === undefined && query.budget === undefined
      ? { kind: 'product', code: product }
      : { kind: 'brief' };
  return (
    // No sub-line: the brief's one line says it, at every size (P18.95-T7 AC-1, grey text row 10).
    <Page title={PROTOTYPE_COPY.planTitle} permission="product_catalog:read">
      <SalesToolsTabs />
      <AttackPlanScreen address={address} />
    </Page>
  );
}
