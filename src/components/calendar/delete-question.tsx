'use client';

import { Dialog } from '@/components/ui/dialog';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import { titleOf, type CalendarEntry } from '@/lib/calendar';
import { formatWeekdayDay } from '@/lib/format';

/**
 * ***Hapus* asks first** (P19.8-T3 AC-7; MOB UI-169, ADR-0228 §5; the 7 November mockups' `confirmDel()`): ***Hapus
 * event ini?***, bold, and under it in grey the entry's title and its day — *Kickoff 2026 · Rabu, 11 Nov 2026*, the
 * first day of a trip — then ***Batal*** · ***Hapus***, side by side at equal width, *Hapus* filled red. *Batal* goes
 * back to what asked. One question for the detail (over the Calendar and over Home) and for *Edit event*.
 */
export function DeleteQuestion({
  open,
  entry,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  entry: CalendarEntry;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useMessages(calendarMessages);
  const words = useLanguage();
  const figures = useFigureLanguage();
  const day = entry.date ?? entry.startsOn ?? '';
  return (
    <Dialog
      open={open}
      message={t.deleteQuestion}
      detail={t.deleteWhat({ title: titleOf(entry, words), day: day ? formatWeekdayDay(day, figures) : '' })}
      confirmLabel={t.delete}
      cancelLabel={t.cancel}
      tone="dangerFill"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
