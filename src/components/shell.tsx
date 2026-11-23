'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell, type NavItem, type NavSection } from '@/components/app-shell';
import { RequireSession } from '@/components/require-session';
import { ToastHost } from '@/components/ui/toast';
import { shortOfRung, useLadder } from '@/components/ui/role-badge';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { shellMessages } from '@/i18n/messages/shell';
import { displayName } from '@/lib/display-name';
import { adminNav, fieldNav, insideKpmNav, isUnder, runsTheOffice, type FieldDestination, type FieldGroup } from '@/lib/field-nav';
import { needsKpmHere } from '@/lib/no-kpm';
import { APP_NAME } from '@/lib/pwa';
import { profileLine } from '@/lib/profile-line';
import { FAMILY_GATES, type ShellFamily } from '@/lib/route-access';
import { useSession } from '@/lib/session';
import { useApprovalsPending } from '@/lib/approvals';
import { enteredKpmId, insideKpm } from '@/lib/super-admin-kpm';
import { useSignOut } from '@/lib/use-sign-out';
import { useUnreadCount } from '@/lib/use-unread-count';

/** The no-office card (UI-166), loaded only for somebody in no office. */
const NoKpmYet = dynamic(() => import('@/components/no-kpm-yet').then((m) => m.NoKpmYet), { ssr: false });

/** The Super Admin's floating bar on the owner pages inside a KPM (P19.23-T2 AC-5), loaded only there. */
const KpmFloatingBar = dynamic(() => import('@/components/admin/kpm-floating-bar').then((m) => m.KpmFloatingBar), { ssr: false });

/** The picker's dialog, loaded the first time *Search agent* is pressed (common.md: a dialog costs nothing until then). */
const AgentSearchDialog = dynamic(
  () => import('@/components/agent-search-dialog').then((m) => m.AgentSearchDialog),
  { ssr: false },
);

/**
 * **The one shell, for every role** (P19.2-T1 AC-1, AC-2; UI-146, UI-147, UI-127, UI-128;
 * [ADR-0197](../../../docs/04-adr/0197-one-shell-for-every-role.md)) — every route, field, office, platform and shared.
 * `TenantShell` and `AdminShell` are gone, and `RoleShell` no longer chooses between shells.
 *
 * - **What the role decides is which items appear** (D-20), never the chrome: the field menu by rung (ADR-0189), the
 *   extras — KPM · People · Pengaturan — for the Owner, the Admins and the core leaders (ADR-0269 §4), the Super Admin's
 *   bar and groups (UI-127).
 * - **What the family decides is who is let in**, unchanged: a group layout passes `family`, `RequireSession` sends a
 *   reader of no family of it to their own landing (`familyAllows`), and the family's gate is its default permission
 *   (`FAMILY_GATES`: the office's `member:read_profile`, the platform's `kpm:list_all`). A shared page passes none.
 *   Every route keeps its guard and every API refusal stays where it was.
 */
