'use client';

import { useId } from 'react';
import { useMessages } from '@/i18n/language-provider';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { cn } from '@/lib/cn';
import {
  AGENT_COLUMN, CADENCE_GROUP_LABEL, CADENCES, FIGURE_COLUMNS, METRIC_COLUMN_LABEL, PRODUCTION_METRICS, type Cadence,
  type ProductionMetric,
} from '@/lib/production';

type Figure = { cadence: Cadence; metric: ProductionMetric };

/**
 * The prototype's divider between the groups: 2px of navy down the left of the first YTD column and of
 * *Active (MAA)*, heading and cells alike (`.upload-group-divider`, `KPM_Owner.html:851`).
 */
export const GROUP_DIVIDER = 'border-l-2 border-l-navy';

/** Does this figure open its group's divider? The first YTD column does. */
export const opensGroup = (index: number) => index === PRODUCTION_METRICS.length;

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
 * **The month's figures, in the prototype's two-row head** (`KPM_Owner.html:4836-4848`, P13.1-T7):
 * *Agent* and *Agent code* across both rows, then **This Month** over its six metrics, **YTD** over the
 * same six, and — for the month table — *Active (MAA)* to close the row. The template's columns run in
 * the same order (`production-template.ts`), so the file an operator fills reads like the screen.
 *
 * **Each figure names both its headings.** A group heading spans six columns, and how a screen reader
 * pairs a cell with a heading two rows up varies; so each figure cell carries `headers` naming its
 * group and its metric — *This Month, APE* — and the group headings also carry `scope="colgroup"` over
 * a real `<colgroup>`. Ids come from `useId`, so the preview's table and the month's can share a page.
 *
 * `children` is handed the `headers` value for a figure, so a row cannot name the wrong one.
 */
export function FigureTable({
  caption, active = false, tableClassName, children,
}: {
  caption: string;
  /** The month table's *Active (MAA)*. A preview has no such column: a file says what to write. */
  active?: boolean;
  /** A minimum width, so the table scrolls in its own box and never the page. */
  tableClassName?: string;
  children: (headersOf: (figure: Figure) => string) => React.ReactNode;
}) {
  const t = useMessages(dataUploadMessages);
  const id = useId();
  const groupId = (cadence: Cadence) => `${id}-${cadence}`;
  const figureId = ({ cadence, metric }: Figure) => `${id}-${cadence}-${metric}`;
  const headersOf = (figure: Figure) => `${groupId(figure.cadence)} ${figureId(figure)}`;

  return (
    <div className="overflow-x-auto rounded-lg border border-card-edge bg-card">
      {/* `relative` for the reason `DataTable` gives: an `sr-only` name must not escape the scroll box. */}
      <table className={cn('relative w-full border-collapse text-left', COMPACT, tableClassName)}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col style={{ width: '11rem' }} />
          <col style={{ width: '6rem' }} />
        </colgroup>
        {CADENCES.map((cadence) => (
          <colgroup key={cadence}>
            {PRODUCTION_METRICS.map((metric) => <col key={metric} style={{ width: '7.5rem' }} />)}
          </colgroup>
        ))}
        {active && (
          <colgroup>
            <col style={{ width: '6.5rem' }} />
          </colgroup>
        )}
        <thead>
          <tr className="border-b border-hairline">
            <th rowSpan={2} scope="col" className={HEADING}>{AGENT_COLUMN}</th>
            <th rowSpan={2} scope="col" className={HEADING}>{t.agentCode}</th>
            {CADENCES.map((cadence, i) => (
              <th
                key={cadence}
                id={groupId(cadence)}
                colSpan={PRODUCTION_METRICS.length}
                scope="colgroup"
                className={cn(HEADING, 'text-center', i > 0 && GROUP_DIVIDER)}
              >
                {CADENCE_GROUP_LABEL[cadence]}
              </th>
            ))}
            {active && <th rowSpan={2} scope="col" className={cn(HEADING, GROUP_DIVIDER)}>{t.activeColumn}</th>}
          </tr>
          <tr className="border-b border-hairline">
            {FIGURE_COLUMNS.map((figure, i) => (
              <th
                key={`${figure.cadence}-${figure.metric}`}
                id={figureId(figure)}
                scope="col"
                className={cn(HEADING, opensGroup(i) && GROUP_DIVIDER)}
              >
                {METRIC_COLUMN_LABEL[figure.metric]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children(headersOf)}</tbody>
      </table>
    </div>
  );
}

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
