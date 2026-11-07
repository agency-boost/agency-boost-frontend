/**
 * **The longest *Nama singkat* an activity type takes** (P19.8-T4, ADR-0229 §5; MOB UI-180): the office's activity types
 * and the template's activity section hold their field to it, so a reader hears the limit before a round trip.
 *
 * **The server's rule, mirrored** — `ACTIVITY_TEXT.SHORT_LABEL_MAX` in the backend's
 * `domain/constants/activity-taxonomy.ts` (`metrics-and-definitions.md`, *Activity types*), which the checkers enforce.
 * `activity-text.spec.ts` reads that file from disk and fails the day the two differ. The server's answer is the one that
 * counts.
 */
export const ACTIVITY_SHORT_LABEL_MAX = 20;
