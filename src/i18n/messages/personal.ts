import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import type { Gender, WorkStatus } from '@/lib/personal';

/**
 * **What a person records, as a screen prints it** (P18.98-T4, coaching and unit; ADR-0158, P18.8-T4): the gender and
 * the work status by their codes' labels, and *Not recorded* for one somebody has not given — `lib/personal.ts`' words,
 * which a member's page, `/profile` and `/register` show.
 *
 * **English is the source** (as built). The Indonesian is the approved glossary's §B.3 *Belum dicatat*, with the
 * import's *penuh/paruh waktu* (§B.10) and *Laki-laki · Perempuan* for approval in §B.10. The birth date and the join
 * month are figures, written by `personalLines` in the figures' language.
 *
 * @moved lib/personal.ts
 */
const en = {
  gender: { male: 'Male', female: 'Female' } satisfies Record<Gender, string>,
  workStatus: { full_time: 'Full-time', part_time: 'Part-time' } satisfies Record<WorkStatus, string>,
  notRecorded: 'Not recorded',
};

const id: MessagesOf<typeof en> = {
  gender: { male: 'Laki-laki', female: 'Perempuan' },
  workStatus: { full_time: 'Penuh waktu', part_time: 'Paruh waktu' },
  notRecorded: 'Belum dicatat',
};

export const personalMessages = defineMessages({ en, id });
