import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parse, renderable, sourceFiles, SRC, startOf } from '@test/copy-scan';

/**
 * P11-T6 AC-12. **No screen shows a customer a permission code.**
 *
 * `coaching_session:read` is our vocabulary, as a phase number is our schedule (ADR-0062 §3): a
 * reader can do nothing with it. This is the other half of `no-phase-in-copy.spec.ts`, and reads the
 * same syntax tree the same way (`test/copy-scan.ts`), so a comment never counts.
 *
 * **Two halves, because a code reaches a screen two ways.**
 *
 * - **Written into the copy**: JSX text, a string or a template literal that holds one. A permission
 *   code has a shape — `resource:action`, both snake_case — but so does a Tailwind variant
 *   (`md:hidden`) and so does a command (`pnpm seed:demo`), so the shape alone is not the test: the
 *   **resource** must be one of ours. The resources are those of every code this repository gates
 *   on, the three this criterion names, and, when the superproject is checked out around this
 *   repository, every code in the backend's catalog.
 * - **Spliced in from a value**: `This screen needs the {permission} permission` is how the one code
 *   that ever reached a screen got there (`require-session.tsx`, until P11-T6), and no literal scan
 *   can see it. So a value named `permission` or `permissions` — `{permission}`,
 *   `{error.details.permission}`, `` `${permission}` `` — fails wherever it would render.
 *
 * **A code in a gate is not copy.** `permission="lead:read"` on a page, `useCan('lead:read')`,
 * `me.permissions.includes(…)` and a tab's `needs` are how the screens decide what to show, and the
 * reader never sees them. Nor is `data-permission`, which keeps a refusal's code where a test can read
 * it and nobody is shown it.
 */

/** `resource:action`, both snake_case. Not inside a longer token, so `[&_th]:px-2` and `bg-x:y` stay out. */
const SHAPE = /(?<![\w-])([a-z][a-z0-9]*(?:_[a-z0-9]+)*):([a-z][a-z0-9]*(?:_[a-z0-9]+)*)(?![\w-])/g;

/** Named by the criterion, so they are held whatever else this repository gates on today. */
const NAMED_RESOURCES = ['coaching_session', 'leader_notes', 'coaching_profile'] as const;

/** The backend's catalog (`PERMISSIONS`), when this repository sits in the superproject. */
const CATALOG = join(SRC, '..', '..', 'backend', 'src', 'modules', 'rbac', 'permissions.ts');

/** A prop, a parameter or a field under which a code is the gate it names. */
const GATE_NAMES = new Set(['permission', 'permissions', 'needs']);
/** Calls that take a code to check it. */
const GATE_CALLS = new Set(['useCan', 'can']);
/** What a spliced value is called when it holds a code. */
const VALUE_NAMES = new Set(['permission', 'permissions']);

function nameOf(node: ts.Node | undefined): string {
  if (!node) return '';
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) return node.text;
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isJsxNamespacedName(node)) return `${node.namespace.text}:${node.name.text}`;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return '';
}

/**
 * The node a literal stands for, past what does not change it: parentheses, `as const`, `satisfies`,
 * a ternary's arm, `??` and `||`, an array of them, and the braces of a JSX value.
 */
function standingFor(node: ts.Node): ts.Node {
  let at = node;
  for (let up = at.parent; up; at = up, up = at.parent) {
    const passes =
      ts.isParenthesizedExpression(up) || ts.isAsExpression(up) || ts.isSatisfiesExpression(up) ||
      ts.isArrayLiteralExpression(up) || ts.isJsxExpression(up) ||
      (ts.isConditionalExpression(up) && up.condition !== at) ||
      (ts.isBinaryExpression(up) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(up.operatorToken.kind));
    if (!passes) break;
  }
  return at;
}

