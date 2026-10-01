import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * P10.1-T2 AC-4. **No screen tells a customer our schedule.**
 *
 * A phase number is our schedule, and a customer can do nothing with it (ADR-0062 §3). Every one of
 * them went stale on the day the roadmap was re-planned: *Arrives in phase 13* on a placeholder that
 * phase 15 builds, *from phase 12* on a fit check that phase 14 builds. Taking them out once is the
 * easy half; this is the other half, the structural one, in the spirit of P3.6-T5's `PasswordInput`
 * scan (`components/ui/password-input.spec.tsx`): the guarantee is about how the copy is *written*.
 *
 * **It reads the syntax tree, not the text,** so a comment never counts. Comments are where a phase
 * belongs — *why* this code is shaped the way it is, for the people who maintain it — and the source
 * is full of them. What it reads is everything that can reach a screen: JSX text, string literals
 * (attribute values among them) and template literals.
 *
 * `phase {n}` has three spellings, and the text alone ends at *"phase "* in all of them, so each
 * leaves a `{…}` where the value goes and the pattern sees the hole:
 *
 * - JSX text followed by a value: `Arrives in phase {phase}`, and with it the house style's
 *   `phase{' '}{phase}`, `phase <strong>{phase}</strong>` and a JSX comment between the word and
 *   the value: the walk steps over a `{' '}`, a comment and blank text to the first thing that renders;
 * - a template literal: `` `Arrives in phase ${phase}` ``;
 * - a concatenation: `'Arrives in phase ' + phase`.
 *
 * JSX folds a line break into one space when it renders, so the pattern takes any run of whitespace
 * where the acceptance criterion writes one space, and none at all before a hole: `{' '}` is the
 * space, and it was folded into the text on the way.
 */
const PATTERN = /\bphase\s*\{|\bphase\s+\d|\blater\s+phase\b/i;
const HOLE = '{…}';

/** `src/lib` is in the scan too: its error messages and labels are rendered by the screens that import them. */
const ROOTS = ['app', 'components', 'lib'] as const;
const SRC = join(__dirname, '..');

/** The text a node can put on a screen, with `{…}` where a value is spliced in; `null` for anything else. */
function renderable(node: ts.Node): string | null {
  if (ts.isJsxText(node)) {
    const parent = node.parent;
    const siblings: readonly ts.Node[] = ts.isJsxElement(parent) || ts.isJsxFragment(parent) ? parent.children : [];
    let text = node.text;
    for (const next of siblings.slice(siblings.indexOf(node) + 1)) {
      // `{/* … */}` is an expression container holding only a comment: nothing is spliced in.
      if (ts.isJsxExpression(next) && !next.expression) continue;
      // `{' '}` is the house style's space before a value: it is text, so it joins the run.
      if (ts.isJsxExpression(next) && next.expression && ts.isStringLiteralLike(next.expression) && !next.expression.text.trim()) {
        text += next.expression.text;
        continue;
      }
      if (ts.isJsxText(next)) {
        if (next.containsOnlyTriviaWhiteSpaces) continue;
        break;
      }
      // `{expr}`, `<strong>{phase}</strong>`, `<X />`: something is spliced in here.
      text += HOLE;
      break;
    }
    return text;
  }
  if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node)) return node.text + HOLE;
  if (ts.isTemplateTail(node)) return node.text;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    const { parent } = node;
    const concatenated = ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.PlusToken;
    return node.text + (concatenated ? HOLE : '');
  }
  return null;
}

