'use client';

import Link from 'next/link';
import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { FieldAvatar, MORE_SHEET_ID, type FieldChrome } from '@/components/field-nav';
import { LanguageSwitch } from '@/components/language-switch';
import { NavIcon } from '@/components/ui/nav-icon';
import { useMessages } from '@/i18n/language-provider';
import { shellMessages } from '@/i18n/messages/shell';
import { cn } from '@/lib/cn';
import type { FieldDestination } from '@/lib/field-nav';
import { useScrollLock } from '@/lib/use-scroll-lock';

/** What Tab can land on inside the sheet. A *Segera hadir* tile is no link, and is not. */
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** How far a finger drags the sheet's head down before letting go closes it. */
const SWIPE_CLOSE_PX = 72;

/**
 * **The *Lainnya* sheet** (UI V1, UI-004; D-20): a bottom sheet over the page, below 1024px, from the tab bar's fifth tab.
 *
 * - **Its head**: a drag handle and ✕; swiping the head down, tapping the backdrop, Escape and ✕ close it, and focus
 *   goes back to *Lainnya*. It scrolls inside when it is taller than the screen (`88dvh`), clear of the home indicator.
 * - **The account row**: the avatar with *Ubah foto* (to *Profil saya*), the name, the profile line, and the **ID | EN
 *   switch** — on a phone and a tablet the switch is here and in *Profil saya*, nowhere else (ADR-0180; it was the
 *   bar's, then the page header's, I-533).
 * - **The groups**, each a 12px grey heading and a 4-column grid of tiles — a 40px soft icon tile over a 12px label of at
 *   most two lines, the whole tile the target — in the order and with the members `fieldNav` gives: what the reader may
 *   open today, and a group with nothing in it left out. *Advanced analytics* is greyed with *Segera hadir* and opens
 *   nothing.
 * - **For an Owner or an Admin in their field view, *Open Owner view*** (ADR-0114), then **Keluar**, last, in red.
 *
 * A modal dialog named *Lainnya*, drawn at the end of `<body>` so nothing on the page stands over it; the page behind
 * holds still (`useScrollLock`). Following any link in it closes it.
 */
