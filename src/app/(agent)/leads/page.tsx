'use client';

import { LeadsTable } from '@/components/leads-table';
import { Page } from '@/components/page';
import { useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';

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
 * phone changed their mind. `LeadsTable` draws the bar above the prototype's toolbar — `filters` stays the
 * coaching card's own toolbar (`Overall.html:4258-4266`), which replaces the count — and below 768px a
 * read-only card per lead, with a sheet to edit it.
 *
 * **A leader's screen shows their scope** — their own leads and their unit's or downline's — because
 * that is what `GET /leads` answers for their grant (P7-T7). Nothing here narrows it.
 */
export default function LeadsPage() {
  const t = useMessages(leadsMessages);
  return (
    <Page
      title={t.title}
      subtitle={t.subtitle}
      // The client's *Remove* on a phone (P18.95-T7 AC-1, grey text row 25): from 768px it reads as before.
      subtitleOnPhone={false}
      permission="lead:read"
    >
      <LeadsTable />
    </Page>
  );
}
