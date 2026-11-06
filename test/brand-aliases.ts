/**
 * **The brand tokens, read as the colours they replaced** (P19.6-T1 AC-1; ADR-0218 §6; `tokens.md`, *Brand tokens*).
 *
 * The sweep renamed every brand use of amber and navy to a semantic token — `bg-amber` became `bg-primary`, `text-white`
 * on a navy fill became `text-secondary-contrast` — and gave each token **today's colour as its default**
 * (`globals.css`). So with no KPM branding a renamed class paints exactly what the old one did, and a markup digest
 * recorded before the sweep must still hold. `asBeforeBranding` reads a class list or a page's markup back in the old
 * names, so those digests are compared as they were recorded; `styles/brand-tokens.spec.ts` proves each alias's default
 * *is* the token it is read as, so the reading cannot hide a colour that moved.
 */
export const BRAND_ALIASES: ReadonlyArray<readonly [semantic: string, before: string]> = [
  ['primary-on-secondary', 'amber'],
  ['primary-contrast', 'navy'],
  ['primary-hover', 'amber-dark'],
  ['primary-ink', 'amber-ink'],
  ['primary-deep', 'amber-deep'],
  ['primary', 'amber'],
  ['focus-ring', 'amber'],
  ['secondary-contrast', 'white'],
  ['secondary-hover', 'navy-soft'],
  ['secondary-muted', 'on-navy-muted'],
  ['secondary-ink', 'navy'],
  ['secondary', 'navy'],
];

const UTILITY = '(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|accent|fill|stroke|from|via|to|divide|decoration|caret|shadow|placeholder)';
const NAMES = BRAND_ALIASES.map(([semantic]) => semantic).join('|');
const CLASS = new RegExp(`(^|[\\s":!\\[(,_])(${UTILITY})-(${NAMES})(?=$|[\\s"/\\])])`, 'g');
const VAR = new RegExp(`--color-(${NAMES})(?![\\w-])`, 'g');
const BEFORE = new Map(BRAND_ALIASES);

/** A class list, or markup, with every brand token read as the colour it replaced. */
export function asBeforeBranding(text: string): string {
  return text
    .replace(CLASS, (_m, lead: string, utility: string, name: string) => {
      const before = BEFORE.get(name)!;
      // `--color-white` is not a token: white is Tailwind's own `white`, and only ever as a class.
      return `${lead}${utility}-${before}`;
    })
    .replace(VAR, (_m, name: string) => `--color-${BEFORE.get(name)}`);
}
