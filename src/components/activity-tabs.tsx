'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { kept } from '@/i18n/kept';
import { cn } from '@/lib/cn';

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
 * **The heading above all three: the nav item's own words** (P18.7-T9 AC-2; ADR-0167 §10, OD-205; the client's
 * UI review, UI-027 — *menu labels = page titles*). The prototype titled each tab's page after the tab — *Log
 * Activity*, *Activity Dashboard*, *Activity Ratios* (`PANEL_META`) — under a nav item reading *Activity
 * management*, so the menu said one thing and the page another. The tabs below still name each view.
 *
 * **Every word here is kept English in both languages** (P18.10-T4; the glossary's §A.1 to §A.3): the title, the nav
 * item that names the strip, and the three tabs.
 */
export const ACTIVITY_TITLE = kept('Activity Management');

/**
 * **The title on a phone: *Activity*** (UI V1, UI-106 and UI-004: *Title row "Activity" + avatar*) — the tab bar's own
 * word, kept English in both languages.
 *
 * *Changed 2026-11-04 (P19.1-T1 AC-1, ADR-0196; UI-112: each page's title is its phone title; `activity-tablet-desktop`:
 * *Title "Activity" (same as the tab)*):* **at every size**. It was *Activity Management* from 768px; the sidebar's item
 * keeps those words.
 */
export function useActivityTitle(): string {
  return kept('Activity');
}

const TABS = [
  { href: '/activity/log', label: kept('Log Activity') },
  { href: '/activity/dashboard', label: kept('Dashboard') },
  { href: '/activity/ratio', label: kept('Ratio') },
] as const;

/**
 * The three views. **On a phone, one segmented control** (UI V1, UI-106: *Log Activity | Dashboard | Ratio as one
 * segmented control*): a white track, the current view a navy pill, each a link 44px tall sharing the track's width.
 *
 * *Changed 2026-11-04 (P19.1-T1 AC-1, ADR-0196; UI-112, `activity-tablet-desktop`: *one control row: Log | Dashboard |
 * Ratio + date pill*):* **the same control from 768px**, as wide as its words, at the head of the page's control row; it
 * was the underlined strip there. A phone's is unchanged.
 */
export function ActivityTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label={kept('Activity management')}
      data-segmented=""
      className="mb-2.5 flex rounded-pill bg-card p-[3px] md:mb-0 md:inline-flex md:shrink-0"
    >
      {TABS.map((tab) => {
        const current = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-pill px-2 text-base font-semibold',
              'md:flex-none md:px-3.5 md:text-md',
              current ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
