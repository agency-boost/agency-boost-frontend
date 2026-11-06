'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

/*
 * **The avatar, in a module of its own** (UI V1, UI-059; the bundle, 2026-11-06; `performance-and-scale.md`): a coachee's
 * header, a lead's card, a meeting's head and the profile draw an avatar and no person row, and importing it from
 * `person-row.tsx` loaded the row, the tree's indent and their words with it. `person-row.tsx` re-exports all four.
 */

/** Two letters for an avatar: the first of the first and of the last name (*AP* for *Agus Prasetyo*). */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (words[0][0] + last).toUpperCase();
}

/**
 * **A soft tint that varies per person** (UI-059: *initials on a soft tint varying per person*), the same one every
 * time for the same person: picked by a hash of `seed` (their membership id, or their name). Six tints, each with
 * words on it above 4.5:1. Never a role's colour: a role is a pill's words (D-27).
 */
const TINTS = [
  'bg-primary/20 text-primary-ink',
  'bg-lavender/20 text-navy',
  'bg-pill-green text-pill-green-ink',
  'bg-pill-blue text-pill-blue-ink',
  'bg-pill-amber text-pill-amber-ink',
  'bg-teal/15 text-teal-ink',
] as const;

export function tintFor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

/** The smallest initials an avatar draws, in px: the type scale's floor (UI-008). */
export const AVATAR_MIN_TEXT_PX = 12;

/**
 * **An avatar: the photo when there is one, else initials on a tint** (UI-059). A photo that fails to load falls back to
 * the initials rather than a broken image. Decorative — the name is always beside it — so it is hidden from assistive
 * technology.
 */
export function Avatar({
  name,
  photoUrl,
  seed,
  size = 36,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  /** What picks the tint; the name when absent. */
  seed?: string;
  /** In px: 28 (an upline), 32, 36, 40, 44. */
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const box = cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold', className);
  // Initials at about a third of the circle, never under 12px (UI-008: *nothing under 12px, at any width*; T16).
  const style = { width: size, height: size, fontSize: Math.max(AVATAR_MIN_TEXT_PX, Math.round(size * 0.36)) };
  if (photoUrl && !broken) {
    return (
      // A member's photo is a user upload served from storage: `next/image` would need its host configured.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        aria-hidden="true"
        className={cn(box, 'object-cover')}
        style={style}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span aria-hidden="true" className={cn(box, tintFor(seed ?? name))} style={style}>
      {initialsFor(name)}
    </span>
  );
}
