import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FieldChromeContext, type FieldChrome } from '@/components/field-chrome';
import { TabBar } from '@/components/field-nav';
import { NotificationBell } from '@/components/notification-bell';
import { PageHeader } from '@/components/page-header';
import { SidebarUserMenu } from '@/components/sidebar-user-menu';
import { VerifyEmailBanner } from '@/components/verify-email-banner';
import { KpmLogo, PoweredBy, useBranding, useOfficeName } from '@/components/kpm-brand';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { useSystemName } from '@/i18n/system-name';
import { shellMessages } from '@/i18n/messages/shell';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/lib/use-media-query';

/**
 * The layout every signed-in screen sits in: a fixed navy sidebar and a scrolling main
 * region (Overall.html:2609-2700).
 *
 * **One shell for every role since P19.2-T1** (UI-146, UI-147, UI-127, UI-128; ADR-0197): the field shell's chrome — no
 * app bar, the title row, the floating bar and *Lainnya* below 1024px, the sidebar from 1024px — for the Agent, the AAB,
 * the AB, the Owner, the Admin, the Super Admin and somebody in no office alike. The role, and for an Owner or an Admin
 * the view, decide only which items appear (`shell.tsx`, `lib/field-nav.ts`). The consoles' dark bar, their ☰ drawer
 * (ADR-0167 §3), their tablet rail (ADR-0178 §1) and *ID | EN* on a page (ADR-0197 §5) are gone with them.
 *
 * **From 1024px, since P19.13** (UI-192 to UI-196; ADR-0252): the sidebar is **a floating navy panel** 12px off the
 * window's edges, or the 64px rail in the same style; and `main` is **the page frame**, at most 1320px, centred beside
 * it, 32px each side, so every page stands on the same two edges.
 *
 * **Since P19.17-T3** (AC-5, AC-6; [ADR-0269](../../../docs/04-adr/0269-one-login-one-menu-one-title-row.md) §5; the
 * brief's part E, `sidebar-icons-laptop`): the app icon, *Search agent*, the top section, then the groups — **every item
 * with its own Tabler outline icon, in one column**; the groups' names grey capitals with a chevron and, for the extras,
 * the orange *Owner* tag — in a part that scrolls with no scrollbar drawn; **Pengaturan pinned** under a thin line; the
 * account card. *📘 Panduan* is gone (ADR-0219 §5 superseded). The rail: the top four, **one icon per group, opening a
 * flyout**, Pengaturan at its foot.
 *
 * Nav items are grouped by section label, and a disabled item keeps an "Upcoming" pill
 * rather than disappearing — the prototype does this deliberately, so the roadmap stays
 * visible to the user rather than being a surprise.
 */
export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly active?: boolean;
  readonly upcoming?: boolean;
  /** A live count, rendered as the prototype's alert-red pill. Hidden at zero. */
  readonly badge?: number;
  /**
   * The prototype's amber check at the end of the row (`Overall.html:2643`, `:6624`): *Your 90-day
   * activation* at 100%. Drawn, and said: the check is a fact, so its words join the item's name.
   */
  readonly done?: boolean;
  /**
   * The glyph beside the label, and the **only** thing left once the rail is collapsed.
   *
   * Not optional in practice: `role-shell.spec.tsx` walks every item of all three shells and
   * fails on one without an icon, because the failure otherwise is a rail of blank squares
   * that nobody notices until they collapse it.
   */
  readonly icon: NavIconName;
  /**
   * **Not a page: a control that opens something over the page** — the field sidebar's *Search agent*, which opens the
   * agent search picker (UI-004, UI-012; D-14). Drawn as a button that opens a dialog; `href` is not followed.
   */
  readonly onSelect?: () => void;
  /** **The extras' tag after the words** (P19.17-T3 AC-5; part E): the pinned *Pengaturan*'s orange *Owner*. */
  readonly tag?: string;
}

export interface NavSection {
  /** Null renders the group with no heading — how the prototype presents Overview. */
  readonly label: string | null;
  readonly items: readonly NavItem[];
  /** Draw a rule after this section. The prototype uses two to band the agent nav. */
  readonly divider?: boolean;
  /** **The extras' tag beside the group's name** (P19.17-T3 AC-5; part E): the orange *Owner* on *KPM* and *PEOPLE*. */
  readonly tag?: string;
  /**
   * **The group's one icon on the rail** (P19.17-T3 AC-6; part E), which opens a flyout of its items. Absent, the rail
   * lists the group's items one by one (the Super Admin's, until Phase 19.23).
   */
  readonly railIcon?: NavIconName;
}

/**
 * Navigation is client-side. That is not only a speed choice: the access token lives in
 * memory, so a full page load drops it and forces a refresh round-trip before the first
 * request on every screen. `next/link` keeps the session in hand.
 *
 * An upcoming item keeps its `<a>` shell without an href — announced, focusable in the
 * reading order, and not navigable.
 */
/**
 * **The app's icon, the sidebar's logo** (P19.13-T2 AC-2; UI-196): Boost holding a phone — the PWA's own icon, so the
 * sidebar, the Home Screen and the browser's tab show one picture. It replaced the org-chart mark of the fifteen
 * prototype files (`Overall.html:2612-2617`).
 */
const APP_ICON = '/icons/icon-192.png';

/**
 * **The wordmark, *Agency**Boost***, and the line under it** (P19.13-T2 AC-2; UI-196: 16px / 800, *Boost* in the accent,
 * the branch's name under it at 12px and 70% white). The Super Admin's line is the amber *SUPERADMIN* naming the app,
 * as `admin-desktop` draws it. The product's name is kept English (§A.5); the shells' other words are `shellMessages`.
 */
function Wordmark({ brandTag, branch }: { brandTag?: string; branch?: string | null }) {
  const name = kept('AgencyBoost');
  // P19.21-T4 (ADR-0274): the KPM's *Nama sistem*, written whole; never on the Super Admin's console (`brandTag`).
  const own = useSystemName();
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      {own && !brandTag ? (
        <span className="truncate font-display text-lg font-extrabold tracking-tight text-secondary-contrast" title={own} data-system-name="">
          {own}
        </span>
      ) : (
        <span className="font-display text-lg font-extrabold tracking-tight text-secondary-contrast">
          {name.slice(0, 6)}
          <span className="text-primary-on-secondary">{name.slice(6)}</span>
        </span>
      )}
      {brandTag ? (
        <span className="block text-2xs font-semibold uppercase tracking-wide text-primary-on-secondary">{brandTag}</span>
      ) : branch ? (
        <span className="block truncate text-xs font-medium text-secondary-contrast/70" data-branch-name="">{branch}</span>
      ) : null}
    </span>
  );
}

