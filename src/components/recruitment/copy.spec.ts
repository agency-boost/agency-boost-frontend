import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { catalogueTexts, parse, renderable, sourceFiles, SRC } from '@test/copy-scan';

/**
 * The recruitment pitch's own strings use none of OD-39's six words (D-copy, P17-T5 AC-8, P17-T6
 * AC-7): *office*, *KPM*, *reports to*, *tagged to*, *untagged*, *unassigned*. The prototype's verbatim
 * words that carry one — *"Steps to register, documents needed, and KPM tagging."* — are the server's
 * constants and go to the client with OD-39; nothing in these files writes one.
 *
 * Read from the syntax tree, as the phase and permission scans are, so a comment never counts. A literal
 * with no space in it is a code, a path or a permission, not copy — `audience === 'office'` names a
 * view, `/kpm/settings/…` a route, and nobody reads either.
 */
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

const MINE = [
  'components/recruitment/',
  'lib/recruitment-pitch.ts',
  'app/(tenant)/kpm/settings/recruitment-pitch/',
  'app/(agent)/recruitment/pitch-materials/',
];

function sixWords(fileName: string, source: string): string[] {
  const sf = parse(fileName, source);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const text = renderable(node);
    if (text !== null && /\s/.test(text.trim()) && SIX_WORDS.test(text)) {
      found.push(JSON.stringify(text.replace(/\s+/g, ' ').trim()));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('the recruitment pitch’s own copy', () => {
  const files = sourceFiles().filter((f) => MINE.some((m) => f.startsWith(m)));

  it('finds the module’s files, so a silent zero cannot pass', () => {
    expect(files).toEqual(expect.arrayContaining([
      'components/recruitment/pitch-card.tsx',
      'components/recruitment/pitch-banner.tsx',
      'components/recruitment/pitch-materials.tsx',
      'components/recruitment/pdf-upload.tsx',
      'lib/recruitment-pitch.ts',
      'app/(tenant)/kpm/settings/recruitment-pitch/page.tsx',
      'app/(agent)/recruitment/pitch-materials/page.tsx',
    ]));
  });

  it('catches a sentence that names one, and lets a code through', () => {
    expect(sixWords('x.tsx', 'export const X = () => <p>Ask your office</p>;')).toHaveLength(1);
    expect(sixWords('x.ts', "export const a = 'Uploaded by KPM yet.';")).toHaveLength(1);
    expect(sixWords('x.ts', "export const a = (v: string) => v === 'office';")).toEqual([]);
    expect(sixWords('x.ts', "export const a = api('/kpm/settings/x');")).toEqual([]);
    expect(sixWords('x.ts', '// the office uploads\nexport const a = 1;')).toEqual([]);
  });

  it('writes none of OD-39’s six words', () => {
    const offenders = files.flatMap((f) =>
      sixWords(f, readFileSync(join(SRC, f), 'utf8')).map((hit) => `src/${f}: ${hit}`),
    );
    expect(offenders).toEqual([]);
  });
});

/**
 * **P18.98-T4: the pitch's words are the catalogue's now** (`i18n/messages/recruitment-pitch.ts`), so the rule is held
 * there, language by language (P18.98-T1 AC-6, `catalogueTexts`): none of the six words in the English, and none in the
 * Indonesian either — not *KPM*, ID mode's word for *office* (§B.9), since the pitch's own words name no office, and
 * not *kantor*.
 */
describe('P18.98-T4 the recruitment pitch’s catalogue, language by language', () => {
  const AREA = 'i18n/messages/recruitment-pitch.ts';
  const texts = catalogueTexts(AREA, readFileSync(join(SRC, AREA), 'utf8'));

  it('reads both languages, so a silent zero cannot pass', () => {
    expect(texts.en.map((t) => t.text)).toEqual(expect.arrayContaining(['Missing', 'Uploaded · needs confirmation']));
    expect(texts.id.map((t) => t.text)).toEqual(expect.arrayContaining(['Belum ada', 'Terunggah · perlu konfirmasi']));
  });

  it.each(['en', 'id'] as const)('writes none of OD-39’s six words in %s', (language) => {
    expect(texts[language].filter((t) => SIX_WORDS.test(t.text)).map((t) => `${t.line}: ${t.text}`)).toEqual([]);
  });

  it('writes no *kantor* in Indonesian', () => {
    expect(texts.id.filter((t) => /\bkantor\b/i.test(t.text))).toEqual([]);
  });
});
