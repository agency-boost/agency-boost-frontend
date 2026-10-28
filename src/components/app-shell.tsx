import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { NotificationBell } from '@/components/notification-bell';
import { SidebarUserMenu } from '@/components/sidebar-user-menu';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { cn } from '@/lib/cn';
import { useMediaQuery } from '@/lib/use-media-query';
import { usePhone } from '@/lib/use-phone';
import { useScrollLock } from '@/lib/use-scroll-lock';

/**
 * The layout every signed-in screen sits in: a fixed navy sidebar and a scrolling main
 * region (Overall.html:2609-2700).
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
}

export interface NavSection {
  /** Null renders the group with no heading — how the prototype presents Overview. */
  readonly label: string | null;
  readonly items: readonly NavItem[];
  /** Draw a rule after this section. The prototype uses two to band the agent nav. */
  readonly divider?: boolean;
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
 * The product mark: three nodes of an org chart, the lower-right one amber.
 *
 * Identical in all fifteen prototype files (`Overall.html:2612-2617`), and the one piece
 * of the shell we never drew — the sidebar carried a bare wordmark.
 */
function BrandMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="13" cy="5.5" r="4" className="fill-sidebar-text" />
      <circle cx="6" cy="19" r="4" className="fill-sidebar-text" />
      <circle cx="20" cy="19" r="4" className="fill-amber" />
      <line x1="13" y1="9" x2="6.5" y2="15.5" strokeWidth="1.4" className="stroke-sidebar-text" />
      <line x1="13" y1="9" x2="19.5" y2="15.5" strokeWidth="1.4" className="stroke-sidebar-text" />
    </svg>
  );
}

/** The wordmark, and the amber line under it naming which app this is — the sidebar's and the phone's drawer's. */
function Wordmark({ brandTag, className }: { brandTag?: string; className?: string }) {
  return (
    <span className={cn('font-display text-lg font-extrabold leading-tight tracking-tight text-white', className)}>
      AgencyBoost
      {brandTag && (
        <span className="block text-2xs font-semibold uppercase tracking-wide text-amber">
          {brandTag}
        </span>
      )}
    </span>
  );
}

/** What the amber check says to a screen reader, after the item's own name (WCAG 2.5.3: the words on screen first). */
const DONE_SUFFIX = ' — complete';

