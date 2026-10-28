import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import postcss, { type AtRule, type Rule } from 'postcss';
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

  describe('the one small-text amber', () => {
    /*
     * `text-amber-ink` is the leads Type word (F-73). A class that compiles to an undefined custom
     * property is invalid at computed-value time and quietly inherits the cell's colour — which reads
     * as "no amber" and passes every jsdom test, since jsdom applies no stylesheet. So both halves are
     * pinned: the rule exists, and the variable it reads is defined, at the value a11y.spec.tsx measures.
     */
    it('text-amber-ink emits a rule mixed from its own token', async () => {
      const css = await compile('text-amber-ink');
      expect(css).toContain('.text-amber-ink');
      expect(css).toContain('var(--color-amber-ink) calc(var(--tw-text-opacity, 1) * 100%)');
    });

    it('globals.css defines the token at the value the contrast test measures', () => {
      const globals = readFileSync(join(__dirname, '../../styles/globals.css'), 'utf8');
      expect(globals).toMatch(/--color-amber-ink:\s*#a85e1b;/i);
    });
  });

  describe('the primary button’s amber (ADR-0137)', () => {
    /*
     * An action is amber with navy words, darkening to amber-dark under the pointer. Each class must
     * compile from its token, and each token must hold the value `a11y.spec.tsx` measures the 4.5:1 on —
     * a class reading an undefined property paints nothing and passes every jsdom test.
     */
    it.each([
      ['bg-amber', '.bg-amber', 'amber'],
      ['hover:bg-amber-dark', '.hover\\:bg-amber-dark:hover', 'amber-dark'],
      ['text-navy', '.text-navy', 'navy'],
    ])('%s emits a rule mixed from its own token', async (cls, selector, token) => {
      const css = await compile(cls);
      expect(css).toContain(selector);
      expect(css).toContain(`var(--color-${token}) calc(`);
    });

    it('globals.css defines both ambers and navy at the values the contrast test measures', () => {
      const globals = readFileSync(join(__dirname, '../../styles/globals.css'), 'utf8');
      expect(globals).toMatch(/--color-amber:\s*#f2994a;/i);
      expect(globals).toMatch(/--color-amber-dark:\s*#d97f30;/i);
      expect(globals).toMatch(/--color-navy:\s*#1b2b4b;/i);
    });
  });

  describe('the calendar’s teal (H-19, P12-T2 AC-12)', () => {
    /*
     * The prototype declared `--teal` in its section file alone (`Calendar_Section.html:15`). It is a
     * token now, with an ink for words on its own tint, and each class the calendar draws must compile
     * from them — a class that reads an undefined property renders nothing and passes every jsdom test.
     */
    it.each([
      ['bg-teal', '.bg-teal'],
      ['bg-teal/[0.14]', '.bg-teal\\/\\[0\\.14\\]'],
      ['border-teal/30', '.border-teal\\/30'],
      ['text-teal-ink', '.text-teal-ink'],
    ])('%s emits a rule mixed from its own token', async (cls, selector) => {
      const css = await compile(cls);
      expect(css).toContain(selector);
      expect(css).toMatch(/var\(--color-teal(-ink)?\)/);
    });

    it('globals.css defines both at the values the contrast test measures', () => {
      const globals = readFileSync(join(__dirname, '../../styles/globals.css'), 'utf8');
      expect(globals).toMatch(/--color-teal:\s*#2c7a73;/i);
      expect(globals).toMatch(/--color-teal-ink:\s*#24665f;/i);
    });
  });

  it('keeps base as a background and border colour', () => {
    // It is the product's warm off-white ground — removing it from `colors` would take `bg-base`
    // with it, and that is 24 call sites and the character of the whole product.
    expect(Object.keys(extend.colors as object)).toContain('base');
  });
});

/**
 * **A phone's sizes, in the stylesheet** (P18.95-T1 AC-9, AC-10, AC-12; ADR-0167; the client's UI review
 * of 2026-10-26: UI-014, UI-029).
 *
 * The type scale's five steps under 16px are custom properties, so a phone moves them once and nothing
 * wider does. jsdom applies no stylesheet, so no rendered test can see any of it: these read the sheet and
 * the compiled classes instead, as the colour tokens above do.
 */
describe('on a phone', () => {
  const sheet = postcss.parse(readFileSync(join(__dirname, '../../styles/globals.css'), 'utf8'));
  const decls = (rule: Rule) => Object.fromEntries(
    rule.nodes.flatMap((n) => (n.type === 'decl' ? [[n.prop, n.value]] : [])),
  );
  const topRoot = sheet.nodes.find((n): n is Rule => n.type === 'rule' && n.selector === ':root')!;
  const phoneBlocks = (query: string) => sheet.nodes.filter(
    (n): n is AtRule => n.type === 'atrule' && n.name === 'media' && n.params === query,
  );
  async function phoneQuery() {
    const css = await compile('max-md:hidden');
    return /@media ([^{]+?)\s*\{/.exec(css)![1];
  }
  async function phoneBlock() {
    const blocks = phoneBlocks(await phoneQuery());
    expect(blocks).toHaveLength(1);
    return blocks[0];
  }
  const rulesIn = (block: AtRule) => block.nodes!.filter((n): n is Rule => n.type === 'rule');

  it('draws the line exactly where a `max-md:` class does', async () => {
    // One boundary for the sheet and the components: Tailwind's own words for "narrower than md".
    expect(await phoneQuery()).toBe('not all and (min-width: 768px)');
    await phoneBlock();
  });

  it.each(['2xs', 'xs', 'sm', 'base', 'md'])('text-%s reads its property', async (step) => {
    const css = await compile(`text-${step}`);
    expect(css).toContain(`font-size: var(--text-${step})`);
  });

  it.each(['lg', 'xl', '2xl', '3xl'])('text-%s, 16px and up, stays a plain rem', async (step) => {
    const css = await compile(`text-${step}`);
    expect(css).toMatch(/font-size: [\d.]+rem/);
  });

  it('keeps every size at 768px and wider exactly as it was', () => {
    // The values the scale held as literals before (`tokens.md`, Size scale): a tablet and a desktop the
    // client has not reviewed do not move (ADR-0167 §12, OD-207).
    expect(decls(topRoot)).toMatchObject({
      '--text-2xs': '0.625rem',
      '--text-xs': '0.6875rem',
      '--text-sm': '0.75rem',
      '--text-base': '0.8125rem',
      '--text-md': '0.875rem',
    });
  });

  it('AC-10 raises the two steps under 12px to 12px below 768px, and nothing else on the page', async () => {
    const block = await phoneBlock();
    const root = rulesIn(block).find((r) => r.selector === ':root')!;
    expect(decls(root)).toEqual({ '--text-2xs': '0.75rem', '--text-xs': '0.75rem' });
  });

  it('AC-9 makes a field’s text 16px below 768px, whatever small step its class names', async () => {
    const block = await phoneBlock();
    const field = rulesIn(block).find((r) => r.selectors.includes('select'))!;
    expect(field.selectors.map((sel) => sel.replace(/\s+/g, ' '))).toEqual([
      "input:where(:not([type='checkbox'], [type='radio'], [type='range'], [type='color'], [type='file'], "
        + "[type='button'], [type='submit'], [type='reset'], [type='image'], [type='hidden']))",
      'select',
      'textarea',
    ]);
    expect(decls(field)).toEqual({
      '--text-2xs': '1rem',
      '--text-xs': '1rem',
      '--text-sm': '1rem',
      '--text-base': '1rem',
      '--text-md': '1rem',
      // A field with no size class of its own inherits its parent's 13px through preflight.
      'font-size': 'max(1rem, 100%)',
    });
  });

  it('AC-9 outranks no class: each field selector weighs one element', async () => {
    // A `:not()` outside `:where()` would weigh an attribute, beat `.text-xl` on a large field and shrink
    // it to 16px. One element's weight beats preflight's `font-size: 100%` by order and loses to every utility.
    const block = await phoneBlock();
    const field = rulesIn(block).find((r) => r.selectors.includes('select'))!;
    for (const sel of field.selectors) {
      const outside = sel.replace(/:where\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, '');
      expect(outside).toMatch(/^(input|select|textarea)$/);
    }
  });

  it('AC-8 fades a tab row on the side that has more, below 768px only, with no colour of its own', async () => {
    const block = await phoneBlock();
    const fades = rulesIn(block).filter((r) => r.selector.startsWith('[data-fade='));
    expect(fades.map((r) => r.selector).sort()).toEqual(["[data-fade='both']", "[data-fade='end']", "[data-fade='start']"]);
    for (const rule of fades) {
      const d = decls(rule);
      expect(d['mask-image']).toContain('var(--tab-fade)');
      expect(d['-webkit-mask-image']).toBe(d['mask-image']);
      expect(d['mask-image']).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
    // Nowhere else: a row that overflows at 768px and wider is not faded — but a row that says it is one row below
    // 1024px as well (P18.97-T6 AC-4, the next case), and only below 1024px.
    const elsewhere = sheet.nodes.filter((n) => n !== block && n.toString().includes('data-fade'));
    expect(elsewhere.map((n) => (n as AtRule).params)).toEqual(['not all and (min-width: 1024px)']);
    expect(decls(topRoot)['--tab-fade']).toBe('1.5rem');
  });

  it('P18.97-T6 AC-4 fades a row that scrolls below 1024px there too — only a row that says so, with the phone’s masks', async () => {
    // The query a `max-lg:` class compiles to, so the row's classes and its fade change at the same pixel.
    const css = await compile('max-lg:flex-nowrap');
    const query = /@media ([^{]+?)\s*\{/.exec(css)![1];
    expect(query).toBe('not all and (min-width: 1024px)');
    const blocks = phoneBlocks(query);
    expect(blocks).toHaveLength(1);
    const fades = rulesIn(blocks[0]);
    expect(fades.map((r) => r.selector).sort()).toEqual([
      "[data-tab-row='below-desktop'][data-fade='both']",
      "[data-tab-row='below-desktop'][data-fade='end']",
      "[data-tab-row='below-desktop'][data-fade='start']",
    ]);
    // Each the phone's own mask for the same side, so the two cannot come to differ.
    const phoneFades = rulesIn(await phoneBlock()).filter((r) => r.selector.startsWith('[data-fade='));
    for (const rule of fades) {
      const side = /\[data-fade='(\w+)'\]$/.exec(rule.selector)![1];
      const twin = phoneFades.find((r) => r.selector === `[data-fade='${side}']`)!;
      expect(decls(rule)).toEqual(decls(twin));
    }
  });

  it('AC-10 leaves no arbitrary text size under 12px in the source, but for a glyph that is not text', () => {
    // The scale's steps are raised in one place; an arbitrary `text-[10px]` would escape it. A glyph may
    // stay smaller (AC-10) — each such one is named here, with what it is.
    const GLYPHS: Record<string, string> = {
      'components/unit/unit-roster.tsx text-[0.5625rem]': 'the roster’s ▸ disclosure, aria-hidden',
    };
    const src = join(__dirname, '../..');
    const found: string[] = [];
    const seen = new Set<string>();
    for (const file of readdirSync(src, { recursive: true }) as string[]) {
      if (!/\.tsx?$/.test(file) || /\.spec\.tsx?$/.test(file)) continue;
      const text = readFileSync(join(src, file), 'utf8');
      for (const m of text.matchAll(/text-\[(\d*\.?\d+)(px|rem)\]/g)) {
        const px = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
        const key = `${relative(src, join(src, file))} ${m[0]}`;
        if (px < 12 && GLYPHS[key]) seen.add(key);
        else if (px < 12) found.push(key);
      }
    }
    expect(found).toEqual([]);
    // And the list names only what is there, so it cannot quietly excuse a size that has gone.
    expect([...seen].sort()).toEqual(Object.keys(GLYPHS).sort());
  });
});
