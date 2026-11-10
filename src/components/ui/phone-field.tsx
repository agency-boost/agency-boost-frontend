'use client';

import type { Ref } from 'react';
import { useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { cn } from '@/lib/cn';
import { PHONE_COUNTRY_PREFIX, PHONE_NATIONAL_DIGITS } from '@/lib/phone-number';

/**
 * **A WhatsApp number's field: a fixed *+62*, then the number** (UI V1, UI-081; D-22) — *Isi nomor WhatsApp*'s field,
 * and since P19.11-T3 AC-5 the lead sheet's *Detail → WhatsApp* too (UX-10: *fixed +62 prefix + number*). One field, so
 * the two never read a number differently.
 *
 * `inputmode="tel"`; the `+62` is drawn, never typed, and hidden from a screen reader (the label names the field). What
 * was typed is the caller's to read (`nationalDigits`, `normalisedPhone`); `invalid` draws the field's own error under
 * it — *Isi 9 sampai 13 digit setelah +62* — named as the input's description. The caller writes the label, `htmlFor`
 * this `id`.
 *
 * - `box`: *Isi nomor WhatsApp*'s white 48px box, the prefix in its own cell.
 * - `pill`: the lead sheet's grey pill, as its other fields are.
 */
export function PhoneField({
  id,
  value,
  onChange,
  invalid = false,
  inputRef,
  look = 'box',
}: {
  id: string;
  /** What is typed after the `+62`: `phoneFieldValue` of a saved number. */
  value: string;
  onChange: (typed: string) => void;
  invalid?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  look?: 'box' | 'pill';
}) {
  const t = useMessages(uiV1Messages);
  const errorId = `${id}-error`;
  const pill = look === 'pill';
  return (
    <>
      <div
        data-phone-field=""
        className={cn(
          'flex items-center overflow-hidden focus-within:ring-2 focus-within:ring-focus-ring',
          pill
            ? cn('min-h-12 rounded-pill border-[1.5px] bg-hover-row', invalid ? 'border-alert' : 'border-transparent')
            : cn('h-12 rounded-md border bg-card focus-within:border-primary', invalid ? 'border-alert' : 'border-line'),
        )}
      >
        <span
          aria-hidden="true"
          className={pill
            ? 'flex h-full items-center pl-4 pr-1.5 text-md font-semibold text-muted'
            : 'flex h-full items-center border-r border-line bg-base px-3 text-[1rem] font-semibold text-muted'}
        >
          {PHONE_COUNTRY_PREFIX}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          // The ring is the box's (`focus-within`), so the input draws none of its own.
          className={pill
            ? 'h-full min-h-12 min-w-0 flex-1 bg-transparent pr-4 text-md text-ink outline-none focus-visible:outline-none'
            : 'h-full min-w-0 flex-1 bg-transparent px-3 text-[1rem] text-ink outline-none focus-visible:outline-none'}
        />
      </div>
      {invalid && (
        <p id={errorId} className={pill ? 'mt-1 text-sm text-signal-red' : 'mt-1.5 text-base text-alert'}>
          {t.contact.invalid(PHONE_NATIONAL_DIGITS)}
        </p>
      )}
    </>
  );
}
