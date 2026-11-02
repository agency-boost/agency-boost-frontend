import { Boost } from '@/components/boost';
import { cn } from '@/lib/cn';

/**
 * The prototypes have almost no empty states, so most are ours to write.
 *
 * Empty and filtered-empty are different: one means nothing exists yet and offers the
 * action that creates something; the other means nothing matches and offers to clear
 * the filter. Telling a user "No leads yet" when they have fifty and a bad filter is
 * actively misleading.
 *
 * **Boost, on a page or a list that is fully empty** (UI V1, UI-102: *every fully empty page uses Boost thinking, or
 * sleeping for "nothing logged", never a bare sentence*): `boost` draws him above the one line, 96px, with the main
 * action under it. A filtered-empty list keeps the plain line: nothing is missing there but a match.
 */
export function EmptyState({
  title,
  action,
  variant = 'empty',
  boost,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  variant?: 'empty' | 'filtered';
  /** Boost above the line: `thinking` for nothing yet, `sleeping` for nothing logged (UI-102). */
  boost?: 'thinking' | 'sleeping';
  className?: string;
}) {
  return (
    <div
      className={cn('px-5 py-10 text-center text-md text-muted', boost && 'flex flex-col items-center py-8', className)}
      data-variant={variant}
    >
      {boost && <Boost pose={boost} size={96} className="mb-3" />}
      <p>{title}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
