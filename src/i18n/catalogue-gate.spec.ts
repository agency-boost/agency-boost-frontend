import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parse, sourceFiles, SRC, startOf } from '@test/copy-scan';

/**
 * **The registry of moved modules, kept by the areas themselves** (P18.98-T1 AC-6). An area's header names each module
 * whose words are all in it, one `@moved <path>` line per file or directory (`components/training/`), relative to
 * `src/` and added in the change that moves it. From then on a word written into that module fails here, and goes into
 * the area instead. Nothing central is edited: two agents moving two modules touch two areas.
 */
const MESSAGES = join(SRC, 'i18n', 'messages');

/** Every `@moved` line, with the area that declares it. */
function registry(): { area: string; path: string }[] {
  return readdirSync(MESSAGES)
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('.spec.'))
    .flatMap((area) => [...readFileSync(join(MESSAGES, area), 'utf8').matchAll(/@moved\s+(\S+)/g)]
      .map((m) => ({ area, path: m[1] })));
}

const MOVED = registry();

/**
 * A prop or an attribute that carries words: the four the acceptance criterion names, `alt` and `subtitle`, and any
 * named for a label, a title or a placeholder (`upcomingLabel`, `emptyTitle`).
 */
const WORDED = /^(?:aria-label|alt|label|placeholder|subtitle|title)$|(?:Label|Title|Placeholder)$/;
const LETTER = /\p{L}/u;
/** A literal handed to a function inside a worded attribute reads as words — not a code — when it has a space, a capital or a sentence's end. */
const READS_AS_WORDS = /\s|^\p{Lu}|[.…:?!]$/u;

type Literal = ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression;

function isLiteral(node: ts.Node): node is Literal {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node);
}

/** A kept-English term, `kept('…')`: the catalogue's own list, typed against it, so not a word of the module's. */
function isKeptCall(node: ts.Node): boolean {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'kept';
}

/** What a literal writes: its text, or a template's own words with its values left out. */
function wordsOf(node: Literal): string {
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ');
  return node.text;
}

const JOINING = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken,
]);

/** The literals an expression writes as they are — through `?:`, `&&`, `||`, `??`, `+`, brackets and casts, never into a call. */
function direct(expr: ts.Expression): Literal[] {
  if (isLiteral(expr)) return [expr];
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isNonNullExpression(expr)) {
    return direct(expr.expression);
  }
  if (ts.isConditionalExpression(expr)) return [...direct(expr.whenTrue), ...direct(expr.whenFalse)];
  if (ts.isBinaryExpression(expr) && JOINING.has(expr.operatorToken.kind)) return [...direct(expr.left), ...direct(expr.right)];
  return [];
}

/** Every literal anywhere in an expression, but inside `kept(…)`. */
function within(node: ts.Node): Literal[] {
  if (isKeptCall(node)) return [];
  const own = isLiteral(node) ? [node] : [];
  const nested: Literal[] = [];
  ts.forEachChild(node, (child) => { nested.push(...within(child)); });
  return [...own, ...nested];
}

function nameOf(name: ts.PropertyName | ts.JsxAttributeName, sf: ts.SourceFile): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isPrivateIdentifier(name)) return name.text;
  return name.getText(sf);
}

/**
 * **The words a file writes itself** (AC-6), as `line: text`: JSX text; a literal written straight into JSX
 * (`{busy ? 'Saving…' : 'Save'}`); and a literal in a worded attribute or property — `title`, `label`, `aria-label`,
 * `placeholder` and their kind. Read off the syntax tree, as the copy scans are, so a comment never counts; a kept
 * term (`kept('…')`) and a message (`t.save`) are the catalogue's, and are not words of the file's.
 */
