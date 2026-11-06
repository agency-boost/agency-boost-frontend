'use client';

import Link from 'next/link';
import { PlanIcon } from '@/components/plan/plan-icons';
import { useMessages } from '@/i18n/language-provider';
import { proposalMessages } from '@/i18n/messages/proposal';
import { cn } from '@/lib/cn';
import { newProposalHref } from '@/lib/proposals';
import { useCan } from '@/lib/session';

/**
 * ***Buat proposal*, Home's quick action** (P19.7-T2 AC-1; the proposal spec's *Where it lives*; ADR-0221 §8): one 48px
 * pill under the reader's tiles, with the document icon, to step 1 (`/proposal/new`). **Drawn by role**: whoever holds
 * `proposal:create` — every field role, and the Owner and an Admin through their own rung — never by what they have saved
 * (ADR-0189). A view-only session holds no write, so it draws none.
 */
export function HomeProposalPill({ className }: { className?: string }) {
  const t = useMessages(proposalMessages).home;
  const may = useCan('proposal:create');
  if (!may) return null;
  return (
    <Link
      href={newProposalHref()}
      data-home-proposal=""
      className={cn(
        'flex min-h-12 items-center justify-center gap-2 rounded-pill bg-card px-5 text-md font-bold text-navy hover:bg-secondary/[0.04]',
        className,
      )}
    >
      <PlanIcon name="file" className="h-5 w-5" />
      {t.make}
    </Link>
  );
}
