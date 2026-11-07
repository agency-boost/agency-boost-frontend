'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar } from './avatar';
import { useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { cn } from '@/lib/cn';
import { LineIcon } from './line-icon';

/*
 * **The person row and the tree indent** (UI V1, UI-059 and UI-073; D-05) — built once for the Group Tree, the Unit
 * Dashboard's roster, the Coaching list, New Hires, User Management and Home's team list.
 */

/** The avatar and its two helpers live in `avatar.tsx`, which a page draws without a person row (the bundle). */
export { AVATAR_MIN_TEXT_PX, Avatar, initialsFor, tintFor } from './avatar';

/** How a row is drawn (UI-059). */
export type PersonRowTone = 'default' | 'self' | 'tinted' | 'muted';

const TONE: Record<PersonRowTone, string> = {
  // An agent: white; the desktop's row under the pointer.
  default: 'bg-card lg:hover:bg-hover-row',
  // The reader's own row: navy, white name.
  self: 'bg-secondary text-secondary-contrast lg:hover:bg-secondary-hover',
  // An AAB's row: the accent's tint (`#FDF1E6`).
  tinted: 'bg-primary/[0.12] lg:hover:bg-primary/20',
  // The upline: no fill, a 1px outline, grey words — and never a link.
  muted: 'border border-line bg-transparent text-muted',
};

const META: Record<PersonRowTone, string> = {
  default: 'text-muted',
  self: 'text-secondary-muted',
  tinted: 'text-muted',
  muted: 'text-muted',
};

/** The row's height: 56px (New Hires, Home), 60px, 64px (User Management, the tablet's tree); 48px for the upline. */
const HEIGHT = { 48: 'min-h-12', 56: 'min-h-14', 60: 'min-h-[3.75rem]', 64: 'min-h-16' } as const;

/**
 * **One person on one row** (UI-059; D-05, D-09): avatar · NAME in capitals · one meta line · whatever sits on the
 * right (a pill, a ›, a button, a ⌄) — and **the whole row is the target**.
 *
 * - **`href`** makes the row a link and **`onSelect`** a button; neither, it is read-only (the upline). The target is
 *   the name, stretched over the row (`after:inset-0`), so the row's accessible name is the person's name and the
 *   controls in `trailing` — WhatsApp, a role pill, a ⌄ — stay their own targets, above it, never inside a link.
 * - **The focus ring is the row's**, drawn when the name has the keyboard's focus.
 * - **`chevron`** draws the › of a tappable row (D-09); the Group Tree, the owner's exception (UI-072), leaves it off.
 * - **Names** in capitals, 700: 13px on a phone and a tablet, 14px on a desktop (UI-059; P19.8-T1 AC-4, MOB UI-168: it
 *   was 15px on a phone). **On a phone a name is never cut** — it wraps to a second line and the row grows (P19.8-T1
 *   AC-5; R6, MOB UI-165, MOB UI-178); from 768px it stays on one line, *…* only when it cannot fit. A caller with another
 *   size passes `nameClassName`, which stands at every width (13 to 14px on a phone).
 */
export function PersonRow({
  name,
  photoUrl,
  seed,
  meta,
  trailing,
  badge,
  href,
  onSelect,
  chevron = false,
  tone = 'default',
  height = 56,
  avatarSize,
  lead,
  nameClassName,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  /** The avatar tint's seed: the membership id, so a renamed person keeps their colour. */
  seed?: string;
  /** The line under the name: *AAB · 3*, *Pecah telor di hari ke-38*, a pill. */
  meta?: ReactNode;
  /** Right of the name: a pill, a percentage, WhatsApp, a role pill, a `TreeToggle`. */
  trailing?: ReactNode;
  /**
   * Beside the name, on its line, never cut short — the Group Tree's *Anda* on the reader's own row (UI-059, UI-075;
   * added by Phase 18.11 T9). The name gives way with *…* first.
   */
  badge?: ReactNode;
  href?: string;
  onSelect?: () => void;
  /** The › of a tappable row (D-09). */
  chevron?: boolean;
  tone?: PersonRowTone;
  height?: keyof typeof HEIGHT;
  avatarSize?: number;
  /**
   * In the avatar's place — New Hires' status circle (UI-024: *✓ Teraktivasi, amber ✓ after day 90, empty when not
   * yet*; added by Phase 18.11 T6). Decorative or labelled by the caller; the avatar when absent.
   */
  lead?: ReactNode;
  nameClassName?: string;
  className?: string;
}) {
  const live = tone !== 'muted' && (href !== undefined || onSelect !== undefined);
  const nameClass = cn(
    // **Never cut on a phone** (P19.8-T1 AC-5; R6, MOB UI-165, MOB UI-178): below 768px the name wraps to a second line
    // and the row grows, rather than ending in *…*. From 768px it keeps its one line, as the tablet and laptop layouts do.
    'block truncate font-bold uppercase tracking-[0.2px] max-md:whitespace-normal max-md:break-words',
    /*
     * 13px on a phone (P19.8-T1 AC-4; MOB UI-168: *list names 13–14px*; the mockups' rosters at 13px), where it was the
     * bare 15px — **unless the caller names its own size**, which stands at every width as before. The bare class stays
     * in the list, worn at no width without a caller's size, so that from 768px — which MOB UI-168 does not reach — the
     * markup is the baseline's to the byte (`digestAt`).
     */
    tone === 'muted' ? 'text-sm' : cn('text-[0.9375rem] md:max-lg:text-base lg:text-md', !nameClassName && 'max-md:text-base'),
    tone === 'self' ? 'text-secondary-contrast' : tone === 'muted' ? 'text-muted' : 'text-ink',
    nameClassName,
  );
  // The target covers the row; the trailing controls sit above it.
  const stretch = 'text-left after:absolute after:inset-0 after:rounded-row after:content-[""] focus-visible:outline-none';
  const target = live
    ? href !== undefined
      ? <Link href={href} data-row-main="" className={cn(nameClass, stretch)}>{name}</Link>
      : <button type="button" data-row-main="" onClick={onSelect} className={cn(nameClass, stretch, 'w-full')}>{name}</button>
    : <span className={nameClass}>{name}</span>;

  return (
    <div
      data-person-row=""
      data-tone={tone}
      className={cn(
        'relative flex items-center gap-3 rounded-row px-3 py-2',
        HEIGHT[tone === 'muted' ? 48 : height],
        TONE[tone],
        live && 'cursor-pointer has-[[data-row-main]:focus-visible]:outline has-[[data-row-main]:focus-visible]:outline-2 has-[[data-row-main]:focus-visible]:outline-offset-1 has-[[data-row-main]:focus-visible]:outline-primary',
        className,
      )}
    >
      {lead ?? (
        <Avatar
          name={name}
          photoUrl={photoUrl}
          seed={seed}
          size={avatarSize ?? (tone === 'muted' ? 28 : 36)}
          className={tone === 'muted' ? 'opacity-60' : undefined}
        />
      )}
      <div className="min-w-0 flex-1">
        {badge !== undefined && badge !== null
          ? <div className="flex min-w-0 items-center gap-1.5 [&>:first-child]:min-w-0">{target}<span className="shrink-0">{badge}</span></div>
          : target}
        {meta !== undefined && meta !== null && (
          <div className={cn('mt-0.5 flex min-w-0 items-center gap-1.5 text-sm', META[tone])}>{meta}</div>
        )}
      </div>
      {trailing !== undefined && trailing !== null && (
        <div className="relative z-[1] flex shrink-0 items-center gap-2">{trailing}</div>
      )}
      {chevron && live && (
        <LineIcon
          name="chevronRight"
          className={cn('h-5 w-5', tone === 'self' ? 'text-secondary-muted' : 'text-signal-grey')}
        />
      )}
    </div>
  );
}

/**
 * **A leader's ⌄, at the right of the row, its own target** (UI-073): a plain grey chevron, 20px, no box and no count;
 * ⌄ closed and ⌃ open; 44 × 44px on a phone, 48 on a tablet, 32 on a desktop. Pressing it opens or closes the team and
 * never opens the person — it sits above the row's stretched target. A row without a team draws nothing here.
 */
export function TreeToggle({
  name,
  open,
  onToggle,
  controls,
  onNavy = false,
}: {
  /** Whose team, for its name: *Tampilkan tim Sari Puspita*. */
  name: string;
  open: boolean;
  onToggle: () => void;
  /** The id of the list it opens. */
  controls?: string;
  /** On the reader's own navy row: `#C9CFDB`-ish grey instead of `#6E6E69`. */
  onNavy?: boolean;
}) {
  const t = useMessages(uiV1Messages);
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={open ? t.hideTeam({ name }) : t.showTeam({ name })}
      onClick={onToggle}
      className={cn(
        'relative z-[1] -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-pill md:max-lg:h-12 md:max-lg:w-12 lg:h-8 lg:w-8',
        onNavy ? 'text-secondary-muted hover:bg-secondary-contrast/10' : 'text-signal-grey hover:bg-hover-row',
      )}
    >
      <LineIcon name={open ? 'chevronUp' : 'chevronDown'} className="h-5 w-5" />
    </button>
  );
}

