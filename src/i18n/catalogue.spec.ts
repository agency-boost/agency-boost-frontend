import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalogueTexts } from '@test/copy-scan';
import { defineMessages, messagesIn, type MessageArea, type MessagesOf, type MessageTree } from './catalogue';
import { KEPT_ELSEWHERE, KEPT_ENGLISH, SAME_IN_INDONESIAN } from './glossary';
import { kept } from './kept';

/**
 * **P18.98-T1 AC-1: a typed catalogue of our own.** English is the source of a module's keys; its Indonesian is typed
 * against them. These are `tsc`'s to fail — each `@ts-expect-error` below is a mistake the type must refuse, and
 * `pnpm typecheck` fails the day one of them stops being refused.
 */
describe('P18.98-T1 AC-1 the Indonesian is typed against the English', () => {
  const en = {
    save: 'Save',
    saved: ({ n }: { n: number }) => (n === 1 ? '1 lead saved' : `${n} leads saved`),
    nav: kept('Activity management'),
    menu: { open: 'Open menu' },
  };

  it('takes an Indonesian with the same keys, each the same kind, each kept term the same', () => {
    const id: MessagesOf<typeof en> = {
      save: 'Simpan',
      // Its own word order, and no plural: §B.0 rule 8.
      saved: ({ n }) => `${n} ${kept('leads')} tersimpan`,
      nav: kept('Activity management'),
      menu: { open: 'Buka menu' },
    };
    const area = defineMessages({ en, id });

    expect(messagesIn(area, 'en').saved({ n: 1 })).toBe('1 lead saved');
    expect(messagesIn(area, 'en').saved({ n: 3 })).toBe('3 leads saved');
    expect(messagesIn(area, 'id').saved({ n: 3 })).toBe('3 leads tersimpan');
    expect(messagesIn(area, 'id').nav).toBe(messagesIn(area, 'en').nav);
  });

  it('refuses a key missing, extra or misspelt, a value renamed, and a kept term translated', () => {
    // @ts-expect-error — `menu` is missing
    const missing: MessagesOf<typeof en> = {
      save: 'Simpan', saved: ({ n }) => `${n}`, nav: kept('Activity management'),
    };
    const extra: MessagesOf<typeof en> = {
      save: 'Simpan', saved: ({ n }) => `${n}`, nav: kept('Activity management'), menu: { open: 'Buka menu' },
      // @ts-expect-error — a key the English does not have
      cancel: 'Batal',
    };
    const misspelt: MessagesOf<typeof en> = {
      // @ts-expect-error — `sve` for `save`: one key extra, and…
      sve: 'Simpan', saved: ({ n }) => `${n}`, nav: kept('Activity management'), menu: { open: 'Buka menu' },
    };
    const nestedExtra: MessagesOf<typeof en> = {
      save: 'Simpan', saved: ({ n }) => `${n}`, nav: kept('Activity management'),
      // @ts-expect-error — a group's keys are held to the English's too
      menu: { open: 'Buka menu', close: 'Tutup menu' },
    };
    const renamed: MessagesOf<typeof en> = {
      save: 'Simpan',
      // @ts-expect-error — the value is `n`, not `count`
      saved: ({ count }: { count: number }) => `${count}`,
      nav: kept('Activity management'), menu: { open: 'Buka menu' },
    };
    const translatedKept: MessagesOf<typeof en> = {
      save: 'Simpan', saved: ({ n }) => `${n}`,
      // @ts-expect-error — a kept term reads the same in both languages (§A)
      nav: 'Manajemen aktivitas',
      menu: { open: 'Buka menu' },
    };
    const anotherKept: MessagesOf<typeof en> = {
      save: 'Simpan', saved: ({ n }) => `${n}`,
      // @ts-expect-error — and it is the same term, not another kept one
      nav: kept('Leads management'),
      menu: { open: 'Buka menu' },
    };
    const notAFunction: MessagesOf<typeof en> = {
      save: 'Simpan',
      // @ts-expect-error — a message with values stays a function of them
      saved: '3 tersimpan',
      nav: kept('Activity management'), menu: { open: 'Buka menu' },
    };

    expect([missing, extra, misspelt, nestedExtra, renamed, translatedKept, anotherKept, notAFunction]).toHaveLength(8);
  });
});

/** Every area under `messages/`, found by reading the directory: an area registers nowhere. */
const DIR = join(__dirname, 'messages');
const AREA_FILES = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !f.includes('.spec.'));
const MODULES = await Promise.all(
  AREA_FILES.map(async (file) => [file, (await import(join(DIR, file))) as Record<string, unknown>] as const),
);

/** An exported value shaped as `defineMessages` makes one. */
function isArea(value: unknown): value is MessageArea<MessageTree> {
  return typeof value === 'object' && value !== null
    && typeof (value as Record<string, unknown>).en === 'object' && typeof (value as Record<string, unknown>).id === 'object';
}

const AREAS = MODULES.flatMap(([file, module]) =>
  Object.entries(module).filter(([, value]) => isArea(value)).map(([name, area]) => [`${file} › ${name}`, area as MessageArea<MessageTree>] as const));

