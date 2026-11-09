'use client';

import { useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { cn } from '@/lib/cn';
import { LEAD_AGE_MAX, LEAD_AGE_MIN, type LeadGender } from '@/lib/leads';

/**
 * **The client's age at the next birthday** (P19.7-T1 AC-1; the proposal spec's step 1, Acc. 6; ADR-0224): *Umur ulang
 * tahun berikutnya*, a number box with a large − and + on either side. Tapping the box opens the number keypad
 * (`inputMode="numeric"`); there is no slider and no long dropdown, and any exact value can be typed.
 *
 * - **Optional**: empty is *no age*, and − or + on an empty box gives `start` (30) — a likely age to step from rather
 *   than seventy taps from 1.
 * - **The bounds are the API's** (`LEAD_AGE_MIN`, `LEAD_AGE_MAX`, held to the API document by `contract.spec.ts`): −
 *   and + stop at them; a typed age outside them is shown as typed, marked invalid with *"Umur harus 1–100."*, and the
 *   server refuses it too (`422 LEAD_AGE_OUT_OF_RANGE`).
 * - **48px targets** (the spec's *buttons at least 48px high*), the box a pill, the selection colour the field's own.
 *
 * The lead sheet uses it in *+ Tambah lead* and on a lead; P19.7-T2's step 1 uses it for *Klien baru*.
 */
export function AgeStepper({
  id,
  value,
  onChange,
  disabled = false,
  start = 30,
  describedBy,
}: {
  id: string;
  /** The box's text: digits, or empty for no age. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Where − or + starts from an empty box. */
  start?: number;
  /** Extra text the box is described by — a hint above it, say. */
  describedBy?: string;
}) {
  const t = useMessages(leadsMessages).sheet;
  const typed = value.trim() === '' ? null : Number(value);
  const invalid = typed !== null && !(Number.isInteger(typed) && typed >= LEAD_AGE_MIN && typed <= LEAD_AGE_MAX);
  const step = (by: -1 | 1) => {
    // From an empty box, either button gives `start`; from an age, one year either way, within the bounds.
    const next = typed === null || !Number.isInteger(typed) ? start : typed + by;
    onChange(String(Math.min(LEAD_AGE_MAX, Math.max(LEAD_AGE_MIN, next))));
  };
  const BUTTON = cn(
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-hover-row text-xl font-bold text-navy',
    'hover:bg-secondary/[0.08] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40',
  );
  const errorId = `${id}-error`;

  return (
    <div>
      <div className="flex items-center gap-2" role="group" aria-labelledby={`${id}-label`}>
        <button
          type="button"
          className={BUTTON}
          aria-label={t.ageLess}
          aria-controls={id}
          disabled={disabled || (typed !== null && typed <= LEAD_AGE_MIN)}
          onClick={() => step(-1)}
        >
          <span aria-hidden="true">−</span>
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={3}
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={[invalid ? errorId : null, describedBy ?? null].filter(Boolean).join(' ') || undefined}
          placeholder="–"
          // Digits only: a letter or a mark never reaches the box.
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          className={cn(
            'h-12 w-20 min-w-0 rounded-pill border-0 bg-hover-row text-center text-xl font-bold text-ink',
            'disabled:opacity-40',
            invalid && 'shadow-[inset_0_0_0_1.5px_var(--color-signal-red)]',
          )}
        />
        <button
          type="button"
          className={BUTTON}
          aria-label={t.ageMore}
          aria-controls={id}
          disabled={disabled || (typed !== null && typed >= LEAD_AGE_MAX)}
          onClick={() => step(1)}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {invalid && (
        <p id={errorId} className="mt-1 text-sm text-signal-red">{t.ageOutOfRange({ min: LEAD_AGE_MIN, max: LEAD_AGE_MAX })}</p>
      )}
    </div>
  );
}

/**
 * ***Laki-laki* / *Perempuan***, two large buttons (P19.7-T1 AC-1; the spec's step 1; ADR-0224 §1). Optional: the chosen
 * one, tapped again, clears it. A radio group, so a screen reader hears one choice of two.
 */
export function GenderButtons({
  value,
  onChange,
  disabled = false,
  labelledBy,
}: {
  value: LeadGender | null;
  onChange: (next: LeadGender | null) => void;
  disabled?: boolean;
  /** The id of the visible label (*Jenis kelamin*). */
  labelledBy: string;
}) {
  const t = useMessages(leadsMessages).sheet;
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-2">
      {(['male', 'female'] as const).map((gender) => {
        const chosen = value === gender;
        return (
          <button
            key={gender}
            type="button"
            role="radio"
            aria-checked={chosen}
            disabled={disabled}
            onClick={() => onChange(chosen ? null : gender)}
            className={cn(
              'min-h-12 rounded-pill px-4 text-md font-semibold disabled:cursor-not-allowed disabled:opacity-40',
              chosen ? 'bg-secondary text-secondary-contrast' : 'bg-hover-row text-muted hover:text-navy',
            )}
          >
            {t.genders[gender]}
          </button>
        );
      })}
    </div>
  );
}
