import type { Ref } from 'react';
import { cn } from '@/lib/cn';

export type PillTone = 'success' | 'alert' | 'neutral';

const PILL: Record<PillTone, { box: string; dot: string }> = {
  success: { box: 'bg-success/10 text-success', dot: 'bg-success' },
  alert: { box: 'bg-alert/10 text-alert', dot: 'bg-alert' },
  neutral: { box: 'bg-navy/[0.06] text-muted', dot: 'bg-muted' },
};

/**
 * **The fit pill** (`.fit-pill`, `Overall.html:2442-2450`): a dot and a word. **The verdict is the word**
 * — *Good fit*, *Check fit*, *In run-off*, *From catalog* — and the tint repeats it, never replaces it
 * (P14-T8 AC-11). Each tone clears 4.5:1 on its own wash (`product-catalog.spec.ts`).
 */
export function FitPill({ label, tone }: { label: string; tone: PillTone }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-[11px] py-[5px] text-xs font-semibold',
        PILL[tone].box,
      )}
      data-tone={tone}
    >
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', PILL[tone].dot)} />
      {label}
    </span>
  );
}

/**
 * **The result's head** (D-components; `.match-head`, `Overall.html:9678-9686`, styles `:2433-2441`): the
 * tag above, the title, the tagline, and the pill to the right.
 *
 * Props only, so the Recruitment Attack Plan (**P17-T3**, its second user) heads a candidate's result with
 * it. The title is the result's heading, and takes the focus after the plan is built (`headingRef`,
 * P14-T8 AC-11), so it can be focused by script and not by Tab.
 *
 * The tag is amber-ink, where the prototype's amber-dark misses 4.5:1 as small text on a card.
 */
export function ResultHead({
  tag,
  title,
  tagline,
  pill,
  headingRef,
}: {
  tag: string;
  title: string;
  tagline: string;
  pill: { label: string; tone: PillTone };
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline px-5 py-5 sm:flex-nowrap sm:px-6">
      <div className="min-w-0">
        <p className="m-0 mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-ink">{tag}</p>
        <h2 ref={headingRef} tabIndex={-1} className="m-0 mb-[5px] break-words text-2xl font-bold text-navy">{title}</h2>
        <p className="m-0 text-md text-muted">{tagline}</p>
      </div>
      <FitPill label={pill.label} tone={pill.tone} />
    </div>
  );
}
