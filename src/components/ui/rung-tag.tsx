import { useCallback } from 'react';
import { classOfRung, rungShort, useLadder } from '@/components/ui/role-badge';
import { cn } from '@/lib/cn';
import type { OrgLevel } from '@/lib/tenant-config-cache';

/**
 * **A person's level, as a small navy tag before their name** (P19.9-T4 AC-1; R6, ADR-0235, OD-291) — the Unit
 * Dashboard's roster and *Potensi*'s leaders (P19.8-T4, MOB UI-179), where it was first drawn:
 * `unit-mobile-stopmotion-2026-11-07`'s `.role`, 12px / 800 on navy, a 6px corner.
 *
 * **The company's own short name** (`rungShort`; ADR-0167 §10, OD-205): *AB*, *AAB* on the seeded ladder, *BP* or *SBP*
 * at a company that says so — never upper-cased by the name it sits beside. Its words are the badge's, read before the
 * name by a screen reader.
 *
 * *Changed 2026-11-10 (P19.11-T6 AC-3, AC-4; UX-15, UX-16, UXQ10):* **a leader's rung only** — a screen draws it where
 * `isLeaderRung` says so, and an Agent gets no tag and no gap where one was: the roster and *Potensi* tag AB and AAB, and
 * Home's *Laporan aktivitas tim* draws none at all. Per screen, as the owner's brief draws them; one tag, one rule.
 */
export function RungTag({ rung, className }: { rung: { code: string; label: string }; className?: string }) {
  return (
    <span
      data-rung-tag={rung.code}
      className={cn(
        'inline-block shrink-0 whitespace-nowrap rounded-[6px] bg-secondary px-1.5 py-px align-[1px] text-sm font-extrabold normal-case leading-snug tracking-normal text-secondary-contrast',
        className,
      )}
    >
      {rungShort(rung)}
    </span>
  );
}

/**
 * **Is this a leader's rung?** (P19.11-T6 AC-4; UXQ10) — the one rule for whether a `RungTag` is drawn: a rung with a
 * leader tier on the company's ladder (`classOfRung`: *Senior Leader* is AB, *Associate Leader* AAB; ADR-0156 §2). Never
 * by the string `AGENT`: rung codes are the company's (*BP*, *SBP*). A rung missing from the ladder reads by its code,
 * as `classOfRung` reads a rung from before the tier existed.
 */
export function isLeaderRung(rung: { code: string }, ladder: readonly OrgLevel[]): boolean {
  const level = ladder.find((l) => l.code === rung.code.toUpperCase());
  return classOfRung(level ?? { code: rung.code }) !== 'agent';
}

/** `isLeaderRung` on the office's ladder (`useLadder`), for a screen. */
export function useIsLeaderRung(): (rung: { code: string }) => boolean {
  const ladder = useLadder();
  return useCallback((rung: { code: string }) => isLeaderRung(rung, ladder), [ladder]);
}
