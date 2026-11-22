import { useCallback } from 'react';
import { classOfRung, rungShort, useLadder } from '@/components/ui/role-badge';
import { cn } from '@/lib/cn';
import type { OrgLevel } from '@/lib/tenant-config-cache';

/**
 * **A person's level, as a small bold orange label before their name** (P19.18; ADR-0266 §3, ADR-0271 §10; the brief of 19
 * November 2026, *Naming rule*, and `DESIGN-RULES.md`): *"the role label AB / AAB as small bold orange text right before
 * the name — no grey pill, no badge under or above the name"*. Used by the Unit Dashboard's roster and sheets, *Potensi*,
 * Home's whole-office list and Coaching.
 *
 * **The orange that reads** (WCAG 2.1 AA, 1.4.3): the accent's ink (`text-primary-ink`, 4.9:1 on a card), since the accent
 * itself is 2.6:1 on white — the brief's orange, in the shade small text may use (parity I-1081).
 *
 * **The company's own short name** (`rungShort`; ADR-0167 §10, OD-205): *AB*, *AAB* on the seeded ladder, *BP* or *SBP*
 * at a company that says so — never upper-cased by the name it sits beside. Its words are the badge's, read before the
 * name by a screen reader.
 *
 * *Changed 2026-11-20 (P19.18; ADR-0271 §10, superseding ADR-0235 §2):* it was a navy tag, 12px / 800 on navy with a 6px
 * corner (P19.9-T4 AC-1; `unit-mobile-stopmotion-2026-11-07`'s `.role`). *Changed 2026-11-10 (P19.11-T6 AC-3, AC-4):*
 * **a leader's rung only** — a screen draws it where `isLeaderRung` says so, and an Agent gets no label and no gap.
 */
export function RungTag({ rung, className }: { rung: { code: string; label: string }; className?: string }) {
  return (
    <span
      data-rung-tag={rung.code}
      className={cn(
        'inline-block shrink-0 whitespace-nowrap align-[1px] text-sm font-extrabold normal-case leading-snug tracking-normal text-primary-ink',
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
