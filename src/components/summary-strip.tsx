import { TermTip } from '@/components/ui/term-tip';
import { cn } from '@/lib/cn';
import type { SummaryTile } from '@/lib/summary-tiles';

/**
 * The prototype's `.summary-strip` of `.summary-card`s (`Overall.html:105-109`), shared by Log
 * Activity and the Activity Dashboard as the prototype shares it. What goes in it is
 * `summaryTiles`' answer; this only draws it.
 *
 * **A white card, not a `KpiTile`.** The strip used `KpiTile`, whose plain tile sits on the warm
 * base and whose emphasis is an amber tint. The prototype's card is white with a hairline and a 12px
 * radius, and its total differs only in the colour of its number.
 *
 * **The total's number is amber-deep, with no tint** (F-71). The prototype paints it amber-dark,
 * which clears no contrast floor on white; amber-deep clears 3:1 and so is a large-text colour.
 *
 * **The value is the ramp's KPI step, bold.** The prototype's 24px at 600 is not on the nine-step
 * scale (`tokens.md`), whose KPI value is `--text-2xl`, 20px. At 20px, 600 is not large text — axe
 * counts bold from 700 — and amber-deep on white is 4.34:1, short of the 4.5:1 normal text needs. At
 * 700 it is large text, and passes.
 *
 * **One row from `lg`**, as the prototype's `repeat(5, 1fr)` has it, for however many tiles the
 * office's grouping makes; narrower, three to a row and then two, at the nearest steps to the
 * prototype's own 1100px and 640px (`:309-312`).
 */
export function SummaryStrip({ tiles, className }: { tiles: SummaryTile[]; className?: string }) {
  return (
    <div
      className={cn(
        'mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-flow-col lg:grid-cols-none lg:auto-cols-fr',
        className,
      )}
    >
      {tiles.map((tile) => (
        <div
          key={tile.key}
          data-total={tile.total || undefined}
          className="min-w-0 rounded-lg border border-card-edge bg-card px-4 py-3"
        >
          <span className="mb-1 block text-sm text-muted">
            {tile.label}
            {tile.term && <> <TermTip term={tile.term} /></>}
          </span>
          <span
            className={cn(
              'block font-body text-2xl font-bold',
              tile.total ? 'text-amber-deep' : 'text-navy',
            )}
          >
            {tile.value}
          </span>
        </div>
      ))}
    </div>
  );
}