function NavLink({ item, pill, rail }: { item: NavItem; pill: string; rail: boolean }) {
  // No hover state. There is no `.nav a:hover` rule in any of the fifteen prototype
  // files — resting, active and disabled are the only three. A hover that lightens an
  // inactive item makes it read as nearly-active, which is exactly the confusion the
  // amber tint plus amber dot exist to avoid.
  const className = cn(
    'flex items-center rounded-md py-1.5 text-md font-medium',
    rail ? 'justify-center px-0' : 'gap-2.5 px-2',
    item.active ? 'bg-amber/15 font-semibold text-white' : 'text-white/[0.78]',
    item.upcoming && 'cursor-default text-white/30',
  );
  const body = (
    <>
      {/*
        * The glyph replaces the prototype's dot rather than joining it. Two marks in front of
        * one label is one too many, and the dot said only *active or not* — which the amber
        * tint behind the row already says, and which an icon can say by colour as well.
        */}
      <span className={cn('relative shrink-0', item.active ? 'text-amber' : undefined)}>
        <NavIcon name={item.icon} />
        {/*
          * Collapsed, a count has nowhere to sit at the end of a row — so it rides the glyph,
          * as a dot rather than a number. The number is still in the accessible name.
          */}
        {rail && item.badge !== undefined && item.badge > 0 && (
          <span aria-hidden className="absolute -right-1 -top-0.5 h-2 w-2 rounded-pill bg-alert" />
        )}
      </span>
      {!rail && item.label}
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
            className="ml-auto shrink-0 text-amber"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span className="sr-only">{DONE_SUFFIX}</span>
        </>
      )}
      {!rail && item.upcoming && (
        <span className="ml-auto rounded-pill bg-white/[0.06] px-1.5 py-0.5 text-2xs font-bold uppercase text-white/40">
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
   * *Fixed 2026-10-28 (P18.97-T6; parity F-253), found by axe once a tablet opened on the rail:* **a count is in the
   * name** — *Leaders past the limit, 2* — as it is in the row's words wider; it rode the glyph as a dot and was in
   * no name. And **an *Upcoming* item says its name in words**, `sr-only`, not in `aria-label`: it has no `href`, so
   * no role, and ARIA allows no name on an element with none (axe's `aria-prohibited-attr`).
   */
  const count = item.badge !== undefined && item.badge > 0 ? `, ${item.badge}` : '';
  const railName = item.upcoming ? `${item.label} — ${pill}` : `${item.label}${count}${item.done ? DONE_SUFFIX : ''}`;
  const named = rail ? { 'aria-label': railName, title: railName } : {};

  if (item.upcoming) {
    return (
      <a aria-disabled className={className} title={rail ? railName : undefined}>
        {body}
        {rail && <span className="sr-only">{railName}</span>}
      </a>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      className={className}
      {...named}
    >
      {body}
    </Link>
  );
}

/** What the identity chip opens: the account, signing out, and for an Owner or an Admin the view switch. */
export interface AppShellAccount {
  href: string;
  onSignOut: () => void;
  signingOut?: boolean;
  /** The link to the reader's other view (ADR-0114), above *Your account*; absent for one view. */
  viewSwitch?: { href: string; label: string };
}

export interface ShellUser {
  readonly name: string;
  /**
   * The line under the name: the role, and since P18.8-T6 the **profile line** after it — *Core Leader*, the groups,
   * the office (`profileLine`, ADR-0159 §5). The platform shell passes the role alone.
   */
  readonly role: string;
  readonly initials: string;
  /** Shown in the account menu, so you can confirm who you are before signing out. */
  readonly email?: string;
  /**
   * **The person's full name, for the phone's menu** (P18.95-T12 AC-3): the first of its details, where `name` is
   * the preferred name the chip greets them by. `name` stands in where it is absent or blank.
   */
  readonly fullName?: string;
}

/**
 * A page's heading block: the `<h1>`, its sub-line, and the actions beside it.
 *
 * Split out of `AppShell` on 2026-09-06 so a **group layout** can own the sidebar. A
 * layout is rendered once for every route beneath it and cannot know their titles, so
 * either the header moves out or the chrome stays duplicated in 23 pages — and duplicated
 * chrome is what let `/notifications` wear the wrong one.
 *
 * There is exactly one `<h1>` per screen either way: the shell renders this itself when a
 * page passes a `title`, and does not when a page renders it.
 *
 * **The row is top-aligned, so the title never moves** (P10.1-T8, client item 1). It was
 * `items-end`, which is what three of `Overall.html`'s four `.topbar` rules say (`:76`, `:387`,
 * `:624`) — but the fourth, `:839`, is `align-items:flex-start`, and the last declaration is the
 * one that renders. Bottom-aligned, the tallest child sets the line: on `/activity/log` the Date
 * field with its save status under it is taller than the title block, so the `<h1>` sat about
 * 25px lower than on Dashboard and Ratio, which pass no actions — and it jumped when the loading
 * state, which has no Date, was replaced. `KPM_Owner.html:72` and `Superadmin.html:72` say
 * `flex-end`, but their topbars only ever hold the title (`:930-935`, `:222-227`), so nothing in
 * those files shows the alignment; `Overall.html` is the one whose topbar carries actions.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  subtitleOnPhone,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * `false`: **the sub-line is not drawn below 768px** — the client's *Remove* verdict on a page's sub-line (P18.95-T7
   * AC-1, row 25 of the review's *Grey text* table; ADR-0167 §7). At 768px and wider it reads as before. Absent, the
   * page that renders the shell said so through `SubtitleOnPhone` — a shell draws this header, not the page.
   */
  subtitleOnPhone?: boolean;
}) {
  const fromPage = useContext(SubtitleOnPhone);
  const onPhone = subtitleOnPhone ?? fromPage;
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy">{title}</h1>
        {subtitle && <p className={cn('mt-1 text-md text-muted', !onPhone && REMOVED_ON_PHONE)}>{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/**
 * **Whether a page's sub-line shows on a phone, said by a page whose shell draws its header** (`RoleShell`, which
 * takes a title and a sub-line and hands them through a shell to `PageHeader`): `/notifications` wraps its shell in
 * `false`, so the client's *Remove* reaches the header without every shell carrying one more prop (P18.95-T7 AC-1).
 * A `Page` passes `subtitleOnPhone` to its header itself.
 */
export const SubtitleOnPhone = createContext(true);

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
 * **On a phone's bar, the avatar alone** (P18.95-T12, the product owner's request of 2026-10-27): at the bar's
 * right edge, with the bell's badge, and the bell itself goes into its menu as *Notifications* — one control
 * where the chip, a cut name and the bell stood. The sidebar's foot, from 768px, and the drawer's are as before.
 */
function SidebarFoot({
  rail,
  user,
  account,
  notifications,
  phone = false,
  drawer = false,
}: {
  rail: boolean;
  user: ShellUser;
  account?: AppShellAccount;
  notifications?: { href: string; unread: number };
  /** In the phone's bar: the chip's panel drops below it (ADR-0085). */
  phone?: boolean;
  /**
   * **At the foot of the phone's drawer** (P18.95-T2 AC-2): the sidebar's foot as the sidebar draws it, the
   * chip opening upward. **The notices are not repeated there**: they are the bar's avatar's (P18.95-T12),
   * which a phone always shows.
   */
  drawer?: boolean;
}) {
  /*
   * **The chip takes the space; the bell is pinned.** The chip sized itself to its contents,
   * so a short name pulled the bell left and a long one pushed it right — a control that
   * moves with somebody's name is one nobody learns the position of. `flex-1 min-w-0` also
   * gives the name the full width to truncate against rather than only its own.
   */
  /*
   * On a phone's bar the avatar is its own size at the bar's right edge, its circle on the bar's padding line
   * (`-mr-1.5` takes back the 44px box's margin round the 32px circle), and holds the notices (P18.95-T12).
   */
  const bar = phone && !drawer;
  const chip = account ? (
    <SidebarUserMenu
      user={user}
      accountHref={account.href}
      onSignOut={account.onSignOut}
      signingOut={account.signingOut}
      viewSwitch={account.viewSwitch}
      className={bar ? '-mr-1.5 shrink-0' : rail ? undefined : 'min-w-0 flex-1'}
      compact={rail}
      phone={phone}
      panelId={drawer ? DRAWER_ACCOUNT_ID : undefined}
      notifications={bar ? notifications : undefined}
    />
  ) : (
    <div
      className={cn(
        'flex items-center py-1.5',
        rail ? 'justify-center' : 'min-w-0 flex-1 gap-2 px-1',
      )}
      title={rail ? `${user.name} — ${user.role}` : undefined}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber text-base font-bold text-navy">
        {user.initials}
      </span>
      {!rail && (
        <span className="min-w-0">
          <span className="block truncate text-md font-semibold text-white">{user.name}</span>
          {/* One line, truncated; the whole of it on hover (the profile line, ADR-0159 §5). */}
          <span className="block truncate text-xs text-white/55" title={user.role}>{user.role}</span>
        </span>
      )}
    </div>
  );
  // The sidebar's own rule above it, unprefixed: the drawer is a phone's alone.
  if (drawer) return <div className="mt-3 flex min-w-0 items-center border-t border-white/10 pt-3">{chip}</div>;

  // On a phone's bar the avatar's menu holds the notices; with no account there is no menu, and the bell stays.
  const bell = notifications && !(bar && account) ? <NotificationBell {...notifications} /> : null;

  /*
   * **On a phone's bar it gives way; in the sidebar it holds.** Below 768px it sits beside the brand,
   * and `shrink-0` kept it at its contents' full width: the Super Admin's chip, *Platform Operator* over
   * *Superadmin*, beside *AgencyBoost SUPERADMIN*, ran 23px past a 360px screen and clipped the bell
   * (P11-T6 AC-11). `min-w-0 shrink` lets it take what the brand leaves, so the chip's name truncates,
   * as it already does in the sidebar, and the bell stays whole. From 768px it is the sidebar's foot,
   * which must not shrink under a long nav. Since P18.95-T12 the bar holds the 44px avatar alone, which
   * fits beside any brand, and `ml-auto` keeps it at the bar's right edge.
   */
  return (
    <div
      className={cn(
        'ml-auto flex min-w-0 shrink items-center gap-1 md:ml-0 md:shrink-0 md:border-t md:border-white/10 md:pt-3',
        rail && 'md:flex-col md:gap-1.5',
      )}
    >
      {rail ? <>{bell}{chip}</> : <>{chip}{bell}</>}
    </div>
  );
}

/** Where the reader's choice of rail-or-full lives, from 1024px. One key, one character: `1` is the rail. */
const RAIL_KEY = 'ab.sidebar.rail';

/**
 * **A tablet's choice, kept apart from the desktop's** (P18.97-T6 AC-1, ADR-0178 §1; the client's UI-033). From 768
 * to 1023px the rail is the default, and opening the sidebar full is remembered here on its own, so a reader who keeps
 * it full on a desktop is not given it on a tablet, nor the reverse. The same one character: `0` once opened full, `1`
 * once collapsed again; anything else, nothing, or storage refused is the rail.
 */
const TABLET_RAIL_KEY = 'ab.sidebar.rail.tablet';

/** Before the browser paints, with the width (`useMediaQuery`'s `beforePaint`), so a tablet's first frame is the rail. */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The nav's groups, each a heading that opens and closes it and the items beneath — rendered by the
 * sidebar, and on a phone by the drawer the bar's ☰ opens (P18.95-T2), so the two cannot differ in order,
 * names or state.
 */
function NavGroups({
  sections,
  rail,
  closed,
  onToggle,
  pill,
}: {
  sections: readonly NavSection[];
  rail: boolean;
  closed: ReadonlySet<string>;
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
        const collapsible = Boolean(section.label) && !rail;
        const open = !collapsible || !closed.has(section.label ?? '');

        return (
          <div key={id}>
            {/*
              * **A button, not a heading.** It was an `h2` for one run of the tests, which
              * put five sidebar entries into the document's heading outline and ahead of
              * every page's own — `admin/page.spec.tsx` caught it by asserting that the
              * first `h2` on the console is *Needs your attention*. The `nav` landmark is
              * the structure here; `aria-expanded` and `aria-controls` are the semantics.
              */}
            {section.label && !rail && (
              <div className="mx-1 mt-2">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`nav-group-${sectionIndex}`}
                  onClick={() => onToggle(section.label ?? '')}
                  /*
                   * **Readable, not decorative.** It was `text-2xs` at 40% white — 10px of
                   * uppercase at that contrast is a smudge, and this is the control that
                   * decides what the whole menu shows. `xs` at 65%, semibold.
                   */
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/65 hover:bg-white/[0.06] hover:text-white"
                >
                  {section.label}
                  {/*
                    * A drawn chevron, not the `▸` character. At 10px that glyph rendered as
                    * a dot in most stacks — the one mark that says whether a group is open,
                    * and it said nothing.
                    */}
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn(
                      'ml-auto h-3.5 w-3.5 shrink-0 transition-transform',
                      open ? 'rotate-90' : 'rotate-0',
                    )}
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </div>
            )}
            {/*
              * Collapsed to the rail, the groups flatten. There are no headings to click,
              * so hiding items behind one would make them unreachable.
              */}
            {open && (
              <ul
                id={`nav-group-${sectionIndex}`}
                className={cn('flex flex-col gap-px', rail ? 'mb-1.5' : 'mb-2.5 mt-1')}
              >
                {section.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} pill={pill} rail={rail} />
                  </li>
                ))}
              </ul>
            )}
            {/* A `separator`, so the rule between groups is a thing a test and a screen reader can
                both find, rather than a styled `div` only the eye can (parity I-144). */}
            {section.divider && <div role="separator" className="mx-1 my-2 h-px bg-white/10" />}
          </div>
        );
      })}
    </>
  );
}