/** Is this literal a gate — a code the screen checks — rather than words it shows? */
function isGate(literal: ts.Node): boolean {
  const at = standingFor(literal);
  const up = at.parent;
  if (!up) return false;
  if (ts.isJsxAttribute(up)) return GATE_NAMES.has(nameOf(up.name));
  if ((ts.isPropertyAssignment(up) || ts.isParameter(up) || ts.isBindingElement(up) || ts.isVariableDeclaration(up))
    && up.initializer === at) {
    return GATE_NAMES.has(nameOf(up.name));
  }
  if (ts.isCallExpression(up) && up.arguments.includes(at as ts.Expression)) {
    const callee = up.expression;
    if (GATE_CALLS.has(nameOf(callee))) return true;
    // `me.permissions.includes('lead:read')`, `permissions.some(…)`.
    return ts.isPropertyAccessExpression(callee) && VALUE_NAMES.has(nameOf(callee.expression));
  }
  return false;
}

/** Does this expression hold a permission by its name — `permission`, `x.permissions`, `permissions.join(…)`? */
function namesAPermission(expr: ts.Expression | undefined): boolean {
  if (!expr) return false;
  if (ts.isParenthesizedExpression(expr) || ts.isNonNullExpression(expr)) return namesAPermission(expr.expression);
  if (ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr)) return VALUE_NAMES.has(nameOf(expr));
  if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression)) {
    return namesAPermission(expr.expression.expression);
  }
  return false;
}

/** A JSX value that renders: a child, or an attribute other than a gate, a `data-*` field or a `key`. */
function rendersJsxValue(node: ts.JsxExpression): boolean {
  const up = node.parent;
  if (ts.isJsxAttribute(up)) {
    const name = nameOf(up.name);
    return !GATE_NAMES.has(name) && !name.startsWith('data-') && name !== 'key';
  }
  return ts.isJsxElement(up) || ts.isJsxFragment(up);
}

