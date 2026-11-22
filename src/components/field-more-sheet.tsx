'use client';

import Link from 'next/link';
import { useContext, useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { MORE_SHEET_ID } from '@/components/field-nav';
import { FieldAvatar, type FieldChrome } from '@/components/field-chrome';
import { LanguageSwitch } from '@/components/language-switch';
import { PoweredBy, useBranding } from '@/components/kpm-brand';
import { SurveyCards } from '@/components/surveys/survey-cards';
import { NavIcon } from '@/components/ui/nav-icon';
import { useMessages } from '@/i18n/language-provider';
import { shellMessages } from '@/i18n/messages/shell';
import { cn } from '@/lib/cn';
import type { FieldDestination, FieldGroupTag } from '@/lib/field-nav';
import { SessionContext } from '@/lib/session';
import { hasSurveyDot, useSurveyPending } from '@/lib/survey-pending';
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
 * - **The groups**, each a heading and a 4-column grid of tiles — a soft icon tile over a 12px label of at most two
 *   lines, the whole tile the target — in the order and with the members `fieldNav` gives: what the reader may open
 *   today, and a group with nothing in it left out.
 * - ***Keluar***, last, in red.
 *
 * *Changed 2026-11-20 (P19.17-T3 AC-7; ADR-0269 §5; the brief's *Phone "Lainnya"*, `lainnya-owner-mobile`):* **the
 * sidebar's groups in the sidebar's order** — Saya · Aktivitas · Tim saya · Program, then for the Owner, the Admins and
 * the core leaders **KPM · People · Pengaturan** (one tile, *Pengaturan KPM*), their tiles orange and their headings
 * tagged *KPM Owner* or *Core leader*; each heading 14px bold in ink, each icon tile 48px; **Keluar an outlined pill**.
 * *📘 Panduan* is gone (ADR-0219 §5 superseded), and nothing of the views (ADR-0198) was ever here.
 *
 * A modal dialog named *Lainnya*, drawn at the end of `<body>` so nothing on the page stands over it; the page behind
 * holds still (`useScrollLock`). Following any link in it closes it.
 *
 * *Changed 2026-11-22 (P19.26-T6 AC-1; UI-218 (21 Nov)):* **the Super Admin's, on a phone** — their name is never cut
 * (*PLATFORM OP…*), and *ID | EN* sits on its own row under the account row. Every other reader, and the tablet, as before.
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
  const branding = useBranding();
  const box = useRef<HTMLDivElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const dragFrom = useRef<number | null>(null);
  const { account, nav } = chrome;
  // P19.26-T6 AC-1: the Super Admin's account row on a phone. Read without throwing where no session is mounted.
  const superAdmin = useContext(SessionContext)?.me?.user.platformRole === 'super_admin';
  // P19.5-T4 (C-R2): the surveys waiting — the cards above the groups, and the *Survei* tile's dot.
  const surveys = useSurveyPending(nav.groups.some((g) => g.items.some((i) => i.id === 'surveys')));
  const surveyDot = hasSurveyDot(surveys);

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
          <div className={cn('flex items-center gap-2.5 rounded-row bg-hover-row py-2 pl-2 pr-1', superAdmin && 'max-md:flex-wrap')}>
            <Link
              href={account.profileHref}
              data-change-photo=""
              className="flex min-h-11 w-[52px] shrink-0 flex-col items-center gap-0.5 text-center"
            >
              <FieldAvatar account={account} className="h-10 w-10 text-base" />
              <span className="text-xs font-semibold leading-tight text-navy">{t.changePhoto}</span>
            </Link>
            <span className="min-w-0 flex-1 leading-snug">
              {/* P19.17-T3 (`DESIGN-RULES.md`, *Names*; `lainnya-owner-mobile`): a person's name in capitals. */}
              <b
                // The Super Admin's alone: every other reader's sheet is drawn exactly as before (P19.2-T1 AC-2's digests).
                data-account-name={superAdmin ? '' : undefined}
                className={cn(
                  'block truncate text-md font-bold uppercase text-ink',
                  superAdmin && 'max-md:overflow-visible max-md:whitespace-normal max-md:break-words',
                )}
              >
                {account.name}
              </b>
              <span className="block truncate text-xs text-muted" title={account.role}>{account.role}</span>
            </span>
            {/*
              * The Super Admin's *ID | EN* on its own row on a phone (UI-218), so the name keeps the row's width: one switch,
              * moved by its box — `contents` from 768px, so the tablet's row is as before. Every other reader's switch is
              * not wrapped at all, so their sheet's markup is unchanged (P19.2-T1 AC-2's digests).
              */}
            {superAdmin ? (
              <span data-language-row="" className="contents max-md:order-last max-md:flex max-md:basis-full max-md:justify-end">
                <LanguageSwitch tone="page" />
              </span>
            ) : (
              <LanguageSwitch tone="page" />
            )}
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

        {/* P19.5-T4 (C-R2, C-R9): *Perlu diisi*, one card per survey waiting, heading the sheet — or the thanks. */}
        <SurveyCards pending={surveys} />

        {nav.groups.map((group) => (
          <section key={group.id} aria-labelledby={`more-group-${group.id}`} data-more-group={group.id}>
            <h2 id={`more-group-${group.id}`} className="mb-2 mt-4 flex items-center gap-2 text-md font-bold text-ink">
              <span data-group-name="">{t.fieldGroups[group.id]}</span>
              {group.tag && <SheetTag tag={group.tag} words={t.sheetTags} />}
            </h2>
            <ul className="grid grid-cols-4 gap-x-1.5 gap-y-2.5">
              {group.items.map((item) => (
                <li key={item.id}>
                  <Tile
                    item={item}
                    extra={Boolean(group.tag)}
                    soon={t.soon}
                    doneSuffix={t.doneSuffix}
                    dot={item.id === 'surveys' && surveyDot}
                    dotSuffix={t.surveyWaiting}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* `lainnya-owner-mobile`: *Keluar* an outlined pill, 48px, red words and the logout icon, centred, last. */}
        <button
          type="button"
          onClick={account.onSignOut}
          disabled={account.signingOut}
          aria-busy={account.signingOut || undefined}
          data-sign-out=""
          className={cn(
            'mt-5 flex min-h-12 w-full items-center justify-center gap-1.5 rounded-pill border border-line text-md font-bold text-pill-red-ink',
            'disabled:opacity-60',
          )}
        >
          <NavIcon name="ti-logout" className="h-5 w-5" />
          {account.signingOut ? t.signingOut : t.signOut}
        </button>
        {/* P19.6-T1 AC-14 (ADR-0218 §11): under a KPM's own logo only; nothing is added otherwise. */}
        <PoweredBy branding={branding} className="mt-2 px-1 text-center text-muted" />
      </div>
    </>,
    document.body,
  );
}

/**
 * **The extras' tag beside a group's heading** (P19.17-T3 AC-7; `lainnya-owner-mobile`): *KPM Owner* for the Owner and
 * the Admins, *Core leader* for a core leader — 12px bold on the orange tint, the primary's ink on it.
 */
function SheetTag({ tag, words }: { tag: FieldGroupTag; words: { owner: string; coreLeader: string } }) {
  return (
    <span data-sheet-tag="" className="rounded-md bg-primary-50 px-1.5 py-0.5 text-2xs font-bold text-primary-ink">
      {tag === 'owner' ? words.owner : words.coreLeader}
    </span>
  );
}

/**
 * One tile: a 48px soft icon tile over its label, the whole tile the target and at least 64px tall. The current page's
 * tile is navy; **the extras' tiles are the orange tint with the primary's ink** (P19.17-T3 AC-7; `lainnya-owner-mobile`:
 * *orange tiles = owner / core leader extras*). A *Segera hadir* tile is greyed, says so under its name, and is no link —
 * named in words for a screen reader, as the sidebar's *Upcoming* items are.
 */
function Tile({
  item, extra = false, soon, doneSuffix, dot = false, dotSuffix = '',
}: { item: FieldDestination; extra?: boolean; soon: string; doneSuffix: string; dot?: boolean; dotSuffix?: string }) {
  /*
   * **A live count rides the icon** (P19.2-T1 AC-9): the Super Admin's *Leaders past the limit*, as the console's drawer
   * drew its badge — the alert-red pill at the icon's corner, and the number in the tile's name. No field item has one.
   */
  const count = item.badge !== undefined && item.badge > 0 ? item.badge : 0;
  const icon = (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-12 w-12 items-center justify-center rounded-[14px]',
        item.active
          ? 'bg-secondary text-secondary-contrast'
          : extra ? 'bg-primary-50 text-primary-ink' : 'bg-pill-grey text-secondary-ink',
        item.soon && 'opacity-50',
        (count > 0 || dot) && 'relative',
      )}
    >
      <NavIcon name={item.icon} className="h-[22px] w-[22px]" />
      {/* P19.5-T4 (C-R2): the red dot on *Survei* while a survey waits, said in its name. */}
      {dot && <span data-survey-dot="" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-alert" />}
      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-alert px-1 text-2xs font-bold text-white">
          {count}
        </span>
      )}
    </span>
  );
  const face = 'flex min-h-16 flex-col items-center gap-1.5 rounded-row px-0.5 py-1 text-center text-xs font-semibold leading-tight';
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
      // A count is in the name, as the sidebar's rail says it (*Leaders past the limit, 2*); none otherwise.
      aria-label={count > 0 ? `${item.short}, ${count}` : dot ? `${item.short}${dotSuffix}` : undefined}
      data-tile={item.id}
      className={cn(face, 'text-ink hover:bg-hover-row', item.active && 'font-semibold')}
    >
      {icon}
      <span className="line-clamp-2">{item.short}</span>
      {item.done && <span className="sr-only">{doneSuffix}</span>}
    </Link>
  );
}
