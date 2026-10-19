'use client';

import { use } from 'react';
import { RoutedCampaignDialog } from '@/components/campaigns/campaign-dialog';

/**
 * **One campaign's dialog, over the list** (`/campaigns/[campaignCode]`; P18.5-T7 AC-4): the address *View
 * details* opens, Back closes, and a link or a typed address opens again. The list is the layout's. A code
 * the reader's list does not hold — another office's, an archived one, a typo — is the dialog's not-found.
 */
export default function CampaignDialogPage({ params }: { params: Promise<{ campaignCode: string }> }) {
  const { campaignCode } = use(params);
  return <RoutedCampaignDialog key={campaignCode} code={decodeURIComponent(campaignCode)} />;
}
