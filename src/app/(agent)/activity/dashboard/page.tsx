'use client';

import { ActivityDashboardPanel } from '@/components/activity-dashboard';
import { ACTIVITY_TITLE, ActivityTabs } from '@/components/activity-tabs';
import { Page } from '@/components/page';

/**
 * The Activity Dashboard (P10-T1): your own days over a range, types down and time across
 * (`Overall.html:2737-2773`, `activity-management.md` §2.3).
 *
 * The body is `ActivityDashboardPanel`, which coaching's *Activity* tab draws too, for a coachee
 * (P13.1-T9). Here it is the reader's own, under the screen's title and the activity tabs.
 */
export default function ActivityDashboardPage() {
  return (
    <Page title={ACTIVITY_TITLE} subtitle="Your own activity, day by day.">
      <ActivityTabs />
      <ActivityDashboardPanel />
    </Page>
  );
}
