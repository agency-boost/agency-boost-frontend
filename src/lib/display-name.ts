/**
 * **What a person is called on a screen** (the client's UI review, UI-005): their preferred name when they have
 * one, else their full name.
 *
 * Every site read `preferredName ?? fullName`, and `??` falls back on `null` only. The profile saved `''` for an
 * empty *Preferred name*, so the header printed nothing where the name should have been. The API stores `null` for
 * a blank one now and migration 0035 repaired the old ones; this treats a blank one as none all the same, so no
 * screen depends on every row having been repaired.
 */
export function displayName(person: { preferredName?: string | null; fullName?: string | null }): string {
  const preferred = person.preferredName?.trim();
  return preferred ? preferred : (person.fullName ?? '');
}
