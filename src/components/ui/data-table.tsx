import { cn } from '@/lib/cn';

/**
 * A table, rendered as a table.
 *
 * The prototypes build several of these out of nested divs, which costs screen-reader
 * users the row/column relationships entirely. Real `<th scope>` and a `<caption>` are
 * the whole point — the caption is visually hidden, not absent.
 */
export function DataTable({
  caption,
  columns,
  children,
  className,
}: {
  caption: string;
  columns: readonly string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-hairline bg-card', className)}>
      <table className="w-full border-collapse text-left text-md">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((c) => (
              <th
                key={c}
                scope="col"
                className="px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-muted"
              >
                {c}
              </th>
            ))}
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
