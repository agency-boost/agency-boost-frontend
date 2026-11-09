/**
 * **The longest *Deskripsi singkat* a skill or a module takes** (UI-161, ADR-0220 §1): the settings screens and the
 * template's Training section hold their field to it, so a reader hears the limit before a round trip.
 *
 * **The server's rule, mirrored** — `TRAINING_TEXT.DESCRIPTION_MAX` in the backend's `domain/constants/training-taxonomy.ts`
 * (`metrics-and-definitions.md`, *Training*), which the checkers enforce. `training-text.spec.ts` reads that file from
 * disk and fails the day the two differ. The server's answer is the one that counts.
 */
export const TRAINING_DESCRIPTION_MAX = 160;
