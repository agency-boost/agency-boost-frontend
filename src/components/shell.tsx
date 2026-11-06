'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { AppShell, type NavItem, type NavSection } from '@/components/app-shell';
import type { ViewEntry, ViewMenuAction, ViewSwitcher } from '@/components/field-chrome';
import { RequireSession } from '@/components/require-session';
import { ToastHost, useToast } from '@/components/ui/toast';
import { shortOfRung, useLadder } from '@/components/ui/role-badge';
import type { MessagesOf } from '@/i18n/catalogue';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { shellMessages } from '@/i18n/messages/shell';
import { displayName } from '@/lib/display-name';
import { adminNav, fieldNav, isUnder, type FieldDestination } from '@/lib/field-nav';
import { needsKpmHere } from '@/lib/no-kpm';
import { panduanHref } from '@/lib/panduan';
import { profileLine } from '@/lib/profile-line';
import { FAMILY_GATES, type ShellFamily } from '@/lib/route-access';
import { LINK_SIGN_IN_REQUIRED, switchLogin } from '@/lib/account-links';
import { toDisplayError } from '@/lib/api-client';
import { useSession, type Me } from '@/lib/session';
import { useLeaderLimitPending } from '@/lib/use-leader-limit-pending';
import { useSignOut } from '@/lib/use-sign-out';
import { useUnreadCount } from '@/lib/use-unread-count';
import {
  clearCachedReads, isOfficePage, isOfficeView, rememberView, rememberedView, useActiveView, useViewGeneration,
  VIEW_LANDING, type ViewKind,
} from '@/lib/views';

/** *Tambah akun* and the other login's password (P19.2-T1 AC-8), loaded the first time either is opened. */
const AddAccountSheet = dynamic(() => import('@/components/linked-login-sheets').then((m) => m.AddAccountSheet), { ssr: false });
const LinkedSignInSheet = dynamic(
  () => import('@/components/linked-login-sheets').then((m) => m.LinkedSignInSheet),
  { ssr: false },
);

/** The no-office card (UI-166), loaded only for somebody in no office. */
const NoKpmYet = dynamic(() => import('@/components/no-kpm-yet').then((m) => m.NoKpmYet), { ssr: false });

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
 *   office view's groups for an Owner or an Admin (ADR-0198 §2), the Super Admin's bar and groups (UI-127).
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

