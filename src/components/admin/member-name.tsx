'use client';

import { shortOfRung } from '@/components/ui/role-badge';
import { cn } from '@/lib/cn';
import type { MemberClass } from '@/lib/admin-members';

/**
 * **A name as the console writes it** (P19.23-T3; the client's `DESIGN-RULES.md`, *Names*; the Super Admin spec §6 *"AB /
 * AAB label + NAME (capitals)"*): the company's short name for the rung in small bold orange before the NAME in capitals,
 * for an AB or an AAB by class; an Agent has no label and no gap. People's `PersonName` reads the reader's own company's
 * ladder, and the console reads many companies, so this one takes the rung the API sent (`{ code, label, class }`). The
 * orange is the accent's ink (`text-primary-ink`), the shade small text may use.
 */
export function MemberName({
  name,
  role,
  className,
}: {
  name: string;
  role: { code: string; label: string; class: MemberClass };
  className?: string;
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-baseline gap-1.5', className)}>
      {role.class !== 'agent' && (
        <span data-rung-label="" className="shrink-0 text-xs font-extrabold text-primary-ink">{shortOfRung(role)}</span>
      )}
      <span className="min-w-0 truncate font-bold uppercase tracking-[0.2px] text-ink">{name}</span>
    </span>
  );
}
