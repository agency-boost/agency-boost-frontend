import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The agents' *Event List*, in words** (P18.98-T4, events, campaigns and the calendar; `functional/events.md`, *The
 * module's own strings*): the page's title and line, the filter, the three sections and their empty lines, a card — its
 * audience line, its pill and *Join* — the event's modal with its RSVP, and a past event's block: the feedback form,
 * the didn't-join block and the thanks; the toasts and the two refusals the screen words itself (`lib/events.ts`).
 *
 * **English is the source**: the prototype's words where it draws them (`Overall.html:3423-3448`, `:8425-8771`), ours
 * where it does not. The Indonesian is the approved glossary's — *Ikut · Belum ikut · Akan datang · Sudah lewat* (§B.3),
 * *Ikut* for *Join* and *Kirim feedback* (§B.1; *Feedback*, not *Masukan*, since UI V1, UI-108) — with what it lacked proposed in the glossary for approval's §B.10.
 * **Kept** (§A): the title, *event* (§A.6, *Event created ✓ → Event dibuat ✓*), *KPM*, *leader*, and the issuer's
 * *{company} Event* (§C5); *RSVP* is written as it is, a loanword. **Typed content stays as typed**: an event's title,
 * blurb, description and place, a type's emoji, the company's name and a member's own answer. **A figure is never a
 * message's**: a date, a time or a score's bound is written by the caller in the figures' language and passed in.
 *
 * @moved lib/events.ts
 * @moved components/events/events-screen.tsx
 * @moved components/events/event-card.tsx
 * @moved components/events/event-modal.tsx
 * @moved components/events/event-feedback.tsx
 * @moved app/(agent)/events/
 */

/** The audience line's issuer, past the company's own name (§C5). */
type Issuer = 'kpm' | 'group';
type Scope = 'all_agents' | 'select_agents' | 'leaders' | 'select_leaders';

