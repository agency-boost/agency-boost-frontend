'use client';

import { Suspense, use } from 'react';
import { Page } from '@/components/page';
import { ProposalScreen } from '@/components/proposal/proposal-screens';
import { useMessages } from '@/i18n/language-provider';
import { proposalMessages } from '@/i18n/messages/proposal';
import { stepOf } from '@/lib/proposals';
import { useQuery } from '@/lib/use-query';

/**
 * **`/proposal/[proposalId]` — the three steps of a stored proposal** (P19.7-T2 AC-2; ADR-0221 §3): `?step=1|2|3`, step 2
 * when it says nothing else. Another member's, another office's or a deleted proposal is the API's `404
 * PROPOSAL_NOT_FOUND`, for every role, shown as the step's error.
 */
export default function ProposalStepsPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = use(params);
  return (
    <Suspense fallback={null}>
      <ProposalAt id={decodeURIComponent(proposalId)} />
    </Suspense>
  );
}

function ProposalAt({ id }: { id: string }) {
  const t = useMessages(proposalMessages);
  const query = useQuery();
  const step = stepOf(typeof query.step === 'string' ? query.step : null);
  return (
    <Page title={t.title} permission="proposal:read">
      <ProposalScreen key={id} id={id} step={step} />
    </Page>
  );
}
