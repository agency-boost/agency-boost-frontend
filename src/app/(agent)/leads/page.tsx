'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { LeadsTable } from '@/components/leads-table';
import { Page } from '@/components/page';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { useMediaQuery } from '@/lib/use-media-query';

/** The compact list and its sheets, below 1024px only: a desktop never loads them (the bundle, Phase 18.99's rules). */
const LeadsList = dynamic(() => import('@/components/leads-list').then((m) => m.LeadsList), {
  ssr: false,
  loading: () => <SkeletonCards count={4} />,
});

/**
 * Leads Management — `Overall.html:2787-2846`, back to the prototype (P10.1-T4).
 *
 * **The table and nothing around it.** The client asked for the screen as the prototype draws it
 * (ADR-0062): the counts strip, the filter card, the add-lead card and the pager are gone, and what a
 * hard requirement keeps lives in the table's Actions column (ADR-0063). The table itself is
 * `LeadsTable`, because the coaching session's *Leads* card mounts the same one (P11-T8).
 *
 * **With a search and two filters since P18.95-T4** (ADR-0167 §4; the client's UI review of 2026-10-26,
 * UI-016). Until then the client had chosen a leads screen that cannot be searched (ADR-0062); 71 leads on a
 * phone changed their mind. `LeadsTable` draws the bar above the prototype's toolbar.
 *
 * **Below 1024px, the compact list** (UI V1, UI-105; D-10, D-18, D-19; ADR-0180): *Leads* and the avatar on the title
 * row, a search pill and a filter button, the type chips, the pipeline strip, a compact card per lead and the lead sheet
 * (`LeadsList`, `LeadSheet`). A phone's and a tablet's — the report's *tablet uses the same list* — and **a desktop keeps
 * the table** until it is reviewed. Which one is decided once the window has answered (`useMediaQuery`): until then a
 * skeleton, so neither reads the leads only to be replaced by the other.
 *
 * **A leader's screen shows their scope** — their own leads and their unit's or downline's — because
 * that is what `GET /leads` answers for their grant (P7-T7). Nothing here narrows it.
 */
export default function LeadsPage() {
  const t = useMessages(leadsMessages);
  const compact = useMediaQuery(['phone', 'tablet']);
  /** Whether the window has answered: the first render cannot know, and a list read twice is a wasted request. */
  const [settled, setSettled] = useState(false);
  useEffect(() => setSettled(true), []);

  return (
    <Page
      title={compact ? t.list.title : t.title}
      subtitle={t.subtitle}
      // The client's *Remove* on a phone (P18.95-T7 AC-1, grey text row 25); the compact list's title row on a tablet too.
      subtitleOnPhone={false}
      subtitleOnTablet={false}
      permission="lead:read"
    >
      {!settled ? <SkeletonCards count={4} /> : compact ? <LeadsList /> : <LeadsTable />}
    </Page>
  );
}
