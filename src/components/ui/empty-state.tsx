import { cn } from '@/lib/cn';

/**
 * The prototypes have almost no empty states, so most are ours to write.
 *
 * Empty and filtered-empty are different: one means nothing exists yet and offers the
 * action that creates something; the other means nothing matches and offers to clear
 * the filter. Telling a user "No leads yet" when they have fifty and a bad filter is
 * actively misleading.
 */
export function EmptyState({
  title,
  action,
  variant = 'empty',
  className,
}: {
  title: string;
  action?: React.ReactNode;
  variant?: 'empty' | 'filtered';
  className?: string;
}) {
  return (
    <div
      className={cn('px-5 py-10 text-center text-md text-muted', className)}
      data-variant={variant}
    >
      <p>{title}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
