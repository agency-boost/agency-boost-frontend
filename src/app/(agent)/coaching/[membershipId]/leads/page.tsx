'use client';

import { CoacheeLeadsTab } from '@/components/coaching-leads';
import { useCoachee } from '@/components/coaching-person';
import { Page } from '@/components/page';

/**
 * A coachee's ***Leads*** tab (UI V1, UI-029): **that agent's leads, read-only**, in the compact rows the session's Leads
 * card draws (`CoacheeLeadsTab`). New with the revision: the person shell had no per-agent Leads view.
 *
 * Every read goes through `GET /leads?owner=` (ADR-0076): answered only for somebody the reader coaches — 404 for anybody
 * else, and across offices — and audited, one `leads` entry per read (roles §3.5). No title of its own: the shell above
 * names the person, as every tab leaves it to (one header, never the name twice).
 */
export default function CoacheeLeadsTabPage() {
  const coachee = useCoachee();
  return (
    <Page permission="lead:read">
      <CoacheeLeadsTab coachee={coachee} />
    </Page>
  );
}
