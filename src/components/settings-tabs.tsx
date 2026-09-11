'use client';

import Link from 'next/link';
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
}: {
  tabs: { label: string; href: string }[];
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
}) {
  const pathname = usePathname();

  return (
    <nav className="mb-4 flex flex-wrap gap-1 border-b border-hairline" aria-label="Activity settings">
      {tabs.map((tab) => {
        const active = (activeHref ?? pathname) === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            onClick={onSelect && ((event) => {
              event.preventDefault();
              onSelect(tab.href);
            })}
            className={
              active
                ? 'border-b-2 border-amber px-3 py-2 text-md font-semibold text-navy'
                : 'border-b-2 border-transparent px-3 py-2 text-md text-muted hover:text-navy'
            }
          >
            {tab.label}
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
