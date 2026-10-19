import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * **The brief card** (D-components; `Overall.html:3795-3837`, styles `:2398-2410`): a title, a hint, and
 * the questions as groups of chips.
 *
 * Props only, so the Recruitment Attack Plan (**P17-T3**, its second user) asks a candidate's questions
 * with it. Its multiple choice (`Recruitment_Section.html:315`, `:325`) is P17-T3's to add; this asks
 * single-choice questions only.
 */
export function BriefCard({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="mb-5 rounded-lg border border-hairline bg-card px-5 py-[22px] sm:px-6" aria-label={title}>
      <h2 className="m-0 mb-[3px] text-lg font-bold text-navy">{title}</h2>
      <p className="m-0 mb-[18px] text-base text-muted">{hint}</p>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

export interface ChoiceOption<T extends string | number> {
  readonly value: T;
  readonly label: string;
}

/**
 * **One question, one answer**: a labelled group of toggle buttons (`.qgroup`, `.chips`).
 *
 * The prototype marks a choice with a class alone (`:9545-9548`), so a screen reader hears eight
 * identical buttons (contradiction 12). Here the group is named by its question and each chip says
 * whether it is chosen (`aria-pressed`); choosing one releases the others. The chips wrap on a phone.
 */
export function ChoiceGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="m-0 mb-2.5 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(option.value)}
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
