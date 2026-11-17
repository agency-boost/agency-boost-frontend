import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FieldChromeContext, type FieldChrome, type ViewSwitcher } from '@/components/field-chrome';
import { TabBar } from '@/components/field-nav';
import { NotificationBell } from '@/components/notification-bell';
import { PageHeader } from '@/components/page-header';
import { SidebarUserMenu } from '@/components/sidebar-user-menu';
import { VerifyEmailBanner } from '@/components/verify-email-banner';
import { KpmLogo, PoweredBy, useBranding, useOfficeName } from '@/components/kpm-brand';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { shellMessages } from '@/i18n/messages/shell';
import { cn } from '@/lib/cn';
import { PANDUAN_GLYPH } from '@/lib/panduan';
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
 * window's edges — the app icon, *Search agent*, the top section, the groups closed but the current page's, *Panduan*
 * and the account card — or the 64px rail in the same style; and `main` is **the page frame**, at most 1320px, centred
 * beside it, 32px each side, so every page stands on the same two edges.
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
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="font-display text-lg font-extrabold tracking-tight text-secondary-contrast">
        {name.slice(0, 6)}
        <span className="text-primary-on-secondary">{name.slice(6)}</span>
      </span>
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
  item, pill, rail, tip = false, sub = false,
}: { item: NavItem; pill: string; rail: boolean; tip?: boolean; sub?: boolean }) {
  /** What the amber check says to a screen reader, after the item's own name (WCAG 2.5.3: the words on screen first). */
  const { doneSuffix } = useMessages(shellMessages);
  // No hover state. There is no `.nav a:hover` rule in any of the fifteen prototype
  // files — resting, active and disabled are the only three. A hover that lightens an
  // inactive item makes it read as nearly-active, which is exactly the confusion the
  // current page's mark exists to avoid.
  /*
   * *Changed 2026-11-12 (P19.13-T2 AC-4; UI-196, ADR-0252):* **the current page is a white pill with navy bold words and
   * an orange glyph** (it was the amber tint): 40px rows rounded 12px in the top section, **36px rows indented under
   * their group's heading, words alone** (`sub`, the approved mockup's `.side a.sub`); 44px squares on the rail. The pill's
   * words are the secondary's ink and its glyph the primary, so a KPM's colours carry it (ADR-0218 §6).
   */
  const className = cn(
    'flex items-center rounded-xl font-medium',
    rail ? 'h-11 w-11 justify-center px-0' : sub ? 'h-9 gap-3 pl-[2.6875rem] pr-3 text-base' : 'h-10 gap-3 px-3 text-md',
    item.active ? 'bg-card font-bold text-secondary-ink' : 'text-secondary-contrast/[0.86]',
    item.upcoming && 'cursor-default text-secondary-contrast/30',
  );
  const body = (
    <>
      {/*
        * The glyph replaces the prototype's dot rather than joining it. Two marks in front of
        * one label is one too many, and the dot said only *active or not* — which the pill
        * behind the row already says, and which an icon can say by colour as well. A group's
        * rows carry no glyph beside their words (UI-196); on the rail every row is its glyph.
        */}
      {(rail || !sub) && (
        <span className={cn('relative shrink-0', item.active ? 'text-primary' : undefined)}>
          <NavIcon name={item.icon} />
          {/*
            * Collapsed, a count has nowhere to sit at the end of a row — so it rides the glyph,
            * as a dot rather than a number. The number is still in the accessible name.
            */}
          {rail && item.badge !== undefined && item.badge > 0 && (
            <span aria-hidden className="absolute -right-1 -top-0.5 h-2 w-2 rounded-pill bg-alert" />
          )}
        </span>
      )}
      {!rail && <span className="min-w-0 truncate">{item.label}</span>}
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
 * ***📘 Panduan*, the sidebar's last item** (P19.6-T5 AC-1; ADR-0219 §5; the guide spec's *Where the menu goes* 1 and 3):
 * below the last group and above the account block, for every role and view, opening the reader's own guide **in a new
 * tab** (`target="_blank" rel="noopener"`), so they keep their place. A nav item's look — no hover, as `NavLink` — with
 * the spec's 📘 for its glyph; on the 64px rail the glyph alone, its name drawn as every rail item's is (`useRailTip`).
 * A plain `<a>`, not `next/link`: it leaves the app for a static file, or opens `/admin/panduan` in a tab of its own.
 */
function GuideItem({ href, rail }: { href: string; rail: boolean }) {
  const t = useMessages(shellMessages);
  const railTip = useRailTip(rail, t.guide);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      data-panduan=""
      // The new tab is in the name, never in the text: a sentence in the text is read as words on the page (P19.6-T5).
      aria-label={`${t.guide}${t.opensInNewTab}`}
      // *Changed 2026-11-12 (P19.13-T2 AC-6; UI-196):* a 40px row as the top section's, above the account card.
      className={cn(
        'mt-1 flex h-10 shrink-0 items-center rounded-xl text-md font-medium text-secondary-contrast/[0.86]',
        rail ? 'w-11 select-none justify-center px-0 [-webkit-touch-callout:none]' : 'gap-3 px-3',
      )}
      {...railTip.handlers}
    >
      <span aria-hidden="true" className="w-[18px] shrink-0 text-center text-base leading-none">{PANDUAN_GLYPH}</span>
      {!rail && t.guide}
      {railTip.tip}
    </a>
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

/** What the identity chip opens: the account, signing out, and for a person with more than one view the switcher. */
export interface AppShellAccount {
  href: string;
  onSignOut: () => void;
  signingOut?: boolean;
  /**
   * **The view switcher** (P19.2-T1 AC-5; ADR-0198 §3), above *Your account*; absent for one view. It replaced ADR-0114's
   * link to the other view.
   */
  views?: ViewSwitcher;
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
  guideHref,
}: {
  rail: boolean;
  user: ShellUser;
  account?: AppShellAccount;
  notifications?: { href: string; unread: number };
  /** *📘 Panduan* in the account menu, between *Your account* and *Sign out* (P19.6-T5 AC-1). */
  guideHref?: string;
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
      views={account.views}
      className={rail ? undefined : 'min-w-0 flex-1'}
      compact={rail}
      languageSwitch
      guideHref={guideHref}
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

/** The groups the reader opened by hand, remembered for the tab's session (P19.13-T2 AC-5): a JSON list of headings. */
const OPEN_GROUPS_KEY = 'ab.sidebar.open';

/**
 * The nav's groups, each a heading that opens and closes it and the items beneath — rendered by the
 * sidebar, and on a phone by the drawer the bar's ☰ opens (P18.7-T2), so the two cannot differ in order,
 * names or state.
 */
function NavGroups({
  sections,
  rail,
  isOpen,
  onToggle,
  pill,
  railTips = false,
}: {
  sections: readonly NavSection[];
  rail: boolean;
  /** Whether a headed group is open (P19.13-T2 AC-5): the current page's, and any the reader opened this session. */
  isOpen: (label: string) => boolean;
  onToggle: (label: string) => void;
  pill: string;
  /** **The field rail's drawn names** (P19.1-T1 AC-4, `useRailTip`): on hover, focus and a long press. */
  railTips?: boolean;
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
        const open = !collapsible || isOpen(section.label ?? '');

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
              <div className="mt-0.5">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`nav-group-${sectionIndex}`}
                  onClick={() => onToggle(section.label ?? '')}
                  /*
                   * **Readable, not decorative.** It was `text-2xs` at 40% white — 10px of
                   * uppercase at that contrast is a smudge, and this is the control that
                   * decides what the whole menu shows. Sentence case (UI V1, UI-004; D-20).
                   *
                   * *Changed 2026-11-12 (P19.13-T2 AC-5; UI-196):* **a 36px heading row, 13px**, at 65% white while
                   * closed and white while open, its ▸ turning to ▾ — the approved mockup's `.side .gh`.
                   */
                  className={cn(
                    'flex h-9 w-full items-center gap-2 rounded-xl px-3 text-base font-semibold hover:bg-secondary-contrast/[0.06] hover:text-secondary-contrast',
                    open ? 'text-secondary-contrast' : 'text-secondary-contrast/65',
                  )}
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
                className={cn('flex flex-col', rail ? 'mb-1.5 items-center gap-px' : 'gap-0')}
              >
                {section.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} pill={pill} rail={rail} tip={railTips} sub={Boolean(section.label) && !rail} />
                  </li>
                ))}
              </ul>
            )}
            {/* A `separator`, so the rule between groups is a thing a test and a screen reader can
                both find, rather than a styled `div` only the eye can (parity I-144). Since P19.13-T2
                (UI-196) one, under the top section: the closed headings are the groups' edges. */}
            {section.divider && <div role="separator" className="mx-1.5 my-2 h-px bg-secondary-contrast/[0.08]" />}
          </div>
        );
      })}
    </>
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
  guideHref,
  search,
  children,
}: {
  sections: readonly NavSection[];
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
   * ***📘 Panduan*** (P19.6-T5 AC-1, AC-2; ADR-0219 §5): the reader's own guide, by view and role (`panduanHref`) — the
   * sidebar's last item and the account menu's, each opening it in a new tab. Omitted outside a session: nothing drawn.
   */
  guideHref?: string;
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
  children: React.ReactNode;
}) {
  const t = useMessages(shellMessages);
  const pill = upcomingLabel ?? t.upcoming;
  // P19.6-T1 (ADR-0218 §2, §11): the session's KPM's logo and *Powered by*; `null` draws the shell as before.
  const branding = useBranding();
  const officeName = useOfficeName();
  /**
   * **Only the group holding the current page is open; a heading opens its own, and a group the reader opened stays
   * open for the session** (P19.13-T2 AC-5; UI-196, ADR-0252 §4).
   *
   * *Changed 2026-11-12 — it reversed P10.1-T3's* every group open by default (the client's request of 2026-09-29, ADR-0062's
   * own example): the owner's later request of 9 November wins (ADR-0062 §1). All open, the Owner's office menu was
   * 1,634px in a 797px column.
   *
   * - **The current page's group** (`activeGroup`) is open, and closes when the reader closes it, until the route moves
   *   to another group — `activeGroup` in the effect's list is what clears that.
   * - **A group the reader opened** is remembered for the tab's session (`sessionStorage`, `OPEN_GROUPS_KEY`), across
   *   pages and a reload; closing it forgets it. The server and the first client render both draw the current page's
   *   group alone, so they agree. **Read after the paint, and only when something is kept**, as `compact` is: a state
   *   change in a layout effect re-renders the page under the shell inside the commit, and a page reading its route's
   *   params through `use()` suspends there and never comes back (the unit below the reader's did).
   */
  const activeGroup = sections.find((s) => s.items.some((i) => i.active))?.label ?? null;
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const [activeShut, setActiveShut] = useState(false);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(OPEN_GROUPS_KEY) ?? '[]') as unknown;
      const names = Array.isArray(stored) ? stored.filter((x): x is string => typeof x === 'string') : [];
      if (names.length > 0) setOpened(new Set(names));
    } catch {
      // Storage refused or unreadable: the current page's group alone, as on a first visit.
    }
  }, []);
  useEffect(() => setActiveShut(false), [activeGroup]);
  const isOpen = (label: string) => (label === activeGroup && !activeShut) || opened.has(label);
  const toggleGroup = (label: string) => {
    const wasOpen = isOpen(label);
    if (label === activeGroup) setActiveShut(wasOpen);
    const next = new Set(opened);
    if (wasOpen) next.delete(label);
    else next.add(label);
    setOpened(next);
    try {
      window.sessionStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify([...next]));
    } catch {
      // Not remembered past this page; the heading still opens.
    }
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

  const groups = (
    <NavGroups
      sections={sections}
      rail={rail}
      isOpen={isOpen}
      onToggle={toggleGroup}
      pill={pill}
      railTips
    />
  );

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
            * **The nav never scrolls on its own** (P19.13-T2 AC-7; UI-196): with one group open it fits the panel at 1280 ×
            * 800 and 1440 × 900. Where a long group is open on a short window it scrolls inside the panel, rather than
            * leaving an item out of reach, while *Panduan* and the account card stay in sight below it.
            */}
          <nav
            id="sidebar-nav"
            className={cn('min-h-0 flex-1 overflow-y-auto', search ? undefined : 'mt-4', rail && 'w-full')}
            aria-label={t.mainNav}
          >
            {groups}
          </nav>

          {/* P19.6-T5 AC-1: *📘 Panduan*, below the last group and above the account block, for every role. */}
          {guideHref && <GuideItem href={guideHref} rail={rail} />}

          <SidebarFoot
            rail={rail}
            user={user}
            account={account}
            notifications={notifications}
            guideHref={guideHref}
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
