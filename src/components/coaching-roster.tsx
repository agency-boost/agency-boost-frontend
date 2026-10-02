'use client';

import type { Column } from '@/components/ui/data-table';
import { ButtonLink } from '@/components/ui/field';
import { RoleBadge, useLadder } from '@/components/ui/role-badge';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/cn';
import {
  coachingSessionHref, lastOneOnOneOverdue, lastOneOnOneText, ROSTER_STATUS_LABEL,
  type Roster, type RosterRow, type RosterStatus,
} from '@/lib/coaching';

/**
 * The roster's table (`Overall.html:3961-3966`, rows `:10625-10657`, CSS `:1436-1462`).
 *
 * The prototype's own table, not `DataTable`: it groups its rows under full-width divider rows and
 * nests each unit beneath its head, and neither has a place in a one-`<tbody>` table. The markup keeps
 * what `DataTable` exists for — a real `<th scope>` on every heading and a caption a screen reader
 * hears — and adds the two groupings as `<tbody>` row groups, so the visual nesting is a structure a
 * screen reader can follow too: each divider and each unit head is a `rowgroup` header.
 */

/** The prototype's five headings (`:3963`); the last is empty on screen, and named for a screen reader. */
export const ROSTER_COLUMNS: readonly Column[] = [
  'Name', 'Last 1:1', 'Last Coached By', 'Status', { label: 'Actions', visuallyHidden: true },
];

/** Read by a screen reader before the table; the prototype's table has no caption to copy. */
export const ROSTER_CAPTION = 'Everyone you coach';

/** `GOAL_PACE_STATUS` in the pill's tones: `Watch closely` is the prototype's amber-yellow (`:1445`). */
const TONE = {
  on_track: 'success',
  needs_attention: 'alert',
  watch_closely: 'watch',
  no_goal_set: 'neutral',
} as const satisfies Record<RosterStatus, string>;

/** `table.roster-table thead th` and `tr.roster-row td`: 13px by 20px (`:1449`, `:1452`). */
const CELL = 'px-5 py-[13px] align-middle';

/** One step of nesting: `.roster-name-cell.nested{padding-left:26px}` (`:1457`). */
const INDENT = 26;

function GroupDivider({ label, count }: { label: string; count?: number }) {
  return (
    <tr>
      {/* `tr.group-divider td` (`:1440-1441`): a full-width band naming the group beneath it. */}
      <th
        scope="rowgroup"
        colSpan={ROSTER_COLUMNS.length}
        className="border-y border-hairline bg-navy/[0.045] px-5 py-2.5 text-left font-display text-base font-bold text-navy"
      >
        {label}
        {count !== undefined && (
          <>
            {' '}
            <span className="ml-1.5 font-body font-semibold text-muted">· {count}</span>
          </>
        )}
      </th>
    </tr>
  );
}