/** How long a finger rests on a rail item before its name shows (P19.1-T1 AC-4), and how long the name then stays. */
const LONG_PRESS_MS = 450;
const TIP_HOLD_MS = 1500;

/**
 * **The field rail's names, drawn** (P19.1-T1 AC-4, ADR-0196; UI-114: *same items, icons only, name on hover/long-press*).
 * A `title` shows to a mouse after a delay and to nobody else — not to a keyboard, and not to a finger on the iPad in
 * landscape the 1024px rail is for. So the name is drawn beside the glyph: on hover, on focus, and after a long press,
 * which shows it and does not follow the link. Escape puts it away (WCAG 1.4.13), and so does leaving or looking away.
 *
 * **Fixed to the screen, beside the item**: the nav scrolls, so anything positioned inside it is clipped at its 64px edge.
 * A child of the item all the same, starting at its edge, so moving the pointer onto the words is still hovering the item
 * (1.4.13: *hoverable*). Decoration to a screen reader, which already has the item's name. Every role's rail since
 * P19.2-T1 (ADR-0197): the consoles' `title`-only rail went with them.
 */
function useRailTip(on: boolean, name: string) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressed = useRef(false);
  /** A finger is on the item: its long press is ours, so the system's menu is not; a mouse's right click still is. */
  const touching = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  useEffect(() => {
    if (!at) return;
    const away = (event: KeyboardEvent) => { if (event.key === 'Escape') setAt(null); };
    document.addEventListener('keydown', away);
    return () => document.removeEventListener('keydown', away);
  }, [at]);
  if (!on) return { handlers: {}, tip: null };

  const show = (el: HTMLElement) => {
    const box = el.getBoundingClientRect();
    setAt({ top: box.top + box.height / 2, left: box.right });
  };
  const hide = () => setAt(null);
  const handlers = {
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => show(event.currentTarget),
    onMouseLeave: hide,
    onFocus: (event: React.FocusEvent<HTMLElement>) => show(event.currentTarget),
    onBlur: hide,
    onTouchStart: (event: React.TouchEvent<HTMLElement>) => {
      clear();
      pressed.current = false;
      touching.current = true;
      const el = event.currentTarget;
      timer.current = setTimeout(() => {
        pressed.current = true;
        show(el);
      }, LONG_PRESS_MS);
    },
    onTouchMove: () => {
      clear();
      touching.current = false;
    },
    onTouchEnd: (event: React.TouchEvent<HTMLElement>) => {
      clear();
      touching.current = false;
      if (!pressed.current) return;
      // A long press asked for the name, not the page.
      event.preventDefault();
      pressed.current = false;
      timer.current = setTimeout(hide, TIP_HOLD_MS);
    },
    // Android's own long-press menu, and iOS's link preview (`[-webkit-touch-callout:none]` on the item), stay away.
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
      if (touching.current || pressed.current) event.preventDefault();
    },
  };
  const tip = at && (
    <span
      aria-hidden="true"
      data-rail-tip=""
      className="pointer-events-auto fixed z-50 -translate-y-1/2 pl-2"
      style={{ top: at.top, left: at.left }}
    >
      <span className="block whitespace-nowrap rounded-md bg-secondary px-2.5 py-1.5 text-md font-semibold text-secondary-contrast shadow-modal">
        {name}
      </span>
    </span>
  );
  return { handlers, tip };
}

