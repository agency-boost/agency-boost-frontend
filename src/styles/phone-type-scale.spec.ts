import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss, { type Rule } from 'postcss';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import { cn } from '@/lib/cn';

/** The utilities Tailwind emits for `classes`, compiled from the real config. */
async function compile(classes: string): Promise<string> {
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: classes, extension: 'html' }], corePlugins: { preflight: false } }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

const sheet = postcss.parse(readFileSync(join(__dirname, 'globals.css'), 'utf8'));
const root = sheet.nodes.find((n): n is Rule => n.type === 'rule' && n.selector === ':root')!;
const decl = (prop: string) => root.nodes.find((n) => n.type === 'decl' && n.prop === prop) as { value: string } | undefined;

/**
 * **The Super Admin's phone type scale** (P19.26-T0 AC-4; ADR-0283 §4, ADR-0284 §4;
 * `revisions/2026-11-21/BRIEF-ADJUSTMENTS-2026-11-21.md`, *One type scale*): the two sizes the scale lacked, as tokens,
 * and the navy card's light orange. Every other size of the brief's table is a step the scale already has
 * (`tokens.md`, *The phone type scale*).
 */
describe('the phone type scale’s tokens (P19.26-T0 AC-4)', () => {
  it('declares 15px (`text-row`) and 24px (`text-figure`), once, on `:root`', async () => {
    expect(decl('--text-row')?.value).toBe('0.9375rem');
    expect(decl('--text-figure')?.value).toBe('1.5rem');
    expect(await compile('text-row')).toContain('font-size: var(--text-row)');
    expect(await compile('text-figure')).toContain('font-size: var(--text-figure)');
  });

  it('declares the light orange #F5B67A as `on-navy-orange`, and reuses the ink and the orange label it already had', async () => {
    expect(decl('--color-on-navy-orange')?.value).toBe('#f5b67a');
    expect(await compile('text-on-navy-orange')).toContain('var(--color-on-navy-orange)');
    // #1C1C1A (a name) and #A85E1B (the AB / AAB label) were tokens already: reused, never declared twice.
    expect(decl('--color-ink')?.value).toBe('#1c1c1a');
    expect(decl('--color-amber-ink')?.value).toBe('#a85e1b');
  });

  it('keeps `text-row` and `text-figure` beside a colour through `cn`: they are sizes, not colours', () => {
    // tailwind-merge reads an unknown `text-*` as a colour; told otherwise in `cn`, the later colour no longer drops them.
    expect(cn('text-row font-bold', 'text-navy')).toBe('text-row font-bold text-navy');
    expect(cn('text-figure', 'text-on-navy-orange')).toBe('text-figure text-on-navy-orange');
    // And one size still replaces another, as `title` does.
    expect(cn('text-md', 'text-row')).toBe('text-row');
    expect(cn('text-row', 'md:text-md')).toBe('text-row md:text-md');
  });
});