export function MoreSheet({
  chrome,
  onClose,
  returnTo,
}: {
  chrome: FieldChrome;
  onClose: () => void;
  returnTo: RefObject<HTMLButtonElement | null>;
}) {
  const t = useMessages(shellMessages);
  const box = useRef<HTMLDivElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const dragFrom = useRef<number | null>(null);
  const { account, nav } = chrome;

  useScrollLock(true);

  useEffect(() => {
    closer.current?.focus();
    const back = returnTo.current;
    return () => {
      back?.focus();
    };
  }, [returnTo]);

  function keys(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !box.current) return;
    // Never empty: ✕ is always here.
    const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE));
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

  /** Following any link closes the sheet, so it is not left open over the next screen. */
  function closeOnLink(event: React.MouseEvent) {
    if ((event.target as Element).closest('a[href]')) onClose();
  }

  const head = {
    onTouchStart: (event: React.TouchEvent) => {
      dragFrom.current = event.touches[0]?.clientY ?? null;
    },
    onTouchEnd: (event: React.TouchEvent) => {
      const from = dragFrom.current;
      dragFrom.current = null;
      const to = event.changedTouches[0]?.clientY;
      if (from !== null && to !== undefined && to - from > SWIPE_CLOSE_PX) onClose();
    },
  };

  return createPortal(
    <>
      <div aria-hidden="true" data-scrim="" className="fixed inset-0 z-50 bg-ink/40 print:hidden lg:hidden" onClick={onClose} />
      <div
        ref={box}
        id={MORE_SHEET_ID}
        role="dialog"
        aria-modal="true"
        aria-label={t.more}
        onKeyDown={keys}
        onClick={closeOnLink}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-[22px] bg-card',
          'px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 shadow-modal print:hidden lg:hidden',
        )}
      >
        <div {...head} data-sheet-head="" className="touch-none">
          <div aria-hidden="true" className="mx-auto mb-2.5 h-[5px] w-10 rounded-pill bg-line" />
          <div className="flex items-center gap-2.5 rounded-row bg-hover-row py-2 pl-2 pr-1">
            <Link
              href={account.profileHref}
              data-change-photo=""
              className="flex min-h-11 w-[52px] shrink-0 flex-col items-center gap-0.5 text-center"
            >
              <FieldAvatar account={account} className="h-10 w-10 text-base" />
              <span className="text-xs font-semibold leading-tight text-navy">{t.changePhoto}</span>
            </Link>
            <span className="min-w-0 flex-1 leading-snug">
              <b className="block truncate text-md font-bold text-ink">{account.name}</b>
              <span className="block truncate text-xs text-muted" title={account.role}>{account.role}</span>
            </span>
            <LanguageSwitch tone="page" />
            <button
              ref={closer}
              type="button"
              onClick={onClose}
              aria-label={t.closeSheet}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-pill-grey-ink hover:bg-pill-grey"
            >
              <NavIcon name="close" className="h-5 w-5" />
            </button>
          </div>
        </div>

        {nav.groups.map((group) => (
          <section key={group.id} aria-labelledby={`more-group-${group.id}`} data-more-group={group.id}>
            <h2 id={`more-group-${group.id}`} className="mb-2 mt-3.5 text-xs font-semibold text-muted">
              {t.fieldGroups[group.id]}
            </h2>
            <ul className="grid grid-cols-4 gap-2">
              {group.items.map((item) => (
                <li key={item.id}><Tile item={item} soon={t.soon} doneSuffix={t.doneSuffix} /></li>
              ))}
            </ul>
          </section>
        ))}

        {account.viewSwitch && (
          <Link
            href={account.viewSwitch.href}
            className="mt-4 flex min-h-11 items-center gap-2 border-t border-divider px-1 pt-3 text-md font-semibold text-navy"
          >
            {account.viewSwitch.label}
          </Link>
        )}
        <button
          type="button"
          onClick={account.onSignOut}
          disabled={account.signingOut}
          aria-busy={account.signingOut || undefined}
          className={cn(
            'flex min-h-11 w-full items-center gap-2 border-t border-divider px-1 pt-3 text-md font-semibold text-pill-red-ink',
            account.viewSwitch ? 'mt-1' : 'mt-4',
            'disabled:opacity-60',
          )}
        >
          <NavIcon name="logout" className="h-5 w-5" />
          {account.signingOut ? t.signingOut : t.signOut}
        </button>
      </div>
    </>,
    document.body,
  );
}

/**
 * One tile: a 40px soft icon tile over its label, the whole tile the target and at least 64px tall. The current page's
 * tile is navy. A *Segera hadir* tile is greyed, says so under its name, and is no link — named in words for a screen
 * reader, as the sidebar's *Upcoming* items are.
 */
function Tile({ item, soon, doneSuffix }: { item: FieldDestination; soon: string; doneSuffix: string }) {
  const icon = (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-[12px]',
        item.active ? 'bg-navy text-white' : 'bg-pill-grey text-pill-grey-ink',
        item.soon && 'opacity-50',
      )}
    >
      <NavIcon name={item.icon} className="h-[21px] w-[21px]" />
    </span>
  );
  const face = 'flex min-h-16 flex-col items-center gap-1 rounded-row px-0.5 py-1 text-center text-xs leading-tight';
  if (item.soon) {
    return (
      <span aria-disabled="true" data-tile={item.id} className={cn(face, 'cursor-default text-signal-grey')}>
        {icon}
        <span>{item.short}</span>
        <span className="font-semibold">{soon}</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      data-tile={item.id}
      className={cn(face, 'text-ink hover:bg-hover-row', item.active && 'font-semibold')}
    >
      {icon}
      <span className="line-clamp-2">{item.short}</span>
      {item.done && <span className="sr-only">{doneSuffix}</span>}
    </Link>
  );
}
