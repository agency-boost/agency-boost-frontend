import { cn } from '@/lib/cn';

/**
 * One canonical role enum, one label map.
 *
 * The prototypes carry four competing vocabularies and two enum casings for these three
 * roles (see docs/01-flows/group-tree.md §5). This is the single source.
 *
 * The badge always renders its text label — roughly 8% of men have a colour vision
 * deficiency, and this product's users are majority-male sales teams.
 */
export type HierarchyRole = 'ab' | 'aab' | 'agent';

export const ROLE_LABEL: Record<HierarchyRole, string> = {
  ab: 'Agency Builder',
  aab: 'Associate Agency Builder',
  agent: 'Agent',
};

export const ROLE_SHORT: Record<HierarchyRole, string> = {
  ab: 'AB',
  aab: 'AAB',
  agent: 'Agent',
};

const ROLE_CLASS: Record<HierarchyRole, string> = {
  ab: 'bg-role-ab/15 text-amber-dark',
  aab: 'bg-role-aab/15 text-navy-soft',
  agent: 'bg-navy/10 text-navy',
};

export function RoleBadge({
  role,
  short = true,
  className,
}: {
  role: HierarchyRole;
  short?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-wide',
        ROLE_CLASS[role],
        className,
      )}
      title={ROLE_LABEL[role]}
    >
      {short ? ROLE_SHORT[role] : ROLE_LABEL[role]}
    </span>
  );
}
