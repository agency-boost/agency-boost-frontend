import Link from 'next/link';
import { SidebarUserMenu } from '@/components/sidebar-user-menu';
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

function NavLink({ item, pill }: { item: NavItem; pill: string }) {
  // No hover state. There is no `.nav a:hover` rule in any of the fifteen prototype
  // files — resting, active and disabled are the only three. A hover that lightens an
  // inactive item makes it read as nearly-active, which is exactly the confusion the
  // amber tint plus amber dot exist to avoid.
  const className = cn(
    'flex items-center gap-2 rounded-md px-2 py-1.5 text-md font-medium',
    item.active ? 'bg-amber/15 font-semibold text-white' : 'text-white/[0.78]',
    item.upcoming && 'cursor-default text-white/30',
  );
  const body = (
    <>
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          item.active ? 'bg-amber' : item.upcoming ? 'bg-white/[0.18]' : 'bg-white/35',
        )}
      />
      {item.label}
      {item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-alert px-1.5 text-2xs font-bold text-white">
          {item.badge}
        </span>
      )}
      {item.upcoming && (
        <span className="ml-auto rounded-pill bg-white/[0.06] px-1.5 py-0.5 text-2xs font-bold uppercase text-white/40">
          {pill}
        </span>
      )}
    </>
  );

  if (item.upcoming) {
    return (
      <a aria-disabled className={className}>
        {body}
      </a>
    );
  }
  return (
    <Link href={item.href} aria-current={item.active ? 'page' : undefined} className={className}>
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

export function AppShell({
  sections,
  user,
  account,
  brandTag,
  upcomingLabel = 'Upcoming',
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
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Below the prototype's 720px breakpoint the rail becomes a horizontal navy bar
          that keeps the brand and hides the nav and footer (`Overall.html:1421-1428`).
          It used to be `hidden md:flex`, which took the only route to sign out with it. */}
      <aside className="sticky top-0 z-10 flex w-full shrink-0 flex-row items-center bg-navy px-4 py-3.5 text-sidebar-text md:h-screen md:w-sidebar md:flex-col md:items-stretch md:py-5">
        <div className="flex items-center gap-2 px-1 md:mb-3 md:border-b md:border-white/10 md:pb-4">
          <BrandMark />
          <span className="font-display text-lg font-extrabold leading-tight tracking-tight text-white">
            AgencyBoost
            {brandTag && (
              <span className="block text-2xs font-semibold uppercase tracking-wide text-amber">
                {brandTag}
              </span>
            )}
          </span>
        </div>

        <nav className="hidden min-h-0 flex-1 overflow-y-auto pr-0.5 md:block" aria-label="Main">
          {sections.map((section) => (
            <div key={section.label ?? section.items[0]?.href ?? 'root'}>
              {section.label && (
                <p className="mx-2 mb-1 mt-2 text-2xs uppercase tracking-wider text-white/40">
                  {section.label}
                </p>
              )}
              <ul className="mb-2.5 flex flex-col gap-px">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} pill={upcomingLabel} />
                  </li>
                ))}
              </ul>
              {section.divider && <div className="mx-1 my-2 h-px bg-white/10" />}
            </div>
          ))}
        </nav>

        <div className="ml-auto shrink-0 md:ml-0 md:border-t md:border-white/10 md:pt-3">
          {account ? (
            <SidebarUserMenu
              user={user}
              accountHref={account.href}
              onSignOut={account.onSignOut}
              signingOut={account.signingOut}
            />
          ) : (
            <div className="flex items-center gap-2 px-1 py-1.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber text-base font-bold text-navy">
                {user.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-md font-semibold text-white">{user.name}</span>
                <span className="block truncate text-xs text-white/55">{user.role}</span>
              </span>
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6 md:px-10 md:pb-14 md:pt-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-navy">{title}</h1>
            {subtitle && <p className="mt-1 text-md text-muted">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