/** Every code in `source`'s rendered strings and every permission spliced into one, as `line: text`. */
function codeMentions(fileName: string, source: string, resources: ReadonlySet<string>): string[] {
  const sf = parse(fileName, source);
  const found: string[] = [];
  const report = (at: number, text: string) => {
    const { line } = sf.getLineAndCharacterOfPosition(at);
    found.push(`${line + 1}: ${JSON.stringify(text.replace(/\s+/g, ' ').trim())}`);
  };

  const visit = (node: ts.Node): void => {
    const text = renderable(node);
    if (text !== null && !isGate(node)) {
      for (const match of text.matchAll(SHAPE)) {
        if (!resources.has(match[1])) continue;
        const start = startOf(node, sf);
        const offset = sf.text.slice(start, node.end).indexOf(match[0]);
        report(offset >= 0 ? start + offset : start, text);
      }
    }
    const spliced =
      (ts.isJsxExpression(node) && rendersJsxValue(node) && namesAPermission(node.expression)) ||
      (ts.isTemplateSpan(node) && namesAPermission(node.expression)) ||
      (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        [node.left, node.right].some((side) => namesAPermission(side) && [node.left, node.right].some(ts.isStringLiteralLike)));
    if (spliced) report(node.getStart(sf), node.getText(sf));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Every code a file names in a gate. Read from the source, so it cannot fall behind the screens. */
function gatedCodes(fileName: string, source: string): string[] {
  const sf = parse(fileName, source);
  const codes: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) && isGate(node)) {
      for (const match of node.text.matchAll(SHAPE)) codes.push(match[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return codes;
}

/** The catalog's keys — `'coaching_session:read': [` — or none, outside the superproject. */
function catalogCodes(): string[] {
  if (!existsSync(CATALOG)) return [];
  return [...readFileSync(CATALOG, 'utf8').matchAll(/^\s*'([a-z][a-z0-9_]*:[a-z][a-z0-9_]*)':\s*\[/gm)].map((m) => m[1]);
}

const TEST_RESOURCES = new Set(['lead', 'coaching_session', 'leader_notes']);
const scan = (code: string) => codeMentions('x.tsx', `export const X = () => { ${code} };`, TEST_RESOURCES);

describe('the permission-code scan itself', () => {
  it.each([
    ['JSX text', '<p>This screen needs lead:read.</p>'],
    ['JSX text, one of the codes the criterion names', '<p>Ask for coaching_session:read</p>'],
    ['JSX text equal to a code', '<code>leader_notes:write</code>'],
    ['an attribute that renders', '<span title="Needs lead:update" />'],
    ['a string literal', "const hint = 'Granted by lead:read';"],
    ['a template literal', 'const s = `${who} needs lead:create`;'],
    ['a concatenation', "const s = 'Needs ' + 'lead:read';"],
    ['a permission spliced into JSX', '<p>This screen needs the <code>{permission}</code> permission.</p>'],
    ['a permission read off an error', '<p>{error.details.permission}</p>'],
    ['a permission in a label', '<button aria-label={permission} />'],
    ['a permission in a template', 'const s = `Needs ${permission}`;'],
    ['a permission concatenated', "const s = 'Needs ' + permission;"],
    ['a list of permissions joined', '<p>{me.permissions.join(", ")}</p>'],
  ])('catches %s', (_, code) => {
    expect(scan(code)).toHaveLength(1);
  });

  it.each([
    ['a gate on a page', '<Page permission="lead:read">x</Page>'],
    ['a gate passed on', '<RequireSession permission={permission}>x</RequireSession>'],
    ['a gate chosen by a condition', "<Page permission={mine ? 'lead:read' : 'lead:update'}>x</Page>"],
    ['a gate’s default', "function Shell({ permission = 'lead:read' }) { return permission; }"],
    ['a gate on a tab', "const TABS = [{ href: '/x', label: 'X', needs: 'lead:read' }];"],
    ['a check', "const ok = useCan('lead:read');"],
    ['a check against the session', "const ok = me.permissions.includes('lead:read');"],
    ['the refusal’s code as data', '<div role="alert" data-permission={permission}>Not available to you</div>'],
    ['a Tailwind variant', '<p className="hidden md:block print:hidden">x</p>'],
    ['a command', '<p>Seeded by <code>pnpm seed:demo</code>.</p>'],
    ['a value that is not a permission', "const OPTIONS = [{ value: 'feature:leads', label: 'Leads Management' }];"],
    ['a line comment', '// needs lead:read, which the API checks'],
    ['a JSX comment', '<p>{/* gated on lead:read */}Leads</p>'],
    ['a field named for a permission that is not rendered', 'const n = me.permissions.length;'],
  ])('ignores %s', (_, code) => {
    expect(scan(code)).toEqual([]);
  });

  it('names the line the code is on', () => {
    const source = ['export const X = () => (', '  <section>', '    <p>', '      Needs lead:read', '    </p>', '  </section>', ');'].join('\n');
    expect(codeMentions('x.tsx', source, TEST_RESOURCES)).toEqual(['4: "Needs lead:read"']);
  });
});

describe('P11-T6 AC-12 no screen shows a permission code', () => {
  const files = sourceFiles();
  const sources = new Map(files.map((f) => [f, readFileSync(join(SRC, f), 'utf8')]));
  const known = new Set([...files.flatMap((f) => gatedCodes(f, sources.get(f)!)), ...catalogCodes()]);
  const resources = new Set([...[...known].map((code) => code.split(':')[0]), ...NAMED_RESOURCES]);

  it('knows the codes at all, so a silent zero cannot pass', () => {
    expect(files.length).toBeGreaterThan(100);
    // Gated on by the screens themselves: the roster, and the leads screen.
    expect(known).toContain('coaching_session:read');
    expect(known).toContain('lead:read');
    for (const resource of NAMED_RESOURCES) expect(resources).toContain(resource);
    // None of what shares the shape is mistaken for one.
    for (const other of ['md', 'print', 'hover', 'seed', 'feature', 'data']) expect(resources).not.toContain(other);
  });

  // Heavy under a loaded CI runner (5s was missed there on 2026-10-26, alone it takes under a second).
  it('no rendered string is, or holds, a permission code', { timeout: 20_000 }, () => {
    const offenders = files.flatMap((f) =>
      codeMentions(f, sources.get(f)!, resources).map((hit) => `src/${f}:${hit}`),
    );
    expect(offenders).toEqual([]);
  });
});
