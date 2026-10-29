'use client';

import { ActivityDashboardPanel } from '@/components/activity-dashboard';
import { ACTIVITY_TITLE, ActivityTabs } from '@/components/activity-tabs';
import { Page } from '@/components/page';
import { useMessages } from '@/i18n/language-provider';
import { activityMessages } from '@/i18n/messages/activity';

/**
 * The Activity Dashboard (P10-T1): your own days over a range, types down and time across
 * (`Overall.html:2737-2773`, `activity-management.md` §2.3).
 *
 * The body is `ActivityDashboardPanel`, which coaching's *Activity* tab draws too, for a coachee
 * (P13.1-T9). Here it is the reader's own, under the screen's title and the activity tabs.
 */
export default function ActivityDashboardPage() {
  const t = useMessages(activityMessages);
  return (
    <Page title={ACTIVITY_TITLE} subtitle={t.dashboard.subtitle}>
      <ActivityTabs />
      <ActivityDashboardPanel />
    </Page>
  );
}
