import { cn } from '@/lib/cn';

/**
 * The small outlined circle carrying an activity's display number, or a goal step's.
 *
 * **Outlined, not filled.** The prototype draws it as `1.5px solid var(--navy)` over the card
 * (`Overall.html:637-640` for a step head, `:121-124` for an activity row) — a quiet ordinal beside
 * the thing it numbers. Two screens had hand-rolled it and the second one inverted it to a filled
 * navy disc with white 10px text, which reads as a badge announcing something rather than a number.
 *
 * **The number is decorative.** It is `aria-hidden` because the label beside it already names the
 * row, and a screen reader announcing "3 Menghubungi prospek" makes the display position sound like
 * part of the activity's name. The position is also reorderable by the office, so it is not an
 * identity — invariant §4 is the same argument in the data layer.
 */
export function NumberBadge({
  n,
  size = 'sm',
  className,
}: {
  n: number;
  /** `sm` is an activity row (22px), `md` a step head (24px). */
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'border-[1.5px] border-navy font-bold text-navy',
        size === 'sm' ? 'h-[22px] w-[22px] text-2xs' : 'h-6 w-6 text-sm',
        className,
      )}
    >
      {n}
    </span>
  );
}
