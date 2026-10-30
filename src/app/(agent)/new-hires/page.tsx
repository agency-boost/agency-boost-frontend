'use client';

import { NewHires } from '@/components/new-hires';
import { NewHiresJoining, useNewHiresJoining, waitingSummary } from '@/components/new-hires-joining';
import { Page } from '@/components/page';
import { useMessages } from '@/i18n/language-provider';
import { newHiresMessages } from '@/i18n/messages/new-hires';

/**
 * *Your New Hires* (`/new-hires`, `Overall.html:3354-3361`, title `:10409`; P13-T5): the open
 * activations the reader reaches, grouped. Gated by `new_hires:read_roster`; the API answers only the
 * hires the reader reaches through `COACH`, resolved at each request, and the nav offers the page only
 * to a reader who has one (OD-122) — or who may add agents (P18.96-T3).
 *
 * **Its header carries *+ Add agent* and *Review requests (n)*** (P18.96-T3 AC-1, AC-5; ADR-0170 §1, §5): the one
 * form, and the request inbox while somebody waits on the reader. Above the roster, *Waiting to join*: the invites
 * and transfers the reader made that nobody has accepted or decided (`new-hires-joining.tsx`). Its title is the nav
 * item's words, kept English (§A.2); its line the catalogue's (P18.98-T4).
 *
 * **UI V1 (UI-024)**: below 1024px *+ Tambah agent* is the title row's control; the invitations sit behind the
 * *Menunggu bergabung* tile (a sheet below 768px) and in the right column from it.
 */
export default function NewHiresPage() {
  const t = useMessages(newHiresMessages);
  const joining = useNewHiresJoining();
  return (
    <Page
      title={t.title}
      subtitle={t.subtitle}
      subtitleOnPhone={false}
      permission="new_hires:read_roster"
      actions={joining.actions}
      control={joining.control}
    >
      <NewHiresJoining {...joining} />
      <NewHires key={joining.rosterKey} waiting={waitingSummary(joining)} />
    </Page>
  );
}
