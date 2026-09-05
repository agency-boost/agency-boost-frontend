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
export type Column = string | { label: string; visuallyHidden: true };

export function DataTable({
  caption,
  columns,
  children,
  className,
}: {
  caption: string;
  columns: readonly Column[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-hairline bg-card', className)}>
      <table className="w-full border-collapse text-left text-md">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((column) => {
              const label = typeof column === 'string' ? column : column.label;
              const hidden = typeof column !== 'string';
              return (
                <th
                  key={label}
                  scope="col"
                  className="px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-muted"
                >
                  <span className={hidden ? 'sr-only' : undefined}>{label}</span>
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

export function Cell({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-2.5 align-middle text-navy', className)}>{children}</td>;
}
