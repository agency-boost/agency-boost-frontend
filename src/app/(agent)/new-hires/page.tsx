'use client';

import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { NewHires } from '@/components/new-hires';
import { NewHiresJoining, useNewHiresJoining, waitingSummary } from '@/components/new-hires-joining';
import { Page } from '@/components/page';
import { useMessages } from '@/i18n/language-provider';
import { newHiresMessages } from '@/i18n/messages/new-hires';
import { newHiresHref, newHireYearFrom } from '@/lib/activation';
import { useQuery } from '@/lib/use-query';

/**
 * *Your New Hires* (`/new-hires`, `Overall.html:3354-3361`, title `:10409`; P13-T5): the open
 * activations the reader reaches, grouped. Gated by `new_hires:read_roster`; the API answers only the
 * hires the reader reaches through `COACH`, resolved at each request. The nav offers the page to every leader by role,
 * with or without a hire (ADR-0189, P19-T4); an empty one shows its *Contoh* and *Tambah agent pertama*.
 *
 * **Its header carries *+ Add agent* and *Review requests (n)*** (P18.8-T3 AC-1, AC-5; ADR-0170 §1, §5): the one
 * form, and the request inbox while somebody waits on the reader. Above the roster, *Waiting to join*: the invites
 * and transfers the reader made that nobody has accepted or decided (`new-hires-joining.tsx`). Its title is the nav
 * item's words, kept English (§A.2); its line the catalogue's (P18.10-T4).
 *
 * **UI V1 (UI-024)**: below 1024px *+ Tambah agent* is the title row's control; the invitations sit behind the
 * *Menunggu bergabung* tile (a sheet below 768px) and in the right column from it.
 *
 * **The year is the address's** (P19.9-T3 AC-2; ADR-0233): `?year=previous` is *Tahun lalu*, and anything else — no
 * `year` at all — *Tahun berjalan*. Choosing one replaces the address, so Back leaves the page rather than walking the
 * years, and a row's ‹ comes back to the year it was opened from.
 */
export default function NewHiresPage() {
  return (
    // `useSearchParams` needs a boundary (`lib/use-query.ts`). Nothing in its place: a prerender draws the shell's gate, never this.
    <Suspense fallback={null}>
      <NewHiresOnYear />
    </Suspense>
  );
}

function NewHiresOnYear() {
  const t = useMessages(newHiresMessages);
  const joining = useNewHiresJoining();
  const year = newHireYearFrom(useQuery().year);
  const router = useRouter();
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
      <NewHires
        key={joining.rosterKey}
        year={year}
        onYear={(next) => router.replace(newHiresHref(next), { scroll: false })}
        waiting={waitingSummary(joining)}
        onAdd={joining.mayAdd ? () => joining.setAdding(true) : undefined}
      />
    </Page>
  );
}
