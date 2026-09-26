import { ComingInPhase } from '@/components/coming-in-phase';
import { Page } from '@/components/page';
import { ActivityTabs } from '@/components/activity-tabs';

/**
 * The second of Activity management's three sub-tabs (`Overall.html:2747-2782`).
 *
 * A signpost rather than a screen: the tab strip the prototype draws is built now, because it is how a
 * reader learns the other two views exist, and a strip pointing at 404s would be worse than no strip.
 * What goes here needs the aggregation Phase 10 builds.
 */
export default function ActivityDashboardPage() {
  return (
    <Page title="Activity Dashboard" subtitle="Your own activity, day by day.">
      <ActivityTabs />
      <ComingInPhase
        phase={10}
        what="Your logged activity totalled over a range you choose, by category and by day, so you can see where a week actually went."
        elsewhere={[
          {
            href: '/activity/log',
            label: 'Log activity',
            detail: "Today's work, in about a minute.",
          },
          {
            href: '/goals',
            label: 'Goal settings',
            detail: 'The targets this activity is counted against.',
          },
        ]}
      />
    </Page>
  );
}
