import { useId } from 'react';
import { cn } from '@/lib/cn';
import type { ChoiceOption } from '../brief-card';

/**
 * **One question, any number of answers** (D-components; `.chips[data-multi="true"]`,
 * `Recruitment_Section.html:315`, `:325`, logic `:519-526`). Its user is the Recruitment Attack Plan
 * (**P17-T3**): *What's driving them* and *Their biggest hesitation*.
 *
 * Beside Phase 14's `ChoiceGroup`, which answers one, and drawn the same: a labelled group of toggle
 * buttons. The prototype marks a choice with a class alone (contradiction 10), so here the group is named
 * by its question and each chip says whether it is chosen (`aria-pressed`). A chip toggles itself and
 * leaves the others as they are.
 *
 * **The answer is in the chips' order, not the order clicked** (`:521`): `onChange` is handed the chosen
 * values as `options` lists them. The chips wrap on a phone. Props only — every word comes in.
 */
export function MultiChoiceGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly ChoiceOption<T>[];
  /** What is chosen. A value no option has is ignored. */
  value: readonly T[];
  onChange: (value: T[]) => void;
}) {
  const labelId = useId();
  const chosen = new Set(value);
  const toggle = (picked: T) => {
    const next = new Set(chosen);
    if (next.has(picked)) next.delete(picked);
    else next.add(picked);
    onChange(options.filter((o) => next.has(o.value)).map((o) => o.value));
  };
  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="m-0 mb-2.5 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = chosen.has(option.value);
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(option.value)}
              className={cn(
                'rounded-md border px-[15px] py-[9px] text-base font-semibold transition-colors',
                on ? 'border-navy bg-navy text-white' : 'border-hairline bg-base text-navy hover:border-navy',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