function ownWords(fileName: string, source: string): string[] {
  const sf = parse(fileName, source);
  const found: string[] = [];
  const report = (node: ts.Node, text: string) => {
    const { line } = sf.getLineAndCharacterOfPosition(startOf(node, sf));
    found.push(`${line + 1}: ${JSON.stringify(text.replace(/\s+/g, ' ').trim())}`);
  };
  const visit = (node: ts.Node): void => {
    if (isKeptCall(node)) return;
    if (ts.isJsxText(node)) {
      if (LETTER.test(node.text)) report(node, node.text);
    } else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      for (const literal of direct(node.expression)) if (LETTER.test(wordsOf(literal))) report(literal, wordsOf(literal));
    } else if (ts.isJsxAttribute(node) && WORDED.test(nameOf(node.name, sf)) && node.initializer) {
      const value = node.initializer;
      if (ts.isStringLiteral(value)) {
        if (LETTER.test(value.text)) report(value, value.text);
      } else if (ts.isJsxExpression(value) && value.expression) {
        const straight = new Set<ts.Node>(direct(value.expression));
        for (const literal of within(value.expression)) {
          const words = wordsOf(literal);
          if (LETTER.test(words) && (straight.has(literal) || READS_AS_WORDS.test(words))) report(literal, words);
        }
      }
    } else if (ts.isPropertyAssignment(node) && WORDED.test(nameOf(node.name, sf))) {
      for (const literal of direct(node.initializer)) if (LETTER.test(wordsOf(literal))) report(literal, wordsOf(literal));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('the gate itself', () => {
  const offenders = (code: string) => ownWords('x.tsx', `export const X = () => { ${code} };`);

  it.each([
    ['JSX text', 'return <p>Sign out</p>;'],
    ['JSX text beside a message', 'return <p>{t.count} unread</p>;'],
    ['a literal written into JSX', "return <p>{'Sign out'}</p>;"],
    ['either branch written into JSX', "return <p>{busy ? 'Signing out…' : t.signOut}</p>;"],
    ['a template written into JSX', 'return <p>{`${n} unread`}</p>;'],
    ['a title', 'return <span title="Collapse the sidebar" />;'],
    ['a label', 'return <Field label="Name" />;'],
    ['an aria-label', 'return <nav aria-label="Main" />;'],
    ['a placeholder', 'return <input placeholder="Search…" />;'],
    ['an attribute’s branch', "return <button aria-label={rail ? 'Expand the sidebar' : t.collapse} />;"],
    ['a sentence handed to a helper in an attribute', "return <button aria-label={withUnread('Notifications', n)} />;"],
    ['a prop named for its words', 'return <AppShell upcomingLabel="Soon" />;'],
    ['a label in an object', "const item = { label: 'Unit dashboard', href: '/unit' };"],
    ['a title in an object, in a branch', "const s = { title: open ? 'Open' : t.closed };"],
  ])('AC-6 catches %s', (_, code) => {
    expect(offenders(code)).toHaveLength(1);
  });

  it.each([
    ['a comment', '// Sign out\n/* Your account */ return null;'],
    ['a JSX comment', 'return <p>{/* Your account */}{t.yourAccount}</p>;'],
    ['a message', 'return <button aria-label={t.closeMenu}>{t.signOut}</button>;'],
    ['a kept term', "return <span title={kept('AgencyBoost')}>{kept('AgencyBoost')}</span>;"],
    ['a kept term in an object', "const item = { label: kept('Unit dashboard'), href: '/unit' };"],
    ['a kept term handed to a helper', "return <button aria-label={withUnread(kept('Notifications'), n, language)} />;"],
    ['symbols with no letter', "return <span>{open ? '▾' : '▴'} · — →</span>;"],
    ['a name joined from values', 'return <span title={`${user.name} — ${user.role}`} />;'],
    ['a class, an address, an id and a role', 'return <a className="flex gap-2" href="/profile" id="menu" role="dialog" />;'],
    ['a code handed to a helper', "return <span title={labelFor('short')} />;"],
    ['a data value and an icon', "const item = { icon: 'gauge', href: '/kpm/overview' };"],
  ])('AC-6 lets %s through', (_, code) => {
    expect(offenders(code)).toEqual([]);
  });

  it('names the line a word is on', () => {
    expect(ownWords('x.tsx', 'export const X = () => (\n  <div>\n    <p>Sign out</p>\n  </div>\n);')).toEqual(['3: "Sign out"']);
  });
});

describe('P18.98-T1 AC-6 a module already moved keeps its words in the catalogue', () => {
  const files = sourceFiles();
  const covered = (entry: string) => files.filter((f) => (entry.endsWith('/') ? f.startsWith(entry) : f === entry));
  const paths = MOVED.map((m) => m.path);

  it('reads the registry off the areas, the first one’s eight modules among it', () => {
    expect(MOVED.filter((m) => m.area === 'shell.ts').map((m) => m.path)).toEqual([
      'components/app-shell.tsx', 'components/sidebar-user-menu.tsx', 'components/notification-bell.tsx',
      'components/agent-shell.tsx', 'components/tenant-shell.tsx', 'components/admin-shell.tsx',
      'lib/landing.ts', 'lib/profile-line.ts',
    ]);
  });

  it('names, on every line, a module that is there, and each module once', () => {
    expect(MOVED.filter((m) => covered(m.path).length === 0)).toEqual([]);
    expect(paths.filter((path, i) => paths.indexOf(path) !== i)).toEqual([]);
  });

  it('holds no part of the catalogue to it: the messages are where the words go', () => {
    expect(paths.filter((path) => path.startsWith('i18n/'))).toEqual([]);
  });

  it('finds no word a moved module writes itself', () => {
    const offenders = paths.flatMap(covered).flatMap((f) =>
      ownWords(f, readFileSync(join(SRC, f), 'utf8')).map((hit) => `src/${f}:${hit}`));
    expect(offenders).toEqual([]);
  });
});
