'use client';

import type { ReactNode } from 'react';
import { CampaignList } from '@/components/campaigns/campaign-list';
import { Page } from '@/components/page';
import { useMessages } from '@/i18n/language-provider';
import { campaignsMessages } from '@/i18n/messages/campaigns';

/**
 * **Campaigns** (`/campaigns`, and its dialog at `/campaigns/[campaignCode]`; `Overall.html:3664-3702`, title
 * `:10411`; P18.5-T7).
 *
 * **A layout, so the list is mounted once** for both addresses: opening a campaign pushes the dialog's
 * address over the list and Back closes it, the list where it was (P14's D-urls). The pages beneath are
 * nothing — the list's own address — and the dialog.
 *
 * Gated by `campaign:read_list`, which every member of the office holds: the Owner and the Admin reach it
 * through their field view (ADR-0114). The API answers the office's own campaigns whatever this decides.
 */
export default function CampaignsLayout({ children }: { children: ReactNode }) {
  const t = useMessages(campaignsMessages);
  return (
    // No sub-line on a phone (UI V1, UI-108: *grey intro paragraphs* gone; D-08); from 768px as before.
    <Page title={t.title} subtitle={t.subtitle} subtitleOnPhone={false} permission="campaign:read_list">
      <CampaignList>{children}</CampaignList>
    </Page>
  );
}
