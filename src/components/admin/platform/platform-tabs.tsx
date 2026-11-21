'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HEADER_CONTROL } from '@/components/ui/header-control';
import { PickerMenu } from '@/components/ui/picker-menu';
import { useMessages } from '@/i18n/language-provider';
import { adminPlatformMessages } from '@/i18n/messages/admin-platform';
import { cn } from '@/lib/cn';
import { PLATFORM_SECTIONS, platformHref, type PlatformSection } from '@/lib/platform';
import { useMediaQuery } from '@/lib/use-media-query';

/**
 * ***Platform*'s four sections** (P19.23-T6; frames f52–f55; spec §12): *Audit log · Tim Super Admin · Pengaturan
 * platform · Pengumuman*.
 *
 * - **From 768px a pill track of links**, the one the reader is on navy (`aria-current="page"`) — the mockups' `.seg`, the
 *   shape `Segmented` draws, but each a route, so links in a `nav` rather than a `tablist`.
 * - **On a phone a dropdown** (spec §12: *"Platform sections in a dropdown"*; frame f52 mobile): the shared `PickerMenu`,
 *   full width, the section's name on it; choosing one goes there.
 */
export function PlatformTabs() {
  const t = useMessages(adminPlatformMessages);
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const phone = useMediaQuery('phone');
  const current = PLATFORM_SECTIONS.find((s) => pathname === platformHref(s) || pathname.startsWith(`${platformHref(s)}/`))
    ?? 'audit';

  if (phone) {
    return (
      <PickerMenu<PlatformSection>
        label={t.sections}
        value={current}
        options={PLATFORM_SECTIONS.map((s) => ({ value: s, label: t.tabs[s] }))}
        onChange={(section) => router.push(platformHref(section))}
        className="mb-3 w-full justify-between"
      />
    );
  }

  return (
    <nav aria-label={t.sections} className="mb-4 inline-flex max-w-full flex-wrap rounded-pill border border-hairline bg-card p-[3px]">
      {PLATFORM_SECTIONS.map((section) => {
        const on = section === current;
        return (
          <Link
            key={section}
            href={platformHref(section)}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'inline-flex items-center whitespace-nowrap rounded-pill px-3.5 transition-colors',
              HEADER_CONTROL,
              on ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
            )}
          >
            {t.tabs[section]}
          </Link>
        );
      })}
    </nav>
  );
}
