'use client';

import type { ReactNode } from 'react';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { uiMessages } from '@/i18n/messages/ui';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';
import { LineIcon } from './line-icon';

/**
 * **A rate set with − and +** (UI V1, UI-016 — Goal Setting's *Appointment to meeting* and *Closing rate*, and the
 * savings mode's *Commission rate*): a grey row, the label on the left, and **round − / + of 44px** around the value,
 * 20px/800. By `step` — 5 points by default — between `min` and `max`, 0–100 by default.
 *
 * Not `Stepper`, the daily activity counter (one welded pill with a typed field), which Activity keeps. Each button is
 * named for what it changes (*Kurangi Closing rate*), held at its bound rather than doing nothing, and the value is
 * a live region, so the new figure is heard after a press.
 */
export function StepperRow({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  format,
  info,
  disabled = false,
  className,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** The value as the reader reads it; a whole percentage, *50%*, when absent. */
  format?: (value: number) => string;
  /** An ⓘ beside the label (*% dari APE yang menjadi penghasilan*, on a phone). */
  info?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const t = useMessages(uiMessages).stepper;
  const figures = useFigureLanguage();
  const write = format ?? ((v: number) => formatPercent(v, {}, figures));
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n * 1000) / 1000)));
  const BUTTON = cn(
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-navy shadow-sm',
    'hover:bg-hover-row active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
  );
  return (
    <div
      role="group"
      aria-label={label}
      data-stepper-row=""
      className={cn('flex min-h-14 items-center gap-2 rounded-row bg-base px-3 py-1.5', className)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1 text-md text-ink">
        {label}
        {info}
      </span>
      <button
        type="button"
        aria-label={t.decrease({ label })}
        disabled={disabled || value <= min}
        onClick={() => set(value - step)}
        className={BUTTON}
      >
        <LineIcon name="minus" />
      </button>
      <output aria-live="polite" className="w-14 text-center text-[1.25rem] font-extrabold tabular-nums text-ink">
        {write(value)}
      </output>
      <button
        type="button"
        aria-label={t.increase({ label })}
        disabled={disabled || value >= max}
        onClick={() => set(value + step)}
        className={BUTTON}
      >
        <LineIcon name="plus" />
      </button>
    </div>
  );
}
