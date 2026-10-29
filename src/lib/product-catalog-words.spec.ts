import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalogueTexts, SRC } from '@test/copy-scan';
import { isKept } from '@/i18n/kept';
import { planMessages } from '@/i18n/messages/plan';
import { productCatalogMessages } from '@/i18n/messages/product-catalog';
import { salesAttackPlanMessages } from '@/i18n/messages/sales-attack-plan';
import {
  BUDGET_CHOICES, budgetChoices, budgetLabel, CATEGORY_TABS, CHANNEL_LABELS, channelLabel, fitNote, formatRate,
  moreLine, NEED_CHOICES, needChoices, needLabel, OWN_COPY, productCount, resultTag,
} from './product-catalog';

const BACKEND = join(__dirname, '..', '..', '..', 'backend', 'src', 'domain', 'constants');
const catalogConstants = readFileSync(join(BACKEND, 'product-catalog.ts'), 'utf8');

/** The `key: 'label'` pairs of one exported record in a backend constants file, read from its text. */
function record(src: string, name: string): Record<string, string> {
  const body = new RegExp(`export const ${name}[^=]*= \\{([^}]*)\\}`, 's').exec(src);
  if (!body) throw new Error(`no ${name}`);
  return Object.fromEntries([...body[1].matchAll(/'?([\w-]+)'?:\s*'([^']*)'/g)].map((m) => [m[1], m[2]]));
}

/**
 * **P18.98-T4, Sales tools' words in both languages** (field selling): `lib/product-catalog.ts`' functions read the
 * catalogue — the words in the reader's words' language, English when none is passed; a figure in the figures' language,
 * Indonesian when none is passed — and the three areas hold OD-39's six words to each language. In English, as before:
 * `product-catalog.spec.ts`.
 */
describe('P18.98-T4 sales tools’ words, language by language', () => {
  it('AC-1 the English is the source, unchanged: the views the specs read are the catalogue’s English', () => {
    expect(NEED_CHOICES).toEqual(needChoices('en'));
    expect(CHANNEL_LABELS).toEqual({ conventional: 'Conventional', syariah: 'Syariah' });
    expect(OWN_COPY.loadingShelf).toBe(productCatalogMessages.en.loadingShelf);
    expect(OWN_COPY.steps).toBe(planMessages.en.steps);
    expect(OWN_COPY.loadingPlan).toBe(salesAttackPlanMessages.en.loading);
    expect(OWN_COPY.opensInNewTab('Brochure')).toBe('Brochure — opens in a new tab');
  });

  it('AC-2 the brief’s eight needs in Indonesian, by the same codes', () => {
    expect(needChoices('id')).toEqual([
      { value: 'life-protection', label: 'Perlindungan jiwa' }, { value: 'health', label: 'Kesehatan' },
      { value: 'ci', label: 'Penyakit kritis' }, { value: 'accident', label: 'Khusus kecelakaan' },
      { value: 'education', label: 'Pendidikan' }, { value: 'investment', label: 'Investasi' },
      { value: 'retirement', label: 'Dana pensiun' }, { value: 'legacy', label: 'Warisan' },
    ]);
    expect([needLabel('retirement', 'id'), needLabel('retirement'), needLabel('pets', 'id')])
      .toEqual(['Dana pensiun', 'Retirement income', undefined]);
  });

  it('P18.98-T3 figures: a budget band’s sums in the figures’ language, its words in the words’ — four combinations', () => {
    expect(budgetChoices('id', 'id').map((c) => c.label)).toEqual([
      '< Rp 500 rb', 'Rp 500 rb–Rp 2 jt', 'Rp 2 jt–Rp 5 jt', 'Rp 5 jt–Rp 10 jt', 'Rp 10 jt–Rp 20 jt', '> Rp 20 jt', 'Sekaligus',
    ]);
    expect(budgetChoices('en', 'en').map((c) => c.label)).toEqual([
      '< IDR 500K', 'IDR 500K–IDR 2M', 'IDR 2M–IDR 5M', 'IDR 5M–IDR 10M', 'IDR 10M–IDR 20M', '> IDR 20M', 'Lump-sum',
    ]);
    // A reader with no choice before the switch is live: English words, Indonesian figures — the backend's labels.
    expect(budgetChoices('id', 'en')).toEqual(BUDGET_CHOICES);
    expect(budgetChoices('en', 'id').map((c) => c.label).slice(5)).toEqual(['> IDR 20M', 'Sekaligus']);
    expect([budgetLabel(2), budgetLabel(7), budgetLabel(9)]).toEqual(['Rp 500 rb–Rp 2 jt', 'Lump-sum', undefined]);
  });

  it('invariant §7 the bands’ sums, written in Indonesian figures, are the backend’s labels to the character', () => {
    const backend = record(catalogConstants, 'PRODUCT_BUDGET_BAND_LABELS');
    expect(budgetChoices('id', 'en').map((c) => [String(c.value), c.label])).toEqual(Object.entries(backend));
  });

  it('AC-3 the result’s tag, the section count, the fit note and the more line in Indonesian, each whole', () => {
    expect(resultTag({ needs: ['retirement'], category: { code: 'life', label: 'Life' }, channel: 'conventional' }, 'id'))
      .toBe('Dana pensiun · Konvensional');
    // A need the eight do not have falls back to the server's category, a kept term.
    expect(resultTag({ needs: ['pets'], category: { code: 'life', label: 'Life' }, channel: 'syariah' }, 'id')).toBe('Life · Syariah');
    expect([productCount(1, 'id'), productCount(10, 'id'), productCount(1), productCount(10)])
      .toEqual(['1 produk', '10 produk', '1 product', '10 products']);
    const tail = ' yang umum untuk produk ini — masih memungkinkan, tetapi periksa kelayakan dan besaran premi sebelum membuat '
      + 'penawaran.';
    expect(fitNote(['age'], 'id')).toBe(`Di luar rentang usia${tail}`);
    expect(fitNote(['budget'], 'id')).toBe(`Di luar rentang anggaran${tail}`);
    expect(fitNote(['age', 'budget'], 'id')).toBe(`Di luar rentang usia dan rentang anggaran${tail}`);
    expect(moreLine(3, 'id')).toBe('3 produk lain juga sesuai. Buka Product Catalog untuk melihat seluruh etalase.');
    expect([channelLabel('conventional', 'id'), channelLabel('syariah', 'id')]).toEqual(['Konvensional', 'Syariah']);
  });

  it('P18.98-T3 figures: a commission rate in the figures’ language, Indonesian when none is passed', () => {
    expect([formatRate(0.125, 'en'), formatRate(0.0725, 'en'), formatRate(0.4, 'en')]).toEqual(['12.5%', '7.25%', '40%']);
    expect([formatRate(0.125, 'id'), formatRate(0.125)]).toEqual(['12,5%', '12,5%']);
  });

  it('AC-7 the categories are §A.3’s tabs, kept and marked, in both languages', () => {
    expect(CATEGORY_TABS.map((c) => c.label)).toEqual(['Life', 'Health', 'Critical illness', 'Education', 'Investment-linked']);
    expect(CATEGORY_TABS.every((c) => isKept(c.label))).toBe(true);
  });

  /**
   * **D-copy in both languages** (ADR-0084's rule; P18.98-T1 AC-6): the module's words use none of OD-39's six words —
   * but for the prototype's *"Not uploaded by KPM yet."*, which goes to the client with OD-39 — and the Indonesian says
   * *KPM* there alone, the kept term (§A.5), never *kantor*.
   */
  describe('OD-39’s six words, held in each language’s messages', () => {
    const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;
    const AREAS = ['i18n/messages/product-catalog.ts', 'i18n/messages/sales-attack-plan.tsx', 'i18n/messages/plan.ts'];
    const texts = AREAS.map((area) => [area, catalogueTexts(area, readFileSync(join(SRC, area), 'utf8'))] as const);

    it('reads both languages of all three areas, so a silent zero cannot pass', () => {
      for (const [, t] of texts) {
        expect(t.en.length).toBeGreaterThan(10);
        expect(t.id.length).toBeGreaterThan(10);
      }
    });

    it('in English: only the prototype’s Not uploaded by KPM yet.', () => {
      const found = texts.flatMap(([area, t]) => t.en.filter((x) => SIX_WORDS.test(x.text)).map((x) => `${area}: ${x.text}`));
      expect(found).toEqual(['i18n/messages/product-catalog.ts: Not uploaded by KPM yet.']);
    });

    it('in Indonesian: KPM only as that line’s kept term, and no kantor anywhere', () => {
      const found = texts.flatMap(([area, t]) => t.id.filter((x) => SIX_WORDS.test(x.text)).map((x) => `${area}: ${x.text}`));
      expect(found).toEqual(['i18n/messages/product-catalog.ts: KPM']);
      expect(texts.flatMap(([, t]) => t.id.filter((x) => /\bkantor\b/i.test(x.text)))).toEqual([]);
    });
  });
});
