'use client';

import { cn } from '@/lib/cn';

/**
 * The most-used control in the product: the daily activity counter.
 *
 * **One welded pill, as the prototype draws it** (`Overall.html:129-145`): a 34px-tall group with a
 * single border, 28px buttons either side of a 40px field, and hairlines between rather than around
 * each part. It was three separate 44px boxes with gaps, which is a row of three controls rather than
 * one counter — and beside two lines of activity label it dominated the row it belongs to.
 *
 * **44px targets survive where they matter.** The floor exists because an agent taps this a dozen
 * times a day on a mid-range Android, so it is applied on a **coarse pointer** — a phone or a tablet —
 * and the compact shape is what a mouse gets. WCAG 2.5.5 (44px) is AAA; 2.5.8, the AA criterion, asks
 * 24px, which 28×34 clears. So the phone keeps the bigger target and nothing is traded for the shape.
 *
 * **Every part sets its own colour.** It relied on inheriting `body`'s navy, and the number came out
 * near-white against the card on the first screen that used it — the component had been unit-tested in
 * isolation since Phase 6 and never rendered inside a shell. Every other control in `field.tsx` states
 * `text-navy`; this one now does too.
 *
 * The value is clamped, and typing a non-number coerces to 0 rather than producing NaN.
 */
export function Stepper({
  value,
  onChange,
  label,
  min = 0,
  max = 999,
  disabled = false,
}: {
  value: number;
  onChange: (next: number) => void;
  /** The activity type's name. Used as the accessible label — never just its number. */
  label: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const set = (n: number) => onChange(clamp(Number.isFinite(n) ? Math.trunc(n) : 0));

  /** 28×34, and 44px where a finger is doing the tapping. */
  const BUTTON = cn(
    'flex h-[34px] w-7 shrink-0 items-center justify-center bg-base text-md font-bold leading-none text-navy',
    'transition-colors hover:bg-navy/[0.06] active:scale-[0.94]',
    /*
     * **40%, the project's standard for a disabled control — not the 30% an icon button uses.**
     * A day arrives with every count at 0, so every `–` on the screen is disabled at once: at 30%
     * that is a dozen buttons reading as blank space, which is what it looked like. Disabled rather
     * than merely clamped, because the bound is then announced instead of silently ignored — the
     * prototype clamps in JS and leaves the button pressable, so this part is ours.
     */
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-base',
    '[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11',
  );

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center overflow-hidden rounded-md border border-hairline bg-card',
        // One indicator, on the group, at the weight `globals.css` gives a bare input — the inner
        // input suppresses its own, or focusing the field draws two rings around two halves of it.
        'focus-within:border-amber focus-within:ring-2 focus-within:ring-amber focus-within:ring-offset-1',
      )}
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={disabled || value <= min}
        onClick={() => set(value - 1)}
        className={BUTTON}
      >
        –
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={`Count for ${label}`}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => set(parseInt(e.target.value, 10) || 0)}
        /*
         * **A wheel scrolls the page, never the count.** A focused `type="number"` treats a scroll as
         * an increment, so an agent reading down a twelve-row day changes a count they are not looking
         * at. React attaches `wheel` passively at the root, so `preventDefault()` there does nothing;
         * dropping focus is both the fix and the honest outcome.
         */
        onWheel={(e) => e.currentTarget.blur()}
        className={cn(
          'h-[34px] w-10 border-x border-hairline bg-card text-center text-base font-semibold text-navy',
          'focus:bg-input-focus focus:outline-none focus-visible:outline-none [appearance:textfield]',
          'disabled:opacity-40',
          '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          '[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-14',
        )}
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={disabled || value >= max}
        onClick={() => set(value + 1)}
        /* The prototype tints `+` amber-dark rather than filling it (`:137`) — a counter you press
           dozens of times should not be a row of amber blocks. `amber-deep` for the contrast floor. */
        className={cn(BUTTON, 'text-amber-deep hover:bg-amber/10 disabled:hover:bg-base')}
      >
        +
      </button>
    </div>
  );
}
