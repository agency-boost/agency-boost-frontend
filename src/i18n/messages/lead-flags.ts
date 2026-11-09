import { defineMessages, type MessagesOf } from '@/i18n/catalogue';

/**
 * **A lead's attention flags, in words** (P18.10-T4; `functional/leads.md`): what each flag is called on a row —
 * Leads Management's, the coaching session's *Leads* card and Personal Summary's *Leads that need you* — through
 * `lib/lead-flags.ts`' `flagLabel`, one place so that no two screens disagree. An area of its own since 2026-11-06 (the
 * bundle; `performance-and-scale.md`): it was `leads.tsx`'s, and Personal Summary loaded all of that for three words.
 *
 * The words are unchanged: English the source, the Indonesian the approved glossary's (OD-237).
 *
 * @moved lib/lead-flags.ts
 */
const en = {
  overdue: 'Overdue',
  noNextAction: 'No next action',
  noRemarks: 'No remarks',
  /** *Overdue 14 days* (`leads-management.md` §4): the server's count, in the office's days. */
  overdueDays: ({ days }: { days: number }) => `Overdue ${days} ${days === 1 ? 'day' : 'days'}`,
};

const id: MessagesOf<typeof en> = {
  overdue: 'Terlambat',
  noNextAction: 'Tanpa tindakan berikutnya',
  noRemarks: 'Tanpa keterangan',
  overdueDays: ({ days }) => `Terlambat ${days} hari`,
};

export const leadFlagMessages = defineMessages({ en, id });
