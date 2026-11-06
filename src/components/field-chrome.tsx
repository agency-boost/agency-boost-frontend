'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { UnreadBadge, withUnread } from '@/components/unread-badge';
import { NavIcon } from '@/components/ui/nav-icon';
import { kept } from '@/i18n/kept';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { shellMessages } from '@/i18n/messages/shell';
import { cn } from '@/lib/cn';
import type { FieldNav } from '@/lib/field-nav';
import type { ViewKind } from '@/lib/views';

/**
 * **The field shell's chrome as a page's title row reads it** (UI V1, UI-004; ADR-0180, ADR-0197): the context the shell
 * provides, the title row's avatar, its view menu and Home's bell. Kept apart from the tab bar and the *Lainnya* sheet
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
  /**
   * **The view switcher** (P19.2-T1 AC-5; UI-169 items 2, 3; ADR-0198 §3), for a person with more than one view — an
   * Owner or an Admin, or anybody with a linked login (AC-8, ADR-0199 §3) — or with *Tambah akun* to offer. Absent for
   * everybody else, who sees no switcher and nothing added to the header. It replaced ADR-0114's *Open Owner view* /
   * *Open Admin view* link.
   */
  readonly views?: ViewSwitcher;
  /**
   * ***📘 Panduan*** (P19.6-T5 AC-1, AC-2; ADR-0219 §5): the reader's own guide, by view and role (`panduanHref`) — the
   * *Lainnya* sheet's line above *Keluar*, opened in a new tab. Absent outside a session.
   */
  readonly guideHref?: string;
}

/** One entry of the view switcher (ADR-0198 §3), in its order: *Akun saya* · the office entry · *Superadmin*. */
export interface ViewEntry {
  /** Unique in the list: the kind, and for a linked login's view its login as well (ADR-0199 §3; P19.2-T1 AC-8). */
  readonly key: string;
  readonly kind: ViewKind;
  /** The menu's words: *Akun saya*, *KPM Owner · <nama KPM>*, *KPM Admin · <nama KPM>*, *Superadmin*. */
  readonly label: string;
  /** The header's, beside the avatar: *Akun saya*, *KPM Owner*, *KPM Admin*, *Superadmin*. */
  readonly short: string;
  /** The view this page is in: ticked, and said (`aria-current`). */
  readonly active: boolean;
  /** One tap switches: the shell remembers it, clears the cached reads and goes to the view's landing. */
  readonly onSelect: () => void;
}

/**
 * **A row after the views** — the extension point for ***Tambah akun*** (ADR-0199 §1, §5; P19.2-T1 AC-8, UI-169 item 5),
 * which the shell adds to `ViewSwitcher.actions` for whoever is offered it and has no link yet. Drawn under the views in
 * both menus — the title row's avatar and the sidebar's foot — as a 44px row of its own.
 */
export interface ViewMenuAction {
  readonly key: string;
  readonly label: string;
  readonly onSelect: () => void;
}

export interface ViewSwitcher {
  /** The person's views, every login's (ADR-0199 §3), in the switcher's order. */
  readonly entries: readonly ViewEntry[];
  /** After the views (`ViewMenuAction`): *Tambah akun*, for whoever is offered it and has no link (P19.2-T1 AC-8). */
  readonly actions?: readonly ViewMenuAction[];
}

/** Whether a switcher is drawn at all: more than one view, or something to do after them (*Tambah akun*). */
export function hasViewMenu(views: ViewSwitcher | undefined): views is ViewSwitcher {
  return Boolean(views && (views.entries.length > 1 || (views.actions?.length ?? 0) > 0));
}

