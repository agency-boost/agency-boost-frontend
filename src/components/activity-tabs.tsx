import { RouteTabs } from '@/components/ui/route-tabs';

/**
 * Activity management's three sub-tabs (`Overall.html:2712-2716`).
 *
 * The prototype's own titles and subtitles come from `PANEL_META` (`:4811-4815`), and the flow doc
 * records them: *Log Activity* captures, *Activity Dashboard* aggregates, *Activity Ratios* converts.
 * They are three views of one thing, which is why they are a strip rather than three nav items.
 *
 * **All three are built** — the Dashboard in P10-T1, the Ratios in P10-T2. Until then two were signposts,
 * and the strip shipped anyway: it is how a reader learns the other views exist at all (L-32).
 */
export function ActivityTabs() {
  return (
    <RouteTabs
      label="Activity management"
      tabs={[
        { href: '/activity/log', label: 'Log Activity' },
        { href: '/activity/dashboard', label: 'Activity Dashboard' },
        { href: '/activity/ratio', label: 'Activity Ratios' },
      ]}
    />
  );
}
