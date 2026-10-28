import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parse, SRC } from '@test/copy-scan';

/**
 * **A client page reads its query with `useQuery`, never the `searchParams` prop** (found walking a production
 * build, 2026-10-27).
 *
 * `next build` prerenders a static (○) client page with an empty query, and the prop stays empty after hydration:
 * on a production build `/calendar?view=month` opened on Week, `/calendar?with=…` (*Schedule 1:1*) opened no dialog
 * and `/summary?month=2026-08` read this month. A dev server renders on demand, so every walk on one and every spec
 * that passed the prop saw the query arrive. Eleven pages read it that way; this keeps a twelfth from doing so.
 *
 * **It reads the syntax tree**, so a comment never counts, and neither does `new URL(url).searchParams`: what it
 * reads is the default export's props — their binding, their type, and `props.searchParams` in its body.
 */
const WHY =
  'a client page reads its query with useQuery() (src/lib/use-query.ts, useSearchParams under a <Suspense>), never '
  + 'the searchParams prop: `next build` prerenders a static page with an empty query and the prop stays empty after '
  + 'hydration — a dev server hides it';

type FunctionLike = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;

const isClient = (sf: ts.SourceFile) => {
  const [first] = sf.statements;
  return !!first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === 'use client';
};

const isFunctionLike = (node: ts.Node | undefined): node is FunctionLike =>
  !!node && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node));

/** The page itself: `export default function …`, `export default () => …`, or `export default Name` for one of those. */
function defaultExport(sf: ts.SourceFile): FunctionLike | null {
  const named = (name: string): FunctionLike | null => {
    for (const statement of sf.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement;
      if (ts.isVariableStatement(statement)) {
        const declared = statement.declarationList.declarations.find((d) => ts.isIdentifier(d.name) && d.name.text === name);
        if (declared && isFunctionLike(declared.initializer)) return declared.initializer;
      }
    }
    return null;
  };
  for (const statement of sf.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) ?? [] : [];
    const kinds = modifiers.map((m) => m.kind);
    if (ts.isFunctionDeclaration(statement) && kinds.includes(ts.SyntaxKind.ExportKeyword) && kinds.includes(ts.SyntaxKind.DefaultKeyword)) {
      return statement;
    }
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const value = statement.expression;
      if (isFunctionLike(value)) return value;
      if (ts.isIdentifier(value)) return named(value.text);
    }
  }
  return null;
}

/** Every place a client page's default export takes `searchParams`, as `line: text`. */
function searchParamsProps(fileName: string, source: string): string[] {
  const sf = parse(fileName, source);
  if (!isClient(sf)) return [];
  const page = defaultExport(sf);
  const props = page?.parameters[0];
  if (!page || !props) return [];
  const found: string[] = [];
  const note = (node: ts.Node) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    found.push(`${line + 1}: ${node.getText(sf)}`);
  };

  // The props' binding and type: `{ searchParams }: { searchParams?: Promise<Query> }`.
  const inProps = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === 'searchParams') note(node);
    ts.forEachChild(node, inProps);
  };
  inProps(props);

  // `props.searchParams`, and `const { searchParams } = props`, in the body.
  if (ts.isIdentifier(props.name) && page.body) {
    const name = props.name.text;
    const inBody = (node: ts.Node): void => {
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name
        && node.name.text === 'searchParams') {
        note(node);
      }
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.initializer)
        && node.initializer.text === name && ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const key = element.propertyName ?? element.name;
          if (ts.isIdentifier(key) && key.text === 'searchParams') note(element);
        }
      }
      ts.forEachChild(node, inBody);
    };
    inBody(page.body);
  }
  return found;
}

describe('the query-string scan itself', () => {
  const client = (code: string) => `'use client';\n${code}`;

  it.each([
    ['a destructured, typed prop', 'export default function P({ searchParams }: { searchParams?: Promise<Q> }) { return null; }', 2],
    ['a prop read off the props', 'export default function P(props: Props) { const q = use(props.searchParams); return null; }', 1],
    ['a prop destructured in the body', 'export default function P(props: Props) { const { searchParams: s } = props; return null; }', 1],
    ['an arrow exported by name', 'const P = ({ searchParams }: Props) => null;\nexport default P;', 1],
    ['an arrow exported in place', 'export default ({ params, searchParams }: Props) => null;', 1],
  ])('catches %s', (_, code, hits) => {
    expect(searchParamsProps('page.tsx', client(code))).toHaveLength(hits);
  });

  it.each([
    ['a server page, which renders on demand', "export default function P({ searchParams }: { searchParams: Promise<Q> }) { return null; }"],
    ['the URL API', "'use client';\nexport default function P() { const s = new URL(url).searchParams; return null; }"],
    ['a comment', "'use client';\n// was ({ searchParams }: { searchParams?: Promise<Query> })\nexport default function P() { return null; }"],
    ['another component in the file', "'use client';\nfunction Inner({ searchParams }: Props) { return null; }\nexport default function P() { return null; }"],
    ['a page reading its route params only', "'use client';\nexport default function P({ params }: { params: Promise<{ id: string }> }) { use(params); return null; }"],
  ])('ignores %s', (_, code) => {
    expect(searchParamsProps('page.tsx', code)).toEqual([]);
  });

  it('names the line the prop is on', () => {
    const source = client('\nexport default function P({\n  searchParams,\n}: Props) { return null; }');
    expect(searchParamsProps('page.tsx', source)).toEqual(['4: searchParams']);
  });
});

describe('no client page takes its query as a prop', () => {
  const pages = readdirSync(join(SRC, 'app'), { encoding: 'utf8', recursive: true })
    .filter((f) => /(^|\/)page\.tsx$/.test(f))
    .map((f) => `app/${f}`);

  it('finds the pages at all, so a silent zero cannot pass', () => {
    expect(pages.length).toBeGreaterThan(80);
    expect(pages).toContain('app/(agent)/calendar/page.tsx');
  });

  it('no client page declares a searchParams prop', () => {
    const offenders = pages.flatMap((f) =>
      searchParamsProps(f, readFileSync(join(SRC, f), 'utf8')).map((hit) => `src/${f}:${hit}`),
    );
    expect(offenders, WHY).toEqual([]);
  });
});
