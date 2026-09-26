import { cn } from '@/lib/cn';

/**
 * A table, rendered as a table.
 *
 * The prototypes build several of these out of nested divs, which costs screen-reader
 * users the row/column relationships entirely. Real `<th scope>` and a `<caption>` are
 * the whole point — the caption is visually hidden, not absent.
 */
/**
 * A column heading. A string shows; `{ label, visuallyHidden }` is announced and not
 * drawn — for the column of buttons at the end of a row, which needs a name for anybody
 * navigating by column and no name in the design.
 *
 * An empty string is not an option, deliberately: axe's `empty-table-header` caught one,
 * and the fix is a name nobody can see rather than no name at all.
 */
export type Column =
  | string
  | { label: string; visuallyHidden: true }
  | SortableColumn;

/**
 * A heading the reader can sort by.
 *
 * **`aria-sort` on the `<th>`, and a real `<button>` inside it.** The prototype sorts by clicking
 * the heading text itself (`Overall.html:2790`), which is a click target a keyboard cannot reach
 * and a state a screen reader is never told — the arrow glyph is the only signal, and it is
 * decoration. Here the glyph is `aria-hidden` and `aria-sort` carries the meaning, so the two
 * cannot drift apart.
 *
 * Only one column is ever `ascending` or `descending`: sorting is single-key, and a second sorted
 * heading would be a claim about grouping that no screen here implements.
 */
export interface SortableColumn {
  label: string;
  sort: 'ascending' | 'descending' | 'none';
  onSort: () => void;
}

/** The prototype's three glyphs (`Overall.html:5540`), kept as the only visual difference. */
const SORT_GLYPH = { ascending: '▲', descending: '▼', none: '⇅' } as const;

function isSortable(column: Column): column is SortableColumn {
  return typeof column !== 'string' && 'sort' in column;
}

/**
 * A dense table, on one class string applied to the `<table>`.
 *
 * `components-and-patterns.md` has specified `table-layout: fixed` with explicit widths since Phase 1
 * and no screen could ask for it, so the leads table shipped at three times the prototype's row height
 * (`px-4 py-2.5 text-md` against `padding:3px 8px; font-size:12.5px`) and a reader saw five rows where
 * the prototype shows fifteen.
 *
 * **Arbitrary descendant variants, not a React context.** `skeleton.tsx` builds `SkeletonTable` from
 * this component and is deliberately *not* a client component, so `loading.tsx` can render it directly
 * — a `createContext` here would pull every route group's loading state into the client bundle, and the
 * failure would read as a missing boundary rather than a missing provider. `[&_td]:px-2` has
 * specificity `0,1,1` and beats `Cell`'s own `.px-4` at `0,1,0` deterministically, which a context
 * would not do any better.
 *
 * The header's `bg-base` band is `--warm-base` in the prototype (`Overall.html:416`), and the row hover
 * is the 1.5%-navy wash at `:424` — faint on purpose: it tells you which row your pointer is on without
 * competing with the amber focus ring inside it.
 */
const DENSITY_COMPACT = [
  'table-fixed',
  '[&_thead]:bg-base',
  '[&_th]:px-2 [&_th]:py-[7px] [&_th]:text-2xs',
  '[&_td]:px-2 [&_td]:py-[3px] [&_td]:text-base [&_td]:leading-tight',
  '[&_tbody_tr]:hover:bg-navy/[0.015]',
].join(' ');

export function DataTable({
  caption,
  columns,
  children,
  className,
  tableClassName,
  density = 'default',
  widths,
}: {
  caption: string;
  columns: readonly Column[];
  children: React.ReactNode;
  className?: string;
  /**
   * For a table with more columns than a phone has room for — a minimum width, so the columns
   * keep their shape and **the wrapper scrolls** rather than the page body. Without it a wide
   * table squashes to fit and the horizontal scroll this wrapper exists for never happens.
   */
  tableClassName?: string;
  /** `compact` is the prototype's editable-list density. Opt-in: eleven other screens use this. */
  density?: 'default' | 'compact';
  /**
   * One CSS width per column, rendered as a `<colgroup>` (`Overall.html:2799-2802`, `:426-435`).
   *
   * **Only meaningful with `density="compact"`**, which sets `table-fixed` — without a fixed layout
   * the browser treats these as suggestions and a long remark still widens its column, which is the
   * whole thing a nine-column editable table has to prevent.
   */
  widths?: readonly string[];
}) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-hairline bg-card', className)}>
      <table
        className={cn(
          'w-full border-collapse text-left text-md',
          density === 'compact' && DENSITY_COMPACT,
          tableClassName,
        )}
      >
        <caption className="sr-only">{caption}</caption>
        {widths ? (
          <colgroup>
            {widths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
        ) : null}
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((column) => {
              const label = typeof column === 'string' ? column : column.label;
              const hidden = typeof column !== 'string' && 'visuallyHidden' in column;
              return (
                <th
                  key={label}
                  scope="col"
                  aria-sort={isSortable(column) ? column.sort : undefined}
                  className="px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-muted"
                >
                  {isSortable(column) ? (
                    <button
                      type="button"
                      onClick={column.onSort}
                      className="inline-flex items-center gap-1 rounded-sm uppercase tracking-wide hover:text-navy"
                    >
                      {label}
                      <span aria-hidden="true" className="text-2xs">{SORT_GLYPH[column.sort]}</span>
                    </button>
                  ) : (
                    <span className={hidden ? 'sr-only' : undefined}>{label}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-hairline last:border-b-0">{children}</tr>;
}

export function Cell({
  children,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  /** For a row that becomes one editor rather than a row of values. */
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn('px-4 py-2.5 align-middle text-navy', className)}>
      {children}
    </td>
  );
}
