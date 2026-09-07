import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { cn } from '@/lib/cn';

/**
 * The placeholder shown while something is on its way.
 *
 * Every screen used to say `Loading…` in muted text, which tells you that a wait is
 * happening and nothing about what it is for. A skeleton says *what is coming and how
 * much of it*, so the page does not jump when the rows land.
 *
 * ## What the wrapper is for
 *
 * The live region announces **only** the label. The bars sit under an `aria-hidden`
 * wrapper, because a screen reader reading out a table of empty cells is worse than
 * silence — and the same is true of six blank cards. One sentence, once.
 *
 * `role="status"` with an accessible name containing "Loading" is contractual: four specs
 * assert it (`app/page.spec.tsx`, `admin/page.spec.tsx`, `require-session.spec.tsx`), and
 * a person using a screen reader gets no other signal that a wait began.
 *
 * Not a client component, so `loading.tsx` can render it directly.
 */
export function Skeleton({
  label = 'Loading…',
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/**
 * One bar. `motion-reduce:animate-none` is not optional — a pulse is exactly the kind of
 * repeated motion `prefers-reduced-motion` exists to stop, and Tailwind gives us the
 * variant for free.
 *
 * `bg-hairline` because the ProgressBar's empty track already uses it
 * (`progress-bar.tsx:37`): it is the token for a neutral surface waiting to be filled,
 * which is precisely what this is.
 */
export function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-3 animate-pulse rounded-sm bg-hairline motion-reduce:animate-none',
        className,
      )}
    />
  );
}

/**
 * Widths cycle rather than randomise. A skeleton that reshuffles on every render draws
 * the eye to the shuffling instead of the wait, and a random width cannot be asserted in
 * a test.
 */
const LINE_WIDTHS = ['w-full', 'w-11/12', 'w-4/5', 'w-9/12'];

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBar key={i} className={LINE_WIDTHS[i % LINE_WIDTHS.length]} />
      ))}
    </div>
  );
}

/**
 * A table skeleton built from the **real** `DataTable` with the **real** column headings.
 *
 * That is the point: the placeholder and the thing it stands in for have the same borders,
 * the same padding and the same column count, so the rows arrive in place instead of
 * shoving the page down. Passing anything other than the screen's own `columns` array
 * defeats it.
 */
export function SkeletonTable({
  caption,
  columns,
  rows = 5,
  className,
}: {
  caption: string;
  columns: readonly Column[];
  rows?: number;
  className?: string;
}) {
  return (
    <Skeleton label={`Loading ${caption.toLowerCase()}…`} className={className}>
      <DataTable caption={caption} columns={columns}>
        {Array.from({ length: rows }, (_, r) => (
          <Row key={r}>
            {columns.map((column, c) => (
              <Cell key={typeof column === 'string' ? column : column.label}>
                <SkeletonBar className={LINE_WIDTHS[(r + c) % LINE_WIDTHS.length]} />
              </Cell>
            ))}
          </Row>
        ))}
      </DataTable>
    </Skeleton>
  );
}

/**
 * A stack of card-shaped placeholders, for the screens that list panels rather than rows —
 * the invite list, the group cards, the pending queue.
 */
export function SkeletonCards({
  count = 3,
  label = 'Loading…',
  className,
}: {
  count?: number;
  label?: string;
  className?: string;
}) {
  return (
    <Skeleton label={label} className={className}>
      <div className="space-y-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="rounded-lg border border-hairline bg-card p-4">
            <SkeletonBar className="h-4 w-1/3" />
            <SkeletonBar className="mt-3 w-2/3" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

/**
 * A list of people: the avatar circle, the name, the line of detail under it. The same
 * `rounded-md border` row the real list draws, so the avatars land where the circles were
 * rather than a row lower.
 */
export function SkeletonPeople({
  count = 3,
  label = 'Loading people…',
  className,
}: {
  count?: number;
  label?: string;
  className?: string;
}) {
  return (
    <Skeleton label={label} className={className}>
      <ul className="flex flex-col gap-2">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="flex items-center gap-3 rounded-md border border-hairline p-3">
            <SkeletonBar className="h-10 w-10 shrink-0 rounded-pill" />
            <span className="min-w-0 flex-1">
              <SkeletonBar className="h-4 w-2/5" />
              <SkeletonBar className="mt-1.5 w-1/4" />
            </span>
          </li>
        ))}
      </ul>
    </Skeleton>
  );
}

/**
 * The org tree's placeholder: rows stepped by depth, the way `ROLE_INDENT` steps the real
 * one. A flat stack of bars would stand in for a *list*, and the thing arriving is not a
 * list — the indent is most of what the screen says.
 */
const TREE_INDENT = ['', 'ml-5', 'ml-10', 'ml-5', 'ml-10', 'ml-[3.75rem]'];

export function SkeletonTree({
  rows = 6,
  label = 'Loading the tree…',
  className,
}: {
  rows?: number;
  label?: string;
  className?: string;
}) {
  return (
    <Skeleton label={label} className={className}>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonBar
            key={i}
            className={cn('h-4 w-1/3', TREE_INDENT[i % TREE_INDENT.length])}
          />
        ))}
      </div>
    </Skeleton>
  );
}

/**
 * What a route group's `loading.tsx` renders: a title-sized bar where the page header will
 * be, then a body.
 *
 * The chrome is **not** here. It belongs to the group layout, which stays mounted across
 * the boundary — that is the whole reason the shells moved out of the pages in P3.5-T14
 * Stage 2. A loading boundary that blanked the sidebar too would be worse than the
 * previous-page-frozen behaviour it replaces.
 */
export function PageSkeleton({ label = 'Loading…' }: { label?: string }) {
  return (
    <Skeleton label={label} className="px-5 py-6">
      <SkeletonBar className="h-6 w-56" />
      <SkeletonBar className="mt-2 h-3 w-80" />
      <div className="mt-8 rounded-lg border border-hairline bg-card p-4">
        <SkeletonText lines={5} />
      </div>
    </Skeleton>
  );
}