/** The phone's drawer, as the bar's ☰ names it in `aria-controls`. */
const DRAWER_ID = 'phone-menu';
/** The account panel of the chip at the drawer's foot: the bar's chip keeps `sidebar-user-actions`. */
const DRAWER_ACCOUNT_ID = 'phone-menu-account';

/** What Tab can land on inside the drawer. An upcoming nav item is an `<a>` with no href, and is not. */
const DRAWER_FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Three lines and a cross: the ☰ that opens the drawer and the ✕ that closes it, drawn as the rail toggle is. */
function MenuGlyph({ close = false }: { close?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      className="h-5 w-5 shrink-0"
    >
      <path d={close ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} />
    </svg>
  );
}

/**
 * **The phone's menu** (P18.95-T2, ADR-0167 §3, OD-198; the client's UI review, UI-009): the sidebar, as a
 * drawer from the left, below 768px. The same brand, the same `NavGroups` — so the groups, their order, their
 * labels, their badges, their open or closed state and the current page are the sidebar's by construction —
 * and the sidebar's foot.
 *
 * **A modal dialog**, named *Menu*. Focus moves to its ✕ as it opens and Tab and Shift+Tab go round inside
 * it; **Escape**, the scrim and ✕ close it, and the focus goes back to ☰. Following any link closes it — the
 * route moving closes it as well, for *Back* — and the page behind does not scroll while it is open. An
 * account panel opened at its foot shuts first on Escape, as it does in the sidebar, and the drawer stays.
 *
 * Rendered beside the bar, not in it: the bar is `sticky` with a `z-index`, and a drawer inside it could
 * never stand above a page's own raised layers.
 */