/** The view the header names: only for a person with more than one (ADR-0198 §3), so one view adds nothing. */
export function namedView(views: ViewSwitcher | undefined): ViewEntry | null {
  if (!views || views.entries.length < 2) return null;
  return views.entries.find((entry) => entry.active) ?? null;
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
 * every size** — it was below 1024px only, the sidebar's foot standing in for it on a desktop. The foot keeps the
 * account menu; this is the way to *Profil saya*, as on a phone.
 *
 * *Changed 2026-11-05 (P19.2-T1 AC-5; UI-169 item 2; ADR-0198 §3):* **for a person with more than one view it is the
 * account menu** — the active view's short name beside the circle, at every size, and in the control's name; it opens
 * the switcher (`ViewMenu`). For a person with one view nothing changes: the same link, drawn as before.
 */
export function TitleAvatar({ chrome }: { chrome: FieldChrome }) {
  const t = useMessages(shellMessages);
  if (hasViewMenu(chrome.account.views)) return <AvatarViewMenu chrome={chrome} views={chrome.account.views} />;
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

/** What Tab can land on inside the avatar's menu. */
const MENU_FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * **The avatar's menu, for a person with more than one view** (P19.2-T1 AC-5; ADR-0198 §3). A disclosure, as the
 * sidebar's account menu is — a button with `aria-expanded` over ordinary buttons and a link, reached with Tab, so it
 * promises no arrow keys it does not have. It hangs under the avatar at the row's right edge.
 *
 * - **The trigger**: the active view's short name, 12px navy, then the 36px circle; 44px tall; named *Akun Anda: KPM
 *   Owner*, so what is announced says where the reader is (UI-169: *named in the header so it's always clear*).
 * - **The panel**: the views (`ViewMenu`) — one tap switches, the active one ticked — then *Profil saya*, where the avatar
 *   always went, then whatever comes after the views (*Tambah akun*, AC-8). Escape closes it and gives the focus back;
 *   so does a click outside it, or choosing anything in it.
 */
function AvatarViewMenu({ chrome, views }: { chrome: FieldChrome; views: ViewSwitcher }) {
  const t = useMessages(shellMessages);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const named = namedView(views);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    }
    function onPointerDown(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown, true);
    panel.current?.querySelector<HTMLElement>(MENU_FOCUSABLE)?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown, true);
    };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div ref={box} className="relative -mr-1 shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={VIEW_MENU_ID}
        aria-label={named ? t.viewMenu({ view: named.short }) : t.account}
        title={chrome.account.name}
        data-title-avatar=""
        onClick={() => setOpen((was) => !was)}
        className="flex h-11 min-w-11 items-center justify-end gap-1.5 rounded-full pl-1"
      >
        {named && (
          <span data-active-view="" className="max-w-24 truncate text-xs font-semibold text-navy">{named.short}</span>
        )}
        <FieldAvatar account={chrome.account} className="h-9 w-9 text-base" />
      </button>
      {open && (
        <div
          ref={panel}
          id={VIEW_MENU_ID}
          data-view-menu=""
          className="absolute right-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-card bg-card p-1.5 shadow-modal"
        >
          <ViewMenu views={views} tone="card" onChosen={close} />
          <Link
            href={chrome.account.profileHref}
            onClick={close}
            className="mt-1 flex min-h-11 items-center border-t border-divider px-2.5 pt-1 text-md font-semibold text-navy"
          >
            {t.yourProfile}
          </Link>
        </div>
      )}
    </div>
  );
}

/** The avatar's menu, as its trigger names it in `aria-controls`. */
const VIEW_MENU_ID = 'title-view-menu';

/**
 * **The views, and what comes after them** (P19.2-T1 AC-5; ADR-0198 §3): one list, drawn by the title row's avatar menu
 * (`tone="card"`, white) and the sidebar's account menu (`tone="navy"`), so the two cannot differ. Each entry a 44px
 * button; the active one ticked ✓ and `aria-current`; one tap switches. Then `actions` — *Tambah akun* (AC-8) — each a
 * 44px row of its own.
 */
export function ViewMenu({ views, tone, onChosen }: { views: ViewSwitcher; tone: 'card' | 'navy'; onChosen?: () => void }) {
  const t = useMessages(shellMessages);
  const row = tone === 'card'
    ? 'flex min-h-11 w-full items-center gap-2 rounded-row px-2.5 text-left text-md text-ink hover:bg-hover-row'
    : 'flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-md text-secondary-contrast/[0.78] hover:bg-secondary-contrast/[0.06] hover:text-secondary-contrast';
  const tick = tone === 'card' ? 'text-navy' : 'text-primary-on-secondary';
  return (
    <div data-views="">
      {views.entries.length > 1 && (
        <ul aria-label={t.views} className="flex flex-col">
          {views.entries.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                aria-current={entry.active ? 'true' : undefined}
                data-view={entry.kind}
                onClick={() => {
                  onChosen?.();
                  entry.onSelect();
                }}
                className={cn(row, entry.active && 'font-semibold')}
              >
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                {entry.active && (
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" className={cn('shrink-0', tick)}>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {views.actions?.map((action) => (
        <button
          key={action.key}
          type="button"
          data-view-action={action.key}
          onClick={() => {
            onChosen?.();
            action.onSelect();
          }}
          className={row}
        >
          {action.label}
        </button>
      ))}
    </div>
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
