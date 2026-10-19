'use client';

import { LeadsTable } from '@/components/leads-table';
import { Page } from '@/components/page';

/**
 * Leads Management — `Overall.html:2787-2846`, back to the prototype (P10.1-T4).
 *
 * **The table and nothing around it.** The client asked for the screen as the prototype draws it
 * (ADR-0062): the counts strip, the filter card, the add-lead card and the pager are gone, and what a
 * hard requirement keeps lives in the table's Actions column (ADR-0063). The table itself is
 * `LeadsTable`, because the coaching session's *Leads* card mounts the same one (P11-T8).
 *
 * **Without its search and type filter.** Those belong to the coaching card (`Overall.html:4258-4266`);
 * the client chose a leads screen that cannot be searched, knowing it (ADR-0062), so `filters` is
 * left off here and the spec pins it off.
 *
 * **A leader's screen shows their scope** — their own leads and their unit's or downline's — because
 * that is what `GET /leads` answers for their grant (P7-T7). Nothing here narrows it.
 */
export default function LeadsPage() {
  return (
    <Page
      title="Leads Management"
      subtitle="Track and follow up on your sales and recruitment leads."
      permission="lead:read"
    >
      <LeadsTable />
    </Page>
  );
}
