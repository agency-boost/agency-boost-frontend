'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/** What Tab can land on inside the panel. An upcoming nav item is an `<a>` with no href, and is not. */
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
}

/**
 * The identity chip at the foot of the sidebar, and the actions that belong to it.
 *
 * A **disclosure**, not a `role="menu"`. The ARIA menu role promises arrow-key
 * navigation and a roving tabstop; claiming it without implementing them leaves screen
 * reader users pressing keys that do nothing. A button with `aria-expanded` revealing
 * ordinary links and buttons is navigable with Tab, which is what people actually do
 * with two items.
 *
 * It opens upward because it sits at the bottom of the viewport.
 *
 * **Below 768px it is the way round the app** (ADR-0085). The sidebar is a bar across the top there,
 * and its nav is hidden: the prototype's phone shows nothing where the nav was, and no way to sign
 * out (`Overall.html:1421-1428`). So on a phone the shell passes its own nav groups in, and the chip
 * opens them — in their order and with their names — then *Your account* and *Sign out*, in a panel
 * **below** the bar, where it is on the screen. The panel covers the page, so focus moves into it and
 * stays there until it closes: on Escape, which puts focus back on the chip, on a click outside it,
 * or on following any link in it. Nothing new is drawn in the bar.
 */
export function SidebarUserMenu({
  user,
  accountHref,
  onSignOut,
  signingOut,
  className,
  compact,
  nav,
}: {
  user: { name: string; role: string; initials: string; email?: string };
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
  /**
   * The shell's nav, **on a phone only** (ADR-0085): passed below 768px, where the sidebar holds no
   * nav, and never wider, where the panel is the account's alone and opens upward as it always has.
   */
  nav?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const phone = nav !== undefined;

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

  // **On a phone, into the panel.** It covers the page, and focus left on the chip would leave a
  // keyboard reader one Tab from the screen behind it. Wider, the panel is two items under the
  // chip, and Tab from the chip already reaches them, as it always has.
  useEffect(() => {
    if (open && phone) focusables(panel.current)[0]?.focus();
  }, [open, phone]);

  /** On a phone, Tab and Shift+Tab go round the panel rather than out of it. */
  function holdFocus(event: React.KeyboardEvent) {
    if (!phone || event.key !== 'Tab') return;
    // Never empty: *Your account* is always here.
    const items = focusables(panel.current);
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Following any link closes the panel, so it is not left open over the next screen. */
  function closeOnLink(event: React.MouseEvent) {
    if ((event.target as Element).closest('a[href]')) setOpen(false);
  }

  const item =
    'block w-full rounded-md px-2 py-1.5 text-left text-md text-white/[0.78] hover:bg-white/[0.06] hover:text-white';

  return (
    // On a phone the container is not positioned, so the panel hangs from the bar itself, which is
    // `sticky` and therefore the panel's containing block: the bar's full width, just below it.
    <div ref={container} className={cn(!phone && 'relative', className)}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="sidebar-user-actions"
        aria-label={compact ? `${user.name} — ${user.role}` : undefined}
        title={compact ? `${user.name} — ${user.role}` : undefined}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={cn(
          'flex w-full items-center rounded-md py-1.5 text-left hover:bg-white/[0.06]',
          compact ? 'justify-center px-0' : 'gap-2 px-1',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber text-base font-bold text-navy">
          {user.initials}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-md font-semibold text-white">{user.name}</span>
              <span className="block truncate text-xs text-white/55">{user.role}</span>
            </span>
            {/* Which way it opens: down from the bar on a phone, up from the foot of the sidebar wider. */}
            <span aria-hidden className="shrink-0 text-xs text-white/40">
              {open === phone ? '▴' : '▾'}
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
          id="sidebar-user-actions"
          onKeyDown={holdFocus}
          onClick={closeOnLink}
          /*
            * Collapsed, the panel is given its own width and allowed out of the rail: at 56px
            * `right-0` would make *Your account* and *Sign out* a column of one word each.
            *
            * On a phone it drops from the bar across its full width, and scrolls inside itself: eight
            * groups of nav are taller than a phone held upright.
            */
          className={cn(
            'border border-white/10 bg-navy-soft p-1 shadow-modal',
            phone
              ? 'absolute inset-x-0 top-full z-20 max-h-[calc(100dvh-4.5rem)] overflow-y-auto rounded-b-md border-x-0 px-3 pb-3 pt-2'
              : cn('absolute bottom-full mb-1.5 rounded-md', compact ? 'left-0 z-20 w-48' : 'left-0 right-0'),
          )}
        >
          {nav}
          {phone && <div role="separator" className="mx-1 my-2 h-px bg-white/10" />}
          {user.email && (
            <p className="truncate px-2 pb-1.5 pt-1 text-xs text-white/55" title={user.email}>
              {user.email}
            </p>
          )}
          <Link href={accountHref} className={item} onClick={() => setOpen(false)}>
            Your account
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className={cn(item, 'disabled:opacity-50')}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
