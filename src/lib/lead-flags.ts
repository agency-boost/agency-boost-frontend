import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { leadFlagMessages } from '@/i18n/messages/lead-flags';

/*
 * **A lead's attention flags** (`leads-management.md` §4): apart from the leads' client (`leads.ts`, which re-exports
 * these) because Personal Summary draws a flag on each of its leads and nothing else of Leads Management (the bundle,
 * 2026-11-06; `performance-and-scale.md`).
 */

/** Derived on read, never stored — a stored flag is one that is wrong at midnight. */
export type LeadFlag = 'overdue' | 'no-next-action' | 'no-remarks';

/** The flags' words in English, the catalogue's source (`messages/lead-flags.ts`). */
const EN = leadFlagMessages.en;

/**
 * What each attention flag is called on screen, **in English**: one place, so two screens cannot disagree. A screen
 * reads it in the reader's language through `flagLabel(flag, overdueDays, language)` (P18.10-T4).
 */
export const FLAG_LABEL: Record<LeadFlag, string> = {
  overdue: EN.overdue,
  'no-next-action': EN.noNextAction,
  'no-remarks': EN.noRemarks,
};

/**
 * What a flag reads as on a row — *Overdue 14 days* rather than *Overdue*, as the prototype has
 * it (`leads-management.md` §4).
 *
 * **The count comes from the server, not from the browser's clock.** `overdueDays` is whole
 * calendar days in the **office's** timezone; a screen subtracting two dates itself would be
 * wrong for anybody whose device is in another zone, which is the defect the whole day-boundary
 * rule exists to stop (invariant §9).
 *
 * In the reader's words' `language` (P18.10-T4), English when none is passed: *Terlambat 14 hari*.
 */
export const flagLabel = (flag: LeadFlag, overdueDays: number | null, language: Language = SOURCE_LANGUAGE): string => {
  const t = messagesIn(leadFlagMessages, language);
  if (flag === 'overdue') return overdueDays === null ? t.overdue : t.overdueDays({ days: overdueDays });
  return flag === 'no-next-action' ? t.noNextAction : t.noRemarks;
};
