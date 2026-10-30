'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export interface PlanTab {
  readonly href: string;
  readonly label: string;
  /** Current on every address beneath its own too — the catalog's tab over a product's drawer. */
  readonly nested?: boolean;
}

/**
 * **The two tabs over a selling page, as one segmented control on a phone** (UI V1, UI-107: *the two tabs as one
 * segmented control* — *Sales Attack Plan | Product Catalog*, *Attack Plan | Pitch Materials*; Mobile only).
 *
 * **One markup at every size**, its look by range: below 768px a white pill track, its two halves equal, the
 * current one navy (`attack-plan-mobile` 1–6); from 768px the underlined strip `RouteTabs` draws, as before — the
 * tablet and the desktop unchanged. Links in a named `nav`, the current one carrying `aria-current`, as `RouteTabs`'
 * are: a tab here changes the address, so it is never a `tablist`.
 *
 * **44px targets** (UI-010): on a phone each half of the 44px track is its link, the pill a 38px span inside it (the
 * mockup's 40px track, 4px taller so the whole half takes the tap); on a tablet in the field shell the underlined tab
 * is 44px tall, as `RouteTabs`' (`TAB_TOUCH`, written out here for the tablet alone).
 */
export function PlanTabs({ label, tabs }: { label: string; tabs: readonly PlanTab[] }) {
  const pathname = usePathname();
  const current = (tab: PlanTab) => pathname === tab.href || (tab.nested === true && pathname.startsWith(`${tab.href}/`));
  return (
    <nav
      aria-label={label}
      data-plan-tabs=""
      className={cn(
        'mb-6 flex flex-wrap gap-6 border-b border-hairline',
        'max-md:mb-3 max-md:flex-nowrap max-md:gap-0 max-md:rounded-pill max-md:border-b-0 max-md:bg-card',
      )}
    >
      {tabs.map((tab) => {
        const on = current(tab);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-0.5 pb-3 text-md font-semibold',
              'md:max-lg:[:root:has([data-surface=v1])_&]:pt-3',
              on ? 'border-amber text-navy' : 'border-transparent text-muted',
              'max-md:mb-0 max-md:flex max-md:min-h-11 max-md:flex-1 max-md:rounded-pill max-md:border-b-0 max-md:p-[3px]',
              'max-md:text-base max-md:focus-visible:[outline-offset:-2px]',
            )}
          >
            <span
              className={cn(
                'max-md:flex max-md:w-full max-md:items-center max-md:justify-center max-md:whitespace-nowrap',
                'max-md:rounded-pill max-md:px-2',
                on && 'max-md:bg-navy max-md:text-white',
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
