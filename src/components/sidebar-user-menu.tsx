'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

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
 */
export function SidebarUserMenu({
  user,
  accountHref,
  onSignOut,
  signingOut,
}: {
  user: { name: string; role: string; initials: string; email?: string };
  accountHref: string;
  onSignOut: () => void;
  signingOut?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

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

  const item =
    'block w-full rounded-md px-2 py-1.5 text-left text-md text-white/[0.78] hover:bg-white/[0.06] hover:text-white';

  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="sidebar-user-actions"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-white/[0.06]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber text-base font-bold text-navy">
          {user.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-md font-semibold text-white">{user.name}</span>
          <span className="block truncate text-xs text-white/55">{user.role}</span>
        </span>
        <span aria-hidden className="shrink-0 text-xs text-white/40">
          {open ? '▾' : '▴'}
        </span>
      </button>

      {/*
        After the trigger in the DOM, above it on screen. Tab from the trigger must land
        on the first item — putting the panel first so it reads top-to-bottom visually
        would make Tab skip straight past it, leaving the items reachable only by
        shift-tabbing backwards through a control you have not passed yet.
      */}
      {open && (
        <div
          id="sidebar-user-actions"
          className="absolute bottom-full left-0 right-0 mb-1.5 rounded-md border border-white/10 bg-navy-soft p-1 shadow-modal"
        >
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
