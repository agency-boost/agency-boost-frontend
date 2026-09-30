import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SidebarUserMenu } from '@/components/sidebar-user-menu';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { cn } from '@/lib/cn';

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
   */
  const named = rail
    ? {
      'aria-label': item.upcoming ? `${item.label} — ${pill}` : item.label,
      title: item.upcoming ? `${item.label} — ${pill}` : item.label,
    }
    : {};

  if (item.upcoming) {
    return (
      <a aria-disabled className={className} {...named}>
        {body}
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

export interface ShellUser {
  readonly name: string;
  readonly role: string;
  readonly initials: string;
  /** Shown in the account menu, so you can confirm who you are before signing out. */
  readonly email?: string;
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
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-md text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
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
 */
function SidebarFoot({
  rail,
  user,
  account,
  notifications,
}: {
  rail: boolean;
  user: ShellUser;
  account?: { href: string; onSignOut: () => void; signingOut?: boolean };
  notifications?: { href: string; unread: number };
}) {
  /*
   * **The chip takes the space; the bell is pinned.** The chip sized itself to its contents,
   * so a short name pulled the bell left and a long one pushed it right — a control that
   * moves with somebody's name is one nobody learns the position of. `flex-1 min-w-0` also
   * gives the name the full width to truncate against rather than only its own.
   */
  const chip = account ? (
    <SidebarUserMenu
      user={user}
      accountHref={account.href}
      onSignOut={account.onSignOut}
      signingOut={account.signingOut}
      className={rail ? undefined : 'min-w-0 flex-1'}
      compact={rail}
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
          <span className="block truncate text-xs text-white/55">{user.role}</span>
        </span>
      )}
    </div>
  );
  const bell = notifications ? <NotificationBell {...notifications} /> : null;

  return (
    <div
      className={cn(
        'ml-auto flex shrink-0 items-center gap-1 md:ml-0 md:border-t md:border-white/10 md:pt-3',
        rail && 'md:flex-col md:gap-1.5',
      )}
    >
      {rail ? <>{bell}{chip}</> : <>{chip}{bell}</>}
    </div>
  );
}

/** Where the reader's choice of rail-or-full lives. One key, one character. */
const RAIL_KEY = 'ab.sidebar.rail';

/**
 * The bell at the foot of the sidebar.
 *
 * **The count is in the accessible name, not only in the badge.** A red circle with a number
 * beside an unlabelled icon tells a screen reader nothing, and *"Notifications"* alone would
 * hide the one thing the control exists to communicate.
 *
 * Capped at `9+`: past that the number stops being a number somebody acts on, and a wide badge
 * would push the identity chip about as the count changed.
 */
function NotificationBell({ href, unread }: { href: string; unread: number }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
        active ? 'bg-amber/15 text-white' : 'text-white/[0.78] hover:bg-white/[0.06]',
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-alert px-1 text-2xs font-bold text-white"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
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
  account?: {
    href: string;
    onSignOut: () => void;
    signingOut?: boolean;
  };
  /**
   * The bell, beside the identity chip at the foot of the sidebar.
   *
   * **Not a nav item.** It was one in all three shells, sitting in a list of places to work
   * with a count beside it — so an office's notifications read as a section of the product
   * rather than as the thing you glance at on the way past. It is a glance, and it belongs
   * where the account is: one icon, and a number only when there is one.
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
   * **The rail, remembered.** Read in an effect rather than in the initial state: the server
   * renders this too, and `localStorage` there is a hydration mismatch rather than a
   * preference. A browser that refuses storage gets the full sidebar, which is the safe half.
   */
  const [rail, setRail] = useState(false);
  useEffect(() => {
    try {
      setRail(window.localStorage.getItem(RAIL_KEY) === '1');
    } catch {
      // A private window, or storage switched off. Not a reason to fail the shell.
    }
  }, []);
  const toggleRail = () => {
    setRail((was) => {
      const next = !was;
      try {
        window.localStorage.setItem(RAIL_KEY, next ? '1' : '0');
      } catch {
        // The preference is lost on reload; the sidebar still works.
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Below the prototype's 720px breakpoint the rail becomes a horizontal navy bar
          that keeps the brand and hides the nav and footer (`Overall.html:1421-1428`).
          It used to be `hidden md:flex`, which took the only route to sign out with it. */}
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
        <div
          className={cn(
            'flex items-center gap-2 px-1 md:mb-3 md:border-b md:border-white/10 md:pb-4',
            rail && 'md:flex-col md:gap-2 md:px-0',
          )}
        >
          <BrandMark />
          {/* The wordmark goes, the mark stays: it is the thing that says which product this
              is, and 56px has room for exactly one of them. */}
          <span
            className={cn(
              'font-display text-lg font-extrabold leading-tight tracking-tight text-white',
              rail && 'md:hidden',
            )}
          >
            AgencyBoost
            {brandTag && (
              <span className="block text-2xs font-semibold uppercase tracking-wide text-amber">
                {brandTag}
              </span>
            )}
          </span>

          {/*
            * **Beside the mark, not above the nav.** It was its own row under the brand, which
            * read as the first thing in the menu rather than as a control on the frame. Here it
            * is part of the chrome, where a window control belongs. Collapsed it drops beneath
            * the mark, because 56px holds one of them at a time.
            */}
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
        </div>

        <nav id="sidebar-nav" className="hidden min-h-0 flex-1 overflow-y-auto pr-0.5 md:block" aria-label="Main">
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
                      onClick={() => toggleGroup(section.label ?? '')}
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
                        <NavLink item={item} pill={upcomingLabel} rail={rail} />
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
        </nav>

        <SidebarFoot rail={rail} user={user} account={account} notifications={notifications} />
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6 print:p-0 md:px-10 md:pb-14 md:pt-8">
        {title !== undefined && (
          <PageHeader title={title} subtitle={subtitle} actions={actions} />
        )}
        {children}
      </main>
    </div>
  );
}
