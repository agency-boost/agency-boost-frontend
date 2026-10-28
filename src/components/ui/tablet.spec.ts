import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import { matchesAt } from '@test/harness';
import config from '../../../tailwind.config';
import * as TABLET from './tablet';

/** The rules Tailwind emits for `classes`, compiled from the real config, as `theme.spec.ts` compiles them. */
async function compile(classes: string): Promise<string> {
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: classes, extension: 'html' }], corePlugins: { preflight: false } }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

const CLASSES = Object.entries(TABLET).flatMap(([name, value]) => (typeof value === 'string' ? [[name, value] as const] : []));

/**
 * **Below 1024px, and nothing at or above it** (P18.97-T6 AC-4, ADR-0178 §6). jsdom applies no stylesheet, so the
 * four widths are read from what the classes compile to: the query each sits under holds at 767, 768 and 1023px —
 * a phone and a tablet — and not at 1024px, where a desktop is drawn exactly as it was.
 */
describe('tablet.ts: nothing it holds reaches 1024px and wider', () => {
  it.each(CLASSES)('%s is `max-lg:` from end to end', (_name, value) => {
    const classes = value.split(/\s+/).filter(Boolean);
    expect(classes.length).toBeGreaterThan(0);
    expect(classes.filter((c) => !c.startsWith('max-lg:'))).toEqual([]);
  });

  it.each(CLASSES)('%s compiles under one query, which holds at 767, 768 and 1023px and not at 1024px', async (_name, value) => {
    const css = await compile(value);
    const queries = [...new Set([...css.matchAll(/@media ([^{]+?)\s*\{/g)].map((m) => m[1]))];
    expect(queries).toEqual(['not all and (min-width: 1024px)']);
    expect([767, 768, 1023, 1024].map((px) => matchesAt(queries[0], px))).toEqual([true, true, true, false]);
    // Every class makes a rule of its own: none is a name Tailwind does not know, which would draw nothing anywhere.
    for (const cls of value.split(/\s+/)) expect(await compile(cls)).toMatch(/\{[^}]*:[^}]+\}/);
  });

  it.each([
    ['flex-wrap', 'max-lg:flex-nowrap'],
    ['border-b', 'max-lg:border-b-0'],
    ['-mb-px', 'max-lg:mb-0'],
  ])('lets %s lose to %s below 1024px: the range’s rule comes later in the sheet, at the same weight', async (base, below) => {
    // The members' row and tabs wear both; jsdom cannot say which wins, the compiled order can.
    const css = await compile(`${base} ${below}`);
    const at = (cls: string) => css.indexOf(`.${cls.replace(/:/g, '\\:')}`);
    expect(at(base)).toBeGreaterThanOrEqual(0);
    expect(at(below)).toBeGreaterThan(at(base));
  });

  it('names the row by the attribute globals.css fades, and nothing else', () => {
    expect(TABLET.BELOW_DESKTOP_ROW).toEqual({ 'data-tab-row': 'below-desktop' });
    const sheet = readFileSync(join(__dirname, '../../styles/globals.css'), 'utf8');
    expect(sheet.match(/\[data-tab-row='below-desktop'\]\[data-fade='(end|start|both)'\]/g)).toHaveLength(3);
  });

  it('is the phone’s tab row, a range wider: the same classes under `max-lg:` in place of `max-md:`', async () => {
    const PHONE = await import('./phone');
    const wider = (phone: string) => phone.replaceAll('max-md:', 'max-lg:');
    expect(TABLET.TAB_ROW_BELOW_DESKTOP).toBe(wider(PHONE.TAB_ROW_PHONE));
    expect(TABLET.UNDERLINED_ROW_BELOW_DESKTOP).toBe(wider(PHONE.UNDERLINED_ROW_PHONE));
    expect(TABLET.TAB_BELOW_DESKTOP).toBe(wider(PHONE.TAB_PHONE));
  });
});
