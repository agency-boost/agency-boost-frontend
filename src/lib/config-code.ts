/**
 * A code suggested from a label (P5-T1): `Referral Generation` → `REFERRAL_GENERATION`.
 *
 * **A suggestion, never a rule.** The create panels fill the Code field from the label until
 * somebody types in it, because a module title is a sentence and asking for a code from scratch
 * for each one is how codes end up as `MODULE_1`. The server is still what decides whether a
 * code is acceptable — letters, digits and underscores, starting with a letter, 3 to 40
 * characters — so an unsuitable suggestion is refused with the reason, not silently bent.
 */
export function suggestCode(label: string): string {
  const words = label
    // `Pengembangan diri` and `Présentation` both have a plain-letter spelling.
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .match(/[A-Z0-9]+/g) ?? [];
  return words
    .join('_')
    // A code starts with a letter: `10 Tips` suggests `TIPS`, not a code the server refuses.
    .replace(/^[0-9_]+/, '')
    .slice(0, 40)
    .replace(/_+$/, '');
}
