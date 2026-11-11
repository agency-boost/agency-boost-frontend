'use client';

import { useId } from 'react';
import { Field } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { useMessages } from '@/i18n/language-provider';
import { accountMessages } from '@/i18n/messages/account';
import { cn } from '@/lib/cn';

/**
 * **The fields a person's own details are typed in** — *Profil saya*'s (UI V1, UI-111), and since P19.12-T5 the member
 * page's *Lengkapi data* (ADR-0248 §3), so the office fills a blank in the same control the person changes it in.
 * Moved here from `app/profile/page.tsx`, unchanged; `touch` (the member page's sheet) makes each a 44px target below
 * 1024px (UI-142), which the profile does not ask of them.
 */

/** `1995-03-18` as *18 / 03 / 1995*; `2020-09` as *09 / 2020* (UI-111: the dates as sign-up shows them). */
export const dayShape = (day: string) => {
  const [y, m, d] = day.split('-');
  return `${d} / ${m} / ${y}`;
};
export const monthShape = (month: string) => {
  const [y, m] = month.split('-');
  return y && m ? `${m} / ${y}` : '';
};

/** Two or three choices as one segmented control, a radio group (*Laki-laki | Perempuan*). */
export function ChoiceSegments<T extends string>({
  label, options, value, onChange, disabled = false, error, touch = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (value: T) => void;
  disabled?: boolean;
  error?: string;
  /** Each choice 44px tall below 1024px (UI-142). */
  touch?: boolean;
}) {
  const labelId = useId();
  const move = (from: number, by: number) => onChange(options[(from + by + options.length) % options.length].value);
  return (
    <div>
      <p id={labelId} className="mb-1 text-sm font-semibold text-muted">{label}</p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex min-h-11 rounded-pill bg-hover-row p-[3px]">
        {options.map((option, i) => {
          const on = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              tabIndex={on || (value === '' && i === 0) ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(i, 1);
                else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(i, -1);
                else return;
                e.preventDefault();
              }}
              className={cn(
                'flex flex-1 items-center justify-center rounded-pill px-2 text-base font-semibold disabled:cursor-not-allowed',
                touch && 'max-lg:min-h-11',
                on ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-1 text-sm text-alert">{error}</p>}
    </div>
  );
}

/** *Bergabung di perusahaan asuransi Anda*: *09 / 2020*, the device's month picker on tap. */
export function MonthShapeField({
  id, label, value, onChange, disabled, error, touch = false,
}: {
  id: string; label: string; value: string; onChange: (value: string) => void; disabled?: boolean; error?: string;
  /** 48px tall below 1024px, not only below 768px (UI-142). */
  touch?: boolean;
}) {
  const t = useMessages(accountMessages).v1;
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className={cn(
        'relative flex min-h-12 items-center justify-between rounded-md border bg-card px-2.5 text-md',
        touch ? 'lg:min-h-10' : 'md:min-h-10',
        error ? 'border-alert' : 'border-line',
        disabled && 'bg-base text-muted',
      )}>
        <span aria-hidden="true" className={value ? 'text-ink' : 'text-signal-grey'}>{monthShape(value) || t.monthShape}</span>
        <span aria-hidden="true" className="text-muted"><LineIcon name="calendarPlus" className="h-[18px] w-[18px]" /></span>
        <input
          id={id}
          type="month"
          value={value}
          disabled={disabled}
          aria-label={t.pickMonth({ label })}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => {
            try { e.currentTarget.showPicker?.(); } catch { /* the focus stays in the field */ }
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </div>
    </Field>
  );
}
