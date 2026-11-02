/**
 * **Addresses one screen links to on another's behalf, in a module that imports nothing** (UI V1, P18.99-T16, the
 * bundle, 2026-10-30).
 *
 * Importing one export loads the module it lives in and everything that module imports. *Schedule 1:1* on New Hires
 * took `oneOnOneHref` from `lib/calendar.ts` and its row link `coachingSessionHref` from `lib/coaching.ts`, and with
 * them the Calendar's and Coaching's catalogues in both languages; the coaching record's *Activation* tab took a
 * constant from `lib/activation.ts`. Three string builders cost `/new-hires` about 12 kB and `/coaching/me/training`
 * 7 kB of first-load JavaScript, past the 200 kB budget. They live here, and their old homes re-export them, so either
 * import reads the same function. `first-load.spec.ts` keeps this module free of imports.
 */

/**
 * *Coaching →* opens the person on their *Coaching Session* tab (`Overall.html:10661`). **`from`**, an address of this
 * app, is where the header's *‹* goes back to (UI-029: *‹ goes back to where the leader came from*) — `/new-hires` from
 * New Hires' rows; without it, `/coaching`.
 */
export const coachingSessionHref = (membershipId: string, from?: string) =>
  `/coaching/${encodeURIComponent(membershipId)}/session` + (from ? `?from=${encodeURIComponent(from)}` : '');

/**
 * **A 1:1 with somebody, on the calendar** (P18.96-T6 AC-4; ADR-0173 §3): the address `/new-hires`' *Schedule 1:1*
 * opens — the calendar's new-entry dialog as a *1:1 coaching* entry with them invited. By membership id alone, so no
 * name rides in the address: the calendar finds it in the reader's own downline (`GET /calendar/downline`).
 */
export const oneOnOneHref = (membershipId: string) => `/calendar?with=${encodeURIComponent(membershipId)}`;

/** `/coaching/me`'s *Activation* tab (D-coaching-me). */
export const MY_COACHING_ACTIVATION_HREF = '/coaching/me/activation';
