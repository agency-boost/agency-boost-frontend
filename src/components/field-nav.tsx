'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { FieldChrome } from '@/components/field-chrome';
import { NavIcon } from '@/components/ui/nav-icon';
import { useMessages } from '@/i18n/language-provider';
import { shellMessages } from '@/i18n/messages/shell';
import { cn } from '@/lib/cn';
import { hasSurveyDot, useSurveyPending } from '@/lib/survey-pending';
import type { FieldDestination } from '@/lib/field-nav';

/**
 * **The field shell below 1024px** (UI V1, UI-004; D-13, D-20; ADR-0180): no dark app bar — each page's own title row,
 * with the avatar at its end — the floating tab bar at the foot of the screen, and the *Lainnya* sheet it opens.
 *
 * Built once here and drawn by `AppShell` when the field shell passes it `field`; a page sets only its title row's
 * control and which of its sub-lines to hide, through `PageHeader` (`Page`). **The chrome's context, the title row's
 * avatar, its view menu and Home's bell are `field-chrome.tsx`'s** (the bundle, 2026-11-06): every page's header draws
 * them, and none of it needs the tab bar.
 */

/** The sheet's own module, loaded the first time it is opened (common.md: a rarely opened sheet costs nothing until then). */
const MoreSheet = dynamic(() => import('@/components/field-more-sheet').then((m) => m.MoreSheet), { ssr: false });

/** The sheet, as the *Lainnya* tab names it in `aria-controls`. */
export const MORE_SHEET_ID = 'field-more-sheet';

/** One of the bar's four destinations: its icon over its label, a navy pill behind both when current (D-13). */
function TabLink({ tab }: { tab: FieldDestination }) {
  return (
    <Link
      href={tab.href}
      aria-current={tab.active ? 'page' : undefined}
      data-tab={tab.id}
      className="flex h-full min-w-0 items-center justify-center"
    >
      <TabFace icon={tab.icon} label={tab.short} current={tab.active} />
    </Link>
  );
}

/**
 * **A tab's face** (D-13): the line icon over its label, **never icon-only**; the current one on a navy pill. The label
 * is 12px — the report's *11px* meets UI-008's *nothing below 12px* (ADR-0180) — on one line that never wraps: at 360px
 * each tab is 67px wide, and the longest label, *Calendar*, is about 50px.
 */
function TabFace({ icon, label, current }: { icon: FieldDestination['icon']; label: string; current: boolean }) {
  return (
    <span
      data-tab-face=""
      className={cn(
        'flex flex-col items-center gap-px rounded-pill px-2 py-1 text-xs leading-tight whitespace-nowrap',
        current ? 'bg-secondary font-bold text-secondary-contrast' : 'font-medium text-muted',
      )}
    >
      <NavIcon name={icon} className="h-[21px] w-[21px] shrink-0" />
      {label}
    </span>
  );
}

/**
 * **The floating tab bar** (UI-004; D-13): a white pill 64px tall, 12px from the sides and from the bottom, above the
 * home indicator (`env(safe-area-inset-bottom)`), below 1024px only. Five labelled tabs in the owner's order —
 * *Activity · Calendar · Home · Unit · Lainnya* — Home in the centre and a tab like the others; an Agent's fourth is
 * *Summary* (O-10). *Lainnya* opens the sheet; it is current while the reader is on a page the sheet holds.
 *
 * A `nav` landmark named as the sidebar's is (*Main*): wider, the sidebar is the one drawn, never both. It marks itself
 * `data-tab-bar`, which is what gives the page and the toast their room (`--tab-bar-space`, `globals.css`).
 */
export function TabBar({ chrome }: { chrome: FieldChrome }) {
  const t = useMessages(shellMessages);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // The route moving closes it: a tile followed, *Back*, or any other way the page changes underneath it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const [activity, calendar, home, fourth] = chrome.nav.tabs;
  const surveyDot = hasSurveyDot(useSurveyPending(chrome.nav.groups.some((g) => g.items.some((i) => i.id === 'surveys'))));
  return (
    <>
      <nav
        aria-label={t.mainNav}
        data-tab-bar=""
        className={cn(
          'fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 h-16 rounded-[32px] bg-card',
          'shadow-bar print:hidden lg:hidden',
          // P19.1-T1 AC-2 (UI-113): on a tablet at most 470px wide, centred — not stretched to ~750px. A phone's is as before.
          'md:mx-auto md:max-w-[470px]',
        )}
      >
        {/*
          * Five cells in a row, not a list: a page's own lists stay the only ones a phone's screen reader counts, and the
          * landmark already says what these are.
          */}
        <div className="grid h-full grid-cols-5">
          <TabLink tab={activity} />
          <TabLink tab={calendar} />
          <TabLink tab={home} />
          <TabLink tab={fourth} />
          <button
            ref={opener}
            type="button"
            data-tab="more"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={MORE_SHEET_ID}
            aria-current={chrome.nav.inSheet ? 'page' : undefined}
            onClick={() => setOpen(true)}
            aria-label={surveyDot ? `${t.more}${t.surveyWaiting}` : undefined}
            className={cn('flex h-full w-full min-w-0 items-center justify-center', surveyDot && 'relative')}
          >
            <TabFace icon="grid" label={t.more} current={open || chrome.nav.inSheet} />
            {/* P19.5-T4 (C-R2): the red dot while a survey the reader was invited to waits, open and not sent. */}
            {surveyDot && (
              <span
                aria-hidden="true"
                data-survey-dot=""
                className="absolute right-[calc(50%-16px)] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-alert"
              />
            )}
          </button>
        </div>
      </nav>
      {open && <MoreSheet chrome={chrome} onClose={() => setOpen(false)} returnTo={opener} />}
    </>
  );
}
