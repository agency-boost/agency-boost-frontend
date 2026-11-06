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
import { hasSurveyDot, useSurveyPending } from '@/lib/surveys';
import type { FieldDestination, FieldNav } from '@/lib/field-nav';
import type { ViewKind } from '@/lib/views';

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
