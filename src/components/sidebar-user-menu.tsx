'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ViewMenu, hasViewMenu, type ViewSwitcher } from '@/components/field-nav';
import { LanguageSwitch } from '@/components/language-switch';
import { useMessages } from '@/i18n/language-provider';
import { shellMessages } from '@/i18n/messages/shell';
import { cn } from '@/lib/cn';
import { PANDUAN_GLYPH } from '@/lib/panduan';

/** The initials' circle: the chip's and the rail's alike. */
const AVATAR = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-contrast';

/**
 * The identity chip at the foot of the sidebar, and the actions that belong to it.
 *
 * A **disclosure**, not a `role="menu"`. The ARIA menu role promises arrow-key
 * navigation and a roving tabstop; claiming it without implementing them leaves screen
 * reader users pressing keys that do nothing. A button with `aria-expanded` revealing
 * ordinary links and buttons is navigable with Tab, which is what people actually do
 * with two items, or a few more for a person with more than one view.
 *
 * It opens upward because it sits at the bottom of the viewport.
 *
 * **It holds the account's items alone** (P18.7-T2 AC-4, ADR-0167 §3): the email, *ID | EN*, for a person with more
 * than one view **the view switcher** (P19.2-T1 AC-5; ADR-0198 §3 — it replaced ADR-0114's link to the other view), then
 * *Your account* and *Sign out* — and between those two, since P19.6-T5, ***📘 Panduan*** (ADR-0219 §5).
 *
 * *Changed 2026-11-05 (P19.2-T1; ADR-0197):* the sidebar is a desktop's alone for every role, so there is no phone's bar
 * for the chip to hang from (ADR-0085; P18.7-T12's avatar with the notices): below 1024px the title row's avatar and the
 * *Lainnya* sheet are the account.
 */
