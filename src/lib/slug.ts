/**
 * A company name, as a slug.
 *
 * Lower-cased, accents folded, every run of non-alphanumerics collapsed to one hyphen,
 * hyphens trimmed from both ends. `Chubb Life & General` becomes `chubb-life-general`,
 * not `chubb-life---general` — the `+` on the character class is what does that.
 *
 * The output always satisfies the server's pattern (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), which
 * is deliberately the shape derivation produces rather than merely the characters it
 * allows: a hand-typed `--a--` used to pass a rule no derived value could ever produce.
 *
 * **A name that folds away to nothing derives nothing.** Non-Latin branding leaves an
 * empty string after the strip, and a blank required field is honest where an invented
 * `company-1` would be exactly the id-shaped value this task exists to remove.
 *
 * Truncation happens on a hyphen boundary so a long name never ends mid-word.
 */
export const SLUG_MAX = 64;

export function toSlug(name: string): string {
  const base = name
    .normalize('NFKD')
    // Combining marks, left behind by NFKD: `é` → `e` + U+0301.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (base.length <= SLUG_MAX) return base;
  const cut = base.slice(0, SLUG_MAX);
  const lastHyphen = cut.lastIndexOf('-');
  return (lastHyphen > 0 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/, '');
}
