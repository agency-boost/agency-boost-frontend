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

/**
 * The muted treatment, for places where something else already carries the role colour.
 *
 * In the org tree the **avatar** is the coloured thing (`Group_Overview.html:85-87`) and
 * the badge beside it is deliberately quiet (`:95-97`) — two amber elements on one card
 * would compete rather than inform.
 */
const ROLE_CLASS_MUTED: Record<HierarchyRole, string> = {
  ab: 'bg-navy/10 text-navy',
  aab: 'bg-navy-soft/[0.12] text-navy-soft',
  agent: 'bg-muted/10 text-muted',
};

/** The role colours, for an avatar or a legend swatch. */
export const ROLE_AVATAR_CLASS: Record<HierarchyRole, string> = {
  ab: 'bg-role-ab text-navy',
  aab: 'bg-role-aab text-card',
  agent: 'bg-role-agent text-card',
};

export function RoleBadge({
  role,
  short = true,
  tone = 'default',
  className,
}: {
  role: HierarchyRole;
  short?: boolean;
  /** `muted` where a coloured avatar already says the role — the org tree. */
  tone?: 'default' | 'muted';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-wide',
        tone === 'muted' ? ROLE_CLASS_MUTED[role] : ROLE_CLASS[role],
        className,
      )}
      title={ROLE_LABEL[role]}
    >
      {short ? ROLE_SHORT[role] : ROLE_LABEL[role]}
    </span>
  );
}
