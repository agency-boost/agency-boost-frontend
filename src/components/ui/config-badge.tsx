import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The prototype's `cfg-badge` (`KPM_Owner.html:280-288`) on a settings row: `won` when the row
 * holds something agents are offered, `open` when it does not.
 *
 * Its words carry the state — *6 skills · 10 modules published*, *Empty*, *Draft* — so colour is
 * never the only cue, and the tones differ in border as well as hue.
 *
 * **`navy` is the quiet chip**, not a state: `.activity-tag` naming which activity a cascade column
 * counts against (`Overall.html:718-721`) and `.auto-badge` saying a field is filled in for you
 * (`:662-667`). The prototype sets no `text-transform` on the first and `uppercase` on the second,
 * so a chip carrying a phrase rather than a state passes `className="normal-case tracking-normal"` —
 * `cn` merges with `twMerge`, so the later class wins and nothing here needs a second knob.
 */
export function ConfigBadge({
  tone,
  children,
  className,
}: {
  tone: 'won' | 'open' | 'navy';
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex whitespace-nowrap rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-wide',
        tone === 'won' && 'bg-success/10 text-success',
        tone === 'open' && 'border border-hairline bg-base text-muted',
        tone === 'navy' && 'bg-navy/[0.06] text-navy',
        className,
      )}
    >
      {children}
    </span>
  );
}
