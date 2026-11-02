import { cn } from '@/lib/cn';
import { PlanIcon } from './plan-icons';

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
 *
 * **On a phone, one line that never wraps** (UI V1, UI-107: *a one-line step indicator* — Recruitment's broke onto two):
 * 13px, the line between the steps taking the room left, a step behind the current one a ✓ on the green tint
 * (`attack-plan-mobile` 3 and 5). From 768px as drawn.
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
    <ol
      aria-label={label}
      className="mb-[26px] flex list-none flex-wrap items-center gap-2.5 p-0 max-md:mx-0.5 max-md:my-3 max-md:flex-nowrap max-md:gap-2 max-md:whitespace-nowrap"
    >
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
                done && 'border-navy bg-navy text-white max-md:border-signal-green max-md:bg-pill-green max-md:text-signal-green',
                !on && !done && 'border-hairline text-muted max-md:border-line max-md:bg-card',
              )}
            >
              {done ? (
                <>
                  <span className="max-md:hidden">{i + 1}</span>
                  <PlanIcon name="check" className="h-3.5 w-3.5 md:hidden" />
                </>
              ) : i + 1}
            </span>
            <span className="sr-only">{i + 1} </span>
            {step}
          </>
        );
        const tone = cn('flex items-center gap-2 text-base font-semibold max-md:font-normal', on ? 'text-navy max-md:font-semibold' : 'text-muted');
        return (
          <li
            key={step}
            className={cn('flex items-center gap-2.5 max-md:gap-2', i > 0 && 'max-md:min-w-0 max-md:flex-1')}
            aria-current={on ? 'step' : undefined}
          >
            {i > 0 && <span aria-hidden="true" className="h-px w-9 bg-hairline max-md:h-[1.5px] max-md:w-auto max-md:min-w-3 max-md:flex-1 max-md:bg-line" />}
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