const KEPT_TERMS: ReadonlySet<string> = new Set(Object.values(KEPT_ENGLISH).flat());
const SAME: ReadonlySet<string> = new Set(SAME_IN_INDONESIAN);
/** §B's words spelled as a kept term elsewhere (`KEPT_ELSEWHERE`): translated where they are not that term. */
const ELSEWHERE: ReadonlySet<string> = new Set(KEPT_ELSEWHERE);

/** Where the two languages part: a key in one and not the other, a kind that differs, a kept term translated. */
function mismatches(en: MessageTree, id: MessageTree, path = ''): string[] {
  const keys = [...new Set([...Object.keys(en), ...Object.keys(id)])].sort();
  return keys.flatMap((key) => {
    const at = `${path}${key}`;
    const [a, b] = [en[key], id[key]];
    if (a === undefined || b === undefined) return [`${at}: in ${a === undefined ? 'the Indonesian' : 'the English'} only`];
    if (typeof a !== typeof b) return [`${at}: ${typeof a} in English, ${typeof b} in Indonesian`];
    if (typeof a === 'object') return mismatches(a as MessageTree, b as MessageTree, `${at}.`);
    if (typeof a === 'string' && KEPT_TERMS.has(a) && !ELSEWHERE.has(a) && a !== b) {
      return [`${at}: the kept term ${JSON.stringify(a)} translated`];
    }
    return [];
  });
}

/** The words written alike in both languages that the glossary neither keeps nor spells alike in Indonesian. */
function untranslated(en: MessageTree, id: MessageTree, path = ''): string[] {
  return Object.keys(en).flatMap((key) => {
    const [a, b] = [en[key], id[key]];
    if (typeof a === 'object' && typeof b === 'object') return untranslated(a as MessageTree, b as MessageTree, `${path}${key}.`);
    return typeof a === 'string' && a === b && !KEPT_TERMS.has(a) && !SAME.has(a) ? [`${path}${key}: ${JSON.stringify(a)}`] : [];
  });
}

/**
 * **Every area, read whole** (AC-1, AC-7; and T4 AC-2's check, built here so each module meets it as it moves).
 * `tsc` holds an area's Indonesian to its English where the Indonesian is annotated; this holds every area, however
 * it was written, and catches what types cannot: an Indonesian left in English.
 */
describe('P18.98-T1 the catalogue’s areas', () => {
  it('finds the areas at all, so a silent zero cannot pass', () => {
    expect(AREA_FILES).toContain('shell.ts');
    expect(AREAS.map(([name]) => name)).toContain('shell.ts › shellMessages');
  });

  it.each(MODULES)('%s exports its words as an area', (_, module) => {
    expect(Object.values(module).filter(isArea).length).toBeGreaterThan(0);
  });

  describe.each(AREAS)('%s', (_, area) => {
    it('AC-1 has the same keys in both languages, each the same kind, each kept term the same', () => {
      expect(mismatches(area.en, area.id as MessageTree)).toEqual([]);
    });

    it('T4 AC-2 writes nothing alike in both languages that the glossary neither keeps nor spells alike', () => {
      expect(untranslated(area.en, area.id as MessageTree)).toEqual([]);
    });

    it('AC-1 writes no message empty', () => {
      const empty = (tree: MessageTree): number => Object.values(tree).reduce<number>(
        (n, m) => n + (typeof m === 'object' ? empty(m as MessageTree) : m === '' ? 1 : 0), 0);
      expect(empty(area.en) + empty(area.id as MessageTree)).toBe(0);
    });
  });
});

/**
 * **AC-6: OD-39's held-word specs read both languages' messages.** A module's spec reads its area with
 * `catalogueTexts` (`@test/copy-scan`) and holds each language to its own words — shown here on the first area.
 */
describe('P18.98-T1 AC-6 an area’s words, language by language', () => {
  const texts = catalogueTexts('shell.ts', readFileSync(join(DIR, 'shell.ts'), 'utf8'));
  const words = (language: 'en' | 'id') => texts[language].map((t) => t.text);

  it('reads the English and the Indonesian apart, a sentence with its value left as {…}', () => {
    expect(words('en')).toEqual(expect.arrayContaining(['Sign out', 'Open menu', '{…}, {…} unread']));
    expect(words('id')).toEqual(expect.arrayContaining(['Keluar', 'Buka menu', '{…}, {…} belum dibaca']));
    expect(words('en')).not.toContain('Keluar');
    expect(words('id')).not.toContain('Sign out');
  });

  it('reads a kept term written into an Indonesian sentence as its own text', () => {
    expect(words('id')).toEqual(expect.arrayContaining(['Buka tampilan {…}', 'Agent']));
  });

  it('holds each language to its own words, as a module’s held-word spec does (OD-39: KPM is ID mode’s word, §B.9)', () => {
    const OFFICE_EN = /\boffice\b/i;
    const OFFICE_ID = /\bkantor\b/i;
    expect(words('en').filter((w) => OFFICE_EN.test(w))).toEqual(['No office yet']);
    expect(words('id').filter((w) => OFFICE_ID.test(w))).toEqual([]);
    expect(words('id')).toContain('KPM');
  });
});
