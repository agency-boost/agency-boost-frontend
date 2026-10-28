'use client';

import { NewHires } from '@/components/new-hires';
import { NewHiresJoining, useNewHiresJoining } from '@/components/new-hires-joining';
import { Page } from '@/components/page';
import { PROTOTYPE_COPY } from '@/lib/activation';

/**
 * *Your New Hires* (`/new-hires`, `Overall.html:3354-3361`, title `:10409`; P13-T5): the open
 * activations the reader reaches, grouped. Gated by `new_hires:read_roster`; the API answers only the
 * hires the reader reaches through `COACH`, resolved at each request, and the nav offers the page only
 * to a reader who has one (OD-122) — or who may add agents (P18.96-T3).
 *
 * **Its header carries *+ Add agent* and *Review requests (n)*** (P18.96-T3 AC-1, AC-5; ADR-0170 §1, §5): the one
 * form, and the request inbox while somebody waits on the reader. Above the roster, *Waiting to join*: the invites
 * and transfers the reader made that nobody has accepted or decided (`new-hires-joining.tsx`).
 */
export default function NewHiresPage() {
  const joining = useNewHiresJoining();
  return (
    <Page
      title={PROTOTYPE_COPY.rosterTitle}
      subtitle={PROTOTYPE_COPY.rosterSubtitle}
      subtitleOnPhone={false}
      permission="new_hires:read_roster"
      actions={joining.actions}
    >
      <NewHiresJoining {...joining} />
      <NewHires key={joining.rosterKey} />
    </Page>
  );
}