/** The office's name as the view's entry gives it, *KPM Owner · <nama KPM>* — as the office typed it (ADR-0179 §5). */
function officeNameOf(membership: Me['membership']): string {
  return membership?.office?.branch?.trim() || membership?.office?.code || '';
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
  const { me, reload } = useSession();
  const unread = useUnreadCount();
  const leaderLimitPending = useLeaderLimitPending();
  const { signOut, busy } = useSignOut();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  // The nav's words are kept English (`kept`, the glossary's §A.1); the groups' headings and the pill are the reader's.
  const t = useMessages(shellMessages);
  const [searching, setSearching] = useState(false);
  const membership = me?.membership;

  /*
   * **The view this page is in** (ADR-0198 §4, §5): the tab's, or the page's own — an office page is the office view's.
   * A page that belongs to the office view also sets it, so the field and shared pages opened after it keep it.
   */
  const { kinds, active, switchTo } = useActiveView(me, pathname);
  const officeKind = kinds.find(isOfficeView);
  useEffect(() => {
    if (officeKind && isOfficePage(pathname) && rememberedView() !== officeKind) rememberView(officeKind);
  }, [officeKind, pathname]);
  /** A switch clears the client's cached reads (AC-7): the page under the shell mounts afresh, keyed by it. */
  const generation = useViewGeneration();
  const superAdmin = active === 'super_admin';

  /*
   * **One model for the three menus** (UI V1, UI-004; D-20, ADR-0180): the tab bar, the *Lainnya* sheet and the sidebar
   * are one model's, so the sheet and the sidebar have the same groups, order and members. Who sees what is the role and
   * the view, never the data (ADR-0189 §1) — and the nav decides what is offered, never what is allowed.
   */
  const nav = superAdmin ? adminNav(pathname, t.admin, { leaderLimitPending }) : fieldNav(me, pathname, active, { surveys: t.surveys, branding: t.branding });

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
   * **The sidebar, grouped as the sheet** (UI-004; D-20): a first section with no heading, then the groups, their headings
   * 12px grey in sentence case. A line between every two groups, as before (parity I-144).
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

  /*
   * **Who is signed in, and as what** — the profile line (ADR-0159 §5, P18.5-T6 AC-2) under the name: the rung · Core
   * Leader · the groups · the office in *Akun saya*; *KPM Owner* or *KPM Admin* in its place in the office view, as the
   * console's chip said it; *Superadmin* for the platform. The office's roles kept English (§A.5).
   */
  const name = (me && displayName(me.user)) || (superAdmin ? kept('Super Admin') : t.signedIn);
  const role = superAdmin
    ? kept('Superadmin')
    : !membership
      ? t.noOfficeYet
      : active === 'kpm_owner'
        ? profileLine(kept('KPM Owner'), membership)
        : active === 'kpm_admin'
          ? profileLine(kept('KPM Admin'), membership)
          : profileLine(shortRung, membership);
  const initials = me?.user.initials ?? (superAdmin ? 'SA' : '??');
  const notifications = { href: '/notifications', unread };
  /*
   * ***📘 Panduan*** (P19.6-T5 AC-1, AC-2; ADR-0219 §5): the guide of the view this page is in and the reader's rung,
   * never their data — the sidebar's last item, the account menu's, and *Lainnya*'s. In a view-as session `me` is the
   * member's, so the viewed role's guide opens; after a linked login's switch, that login's.
   */
  const guideHref = panduanHref(me, active);

  /*
   * **A view of the linked login** (P19.2-T1 AC-8; ADR-0199 §4; ADR-0198 §6): the switch changes the session — the API
   * swaps the two cookies and answers the other login's access token — then the new login's `me` is read, every cached
   * read is let go, the view is remembered and the view's landing opened. On a browser that holds no session of the
   * other login the API answers `409`, and its password is asked once (`LinkedSignInSheet`).
   */
  const { show } = useToast();
  const [adding, setAdding] = useState(false);
  const [signingIn, setSigningIn] = useState<ViewKind | null>(null);
  const linked = me?.linkedLogin ?? null;
  const switchToLinked = useCallback(async (kind: ViewKind, password?: string) => {
    if (!linked) return;
    await switchLogin(linked.userId, password);
    await reload();
    clearCachedReads();
    rememberView(kind);
    router.push(VIEW_LANDING[kind]);
  }, [linked, reload, router]);
  const onLinked = useCallback((kind: ViewKind) => {
    switchToLinked(kind).catch((err: unknown) => {
      const shown = toDisplayError(err);
      if (shown.code === LINK_SIGN_IN_REQUIRED) setSigningIn(kind);
      else show(shown.message);
    });
  }, [switchToLinked, show]);

  const views = switcherFor(me, kinds, active, (kind) => router.push(switchTo(kind)), t, {
    onLinked,
    onAddAccount: () => setAdding(true),
  });
  const signOutNow = () => void signOut();

  return (
    <AppShell
      sections={sections}
      user={{
        name,
        role,
        initials,
        email: me?.user.email,
        // The first of the phone's menu details (P18.7-T12 AC-3): the name in full, where the chip greets by the preferred one.
        fullName: me?.user.fullName,
      }}
      // *SUPERADMIN* under the wordmark, as `admin-desktop` draws it in every frame; nobody else's sidebar names an app.
      brandTag={superAdmin ? kept('SUPERADMIN') : undefined}
      // *Advanced analytics* is the one item with no screen yet: *Soon*, as the client wrote it (*Segera hadir*).
      upcomingLabel={t.soon}
      account={{ href: '/profile', onSignOut: signOutNow, signingOut: busy, views }}
      notifications={notifications}
      field={{
        nav,
        notifications,
        // The Super Admin's Overview is their Home: the bell keeps its place on its title row below 1024px (AC-13).
        bellHere: superAdmin && pathname === '/admin',
        // Who read the shared office pages in the console until now keeps its content there (`useFieldContent`).
        consoleContent: superAdmin || Boolean(membership && (membership.isKpmOwner || membership.isKpmAdmin)),
        account: {
          name,
          role,
          initials,
          avatarUrl: me?.user.avatarUrl ?? null,
          profileHref: '/profile',
          onSignOut: signOutNow,
          signingOut: busy,
          views,
          guideHref,
        },
      }}
      // 22px on a tablet on the Owner's, the Admin's and the Super Admin's pages (ADR-0197 §2); 20px elsewhere.
      officeTitle={isUnder(pathname, '/admin') || isOfficePage(pathname)}
      // `/admin` keeps its labelled sidebar from 1024px (UI-127, UI-128); every other view takes the rail to 1279px.
      labelledFrom1024={superAdmin}
      guideHref={guideHref}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      <Fragment key={generation}>
        {/*
          * **A page that needs a KPM, for somebody in none** (P19-T4 AC-4; UI-166; ADR-0189 §5): every Agent item is in
          * the menu, and its page is the no-office card — its title, a greyed *Contoh*, *Cari / Daftar KPM* and *Cari
          * leader* — with the page itself never mounted, so nothing asks the API for an office's data it would refuse.
          */}
        {needsKpmHere(me, pathname)
          ? <NoKpmYet title={[...nav.tabs, ...nav.groups.flatMap((g) => g.items)].find((d) => d.active)?.label} pathname={pathname} />
          : children}
      </Fragment>
      {searching && <AgentSearchDialog onClose={() => setSearching(false)} />}
      {adding && <AddAccountSheet open onClose={() => setAdding(false)} />}
      {signingIn && linked && (
        <LinkedSignInSheet
          open
          email={linked.email}
          onClose={() => setSigningIn(null)}
          onSubmit={async (password) => {
            await switchToLinked(signingIn, password);
            setSigningIn(null);
          }}
        />
      )}
    </AppShell>
  );
}

