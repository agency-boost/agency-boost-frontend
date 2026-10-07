'use client';

import Link from 'next/link';
import { useId } from 'react';
import { usePathname } from 'next/navigation';

/**
 * The sub-tabs inside one Settings item.
 *
 * **Activity types and Ratio benchmarks are one sidebar entry, not two.** The Owner
 * prototype's Settings group has seven items and `Ratio benchmarks` is not among them —
 * the benchmarks sit inside the Activity types screen (`KPM_Owner.html:894-904`,
 * `:1451-1490`), which is also why the route registry splits them into two routes under
 * one nav item. `shell-nav.spec.tsx` holds that as a parity assertion, and it caught this
 * being added to the sidebar.
 *
 * The same shape is what ADR-0018 says the Super Admin template screen uses: an Owner item
 * that is split across routes becomes subtabs there too.
 */
export function SettingsTabs({
  tabs,
  onSelect,
  activeHref,
  label = 'Activity settings',
  variant = 'tabs',
}: {
  /**
   * `hint`, where a tab has one, is its tooltip: shown on hover and given to a screen reader as the
   * link's description — the Super Admin's template screen says that *Campaigns* and *Products* are the
   * company's, shared by every template (ADR-0115 §7).
   */
  tabs: { label: string; href: string; hint?: string }[];
  /**
   * When the tabs switch a panel rather than a route.
   *
   * The Owner's two are separate routes, because they were separate routes before this
   * component existed and a reader can link to either. The Super Admin's seven are one
   * screen with one `companyId`, and seven routes for seven panels of the same document
   * would be seven places to get the id wrong.
   */
  onSelect?: (href: string) => void;
  activeHref?: string;
  /**
   * The row's accessible name.
   *
   * Two rows of tabs on one screen — an item and its halves — are two `<nav>`s, and two
   * landmarks with the same name is a landmark a screen-reader user cannot tell apart.
   */
  label?: string;
  /**
   * Whether this row is the item or the half.
   *
   * Two underlined rows stacked on one screen read as two peers, and on the Super Admin's
   * template screen they also read as a bug: the Owner's nav item is *Activity types* and
   * so is the first of its two halves, so the same word sat twice, both underlined amber,
   * with nothing saying one contained the other. Faithful to the prototype and still
   * wrong on screen.
   *
   * Subtabs are pills instead — subordinate at a glance, and the shape the client asked
   * for when they said the subtab belongs under the tab.
   */
  variant?: 'tabs' | 'subtabs';
}) {
  const pathname = usePathname();
  const subtabs = variant === 'subtabs';
  const hintId = useId();

  return (
    <nav
      className={subtabs
        ? 'mb-4 flex flex-wrap gap-1'
        : 'mb-4 flex flex-wrap gap-1 border-b border-hairline'}
      aria-label={label}
    >
      {tabs.map((tab) => {
        const active = (activeHref ?? pathname) === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            title={tab.hint}
            aria-describedby={tab.hint ? `${hintId}${tab.href}` : undefined}
            onClick={onSelect && ((event) => {
              event.preventDefault();
              onSelect(tab.href);
            })}
            className={[
              subtabs ? 'rounded-full px-3 py-1 text-sm' : 'border-b-2 px-3 py-2 text-md',
              active && subtabs ? 'bg-amber font-semibold text-navy' : '',
              active && !subtabs ? 'border-amber font-semibold text-navy' : '',
              !active && subtabs ? 'text-muted hover:bg-base hover:text-navy' : '',
              !active && !subtabs ? 'border-transparent text-muted hover:text-navy' : '',
            ].filter(Boolean).join(' ')}
          >
            {tab.label}
            {tab.hint && <span id={`${hintId}${tab.href}`} hidden>{tab.hint}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** The two halves of the prototype's Activity types screen. */
export const ACTIVITY_SETTINGS_TABS = [
  { label: 'Activity types', href: '/kpm/settings/activity-types' },
  { label: 'Ratio benchmarks', href: '/kpm/settings/ratio-benchmarks' },
];