const en = {
  /** The page (`:10413`): the nav item's words (§A.2), and its line. */
  title: kept('Event List'),
  sub: 'Browse upcoming and past events from your KPM — join, and share feedback once they wrap up.',
  /** The filter (`:3426-3430`), named for a screen reader. */
  filterLabel: 'Show events',
  filters: { all: 'All', upcoming: 'Upcoming', past: 'Past' },
  /** The three sections (`:3432-3445`) and their empty lines (`:8562-8570`). */
  sections: { going: 'Going', upcoming: 'Upcoming', past: 'Past' },
  emptyGoing: "You haven't joined any upcoming events yet.",
  emptyUpcoming: 'No upcoming events right now.',
  emptyPast: 'No past events yet.',
  /** The modal's corner tag (`:8502-8510`) and the card's foot pill (`:8514-8524`). */
  tags: { going: 'Going', notJoined: 'Not Joined', past: 'Past' },
  pills: {
    going: 'Going', notJoined: 'Not joined', didntJoin: "Didn't join", feedbackSent: 'Feedback sent', feedbackPending: 'Feedback pending',
  },
  viewEvent: 'View event',
  /**
   * **A phone's card** (UI V1, UI-108; `campaign-event-mobile` 2): *Ikut* and *Tidak ikut* both, the group naming its
   * event, and what each tap says.
   */
  notGoing: 'Not going',
  answerName: ({ title }: { title: string }) => `Your answer for ${title}`,
  declined: ({ title }: { title: string }) => `You're not going to ${title}`,
  withdrawn: ({ title }: { title: string }) => `Your answer for ${title} is withdrawn`,
  /** The card's *Join* (P18.95-T10 AC-1), and its name with its event's title. */
  join: 'Join',
  joinName: ({ title }: { title: string }) => `Join ${title}`,
  /** The audience line (`:8532`): *"{issuer} | {scope}"*. The company's issuer is *{company} Event*, kept (§C5). */
  companyEvent: ({ company }: { company: string }) => `${company} ${kept('Event')}`,
  issuers: { kpm: kept('KPM'), group: 'Group event' } satisfies Record<Issuer, string>,
  scopes: {
    all_agents: 'All agents',
    select_agents: 'Select agents',
    leaders: 'Leaders only',
    select_leaders: 'Select leaders',
  } satisfies Record<Scope, string>,
  audience: ({ issuer, scope }: { issuer: string; scope: string }) => `${issuer} | ${scope}`,
  /** The modal (`:8617-8618`). */
  youreGoing: "You're going",
  cancelRsvp: 'Cancel RSVP',
  joinEvent: 'Join event',
  /** The feedback form (`:8656-8673`). The scale's ends carry the served bounds, written by the caller. */
  formQuestion: 'How likely are you to recommend this event to your colleagues?',
  formHint: 'This is the last step for this event — your feedback helps shape future ones.',
  scaleLow: ({ min }: { min: string }) => `${min} — Not at all likely`,
  scaleHigh: ({ max }: { max: string }) => `${max} — Extremely likely`,
  why: 'Why?',
  optional: '(optional)',
  whyPlaceholder: 'What stood out, good or bad?',
  improve: 'How can we improve?',
  improvePlaceholder: 'Any suggestions for next time?',
  submitFeedback: 'Submit feedback',
  /** The didn't-join block (`:8677-8688`) and the thanks (`:8690-8700`). */
  didntJoinTitle: "You didn't join this event",
  didntJoinSub: "Feedback is only collected from agents who attended, so there's nothing to fill out here.",
  claim: 'I actually attended this event',
  thanksTitle: 'Thanks for your feedback',
  /** *"You scored this event {n}/10 — "{why}""* (`:8696`): `why` the member's own words, as typed. */
  scored: ({ score, max, why }: { score: string; max: string; why: string }) =>
    `You scored this event ${score}/${max}${why ? ` — "${why}"` : ''}`,
  /** The toasts (`:8718-8764`). *Joined ✓* before the first is the shared confirmation's (`lib/confirmations.ts`). */
  goingDetail: ({ title }: { title: string }) => `you're going to ${title}`,
  cancelled: ({ title }: { title: string }) => `RSVP cancelled for ${title}`,
  pickScore: ({ min, max }: { min: string; max: string }) => `Pick a score from ${min}–${max} first`,
  feedbackSubmitted: 'Feedback submitted — thank you!',
  claimed: 'Marked as attended — you can now leave feedback',
  /** Our own (L-01): the states the prototype has none of, the ✕'s name and the not-found state. */
  closeModal: 'Close',
  loadingList: 'Loading events…',
  loadingEvent: 'Loading the event…',
  tryAgain: 'Try again',
  notFound: 'This event isn’t one you can open.',
  notFoundHint: 'It may have been archived, or it isn’t one you were invited to.',
  backToEvents: 'Back to events',
  opensInNewTab: 'opens in a new tab',
  /** The two refusals the screen words itself (`functional/events.md`); any other is the server's sentence. */
  refusals: {
    EVENT_RSVP_CLOSED: 'This event has already ended.',
    EVENT_NOT_ENDED: 'This event hasn’t ended yet.',
  },
};

