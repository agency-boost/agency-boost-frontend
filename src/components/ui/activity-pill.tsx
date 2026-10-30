'use client';

import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

/**
 * **The daily activity pill** (UI V1, UI-059 and UI-101; D-22): somebody's activity count for one day — an orange
 * *n aktivitas* when they logged, a grey *Belum lapor* when they did not. The same pill, and the same count, on the
 * Group Tree's rows and its *Hari ini* column and in Home's *Laporan tim* for *Kmrn* and *Hari ini*.
 *
 * - **The count is the server's**, one per person per Asia/Jakarta day, the same as Activity Management (O-5). `null`
 *   or `0` is *Belum lapor*: a day nobody reported is not a day of zero activities to them.
 * - **Navy words on the accent** (5.9:1), not the mockups' white (2.38:1, under AA's 4.5:1 at 12px) — the house's
 *   amber-with-navy (`field.tsx`'s primary button). Registered in `prototype-parity.md`.
 * - **`count`** writes the number alone (*5*), for a table cell whose header already says what it counts (Home's
 *   *Kmrn* / *Hari ini*); **`stacked`** breaks *Belum lapor* onto two lines there (12px), so the column stays 52px.
 * - **`onTint`**: on an orange-tinted or grey row, the grey pill is white, so it still reads as a pill.
 */
export function ActivityPill({
  count,
  short = false,
  stacked = false,
  onTint = false,
  className,
}: {
  count: number | null | undefined;
  /** The number alone, for a cell under a header that names the day. */
  short?: boolean;
  /** *Belum* over *lapor*, in a narrow cell. */
  stacked?: boolean;
  /** The row behind it is tinted: the grey pill is white there. */
  onTint?: boolean;
  className?: string;
}) {
  const t = useMessages(uiV1Messages);
  const figures = useFigureLanguage();
  const logged = typeof count === 'number' && count > 0;
  if (logged) {
    return (
      <span
        data-logged="true"
        aria-label={short ? t.activities({ count }) : undefined}
        className={cn(
          'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-pill bg-amber px-2.5 py-0.5 text-xs font-bold leading-5 text-navy',
          short && 'min-w-8',
          className,
        )}
      >
        {short ? formatNumber(count, {}, figures) : t.activities({ count })}
      </span>
    );
  }
  return (
    <span
      data-logged="false"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-pill px-2.5 py-0.5 text-xs font-semibold leading-tight text-muted',
        onTint ? 'bg-card' : 'bg-base',
        stacked ? 'max-w-[3.25rem] whitespace-normal text-center' : 'whitespace-nowrap',
        className,
      )}
    >
      {t.notReported}
    </span>
  );
}
