'use client';

import { cn } from '@/lib/cn';

/**
 * The most-used control in the product: the daily activity counter.
 *
 * Everything about it is governed by one constraint — an agent taps it a dozen times a
 * day on a mid-range Android phone. Targets are 44px, the value is clamped, and typing
 * a non-number coerces to 0 rather than producing NaN (Overall.html clamp helper).
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

  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={disabled || value <= min}
        onClick={() => set(value - 1)}
        className={cn(
          'h-11 w-11 rounded-md border border-hairline bg-card text-lg leading-none',
          'disabled:opacity-30 disabled:cursor-not-allowed',
        )}
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
        className={cn(
          'h-11 w-14 rounded-md border border-hairline bg-card text-center text-base font-semibold',
          'focus:bg-[#FFF6EC] [appearance:textfield]',
          '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        )}
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={disabled || value >= max}
        onClick={() => set(value + 1)}
        className={cn(
          'h-11 w-11 rounded-md border border-hairline bg-amber text-lg leading-none text-navy',
          'disabled:opacity-30 disabled:cursor-not-allowed',
        )}
      >
        +
      </button>
    </div>
  );
}