function NavLink({
  item, pill, rail, tip = false,
}: { item: NavItem; pill: string; rail: boolean; tip?: boolean }) {
  /** What the amber check says to a screen reader, after the item's own name (WCAG 2.5.3: the words on screen first). */
  const { doneSuffix } = useMessages(shellMessages);
  // No hover state. There is no `.nav a:hover` rule in any of the fifteen prototype
  // files — resting, active and disabled are the only three. A hover that lightens an
  // inactive item makes it read as nearly-active, which is exactly the confusion the
  // current page's mark exists to avoid.
  /*
   * *Changed 2026-11-20 (P19.17-T3 AC-5; ADR-0269 §5; part E, `sidebar-icons-laptop`):* **every row has its own icon,
   * in one column** — a group's rows were indented words alone (UI-196) — **36px rows rounded 12px**, the words 14px
   * semibold, the icon 20px in the panel's light grey; **the current page a white pill with navy words and a navy
   * icon** (it was an orange glyph). 44px squares on the rail. The pill's words and icon are the secondary's ink, so a
   * KPM's colours carry it (ADR-0218 §6).
   */
  const className = cn(
    'flex items-center rounded-xl font-semibold',
    rail ? 'h-11 w-11 justify-center px-0' : 'h-9 gap-2.5 px-3 text-md',
    item.active ? 'bg-card font-bold text-secondary-ink' : 'text-secondary-contrast/[0.9]',
    item.upcoming && 'cursor-default text-secondary-contrast/30',
  );
  const body = (
    <>
      {/*
        * The glyph replaces the prototype's dot rather than joining it. Two marks in front of
        * one label is one too many, and the dot said only *active or not* — which the pill
        * behind the row already says, and which an icon can say by colour as well.
        */}
      <span className={cn('relative shrink-0', item.active ? 'text-secondary-ink' : 'text-secondary-muted')}>
        <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
        {/*
          * Collapsed, a count has nowhere to sit at the end of a row — so it rides the glyph,
          * as a dot rather than a number. The number is still in the accessible name.
          */}
        {rail && item.badge !== undefined && item.badge > 0 && (
          <span aria-hidden className="absolute -right-1 -top-0.5 h-2 w-2 rounded-pill bg-alert" />
        )}
      </span>
      {!rail && <span className="min-w-0 truncate">{item.label}</span>}
      {!rail && item.tag && <OwnerTag tag={item.tag} />}
      {!rail && item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-alert px-1.5 text-2xs font-bold text-white">
          {item.badge}
        </span>
      )}
      {!rail && item.done && (
        <>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            data-mark="done"
            className="ml-auto shrink-0 text-primary-on-secondary"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span className="sr-only">{doneSuffix}</span>
        </>
      )}
      {!rail && item.upcoming && (
        <span className="ml-auto rounded-pill bg-secondary-contrast/[0.06] px-1.5 py-0.5 text-2xs font-bold uppercase text-secondary-contrast/40">
          {pill}
        </span>
      )}
    </>
  );

  /*
   * **Collapsed, the label becomes the accessible name.** The glyph is `aria-hidden`, so
   * without this the rail is a column of links called nothing. `title` gives the same words
   * to a pointer, which is the other half of how somebody finds their way in 56px.
   *
   * *Fixed 2026-10-28 (P18.9-T6; parity F-253), found by axe once a tablet opened on the rail:* **a count is in the
   * name** — *Leaders past the limit, 2* — as it is in the row's words wider; it rode the glyph as a dot and was in
   * no name. And **an *Upcoming* item says its name in words**, `sr-only`, not in `aria-label`: it has no `href`, so
   * no role, and ARIA allows no name on an element with none (axe's `aria-prohibited-attr`).
   */
  const count = item.badge !== undefined && item.badge > 0 ? `, ${item.badge}` : '';
  const railName = item.upcoming ? `${item.label} — ${pill}` : `${item.label}${count}${item.done ? doneSuffix : ''}`;
  /*
   * **The field rail draws its names** (P19.1-T1 AC-4): the tip on hover, focus and a long press, and no `title`, which
   * would show the same words a second time after a delay. Since P19.2-T1 every role's rail is the field's.
   */
  const tipped = rail && tip;
  const railTip = useRailTip(tipped, railName);
  const tipClass = tipped ? cn(className, 'select-none [-webkit-touch-callout:none]') : className;
  const named = rail ? { 'aria-label': railName, ...(tipped ? {} : { title: railName }) } : {};

  if (item.upcoming) {
    return (
      <a aria-disabled className={tipClass} title={rail && !tipped ? railName : undefined} {...railTip.handlers}>
        {body}
        {rail && <span className="sr-only">{railName}</span>}
        {railTip.tip}
      </a>
    );
  }
  if (item.onSelect) {
    return (
      <button
        type="button"
        aria-haspopup="dialog"
        data-nav-control=""
        onClick={item.onSelect}
        className={cn(tipClass, 'w-full text-left')}
        {...named}
        {...railTip.handlers}
      >
        {body}
        {railTip.tip}
      </button>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      className={tipClass}
      {...named}
      {...railTip.handlers}
    >
      {body}
      {railTip.tip}
    </Link>
  );
}

/**
 * **The extras' tag** (P19.17-T3 AC-5; part E: *a small orange "Owner" tag*): after a group's name or the pinned item's,
 * the primary as a word on the panel, 12px bold — the mockup's 10px meets UI-008's *nothing below 12px*. Its words are
 * part of the control's name (*KPM Owner*), as they are on screen.
 */
function OwnerTag({ tag }: { tag: string }) {
  return (
    <span data-owner-tag="" className="shrink-0 text-2xs font-bold normal-case tracking-normal text-primary-on-secondary">
      {tag}
    </span>
  );
}

/**
 * ***Search agent*, a field under the logo** (P19.13-T2 AC-3; UI-196, D-14, D-33): 40px, 12px corners, an 8% white
 * ground, the search glyph and *Search agent* — a button that opens the existing agent picker (`AgentSearchDialog`), as
 * the top section's item did until now. On the rail its glyph alone, named as every rail item is (`useRailTip`).
 */
function SearchField({ label, onSelect, rail }: { label: string; onSelect: () => void; rail: boolean }) {
  const railTip = useRailTip(rail, label);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      data-search-agent=""
      onClick={onSelect}
      aria-label={rail ? label : undefined}
      className={cn(
        'mb-2 mt-4 flex h-10 shrink-0 items-center rounded-xl bg-secondary-contrast/[0.08] text-base text-secondary-muted hover:bg-secondary-contrast/[0.12]',
        rail ? 'w-11 select-none justify-center [-webkit-touch-callout:none]' : 'w-full gap-2 px-3',
      )}
      {...railTip.handlers}
    >
      <NavIcon name="search" className="h-4 w-4 shrink-0" />
      {!rail && label}
      {railTip.tip}
    </button>
  );
}

/** What the identity chip opens: the account and signing out — *Akun Anda · Keluar*, for everybody (P19.17-T3 AC-1). */
export interface AppShellAccount {
  href: string;
  onSignOut: () => void;
  signingOut?: boolean;
}

export interface ShellUser {
  readonly name: string;
  /**
   * The line under the name: the role, and since P18.5-T6 the **profile line** after it — *Core Leader*, the groups,
   * the office (`profileLine`, ADR-0159 §5). The platform shell passes the role alone.
   */
  readonly role: string;
  readonly initials: string;
  /** Shown in the account menu, so you can confirm who you are before signing out. */
  readonly email?: string;
  /**
   * **The person's full name, for the phone's menu** (P18.7-T12 AC-3): the first of its details, where `name` is
   * the preferred name the chip greets them by. `name` stands in where it is absent or blank.
   */
  readonly fullName?: string;
}

/**
 * The foot of the sidebar: who is signed in, and what is waiting for them.
 *
 * **The order changes with the width, and the DOM order changes with it.** Full width the chip
 * comes first — the avatar is round, it is the widest thing in the row, and reading stops
 * there; a square icon in front of it left the row starting on a shape that answers nothing.
 * Collapsed the column is one glyph wide and the avatar is the heaviest mark in it, so the bell
 * goes above rather than under it.
 *
 * Reordered by rendering, not by `flex-col-reverse`: the second would leave a keyboard reaching
 * the chip first while the eye reads the bell first, which is the kind of mismatch that only
 * shows up for the people who cannot see the discrepancy.
 *
 * *Changed 2026-11-05 (P19.2-T1; ADR-0197):* the sidebar is a desktop's alone, for every role, so the foot has no phone
 * bar to sit in (P18.7-T12's avatar there) and no drawer (P18.7-T2): below 1024px the title row's avatar and the
 * *Lainnya* sheet are the account.
 */
