'use client';

import { Suspense } from 'react';
import { Page } from '@/components/page';
import { NewProposal } from '@/components/proposal/proposal-screens';
import { useMessages } from '@/i18n/language-provider';
import { proposalMessages } from '@/i18n/messages/proposal';
import { useQuery } from '@/lib/use-query';

/**
 * **`/proposal/new` — step 1, with nothing stored** (P19.7-T2 AC-3, AC-4; ADR-0221 §3). `?leadId=` chooses that lead:
 * *Buat proposal* on a Sales lead's card and sheet comes here with it. *Lanjut* creates the draft and moves on to it.
 */
export default function NewProposalPage() {
  return (
    // `useSearchParams` needs a boundary (`lib/use-query.ts`).
    <Suspense fallback={null}>
      <NewProposalAt />
    </Suspense>
  );
}

function NewProposalAt() {
  const t = useMessages(proposalMessages);
  const query = useQuery();
  const leadId = typeof query.leadId === 'string' && query.leadId !== '' ? query.leadId : null;
  return (
    <Page title={t.title} permission="proposal:read">
      <NewProposal leadId={leadId} />
    </Page>
  );
}
