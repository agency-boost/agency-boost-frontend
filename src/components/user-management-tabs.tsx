'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/session';

/**
 * The User Management chain: four screens that are one journey.
 *
 * Lifted out of `AgentShell` when route groups landed. A group layout serves every route
 * beneath it, and only four of the agent application's screens carry this strip — so it
 * belongs to those four, not to the shell they happen to share.
 *
 * Title Case, because these are the prototype's strings, and a **chain** rather than four
 * peers: Find Your Leader stays visible and says why it is locked
 * (`Overall.html:8824`) instead of disappearing.
 */
interface SubTab {
  readonly href: string;
  readonly label: string;
  /** Hidden unless the reader holds this. Absent means everybody sees it. */
  readonly needs?: string;
}

const SUBTABS: readonly SubTab[] = [
  { href: '/user-management/kpm', label: 'Register KPM' },
  { href: '/user-management/leader', label: 'Find Your Leader' },
  // Hidden from an Agent, who holds neither permission this screen's two halves need.
  // `roles-and-permissions.md:372` calls it "the single largest leak in the prototype" —
  // an Agent issuing codes that tag joiners to themselves, and pulling untagged members
  // into a unit they do not have — and the API has always refused both. Only the tab
  // strip and the screen did not. Gated on the pool rather than the invite because the
  // invite permission goes away with P3.6-T1, and this one decides the same thing.
  { href: '/user-management/add', label: 'Add New Agents', needs: 'member:search_untagged_pool' },
  // Hidden from anybody who cannot read an inbox — an Agent. The prototype hides it by
  // role (`User_Management_Section.html:996`); we hide it by the permission that decides
  // the same thing, so it survives P3.5-T8 replacing the role with a ladder reference.
  { href: '/user-management/pending', label: 'Pending Requests', needs: 'leader_request:read_inbox' },
];

export function UserManagementTabs({
  leaderLocked,
  pendingCount,
}: {
  /** Find Your Leader is locked until an office is registered. */
  leaderLocked?: boolean;
  pendingCount?: number;
}) {
  const pathname = usePathname();
  const { me } = useSession();
  const permissions = me?.permissions ?? [];

  return (
        // The prototype's metrics: 24px between tabs, the underline sitting on the
        // hairline, and inactive tabs at the same weight as active — they differ by
        // colour and the amber rule, not by weight (`Overall.html:81-89`).
        <div className="mb-6 flex flex-wrap gap-6 border-b border-hairline">
          {SUBTABS.filter((tab) => !tab.needs || permissions.includes(tab.needs)).map((tab) => {
            const locked = tab.href.endsWith('/leader') && leaderLocked;
            const active = pathname === tab.href;
            if (locked) {
              return (
                <span
                  key={tab.href}
                  aria-disabled
                  title="Register an office first"
                  className="-mb-px cursor-default border-b-2 border-transparent px-0.5 pb-3 text-md font-semibold text-muted/50"
                >
                  {tab.label}
                </span>
              );
            }
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? '-mb-px border-b-2 border-amber px-0.5 pb-3 text-md font-semibold text-navy'
                    : '-mb-px border-b-2 border-transparent px-0.5 pb-3 text-md font-semibold text-muted'
                }
              >
                <span className="flex items-center gap-1.5">
                  {tab.label}
                  {tab.href.endsWith('/pending') && pendingCount !== undefined && pendingCount > 0 && (
                    <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-alert px-1.5 text-2xs font-bold text-card">
                      {pendingCount}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
  );
}