function PersonRow({
  row,
  head = false,
  nested = false,
  badged = head,
}: {
  row: RosterRow;
  /** A unit's head: the tinted row with the navy-soft rule (`tr.roster-row.aab-row`, `:1453-1454`). */
  head?: boolean;
  /** Beneath a head, indented by its depth behind `↳` (`tr.roster-row.nested`, `:1455-1458`). */
  nested?: boolean;
  /** Carries its rung's badge (`:10634`): a unit's head, and a head nested inside another unit. */
  badged?: boolean;
}) {
  const last = row.lastOneOnOne;
  const overdue = lastOneOnOneOverdue(last);
  // A unit's head stands at depth 1, so its members start one step in, as the prototype draws them.
  const steps = nested ? Math.max(1, row.depth - 1) : 0;
  const tone = TONE[row.status];
  const label = ROSTER_STATUS_LABEL[row.status];

  return (
    <tr
      className={cn(
        'border-b border-hairline',
        // The table's row hover, laid **over** a head's tint rather than painting it away (data-table.tsx).
        'hover:[background-image:linear-gradient(var(--row-hover),var(--row-hover))]',
        head && 'bg-navy-soft/[0.045]',
      )}
    >
      {/*
        * A unit's head names its row **group** — its members are the rest of the `<tbody>` — so a
        * screen reader moving down a unit hears whose unit it is, which the indent says on screen.
        */}
      <th
        scope={head ? 'rowgroup' : 'row'}
        className={cn(
          CELL,
          'text-left font-normal',
          head && 'shadow-[inset_3px_0_0_var(--color-navy-soft)]',
          nested && 'shadow-[inset_3px_0_0_color-mix(in_srgb,var(--color-navy-soft)_22%,transparent)]',
        )}
      >
        <div className="relative flex items-center gap-2" style={steps ? { paddingLeft: steps * INDENT } : undefined}>
          {steps > 0 && (
            <span
              aria-hidden="true"
              className="absolute text-md font-bold leading-none text-hairline"
              style={{ left: (steps - 1) * INDENT + 6 }}
            >
              ↳
            </span>
          )}
          <span className="text-base font-semibold text-navy">{row.name}</span>
          {badged && <RoleBadge role={row.rung.code} />}
        </div>
      </th>
      <td className={CELL}>
        <span className={cn('text-sm font-semibold', overdue ? 'text-alert' : 'text-success')}>
          {lastOneOnOneText(last)}
          {/* Red is the only mark of an overdue 1:1 on screen; a screen reader is told in words. */}
          {last !== null && last.overdue && <span className="sr-only">, overdue</span>}
        </span>
      </td>
      <td className={CELL}>
        {last?.coach ? (
          <span className="text-xs text-muted">{last.coach.name}</span>
        ) : (
          // The prototype's em dash in hairline grey (`:1718`), in muted here: it is the cell's answer,
          // and hairline is not a colour anybody can read.
          <span className="text-sm text-muted">—</span>
        )}
      </td>
      <td className={CELL}>
        <StatusPill
          status={tone}
          label={label}
          // `table.roster-table .status-pill` (`:1447`): one width for every verdict, centred, in the
          // pill's own case rather than shouted.
          className="w-[126px] justify-center px-2.5 py-1 text-xs font-semibold normal-case tracking-normal"
        />
      </td>
      <td className={cn(CELL, 'text-right')}>
        {/* `.btn-coach.built` (`:1460-1461`): every row is built now (ADR-0074, contradiction #9). */}
        <ButtonLink
          href={coachingSessionHref(row.membershipId)}
          className="h-auto whitespace-nowrap px-3.5 py-2 text-base"
        >
          {/*
            * One span round the label, so *Coaching →* is one line of text, as the prototype's button
            * is (`:10642`). The link is `inline-flex`: left loose, *Coaching* and the arrow become two
            * flex items, the space between them is dropped, and the button reads *Coaching→*.
            */}
          <span>
            Coaching <span aria-hidden="true">→</span>
          </span>
        </ButtonLink>
      </td>
    </tr>
  );
}

/**
 * *Your direct agents · n*, then *AAB units*, each head followed by their whole subtree in the order
 * the server sends it (`:10648-10657`). A group with nobody in it is left out rather than drawn as a
 * heading over nothing; a roster with nobody at all is the page's empty state, not this table.
 */
export function CoachingRoster({ roster }: { roster: Roster }) {
  // The junior rung: a member on any other rung heads a unit of their own, nested or not.
  const ladder = useLadder();
  const agentRung = [...ladder].sort((a, b) => a.displayOrder - b.displayOrder)[0]?.code;
  const { directAgents, units } = roster;

  return (
    // `.list-table-card` (`:1437`), scrolling inside itself on a phone rather than widening the page.
    <div className="overflow-x-auto rounded-lg border border-hairline bg-card">
      <table className="relative w-full border-collapse text-left">
        <caption className="sr-only">{ROSTER_CAPTION}</caption>
        <thead>
          <tr className="border-b border-hairline">
            {ROSTER_COLUMNS.map((column) => {
              const name = typeof column === 'string' ? column : column.label;
              return (
                <th
                  key={name}
                  scope="col"
                  className={cn(CELL, 'bg-card text-xs font-semibold uppercase tracking-wide text-muted')}
                >
                  {typeof column === 'string' ? name : <span className="sr-only">{name}</span>}
                </th>
              );
            })}
          </tr>
        </thead>

        {directAgents.length > 0 && (
          <tbody>
            <GroupDivider label="Your direct agents" count={directAgents.length} />
            {directAgents.map((row) => <PersonRow key={row.membershipId} row={row} />)}
          </tbody>
        )}

        {units.length > 0 && (
          <tbody>
            <GroupDivider label="AAB units" />
          </tbody>
        )}
        {units.map((unit) => (
          <tbody key={unit.head.membershipId}>
            <PersonRow row={unit.head} head />
            {unit.members.map((member) => (
              <PersonRow
                key={member.membershipId}
                row={member}
                nested
                badged={agentRung !== undefined && member.rung.code.toUpperCase() !== agentRung.toUpperCase()}
              />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
