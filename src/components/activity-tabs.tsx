import { RouteTabs } from '@/components/ui/route-tabs';
import { kept } from '@/i18n/kept';

/**
 * Activity management's three sub-tabs (`Overall.html:2712-2716`).
 *
 * The prototype's own titles and subtitles come from `PANEL_META` (`:4811-4815`), and the flow doc
 * records them: *Log Activity* captures, *Activity Dashboard* aggregates, *Activity Ratios* converts.
 * They are three views of one thing, which is why they are a strip rather than three nav items.
 *
 * **All three are built** — the Dashboard in P10-T1, the Ratios in P10-T2. Until then two were signposts,
 * and the strip shipped anyway: it is how a reader learns the other views exist at all (L-32).
 *
 * **The tabs read the prototype's own words**, *Log Activity · Dashboard · Ratio* (`:2712-2716`,
 * P10.1-T5). They borrowed the page titles, which the prototype keeps for the heading above them.
 */

/**
 * **The heading above all three: the nav item's own words** (P18.95-T9 AC-2; ADR-0167 §10, OD-205; the client's
 * UI review, UI-027 — *menu labels = page titles*). The prototype titled each tab's page after the tab — *Log
 * Activity*, *Activity Dashboard*, *Activity Ratios* (`PANEL_META`) — under a nav item reading *Activity
 * management*, so the menu said one thing and the page another. The tabs below still name each view.
 *
 * **Every word here is kept English in both languages** (P18.98-T4; the glossary's §A.1 to §A.3): the title, the nav
 * item that names the strip, and the three tabs.
 */
export const ACTIVITY_TITLE = kept('Activity Management');

export function ActivityTabs() {
  return (
    <RouteTabs
      label={kept('Activity management')}
      tabs={[
        { href: '/activity/log', label: kept('Log Activity') },
        { href: '/activity/dashboard', label: kept('Dashboard') },
        { href: '/activity/ratio', label: kept('Ratio') },
      ]}
    />
  );
}
