'use client';

import Link from 'next/link';
import { createContext, useContext } from 'react';
import { UnreadBadge, withUnread } from '@/components/unread-badge';
import { NavIcon } from '@/components/ui/nav-icon';
import { kept } from '@/i18n/kept';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { shellMessages } from '@/i18n/messages/shell';
import { cn } from '@/lib/cn';
import type { FieldNav } from '@/lib/field-nav';

/**
 * **The field shell's chrome as a page's title row reads it** (UI V1, UI-004; ADR-0180, ADR-0197): the context the shell
 * provides, the title row's avatar and Home's bell. Kept apart from the tab bar and the *Lainnya* sheet
 * (`field-nav.tsx`) and from the shell itself (`app-shell.tsx`) because **every page's header draws it**: a page that
 * imported one export of the shell's module loaded the whole shell — the sidebar, the bell's popover, the account menu,
 * the surveys' dot — as part of its own first load (the bundle, 2026-11-06; `performance-and-scale.md`). This module
 * imports nothing heavy; `app/first-load.spec.ts` holds it so.
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
}

export interface FieldChrome {
  readonly nav: FieldNav;
  readonly account: FieldAccount;
  /** The bell's count and the inbox, for the one title row that draws the bell — Home's. */
  readonly notifications?: { href: string; unread: number };
  /**
   * **The bell on this page's title row although the page did not ask** (P19.2-T1 AC-13): the Super Admin's Overview,
   * which is their Home, so the bell keeps its place below 1024px in the Super Admin's view as it has on Home.
   */
  readonly bellHere?: boolean;
  /**
   * **The office console's page content, for the readers who had it** (P19.2-T1; ADR-0197 §7: *page content is T2's and
   * T3's*): the Owner, an Admin and the Super Admin. Until P19.2-T1 they read the shared office pages — KPM Analytics,
   * the forum — in the console, and a page told the field's V1 phone layout (UI-109, UI-110) from the console's by
   * whether this chrome was there at all. Now every reader has it, so the shell says who keeps the console's content
   * (`useFieldContent`) until those pages are laid out for the one shell (P19.2-T3, Phase 19.3's UI-152).
   */
  readonly consoleContent?: boolean;
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

/**
 * **Whether a page draws its field content** — UI V1's phone layouts (UI-109, UI-110): in the shell, for a reader who did
 * not read the page in the office console (`consoleContent`). What `useFieldChrome() !== null` answered until P19.2-T1
 * put every role in the one shell; the same answer for every reader, so no page's content moves with the chrome.
 */
export function useFieldContent(): boolean {
  const chrome = useFieldChrome();
  return chrome !== null && chrome.consoleContent !== true;
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
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-contrast', className)}
    >
      {account.initials}
    </span>
  );
}

/**
 * **The title row's avatar** (UI-004): 36px, at the row's right end, opening *Profil saya*. Its target is 44 × 44px, the
 * circle centred in it, its edge on the page's 16px gutter (`-mr-1`).
 *
 * *Changed 2026-11-04 (P19.1-T1 AC-1, ADR-0196; UI-112: the title row at every size, the avatar on its right):* **at
 * every size** — it was below 1024px only. The sidebar's foot keeps the account menu; this is the way to *Profil saya*.
 *
 * *Changed 2026-11-20 (P19.17-T3 AC-2; ADR-0269 §2; the brief's gap 4, *one title row for everyone*):* **the same for
 * everybody** — page title, the page's control, this avatar. The Owner's and the Admin's *Akun saya* / *KPM Owner* beside
 * the circle and the view menu behind it (P19.2-T1, ADR-0198 §3) are gone with the views; no role text.
 */
export function TitleAvatar({ chrome }: { chrome: FieldChrome }) {
  const t = useMessages(shellMessages);
  return (
    <Link
      href={chrome.account.profileHref}
      aria-label={t.yourProfile}
      title={chrome.account.name}
      data-title-avatar=""
      className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
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