function SidebarFoot({
  rail,
  user,
  account,
  notifications,
}: {
  rail: boolean;
  user: ShellUser;
  account?: AppShellAccount;
  notifications?: { href: string; unread: number };
}) {
  /*
   * **The chip takes the space; the bell is pinned.** The chip sized itself to its contents,
   * so a short name pulled the bell left and a long one pushed it right — a control that
   * moves with somebody's name is one nobody learns the position of. `flex-1 min-w-0` also
   * gives the name the full width to truncate against rather than only its own.
   *
   * **The *ID | EN* switch is in its menu** (P19.1-T1 AC-1, ADR-0196; UI-112, UI-129, D-20: *no ID | EN on pages — it
   * lives in the account menu*), for every role since P19.2-T1. Below 1024px the *Lainnya* sheet's account row carries
   * it (ADR-0180 §3); *Profil saya*'s *Bahasa* at every size.
   */
  const chip = account ? (
    <SidebarUserMenu
      user={user}
      accountHref={account.href}
      onSignOut={account.onSignOut}
      signingOut={account.signingOut}
      className={rail ? undefined : 'min-w-0 flex-1'}
      compact={rail}
      languageSwitch
    />
  ) : (
    <div
      className={cn(
        'flex items-center py-1.5',
        rail ? 'justify-center' : 'min-w-0 flex-1 gap-2 px-1',
      )}
      title={rail ? `${user.name} — ${user.role}` : undefined}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-contrast">
        {user.initials}
      </span>
      {!rail && (
        <span className="min-w-0">
          <span className="block truncate text-md font-semibold text-secondary-contrast">{user.name}</span>
          {/* One line, truncated; the whole of it on hover (the profile line, ADR-0159 §5). */}
          <span className="block truncate text-xs text-secondary-contrast/55" title={user.role}>{user.role}</span>
        </span>
      )}
    </div>
  );

  const bell = notifications ? <NotificationBell {...notifications} /> : null;

  /*
   * *Changed 2026-11-12 (P19.13-T2 AC-6; UI-196, ADR-0252):* **an account card** — the avatar, the name, the role · the
   * KPM's code (the profile line), the bell — on a 6% white ground with 14px corners, where it was a row under a rule. On
   * the rail the avatar and the bell alone, with no ground (the mockup's `.rail .side .acc`). The sidebar is a desktop's
   * alone, so nothing here is drawn below 1024px.
   */
  return (
    <div
      data-account-card=""
      className={cn(
        'mt-2 flex shrink-0 items-center',
        rail ? 'flex-col gap-1.5' : 'min-w-0 gap-1 rounded-[14px] bg-secondary-contrast/[0.06] px-1.5 py-1',
      )}
    >
      {rail ? <>{bell}{chip}</> : <>{chip}{bell}</>}
    </div>
  );
}

/** Where the reader's choice of rail-or-full lives, from 1024px. One key, one character: `1` is the rail. */
const RAIL_KEY = 'ab.sidebar.rail';

/**
 * **The field shell's narrow desktop, kept apart from its wide one** (P19.1-T1 AC-4, ADR-0196; UI-114: *below 1280 the
 * sidebar becomes a 64px icon rail, so content keeps its width at 1024–1279*). From 1024 to 1279px the field shell opens
 * on the rail, and opening it full is remembered here on its own — `0` once opened full, `1` once collapsed again;
 * anything else, nothing, or storage refused is the rail. From 1280px the full sidebar and `RAIL_KEY` are as they were.
 *
 * **The Owner's and the Admin's pages too, and not `/admin`** (P19.2-T1; ADR-0197 §4): the Super Admin keeps the
 * labelled sidebar from 1024px (UI-127, UI-128: *from 1024 the labelled sidebar as today*), so their choice is
 * `RAIL_KEY`'s from 1024px. ADR-0178 §1's tablet key, `ab.sidebar.rail.tablet`, went with the consoles' tablet rail.
 */
const LAPTOP_RAIL_KEY = 'ab.sidebar.rail.laptop';

/** Before the browser paints, with the width (`useMediaQuery`'s `beforePaint`), so a tablet's first frame is the rail. */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The groups the reader folded by hand, remembered for the tab's session (P19.17-T3 AC-5): a JSON list of names. Every
 * group starts open (`sidebar-icons-laptop`); P19.13-T2's `ab.sidebar.open`, the groups opened by hand, is not read.
 */
const CLOSED_GROUPS_KEY = 'ab.sidebar.closed';

/** The chevron a group's name carries (part E): Tabler's, turned to point right while the group is folded. */
function Chevron({ open }: { open: boolean }) {
  return (
    <NavIcon
      name="ti-chevron-down"
      className={cn('h-3.5 w-3.5 shrink-0 transition-transform motion-reduce:transition-none', open ? 'rotate-0' : '-rotate-90')}
    />
  );
}

/**
 * The nav's groups, each a name that folds and unfolds it and the items beneath — rendered by the sidebar at full width;
 * on the rail (`RailGroups`) each group is one icon and a flyout.
 *
 * *Changed 2026-11-20 (P19.17-T3 AC-5; ADR-0269 §5; part E, `sidebar-icons-laptop`):* **a group's name is a small grey
 * capital label with a chevron, no icon** — 12px bold, spaced, in the panel's muted grey — with the extras' orange
 * *Owner* tag after it; the rows under it carry their own icons, in the top section's column. **Every group starts
 * open**, as the approved sidebar draws them — the part above *Pengaturan* scrolls instead (ADR-0252 §4's *only the
 * current page's group is open* superseded) — and the chevron folds one.
 */
