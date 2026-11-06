import { createContext, useContext } from 'react';
import { TitleAvatar, TitleBell, useFieldChrome } from '@/components/field-chrome';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { cn } from '@/lib/cn';

/**
 * **A page's title row, in a module of its own** (the bundle, 2026-11-06; `performance-and-scale.md`). Every page draws
 * it, through `Page` or by itself, so whatever its module imports is in every route's first load. It lived in
 * `app-shell.tsx`, and a page that imported it loaded the sidebar, the bell's popover, the account menu and the surveys'
 * dot as well — none of which a page draws. It imports the title row's own parts (`field-chrome.tsx`) and nothing heavy;
 * `app/first-load.spec.ts` holds it so.
 */

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
