import { useId, type ReactNode } from 'react';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { cn } from '@/lib/cn';

/**
 * **A question's chips on a phone** (UI V1, UI-107; `attack-plan-mobile` 1 and 2; Mobile only): pill chips that wrap,
 * 38px to the eye and 6px apart — where they were two to a 44px row since P18.95-T6 — on the warm row ground, the chosen
 * one navy. Each takes a 44px tap (UI-010) through an invisible area 3px above and below it, which reaches the next
 * row's and no further. From 768px the chips are as drawn before.
 */
export const PLAN_CHIPS_PHONE = 'max-md:gap-1.5';
export const PLAN_CHIP_PHONE = 'max-md:relative max-md:h-[2.375rem] max-md:rounded-pill max-md:border-transparent '
  + 'max-md:px-3.5 max-md:py-0 max-md:leading-none '
  + "max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-[3px] max-md:after:content-['']";
/** An unchosen chip's ground on a phone: the warm row, no border. */
export const PLAN_CHIP_OFF_PHONE = 'max-md:bg-hover-row max-md:text-ink';

/**
 * **A question's label in sentence case on a phone** (UI-107: *sentence-case labels* — *Kebutuhan utama*, not
 * *KEBUTUHAN UTAMA*): 13px bold ink, where from 768px it stays the small uppercase label as drawn.
 */
export const PLAN_QUESTION_PHONE = 'max-md:mb-2 max-md:mt-3.5 max-md:text-base max-md:normal-case max-md:tracking-normal '
  + 'max-md:text-ink';

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
    // On a phone (UI-107): a white card 14px by 12px, the question 16px, and **no grey line** under it (D-08).
    <section className="mb-5 rounded-lg border border-card-edge bg-card px-5 py-[22px] sm:px-6 max-md:mb-0 max-md:px-3 max-md:py-3.5" aria-label={title}>
      <h2 className="m-0 mb-[3px] text-lg font-bold text-navy max-md:mb-0.5">{title}</h2>
      <p className={cn('m-0 mb-[18px] text-base text-muted', REMOVED_ON_PHONE)}>{hint}</p>
      <div className="flex flex-col gap-5 max-md:gap-0">{children}</div>
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
 * whether it is chosen (`aria-pressed`); choosing one releases the others.
 *
 * **Below 768px the chips are pills that wrap** (UI V1, UI-107; `PLAN_CHIP_PHONE`), where P18.95-T6 had them two to a
 * row; the label is in sentence case. At 768px and wider they wrap as drawn.
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
    // `data-question` and `data-answered`: on a phone the plan's button finds the first question left open (UI-107).
    <div role="group" aria-labelledby={labelId} tabIndex={-1} data-question="" data-answered={value !== null}>
      <p id={labelId} className={cn('m-0 mb-2.5 text-xs font-bold uppercase tracking-wide text-muted', PLAN_QUESTION_PHONE)}>{label}</p>
      <div className={cn('flex flex-wrap gap-2', PLAN_CHIPS_PHONE)}>
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
                PLAN_CHIP_PHONE,
                on ? 'border-navy bg-navy text-white' : cn('border-hairline bg-base text-navy hover:border-navy', PLAN_CHIP_OFF_PHONE),
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
