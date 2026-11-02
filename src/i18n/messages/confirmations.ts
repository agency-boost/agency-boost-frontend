import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The confirmations every screen toasts** (`lib/confirmations.ts`; P18.95-T1 AC-6, ADR-0167 §5, OD-200; P18.98-T4,
 * the shared pieces): *Activity logged ✓*, *Link copied ✓* and the rest, through the shell's toast.
 *
 * **English is the source**, byte for byte `CONFIRMED` as it was, which stays the catalogue's English for a caller
 * whose module has not moved yet. The Indonesian is the approved glossary's §B.2, word for word; *Goal*, *Event* and
 * *Agent* kept (§A.5, §A.6). A screen reads them at render — `const confirmed = useMessages(confirmationMessages)` —
 * and toasts `confirmed.activityLogged` from its handler. A sentence the screen adds after the dash (`withDetail`) is
 * the screen's own, in the same language.
 *
 * @moved lib/confirmations.ts
 */
const en = {
  activityLogged: 'Activity logged ✓',
  goalSaved: 'Goal saved ✓',
  linkCopied: 'Link copied ✓',
  codeCopied: 'Code copied ✓',
  requestSent: 'Request sent ✓',
  eventCreated: 'Event created ✓',
  sessionStarted: 'Session started ✓',
  joined: 'Joined ✓',
  agentAdded: 'Agent added ✓',
  inviteCreated: 'Invite ready ✓',
  transferRequested: 'Transfer requested ✓',
  inviteResent: 'New link ready ✓',
  inviteCancelled: 'Invite cancelled ✓',
  requestApproved: 'Request approved ✓',
  /** UI V1 (UI-090): the invite share block's copy, of the link or the code — the report's *Tersalin ✓*. */
  copied: 'Copied ✓',
};

const id: MessagesOf<typeof en> = {
  activityLogged: 'Aktivitas tercatat ✓',
  goalSaved: `${kept('Goal')} tersimpan ✓`,
  linkCopied: 'Tautan disalin ✓',
  codeCopied: 'Kode disalin ✓',
  requestSent: 'Permintaan terkirim ✓',
  eventCreated: `${kept('Event')} dibuat ✓`,
  sessionStarted: 'Sesi dimulai ✓',
  joined: 'Berhasil bergabung ✓',
  agentAdded: `${kept('Agent')} ditambahkan ✓`,
  inviteCreated: 'Undangan siap ✓',
  transferRequested: 'Pemindahan diajukan ✓',
  inviteResent: 'Tautan baru siap ✓',
  inviteCancelled: 'Undangan dibatalkan ✓',
  requestApproved: 'Permintaan disetujui ✓',
  copied: 'Tersalin ✓',
};

export const confirmationMessages = defineMessages({ en, id });
