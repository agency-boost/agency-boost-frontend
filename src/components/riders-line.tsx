import { cn } from '@/lib/cn';
import { useMessages } from '@/i18n/language-provider';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import type { CatalogRider } from '@/lib/product-catalog';

/**
 * ***"Bisa ditambah: <rider names>"*** (P19.4-T4 AC-5; the riders spec's rule 3; ADR-0209 §3): the riders on sale that
 * attach to a base product, under it — in the catalog's drawer and in the Sales Attack Plan, the only places an agent
 * meets a rider. A rider is never a card, a filter or a recommendation of its own, and has no attack plan (OD-262), so
 * the line names them and links nowhere. Nothing at all for a base with no rider.
 *
 * Text: the label in the reader's language, the names as the company typed them.
 */
export function RidersLine({ riders, className }: { riders: readonly CatalogRider[]; className?: string }) {
  const t = useMessages(productCatalogMessages);
  if (riders.length === 0) return null;
  return (
    <p data-part="riders" className={cn('m-0 text-base text-navy', className)}>
      <span className="font-semibold">{t.canBeAdded}</span> {riders.map((r) => r.name).join(', ')}
    </p>
  );
}
