'use client';

import { MyActivation } from '@/components/my-activation';
import { Page } from '@/components/page';
import { PROTOTYPE_COPY } from '@/lib/activation';

/**
 * *90-Day Activation* (`/activation`, `Overall.html:3270-3352`, title `:10408`; P13-T4, T6, T7): the
 * hire's own checklist. Gated by `activation:read`, which every field rung holds for their own; the API
 * answers the reader's own activation and nobody else's, and a reader with none, or whose activation is
 * over, meets the page's not-offered state rather than a checklist (T4 AC-7).
 */
export default function ActivationPage() {
  return (
    <Page title={PROTOTYPE_COPY.title} subtitle={PROTOTYPE_COPY.subtitle} permission="activation:read">
      <MyActivation />
    </Page>
  );
}
