import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Label above, one large number below, an optional unit inside it.
 *
 * Specified in `components-and-patterns.md` since Phase 1 and never built, so three screens grew
 * their own bare `Figure` helper instead — a bold navy number with a grey line under it, identical
 * whether it echoed an input or was the answer the screen exists to give. This is what the prototype
 * draws instead (`Overall.html:686-699`).
 *
 * **`insight` is the emphasis, and it is not decoration.** An amber tile is how the prototype marks
 * the number that is the point of the card — *this month's APE target*, *remaining needed* — against
 * the plain tiles that merely restate what you typed. A card where everything is emphasised is a card
 * where nothing is.
 *
 * **The value is `--text-2xl` and `font-body`.** Manrope is display-only (`tokens.md:74-75`) and the
 * prototype pins `font-family:'Inter'` on every one of these numbers; the screens that hand-rolled it
 * used `font-display`, which is why a figure and a heading looked like the same kind of thing.
 *
 * **Amber values use `--color-amber-deep`, not `--color-amber-dark`.** The prototype's own amber-dark
 * on its own 8% tint is 2.82:1 and clears no floor at all. See `tokens.md`.
 *
 * The prototype's `.result-tile` (`:694-699`) is this tile with `insight` at full width — a slightly
 * larger value and a 1px border, no other difference — so it is a call site, not a fourth variant.
 */
export function KpiTile({
  label,
  value,
  unit,
  variant = 'plain',
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Rendered smaller and lighter inside the value — `policies`, `/90`, `/16`. */
  unit?: ReactNode;
  /**
   * `insight` for the number the card is about; `complete` for a finished activation; `overdue` for a
   * hire's *Day* past the window below 100% (`Overall.html:1550`, `:1847`).
   */
  variant?: 'plain' | 'insight' | 'complete' | 'overdue';
  className?: string;
}) {
  return (
    <div
      data-variant={variant}
      className={cn(
        'rounded-md border px-3 py-2.5',
        variant === 'plain' && 'border-hairline bg-base',
        variant === 'insight' && 'border-amber/35 bg-amber/[0.08]',
        variant === 'complete' && 'border-success/35 bg-success/[0.08]',
        variant === 'overdue' && 'border-alert/30 bg-alert/[0.08]',
        className,
      )}
    >
      <span className="block text-xs text-muted">{label}</span>
      <span
        className={cn(
          'font-body text-2xl font-bold leading-tight',
          variant === 'insight' && 'text-amber-deep',
          variant === 'complete' && 'text-success',
          variant === 'overdue' && 'text-alert',
          variant === 'plain' && 'text-navy',
        )}
      >
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-muted">{unit}</span> : null}
      </span>
    </div>
  );
}
