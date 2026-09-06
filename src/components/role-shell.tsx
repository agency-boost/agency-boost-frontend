'use client';

import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { AgentShell } from '@/components/agent-shell';
import { TenantShell } from '@/components/tenant-shell';
import { useSession } from '@/lib/session';

/**
 * The chrome for a route that belongs to no one role family.
 *
 * Four routes are reachable by everybody — `/`, `/profile`, `/notifications` and `/join`
 * — and until 2026-09-06 each of them picked a shell by hand or wore none at all. So a
 * Super Admin who clicked **Notifications** landed in the *agent* application: eight nav
 * sections about units and leads, no link back to `/admin`, the `SUPERADMIN` tag gone,
 * and their own identity chip reading **"No office yet"** because a Super Admin has no
 * membership. The access gate was right the whole time; only the chrome was wrong, which
 * is why no permission test caught it.
 *
 * **The order mirrors `landingFor`** (`src/lib/landing.ts`), deliberately and for the same
 * reason: several of these are true at once — a KPM Owner is also an AB with a downline —
 * so it runs from the most specific state to the least. Where somebody lands and what
 * chrome they wear are the same question asked twice, and answering it twice in two
 * orders is how they drift apart.
 *
 * Not `landingFor` itself: that returns a **route**, and a route is not a shell. Two
 * functions, one order, and a test that fails if the order stops matching.
 */
export function RoleShell({
  title,
  subtitle,
  actions,
  permission,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** What this route needs — not what the chrome's own application needs. */
  permission?: string;
  children: ReactNode;
}) {
  const { me } = useSession();

  // Nobody signed in. No chrome to wear and no session to read a role from — the page
  // itself decides what to show, and the shells would only redirect to /login anyway.
  if (!me) return <>{children}</>;

  // Platform first: a Super Admin belongs to no office, so nothing below applies to them.
  if (me.user.platformRole === 'super_admin') {
    return (
      <AdminShell title={title} subtitle={subtitle} actions={actions} permission={permission}>
        {children}
      </AdminShell>
    );
  }

  // Running an office — the tenant application is their home, whatever their hierarchy
  // role happens to be. An Owner is usually an AB too; that is not what they signed in as.
  if (me.membership?.isKpmOwner || me.membership?.isKpmAdmin) {
    return (
      <TenantShell title={title} subtitle={subtitle} actions={actions} permission={permission}>
        {children}
      </TenantShell>
    );
  }

  // Everybody else, including somebody in no office at all — the agent application is
  // where they live and where `landingFor` sends them.
  return (
    <AgentShell title={title} subtitle={subtitle} actions={actions} permission={permission}>
      {children}
    </AgentShell>
  );
}
