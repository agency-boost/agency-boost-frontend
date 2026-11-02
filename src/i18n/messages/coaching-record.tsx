import type { ReactNode } from 'react';
import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The record after the meeting** (P18.98-T4, coaching and unit; `functional/coaching.md`, *Archive*, *`/coaching/me`*,
 * *The module's own strings*): a past session's archive and the reader's own coaching — the record's header, the
 * history behind *View past sessions ▾*, the earlier versions with who reopened them and why, the states a record can
 * be in, and *Sessions you led*. What a session agreed — last week's items, the tips, the next actions — and the cards
 * the record shares with the workspace are `coaching-session.tsx`'s, which it reads too.
 *
 * **English is the source**: the prototype's words where it draws them (`Overall.html:4384-4600`, `:4453-4460`) and
 * ours where it only promised the screen (parity L-04), none of ADR-0084's six words in either language. The Indonesian
 * is the approved glossary's (OD-237; §B.0), with *Difinalkan*, *Dibuka kembali* and *Di-coaching oleh* for approval in
 * §B.10. **Kept** (§A): *Coaching Session*, *coaching*. **Content stays as typed**: names, the reason a session was
 * reopened. **A figure is never a message's**: a day is written by the caller in the figures' language — `day` a node
 * where it is drawn bold.
 *
 * @moved components/coaching-record.tsx
 */
const en = {
  /** The record's header (`.session-header-card`, `Overall.html:4453-4460`): `day` the session's own, drawn bold. */
  session: ({ day }: { day: ReactNode }) => <>{'Session — '}{day}</>,
  finalized: 'Finalized',
  /** *Coached by {leader}* (`:4458`, `:11373`). */
  coachedBy: ({ name }: { name: string }) => `Coached by ${name}`,
  /** An earlier version (ADR-0079): `day` written by the caller, `name` empty where the server could give none. */
  finalizedOn: ({ day, name }: { day: string; name: string }) => `Finalized ${day}${name ? ` by ${name}` : ''}`,
  reopenedOn: ({ day, name }: { day: string; name: string }) => `Reopened ${day}${name ? ` by ${name}` : ''}`,
  /** The reason, as its writer typed it. */
  reason: ({ reason }: { reason: string }) => `Reason: ${reason}`,
  agreed: { show: 'View what it agreed', hide: 'Hide what it agreed' },
  earlier: 'Earlier versions',
  /** A draft's address (P11-T10): not a record yet. */
  notFinalized: 'This session hasn’t been finalized yet.',
  notFinalizedLine: 'Until it is, it is open on Coaching Session.',
  sessionTab: kept('Coaching Session'),
  /** Not found (L-01): one sentence for every reason. */
  notOpen: 'This session isn’t one you can open.',
  notOpenLine: ({ leads }: { leads: boolean }) =>
    `The address may be mistyped.${leads ? ' Everyone you coach is on Coaching Session.' : ''}`,
  /** `/coaching/me`. */
  reading: 'Reading your coaching…',
  none: 'No coaching sessions yet.',
  youLed: 'Sessions you led',
};

const id: MessagesOf<typeof en> = {
  session: ({ day }) => <>{'Sesi — '}{day}</>,
  finalized: 'Final',
  coachedBy: ({ name }) => `Di-${kept('coaching')} oleh ${name}`,
  finalizedOn: ({ day, name }) => `Difinalkan ${day}${name ? ` oleh ${name}` : ''}`,
  reopenedOn: ({ day, name }) => `Dibuka kembali ${day}${name ? ` oleh ${name}` : ''}`,
  reason: ({ reason }) => `Alasan: ${reason}`,
  agreed: { show: 'Lihat yang disepakati', hide: 'Sembunyikan yang disepakati' },
  earlier: 'Versi sebelumnya',
  notFinalized: 'Sesi ini belum difinalkan.',
  notFinalizedLine: `Sampai difinalkan, sesi ini terbuka di ${kept('Coaching Session')}.`,
  sessionTab: kept('Coaching Session'),
  notOpen: 'Anda tidak dapat membuka sesi ini.',
  notOpenLine: ({ leads }) =>
    `Mungkin alamatnya salah ketik.${leads ? ` Semua orang yang Anda ${kept('coaching')} ada di ${kept('Coaching Session')}.` : ''}`,
  reading: `Memuat ${kept('coaching')} Anda…`,
  none: `Belum ada sesi ${kept('coaching')}.`,
  youLed: 'Sesi yang Anda pimpin',
};

export const coachingRecordMessages = defineMessages({ en, id });
