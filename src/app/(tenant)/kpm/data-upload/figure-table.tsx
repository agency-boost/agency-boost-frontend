'use client';

import { useId } from 'react';
import { useMessages } from '@/i18n/language-provider';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { cn } from '@/lib/cn';
import { AGENT_COLUMN } from '@/lib/production';

/** A column of the table: its cell's key (`cellKey`), its heading, and its group — this month, or the year to date. */
export interface FigureColumn {
  key: string;
  label: string;
  ytd: boolean;
}

/**
 * The prototype's divider between the groups: 2px of navy down the left of the first YTD column and of
 * *Active (MAA)*, heading and cells alike (`.upload-group-divider`, `KPM_Owner.html:851`).
 */
export const GROUP_DIVIDER = 'border-l-2 border-l-secondary';

/**
 * `DataTable`'s compact density (`components/ui/data-table.tsx`), which this table has to draw for
 * itself: `DataTable` writes one heading row from a flat list, and this table's head is two. Kept in
 * step with that one by hand — a change to the compact density belongs in both.
 */
const COMPACT = [
  'table-fixed',
  '[&_thead]:bg-base',
  '[&_th]:px-2 [&_th]:py-[7px] [&_th]:text-2xs',
  '[&_td]:px-2 [&_td]:py-[3px] [&_td]:leading-tight',
  '[&_tbody_tr:hover]:[background-image:linear-gradient(var(--row-hover),var(--row-hover))]',
  'text-base',
].join(' ');

const HEADING = 'px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-muted';

/**
 * **A file's figures, in the prototype's two-row head** (`KPM_Owner.html:4836-4848`, P13.1-T7) — the preview's table:
 * *Agent* and *Agent code* across both rows, then **This Month** over the template's columns the file is read for, and
 * **YTD** over the uploaded years to date, when the file carries any (P19.5-T2: a summed year to date is never in a
 * file). The columns run in the template's order, so the file an operator fills reads like the screen.
 *
 * **Each figure names both its headings.** A group heading spans several columns, and how a screen reader pairs a cell
 * with a heading two rows up varies; so each figure cell carries `headers` naming its group and its column — *This
 * Month, APE* — and the group headings also carry `scope="colgroup"` over a real `<colgroup>`. Ids come from `useId`,
 * so two tables can share a page.
 *
 * `children` is handed the `headers` value for a column's key, so a row cannot name the wrong one.
 */
export function FigureTable({
  caption, columns, tableClassName, children,
}: {
  caption: string;
  columns: readonly FigureColumn[];
  /** A minimum width, so the table scrolls in its own box and never the page. */
  tableClassName?: string;
  children: (headersOf: (key: string) => string) => React.ReactNode;
}) {
  const t = useMessages(dataUploadMessages);
  const id = useId();
  const groups = ([false, true] as const)
    .map((ytd) => ({ ytd, columns: columns.filter((c) => c.ytd === ytd) }))
    .filter((g) => g.columns.length > 0);
  const groupId = (ytd: boolean) => `${id}-${ytd ? 'ytd' : 'monthly'}`;
  const figureId = (key: string) => `${id}-${key}`;
  const headersOf = (key: string) => {
    const column = columns.find((c) => c.key === key);
    return column ? `${groupId(column.ytd)} ${figureId(key)}` : figureId(key);
  };
  const ordered = groups.flatMap((g) => g.columns);

  return (
    <div className="overflow-x-auto rounded-lg border border-card-edge bg-card">
      {/* `relative` for the reason `DataTable` gives: an `sr-only` name must not escape the scroll box. */}
      <table className={cn('relative w-full border-collapse text-left', COMPACT, tableClassName)}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col style={{ width: '11rem' }} />
          <col style={{ width: '6rem' }} />
        </colgroup>
        {groups.map((g) => (
          <colgroup key={String(g.ytd)}>
            {g.columns.map((c) => <col key={c.key} style={{ width: '7.5rem' }} />)}
          </colgroup>
        ))}
        <thead>
          <tr className="border-b border-hairline">
            <th rowSpan={2} scope="col" className={HEADING}>{AGENT_COLUMN}</th>
            <th rowSpan={2} scope="col" className={HEADING}>{t.agentCode}</th>
            {groups.map((g, i) => (
              <th
                key={String(g.ytd)}
                id={groupId(g.ytd)}
                colSpan={g.columns.length}
                scope="colgroup"
                className={cn(HEADING, 'text-center', i > 0 && GROUP_DIVIDER)}
              >
                {g.ytd ? t.switchYtd : t.switchMonth}
              </th>
            ))}
          </tr>
          <tr className="border-b border-hairline">
            {ordered.map((c, i) => (
              <th
                key={c.key}
                id={figureId(c.key)}
                scope="col"
                className={cn(HEADING, opensGroup(ordered, i) && GROUP_DIVIDER)}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children(headersOf)}</tbody>
      </table>
    </div>
  );
}

/** Does this column open its group's divider? The first YTD column does. */
export const opensGroup = (columns: readonly FigureColumn[], index: number) =>
  columns[index]?.ytd === true && columns[index - 1]?.ytd === false;

/**
 * One figure's cell: right-aligned, on one line, naming its two headings. `Cell` takes no `headers`,
 * so this is `Cell`'s own classes on a `<td>` that does.
 */
export function FigureCell({
  headers, divider = false, children,
}: {
  headers: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <td
      headers={headers}
      className={cn('whitespace-nowrap px-4 py-2.5 text-right align-middle text-navy', divider && GROUP_DIVIDER)}
    >
      {children}
    </td>
  );
}
