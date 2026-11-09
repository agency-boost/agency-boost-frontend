import { rungShort } from '@/components/ui/role-badge';
import { cn } from '@/lib/cn';

/**
 * **A person's level, as a small navy tag before their name** (P19.9-T4 AC-1; R6, ADR-0235, OD-291) — the Unit
 * Dashboard's roster on every row, at every period and size, and *Potensi*'s leaders (P19.8-T4, MOB UI-179), where it was
 * first drawn: `unit-mobile-stopmotion-2026-11-07`'s `.role`, 12px / 800 on navy, a 6px corner.
 *
 * **The company's own short name** (`rungShort`; ADR-0167 §10, OD-205): *AB*, *AAB*, *Agent* on the seeded ladder, *BP*
 * or *SBP* at a company that says so — never upper-cased by the name it sits beside, so *Agent* reads as the ladder
 * writes it. Its words are the badge's, read before the name by a screen reader.
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
