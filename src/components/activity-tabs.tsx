import { RouteTabs } from '@/components/ui/route-tabs';

/**
 * Activity management's three sub-tabs (`Overall.html:2712-2716`).
 *
 * The prototype's own titles and subtitles come from `PANEL_META` (`:4811-4815`), and the flow doc
 * records them: *Log Activity* captures, *Activity Dashboard* aggregates, *Activity Ratios* converts.
 * They are three views of one thing, which is why they are a strip rather than three nav items.
 *
 * **Two of the three are signposts until Phase 10**, and the strip ships anyway: it is how a reader
 * learns the other views exist at all, and the registry has assigned both routes since Phase 0.
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
