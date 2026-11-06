'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { LineIcon } from '@/components/ui/line-icon';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { useCan } from '@/lib/session';
import { useMediaQuery } from '@/lib/use-media-query';

/** The list and its sheets — and, from 1024px, the list beside the lead's pane — loaded with the page's data, not before. */
const LeadsList = dynamic(() => import('@/components/leads-list').then((m) => m.LeadsList), {
  ssr: false,
  loading: () => <SkeletonCards count={4} />,
});

/**
 * Leads — `Overall.html:2787-2846`, the prototype's *Leads Management*, as the client's revisions have redrawn it.
 *
 * **Below 1024px, the compact list** (UI V1, UI-105; D-10, D-18, D-19; ADR-0180): *Leads* and the avatar on the title
 * row, a search pill and a filter button, the type chips, the pipeline strip, a compact card per lead and the lead sheet
 * (`LeadsList`, `LeadSheet`). On a tablet the cards are two to a row (P19.1-T2 AC-2; UI-113, UI-116).
 *
 * **From 1024px, list + detail, like WhatsApp** (P19.1-T2 AC-3, AC-4; UI-116; `leads-tablet-desktop` frames 1 and 1b):
 * the same list in a column of its own, the lead open in a pane beside it — the lead sheet's editor (`LeadPane`) — and
 * ***+ Tambah lead* in the title row**. It replaced the table (`LeadsTable`, ADR-0108, ADR-0161), whose capabilities
 * the list and the pane keep (`leads-list.tsx`). The page's gutter is 20px from 1024px, as the mockup's frames draw it,
 * so the pane is never under ~540px (`SPLIT`).
 *
 * Which one is decided once the window has answered (`useMediaQuery`): until then a skeleton, so neither reads the leads
 * only to be replaced by the other.
 *
 * **A leader's screen shows their scope** — their own leads and their unit's or downline's — because
 * that is what `GET /leads` answers for their grant (P7-T7). Nothing here narrows it.
 */
export default function LeadsPage() {
  const t = useMessages(leadsMessages);
  const compact = useMediaQuery(['phone', 'tablet']);
  const canCreate = useCan('lead:create');
  /** Whether the window has answered: the first render cannot know, and a list read twice is a wasted request. */
  const [settled, setSettled] = useState(false);
  useEffect(() => setSettled(true), []);
  /** Each press of the title row's *+ Tambah lead*, which the list answers with a new lead in its pane. */
  const [adds, setAdds] = useState(0);
  const split = settled && !compact;

  return (
    <div className="lg:-mx-5" data-leads-page="">
      <Page
        // *Leads* at every size (P19.1-T1 AC-1; UI-112: *each page's title is its phone title*, not *Leads Management*).
        title={t.list.title}
        subtitle={t.subtitle}
        // The client's *Remove* on a phone (P18.7-T7 AC-1, grey text row 25); the compact list's title row on a tablet too.
        subtitleOnPhone={false}
        subtitleOnTablet={false}
        // UI-116: *"+ Tambah lead" in the title row* from 1024px, where the floating + is not drawn.
        actions={split && canCreate ? (
          <button
            type="button"
            onClick={() => setAdds((n) => n + 1)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-primary px-[18px] text-md font-bold text-primary-contrast hover:bg-primary-hover"
          >
            <LineIcon name="plus" className="h-5 w-5" />
            {t.list.add}
          </button>
        ) : undefined}
        permission="lead:read"
      >
        {!settled ? <SkeletonCards count={4} /> : compact ? (
          /*
           * **Nothing under the + button on a tablet** (P19.1-T1 AC-5; UI-124: it covered the last card's WhatsApp button):
           * the list ends at least the button's 56px and 16px above where the button stands. A phone is out of the
           * ticket's scope.
           */
          <div data-leads-room="" className="md:max-lg:pb-[4.5rem]"><LeadsList /></div>
        ) : <LeadsList split addRequest={adds} />}
      </Page>
    </div>
  );
}
