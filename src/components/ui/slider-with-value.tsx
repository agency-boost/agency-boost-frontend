'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { cn } from '@/lib/cn';
import { formatDecimalInput, parseDecimal } from '@/lib/format';

/**
 * **A value set with the thumb, or typed exactly** (UI V1, UI-016 — Goal Setting's *Annual APE target*, *Rata-rata
 * case size*, and *Annual savings target*; D-21: many agents are over 50).
 *
 * - The label on the left and **the value on the right, 28px/800** (*Rp 500 jt*), written by the caller's `format`.
 * - **A slider under it**: a 6px track filled in the accent up to the thumb, a 22px thumb. Every value can be set
 *   without a keyboard (UI-016's *Done when*), by `step`.
 * - **Tapping the value opens a number field** in its place — 16px, a numeric keyboard — for an exact amount; Enter or
 *   leaving it applies it, Escape leaves the value as it was. A typed value is clamped to `min`–`max` and not rounded to
 *   the step: an exact amount is what the field is for. **`exactMin` / `exactMax` widen what may be typed** past the
 *   track's ends (P18.99-T5: Goal Setting's track reaches Rp 1 M, and a bigger annual target is still typed); the thumb
 *   then stands at the end it passed.
 *
 * The value is the caller's, in the caller's unit (the goal's major rupiah, say); the slider never stores anything.
 */
export function SliderWithValue({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  info,
  disabled = false,
  className,
  exactMin,
  exactMax,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  /** The least an exact amount may be typed as; `min` when absent. */
  exactMin?: number;
  /** The most an exact amount may be typed as; `max` when absent. */
  exactMax?: number;
  step?: number;
  /** The value as the reader reads it: *Rp 500 jt*. */
  format: (value: number) => string;
  /** An ⓘ beside the label. */
  info?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const t = useMessages(uiV1Messages);
  const figures = useFigureLanguage();
  const id = useId();
  const [typing, setTyping] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const shown = format(value);
  // The track's fill, as a share of the range.
  const fill = max > min ? ((clamp(value) - min) / (max - min)) * 100 : 0;

  useEffect(() => {
    if (typing !== null) field.current?.select();
    // Only as the field opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing === null]);

  const apply = () => {
    if (typing === null) return;
    const typed = parseDecimal(typing);
    if (Number.isFinite(typed)) onChange(Math.min(exactMax ?? max, Math.max(exactMin ?? min, typed)));
    setTyping(null);
  };

  return (
    <div data-slider-with-value="" className={cn('py-1', className)}>
      <div className="flex items-center gap-3">
        <label htmlFor={`${id}-range`} className="flex min-w-0 flex-1 items-center gap-1 text-md text-ink">
          {label}
          {info}
        </label>
        {typing === null ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setTyping(formatDecimalInput(value, figures))}
            aria-label={t.slider.typeExact({ label })}
            className="min-h-11 shrink-0 whitespace-nowrap rounded-md px-1 text-[1.75rem] font-extrabold tabular-nums leading-none text-ink underline decoration-line decoration-dotted underline-offset-[6px] hover:bg-hover-row lg:min-h-8"
          >
            {shown}
          </button>
        ) : (
          <input
            ref={field}
            type="text"
            inputMode="decimal"
            value={typing}
            onChange={(e) => setTyping(e.target.value)}
            onBlur={apply}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
              if (e.key === 'Escape') {
                e.stopPropagation();
                setTyping(null);
              }
            }}
            aria-label={t.slider.typeExact({ label })}
            className="h-11 w-40 shrink-0 rounded-md border border-line bg-card px-2 text-right text-base font-bold text-ink [font-size:16px] focus:border-amber"
          />
        )}
      </div>
      <input
        id={`${id}-range`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamp(value)}
        disabled={disabled}
        aria-valuetext={shown}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--fill' as string]: `${fill}%` }}
        className={cn(
          'mt-2 h-[22px] w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed disabled:opacity-40',
          // The track: 6px, the accent up to the thumb and the line's grey after it.
          '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-pill',
          '[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-amber)_var(--fill),var(--color-line)_var(--fill))]',
          '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-pill [&::-moz-range-track]:bg-line',
          '[&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-pill [&::-moz-range-progress]:bg-amber',
          // The thumb: 22px, white with the accent's ring, centred on the track.
          '[&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:h-[22px] [&::-webkit-slider-thumb]:w-[22px]',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px]',
          '[&::-webkit-slider-thumb]:border-amber [&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:shadow',
          '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-amber [&::-moz-range-thumb]:bg-card',
        )}
      />
    </div>
  );
}
