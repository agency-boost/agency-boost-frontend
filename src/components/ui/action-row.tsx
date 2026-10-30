'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { cn } from '@/lib/cn';
import { dayInZone, formatShortDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { DateField } from './date-field';
import { LineIcon } from './line-icon';

/**
 * What sits at the right of an action row (UI-061): a 20px checkbox (*Tindakan minggu lalu*), a ✕ (an action the
 * leader added), or — for an action that belongs to a lead — a link icon and a ›, to change it in the lead.
 */
export type ActionRowControl =
  | { kind: 'check'; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }
  | { kind: 'remove'; onRemove: () => void; disabled?: boolean }
  | { kind: 'lead'; name: string; href?: string; onOpen?: () => void }
  | { kind: 'none' };

/**
 * `30 Okt`, and `30 Okt 2025` only when it is not this year (UI-061: *one date format*), in the office's zone.
 */
export function actionDay(day: string, language: Language, today = dayInZone(OFFICE_TIME_ZONE, new Date())): string {
  return formatShortDay(day, { year: day.slice(0, 4) !== today.slice(0, 4) }, language);
}

/**
 * **The compact action row, one style for every action** (UI V1, UI-061 — the Coaching Session's *Tindakan minggu
 * lalu*, *Dari leads* and *Lainnya*). At least 40px, 8px above and below, a divider between rows (the list's, `divide-y
 * divide-divider`).
 *
 * - **The date**, plain text 13px/600 in a 48px column, no pill. **Editable** when `onDateChange` is given: a dotted
 *   underline, and a tap opens the device's date picker (a 16px field, so iOS does not zoom).
 * - **The action**, 14px, wrapping as far as it needs and never cut, followed on the same line by the lead in 12px grey
 *   after a small person icon — no chip, no second line.
 * - **The control** on the right: a 20px checkbox, a ✕, or a lead's link icon and ›. Each a 44px target on a phone.
 * - **`auto`** (an `AutoMarker`) sits before the text where the action completes itself (D-25).
 * - **`invalid`** (UI-060): a row *Finalkan* refused for its missing date — tinted red, the date's prompt
 *   (`emptyText`, *Pilih tanggal*) in red with a red underline, the picker `aria-invalid`.
 * - **`editor`** stands in the text's place where the words are typed — the Coaching Session's *Lainnya* — a box that
 *   wraps as the words do, never cut; `text` still names the row's controls. *(Both added by Phase 18.99 T8.)*
 */
export function ActionRow({
  date,
  onDateChange,
  minDate,
  text,
  person,
  auto,
  control = { kind: 'none' },
  invalid = false,
  emptyText,
  editor,
  className,
}: {
  /** `YYYY-MM-DD`, or `null` for an action with no date yet (the column is blank, or the picker's prompt). */
  date: string | null;
  onDateChange?: (day: string) => void;
  minDate?: string;
  /** The action as written: plain words, so it can name the controls. */
  text: string;
  /** The lead's name, after the text. */
  person?: string;
  /** The ⚡ marker, before the text. */
  auto?: ReactNode;
  control?: ActionRowControl;
  /** *Finalkan* refused this row for its missing date (UI-060). */
  invalid?: boolean;
  /** What an undated, editable date says: *Pilih tanggal*. A dash when absent. */
  emptyText?: string;
  /** The box the words are typed in, in the text's place. */
  editor?: ReactNode;
  className?: string;
}) {
  const t = useMessages(uiV1Messages);
  const figures = useFigureLanguage();
  const shown = date ? actionDay(date, figures) : '';
  const done = control.kind === 'check' && control.checked;

  return (
    <div
      data-action-row=""
      data-invalid={invalid || undefined}
      className={cn('flex min-h-10 items-start gap-2.5 py-2', invalid && '-mx-3.5 bg-pill-red px-3.5', className)}
    >
      <div className="w-12 shrink-0 pt-px text-base font-semibold text-navy">
        {onDateChange ? (
          <DateField
            value={date}
            min={minDate}
            onChange={(day) => { if (day) onDateChange(day); }}
            aria-label={t.action.changeDate({ text })}
            density="text"
            glyph="none"
            emptyText={emptyText ?? '—'}
            invalid={invalid}
            format={(day, language) => actionDay(day, language)}
            faceClassName={cn(
              'text-base font-semibold max-md:text-base',
              // The prompt's own span is muted by default: red over it, and a red underline (UI-060).
              invalid && 'text-pill-red-ink decoration-signal-red decoration-solid decoration-[1.5px] [&>span]:text-pill-red-ink',
            )}
          />
        ) : (
          <span>{shown}</span>
        )}
      </div>
      {editor ? <div className="min-w-0 flex-1">{editor}</div> : (
      <p className={cn('min-w-0 flex-1 break-words text-md text-ink', done && 'text-muted line-through')}>
        {auto && <span className="mr-1 inline-flex align-[-3px]">{auto}</span>}
        {text}
        {person && (
          <span className="ml-1.5 inline-flex items-baseline gap-1 text-sm text-signal-grey no-underline">
            <LineIcon name="user" className="h-3.5 w-3.5 self-center" />
            {person}
          </span>
        )}
      </p>
      )}
      <Control control={control} text={text} />
    </div>
  );
}

function Control({ control, text }: { control: ActionRowControl; text: string }) {
  const t = useMessages(uiV1Messages);
  const TAP = 'relative -my-2.5 -mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center lg:h-8 lg:w-8 lg:-my-1.5 lg:mr-0';
  switch (control.kind) {
    case 'check':
      return (
        <label className={cn(TAP, 'cursor-pointer')}>
          <input
            type="checkbox"
            checked={control.checked}
            disabled={control.disabled}
            onChange={(e) => control.onChange(e.target.checked)}
            aria-label={t.action.done({ text })}
            className="h-5 w-5 cursor-pointer accent-navy"
          />
        </label>
      );
    case 'remove':
      return (
        <button
          type="button"
          onClick={control.onRemove}
          disabled={control.disabled}
          aria-label={t.action.remove({ text })}
          className={cn(TAP, 'rounded-pill text-signal-grey hover:bg-hover-row hover:text-navy disabled:opacity-40')}
        >
          <LineIcon name="close" className="h-4 w-4" />
        </button>
      );
    case 'lead': {
      const body = (
        <>
          <LineIcon name="link" className="h-4 w-4" />
          <LineIcon name="chevronRight" className="h-4 w-4" />
        </>
      );
      const cls = cn(TAP, 'w-auto gap-0.5 rounded-pill px-1 text-signal-grey hover:text-navy lg:w-auto');
      return control.href !== undefined
        ? <Link href={control.href} aria-label={t.action.openLead({ name: control.name })} className={cls}>{body}</Link>
        : <button type="button" onClick={control.onOpen} aria-label={t.action.openLead({ name: control.name })} className={cls}>{body}</button>;
    }
    default:
      return null;
  }
}
