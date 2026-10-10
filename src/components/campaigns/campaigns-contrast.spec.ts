import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import config from '../../../tailwind.config';

/**
 * **Row 44** (P18.5-T7 AC-3, AC-7): the campaigns screens' colours, each a token and each clearing its floor,
 * computed from the tokens themselves — jsdom applies no stylesheet, so no rendered test could see a miss.
 *
 * The prototype's raw hexes become tokens; where its pairs miss WCAG 2.1 AA they are replaced: the *KPM* tag's
 * white on amber-dark, *Ongoing*, *Promotion path* and *View →* in amber-dark, the prize line's amber-dark on its
 * wash, white words on the amber *Chasing*, and the roster's ✓ in `#C9A227`.
 */

function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
/** A translucent wash composited over an opaque ground: the colour the words actually sit on. */
function over(fg: string, alpha: number, bg: string): string {
  const part = (hex: string, i: number) => parseInt(hex.replace('#', '').slice(i, i + 2), 16);
  return `#${[0, 2, 4].map((i) => Math.round(part(fg, i) * alpha + part(bg, i) * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
}

const globals = readFileSync(join(__dirname, '../../styles/globals.css'), 'utf8');
const token = (name: string) => {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(globals);
  if (!m) throw new Error(`no --color-${name} in globals.css`);
  return m[1];
};

const CARD = token('card');
const NAVY = token('navy');
const AMBER = token('amber');
const AMBER_DARK = token('amber-dark');
const AMBER_INK = token('amber-ink');
const GOLD = token('gold');
const GOLD_INK = token('gold-ink');

describe('the campaigns colours (row 44)', () => {
  it('gold is the prototype’s MDRT poster, and gold-ink its ✓ at ≥ 3:1 where the raw gold misses', () => {
    expect(GOLD.toLowerCase()).toBe('#c9a227');
    expect(ratio(GOLD, CARD)).toBeLessThan(3);
    expect(ratio(GOLD_INK, CARD)).toBeGreaterThanOrEqual(3);
    // The reader's own row is on a 5% amber wash (`bg-amber/5`), and every row has the hover's navy wash.
    expect(ratio(GOLD_INK, over(AMBER, 0.05, CARD))).toBeGreaterThanOrEqual(3);
    expect(ratio(GOLD_INK, over(NAVY, 0.015, CARD))).toBeGreaterThanOrEqual(3);
  });

  it('the KPM tag is navy on amber-dark, where the prototype’s white is under 3:1', () => {
    expect(ratio(NAVY, AMBER_DARK)).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#FFFFFF', AMBER_DARK)).toBeLessThan(3.01);
  });

  it('Ongoing, Promotion path and View → are amber-ink on white, where amber-dark misses 4.5:1', () => {
    expect(ratio(AMBER_INK, CARD)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(AMBER_INK, over(CARD, 0.92, AMBER))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(AMBER_DARK, CARD)).toBeLessThan(4.5);
  });

  it('the prize line’s and the Prize block’s words are navy on the 10% amber wash', () => {
    expect(ratio(NAVY, over(AMBER, 0.1, CARD))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(AMBER_DARK, over(AMBER, 0.1, CARD))).toBeLessThan(4.5);
  });

  it('Chase and Chasing are navy words on amber (ADR-0137), where the prototype’s white is 2.23:1', () => {
    expect(ratio(NAVY, AMBER)).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#FFFFFF', AMBER)).toBeLessThan(3);
  });

  it.each([['bg-gold', '.bg-gold'], ['text-gold-ink', '.text-gold-ink']])('%s emits a rule mixed from its own token', async (cls, selector) => {
    const result = await postcss([
      tailwindcss({ ...config, content: [{ raw: cls, extension: 'html' }], corePlugins: { preflight: false } }),
    ]).process('@tailwind utilities;', { from: undefined });
    expect(result.css).toContain(selector);
    expect(result.css).toMatch(/var\(--color-gold(-ink)?\) calc\(/);
  });
});
