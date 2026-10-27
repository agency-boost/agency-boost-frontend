import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AGE_CHOICES, briefFromQuery, BUDGET_CHOICES, CATEGORY_TABS, CHANNEL_LABELS, catalogHref, drawerHref, filtersFrom,
  fitNote, formatRate, LUMP_SUM_BUDGET, LUMP_SUM_CHOICES, matchesSearch, MONTHLY_BUDGET_CHOICES, moreLine, NEED_CHOICES,
  OWN_COPY, planHref, productCount, productFromQuery, productPlanHref, resultTag,
} from './product-catalog';

const BACKEND = join(__dirname, '..', '..', '..', 'backend', 'src', 'domain', 'constants');
const catalogConstants = readFileSync(join(BACKEND, 'product-catalog.ts'), 'utf8');
const planConstants = readFileSync(join(BACKEND, 'attack-plan.ts'), 'utf8');

/** The `key: 'label'` pairs of one exported record in a backend constants file, read from its text. */
function record(src: string, name: string): Record<string, string> {
  const body = new RegExp(`export const ${name}[^=]*= \\{([^}]*)\\}`, 's').exec(src);
  if (!body) throw new Error(`no ${name}`);
  return Object.fromEntries([...body[1].matchAll(/'?([\w-]+)'?:\s*'([^']*)'/g)].map((m) => [m[1], m[2]]));
}

describe('sales tools: the words and the addresses (Phase 14)', () => {
  describe('the brief’s chips are the domain constants’, never a second definition (invariant §7)', () => {
    it('P14-T8 AC-2 the eight needs, their values and labels, as the backend registers them', () => {
      const backend = record(planConstants, 'PRODUCT_NEED_LABELS');
      expect(NEED_CHOICES.map((c) => [c.value, c.label])).toEqual(Object.entries(backend));
      expect(NEED_CHOICES.map((c) => c.label)).toEqual([
        'Life protection', 'Health', 'Critical illness', 'Accident-only', 'Education', 'Investment',
        'Retirement income', 'Legacy / inheritance',
      ]);
    });

    it('P14-T8 AC-2 the five age bands and the seven budget bands, numbered and labelled as the backend’s', () => {
      expect(AGE_CHOICES.map((c) => [String(c.value), c.label])).toEqual(Object.entries(record(catalogConstants, 'PRODUCT_AGE_BAND_LABELS')));
      expect(BUDGET_CHOICES.map((c) => [String(c.value), c.label]))
        .toEqual(Object.entries(record(catalogConstants, 'PRODUCT_BUDGET_BAND_LABELS')));
    });

    it('P18.95-T6 AC-3 the lump-sum option and its encoding: the backend’s band, asked apart from the six monthly ones', () => {
      const backend = /export const PRODUCT_LUMP_SUM_BUDGET_BAND = (\d+);/.exec(catalogConstants);
      expect(Number(backend?.[1])).toBe(LUMP_SUM_BUDGET);
      expect(MONTHLY_BUDGET_CHOICES.map((c) => c.value)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(LUMP_SUM_CHOICES).toEqual([{ value: 7, label: 'Lump-sum' }]);
      // Together they are the seven bands, in order: nothing added, nothing renumbered.
      expect([...MONTHLY_BUDGET_CHOICES, ...LUMP_SUM_CHOICES]).toEqual(BUDGET_CHOICES);
      // An address that carries it still reads as a brief.
      expect(briefFromQuery({ need: 'investment', age: '3', budget: '7' })).toEqual({ need: 'investment', age: 3, budget: 7 });
      expect(OWN_COPY.lumpSum).toBe('Or pay once');
    });

    it('P14-T7 AC-2 the category tabs and the channels, as the backend names them', () => {
      expect(CATEGORY_TABS.map((c) => [c.value, c.label])).toEqual(Object.entries(record(planConstants, 'PRODUCT_CATEGORY_LABELS')));
      expect(Object.entries(CHANNEL_LABELS)).toEqual(Object.entries(record(planConstants, 'PRODUCT_CHANNEL_LABELS')));
    });
  });

  describe('the plan’s address (D-urls; P14-T8 AC-7)', () => {
    it('reads a whole brief, and the alternative switched to', () => {
      expect(briefFromQuery({ need: 'health', age: '2', budget: '7' })).toEqual({ need: 'health', age: 2, budget: 7 });
      expect(productFromQuery({ need: 'health', age: '2', budget: '7', product: 'PRUSEHAT' })).toBe('PRUSEHAT');
    });

    it.each([
      [{ need: 'pets', age: '2', budget: '2' }],
      [{ need: 'health', age: '6', budget: '2' }],
      [{ need: 'health', age: '0', budget: '2' }],
      [{ need: 'health', age: '2', budget: '8' }],
      [{ need: 'health', age: '2.5', budget: '2' }],
      [{ need: 'health', age: 'two', budget: '2' }],
      [{ need: 'health', budget: '2' }],
      [{ need: ['health', 'ci'], age: '2', budget: '2' }],
      [{}],
    ])('P14-T8 AC-7 %o is no brief at all: the brief opens with nothing chosen', (query) => {
      expect(briefFromQuery(query)).toBeNull();
    });

    it('writes the brief, the switch and the catalog’s deep link', () => {
      expect(planHref({ need: 'life-protection', age: 3, budget: 4 })).toBe('/attack-plan?need=life-protection&age=3&budget=4');
      expect(planHref({ need: 'health', age: 2, budget: 2 }, 'PRUWELL_HEALTH'))
        .toBe('/attack-plan?need=health&age=2&budget=2&product=PRUWELL_HEALTH');
      expect(productPlanHref('PRULINK_GENERASI_BARU_PGB')).toBe('/attack-plan?product=PRULINK_GENERASI_BARU_PGB');
    });
  });

  describe('the catalog’s address (D-urls)', () => {
    const params = (q: string) => new URLSearchParams(q);
    it('reads its filters, and falls back to All for anything it does not know', () => {
      expect(filtersFrom(params('category=ci&channel=syariah'))).toEqual({ category: 'ci', channel: 'syariah' });
      expect(filtersFrom(params('category=pets&channel=conv'))).toEqual({ category: 'all', channel: 'all' });
    });

    it('writes nothing for All and All, and carries the filters onto the drawer’s address', () => {
      expect(catalogHref({ category: 'all', channel: 'all' })).toBe('/product-catalog');
      expect(catalogHref({ category: 'life', channel: 'all' })).toBe('/product-catalog?category=life');
      expect(drawerHref('PRUMAPAN', { category: 'life', channel: 'conventional' }))
        .toBe('/product-catalog/PRUMAPAN?category=life&channel=conventional');
    });
  });

  describe('P18.95-T6 AC-4 catalog search, by product name (UI-023)', () => {
    it.each([
      ['PRUMapan', 'mapan', true],
      ['PRUMapan', 'MAPAN', true],
      ['PRUMapan', '  mapan  ', true],
      ['PRULink Generasi Baru (PGB)', 'generasi baru', true],
      ['PRUMapan', '', true],
      ['PRUMapan', '   ', true],
      ['PRUMapan', 'future', false],
      ['PRUMapan', 'pru mapan', false],
    ])('P18.95-T6 AC-4 %s, searched for %o: %s', (name, term, found) => {
      expect(matchesSearch(name, term)).toBe(found);
    });

    it('P18.95-T6 AC-4 ignores accents either side, so a name typed without them is found', () => {
      expect(matchesSearch('PRUCinta Syariah', 'cinta')).toBe(true);
      expect(matchesSearch('Café Plan', 'cafe')).toBe(true);
      expect(matchesSearch('Cafe Plan', 'café')).toBe(true);
    });

    it('P18.95-T6 AC-4 catalog search and empty result: the line names what was searched for, trimmed', () => {
      expect(OWN_COPY.noSearchMatch('  zzz ')).toBe('No products match “zzz”.');
      expect([OWN_COPY.searchName, OWN_COPY.searchPlaceholder]).toEqual(['Search products by name', 'Search products…']);
    });
  });

  describe('the words, verbatim (D-copy)', () => {
    it('P14-T8 AC-3 the fit note names the age band, the budget band, or both (`:9669-9675`)', () => {
      const tail = ' for this product — still workable, but check eligibility and premium sizing before quoting.';
      expect(fitNote(['age'])).toBe(`Outside the typical age band${tail}`);
      expect(fitNote(['budget'])).toBe(`Outside the typical budget band${tail}`);
      expect(fitNote(['age', 'budget'])).toBe(`Outside the typical age band and budget band${tail}`);
    });

    it('the more line, the section count, and the tag (`:9699`, `:10170`, `:9682`)', () => {
      expect(moreLine(3)).toBe('3 more also match. Open the Product Catalog to browse the full shelf.');
      expect([productCount(1), productCount(10)]).toEqual(['1 product', '10 products']);
      expect(resultTag({ needs: ['retirement'], category: { code: 'life', label: 'Life' }, channel: 'conventional' }))
        .toBe('Retirement income · Conventional');
    });

    it('P14-T7 AC-5 prints a stored proportion as the percentage (OD-135)', () => {
      expect([formatRate(0.4), formatRate(0.125), formatRate(0.025), formatRate(0)]).toEqual(['40,0%', '12,5%', '2,5%', '0,0%']);
      // One decimal (ADR-0167 §1), and the second a rate was stored with: the rate read is the rate stored.
      expect(formatRate(0.0725)).toBe('7,25%');
    });

    it('D-copy: the strings these screens write themselves use none of the six words (ADR-0084)', () => {
      const SIX = /\b(office|KPM|reports to|tagged to|untagged|unassigned)\b/i;
      const strings = Object.values(OWN_COPY).map((s) => (typeof s === 'function' ? s('Brochure') : s));
      expect(strings.filter((s) => SIX.test(s))).toEqual([]);
    });
  });

  /**
   * **The tags, the pills, the note and the banner pass contrast with tokens** (P14-T7 AC-11, P14-T8 AC-11).
   * jsdom paints nothing, so — as `a11y.spec.tsx` does — the ratios are computed from the token values in
   * `globals.css`, over the washes the components draw.
   */
  describe('contrast, from the tokens (P14-T7 AC-11, P14-T8 AC-11)', () => {
    const css = readFileSync(join(__dirname, '..', 'styles', 'globals.css'), 'utf8');
    const token = (name: string) => {
      const hit = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
      if (!hit) throw new Error(`no token ${name}`);
      return hit[1];
    };
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    const over = (fg: string, alpha: number, bg: string) => `#${[1, 3, 5]
      .map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * alpha + parseInt(bg.slice(i, i + 2), 16) * (1 - alpha)))
      .map((c) => c.toString(16).padStart(2, '0')).join('')}`;

    const [NAVY, AMBER, AMBER_DARK, AMBER_INK, CARD, BASE, MUTED, SUCCESS, ALERT] = [
      'navy', 'amber', 'amber-dark', 'amber-ink', 'card', 'base', 'muted', 'success', 'alert',
    ].map(token);

    it('the channel tags: navy on its 8% wash, and navy — not amber-dark — on Syariah’s amber', () => {
      expect(ratio(NAVY, over(NAVY, 0.08, CARD))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(NAVY, over(AMBER, 0.14, CARD))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(AMBER_DARK, over(AMBER, 0.14, CARD))).toBeLessThan(3);
    });

    it('the run-off tag and both run-off notes: alert on its own wash', () => {
      expect(ratio(ALERT, over(ALERT, 0.08, CARD))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(ALERT, over(ALERT, 0.06, CARD))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(ALERT, over(ALERT, 0.05, CARD))).toBeGreaterThanOrEqual(4.5);
    });

    it('the fit pills: each word on its own wash, the verdict never colour alone', () => {
      expect(ratio(SUCCESS, over(SUCCESS, 0.1, CARD))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(ALERT, over(ALERT, 0.1, CARD))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(MUTED, over(NAVY, 0.06, CARD))).toBeGreaterThanOrEqual(4.5);
    });

    it('the amber words on a card — the tag, *View detail →*, the links — are amber-ink, where amber-dark misses', () => {
      expect(ratio(AMBER_INK, CARD)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(AMBER_DARK, CARD)).toBeLessThan(4.5);
    });

    it('the catalog banner: navy words and a navy link on the 10% amber wash, where amber-ink misses', () => {
      const banner = over(AMBER, 0.1, BASE);
      expect(ratio(NAVY, banner)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(AMBER_INK, banner)).toBeLessThan(4.5);
    });

    it('the push-back box’s words on the warm ground', () => {
      for (const word of [ALERT, SUCCESS, NAVY]) expect(ratio(word, BASE)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
