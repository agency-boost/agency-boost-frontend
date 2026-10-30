import { PlanTabs } from '@/components/plan/plan-tabs';
import { useMessages } from '@/i18n/language-provider';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import { PRODUCT_CATALOG_HREF, SALES_ATTACK_PLAN_HREF } from '@/lib/product-catalog';

/**
 * **Sales tools' two screens as tabs** (P18.8-T12, ADR-0161 §5): *Sales Attack Plan | Product Catalog*, over both
 * pages, since the sidebar's *Sales tools* group became one entry at the client's request (2026-10-26). Each keeps
 * its address, `/attack-plan` and `/product-catalog`, and its own title and sub-line above the strip, as
 * `/activity/*` does with its three.
 *
 * `RouteTabs`, the underline strip: links in a named `nav`, the current one carrying `aria-current`. **The catalog
 * is current over a product's drawer too**, `/product-catalog/{code}`. Below it the catalog's category pills and
 * the drawer's own tabs keep their idioms — navy chips and a tablist inside a dialog — so the three never read as
 * one row.
 *
 * Its words are §A's, kept English in both languages: the strip is named by the nav's group, *Sales tools*, and each
 * tab is its page's title (`messages/product-catalog.ts`, P18.98-T4).
 *
 * **On a phone, one segmented control** (UI V1, UI-107; `PlanTabs`): the same links, a white pill track with the current
 * half navy; from 768px the underlined strip as before.
 */
export function SalesToolsTabs() {
  const t = useMessages(productCatalogMessages);
  return (
    <PlanTabs
      label={t.tabs.label}
      tabs={[
        { href: SALES_ATTACK_PLAN_HREF, label: t.tabs.plan },
        { href: PRODUCT_CATALOG_HREF, label: t.tabs.catalog, nested: true },
      ]}
    />
  );
}
