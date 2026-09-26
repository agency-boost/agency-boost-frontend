import { ComingInPhase } from '@/components/coming-in-phase';
import { Page } from '@/components/page';
import { ActivityTabs } from '@/components/activity-tabs';

/**
 * The third of Activity management's three sub-tabs (`Overall.html:2785-2791`).
 *
 * Five conversion ratios over a rolling 30-day window. The ratio *definitions* and their benchmarks
 * already exist — an Owner configures them, and `RATIO_BENCHMARKS` is pinned — but computing an agent's
 * own ratios needs the derived surfaces Phase 10 builds.
 */
export default function ActivityRatioPage() {
  return (
    <Page title="Activity Ratios" subtitle="How your activity is converting.">
      <ActivityTabs />
      <ComingInPhase
        phase={10}
        what="Your own conversion rates over the last 30 days — leads to appointments, appointments to closings — each against your office's benchmark."
        elsewhere={[
          {
            href: '/activity/log',
            label: 'Log activity',
            detail: "Today's work, in about a minute.",
          },
          {
            href: '/goals',
            label: 'Goal settings',
            detail: 'The conversion rates you are planning with.',
          },
        ]}
      />
    </Page>
  );
}
