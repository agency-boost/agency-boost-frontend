'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { UnreadBadge, withUnread } from '@/components/notification-bell';
import { NavIcon } from '@/components/ui/nav-icon';
import { kept } from '@/i18n/kept';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { shellMessages } from '@/i18n/messages/shell';
import { cn } from '@/lib/cn';
import type { FieldDestination, FieldNav } from '@/lib/field-nav';

/**
 * **The field shell below 1024px** (UI V1, UI-004; D-13, D-20; ADR-0180): no dark app bar — each page's own title row,
 * with the avatar at its end — the floating tab bar at the foot of the screen, and the *Lainnya* sheet it opens.
 *
 * Built once here and drawn by `AppShell` when the field shell passes it `field`; a page sets only its title row's
 * control and which of its sub-lines to hide, through `PageHeader` (`Page`).
 */

/** Who is signed in, as the title row's avatar and the sheet's account row show them. */
export interface FieldAccount {
  readonly name: string;
  /** The line under the name: the rung · Core Leader · the groups · the office (`profileLine`). */
  readonly role: string;
  readonly initials: string;
  /** Their photo (`users.avatarUrl`), when they have one; the initials otherwise. */
  readonly avatarUrl?: string | null;
  /** *Profil saya*, where the avatar and *Ubah foto* go. */
  readonly profileHref: string;
  readonly onSignOut: () => void;
  readonly signingOut?: boolean;
  /** *Open Owner view* / *Open Admin view* (ADR-0114), for an Owner or an Admin in their field view. */
  readonly viewSwitch?: { href: string; label: string };
}

export interface FieldChrome {
  readonly nav: FieldNav;
  readonly account: FieldAccount;
  /** The bell's count and the inbox, for the one title row that draws the bell — Home's. */
  readonly notifications?: { href: string; unread: number };
  /**
   * **Below 1024px**: the title row's avatar and the tab bar are drawn. `AppShell` reads the width (`useMediaQuery`)
   * and sets it; a caller passes nothing.
   */
  readonly compact?: boolean;
}

/** The field shell's chrome, for a page's title row (`PageHeader`); `null` in the other two shells. */
export const FieldChromeContext = createContext<FieldChrome | null>(null);

export function useFieldChrome(): FieldChrome | null {
  return useContext(FieldChromeContext);
}

/** The reader's photo, or their initials on amber: the title row's 36px and the sheet's 40px. */
export function FieldAvatar({ account, className }: { account: Pick<FieldAccount, 'initials' | 'avatarUrl'>; className?: string }) {
  if (account.avatarUrl) {
    return (
      // A photo the person chose: its own address, so no optimisation pipeline stands between them and it.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={account.avatarUrl} alt="" aria-hidden="true" className={cn('shrink-0 rounded-full object-cover', className)} />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-amber font-bold text-navy', className)}
    >
      {account.initials}
    </span>
  );
}

/**
 * **The title row's avatar** (UI-004): 36px, at the row's right end, opening *Profil saya*. Its target is 44 × 44px, the
 * circle centred in it, its edge on the page's 16px gutter (`-mr-1`).
 */
export function TitleAvatar({ chrome }: { chrome: FieldChrome }) {
  const t = useMessages(shellMessages);
  return (
    <Link
      href={chrome.account.profileHref}
      aria-label={t.yourProfile}
      title={chrome.account.name}
      className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full lg:hidden"
    >
      <FieldAvatar account={chrome.account} className="h-9 w-9 text-base" />
    </Link>
  );
}

/**
 * **The bell, on Home's title row alone** (UI-004, the owner, 30 Oct: *the notification bell (with the count, e.g. "9+")
 * only on Home, left of the avatar*). A link to the inbox, 44px, the count on its corner and in its name.
 */
export function TitleBell({ chrome }: { chrome: FieldChrome }) {
  const language = useLanguage();
  const notifications = chrome.notifications;
  if (!notifications) return null;
  return (
    <Link
      href={notifications.href}
      aria-label={withUnread(kept('Notifications'), notifications.unread, language)}
      data-title-bell=""
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-navy lg:hidden"
    >
      <NavIcon name="bell" className="h-[22px] w-[22px]" />
      <UnreadBadge unread={notifications.unread} />
    </Link>
  );
}

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
        current ? 'bg-navy font-bold text-white' : 'font-medium text-muted',
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
  return (
    <>
      <nav
        aria-label={t.mainNav}
        data-tab-bar=""
        className={cn(
          'fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 h-16 rounded-[32px] bg-card',
          'shadow-bar print:hidden lg:hidden',
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
            className="flex h-full w-full min-w-0 items-center justify-center"
          >
            <TabFace icon="grid" label={t.more} current={open || chrome.nav.inSheet} />
          </button>
        </div>
      </nav>
      {open && <MoreSheet chrome={chrome} onClose={() => setOpen(false)} returnTo={opener} />}
    </>
  );
}