export function Shell({
  family,
  title,
  subtitle,
  actions,
  permission,
  children,
}: {
  /**
   * The route group whose pages this wraps — `agent`, `tenant` (the office's `/kpm/*`, `/people/*`) or `admin` — or
   * nothing for a shared page (`RoleShell`).
   */
  family?: ShellFamily;
  /**
   * Omitted when a **group layout** renders this shell: a layout serves every route beneath it and cannot know their
   * titles, so those pages render `PageHeader` themselves.
   */
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** What this screen needs; the family's own gate when absent. */
  permission?: string;
  children: React.ReactNode;
}) {
  return (
    <RequireSession permission={permission ?? (family ? FAMILY_GATES[family] : undefined)} family={family}>
      {/* The shell's one toast region (P18.7-T1 AC-6, P13-T7 AC-3): every screen beneath it speaks through it. */}
      <ToastHost>
        <Chrome title={title} subtitle={subtitle} actions={actions}>
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
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { me } = useSession();
  const unread = useUnreadCount();
  const approvalsPending = useApprovalsPending();
  const { signOut, busy } = useSignOut();
  const pathname = usePathname() ?? '';
  // The nav's words are kept English (`kept`, the glossary's §A.1); the groups' headings and the tags are the reader's.
  const t = useMessages(shellMessages);
  const [searching, setSearching] = useState(false);
  const membership = me?.membership;

  /*
   * **One login, one menu, decided by the role** (P19.17-T3 AC-1, AC-4; ADR-0269 §1, §4): a Super Admin login has the
   * platform's menu (`adminNav`, until Phase 19.23's console); everybody else the field menu their rung gives, with the
   * extras — KPM · People · Pengaturan — for the Owner, the Admins and the core leaders. No view, no switcher, no second
   * login (ADR-0198, ADR-0199 superseded). Inside a support session `me` is the member's, so the member's menu is drawn.
   */
  const superAdmin = me?.user.platformRole === 'super_admin';
  /*
   * *Changed 2026-11-20 (P19.23-T1 AC-1, T2 AC-5; ADR-0277 §1, §3):* the Super Admin's console menu on `/admin`; **inside
   * a KPM, on its owner pages, the Owner's menu** (KPM · People · Pengaturan, `insideKpmNav`) and the floating bar below.
   */
  const ownerPagesInside = superAdmin && me !== null && insideKpm(me) && !isUnder(pathname, '/admin');
  const fieldWords = { surveys: t.surveys, settings: t.settings, settingsTile: t.settingsTile };
  const nav = ownerPagesInside
    ? insideKpmNav(pathname, fieldWords)
    : superAdmin
      ? adminNav(pathname, t.admin, { approvalsPending })
      : fieldNav(me, pathname, fieldWords);

  /**
   * A destination as the sidebar draws it: its full name (D-20, *desktop has room*), *Segera hadir* for one with no
   * screen, the amber check, a count, and *Search agent* a control that opens the picker rather than a page.
   */
  const item = (d: FieldDestination): NavItem => ({
    label: d.label,
    href: d.href,
    icon: d.icon,
    active: d.active,
    ...(d.soon ? { upcoming: true } : {}),
    ...(d.done ? { done: true } : {}),
    ...(d.badge !== undefined ? { badge: d.badge } : {}),
    ...(d.opens === 'agentSearch' ? { onSelect: () => setSearching(true) } : {}),
  });

  /*
   * **The sidebar, grouped as the sheet** (UI-004; D-20; part E): a first section with no heading, then the groups —
   * their names grey capitals with a chevron, the extras' with the orange *Owner* tag, each with its one icon for the
   * rail — and **Pengaturan pinned** at the foot (`pinned`), outside the part that scrolls (P19.17-T3 AC-5, AC-6).
   *
   * The first section is **Home · Activity · Calendar · Unit Dashboard** (`nav.top`, P19.13-T2 AC-4), so a destination
   * there is not listed again in its group — *Unit Dashboard* leaves *Tim saya* in the sidebar alone; the sheet keeps it.
   */
  const onTop = new Set(nav.top.map((d) => d.id));
  const tagOf = (group: FieldGroup) => (group.tag ? t.ownerTag : undefined);
  const pinnedGroup = nav.groups.find((group) => group.pinned);
  const sections: readonly NavSection[] = [
    // Inside a KPM the Super Admin's menu has no first section (`insideKpmNav`): none is drawn rather than an empty one.
    ...(nav.top.length > 0 ? [{ label: null, divider: true, items: nav.top.map(item) }] : []),
    ...nav.groups.filter((group) => !group.pinned).map((group): NavSection => ({
      label: t.fieldGroups[group.id],
      items: group.items.filter((d) => !onTop.has(d.id)).map(item),
      ...(group.tag ? { tag: tagOf(group) } : {}),
      ...(group.railIcon ? { railIcon: group.railIcon } : {}),
    })),
  ];
  // The pinned group's last item: *Pengaturan*, alone in its group; the console's *Platform*, after the sheet's other two.
  const pinnedItem = pinnedGroup?.items[pinnedGroup.items.length - 1];
  const pinned = pinnedItem ? { item: item(pinnedItem), tag: tagOf(pinnedGroup) } : undefined;

  /*
   * **The browser's tab says the page's menu name** (P19.13-T4 AC-1; UI-197: *browser tab titles follow the same names*):
   * the name of the menu item the reader is on — the label the sidebar, the tab bar or the sheet gives it, which a page's
   * title now equals — then *AgencyBoost*. A page no menu item holds (*Profil saya*, a notification) keeps the app's
   * name alone. The root layout's metadata is the first paint's; the shell's pages are client pages and carry none.
   */
  const menuTitle = [...nav.top, ...nav.tabs, ...nav.groups.flatMap((g) => g.items)].find((d) => d.active)?.label;
  useEffect(() => {
    document.title = tabTitle(menuTitle);
  }, [menuTitle]);

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

  /*
   * **Who is signed in, and as what** — the profile line (ADR-0159 §5, P18.5-T6 AC-2) under the name: *KPM Owner* or *KPM
   * Admin* for whoever runs the office, as the approved sidebar and *Lainnya* write it (`sidebar-icons-laptop`,
   * `lainnya-owner-mobile`: *KPM Owner · BSD City Branch*), the rung for everybody else — then Core Leader · the groups ·
   * the office; *Superadmin* for the platform. The roles kept English (§A.5). One line for every page: there is no view.
   */
  const name = (me && displayName(me.user)) || (superAdmin ? kept('Super Admin') : t.signedIn);
  const role = superAdmin
    ? kept('Superadmin')
    : !membership
      ? t.noOfficeYet
      : runsTheOffice(membership)
        ? profileLine(membership.isKpmOwner ? kept('KPM Owner') : kept('KPM Admin'), membership)
        : profileLine(shortRung, membership);
  const initials = me?.user.initials ?? (superAdmin ? 'SA' : '??');
  const notifications = { href: '/notifications', unread };
  const signOutNow = () => void signOut();

  return (
    <AppShell
      sections={sections}
      pinned={pinned}
      user={{
        name,
        role,
        initials,
        email: me?.user.email,
        // The first of the phone's menu details (P18.7-T12 AC-3): the name in full, where the chip greets by the preferred one.
        fullName: me?.user.fullName,
      }}
      // *SUPERADMIN* under the wordmark, as `admin-desktop` draws it in every frame; nobody else's sidebar names an app.
      brandTag={superAdmin && !ownerPagesInside ? kept('SUPERADMIN') : undefined}
      upcomingLabel={t.soon}
      // P19.17-T3 AC-1 (ADR-0269 §2): the account menu is *Akun Anda · Keluar* for everybody — no views, no *Tambah akun*.
      account={{ href: '/profile', onSignOut: signOutNow, signingOut: busy }}
      notifications={notifications}
      field={{
        nav,
        notifications,
        // The Super Admin's Dashboard is their Home: the bell keeps its place on its title row below 1024px (AC-13).
        bellHere: superAdmin && pathname === '/admin',
        // Who read the shared office pages in the console until now keeps its content there (`useFieldContent`).
        consoleContent: superAdmin || runsTheOffice(membership),
        account: {
          name,
          role,
          initials,
          avatarUrl: me?.user.avatarUrl ?? null,
          profileHref: '/profile',
          onSignOut: signOutNow,
          signingOut: busy,
        },
      }}
      // 22px on a tablet on the Owner's, the Admin's and the Super Admin's pages (ADR-0197 §2); 20px elsewhere.
      officeTitle={isUnder(pathname, '/admin') || isUnder(pathname, '/kpm') || isUnder(pathname, '/people')}
      // *Changed 2026-11-20 (P19.23-T1 AC-1; ADR-0277 §1):* the console opens on the rail at a tablet, as every reader's
      // does to 1279px (the spec §2 *"Tablet / laptop: left rail"*); from 1280px the labelled sidebar.
      labelledFrom1024={false}
      // P19.13-T2 AC-3 (UI-196): the field under the logo, for a reader with the agent picker (a leader by role).
      search={nav.search ? { label: nav.search.label, onSelect: () => setSearching(true) } : undefined}
      // P19.29-T2 AC-1 (UI-201 (21 Nov), ADR-0287 §2): on a phone the Super Admin's strip, above the title row, in the flow.
      aboveTitle={ownerPagesInside && enteredKpmId() ? <KpmFloatingBar kpmId={enteredKpmId()!} at="top" /> : undefined}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {/*
        * **A page that needs a KPM, for somebody in none** (P19-T4 AC-4; UI-166; ADR-0189 §5): every Agent item is in
        * the menu, and its page is the no-office card — its title, a greyed *Contoh*, *Cari / Daftar KPM* and *Cari
        * leader* — with the page itself never mounted, so nothing asks the API for an office's data it would refuse.
        */}
      {needsKpmHere(me, pathname)
        ? <NoKpmYet title={[...nav.tabs, ...nav.groups.flatMap((g) => g.items)].find((d) => d.active)?.label} pathname={pathname} />
        : children}
      {searching && <AgentSearchDialog onClose={() => setSearching(false)} />}
      {/*
        * P19.23-T2 AC-5 (ADR-0277 §3): the owner pages inside a KPM carry the Super Admin's floating bar, and only it —
        * from 768px; below it the strip above (P19.29-T2, `at="top"`). Each draws itself at its own width alone.
        */}
      {ownerPagesInside && enteredKpmId() && <KpmFloatingBar kpmId={enteredKpmId()!} at="floating" />}
    </AppShell>
  );
}

/**
 * **A browser tab's title** (P19.13-T4 AC-1; UI-197): *<menu name> · AgencyBoost* on a page a menu item holds, the app's
 * name alone elsewhere — the root layout's own title.
 */
export function tabTitle(menuName: string | undefined): string {
  return menuName ? `${menuName} · ${APP_NAME}` : APP_NAME;
}