function NavGroups({
  sections,
  isOpen,
  onToggle,
  pill,
}: {
  sections: readonly NavSection[];
  /** Whether a headed group is open: every group, but one the reader folded this session (P19.17-T3 AC-5). */
  isOpen: (label: string) => boolean;
  onToggle: (label: string) => void;
  pill: string;
}) {
  return (
    <>
      {sections.map((section, sectionIndex) => {
        const id = section.label ?? section.items[0]?.href ?? 'root';
        /*
         * **An unheaded group is always shown.** It is how the prototype presents Overview
         * — one or two destinations with nothing to call them — so there is no header to
         * collapse and nothing gained by hiding them.
         */
        const open = !section.label || isOpen(section.label);

        return (
          <div key={id} data-sidebar-group={section.label ?? ''}>
            {/*
              * **A button, not a heading.** It was an `h2` for one run of the tests, which
              * put five sidebar entries into the document's heading outline and ahead of
              * every page's own — `admin/page.spec.tsx` caught it by asserting that the
              * first `h2` on the console is *Needs your attention*. The `nav` landmark is
              * the structure here; `aria-expanded` and `aria-controls` are the semantics.
              */}
            {section.label && (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`nav-group-${sectionIndex}`}
                onClick={() => onToggle(section.label ?? '')}
                data-group-label=""
                className="mt-2 flex h-8 w-full items-center gap-1.5 rounded-xl px-3 text-xs font-bold uppercase tracking-[0.05em] text-secondary-muted hover:bg-secondary-contrast/[0.06]"
              >
                <span className="min-w-0 truncate">{section.label}</span>
                {section.tag && <OwnerTag tag={section.tag} />}
                <span className="ml-auto flex">
                  <Chevron open={open} />
                </span>
              </button>
            )}
            {open && (
              <ul id={`nav-group-${sectionIndex}`} className="flex flex-col gap-px">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} pill={pill} rail={false} />
                  </li>
                ))}
              </ul>
            )}
            {/* A `separator`, so the rule under the top section is a thing a test and a screen reader can both find,
                rather than a styled `div` only the eye can (parity I-144). */}
            {section.divider && <div role="separator" className="mx-1.5 my-2 h-px bg-secondary-contrast/[0.08]" />}
          </div>
        );
      })}
    </>
  );
}

/**
 * **The rail's groups** (P19.17-T3 AC-6; ADR-0269 §5; part E: *the 4 top items, then one icon per group (user-circle,
 * activity, users-group, trophy, building-skyscraper, address-book; tap = flyout)*): the unheaded section's items one by
 * one, a line, then **one icon per group**, white while the current page is in it, which opens the group's flyout. A
 * group with no rail icon — the Super Admin's — lists its items one by one, as every rail did until now (ADR-0196 §4).
 */
function RailGroups({ sections, pill }: { sections: readonly NavSection[]; pill: string }) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const pathname = usePathname();
  useEffect(() => setOpenGroup(null), [pathname]);
  return (
    <>
      {sections.map((section) => {
        const id = section.label ?? section.items[0]?.href ?? 'root';
        if (section.label && section.railIcon) {
          return (
            <RailGroup
              key={id}
              section={section}
              icon={section.railIcon}
              pill={pill}
              open={openGroup === section.label}
              onOpen={(open) => setOpenGroup(open ? section.label : null)}
            />
          );
        }
        return (
          <div key={id} data-sidebar-group={section.label ?? ''}>
            <ul className="mb-1.5 flex flex-col items-center gap-px">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} pill={pill} rail tip />
                </li>
              ))}
            </ul>
            {section.divider && <div role="separator" className="mx-1.5 my-2 h-px bg-secondary-contrast/[0.08]" />}
          </div>
        );
      })}
    </>
  );
}

/** What Tab can land on inside a flyout. */
const FLYOUT_FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * **One group on the rail: its icon, and its flyout** (P19.17-T3 AC-6). A disclosure — a button with `aria-expanded`
 * over the group's own links, reached with Tab — as the account menu is, so it promises no arrow keys it does not have.
 *
 * - **The button**: the group's icon in a 44px square, named by the group (*Saya*, *KPM Owner*); white with a navy icon
 *   while the current page is one of its items (`sidebar-icons-laptop`'s `.rail .on`).
 * - **The flyout**: fixed beside the rail, at the button's height and moved up to stay inside the window (`DESIGN-RULES`:
 *   *menus always open fully inside the screen*); the group's name as the sidebar writes it, its tag, and its items as
 *   the sidebar's rows. Escape closes it and gives the focus back; so does a click outside it, choosing an item, and the
 *   route moving.
 */