export function SidebarUserMenu({
  user,
  accountHref,
  onSignOut,
  signingOut,
  className,
  compact,
  panelId = 'sidebar-user-actions',
  views,
  languageSwitch = false,
  guideHref,
}: {
  user: { name: string; role: string; initials: string; email?: string; fullName?: string };
  accountHref: string;
  onSignOut: () => void;
  signingOut?: boolean;
  /**
   * How the chip sits in the row beside it. The shell passes `min-w-0 flex-1` so the chip
   * takes the space and the notification bell stays pinned to the right, whatever the name
   * in it is.
   */
  className?: string;
  /**
   * The avatar alone, for the 56px rail.
   *
   * **The name and the role go, they do not shrink.** Truncated to a few characters they say
   * nothing and take the width the avatar needs; the avatar is already the thing a reader
   * recognises, and it carries the initials. The name moves into the trigger's accessible
   * name instead, so what is announced does not change with the width.
   */
  compact?: boolean;
  /** The panel's id, for the trigger's `aria-controls`: one id names one element. */
  panelId?: string;
  /**
   * **The view switcher** (P19.2-T1 AC-5; UI-169 item 2; ADR-0198 §3): for a person with more than one view, the views
   * — the active one ticked, one tap switching — above *Your account*, then what comes after them (*Tambah akun*, AC-8).
   * Omitted for everyone else, who has one view and sees nothing of it.
   */
  views?: ViewSwitcher;
  /**
   * **The *ID | EN* switch, in the panel** (P19.1-T1 AC-1, ADR-0196; UI-112, UI-129, D-20: *no ID | EN on pages — the
   * account menu*): the account from 1024px, under who is signed in, for every role since P19.2-T1. Choosing keeps the
   * panel open, so the reader sees the menu change language.
   */
  languageSwitch?: boolean;
  /**
   * ***📘 Panduan*** (P19.6-T5 AC-1; ADR-0219 §5; the guide spec's *Where the menu goes* 2): the reader's own guide,
   * between *Your account* and *Sign out*, opened in a new tab. Omitted, nothing is drawn.
   */
  guideHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const t = useMessages(shellMessages);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // Focus goes back where it came from; leaving it on a removed node drops the
      // keyboard user at the top of the document.
      trigger.current?.focus();
    }
    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    // Capture, so a click that also navigates still closes the menu first.
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown, true);
    };
  }, [open]);

  /** Following any link closes the panel, so it is not left open over the next screen. */
  function closeOnLink(event: React.MouseEvent) {
    if ((event.target as Element).closest('a[href]')) setOpen(false);
  }

  const row =
    'block w-full rounded-md px-2 py-1.5 text-left text-md text-secondary-contrast/[0.78] hover:bg-secondary-contrast/[0.06] hover:text-secondary-contrast';

  return (
    <div ref={container} className={cn('relative', className)}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={compact ? `${user.name} — ${user.role}` : undefined}
        title={compact ? `${user.name} — ${user.role}` : undefined}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={cn(
          'flex w-full items-center rounded-md py-1.5 text-left hover:bg-secondary-contrast/[0.06]',
          compact ? 'justify-center px-0' : 'gap-2 px-1',
        )}
      >
        <span className={AVATAR}>
          {user.initials}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-md font-semibold text-secondary-contrast">{user.name}</span>
              {/* The profile line (ADR-0159 §5): one line, truncated, the whole of it on hover. */}
              <span className="block truncate text-xs text-secondary-contrast/55" title={user.role}>{user.role}</span>
            </span>
            {/* Which way it opens: up, from the foot of the sidebar. */}
            <span aria-hidden className="shrink-0 text-xs text-secondary-contrast/40">
              {open ? '▾' : '▴'}
            </span>
          </>
        )}
      </button>

      {/*
        After the trigger in the DOM, above it on screen. Tab from the trigger must land
        on the first item — putting the panel first so it reads top-to-bottom visually
        would make Tab skip straight past it, leaving the items reachable only by
        shift-tabbing backwards through a control you have not passed yet.
      */}
      {open && (
        <div
          ref={panel}
          id={panelId}
          data-account-panel=""
          onClick={closeOnLink}
          /*
            * Collapsed, the panel is given its own width and allowed out of the rail: at 64px
            * `right-0` would make *Your account* and *Sign out* a column of one word each.
            */
          className={cn(
            'border border-secondary-contrast/10 bg-secondary-hover p-1 shadow-modal',
            cn('absolute bottom-full mb-1.5 rounded-md', compact ? 'left-0 z-20 w-48' : 'left-0 right-0'),
          )}
        >
          {user.email && (
            <p className="truncate px-2 pb-1.5 pt-1 text-xs text-secondary-contrast/55" title={user.email}>
              {user.email}
            </p>
          )}
          {languageSwitch && (
            <div data-account-language="" className="px-2 pb-1.5 pt-0.5">
              <LanguageSwitch tone="bar" />
            </div>
          )}
          {hasViewMenu(views) && (
            /*
              * **The views** (P19.2-T1 AC-5; ADR-0198 §3): the same list the title row's avatar opens (`ViewMenu`), in the
              * sidebar's navy, above the account's own two; choosing one closes the panel and the shell switches.
              */
            <div data-account-views="" className="mb-1 border-b border-secondary-contrast/10 pb-1">
              <ViewMenu views={views} tone="navy" onChosen={() => setOpen(false)} />
            </div>
          )}
          <Link href={accountHref} className={row} onClick={() => setOpen(false)}>
            {t.yourAccount}
          </Link>
          {guideHref && (
            <a
              href={guideHref}
              target="_blank"
              rel="noopener"
              data-panduan=""
              aria-label={`${t.guide}${t.opensInNewTab}`}
              className={cn(row, 'flex items-center gap-2')}
            >
              <span aria-hidden="true" className="w-[18px] shrink-0 text-center leading-none">{PANDUAN_GLYPH}</span>
              {t.guide}
            </a>
          )}
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className={cn(row, 'disabled:opacity-50')}
          >
            {signingOut ? t.signingOut : t.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
