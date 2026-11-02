'use client';

import { MyActivation } from '@/components/my-activation';
import { Page } from '@/components/page';
import { useMessages } from '@/i18n/language-provider';
import { activationMessages } from '@/i18n/messages/activation';

/**
 * *90-Day Activation* (`/activation`, `Overall.html:3270-3352`, title `:10408`; P13-T4, T6, T7): the
 * hire's own checklist. Gated by `activation:read`, which every field rung holds for their own; the API
 * answers the reader's own activation and nobody else's, and a reader with none, or whose activation is
 * over, meets the page's not-offered state rather than a checklist (T4 AC-7). Its title is the nav item's words, kept
 * English (§A.2); its line the catalogue's (P18.98-T4).
 */
export default function ActivationPage() {
  const t = useMessages(activationMessages);
  return (
    <Page title={t.title} subtitle={t.subtitle} permission="activation:read">
      <MyActivation />
    </Page>
  );
}
