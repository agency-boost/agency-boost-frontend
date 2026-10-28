import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { parse, sourceFiles, SRC } from '@test/copy-scan';

/**
 * **A raw `<table>` keeps its `sr-only` names inside its own scroll box** (found walking a production build at 768px,
 * 2026-10-27).
 *
 * A `sr-only` name is `position: absolute`. With no positioned element between it and the `overflow-x-auto` that
 * scrolls the table, it is placed against an ancestor outside that box, which then does not clip it: `/new-hires`'
 * *Actions* header widened the page by 42px at 768 × 1024 (57px for the Owner), as the Actions glyphs on /leads did
 * at 1280px before `DataTable` made its table `relative` (P10.1-T4, `data-table.tsx`). `relative` with no offsets moves
 * nothing, so it costs no pixel.
 *
 * The rule, read off the syntax tree: from each `<table>` up through the elements around it in its own file, the
 * first that is positioned (`relative`, `absolute`, `fixed`, `sticky`) or clips (`overflow-*-auto|scroll|hidden|clip`)
 * must be positioned. One that clips first lets the name out; none at all means the scroll box, if any, is a
 * caller's, which this file cannot see — so the table carries `relative` itself.
 */
const WHY =
  'a raw <table> is `relative`, or sits in a positioned element inside its scroll box: a sr-only name is '
  + 'position:absolute and otherwise escapes the overflow-x-auto box and widens the page (data-table.tsx, P10.1-T4)';

const POSITIONED = /^(relative|absolute|fixed|sticky)$/;
const CLIPS = /^overflow(-[xy])?-(auto|scroll|hidden|clip)$/;

/** Every class an element's `className` can carry: the words of each string in it, a condition's both arms. */
function classesOf(element: ts.JsxOpeningLikeElement): string[] {
  const attribute = element.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === 'className',
  );
  const words: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) words.push(...node.text.split(/\s+/));
    else if (ts.isTemplateExpression(node)) {
      words.push(...node.head.text.split(/\s+/), ...node.templateSpans.flatMap((s) => s.literal.text.split(/\s+/)));
    }
    ts.forEachChild(node, visit);
  };
  if (attribute?.initializer) visit(attribute.initializer);
  return words.filter(Boolean);
}

const openingOf = (node: ts.Node): ts.JsxOpeningLikeElement | null =>
  ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;

/** Each `<table>` in `source` whose `sr-only` names could leave its scroll box, as `line`. */
function looseTables(fileName: string, source: string): number[] {
  const sf = parse(fileName, source);
  const found: number[] = [];
  const visit = (node: ts.Node): void => {
    const opening = openingOf(node);
    if (opening && opening.tagName.getText(sf) === 'table') {
      let held = false;
      for (let at: ts.Node | undefined = node; at; at = at.parent) {
        const element = openingOf(at);
        if (!element) continue;
        // A variant (`sm:relative`) positions at one width only; a clipping variant clips at one, which is enough.
        const classes = classesOf(element);
        const positioned = classes.some((c) => POSITIONED.test(c));
        const clips = classes.some((c) => CLIPS.test(c.split(':').pop()!));
        if (positioned || clips) {
          held = positioned;
          break;
        }
      }
      if (!held) found.push(sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('the table scan itself', () => {
  const file = (jsx: string) => `export const X = () => (\n${jsx}\n);`;

  it.each([
    ['a table in a scroll box', '<div className="overflow-x-auto"><table className="w-full"><caption className="sr-only">T</caption></table></div>'],
    ['a table in a box that scrolls both ways', '<div className="-mx-6 max-h-[55vh] overflow-auto"><table /></div>'],
    ['a table in a scroll box inside a positioned card', '<div className="relative"><div className="min-w-0 overflow-x-auto"><table className="w-full" /></div></div>'],
    ['a table whose scroll box is a caller’s', '<table className="w-full border-collapse" />'],
    ['a table that is positioned only from a width', '<div className="overflow-x-auto"><table className="sm:relative w-full" /></div>'],
  ])('catches %s', (_, jsx) => {
    expect(looseTables('x.tsx', file(jsx))).toHaveLength(1);
  });

  it.each([
    ['a relative table', '<div className="overflow-x-auto"><table className="relative w-full min-w-[560px]" /></div>'],
    ['a relative table, its classes through cn', "<div className=\"overflow-x-auto\"><table className={cn('relative w-full', dense && DENSE)} /></div>"],
    ['a relative scroll box', '<div className="relative overflow-x-auto"><table className="w-full" /></div>'],
    ['a positioned element inside the scroll box', '<div className="overflow-x-auto"><div className="relative"><table /></div></div>'],
    ['a table in a fixed drawer that scrolls', '<aside className="fixed right-0 overflow-y-auto"><div><table /></div></aside>'],
  ])('passes %s', (_, jsx) => {
    expect(looseTables('x.tsx', file(jsx))).toEqual([]);
  });
});

describe('no raw table lets a screen-reader name widen the page', () => {
  const files = sourceFiles().filter((f) => f.endsWith('.tsx'));

  it('finds the tables at all, so a silent zero cannot pass', () => {
    const withTables = files.filter((f) => readFileSync(join(SRC, f), 'utf8').includes('<table'));
    expect(withTables).toContain('components/new-hires.tsx');
    expect(withTables.length).toBeGreaterThan(10);
  });

  it('every raw table is relative, or positioned inside its own scroll box', () => {
    const offenders = files.flatMap((f) =>
      looseTables(f, readFileSync(join(SRC, f), 'utf8')).map((line) => `src/${f}:${line}`),
    );
    expect(offenders, WHY).toEqual([]);
  });
});
