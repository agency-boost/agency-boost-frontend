import { useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { cn } from '@/lib/cn';

/** `COACHING_STATUS` as the server sends it (ADR-0267 §5): never coached, within 14 days, or longer ago. */
export type CoachingStatusValue = 'never' | 'recent' | 'lapsed';

/** The three tones, the status pills' own tints (`tokens.md`): red, green, yellow — words on tint above 4.5:1. */
const TONE: Record<CoachingStatusValue, string> = {
  never: 'bg-pill-red text-pill-red-ink',
  recent: 'bg-pill-green text-pill-green-ink',
  lapsed: 'bg-pill-amber text-pill-amber-ink',
};

/**
 * **The coaching status tile** (P19.18-T1 AC-8, AC-9, T5 AC-2; ADR-0267 §5, `COACHING_STATUS`; the brief of 19 November
 * 2026, part A): *Belum pernah coaching* in **red**, *Coaching X hari lalu* in **green** up to 14 days and **yellow** after —
 * from the last 1:1. 12px bold, text centred. **The server decides the status** (`coaching.status`); this only draws it.
 *
 * - `fill`: as wide as its box — the Unit Dashboard's tablet and laptop rows make it exactly as wide as the progress bar,
 *   and the KPM Owner's person card across the card;
 * - otherwise as wide as its words, on Coaching's rows.
 *
 * The colour repeats the words and never replaces them (WCAG 1.4.1): a screen reader hears the sentence.
 */
export function CoachingStatusTile({
  status, days, fill = false, className,
}: { status: CoachingStatusValue; days: number | null; fill?: boolean; className?: string }) {
  const t = useMessages(unitDashboardMessages).coachingStatus;
  const words = status === 'never' || days === null ? t.never : t.daysAgo({ n: days });
  return (
    <span
      data-coaching-status={status}
      className={cn(
        'items-center justify-center whitespace-nowrap rounded-[6px] px-2 py-0.5 text-sm font-bold leading-5',
        fill ? 'flex w-full text-center' : 'inline-flex',
        TONE[status],
        className,
      )}
    >
      {words}
    </span>
  );
}
