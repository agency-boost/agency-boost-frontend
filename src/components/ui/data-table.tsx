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

export function DataTable({
  caption,
  columns,
  children,
  className,
  tableClassName,
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
}) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-hairline bg-card', className)}>
      <table className={cn('w-full border-collapse text-left text-md', tableClassName)}>
        <caption className="sr-only">{caption}</caption>
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
                      className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-navy"
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
