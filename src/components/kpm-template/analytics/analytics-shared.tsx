'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import type { AdvancedAnalyticsConfig, AnalyticsEditorView } from '@/lib/advanced-analytics';

/**
 * **What every tab of the *Advanced analytics* editor reads** (P19.5-T1): the payload, the server's view beside it, the
 * published version (what is *Baru*), the language the template's own words are shown in (the editor's ID|EN switch),
 * and the change that saves the draft.
 */
export interface AnalyticsTabProps {
  config: AdvancedAnalyticsConfig;
  view: AnalyticsEditorView | null;
  published: AdvancedAnalyticsConfig | null;
  onChange: (next: AdvancedAnalyticsConfig) => void;
  disabled: boolean;
  companyId: string;
  templateId: string;
}

/** The language the template's words are drawn in: the reader's at first, the switch's after. */
export const ContentLanguage = createContext<'id' | 'en'>('id');
export const useContentLanguage = () => useContext(ContentLanguage);

/**
 * **A number typed, kept as typed until it is one the field takes** (the mockup's threshold inputs): a value outside
 * `min`..`max`, or not a number, is held here and drawn invalid — never sent, so a half-typed figure never meets the
 * server's refusal. `null` is allowed only where `nullable` (*Nilai terbesar*'s *Tanpa batas*).
 */
export function NumberBox({
  id,
  value,
  min,
  max,
  step,
  label,
  onValue,
  disabled,
  nullable = false,
  placeholder,
  invalid = false,
  className,
  describedBy,
}: {
  id?: string;
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  /** The field's name for a screen reader, where no `<label>` names it. */
  label?: string;
  onValue: (next: number | null) => void;
  disabled?: boolean;
  nullable?: boolean;
  placeholder?: string;
  /** Invalid for a reason outside the field: two fields that disagree. */
  invalid?: boolean;
  className?: string;
  describedBy?: string;
}) {
  const [typed, setTyped] = useState(value === null ? '' : String(value));
  useEffect(() => { setTyped(value === null ? '' : String(value)); }, [value]);
  const read = (raw: string): number | null | undefined => {
    if (raw.trim() === '') return nullable ? null : undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    if ((min !== undefined && n < min) || (max !== undefined && n > max)) return undefined;
    if (step === undefined && !Number.isInteger(n)) return undefined;
    return n;
  };
  const bad = read(typed) === undefined;
  return (
    <input
      id={id}
      type="number"
      inputMode={step === undefined ? 'numeric' : 'decimal'}
      min={min}
      max={max}
      step={step}
      value={typed}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={bad || invalid || undefined}
      aria-describedby={describedBy}
      disabled={disabled}
      onWheel={(e) => e.currentTarget.blur()}
      onChange={(e) => {
        setTyped(e.target.value);
        const next = read(e.target.value);
        if (next !== undefined && next !== value) onValue(next);
      }}
      className={cn(
        'h-10 rounded-md border bg-card px-3 text-right text-md tabular-nums text-navy',
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        'focus-visible:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring',
        // 44px below 1024px (P19.2-T2 AC-5; UI-135: *≥ 44px on mobile and tablet*), where it was the phone's alone.
        'disabled:opacity-60 max-lg:h-11',
        bad || invalid ? 'border-alert' : 'border-hairline',
        className,
      )}
    />
  );
}

/**
 * **A switch named for what it does** — *Tampilkan Demografi KPM* — with no words beside it, as the mockup draws the
 * *Bagian* rows' switches. The project's `Switch` always prints its label; here the row's own name is the words, so
 * the label is the switch's accessible name only. A 44 × 44px target below 1024px.
 */
export function NamedSwitch({
  id,
  name,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <span className="relative inline-flex h-[22px] w-[38px] shrink-0 items-center max-lg:mx-[3px] max-lg:my-[11px]">
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-label={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          'peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed',
          'max-lg:left-1/2 max-lg:top-1/2 max-lg:h-11 max-lg:w-11 max-lg:-translate-x-1/2 max-lg:-translate-y-1/2',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 rounded-pill bg-hairline transition-colors',
          'peer-checked:bg-success peer-disabled:opacity-40',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-focus-ring',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute left-[3px] h-4 w-4 rounded-full bg-card shadow-sm transition-transform',
          'peer-checked:translate-x-4 peer-disabled:opacity-40',
        )}
      />
    </span>
  );
}

/** A kode as the mockup draws it: monospaced, on a field-grey chip. */
export function Kode({ children }: { children: string }) {
  return (
    <span className="rounded-sm bg-pill-grey px-1.5 py-px font-mono text-xs font-normal text-muted">{children}</span>
  );
}

/** A small bordered tag: *Butuh: …*, a reader in *Dipakai di*. */
export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-sm border border-hairline bg-card px-1.5 py-px text-xs text-muted">
      {children}
    </span>
  );
}

/** A heading row: the title, its hint below, and what stands at its right. */
export function RowHead({ title, hint, children, id }: { title: string; hint?: string; children?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-2.5 mt-6 flex flex-wrap items-center gap-3 first:mt-0">
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-lg font-bold text-navy">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