/**
 * **The tree's indent: 36px a level, a 2px line left of the children, and elbows** (UI-073 — the shared tree pattern
 * of the Group Tree, New Hires and the Coaching list). A list of `TreeNode`s under a leader's row: the line runs down
 * from the leader to each child, ├ to every child and └ to the last, in `#D3D1C7`. A caller with another step — the
 * desktop tree's 34px (UI-058) — passes `className` (`lg:ml-[16px] lg:pl-[18px]`).
 */
export function TreeIndent({
  id,
  label,
  children,
  className,
}: {
  /** What a `TreeToggle` names in `aria-controls`. */
  id?: string;
  /** The list's name for a screen reader: *Tim Sari Puspita*. */
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul id={id} aria-label={label} className={cn('ml-[17px] mt-1.5 flex flex-col gap-1.5 pl-[19px]', className)}>
      {children}
    </ul>
  );
}

/**
 * One child in a `TreeIndent`: the line beside it, and an elbow into it at the middle of its first row — ├ for every
 * child, └ for the last (`last:`), so the line stops at the last child rather than running past it.
 */
export function TreeNode({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li
      data-tree-node=""
      className={cn(
        'relative',
        // The line down the left: the whole height for ├, to the elbow for └.
        'before:absolute before:-left-[19px] before:-top-1.5 before:bottom-0 before:w-0.5 before:bg-line before:content-[""]',
        'last:before:bottom-auto last:before:h-[calc(var(--elbow,1.75rem)+0.375rem+2px)]',
        // The elbow: from the line to the row, at the middle of its first row — 28px for a 56px row; a 64px row's
        // caller sets `[--elbow:2rem]`.
        'after:absolute after:-left-[19px] after:top-[var(--elbow,1.75rem)] after:h-0.5 after:w-[15px] after:bg-line after:content-[""]',
        className,
      )}
    >
      {children}
    </li>
  );
}
