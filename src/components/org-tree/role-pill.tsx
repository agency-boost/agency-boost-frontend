import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { HierarchyRole } from '@/lib/org';

/**
 * **A role as a tinted pill, never a dot** (UI V1, D-27): the Group Tree's *Peran* column (UI-059) and User
 * Management's role pill on *Tim Anda* (UI-083) — **AB and AAB on the accent's tint, an Agent grey**, and on the
 * reader's own navy row white at 16%. The words are the company's rung (`rungShort`), the caller's; the tint repeats
 * them and never replaces them.
 *
 * Words on tint: `amber-ink` on the accent at 20% over white, the avatars' own pair (`person-row.tsx`, above 4.5:1);
 * `pill-grey-ink` on `pill-grey` (8.49:1); white on navy at 16% (above 7:1).
 */
export function roleTint(role: HierarchyRole, onNavy = false): string {
  if (onNavy) return 'bg-white/[0.16] text-white';
  return role === 'agent' ? 'bg-pill-grey text-pill-grey-ink' : 'bg-amber/20 text-amber-ink';
}

export function RolePill({
  role,
  onNavy = false,
  className,
  children,
}: {
  role: HierarchyRole;
  onNavy?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      data-role-pill={role}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-0.5 text-xs font-bold leading-5',
        roleTint(role, onNavy),
        className,
      )}
    >
      {children}
    </span>
  );
}