/** The switcher's order, whichever login is active (ADR-0198 §3): *Akun saya* · the office entry · *Superadmin*. */
const VIEW_ORDER: readonly ViewKind[] = ['self', 'kpm_owner', 'kpm_admin', 'super_admin'];

/**
 * **The view switcher's entries** (P19.2-T1 AC-5, AC-8; UI-169 items 2, 5; ADR-0198 §3, ADR-0199 §3), or nothing for a
 * person with one view and nothing to do after it — who sees no switcher and nothing added to the header.
 *
 * - **Both logins' views, in one order** whichever login is active: *Akun saya* · *KPM Owner · <nama KPM>* (or *KPM Admin
 *   · …*) · *Superadmin* — the reader's own and their linked login's (`GET /auth/me`'s `linkedLogin`), the reader's first
 *   where both have the same kind. Where both logins have a view of the same name (two field logins), each such entry
 *   adds its login's address. A linked login's entry is keyed by its kind and login (`${kind}:${userId}`).
 * - **One tap switches.** One of the reader's own views: the shell remembers it for the tab, clears the cached reads and
 *   goes to the view's landing (`onSwitch`). One of the linked login's: the session changes first (`onLinked`).
 * - ***Tambah akun*** after the views, for whoever is offered it (`account_link:create`: an Owner, an Admin, a Super
 *   Admin), has no link yet and is not in a support session — whose `me` carries neither the grant nor a link.
 *
 * A switcher with an action is drawn even for one view (`hasViewMenu`); the header names a view only for more than one
 * (`namedView`).
 */
function switcherFor(
  me: Me | null,
  kinds: readonly ViewKind[],
  active: ViewKind,
  onSwitch: (kind: ViewKind) => void,
  t: MessagesOf<typeof shellMessages.en>,
  linkedLogin: { onLinked: (kind: ViewKind) => void; onAddAccount: () => void },
): ViewSwitcher | undefined {
  const office = officeNameOf(me?.membership ?? null);
  const withOffice = (role: string, name: string | null) => (name ? `${role} · ${name}` : role);
  const wordsFor = (kind: ViewKind, officeName: string | null): { label: string; short: string } => {
    switch (kind) {
      case 'self': return { label: t.viewSelf, short: t.viewSelf };
      case 'kpm_owner': return { label: withOffice(t.viewKpmOwner, officeName), short: t.viewKpmOwner };
      case 'kpm_admin': return { label: withOffice(t.viewKpmAdmin, officeName), short: t.viewKpmAdmin };
      default: return { label: t.viewSuperAdmin, short: t.viewSuperAdmin };
    }
  };
  // Inside a support session `me` is the member's and carries no link (ADR-0199 §7): their own views alone.
  const linked = me && !me.isImpersonating ? (me.linkedLogin ?? null) : null;

  const own = kinds.map((kind) => ({ kind, officeName: isOfficeView(kind) ? office : null, login: null as null | string }));
  const theirs = (linked?.views ?? []).map((view) => ({ kind: view.kind, officeName: view.officeName, login: linked!.userId }));
  const both = [...own, ...theirs].sort((a, b) => VIEW_ORDER.indexOf(a.kind) - VIEW_ORDER.indexOf(b.kind));
  const twice = (kind: ViewKind) => both.filter((v) => v.kind === kind).length > 1;

  const entries: ViewEntry[] = both.map((view) => {
    const words = wordsFor(view.kind, view.officeName);
    const address = view.login ? linked!.email : me?.user.email;
    return {
      key: view.login ? `${view.kind}:${view.login}` : view.kind,
      kind: view.kind,
      label: twice(view.kind) && address ? `${words.label} · ${address}` : words.label,
      short: words.short,
      active: view.login === null && view.kind === active,
      onSelect: view.login ? () => linkedLogin.onLinked(view.kind) : () => onSwitch(view.kind),
    };
  });

  const actions: ViewMenuAction[] = me && !me.isImpersonating && !linked && me.permissions.includes('account_link:create')
    ? [{ key: 'add-account', label: t.addAccount, onSelect: linkedLogin.onAddAccount }]
    : [];
  if (entries.length < 2 && actions.length === 0) return undefined;
  return { entries, actions };
}
