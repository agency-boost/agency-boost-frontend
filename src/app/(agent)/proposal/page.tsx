'use client';

import { Page } from '@/components/page';
import { ProposalHistory } from '@/components/proposal/proposal-history';
import { SalesToolsTabs } from '@/components/sales-tools-tabs';
import { useMessages } from '@/i18n/language-provider';
import { proposalMessages } from '@/i18n/messages/proposal';

/**
 * **`/proposal` — *Proposal → Riwayat*** (P19.7-T2 AC-1, AC-10; ADR-0221 §5, §8): the third tab of the Sales tools strip,
 * *Sales Attack Plan | Product Catalog | Proposal*, and *Aktivitas → Sales* current on it. Gated by `proposal:read`, every
 * field role's own (the Owner and an Admin in *Akun saya*, through their rung); the API answers the reader's own
 * proposals and nobody else's.
 */
export default function ProposalPage() {
  const t = useMessages(proposalMessages);
  return (
    <Page title={t.title} permission="proposal:read">
      <SalesToolsTabs />
      <ProposalHistory />
    </Page>
  );
}