function RailGroup({
  section, icon, pill, open, onOpen,
}: {
  section: NavSection;
  icon: NavIconName;
  pill: string;
  open: boolean;
  onOpen: (open: boolean) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const current = section.items.some((item) => item.active);
  const panelId = `rail-flyout-${(section.label ?? '').replace(/\W+/g, '-').toLowerCase()}`;

  useBeforePaint(() => {
    if (!open || !button.current) {
      setAt(null);
      return;
    }
    const box = button.current.getBoundingClientRect();
    const height = panel.current?.offsetHeight ?? 0;
    const room = window.innerHeight - 12;
    setAt({ top: Math.max(12, Math.min(box.top, room - height)), left: box.right + 12 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      onOpen(false);
      button.current?.focus();
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) onOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown, true);
    };
  }, [open, onOpen]);

  useEffect(() => {
    if (open && at) panel.current?.querySelector<HTMLElement>(FLYOUT_FOCUSABLE)?.focus();
  }, [open, at]);

  const name = section.tag ? `${section.label} ${section.tag}` : (section.label ?? '');
  return (
    <div data-sidebar-group={section.label ?? ''} data-rail-group="" className="flex justify-center">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={name}
        onClick={() => onOpen(!open)}
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-xl',
          current || open ? 'bg-card text-secondary-ink' : 'text-secondary-muted hover:bg-secondary-contrast/[0.06]',
        )}
      >
        <NavIcon name={icon} className="h-[21px] w-[21px] shrink-0" />
      </button>
      {open && (
        <div
          ref={panel}
          id={panelId}
          data-rail-flyout=""
          onClick={(event) => {
            if ((event.target as Element).closest('a[href]')) onOpen(false);
          }}
          className="fixed z-50 max-h-[calc(100vh-1.5rem)] w-60 overflow-y-auto rounded-xl bg-secondary p-2 text-sidebar-text shadow-modal"
          style={at ? { top: at.top, left: at.left } : { top: 0, left: 0, visibility: 'hidden' }}
        >
          <p className="flex h-8 items-center gap-1.5 px-3 text-xs font-bold uppercase tracking-[0.05em] text-secondary-muted">
            <span className="min-w-0 truncate">{section.label}</span>
            {section.tag && <OwnerTag tag={section.tag} />}
          </p>
          <ul className="flex flex-col gap-px">
            {section.items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} pill={pill} rail={false} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AppShell({
  sections,
  user,
  account,
  brandTag,
  upcomingLabel,
  notifications,
  title,
  subtitle,
  actions,
  field,
  officeTitle = false,
  labelledFrom1024 = false,
  search,
  pinned,
  aboveTitle,
  children,
}: {
  sections: readonly NavSection[];
  /**
   * ***Pengaturan*, pinned** (P19.17-T3 AC-5, AC-6; part E: *always visible at the bottom of the sidebar above the account
   * row, with a thin divider; only the menu above it scrolls*): the item and its *Owner* tag, for the Owner, the Admins
   * and the core leaders; omitted for everybody else.
   */
  pinned?: { item: NavItem; tag?: string };
  user: ShellUser;
  /**
   * The amber line under the wordmark naming which app this is: `SUPERADMIN`, which `admin-desktop` still draws in every
   * frame. The Owner's and the field's sidebars have none (`kpm-owner-desktop`, `Overall.html:2619`).
   */
  brandTag?: string;
  /** The pill on a nav item with nothing behind it: the shell's own *Upcoming* when absent; *Segera hadir* in ID mode. */
  upcomingLabel?: string;
  /**
   * Wires the identity chip to the actions behind it. Omitted, the chip is a plain
   * label — a shell rendered outside a session has no account to reach and nothing to
   * sign out of, and offering a dead control would be worse than offering none.
   */
  account?: AppShellAccount;
  /**
   * The bell, beside the identity chip at the foot of the sidebar; below 1024px, Home's title row (`TitleBell`).
   *
   * **Not a nav item.** It was one in all three shells, sitting in a list of places to work
   * with a count beside it — so an office's notifications read as a section of the product
   * rather than as the thing you glance at on the way past. It is a glance, and it belongs
   * where the account is: one icon, and a number only when there is one. Since P12.1-T2 it
   * opens the latest few beside it, and `href` is where its *See all notifications* goes.
   *
   * Omitted outside a session, where there is nothing to count.
   */
  notifications?: { href: string; unread: number };
  /**
   * **The shell's chrome** (UI V1, UI-004; ADR-0180; ADR-0197 for every role): **below 1024px** there is no sidebar, rail
   * or dark bar — each page's title row carries the avatar (`PageHeader`), the floating tab bar sits at the foot of the
   * screen and opens the *Lainnya* sheet; **from 1024px** the sidebar, regrouped by the caller, its headings in sentence
   * case. The whole frame is a V1 surface (`data-surface`, `globals.css`): the page token `#EDEDEA` on every page.
   */
  field: FieldChrome;
  /**
   * **The title's 22px on a tablet** (P19.2-T1 AC-1; UI-146, UI-138 and the token table; ADR-0197 §2): on the `/admin`,
   * `/kpm` and `/people` pages, where every other page keeps the field pages' 20px (UI-112, ADR-0196 §1). The frame says
   * so (`data-title-size`), and `globals.css` sets `--text-title` from it, so `text-title` stays the one class.
   */
  officeTitle?: boolean;
  /**
   * **The labelled sidebar from 1024px** (P19.2-T1 AC-10; UI-127 *Desktop sidebar unchanged*, UI-128 *From 1024 the
   * labelled sidebar as today*; ADR-0197 §4): the Super Admin's. Everybody else's opens on Phase 19.1's 64px rail from
   * 1024 to 1279px (ADR-0196 §4).
   */
  labelledFrom1024?: boolean;
  /**
   * ***Search agent*, the 40px field under the logo** (P19.13-T2 AC-3; UI-196, D-14): its words and what opens the
   * agent picker. Omitted for a reader without the picker, who has no field.
   */
  search?: { label: string; onSelect: () => void };
  /**
   * The page's own heading, when the shell is rendered by a page.
   *
   * Optional because a **group layout** renders this shell without knowing any page's
   * title — that is the whole reason a layout can own the sidebar. A page inside such a
   * layout renders `PageHeader` itself and passes nothing here.
   */
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /**
   * **What stands above the page's title row, in its flow** (P19.29-T2 AC-1; UI-201 (21 Nov), ADR-0287 §2): the Super
   * Admin's strip on the owner pages inside a KPM, on a phone — first in `main`, before the shell's header or a page's own,
   * so it scrolls with the page and covers nothing. Absent, `main` is as it was.
   */
  aboveTitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useMessages(shellMessages);
  const pill = upcomingLabel ?? t.upcoming;
  // P19.6-T1 (ADR-0218 §2, §11): the session's KPM's logo and *Powered by*; `null` draws the shell as before.
  const branding = useBranding();
  const officeName = useOfficeName();
  /**
   * **Every group open, but one the reader folded** (P19.17-T3 AC-5; part E, `sidebar-icons-laptop`; ADR-0269 §5 — it
   * supersedes ADR-0252 §4's *only the group holding the current page is open*). The part above *Pengaturan* scrolls, so
   * nothing is out of reach with every group open.
   *
   * - **A group the reader folded** stays folded for the tab's session (`sessionStorage`, `CLOSED_GROUPS_KEY`), across
   *   pages and a reload; unfolding it forgets it. The server and the first client render both draw every group open,
   *   so they agree. **Read after the paint, and only when something is kept**: a state change in a layout effect
   *   re-renders the page under the shell inside the commit, and a page reading its route's params through `use()`
   *   suspends there and never comes back.
   * - **The route moving into a folded group unfolds it**, so the current page is never hidden under its group's name.
   */
  const activeGroup = sections.find((s) => s.items.some((i) => i.active))?.label ?? null;
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(CLOSED_GROUPS_KEY) ?? '[]') as unknown;
      const names = Array.isArray(stored) ? stored.filter((x): x is string => typeof x === 'string') : [];
      if (names.length > 0) setClosed(new Set(names));
    } catch {
      // Storage refused or unreadable: every group open, as on a first visit.
    }
  }, []);
  const keepClosed = (next: ReadonlySet<string>) => {
    setClosed(next);
    try {
      window.sessionStorage.setItem(CLOSED_GROUPS_KEY, JSON.stringify([...next]));
    } catch {
      // Not remembered past this page; the name still folds the group.
    }
  };
  useEffect(() => {
    if (activeGroup === null) return;
    setClosed((was) => {
      if (!was.has(activeGroup)) return was;
      const next = new Set(was);
      next.delete(activeGroup);
      try {
        window.sessionStorage.setItem(CLOSED_GROUPS_KEY, JSON.stringify([...next]));
      } catch {
        // As above.
      }
      return next;
    });
  }, [activeGroup]);
  const isOpen = (label: string) => !closed.has(label);
  const toggleGroup = (label: string) => {
    const next = new Set(closed);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    keepClosed(next);
  };

  /**
   * **The rail, remembered — one choice per size** (P18.9-T6 AC-1; P19.1-T1 AC-4). From 1280px the full sidebar is the
   * default and `ab.sidebar.rail` remembers the rail; **from 1024 to 1279px the rail is the default** (UI-114) and
   * `ab.sidebar.rail.laptop` remembers opening it full — except for the Super Admin's labelled sidebar
   * (`labelledFrom1024`), whose choice is `ab.sidebar.rail`'s from 1024px. The width crossing 1280px swaps which one the
   * sidebar shows, and each keeps its own. Below 1024px there is no sidebar to remember.
   *
   * Read in an effect rather than in the initial state: the server renders this too, and `localStorage` there is a
   * hydration mismatch rather than a preference. **Before the first paint**, with the width (`useMediaQuery`), so a
   * remembered choice is drawn from the start, never one frame of the other first. A browser that refuses storage gets
   * each size's default.
   */
  const [deskRail, setDeskRail] = useState(false);
  const [laptopRail, setLaptopRail] = useState(true);
  useBeforePaint(() => {
    try {
      setDeskRail(window.localStorage.getItem(RAIL_KEY) === '1');
      setLaptopRail(window.localStorage.getItem(LAPTOP_RAIL_KEY) !== '0');
    } catch {
      // A private window, or storage switched off. Not a reason to fail the shell.
    }
  }, []);
  const laptop = useMediaQuery('laptop', { beforePaint: true }) && !labelledFrom1024;
  const rail = laptop ? laptopRail : deskRail;
  /**
   * Below 1024px: the title row's avatar and the tab bar are drawn (UI-004). **Read after the paint,
   * as `usePhone` is, not before it**: a state change in a layout effect re-rendered the page under the shell inside
   * the commit, and a page reading its route's params through `use()` (Training's) suspended there and never came
   * back. The sidebar is `max-lg:hidden` meanwhile, so the first frame on a phone is the page without its bar.
   */
  const compact = useMediaQuery(['phone', 'tablet']);
  const toggleRail = () => {
    const next = !rail;
    if (laptop) setLaptopRail(next);
    else setDeskRail(next);
    try {
      window.localStorage.setItem(laptop ? LAPTOP_RAIL_KEY : RAIL_KEY, next ? '1' : '0');
    } catch {
      // The preference is lost on reload; the sidebar still works.
    }
  };

  const groups = rail
    ? <RailGroups sections={sections} pill={pill} />
    : <NavGroups sections={sections} isOpen={isOpen} onToggle={toggleGroup} pill={pill} />;

  return (
    <div
      className="flex min-h-screen flex-col lg:flex-row"
      data-surface="v1"
      data-title-size={officeTitle ? 'office' : undefined}
    >
      {/* Below 1024px no sidebar at all, for any role: the title rows and the tab bar stand in (UI-004, UI-146). */}
      {!compact && (
        <aside
          data-sidebar={rail ? 'rail' : 'panel'}
          className={cn(
            // `print:hidden`: a printed page is the page, not the app around it (`Overall.html:1022`, ADR-0061).
            'sticky z-10 flex shrink-0 flex-col self-start bg-secondary pb-3 pt-4 text-sidebar-text print:hidden',
            // A desktop's alone: below 1024px the pages' title rows and the tab bar stand in (UI-004).
            'max-lg:hidden',
            /*
             * **A floating panel** (P19.13-T2 AC-1, AC-8; UI-196, ADR-0252): 12px off the window's top, bottom and left,
             * 20px corners, the page's ground around it — it was a flat navy column from the top of the window to the
             * bottom. **Never under the clock** (staging review, 2026-10-31): on a Home Screen app the panel starts below
             * the top inset when that is more than its 12px.
             */
            'ml-[var(--sidebar-inset)] mt-[max(var(--sidebar-inset),env(safe-area-inset-top))] top-[max(var(--sidebar-inset),env(safe-area-inset-top))]',
            'h-[calc(100vh_-_var(--sidebar-inset)_-_max(var(--sidebar-inset),env(safe-area-inset-top)))] rounded-sidebar',
            /*
             * **An arbitrary value, not a theme key**, for the rail. `w-sidebar-rail` would need a new entry in
             * `tailwind.config.ts`, and Tailwind's JIT does not pick a config change up without a
             * dev-server restart — so the class silently did not exist, the `w-full` underneath it
             * won, and collapsing the sidebar covered the page. A width that can vanish is a bad
             * width for the one class that decides whether anything else is visible.
             */
            rail ? 'w-[var(--sidebar-rail-width)] items-center px-2' : 'w-sidebar px-3',
          )}
        >
          <div className={cn('flex shrink-0 items-center', rail ? 'flex-col gap-2' : 'min-w-0 gap-2.5 px-1.5 pt-0.5')}>
            {/*
              * **The KPM's logo in place of AgencyBoost's mark and wordmark** (P19.6-T1 AC-3, AC-4; ADR-0218 §2): the wide
              * logo in the sidebar, the square one (or the wide one centred) in the rail. Without one, the app's icon.
              *
              * *Changed 2026-11-12 (P19.13-T2 AC-2; UI-196):* **the app icon** — Boost holding a phone, the PWA's own
              * `/icons/icon-192.png` — 36px with 10px corners, where the org-chart mark was; beside it *Agency**Boost*** and
              * the branch's name. On the rail the icon alone.
              */}
            {branding?.logo ? (
              <KpmLogo branding={branding} rail={rail} name={officeName} />
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- the PWA's own static icon, drawn at its 36px */}
                <img
                  src={APP_ICON}
                  alt=""
                  width={36}
                  height={36}
                  data-app-icon=""
                  className="h-9 w-9 shrink-0 rounded-[10px] shadow-sm"
                />
                {!rail && <Wordmark brandTag={brandTag} branch={officeName} />}
              </>
            )}

            {/*
              * **Beside the mark, not above the nav.** It was its own row under the brand, which
              * read as the first thing in the menu rather than as a control on the frame. Here it
              * is part of the chrome, where a window control belongs. Collapsed it drops beneath
              * the mark, because the rail holds one of them at a time.
              */}
            <button
              type="button"
              onClick={toggleRail}
              aria-expanded={!rail}
              aria-controls="sidebar-nav"
              aria-label={rail ? t.expandSidebar : t.collapseSidebar}
              title={rail ? t.expandSidebar : t.collapseSidebar}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-secondary-contrast/[0.55] hover:bg-secondary-contrast/[0.06] hover:text-secondary-contrast',
                !rail && 'ml-auto',
              )}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[18px] w-[18px] shrink-0"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 4v16" />
                <path d={rail ? 'm13 9 3 3-3 3' : 'm17 9-3 3 3 3'} />
              </svg>
            </button>
          </div>

          {/* P19.13-T2 AC-3 (UI-196): *Search agent* under the logo, for a reader with the picker; nothing for another. */}
          {search && <SearchField label={search.label} onSelect={search.onSelect} rail={rail} />}

          {/*
            * **Only the menu above *Pengaturan* scrolls** (P19.17-T3 AC-5; part E: *Pengaturan is pinned (freeze pane) …
            * only the menu above it scrolls*; `DESIGN-RULES.md`: *no visible inner scrollbar*). One `nav` landmark: the
            * part that scrolls — every group open, no scrollbar drawn, still a scroll container a wheel, a finger and Tab
            * move — then *Pengaturan* under a thin line, then the account card, both always in sight.
            */}
          <nav
            id="sidebar-nav"
            className={cn('flex min-h-0 flex-1 flex-col', search ? undefined : 'mt-4', rail && 'w-full')}
            aria-label={t.mainNav}
          >
            <div
              data-sidebar-scroll=""
              className={cn(
                'min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                rail && 'flex flex-col items-center',
              )}
            >
              {groups}
            </div>
            {pinned && (
              <div
                data-sidebar-pinned=""
                className={cn(
                  'shrink-0 border-t-[1.5px] border-secondary-contrast/30 pt-3',
                  rail ? 'mt-2 flex w-full justify-center' : '-mx-3 mt-2 px-3',
                )}
              >
                <NavLink item={{ ...pinned.item, tag: pinned.tag }} pill={pill} rail={rail} tip={rail} />
              </div>
            )}
          </nav>

          <SidebarFoot
            rail={rail}
            user={user}
            account={account}
            notifications={notifications}
          />
          {/* P19.6-T1 AC-14 (ADR-0218 §11): only under a KPM's own logo; the rail has no room for the line. */}
          {!rail && <PoweredBy branding={branding} className="mt-2 px-1 text-secondary-contrast/55" />}
        </aside>
      )}

      {/*
        * **The status bar's band, in the page's ground** (the product owner's staging review, 2026-10-31: the top of every
        * screen looked blurred on an iPhone). `viewport-fit=cover` (UI-103) draws the page from the very top of the screen,
        * under the clock, where iOS frosts whatever passes beneath it. Below 1024px there is no bar up there, so this
        * strip, as tall as the top inset and the page's own colour, stands over the page as it scrolls: nothing is read
        * under the clock. Under the tab bar, every sheet and dialog; 0px tall wherever there is no inset — Safari with its
        * own bars, Android, a desktop. Decoration: nothing to read, nothing to reach.
        *
        * *Widened 2026-11-04 (P19-T5 AC-4; UI-158, the cloud findings' R3):* **beside the sidebar too**, from 1024px, where
        * a tablet's Home Screen app scrolled the page under its clock. There it stands under the sidebar (`z-[5]`, the
        * sidebar's `z-10`), so the sidebar's navy still runs up under the clock and only the page's column is covered.
        */}
      <div
        aria-hidden="true"
        data-safe-top=""
        className="pointer-events-none fixed inset-x-0 top-0 h-[env(safe-area-inset-top)] bg-base print:hidden z-30 lg:z-[5]"
      />

      <main
        className={cn(
          'min-w-0 flex-1 print:p-0',
          /*
           * Below 1024px (UI-004): the page's 16px gutter (24px on a tablet), its title row near the top with no bar above
           * it, and room under the last line for the tab bar. From 1024px, beside the sidebar.
           *
           * **Never under the clock** (staging review, 2026-10-31): the page starts below the top inset.
           *
           * *Changed 2026-11-04 (P19-T5 AC-4; UI-158, R3):* **the header starts 16px below the inset** on a phone and a
           * tablet — `calc(1rem + env(safe-area-inset-top))`, the owner's rule. Beside the sidebar, 32px or the inset and
           * 16px, whichever is more: a desktop keeps its 32px.
           *
           * *Changed 2026-11-12 (P19.13-T1 AC-1; UI-192, D-40, ADR-0252 §1):* **from 1024px `main` is the page frame** —
           * at most 1320px (`max-w-frame`), centred in the room beside the sidebar (`mx-auto`), 32px each side
           * (`px-frame`), where it was the whole room with a 40px gutter. Every page's title row, cards, table and form
           * stand on its edges; no page keeps an outer width of its own. `/leads`' list and detail are measured against
           * it (`SPLIT`, `leads-list.tsx`).
           */
          'px-4 pb-[calc(var(--tab-bar-space)+1.5rem)] pt-[calc(1rem+env(safe-area-inset-top))] md:px-6 '
            + 'lg:mx-auto lg:max-w-frame lg:px-frame lg:pb-14 lg:pt-[max(2rem,calc(1rem+env(safe-area-inset-top)))]',
        )}
      >
        <FieldChromeContext.Provider value={{ ...field, compact }}>
          {aboveTitle}
          {/* P19-T1 AC-4 (UI-163, ADR-0190 §4; P19.12-T2 AC-4): *Email Anda belum diverifikasi · Kirim ulang tautan* until verified. */}
          <VerifyEmailBanner />
          {title !== undefined && (
            <PageHeader title={title} subtitle={subtitle} actions={actions} />
          )}
          {children}
        </FieldChromeContext.Provider>
      </main>
      {compact && <TabBar chrome={{ ...field, compact }} />}
    </div>
  );
}
