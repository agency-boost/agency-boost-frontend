'use client';

import { NewHires } from '@/components/new-hires';
import { Page } from '@/components/page';
import { PROTOTYPE_COPY } from '@/lib/activation';

/**
 * *Your New Hires* (`/new-hires`, `Overall.html:3354-3361`, title `:10409`; P13-T5): the open
 * activations the reader reaches, grouped. Gated by `new_hires:read_roster`; the API answers only the
 * hires the reader reaches through `COACH`, resolved at each request, and the nav offers the page only
 * to a reader who has one (OD-122).
 */
export default function NewHiresPage() {
  return (
    <Page title={PROTOTYPE_COPY.rosterTitle} subtitle={PROTOTYPE_COPY.rosterSubtitle} subtitleOnPhone={false} permission="new_hires:read_roster">
      <NewHires />
    </Page>
  );
}
