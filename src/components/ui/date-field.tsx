'use client';

import { useRef } from 'react';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { uiMessages } from '@/i18n/messages/ui';
import { cn } from '@/lib/cn';
import { formatCalendarDay } from '@/lib/format';
import { NavIcon } from './nav-icon';

/** A date the face may print: four digits of year from 1000 on, as a browser's field sends a whole one. */
const WHOLE_DATE = /^[1-9]\d{3}-\d{2}-\d{2}$/;

/**
 * What an empty field says, in the face's place of a date (P18.96-T2; parity I-455): the catalogue's English, which the
 * field writes in the reader's language (`uiMessages.chooseDate`, P18.98-T4).
 */
export const DATE_FIELD_EMPTY = uiMessages.en.chooseDate;

/**
 * How much room the field takes — `TextInput`'s two densities, and the activation's 34px row control.
 *
 * `default` is a form field, 40px. `compact` is the 34px control the activation pages draw beside their headings
 * (`Overall.html:3284-3286`). `cell` is a table cell you can change: transparent until it is hovered or focused, as
 * `TextInput`'s `cell` is (`components-and-patterns.md`, the data table).
 */
export type DateFieldDensity = 'default' | 'compact' | 'cell';

/*
 * A minimum, not a height: the face stretches to the wrapper, so a caller's taller box — the leads sheet's 44px on a
 * phone (`TAP_HEIGHT`) — is the face's too.
 */
const FACE: Record<DateFieldDensity, string> = {
  default: 'min-h-10 gap-2 rounded-md border px-3',
  compact: 'min-h-[34px] gap-2 rounded-md border-[1.5px] px-3',
  // A table column is narrow: the glyph and the edges sit closer, so *17 Okt 2026* fits the leads table's 105px whole.
  cell: 'w-full gap-1 rounded-sm border px-1 py-[3px] leading-tight',
};

/** At rest, and while the field underneath it has the focus — the native ring is drawn on the face, not the field. */
const REST: Record<DateFieldDensity, string> = {
  default: 'border-hairline bg-card',
  compact: 'border-hairline bg-card',
  cell: 'border-transparent bg-transparent peer-hover:border-hairline peer-focus:border-amber peer-focus:bg-card peer-focus:ring-1 peer-focus:ring-amber',
};

export interface DateFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'size' | 'placeholder'> {
  /** An office date, `YYYY-MM-DD`, or empty. */
  value: string | null | undefined;
  /** The date chosen, `YYYY-MM-DD` — or `''` when the picker's *Clear* empties it. */
  onChange: (next: string) => void;
  invalid?: boolean;
  density?: DateFieldDensity;
  /** Where the calendar glyph sits: after the date, as a browser draws it, or before it (the leads table's). */
  glyph?: 'end' | 'start';
  /** What an empty field shows. A form's says *Choose a date*; a table cell's, by default, nothing. */
  emptyText?: string;
  /** On the wrapper, which the field and its face fill: a width, a margin, a taller box on a phone. */
  className?: string;
}

/**
 * **One date field, written the app's way** (P18.96-T2 AC-4, ADR-0173 D12; UI-009; parity I-455).
 *
 * A native `<input type="date">` writes its value **in the browser's locale** — *07/22/2026* in an American
 * Chrome, *22/07/2026* in a British one — beside screens that write *22 Jul 2026* (ADR-0167 §1). So the field shows
 * the date through the app's formatter (`formatCalendarDay`), in a face shaped like `TextInput`, and the device's
 * own picker does the choosing: the native input lies over the face, transparent, and a click or a tap on it opens
 * the picker with `showPicker()` — or natively, on a phone and in any browser without it.
 *
 * **The native input is the control**, so nothing a reader relies on moves:
 *
 * - **the label is its own** — `<label htmlFor={id}>`, a `Field`, an `aria-label` — and so is what a screen reader
 *   announces, the value included; the face is `aria-hidden`, a picture of the value;
 * - **it is in the tab order**, and its focus ring is drawn on the face (`peer-focus-visible`), the amber one;
 *   **Enter, Space or Alt+↓ open the picker**, and digits still type a date where a browser lets them;
 * - **`min` and `max` are the input's**, so the picker greys out what may not be chosen, and the value arrives as
 *   `YYYY-MM-DD`, an office date, through `onChange` — never parsed as an instant (invariant §9).
 *
 * The face is 16px on a phone, as every field's text is there (UI-014; `globals.css`), so the two read alike.
 */
export function DateField({
  value,
  onChange,
  invalid,
  density = 'default',
  glyph = 'end',
  emptyText,
  className,
  disabled,
  readOnly,
  onClick,
  onKeyDown,
  ...input
}: DateFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  // The face in the figures' language, *5 Okt 2026* or *5 Oct 2026* — Indonesian for a reader with no choice
  // (P18.98-T3, `useFigureLanguage`); the value stays ISO.
  const language = useFigureLanguage();
  const t = useMessages(uiMessages);
  // A year still being typed digit by digit (`0002-08-01`) is not a date yet: the face waits for a whole one.
  const shown = value && WHOLE_DATE.test(value) ? formatCalendarDay(value, language) : '';
  const empty = emptyText ?? (density === 'cell' ? '' : t.chooseDate);
  const inert = Boolean(disabled || readOnly);

  /** The device's picker. A browser without `showPicker`, or one refusing it here, keeps the focus in the field. */
  const openPicker = () => {
    const field = ref.current;
    if (!field || inert) return;
    try {
      field.showPicker();
    } catch {
      // No picker to show here (jsdom, an older browser, a frame that may not): the focused field takes digits.
      field.focus();
    }
  };

  const icon = (
    <NavIcon name="calendar" className={cn('h-3.5 w-3.5 shrink-0', inert ? 'text-muted/60' : 'text-muted')} />
  );

  return (
    <span className={cn('relative inline-flex min-w-0 align-middle', className)}>
      <input
        {...input}
        ref={ref}
        type="date"
        value={value ?? ''}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) openPicker();
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === 'Enter' || e.key === ' ' || (e.altKey && e.key === 'ArrowDown')) {
            e.preventDefault();
            openPicker();
          }
        }}
        className={cn(
          // Over the face, the size of it, and transparent: what is clicked and focused is the real field.
          'peer absolute inset-0 z-[1] h-full w-full appearance-none opacity-0',
          inert ? 'cursor-default' : 'cursor-pointer',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex w-full min-w-0 items-center text-base text-navy max-md:text-lg',
          FACE[density],
          REST[density],
          invalid && 'border-alert',
          (disabled || (readOnly && density !== 'cell')) && 'bg-base text-muted',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-amber',
        )}
      >
        {glyph === 'start' && icon}
        <span className={cn('min-w-0 flex-1 truncate whitespace-nowrap', !shown && 'text-muted')}>{shown || empty}</span>
        {glyph === 'end' && icon}
      </span>
    </span>
  );
}
