import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parse, renderable, sourceFiles, SRC, startOf } from '@test/copy-scan';

/**
 * **P18.95-T9: one name per role, and *Tap*** (ADR-0167 §10, OD-205; the client's UI review of 2026-10-26, UI-027:
 * *"AAB / Associate AB / Associate Agency Builder"*, and *"Click" instead of "Tap"*).
 *
 * Read off the syntax tree, as the phase and permission scans are (`@test/copy-scan`): a comment never counts, and
 * everything that can reach a screen does — JSX text, string literals and template literals, `lib/` among them.
 *
 * - **AC-1.** A role is called by its rung's name from the ladder (`rungShort`, `shortOfRung`: *AB*, *AAB*,
 *   *Agent* on the default ladder). The long forms are a second name for the same rung, so no string the app
 *   writes holds one. **One file may:** `lib/terms.ts`, whose ⓘ for *AAB* says what the letters stand for — the
 *   one place an acronym is spelled out, as the glossary's *Gloss* column does — and since P18.98-T4 its words are the
 *   catalogue's, `i18n/messages/terms.ts`, once in each language. Test fixtures are data a company
 *   could have typed, and are not the app's words.
 * - **AC-5.** An instruction says *Tap*: no rendered string tells a reader to click — in either language, now that
 *   the catalogue's messages are in the scan (P18.98-T1 AC-6): the Indonesian *klik* is the same instruction.
 */
const LONG_NAMES = /\bAssociate AB\b|\bAssociate Agency Builders?\b|\bAgency Builders?\b/;
const CLICK = /\bclick(?:s|ed|ing)?\b(?=\s+\S)|\bclick(?:s|ed|ing)?\b[.,:;!?]|\bklik\b/i;

/** Where the long form is the definition itself, and test data a company could have written. */
/*
 * The one definition (`terms.ts`), and *Profil saya*'s *Peran*, which UI-111 writes out — "AB · Agency Builder" (UI V1,
 * 2026-10-30; the later client request wins over P18.95-T9 for that one line).
 */
const MAY_SPELL_OUT = new Set(['i18n/messages/terms.ts', 'i18n/messages/account.ts']);
const isFixture = (file: string) => /fixtures?\.tsx?$/.test(file);

/** Every rendered string in `source` that `pattern` matches, as `line: text`. */
function mentions(fileName: string, source: string, pattern: RegExp): string[] {
  const sf = parse(fileName, source);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    // An import's path is not copy.
    if (ts.isImportDeclaration(node)) return;
    const text = renderable(node);
    if (text !== null && pattern.test(text)) {
      const { line } = sf.getLineAndCharacterOfPosition(startOf(node, sf));
      found.push(`${line + 1}: ${JSON.stringify(text.replace(/\s+/g, ' ').trim())}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('the names scan itself', () => {
  it.each([
    ['JSX text', '<p>an Agency Builder with a unit</p>'],
    ['a string literal', "const s = 'Agent → Associate Agency Builder';"],
    ['a template literal', 'const s = `This office has no Agency Builders ${x}`;'],
    ['the prototype’s legend', '<li>Associate AB</li>'],
  ])('P18.95-T9 AC-1 catches a long role name in %s', (_, code) => {
    expect(mentions('x.tsx', `export const X = () => { ${code} };`, LONG_NAMES)).toHaveLength(1);
  });

  it.each([
    ['a comment', '// the prototype said Agency Builder'],
    ['a JSX comment', '<p>{/* Associate AB */}AAB</p>'],
    ['the badge’s names', "<p>{'AB'} · {'AAB'} · Agent</p>"],
  ])('P18.95-T9 AC-1 ignores %s', (_, code) => {
    expect(mentions('x.tsx', `${code}\nexport const X = () => null;`, LONG_NAMES)).toEqual([]);
  });

  it.each([
    ['an instruction', '<p>Click any number to correct it</p>'],
    ['one in the middle of a sentence', "const s = 'No tips yet — click + above to add one.';"],
    ['one at a sentence’s end', "const s = 'Select a row and click.';"],
    ['an Indonesian message (P18.98-T1 AC-6)', "const id = { hint: 'Klik angka mana pun untuk mengoreksinya' };"],
  ])('P18.95-T9 AC-5 catches %s', (_, code) => {
    expect(mentions('x.tsx', `export const X = () => { ${code} };`, CLICK)).toHaveLength(1);
  });

  it.each([
    ['an event name', "el.addEventListener('click', go);"],
    ['a handler', '<button onClick={go}>Tap</button>'],
    ['a comment', '// a click anywhere on the card opens it'],
    ['the word Tap', '<p>Tap any number to correct it</p>'],
  ])('P18.95-T9 AC-5 ignores %s', (_, code) => {
    expect(mentions('x.tsx', `${code}\nexport const X = () => null;`, CLICK)).toEqual([]);
  });
});

describe('the app’s own words', () => {
  const files = sourceFiles();

  it('finds the screens at all, so a silent zero cannot pass', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain('components/ui/role-badge.tsx');
  });

  it('P18.95-T9 AC-1 names no role by a long form — every rung by its badge’s name, the ladder’s', () => {
    const offenders = files
      .filter((f) => !MAY_SPELL_OUT.has(f) && !isFixture(f))
      .flatMap((f) => mentions(f, readFileSync(join(SRC, f), 'utf8'), LONG_NAMES).map((hit) => `src/${f}:${hit}`));
    expect(offenders).toEqual([]);
  });

  it('P18.95-T9 AC-1 lets the one definition spell AAB out, and nothing else', () => {
    // Once in English and once in Indonesian (P18.98-T4: the tips moved into the catalogue).
    const path = 'i18n/messages/terms.ts';
    expect(mentions(path, readFileSync(join(SRC, path), 'utf8'), LONG_NAMES)).toHaveLength(2);
  });

  it('UI-111 lets Profil saya spell the rung out on its Peran line, and nowhere else in its catalogue', () => {
    const path = 'i18n/messages/account.ts';
    const hits = mentions(path, readFileSync(join(SRC, path), 'utf8'), LONG_NAMES);
    // `rungNames`, once in English and once in Indonesian: AB's and AAB's long names on each.
    expect(hits).toHaveLength(4);
    const lines = new Set(hits.map((hit) => hit.split(':')[0]));
    expect(lines.size).toBe(2);
    for (const line of lines) {
      expect(readFileSync(join(SRC, path), 'utf8').split('\n')[Number(line) - 1]).toMatch(/^\s*rungNames:/);
    }
  });

  it('P18.95-T9 AC-5 tells nobody to click: instructions say Tap', () => {
    const offenders = files
      .filter((f) => !isFixture(f))
      .flatMap((f) => mentions(f, readFileSync(join(SRC, f), 'utf8'), CLICK).map((hit) => `src/${f}:${hit}`));
    expect(offenders).toEqual([]);
  });
});
