/**
 * **The confirmations, once** (P18.95-T1 AC-6; ADR-0167 §5, OD-200; the client's UI review of 2026-10-26,
 * UI-008: *"no shared toast"*). A whole-form save and a one-tap action keep what they show today and add
 * one of these, through the shell's toast (`components/ui/toast.tsx`); **a failure toasts nothing**, and
 * its error stays where it is shown.
 *
 * A field that saves itself says *Saving… → Saved ✓* beside it instead (`components/ui/inline-save-status.tsx`).
 *
 * A screen whose action already toasted a sentence of its own leads with these words and keeps the rest
 * after a dash (`withDetail`): *Session started ✓ — unfinished items and tips from last week carried
 * forward.*, *Joined ✓ — you're going to Product Launch*.
 */
export const CONFIRMED = {
  activityLogged: 'Activity logged ✓',
  goalSaved: 'Goal saved ✓',
  linkCopied: 'Link copied ✓',
  codeCopied: 'Code copied ✓',
  requestSent: 'Request sent ✓',
  eventCreated: 'Event created ✓',
  sessionStarted: 'Session started ✓',
  joined: 'Joined ✓',
} as const;

/** A confirmation, and the sentence the screen already said after it, after a dash. */
export const withDetail = (confirmation: string, detail?: string | null) =>
  (detail ? `${confirmation} — ${detail}` : confirmation);
