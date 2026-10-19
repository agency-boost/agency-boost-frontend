'use client';

import { use } from 'react';
import { AttackPlanScreen, type PlanAddress } from '@/components/attack-plan';
import { Page } from '@/components/page';
import { briefFromQuery, productFromQuery, PROTOTYPE_COPY } from '@/lib/product-catalog';

type Query = { need?: string | string[]; age?: string | string[]; budget?: string | string[]; product?: string | string[] };

/**
 * **Sales Attack Plan** (`/attack-plan`; `Overall.html:3786-3866`, title `:10415`; P14-T8).
 *
 * **The address** (D-urls, `route-registry.md`): `?need=&age=&budget=` is the plan for that brief, with
 * `&product=` one of its alternatives switched to; `?product=` alone is the catalog's deep link; anything
 * else — nothing, or a band out of range — is the brief with nothing chosen (P14-T8 AC-7), never an error
 * page. Gated by `product_catalog:read`, every field member's; the API answers the office's own shelf.
 */
export default function AttackPlanPage({ searchParams }: { searchParams?: Promise<Query> }) {
  const query = searchParams ? use(searchParams) : {};
  const brief = briefFromQuery(query);
  const product = productFromQuery(query);
  const address: PlanAddress = brief
    ? { kind: 'plan', brief, product }
    : product && query.need === undefined && query.age === undefined && query.budget === undefined
      ? { kind: 'product', code: product }
      : { kind: 'brief' };
  return (
    <Page title={PROTOTYPE_COPY.planTitle} subtitle={PROTOTYPE_COPY.planSubtitle} permission="product_catalog:read">
      <AttackPlanScreen address={address} />
    </Page>
  );
}
