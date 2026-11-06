import Link from 'next/link';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FieldChromeContext, TabBar, TitleAvatar, TitleBell, useFieldChrome, type FieldChrome, type ViewSwitcher,
} from '@/components/field-nav';
import { NotificationBell } from '@/components/notification-bell';
import { SidebarUserMenu } from '@/components/sidebar-user-menu';
import { VerifyEmailBanner } from '@/components/verify-email-banner';
import { KpmLogo, PoweredBy, useBranding, useOfficeName } from '@/components/kpm-brand';
import { NavIcon, type NavIconName } from '@/components/ui/nav-icon';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
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

/**
 * The wordmark, and the amber line under it naming which app this is — the sidebar's and the phone's drawer's.
 * The product's name is kept English (§A.5); the shells' other words are `shellMessages` (P18.10-T1).
 */
function Wordmark({ brandTag, className }: { brandTag?: string; className?: string }) {
  return (
    <span className={cn('font-display text-lg font-extrabold leading-tight tracking-tight text-secondary-contrast', className)}>
      {kept('AgencyBoost')}
      {brandTag && (
        <span className="block text-2xs font-semibold uppercase tracking-wide text-primary-on-secondary">
          {brandTag}
        </span>
      )}
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

function NavLink({ item, pill, rail, tip = false }: { item: NavItem; pill: string; rail: boolean; tip?: boolean }) {
  /** What the amber check says to a screen reader, after the item's own name (WCAG 2.5.3: the words on screen first). */
  const { doneSuffix } = useMessages(shellMessages);
  // No hover state. There is no `.nav a:hover` rule in any of the fifteen prototype
  // files — resting, active and disabled are the only three. A hover that lightens an
  // inactive item makes it read as nearly-active, which is exactly the confusion the
  // amber tint plus amber dot exist to avoid.
  const className = cn(
    'flex items-center rounded-md py-1.5 text-md font-medium',
    rail ? 'justify-center px-0' : 'gap-2.5 px-2',
    item.active ? 'bg-primary/15 font-semibold text-secondary-contrast' : 'text-secondary-contrast/[0.78]',
    item.upcoming && 'cursor-default text-secondary-contrast/30',
  );
  const body = (
    <>
      {/*
        * The glyph replaces the prototype's dot rather than joining it. Two marks in front of
        * one label is one too many, and the dot said only *active or not* — which the amber
        * tint behind the row already says, and which an icon can say by colour as well.
        */}
      <span className={cn('relative shrink-0', item.active ? 'text-primary-on-secondary' : undefined)}>
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
      className={cn(
        'mb-2 hidden items-center rounded-md py-1.5 text-md font-medium text-secondary-contrast/[0.78] md:flex',
        rail ? 'select-none justify-center px-0 [-webkit-touch-callout:none]' : 'gap-2.5 px-2',
      )}
      {...railTip.handlers}
    >
      <span aria-hidden="true" className="w-[18px] shrink-0 text-center text-base leading-none">{PANDUAN_GLYPH}</span>
      {!rail && t.guide}
      {railTip.tip}
    </a>
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
  control,
  subtitleOnPhone,
  subtitleOnTablet,
  bell = false,
  keepSubtitle = false,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * **The title row's control below 1024px** (UI V1, UI-004: *page title, then the page's main control, then the 36px
   * avatar*): the period pill on `/unit/dashboard`, *Cari agen* on `/group-tree`, *+ Tambah agent* on `/new-hires`. Below
   * 1024px it stands in for `actions`, which then show from 1024px only; absent, `actions` are the row's control at
   * every width, as they always were.
   */
  control?: React.ReactNode;
  /**
   * `false`: **the sub-line is not drawn below 768px** — the client's *Remove* verdict on a page's sub-line (P18.7-T7
   * AC-1, row 25 of the review's *Grey text* table; ADR-0167 §7). At 768px and wider it reads as before. Absent, the
   * page that renders the shell said so through `SubtitleOnPhone` — a shell draws this header, not the page.
   */
  subtitleOnPhone?: boolean;
  /**
   * `false`: **not drawn from 768 to 1023px either** (UI V1, UI-004: *subtitle hidden on Mobile + Tablet* — `/goals`,
   * `/training`, `/group-tree`, `/user-management/*`). Pass it with `subtitleOnPhone={false}`; from 1024px it reads.
   */
  subtitleOnTablet?: boolean;
  /** **The bell, left of the avatar — on Home alone** (UI-004, the owner, 30 Oct). Below 1024px; the sidebar has its own. */
  bell?: boolean;
  /**
   * **A sub-line that prevents a mistake** (UI-112: *no subtitle unless it prevents a mistake*): drawn at 768px and wider
   * in the field shell, where every other sub-line is not (P19.1-T1 AC-1). A record's state — a new hire's activation
   * *closed on …* — not a description of the page. Its phone rule is `subtitleOnPhone`'s, as before.
   */
  keepSubtitle?: boolean;
}) {
  const fromPage = useContext(SubtitleOnPhone);
  const onPhone = subtitleOnPhone ?? fromPage;
  const field = useFieldChrome();
  /*
   * **The field shell's title row** (UI V1, UI-004, UI-008): 20px/800 on a phone, 24px on a desktop (`text-title`), navy.
   * *Changed 2026-11-04 (P19.1-T1 AC-1, ADR-0196; UI-112):* **20px on a tablet**, the phone's (it was 22px; `globals.css`),
   * and **800 on a desktop** too (it was 700 there).
   * *Changed 2026-11-05 (P19.2-T1 AC-1; UI-146, ADR-0197 §2):* **every role's** — the consoles' 28px went with them — and
   * **22px on a tablet on `/admin`, `/kpm` and `/people`**, which the shell's frame says (`data-title-size`, `globals.css`),
   * so this stays the one class. The other branch is a header drawn outside a shell (a spec's).
   */
  const titleClass = field
    ? 'text-title font-extrabold text-navy'
    : 'text-3xl font-bold text-navy max-md:text-title max-md:font-extrabold';
  /*
   * *Changed 2026-11-04 (P19.1-T1 AC-1; UI-112, Conflicts row 150):* **in the field shell no grey sub-line at 768px and
   * wider**, unless it prevents a mistake (`keepSubtitle`). Below 768px each page's own rule, as before: the phone is
   * out of UI-112's scope.
   */
  const heading = (
    <div className={cn(field && 'min-w-0 max-lg:flex-1')}>
      <h1 className={cn('font-display', titleClass)}>{title}</h1>
      {subtitle && (
        <p
          className={cn(
            'mt-1 text-md text-muted',
            !onPhone && REMOVED_ON_PHONE,
            subtitleOnTablet === false && 'md:max-lg:hidden',
            field && !keepSubtitle && 'md:hidden',
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
  /*
   * Below 1024px in the field shell `control` takes `actions`' place in the row; from 1024px `actions` are as before. With
   * no `control`, `actions` are the row's at every width.
   */
  const rowControl = field && control !== undefined
    ? <>{control !== null && <div className="shrink-0 lg:hidden">{control}</div>}{actions && <div className="max-lg:hidden">{actions}</div>}</>
    : actions;

  if (field) {
    /*
     * **One row: the title, the page's control, then — below 1024px — Home's bell, and the avatar** (UI-004). 44px tall at
     * least, top-aligned on a desktop as every header is (P10.1-T8) and centred below it, 12px above the content.
     *
     * *Changed 2026-11-04 (P19.1-T1 AC-1, ADR-0196; UI-112: one title-row component at every size, the avatar on the
     * right):* **the avatar at every size**, to *Profil saya* as on a phone — it was below 1024px only. The sidebar's foot
     * keeps the account menu and the bell from 1024px, where *ID | EN* now is; no page header carries the switch.
     */
    return (
      <div className="mb-5 flex items-start gap-4 max-lg:mb-3 max-lg:min-h-11 max-lg:items-center max-lg:gap-2" data-title-row="">
        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-4 max-lg:items-center max-lg:gap-2">
          {heading}
          {rowControl}
        </div>
        {field.compact && (bell || field.bellHere) && <TitleBell chrome={field} />}
        <TitleAvatar chrome={field} />
      </div>
    );
  }
  /*
   * **Outside a shell** — a spec rendering a header alone. Every signed-in page is in the one shell since P19.2-T1, and
   * no page header carries *ID | EN* (ADR-0197 §5): the switch is the account menu's.
   */
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      {heading}
      {actions}
    </div>
  );
}

/**
 * **Whether a page's own heading block carries the *ID | EN* switch: never, since P19.2-T1** (UI-129; ADR-0197 §5). It
 * was the page header's from 768px in the two consoles (P18.10-T2 AC-3) and from 1024px in the field shell until
 * P19.1-T1; the switch lives only in the account menu now — *Lainnya*'s account row below 1024px, the sidebar's account
 * menu from there, and *Profil saya*. Kept, answering `false`, for the pages that still ask (Billing, a coachee's header,
 * a training module), so each can drop the call with its own change.
 */
export function usePageLanguageSwitch(): boolean {
  return false;
}

/** **The switch at a page header's corner: nothing, since P19.2-T1** (UI-129; ADR-0197 §5). See `usePageLanguageSwitch`. */
export function PageLanguageSwitch(_props: { className?: string }) {
  return null;
}

/**
 * **Whether a page's sub-line shows on a phone, said by a page whose shell draws its header** (`RoleShell`, which
 * takes a title and a sub-line and hands them through a shell to `PageHeader`): `/notifications` wraps its shell in
 * `false`, so the client's *Remove* reaches the header without every shell carrying one more prop (P18.7-T7 AC-1).
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
   * From 768px it is the sidebar's foot, which must not shrink under a long nav; the classes below 768px stayed from the
   * phone's bar, where nothing draws the sidebar any more, so the foot is drawn as it always was from 1024px.
   */
  return (
    <div
      className={cn(
        'ml-auto flex min-w-0 shrink items-center gap-1 md:ml-0 md:shrink-0 md:border-t md:border-secondary-contrast/10 md:pt-3',
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

/**
 * The nav's groups, each a heading that opens and closes it and the items beneath — rendered by the
 * sidebar, and on a phone by the drawer the bar's ☰ opens (P18.7-T2), so the two cannot differ in order,
 * names or state.
 */
function NavGroups({
  sections,
  rail,
  closed,
  onToggle,
  pill,
  sentenceCase = false,
  railTips = false,
}: {
  sections: readonly NavSection[];
  rail: boolean;
  closed: ReadonlySet<string>;
  onToggle: (label: string) => void;
  pill: string;
  /**
   * **The headings: 12px grey, sentence case** (UI V1, UI-004; D-20: *Old "UNIT TOOLS" etc. go away*) — the *Lainnya*
   * sheet's groups, as the sheet writes them; every role's since P19.2-T1 (UI-146: *no sidebar heading is uppercase*).
   */
  sentenceCase?: boolean;
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
                  className={sentenceCase
                    ? 'flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-xs font-semibold text-secondary-contrast/65 hover:bg-secondary-contrast/[0.06] hover:text-secondary-contrast'
                    : 'flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-secondary-contrast/65 hover:bg-secondary-contrast/[0.06] hover:text-secondary-contrast'}
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
                    <NavLink item={item} pill={pill} rail={rail} tip={railTips} />
                  </li>
                ))}
              </ul>
            )}
            {/* A `separator`, so the rule between groups is a thing a test and a screen reader can
                both find, rather than a styled `div` only the eye can (parity I-144). */}
            {section.divider && <div role="separator" className="mx-1 my-2 h-px bg-secondary-contrast/10" />}
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
      closed={closed}
      onToggle={toggleGroup}
      pill={pill}
      sentenceCase
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
          className={cn(
            // `print:hidden`: a printed page is the page, not the app around it (`Overall.html:1022`, ADR-0061).
            // Its navy runs up under the clock and its content starts below it: the top inset is added to its 14px (20px as
            // the sidebar), so a Home Screen app's status bar never sits over the brand (staging review, 2026-10-31).
            'sticky top-0 z-10 flex w-full shrink-0 flex-row items-center bg-secondary px-4 pb-3.5 pt-[calc(0.875rem+env(safe-area-inset-top))] text-sidebar-text print:hidden '
              + 'md:h-screen md:flex-col md:items-stretch md:pb-5 md:pt-[calc(1.25rem+env(safe-area-inset-top))]',
            // A desktop's alone: below 1024px the pages' title rows and the tab bar stand in (UI-004).
            'max-lg:hidden',
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
              'flex items-center gap-2 px-1 md:mb-3 md:border-b md:border-secondary-contrast/10 md:pb-4',
              rail && 'md:flex-col md:gap-2 md:px-0',
            )}
          >
            {/*
              * **The KPM's logo in place of AgencyBoost's mark and wordmark** (P19.6-T1 AC-3, AC-4; ADR-0218 §2): the wide
              * logo in the sidebar, the square one (or the wide one centred) in the rail. Without one, as before.
              */}
            {branding?.logo ? (
              <KpmLogo branding={branding} rail={rail} name={officeName} />
            ) : (
              <>
                <BrandMark />
                {/* The wordmark goes, the mark stays: it is the thing that says which product this
                    is, and the rail has room for exactly one of them. */}
                <Wordmark brandTag={brandTag} className={cn(rail && 'md:hidden') || undefined} />
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
                'hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-secondary-contrast/[0.55] hover:bg-secondary-contrast/[0.06] hover:text-secondary-contrast md:flex',
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

          <nav id="sidebar-nav" className="hidden min-h-0 flex-1 overflow-y-auto pr-0.5 md:block" aria-label={t.mainNav}>
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
           * 16px, whichever is more: a desktop keeps its 32px. `lg:px-10` is what `/leads`' list and detail are measured
           * against (`SPLIT.gutter`, `leads-list.tsx`): change one, change both.
           */
          'px-4 pb-[calc(var(--tab-bar-space)+1.5rem)] pt-[calc(1rem+env(safe-area-inset-top))] md:px-6 '
            + 'lg:px-10 lg:pb-14 lg:pt-[max(2rem,calc(1rem+env(safe-area-inset-top)))]',
        )}
      >
        <FieldChromeContext.Provider value={{ ...field, compact }}>
          {/* P19-T1 AC-4 (UI-163, ADR-0190 §4): *Verifikasi email Anda · Kirim ulang* until the address is verified. */}
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
