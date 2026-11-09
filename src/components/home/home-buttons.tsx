'use client';

import Link from 'next/link';
import { PlanIcon } from '@/components/plan/plan-icons';
import { NavIcon } from '@/components/ui/nav-icon';
import { useMessages } from '@/i18n/language-provider';
import { homeMessages } from '@/i18n/messages/home';
import { proposalMessages } from '@/i18n/messages/proposal';
import { cn } from '@/lib/cn';
import { ADD_USER_HREF } from '@/lib/home';
import { newProposalHref } from '@/lib/proposals';
import { useCan, useSession } from '@/lib/session';

/** One white pill of the row: 44px, 14px / 700 in navy, its icon, the words on one line (the mockup's `.sb`). */
const PILL = 'flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill bg-card px-4 '
  + 'text-md font-bold text-navy hover:bg-secondary/[0.04]';

/**
 * **The button row** (P19.8-T2 AC-3; ADR-0228 §3; MOB UI-164; OD-277 by its default): a slim row above the tiles — two
 * white 44px pills, 8px apart, each with its icon:
 *
 * - ***Buat proposal*** → step 1 (`/proposal/new`), for whoever holds `proposal:create` (P19.7-T2 AC-1, ADR-0221 §8, where
 *   it was one 48px pill under the tiles);
 * - ***Tambah user*** → the existing *Add New Agents* page (`/user-management/add`), **only for a reader holding
 *   `member:invite`** — the AB and the AAB on their unit, the Owner and an Admin on the office; never an Agent.
 *
 * **Drawn by role**, never by what the reader has saved (ADR-0189). One pill alone spans the row. **Neither in a read-only
 * support session**, which writes nothing: the server refuses both pages' writes there too.
 */
export function HomeButtons({ className }: { className?: string }) {
  const t = useMessages(homeMessages).buttons;
  const proposal = useMessages(proposalMessages).home;
  const { me } = useSession();
  const readOnly = !!me?.isImpersonating && !!me.impersonationReadOnly;
  const mayPropose = useCan('proposal:create') && !readOnly;
  const mayAdd = useCan('member:invite') && !readOnly;
  if (!mayPropose && !mayAdd) return null;
  return (
    <div data-home-buttons="" className={cn('grid gap-2', mayPropose && mayAdd ? 'grid-cols-2' : 'grid-cols-1', className)}>
      {mayPropose && (
        <Link href={newProposalHref()} data-home-proposal="" className={PILL}>
          <PlanIcon name="file" className="h-[1.125rem] w-[1.125rem] shrink-0" />
          {proposal.make}
        </Link>
      )}
      {mayAdd && (
        <Link href={ADD_USER_HREF} data-home-add-user="" className={PILL}>
          <NavIcon name="userPlus" className="h-[1.125rem] w-[1.125rem] shrink-0" />
          {t.addUser}
        </Link>
      )}
    </div>
  );
}
