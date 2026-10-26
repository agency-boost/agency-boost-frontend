'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export interface RouteTab {
  readonly href: string;
  readonly label: string;
  /** Shown, greyed and not followable, with `hint` saying why. A chain says why a rung is closed. */
  readonly locked?: boolean;
  readonly hint?: string;
  /** A count beside the label — an inbox with something in it. */
  readonly badge?: ReactNode;
  /**
   * Current on every address beneath its own as well — the catalog's tab over a product's drawer,
   * `/product-catalog/{code}` (P18.8-T12). A prefix is not a parent: `/product-catalogs` is not beneath it.
   */
  readonly nested?: boolean;
}

/**
 * A row of sibling screens, underlined, with an amber rule under the one you are on.
 *
 * The prototype's `.subtabs` (`Overall.html:81-89`): 24px between tabs, the underline sitting **on**
 * the hairline via `-mb-px`, and inactive tabs at the **same weight** as the active one — they differ
 * by colour and the rule, not by weight. Getting that wrong makes the strip jump as you move along it.
 *
 * **These change the URL, so they are links in a `nav` and the current one carries `aria-current`** —
 * not a `tablist`. A `role="tab"` promises a panel in the same document that `aria-controls` can name,
 * and a route change has none. `Segmented` is the tablist, for switching a panel in place.
 *
 * A locked tab **stays visible and says why**, rather than disappearing: the four User Management
 * screens are one journey, and a rung vanishing from a chain reads as a step you already missed
 * (`Overall.html:8824`).
 */
export function RouteTabs({
  label,
  tabs,
  className,
}: {
  /** Names the group for a screen reader — *"User Management"*, *"Activity management"*. */
  label: string;
  tabs: readonly RouteTab[];
  className?: string;
}) {
  const pathname = usePathname();
  const TAB = '-mb-px border-b-2 px-0.5 pb-3 text-md font-semibold';
  const current = (tab: RouteTab) => pathname === tab.href || (tab.nested === true && pathname.startsWith(`${tab.href}/`));

  return (
    <nav aria-label={label} className={cn('mb-6 flex flex-wrap gap-6 border-b border-hairline', className)}>
      {tabs.map((tab) =>
        tab.locked ? (
          <span
            key={tab.href}
            aria-disabled
            title={tab.hint}
            className={cn(TAB, 'cursor-default border-transparent text-muted/50')}
          >
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current(tab) ? 'page' : undefined}
            className={cn(
              TAB,
              current(tab) ? 'border-amber text-navy' : 'border-transparent text-muted',
            )}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.badge}
            </span>
          </Link>
        ),
      )}
    </nav>
  );
}