const id: MessagesOf<typeof en> = {
  title: kept('Event List'),
  sub: `Lihat ${kept('event')} yang akan datang dan yang sudah lewat dari ${kept('KPM')} Anda — ikut, dan berikan ${kept('feedback')} setelah ${kept('event')} selesai.`,
  filterLabel: `Tampilkan ${kept('event')}`,
  filters: { all: 'Semua', upcoming: 'Akan datang', past: 'Sudah lewat' },
  sections: { going: 'Ikut', upcoming: 'Akan datang', past: 'Sudah lewat' },
  emptyGoing: `Anda belum ikut ${kept('event')} yang akan datang.`,
  emptyUpcoming: `Belum ada ${kept('event')} yang akan datang saat ini.`,
  emptyPast: `Belum ada ${kept('event')} yang sudah lewat.`,
  tags: { going: 'Ikut', notJoined: 'Belum ikut', past: 'Sudah lewat' },
  pills: {
    going: 'Ikut', notJoined: 'Belum ikut', didntJoin: 'Tidak ikut', feedbackSent: `${kept('Feedback')} terkirim`, feedbackPending: `${kept('Feedback')} belum dikirim`,
  },
  viewEvent: `Lihat ${kept('event')}`,
  notGoing: 'Tidak ikut',
  answerName: ({ title }) => `Jawaban Anda untuk ${title}`,
  declined: ({ title }) => `Anda tidak ikut ${title}`,
  withdrawn: ({ title }) => `Jawaban Anda untuk ${title} dibatalkan`,
  join: 'Ikut',
  joinName: ({ title }) => `Ikut ${title}`,
  companyEvent: ({ company }) => `${company} ${kept('Event')}`,
  issuers: { kpm: kept('KPM'), group: `${kept('Event')} grup` },
  scopes: {
    all_agents: 'Semua agent',
    select_agents: 'Agent terpilih',
    leaders: `Khusus ${kept('leader')}`,
    select_leaders: `${kept('Leader')} terpilih`,
  },
  audience: ({ issuer, scope }) => `${issuer} | ${scope}`,
  youreGoing: 'Anda ikut',
  cancelRsvp: 'Batalkan RSVP',
  joinEvent: `Ikut ${kept('event')}`,
  formQuestion: `Seberapa besar kemungkinan Anda merekomendasikan ${kept('event')} ini kepada rekan kerja Anda?`,
  formHint: `Ini langkah terakhir untuk ${kept('event')} ini — ${kept('feedback')} Anda membantu membentuk ${kept('event')} berikutnya.`,
  scaleLow: ({ min }) => `${min} — Sama sekali tidak mungkin`,
  scaleHigh: ({ max }) => `${max} — Sangat mungkin`,
  why: 'Mengapa?',
  optional: '(opsional)',
  whyPlaceholder: 'Apa yang paling berkesan, baik atau buruk?',
  improve: 'Apa yang bisa kami perbaiki?',
  improvePlaceholder: 'Ada saran untuk lain kali?',
  submitFeedback: `Kirim ${kept('feedback')}`,
  didntJoinTitle: `Anda tidak ikut ${kept('event')} ini`,
  didntJoinSub: `${kept('Feedback')} hanya dikumpulkan dari agent yang hadir, jadi tidak ada yang perlu diisi di sini.`,
  claim: `Saya sebenarnya hadir di ${kept('event')} ini`,
  thanksTitle: `Terima kasih atas ${kept('feedback')} Anda`,
  scored: ({ score, max, why }) => `Anda memberi skor ${score}/${max} untuk ${kept('event')} ini${why ? ` — "${why}"` : ''}`,
  goingDetail: ({ title }) => `Anda ikut ${title}`,
  cancelled: ({ title }) => `RSVP untuk ${title} dibatalkan`,
  pickScore: ({ min, max }) => `Pilih skor dari ${min}–${max} terlebih dahulu`,
  // No exclamation mark (§B.0 rule 7).
  feedbackSubmitted: `${kept('Feedback')} terkirim — terima kasih.`,
  claimed: `Ditandai hadir — sekarang Anda dapat memberikan ${kept('feedback')}`,
  closeModal: 'Tutup',
  loadingList: `Memuat ${kept('event')}…`,
  loadingEvent: `Memuat detail ${kept('event')}…`,
  tryAgain: 'Coba lagi',
  notFound: `${kept('Event')} ini tidak dapat Anda buka.`,
  notFoundHint: `Mungkin ${kept('event')} ini sudah diarsipkan, atau Anda tidak diundang ke ${kept('event')} ini.`,
  backToEvents: `Kembali ke daftar ${kept('event')}`,
  opensInNewTab: 'terbuka di tab baru',
  refusals: {
    EVENT_RSVP_CLOSED: `${kept('Event')} ini sudah berakhir.`,
    EVENT_NOT_ENDED: `${kept('Event')} ini belum berakhir.`,
  },
};

export const eventsMessages = defineMessages({ en, id });
