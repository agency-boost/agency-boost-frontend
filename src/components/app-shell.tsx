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
}

export interface NavSection {
  readonly label: string | null;
  readonly items: readonly NavItem[];
}

export function AppShell({
  sections,
  user,
  title,
  subtitle,
  actions,
  children,
}: {
  sections: readonly NavSection[];
  user: { name: string; role: string; initials: string };
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-sidebar shrink-0 flex-col bg-navy px-4 py-5 text-[#EDEFF5] md:flex">
        <div className="mb-3 flex items-center gap-2 border-b border-white/10 px-1 pb-4">
          <span className="font-display text-[17px] font-extrabold tracking-tight text-white">
            AgencyBoost
          </span>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto pr-0.5" aria-label="Main">
          {sections.map((section) => (
            <div key={section.label ?? 'root'}>
              {section.label && (
                <p className="mx-2 mb-1 mt-2 text-2xs uppercase tracking-wider text-white/40">
                  {section.label}
                </p>
              )}
              <ul className="mb-2.5 flex flex-col gap-px">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.upcoming ? undefined : item.href}
                      aria-disabled={item.upcoming || undefined}
                      aria-current={item.active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-md font-medium',
                        item.active
                          ? 'bg-amber/15 font-semibold text-white'
                          : 'text-white/[0.78] hover:text-white',
                        item.upcoming && 'cursor-default text-white/30 hover:text-white/30',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 shrink-0 rounded-full',
                          item.active ? 'bg-amber' : 'bg-white/35',
                        )}
                      />
                      {item.label}
                      {item.upcoming && (
                        <span className="ml-auto rounded-pill bg-white/[0.06] px-1.5 py-0.5 text-2xs font-bold uppercase text-white/40">
                          Upcoming
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/10 pt-3">
          <div className="flex items-center gap-2 px-1 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber text-base font-bold text-navy">
              {user.initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-md font-semibold text-white">{user.name}</span>
              <span className="block truncate text-xs text-white/55">{user.role}</span>
            </span>
          </div>
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
