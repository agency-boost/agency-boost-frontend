'use client';

import { ActivityDashboardPanel } from '@/components/activity-dashboard';
import { useCoachee } from '@/components/coaching-person';
import { Page } from '@/components/page';

/**
 * A coachee's *Activity* tab (P13.1-T9): their Activity Dashboard — the range, the strip and the table
 * `/activity/dashboard` draws for the reader — between *Goal Setting* and *Training*, at the client's
 * request of 2026-10-07. The prototype's person view has no such tab (`Overall.html:3988-3995`); its
 * session tab opens the same days in a dialog, *{name} — Activity Dashboard*, which stays.
 *
 * Every read goes through `GET /activity/dashboard?for=`: answered only for somebody the reader coaches,
 * drawn on the coachee's rung (ADR-0020), and audited (roles §3.5). **No *Log Activity***: nobody logs
 * another person's day. No title of its own: the shell above names the person, as the other tabs leave
 * it to.
 */
export default function CoacheeActivityTab() {
  const coachee = useCoachee();
  return (
    <Page permission="activity_log:read_raw">
      <ActivityDashboardPanel
        subject={{
          membershipId: coachee.membershipId,
          name: coachee.name,
          pronoun: coachee.pronoun,
          rungCode: coachee.rung.code,
        }}
      />
    </Page>
  );
}
