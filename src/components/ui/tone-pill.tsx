import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * **The status pill: a tint and its words, never a dot** (UI V1, UI-005; D-27). Four tones from the report's token
 * table, each words-on-tint above 4.5:1 — red `#A32D2D` on `#FCEBEB` (6.13:1), amber `#854F0B` on `#FAEEDA` (5.87:1),
 * green `#3B6D11` on `#EAF3DE` (5.43:1), grey `#444441` on `#F1EFE8` (8.49:1).
 *
 * The words are the caller's (*Perlu perhatian*, *Perlu dipantau*, *Sesuai target*, *Goal belum diatur* — UI-005; a
 * role, *AAB*; *Tidak berlaku*), in sentence case, 12px/600: the colour repeats the words and never replaces them.
 *
 * Not `StatusPill`, the earlier uppercase one that `statusFor` feeds, which pages keep until they move to UI V1.
 */
export type PillTone = 'red' | 'amber' | 'green' | 'grey' | 'blue';

const TONE: Record<PillTone, string> = {
  red: 'bg-pill-red text-pill-red-ink',
  amber: 'bg-pill-amber text-pill-amber-ink',
  green: 'bg-pill-green text-pill-green-ink',
  grey: 'bg-pill-grey text-pill-grey-ink',
  // The Group Tree's *Anda* on the reader's own navy row (UI-059): 6.42:1.
  blue: 'bg-pill-blue text-pill-blue-ink',
};

export function TonePill({
  tone,
  children,
  className,
}: {
  tone: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-pill px-2.5 py-0.5 text-xs font-semibold leading-5',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
