import { defineMessages, type MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';

/**
 * **The office's side of its events, in words** (P18.98-T4, events, campaigns and the calendar; `functional/events.md`,
 * *The module's own strings*): what *View feedback* opens on a past row of Settings › Events — the roll call, the
 * *Feedback Summary* and the two tabs between them — and the picker *Chosen people* and *Chosen leaders* choose from
 * (`lib/events-admin.ts`). The *Feedback Summary* is also KPM Analytics' (the compliance tree's past event).
 *
 * **English is the source**: the Owner's prototype where it draws them (`KPM_Owner.html:1655`, `:3751-3795`), ours
 * where it does not (D-rollcall, D-picker). The Indonesian is the approved glossary's — *Nama · Peran* (§B.4), *Hadir*
 * (§B.3), *Kehadiran tersimpan.* (§B.2), *Tidak hadir* and *menunggu konfirmasi* (§B.10) — with what it lacked proposed
 * in the glossary for approval's §B.10 (*Daftar hadir*, *Ringkasan masukan*, *Promotor*, *Detraktor* …). **Kept** (§A):
 * *event*, *NPS* (a metric's name, for approval) and *leader*. **Typed content stays as typed**: an event's title, a
 * member's name, rung and answer. **A figure is never a message's**: a score and its bounds are passed in.
 *
 * @moved lib/events-admin.ts
 * @moved components/events/feedback-dialog.tsx
 * @moved components/events/feedback-summary.tsx
 * @moved components/events/roll-call.tsx
 * @moved components/events/audience-picker.tsx
 */
const en = {
  /** The row's control (`KPM_Owner.html:1655`), and an answer's two lines (`:3767-3768`). */
  viewFeedback: 'View feedback',
  why: 'Why:',
  improve: 'How to improve:',
  /** The card's title (`:3773`), its NPS and its formula (`:3774`), the served bounds written by the caller. */
  summaryTitle: ({ title }: { title: string }) => `${title} — Feedback Summary`,
  nps: kept('NPS'),
  npsFormula: ({ promoterMin, scaleMax, scaleMin, detractorMax }: {
    promoterMin: string; scaleMax: string; scaleMin: string; detractorMax: string;
  }) => `= % Promoters (${promoterMin}–${scaleMax}) − % Detractors (${scaleMin}–${detractorMax})`,
  /** *"· {n} responses"*, *"· 1 response"* (`functional/events.md`). */
  responses: ({ n }: { n: number }) => `· ${n} ${n === 1 ? 'response' : 'responses'}`,
  /** Answers outside the NPS until a confirmation lands (contradiction 23; form 5). */
  awaiting: ({ n }: { n: number }) => `· ${n} awaiting attendance confirmation`,
  noFeedback: 'No feedback yet.',
  unconfirmedTip: 'Attendance not confirmed — not counted in the NPS',
  absentTip: 'Marked absent — not counted in the NPS',
  loadingSummary: 'Loading feedback…',

  /** *View feedback*'s two tabs (P18.8-T13, ADR-0161 §6), and the strip's name. */
  rollCall: 'Roll call',
  feedbackSummaryTab: 'Feedback summary',
  feedbackParts: 'Roll call and feedback',
  /** The roll call (D-rollcall). */
  name: 'Name',
  role: 'Role',
  response: 'Response',
  attendance: 'Attendance',
  said: { rsvp: 'RSVP’d', claimed: 'Said they came' },
  attended: 'Attended',
  absent: 'Absent',
  /** Each row's two marks, named for the person they are about: *"Attended — {name}"*. */
  mark: ({ mark, name }: { mark: string; name: string }) => `${mark} — ${name}`,
  ownRow: 'You can’t confirm your own attendance.',
  saveAttendance: 'Save attendance',
  saved: 'Attendance saved.',
  nobodyInvited: 'Nobody was invited to this event.',
  loadingRollCall: 'Loading the roll call…',
  tryAgain: 'Try again',
  close: 'Close',

  /** The picker (D-picker). */
  searchPeople: 'Search people',
  chosen: ({ n }: { n: number }) => `${n} chosen`,
  noMatches: 'Nobody matches.',
  nobodyLeads: 'Nobody leads anyone yet.',
  loadingPeople: 'Loading people…',
  /** A chosen leader the graph no longer shows leading anybody: kept, never dropped. */
  leadsNobodyNow: 'Leads nobody now',
  /** The chosen people who have left, one row for all of them. */
  left: ({ n }: { n: number }) => (n === 1 ? 'Somebody who has left' : `${n} people who have left`),
  /** The settings panel (P18.5-T5 AC-9), the spec's own words for `EVENT_HAS_RESPONSES`. */
  hasResponses: 'People have already responded to this event, so its start can’t move and it can’t end in the future.',
};

const id: MessagesOf<typeof en> = {
  viewFeedback: 'Lihat masukan',
  why: 'Alasan:',
  improve: 'Cara memperbaiki:',
  summaryTitle: ({ title }) => `${title} — Ringkasan masukan`,
  nps: kept('NPS'),
  npsFormula: ({ promoterMin, scaleMax, scaleMin, detractorMax }) =>
    `= % Promotor (${promoterMin}–${scaleMax}) − % Detraktor (${scaleMin}–${detractorMax})`,
  // One form for one and many (§B.0 rule 8).
  responses: ({ n }) => `· ${n} tanggapan`,
  awaiting: ({ n }) => `· ${n} menunggu konfirmasi kehadiran`,
  noFeedback: 'Belum ada masukan.',
  unconfirmedTip: `Kehadiran belum dikonfirmasi — tidak dihitung dalam ${kept('NPS')}`,
  absentTip: `Ditandai tidak hadir — tidak dihitung dalam ${kept('NPS')}`,
  loadingSummary: 'Memuat masukan…',

  rollCall: 'Daftar hadir',
  feedbackSummaryTab: 'Ringkasan masukan',
  feedbackParts: 'Daftar hadir dan masukan',
  name: 'Nama',
  role: 'Peran',
  response: 'Tanggapan',
  attendance: 'Kehadiran',
  said: { rsvp: 'Sudah RSVP', claimed: 'Menyatakan hadir' },
  attended: 'Hadir',
  absent: 'Tidak hadir',
  mark: ({ mark, name }) => `${mark} — ${name}`,
  ownRow: 'Anda tidak dapat mengonfirmasi kehadiran Anda sendiri.',
  saveAttendance: 'Simpan kehadiran',
  saved: 'Kehadiran tersimpan.',
  nobodyInvited: `Tidak ada yang diundang ke ${kept('event')} ini.`,
  loadingRollCall: 'Memuat daftar hadir…',
  tryAgain: 'Coba lagi',
  close: 'Tutup',

  searchPeople: 'Cari orang',
  chosen: ({ n }) => `${n} dipilih`,
  noMatches: 'Tidak ada yang cocok.',
  nobodyLeads: 'Belum ada yang memimpin siapa pun.',
  loadingPeople: 'Memuat daftar orang…',
  leadsNobodyNow: 'Kini tidak memimpin siapa pun',
  left: ({ n }) => (n === 1 ? 'Seseorang yang sudah keluar' : `${n} orang yang sudah keluar`),
  hasResponses: `Sudah ada yang menanggapi ${kept('event')} ini, jadi waktu mulainya tidak dapat dipindah dan waktu selesainya tidak dapat berada di masa depan.`,
};

export const eventsOfficeMessages = defineMessages({ en, id });
