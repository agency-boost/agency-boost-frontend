'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AppShell, type NavItem, type NavSection } from '@/components/app-shell';
import { RequireSession } from '@/components/require-session';
import { ToastHost } from '@/components/ui/toast';
import { shortOfRung, useLadder } from '@/components/ui/role-badge';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { shellMessages } from '@/i18n/messages/shell';
import { viewSwitchFor } from '@/lib/landing';
import { displayName } from '@/lib/display-name';
import { fieldNav, type FieldDestination } from '@/lib/field-nav';
import { profileLine } from '@/lib/profile-line';
import { useSession } from '@/lib/session';
import { useUnreadCount } from '@/lib/use-unread-count';
import { useSignOut } from '@/lib/use-sign-out';

/** The picker's dialog, loaded the first time *Search agent* is pressed (common.md: a dialog costs nothing until then). */
const AgentSearchDialog = dynamic(
  () => import('@/components/agent-search-dialog').then((m) => m.AgentSearchDialog),
  { ssr: false },
);

/**
 * The chrome around every agent and leader screen — **the field shell** (UI V1, UI-004; D-13, D-20; ADR-0180).
 *
 * - **Below 1024px**: no dark app bar; each page's title row with the avatar at its end, the floating tab bar
 *   (*Activity · Calendar · Home · Unit · Lainnya*) and the *Lainnya* sheet (`components/field-nav.tsx`).
 * - **From 1024px**: the navy sidebar as before, **regrouped as the sheet is** — a first section with no heading, then
 *   *Saya*, *Aktivitas*, *Tim saya*, *Program*, *KPM* — with today's look, the profile chip, the bell and the page
 *   header's *ID | EN* switch where they were.
 *
 * Until UI V1 this drew `Overall.html`'s nine sections (`:2610-2691`) with *Recruitment tools* and *Core leader* added;
 * the revision of 2026-10-30 replaced them (ADR-0180: for a page the revision draws, its report is the design source).
 * Unbuilt items keep their *Segera hadir* pill (ADR-0070), as *Advanced analytics* does.
 */

export function AgentShell({
  title,
  subtitle,
  permission,
  actions,
  children,
}: {
  /**
   * Omitted when a **group layout** renders this shell: a layout serves every route
   * beneath it and cannot know their titles, so those pages render `PageHeader`
   * themselves.
   */
  title?: string;
  subtitle?: string;
  /** Set on the leader screen when no office is registered yet. */
  leaderLocked?: boolean;
  permission?: string;
  /**
   * Render User Management's sub-tab strip. Off by default: it belongs to that module,
   * and it used to appear on the group tree, the unit dashboard and the activity log —
   * three screens offering tabs to a module they are not part of.
   */
  subtabs?: boolean;
  /** The prototype's alert-red count on Pending Requests, hidden at zero. */
  pendingCount?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <RequireSession permission={permission} family="agent">
      {/* The shell's toast, for a write that leaves its page (P13-T7 AC-3). */}
      <ToastHost>
        <Chrome
          title={title}
          subtitle={subtitle}
          actions={actions}
        >
          {children}
        </Chrome>
      </ToastHost>
    </RequireSession>
  );
}

function Chrome({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  leaderLocked?: boolean;
  subtabs?: boolean;
  pendingCount?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { me } = useSession();
  const unread = useUnreadCount();
  const { signOut, busy } = useSignOut();
  const pathname = usePathname();
  // The nav's words are kept English (`kept`, the glossary's §A.1); the groups' headings and the pill are the reader's.
  const t = useMessages(shellMessages);
  const language = useLanguage();
  const [searching, setSearching] = useState(false);

  const membership = me?.membership;

  /*
   * **One model for the three menus** (UI V1, UI-004; D-20, ADR-0180): the tab bar, the *Lainnya* sheet and this
   * sidebar are `fieldNav`'s, so the sheet and the sidebar have the same groups, order and members. Who sees what is
   * today's rule, unchanged — leading is the graph (OD-23), *New Hires* as P18.96-T3 offers it, the *KPM* group to a
   * Core Leader (ADR-0159 §3) — and every route keeps its own guard: the nav decides what is offered, never what is
   * allowed.
   */
  const nav = fieldNav(me, pathname);

  /**
   * A destination as the sidebar draws it: its full name (D-20, *desktop has room*), *Segera hadir* for one with no
   * screen, the amber check, and *Search agent* a control that opens the picker rather than a page.
   */
  const item = (d: FieldDestination): NavItem => ({
    label: d.label,
    href: d.href,
    icon: d.icon,
    active: d.active,
    ...(d.soon ? { upcoming: true } : {}),
    ...(d.done ? { done: true } : {}),
    ...(d.opens === 'agentSearch' ? { onSelect: () => setSearching(true) } : {}),
  });

  /*
   * **The desktop sidebar, regrouped** (UI-004; D-20): a first section with no heading — *Home · Activity · Calendar ·
   * Unit Dashboard · Search agent* — then *Saya*, *Aktivitas*, *Tim saya*, *Program* and *KPM*, their headings 12px grey in
   * sentence case (`AppShell`'s `field`). *Unit tools*, *Personal tools*, *Sales tools* and the rest are gone. A line
   * between every two groups, as before (parity I-144).
   */
  const sections: readonly NavSection[] = [
    { label: null, divider: true, items: nav.top.map(item) },
    ...nav.groups.map((group, i): NavSection => ({
      label: t.fieldGroups[group.id],
      items: group.items.map(item),
      ...(i < nav.groups.length - 1 ? { divider: true } : {}),
    })),
  ];

  /*
   * The rung's short form, from the company's ladder (P4-T9).
   *
   * `ROLE_SHORT` was a three-key map here; a company publishing a fourth rung would have
   * shown a member of it nothing at all in the one place the sidebar says who they are.
   */
  const ladder = useLadder();
  const rung = ladder.find((l) => l.code === membership?.orgLevelCode?.toUpperCase());
  const shortRung = rung
    ? shortOfRung(rung)
    : (membership?.hierarchyRole ?? '').toUpperCase();

  const name = (me && displayName(me.user)) || t.signedIn;
  // The profile line (ADR-0159 §5, P18.8-T6 AC-2): the rung · Core Leader · the groups · the office.
  const role = membership ? profileLine(shortRung, membership) : t.noOfficeYet;
  // *Open Owner view* or *Open Admin view* (ADR-0114): back to the office console, for an Owner or an Admin who opened
  // their field view. A field member has one view, and is offered nothing.
  const viewSwitch = viewSwitchFor(me, 'field', language) ?? undefined;
  const notifications = { href: '/notifications', unread };

  return (
    <AppShell
      sections={sections}
      user={{
        name,
        role,
        initials: me?.user.initials ?? '??',
        email: me?.user.email,
        // The first of the phone's menu details (P18.95-T12 AC-3): the name in full, where the chip greets by the preferred one.
        fullName: me?.user.fullName,
      }}
      // *Advanced analytics* is the one item here with no screen yet: *Soon*, as the client wrote it.
      upcomingLabel={t.soon}
      account={{
        href: '/profile',
        onSignOut: () => void signOut(),
        signingOut: busy,
        viewSwitch,
      }}
      notifications={notifications}
      field={{
        nav,
        notifications,
        account: {
          name,
          role,
          initials: me?.user.initials ?? '??',
          avatarUrl: me?.user.avatarUrl ?? null,
          profileHref: '/profile',
          onSignOut: () => void signOut(),
          signingOut: busy,
          viewSwitch,
        },
      }}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {children}
      {searching && <AgentSearchDialog onClose={() => setSearching(false)} />}
    </AppShell>
  );
}
