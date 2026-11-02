'use client';

import { CoacheeActivity } from '@/components/coaching-activity';
import { useCoachee } from '@/components/coaching-person';
import { Page } from '@/components/page';

/**
 * A coachee's *Activity* tab (P13.1-T9; UI V1, UI-029): **their Log, Dashboard and Ratio** under the one agent header,
 * as `/activity` draws them for the reader (`CoacheeActivity`) — opening on the Dashboard, which the tab drew alone
 * before.
 *
 * Every read is the coachee's, answered only for somebody the reader coaches, on their rung (ADR-0020), and audited
 * (roles §3.5): `GET /activity/log?membershipId=`, `GET /activity/dashboard?for=`, `GET /activity/ratios?for=`. **No
 * *Log Activity* form**: nobody logs another person's day. No title of its own: the shell above names the person.
 */
export default function CoacheeActivityTab() {
  const coachee = useCoachee();
  return (
    <Page permission="activity_log:read_raw">
      <CoacheeActivity coachee={coachee} />
    </Page>
  );
}