/** Every phase in `source`'s renderable strings, as `line: text`. Comments are trivia, and never visited. */
function phaseMentions(fileName: string, source: string): string[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const found: string[] = [];

  const visit = (node: ts.Node): void => {
    const text = renderable(node);
    if (text !== null && PATTERN.test(text)) {
      // JSX text has no trivia, so its `pos` is its first character and a match inside a multi-line
      // run lands on its own line; anything else starts at its token.
      const start = ts.isJsxText(node) ? node.pos : node.getStart(sf);
      const at = sf.text.slice(start, node.end).search(PATTERN);
      const { line } = sf.getLineAndCharacterOfPosition(at >= 0 ? start + at : start);
      found.push(`${line + 1}: ${JSON.stringify(text.replace(/\s+/g, ' ').trim())}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('the phase scan itself', () => {
  it.each([
    ['JSX text', '<p>Arrives in phase 13</p>'],
    ['JSX text, capitalised and broken across lines', '<p>Built in\n      Phase\n      15</p>'],
    ['JSX text before the value it names', '<p>Arrives in phase {phase}</p>'],
    ['JSX text right against the value', '<p>Arrives in phase{phase}</p>'],
    ['JSX text, a spacer and the value', "<p>Arrives in phase{' '}{phase}</p>"],
    ['JSX text, a spacer and the value on the next line', "<p>Arrives in phase{' '}\n      {phase}</p>"],
    ['JSX text before the value in an element', '<p>Arrives in phase <strong>{phase}</strong></p>'],
    ['JSX text, a JSX comment and the value', '<p>Arrives in phase {/* n */}{phase}</p>'],
    ['an attribute value', '<span title="ticked until it works from phase 12" />'],
    ['a string literal', "const hint = 'Used by the periods that arrive in a later phase.';"],
    ['a template literal', 'const eyebrow = `Arrives in phase ${phase}`;'],
    ['a template literal’s tail', 'const s = `${what}, from phase 14`;'],
    ['a concatenation', "const eyebrow = 'Arrives in phase ' + phase;"],
  ])('catches a phase in %s', (_, code) => {
    expect(phaseMentions('x.tsx', `export const X = () => { ${code} };`)).toHaveLength(1);
  });

  it.each([
    ['a line comment', '// Arrives in phase 13, which is the registry’s to say'],
    ['a block comment', '/* phase 12 builds the roster picker */'],
    ['a doc comment', '/** Built in Phase 13. */'],
    ['a JSX comment', '<p>{/* It said "arrives in a later phase" */}Branch info</p>'],
    ['JSX text beside a JSX comment', '<p>Your phase {/* 13 */}</p>'],
    ['a field and an index named phase', 'const t = PHASE[event.phase].text; const n = { phase: 12 };'],
    ['a status named for its phase', "const s: 'upcoming' | 'running' = 'upcoming';"],
    ['the placeholder’s import path', "import { ComingInPhase } from '@/components/coming-in-phase';"],
    ['the word on its own', '<p>Upcoming</p>'],
  ])('ignores %s', (_, code) => {
    expect(phaseMentions('x.tsx', `${code}\nexport const X = () => null;`)).toEqual([]);
  });

  it('names the line the phase is on', () => {
    const source = ['export const X = () => (', '  <section>', '    <h2>Overview</h2>', '    <p>', '      Arrives in phase 18', '    </p>', '  </section>', ');'].join('\n');
    expect(phaseMentions('x.tsx', source)).toEqual(['5: "Arrives in phase 18"']);
  });
});

describe('no screen tells a customer our schedule', () => {
  // `readdirSync(…, { recursive })`, not `globSync`: CI runs Node 20, and `globSync` is Node 22's.
  const files = ROOTS.flatMap((root) =>
    readdirSync(join(SRC, root), { encoding: 'utf8', recursive: true })
      .filter((f) => /\.tsx?$/.test(f) && !f.includes('.spec.'))
      .map((f) => `${root}/${f}`),
  );

  it('finds the screens at all, so a silent zero cannot pass', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain('components/coming-in-phase.tsx');
  });

  it('no rendered string names a phase', () => {
    const offenders = files.flatMap((f) =>
      phaseMentions(f, readFileSync(join(SRC, f), 'utf8')).map((hit) => `src/${f}:${hit}`),
    );
    expect(offenders).toEqual([]);
  });
});