function PhoneMenu({
  onClose,
  returnTo,
  brandTag,
  children,
  foot,
}: {
  onClose: () => void;
  returnTo: RefObject<HTMLButtonElement | null>;
  brandTag?: string;
  /** The nav. */
  children: React.ReactNode;
  foot: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const closer = useRef<HTMLButtonElement>(null);

  // The page behind holds still: the one lock every dialog takes, counted, so a dialog over the drawer nests.
  useScrollLock(true);

  useEffect(() => {
    closer.current?.focus();
    const back = returnTo.current;
    return () => {
      back?.focus();
    };
  }, [returnTo]);

  function keys(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      // The foot's account panel hears Escape itself and shuts alone; the drawer waits for the next one.
      if (box.current?.querySelector('[data-account-panel]')) return;
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !box.current) return;
    // Never empty: ✕ is always here.
    const items = Array.from(box.current.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Following any link closes the drawer, so it is not left open over the next screen. */
  function closeOnLink(event: React.MouseEvent) {
    if ((event.target as Element).closest('a[href]')) onClose();
  }

  return (
    <>
      <div aria-hidden="true" data-scrim="" className="fixed inset-0 z-40 bg-navy/35 print:hidden md:hidden" onClick={onClose} />
      <div
        ref={box}
        id={DRAWER_ID}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onKeyDown={keys}
        onClick={closeOnLink}
        /*
          * The sidebar's own width, and never more than 85% of the screen, so a strip of the page stays in
          * sight and the scrim is there to tap. Its padding is the sidebar's.
          */
        className="fixed inset-y-0 left-0 z-50 flex w-sidebar max-w-[85vw] flex-col bg-navy px-4 pb-4 pt-3.5 text-sidebar-text shadow-modal print:hidden md:hidden"
      >
        <div className="mb-3 flex items-center gap-2 border-b border-white/10 px-1 pb-3.5">
          <BrandMark />
          <Wordmark brandTag={brandTag} />
          {/* Where the rail toggle sits in the sidebar: a control on the frame. 44px, as every target on a phone. */}
          <button
            ref={closer}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="-mr-2 ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white/[0.55] hover:bg-white/[0.06] hover:text-white"
          >
            <MenuGlyph close />
          </button>
        </div>
        <nav id="sidebar-nav" aria-label="Main" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
          {children}
        </nav>
        {foot}
      </div>
    </>
  );
}

export function AppShell({
  sections,
  user,
  account,
  brandTag,
  upcomingLabel = 'Upcoming',
  notifications,
  title,
  subtitle,
  actions,
  children,
}: {
  sections: readonly NavSection[];
  user: ShellUser;
  /**
   * The amber line under the wordmark naming which app this is — `KPM OWNER`,
   * `SUPERADMIN`. The agent app has none (`Overall.html:2619`).
   */
  brandTag?: string;
  /** `Upcoming` in the KPM Owner app, `Soon` in Superadmin. The prototypes differ. */
  upcomingLabel?: string;
  /**
   * Wires the identity chip to the actions behind it. Omitted, the chip is a plain
   * label — a shell rendered outside a session has no account to reach and nothing to
   * sign out of, and offering a dead control would be worse than offering none.
   */
  account?: AppShellAccount;
  /**
   * The bell, beside the identity chip at the foot of the sidebar — and **on a phone, the avatar's**: its badge
   * on the avatar, *Notifications* in its menu, no bell on the bar (P18.95-T12).
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
   * The page's own heading, when the shell is rendered by a page.
   *
   * Optional because a **group layout** renders this shell without knowing any page's
   * title — that is the whole reason a layout can own the sidebar. A page inside such a
   * layout renders `PageHeader` itself and passes nothing here.
   */
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  /**
   * **Every group starts open, and each heading toggles its own** (P10.1-T3, client item 3).
   *
   * The client asked on 2026-09-24 for one group open at a time, and on 2026-09-29 for every group
   * to open on its own, all open by default; the later request wins (ADR-0062). The prototype has
   * no toggles at all — every group is static and open (`Overall.html:2610-2691`) — so all-open is
   * also the page the prototype draws, with the client's toggles kept on top of it.
   *
   * **The closed groups are the state, and the set starts empty.** The server render and the first
   * client render therefore agree with nothing to reconcile, and nothing is remembered across a
   * reload: *all open by default* is the ask, and the rail stays the one remembered preference.
   */
  const activeGroup = sections.find((s) => s.items.some((i) => i.active))?.label ?? null;
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  /*
   * **Arriving inside a closed group opens that group, and only that one.** A group the reader
   * closed stays closed while they stay inside it; the route moving into it from elsewhere is what
   * reopens it — `activeGroup` in the dependency list is what makes that happen without overriding
   * the reader on every render. Returning the same set when there is nothing to open keeps the
   * effect from re-rendering the shell on every navigation.
   */
  useEffect(() => {
    if (!activeGroup) return;
    setClosed((now) => {
      if (!now.has(activeGroup)) return now;
      const next = new Set(now);
      next.delete(activeGroup);
      return next;
    });
  }, [activeGroup]);
  const toggleGroup = (label: string) => {
    setClosed((now) => {
      const next = new Set(now);
      if (!next.delete(label)) next.add(label);
      return next;
    });
  };

  /**
   * **The rail, remembered — one choice per size** (P18.97-T6 AC-1, ADR-0178 §1; the client's UI-033). From 1024px
   * the full sidebar is the default and `ab.sidebar.rail` remembers the rail, as before; **from 768 to 1023px the rail
   * is the default** and `ab.sidebar.rail.tablet` remembers opening it full. The width crossing 1024px swaps which one
   * the sidebar shows, and each keeps its own.
   *
   * Read in an effect rather than in the initial state: the server renders this too, and `localStorage` there is a
   * hydration mismatch rather than a preference. **Before the first paint**, with the width (`useMediaQuery`), so a
   * tablet's first frame is the rail and a remembered choice is drawn from the start, never one frame of the other
   * first. A browser that refuses storage gets each size's default: the full sidebar on a desktop, the rail on a
   * tablet — the room the page needs there.
   */
  const [deskRail, setDeskRail] = useState(false);
  const [tabletRail, setTabletRail] = useState(true);
  useBeforePaint(() => {
    try {
      setDeskRail(window.localStorage.getItem(RAIL_KEY) === '1');
      setTabletRail(window.localStorage.getItem(TABLET_RAIL_KEY) !== '0');
    } catch {
      // A private window, or storage switched off. Not a reason to fail the shell.
    }
  }, []);
  const tablet = useMediaQuery('tablet', { beforePaint: true });
  const rail = tablet ? tabletRail : deskRail;
  const toggleRail = () => {
    const next = !rail;
    if (tablet) setTabletRail(next);
    else setDeskRail(next);
    try {
      window.localStorage.setItem(tablet ? TABLET_RAIL_KEY : RAIL_KEY, next ? '1' : '0');
    } catch {
      // The preference is lost on reload; the sidebar still works.
    }
  };

  /*
   * **On a phone, ☰ opens the sidebar as a drawer** (P18.95-T2, ADR-0167 §3; the client's UI review, UI-009).
   * Below 768px the sidebar is a bar and has no room for the nav, and the prototype's phone simply hides it,
   * with *Sign out* (`Overall.html:1421-1428`). From 2026-10-02 the nav went into the account chip's panel
   * (ADR-0085), where the client found the menu hidden behind the name; now ☰, before the brand, opens the
   * sidebar's own content from the left, and the chip keeps the account's items. One nav at a time, never two:
   * the sidebar renders it wider, the drawer on a phone. The rail is a wider screen's control, so a collapsed one
   * remembered from a wider window does not shrink the chip to an avatar on a phone, nor the drawer to a rail.
   */
  const phone = usePhone();
  const groups = (
    <NavGroups sections={sections} rail={rail && !phone} closed={closed} onToggle={toggleGroup} pill={upcomingLabel} />
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  /*
   * **The route moving closes it** — a link followed inside it closes it first; this is *Back*, and any other
   * way the page changes underneath it — and so does the width crossing 768px, where the sidebar is back.
   */
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, phone]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Below the prototype's 720px breakpoint the rail becomes a horizontal navy bar
          that keeps the brand and hides the nav and footer (`Overall.html:1421-1428`).
          It used to be `hidden md:flex`, which took the only route to sign out with it;
          the chip in it stayed (ADR-0085), and ☰ before the brand opens the nav (P18.95-T2). Since
          P18.95-T12 the chip and the bell there are one avatar, at the bar's right edge. */}
      <aside
        className={cn(
          // `print:hidden`: a printed page is the page, not the app around it (`Overall.html:1022`, ADR-0061).
          'sticky top-0 z-10 flex w-full shrink-0 flex-row items-center bg-navy px-4 py-3.5 text-sidebar-text print:hidden md:h-screen md:flex-col md:items-stretch md:py-5',
          /*
           * **An arbitrary value, not a theme key.** `w-sidebar-rail` would need a new entry in
           * `tailwind.config.ts`, and Tailwind's JIT does not pick a config change up without a
           * dev-server restart — so the class silently did not exist, the `w-full` underneath it
           * won, and collapsing the sidebar covered the page. A width that can vanish is a bad
           * width for the one class that decides whether anything else is visible.
           */
          rail ? 'md:w-[var(--sidebar-rail-width)] md:px-2' : 'md:w-sidebar',
        )}
      >
        {/*
          * **☰, before the brand, below 768px only** (P18.95-T2 AC-1). Hidden by its class rather than by
          * `usePhone`, so a phone's first paint already has it and the brand does not move when the page
          * wakes; nothing wider shows it. A 44px target, as every target on a phone; the glyph keeps the
          * brand mark's place at the bar's edge.
          */}
        <button
          ref={menuButton}
          type="button"
          // Only on a phone: from 768px it is not shown, and an open drawer left waiting would spring open
          // the moment the window narrowed.
          onClick={() => { if (phone) setMenuOpen(true); }}
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen && phone}
          aria-controls={DRAWER_ID}
          className="-ml-2 mr-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white/[0.78] hover:bg-white/[0.06] hover:text-white md:hidden"
        >
          <MenuGlyph />
        </button>
        <div
          className={cn(
            'flex items-center gap-2 px-1 md:mb-3 md:border-b md:border-white/10 md:pb-4',
            rail && 'md:flex-col md:gap-2 md:px-0',
          )}
        >
          <BrandMark />
          {/* The wordmark goes, the mark stays: it is the thing that says which product this
              is, and 56px has room for exactly one of them. */}
          <Wordmark brandTag={brandTag} className={rail ? 'md:hidden' : undefined} />

          {/*
            * **Beside the mark, not above the nav.** It was its own row under the brand, which
            * read as the first thing in the menu rather than as a control on the frame. Here it
            * is part of the chrome, where a window control belongs. Collapsed it drops beneath
            * the mark, because 56px holds one of them at a time.
            */}
          {!phone && (
            <button
              type="button"
              onClick={toggleRail}
              aria-expanded={!rail}
              aria-controls="sidebar-nav"
              aria-label={rail ? 'Expand the sidebar' : 'Collapse the sidebar'}
              title={rail ? 'Expand the sidebar' : 'Collapse the sidebar'}
              className={cn(
                'hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/[0.55] hover:bg-white/[0.06] hover:text-white md:flex',
                !rail && 'md:ml-auto',
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
          )}
        </div>

        {/* Wider than a phone, the nav is the sidebar's. On a phone it is the drawer's (below). */}
        {!phone && (
          <nav id="sidebar-nav" className="hidden min-h-0 flex-1 overflow-y-auto pr-0.5 md:block" aria-label="Main">
            {groups}
          </nav>
        )}

        <SidebarFoot
          rail={rail && !phone}
          user={user}
          account={account}
          notifications={notifications}
          phone={phone}
        />
      </aside>

      {menuOpen && phone && (
        <PhoneMenu
          onClose={() => setMenuOpen(false)}
          returnTo={menuButton}
          brandTag={brandTag}
          foot={<SidebarFoot rail={false} user={user} account={account} drawer />}
        >
          {groups}
        </PhoneMenu>
      )}

      <main className="min-w-0 flex-1 px-5 py-6 print:p-0 md:px-10 md:pb-14 md:pt-8">
        {title !== undefined && (
          <PageHeader title={title} subtitle={subtitle} actions={actions} />
        )}
        {children}
      </main>
    </div>
  );
}
