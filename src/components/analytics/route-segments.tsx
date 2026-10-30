'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/**
 * **Sibling screens as one segmented control** (UI V1, UI-109; `kpm-mobile`'s `.seg`): a white pill track, the current
 * screen a navy pill — KPM Analytics' *Overview | Compliance* on a phone in the field shell.
 *
 * **Links, not tabs**: each segment changes the address, so they are links in a `nav` and the current one carries
 * `aria-current`, as `RouteTabs` does — a `role="tab"` would promise a panel in this document. 44px tall.
 */
export function RouteSegments({
  label,
  segments,
  className,
}: {
  label: string;
  segments: readonly { href: string; label: string }[];
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={cn('mb-3 flex h-11 rounded-pill bg-card p-[3px]', className)} data-route-segments="">
      {segments.map((segment) => {
        const on = pathname === segment.href;
        return (
          <Link
            key={segment.href}
            href={segment.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-pill px-2.5 text-base font-semibold',
              on ? 'bg-navy text-white' : 'text-muted hover:text-navy',
            )}
          >
            {segment.label}
          </Link>
        );
      })}
    </nav>
  );
}
