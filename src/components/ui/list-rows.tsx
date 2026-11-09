'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { LineIcon } from './line-icon';

/*
 * **The Owner's pages as rows, on a phone and a tablet** (P19.2-T3; UI-139, UI-140, UI-141, UI-142 — the full UI
 * report of 3 November and `kpm-owner-mobile-2026-11-03`): one white list of 56px rows, a search pill, and the filter
 * chips over it — built once here and drawn by Data upload, All members and the settings pages, as the report's
 * *Shared components* asks (*built once and reused, not page by page*). A person's row is `PersonRow`
 * (`person-row.tsx`); a row with no person — a product, an agent's month, a checklist item — is `ListRow`.
 *
 * Markup and handlers only: no state. Which size draws them is the page's question (`useMediaQuery`), never answered
 * here.
 */

/** **The rows' card**: white, the card's corners, a 1px divider between rows (`#EEECE7`) and none after the last. */
export function ListCard({
  label,
  labelledBy,
  children,
  className,
}: {
  /** What a screen reader calls the list — the table's caption it stands in for. */
  label?: string;
  labelledBy?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul
      role="list"
      aria-label={label}
      aria-labelledby={labelledBy}
      data-list-card=""
      className={cn('overflow-hidden rounded-lg bg-card [&>li+li]:border-t [&>li+li]:border-divider', className)}
    >
      {children}
    </ul>
  );
}

/**
 * **One row: a title, one meta line, whatever sits on the right, and a ›** (UI-139, UI-141; D-09: *the whole row is the
 * target with a › on the right*). 56px tall at least on a phone and a tablet, 52px from 1024px.
 *
 * - **`href`** makes the row a link and **`onSelect`** a button; neither, it is read. The target is the title, stretched
 *   over the row (`after:inset-0`), so the row's accessible name is its title (or `ariaLabel`), and the controls in
 *   `trailing` — a ⋮, a switch — stay their own targets above it, never inside a link.
 * - **`caps`** writes the title in capitals, as a person's NAME is (UI-139's *NAME caps*); a product keeps its name as
 *   the admin typed it.
 * - The focus ring is the row's, drawn when the title has the keyboard's focus.
 */
export function ListRow({
  title,
  meta,
  trailing,
  href,
  onSelect,
  ariaLabel,
  haspopup,
  caps = false,
  lead,
  note,
  className,
  ...data
}: {
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onSelect?: () => void;
  /** The target's name, where the title alone would not say what a tap does: *Koreksi angka WILSON TANOTO*. */
  ariaLabel?: string;
  /** The row opens a sheet: `aria-haspopup="dialog"`. */
  haspopup?: boolean;
  caps?: boolean;
  /** Left of the title: a section's number, a ⚡. */
  lead?: ReactNode;
  /**
   * **A line under the meta, where a row must say more** (P19.2-T2; UI-126): a KPM's Owner and what needs doing. Read,
   * never a target — the title's stretched link lies over it — and it wraps rather than truncates.
   */
  note?: ReactNode;
  className?: string;
  'data-row'?: string;
}) {
  const live = href !== undefined || onSelect !== undefined;
  const titleClass = cn(
    'block truncate text-left text-md font-bold text-ink',
    caps && 'uppercase tracking-[0.2px]',
  );
  const stretch = 'after:absolute after:inset-0 after:content-[""] focus-visible:outline-none';
  const target = !live
    ? <span className={titleClass}>{title}</span>
    : href !== undefined
      ? <Link href={href} data-row-main="" aria-label={ariaLabel} className={cn(titleClass, stretch)}>{title}</Link>
      : (
        <button
          type="button"
          data-row-main=""
          aria-label={ariaLabel}
          aria-haspopup={haspopup ? 'dialog' : undefined}
          onClick={onSelect}
          className={cn(titleClass, stretch, 'w-full')}
        >
          {title}
        </button>
      );
  return (
    <li
      data-list-row=""
      data-row={data['data-row']}
      className={cn(
        'relative flex min-h-14 items-center gap-2.5 py-1.5 pl-3 pr-1 lg:min-h-[3.25rem]',
        live && 'cursor-pointer lg:hover:bg-hover-row',
        live && 'has-[[data-row-main]:focus-visible]:outline has-[[data-row-main]:focus-visible]:outline-2 has-[[data-row-main]:focus-visible]:-outline-offset-2 has-[[data-row-main]:focus-visible]:outline-primary',
        className,
      )}
    >
      {lead}
      <div className="min-w-0 flex-1">
        {target}
        {meta !== undefined && meta !== null && (
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-sm text-muted">{meta}</div>
        )}
        {note !== undefined && note !== null && <div data-row-note="" className="mt-1 text-sm">{note}</div>}
      </div>
      {trailing !== undefined && trailing !== null && (
        <div className="relative z-[1] flex shrink-0 items-center gap-2">{trailing}</div>
      )}
      {live && <LineIcon name="chevronRight" className="mr-1 h-5 w-5 shrink-0 text-signal-grey" />}
    </li>
  );
}

/** One chip: its words, and the count after them. */
export interface FilterChip<K extends string = string> {
  readonly key: K;
  readonly label: string;
  /** The count after the words — *Semua 28*; absent, the words alone. */
  readonly count?: number;
}

/**
 * **Filter chips** (UI-139's *Semua n · Belum dilaporkan n · Dikoreksi n*, UI-140's *Semua 28 · AB 5 · AAB 4 · Agent
 * 19*, UI-141's *Semua 31 · Menunggu 2 · Dikembalikan 1*): one row of pill buttons, the chosen one navy, each a toggle
 * (`aria-pressed`) a screen reader hears with its count. **44px tall below 1024px** (UI-142: tap targets ≥ 44px on a
 * phone and a tablet), 36px from 1024px as `kpm-owner-desktop` draws them. The row scrolls sideways inside its own box
 * when its chips do not fit, so the page never does.
 */
export function FilterChips<K extends string>({
  label,
  chips,
  active,
  onSelect,
  className,
}: {
  /** The group's name for a screen reader: *Saring menurut peran*. */
  label: string;
  chips: readonly FilterChip<K>[];
  active: K;
  onSelect: (key: K) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-filter-chips=""
      className={cn('flex gap-1.5 overflow-x-auto overflow-y-hidden', className)}
    >
      {chips.map((chip) => {
        const on = chip.key === active;
        return (
          <button
            key={chip.key}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(chip.key)}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-3 text-base font-semibold lg:min-h-9 lg:px-3.5',
              on ? 'bg-secondary text-secondary-contrast' : 'bg-card text-pill-grey-ink hover:bg-hover-row',
            )}
          >
            {chip.label}
            {chip.count !== undefined && <span className="tabular-nums">{chip.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * **The search pill** (UI-140's *Cari nama atau kode agen*, UI-141's *Cari produk*): a white pill 44px tall with the
 * glyph and the field inside, the placeholder its visible words and its label for a screen reader. The field's text is
 * 16px, so a phone never zooms into it.
 */
export function SearchPill({
  label,
  value,
  onChange,
  className,
}: {
  /** The placeholder and the field's name: *Cari nama atau kode agen*. */
  label: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <label
      data-search-pill=""
      className={cn(
        'flex min-h-11 min-w-0 items-center gap-2 rounded-pill bg-card px-3.5 text-muted',
        'focus-within:outline focus-within:outline-2 focus-within:outline-focus-ring',
        className,
      )}
    >
      <LineIcon name="search" className="h-[18px] w-[18px] shrink-0" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        placeholder={label}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-signal-grey"
      />
    </label>
  );
}
