import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The prototype's `cfg-badge` (`KPM_Owner.html:280-288`) on a settings row: `won` when the row
 * holds something agents are offered, `open` when it does not.
 *
 * Its words carry the state — *6 skills · 10 modules published*, *Empty*, *Draft* — so colour is
 * never the only cue, and the two tones differ in border as well as hue.
 */
export function ConfigBadge({
  tone,
  children,
  className,
}: {
  tone: 'won' | 'open';
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex whitespace-nowrap rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-wide',
        tone === 'won' ? 'bg-success/10 text-success' : 'border border-hairline bg-base text-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}
