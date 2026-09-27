import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import config from '../../../tailwind.config';

/** The utilities Tailwind emits for `classes`, compiled from the real config. */
async function compile(classes: string): Promise<string> {
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: classes, extension: 'html' }], corePlugins: { preflight: false } }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

/**
 * The theme's own shape, asserted — because a name collision here is invisible in review and
 * produces a defect nobody can attribute.
 *
 * `colors.base` and `fontSize.base` both generate `.text-base`. Tailwind emits the colour second, so
 * `text-base` silently painted text near-white. It surfaced only on the leads table, where a
 * descendant variant scoping the size to every cell carried enough specificity to beat the cell's
 * own colour — and the row number disappeared against white.
 */
describe('the Tailwind theme', () => {
  const theme = config.theme! as Record<string, unknown>;
  const extend = theme.extend as Record<string, unknown>;
  const sizes = Object.keys(extend.fontSize as object);

  it('declares the text scale at `theme`, not inside `extend`', () => {
    // Inside `extend` it merges with the default scale, and the default `textColor` *is*
    // `theme('colors')` — so the colliding name comes straight back through it. The first fix was
    // written in `extend` and the rule stayed in the stylesheet; the build output is what caught it.
    expect(theme.textColor).toBeTypeOf('function');
    expect(extend.textColor).toBeUndefined();
  });

  it('names no text colour after a font size', () => {
    // `text-{name}` is one namespace for both scales, so a shared name is two rules for one class.
    const resolve = theme.textColor as (a: { theme: (p: string) => unknown }) => object;
    const textColors = resolve({ theme: () => extend.colors });
    expect(Object.keys(textColors).filter((c) => sizes.includes(c))).toEqual([]);
  });

  describe('a token takes an opacity modifier', () => {
    /*
     * Every token was a bare `var(--color-…)`, and Tailwind 3 drops a class asking one of those for
     * an opacity: no rule at all. Every tint in the product rendered transparent, and no jsdom test
     * could see it — jsdom applies no stylesheet. Found in a browser, on the *Active (MAA)* column.
     */
    it.each([
      ['bg-amber/15', '.bg-amber\\/15'],
      ['bg-navy/[0.06]', '.bg-navy\\/\\[0\\.06\\]'],
      ['bg-info/[0.12]', '.bg-info\\/\\[0\\.12\\]'],
      ['bg-success/10', '.bg-success\\/10'],
      ['hover:bg-navy/[0.06]', '.hover\\:bg-navy\\/\\[0\\.06\\]:hover'],
    ])('%s emits a rule, mixed from the token', async (cls, selector) => {
      const css = await compile(cls);
      expect(css).toContain(selector);
      expect(css).toMatch(/color-mix\(in srgb, var\(--color-[a-z-]+\) calc\(0?\.\d+ \* 100%\), transparent\)/);
    });

    it('leaves a plain token at full strength', async () => {
      const css = await compile('bg-amber text-navy');
      expect(css).toContain('var(--color-amber) calc(var(--tw-bg-opacity, 1) * 100%)');
      expect(css).toContain('--tw-bg-opacity: 1');
      expect(css).toContain('var(--color-navy) calc(var(--tw-text-opacity, 1) * 100%)');
    });
  });

  it('keeps base as a background and border colour', () => {
    // It is the product's warm off-white ground — removing it from `colors` would take `bg-base`
    // with it, and that is 24 call sites and the character of the whole product.
    expect(Object.keys(extend.colors as object)).toContain('base');
  });
});
