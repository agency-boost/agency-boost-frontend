import { cn } from '@/lib/cn';

/**
 * **The step pills** (D-components; `.steps`, `Overall.html:3788-3792`, styles `:2388-2396`): numbered
 * steps with a hairline between, the current one in amber, the ones behind it in navy.
 *
 * Props only, so the Recruitment Attack Plan (**P17-T3**, its second user) draws its own two steps here.
 *
 * **A step behind the current one is a button** when `onStep` is given — the prototype makes step 1's
 * pill a clickable `div` (`:9582-9586`), which no keyboard reaches (contradiction 12, an Improve for
 * accessibility). The current step says so (`aria-current="step"`), and a step ahead is plain text.
 *
 * The current step's number is **navy on amber**, where the prototype's white is 2.2:1 — the capability
 * ladder's precedent (`a11y.spec.tsx`).
 */
export function StepPills({
  label,
  steps,
  current,
  onStep,
}: {
  /** Names the list for a screen reader. */
  label: string;
  steps: readonly string[];
  /** The index of the step the reader is on. */
  current: number;
  onStep?: (index: number) => void;
}) {
  return (
    <ol aria-label={label} className="mb-[26px] flex list-none flex-wrap items-center gap-2.5 p-0">
      {steps.map((step, i) => {
        const done = i < current;
        const on = i === current;
        const body = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-sm font-bold',
                on && 'border-amber bg-amber text-navy',
                done && 'border-navy bg-navy text-white',
                !on && !done && 'border-hairline text-muted',
              )}
            >
              {i + 1}
            </span>
            <span className="sr-only">{i + 1} </span>
            {step}
          </>
        );
        const tone = cn('flex items-center gap-2 text-base font-semibold', on ? 'text-navy' : 'text-muted');
        return (
          <li key={step} className="flex items-center gap-2.5" aria-current={on ? 'step' : undefined}>
            {i > 0 && <span aria-hidden="true" className="h-px w-9 bg-hairline" />}
            {done && onStep ? (
              <button type="button" className={cn(tone, 'rounded-sm')} onClick={() => onStep(i)}>{body}</button>
            ) : (
              <span className={tone}>{body}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
