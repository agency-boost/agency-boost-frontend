import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/**
 * What the copy scans share: which files can put words on a screen, and which nodes of a file are
 * those words (`src/app/no-phase-in-copy.spec.ts`, P10.1-T2 AC-4; `src/app/no-permission-code-in-copy
 * .spec.ts`, P11-T6). Each scan decides what it is looking for; this decides where to look.
 *
 * **It reads the syntax tree, not the text,** so a comment never counts. Comments are where our own
 * vocabulary belongs — a phase, a permission — and the source is full of them.
 */

/** Where a value is spliced into a run of text: the scans see the hole, as a reader sees the value. */
export const HOLE = '{…}';

/** `src/lib` is in the scan too: its error messages and labels are rendered by the screens that import them. */
const ROOTS = ['app', 'components', 'lib'] as const;

export const SRC = join(__dirname, '..', 'src');

/**
 * Every source file a screen is built from, relative to `src/`; specs are not shipped.
 *
 * `readdirSync(…, { recursive })`, not `globSync`: CI runs Node 20, and `globSync` is Node 22's.
 */
export function sourceFiles(): string[] {
  return ROOTS.flatMap((root) =>
    readdirSync(join(SRC, root), { encoding: 'utf8', recursive: true })
      .filter((f) => /\.tsx?$/.test(f) && !f.includes('.spec.'))
      .map((f) => `${root}/${f}`),
  );
}

/** Parse one file as the compiler would, by its extension. */
export function parse(fileName: string, source: string): ts.SourceFile {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
}

/** The text a node can put on a screen, with `{…}` where a value is spliced in; `null` for anything else. */
export function renderable(node: ts.Node): string | null {
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

/** Where a node starts for a reader of the file: JSX text has no trivia, so its `pos` is its first character. */
export function startOf(node: ts.Node, sf: ts.SourceFile): number {
  return ts.isJsxText(node) ? node.pos : node.getStart(sf);
}
