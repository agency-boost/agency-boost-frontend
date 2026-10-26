import { RouteTabs } from '@/components/ui/route-tabs';
import { PRODUCT_CATALOG_HREF, PROTOTYPE_COPY, SALES_ATTACK_PLAN_HREF } from '@/lib/product-catalog';

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
 */
export function SalesToolsTabs({ className }: { className?: string }) {
  return (
    <RouteTabs
      label="Sales tools"
      className={className}
      tabs={[
        { href: SALES_ATTACK_PLAN_HREF, label: PROTOTYPE_COPY.planTitle },
        { href: PRODUCT_CATALOG_HREF, label: PROTOTYPE_COPY.catalogTitle, nested: true },
      ]}
    />
  );
}
