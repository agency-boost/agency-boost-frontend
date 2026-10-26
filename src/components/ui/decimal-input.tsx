'use client';

import { useEffect, useState } from 'react';
import { TextInput } from '@/components/ui/field';
import { parseDecimal } from '@/lib/format';

/**
 * **A field that takes a decimal, typed with a comma or a point** (ADR-0167 §1, P18.95-T1 AC-3; parity I-395).
 *
 * `id-ID` writes a decimal with a comma, *1,4*, and a `type="number"` field refuses one in most browsers — it
 * answers an empty value, so an agent typing their closing rate the way every figure around it is written saw
 * the box clear. This is text with the decimal keypad, holding **what was typed** (so *3,* survives the keystroke
 * that makes it *3,5*) and reporting the number it reads (`parseDecimal`): `null` for an empty box, nothing at all
 * while the text is not a number yet.
 *
 * A value set from outside — a reload, a reset — replaces the text, written with a comma.
 */
export function DecimalInput({
  value, onValueChange, ...props
}: Omit<React.ComponentProps<typeof TextInput>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
}) {
  const [typed, setTyped] = useState(() => written(value));

  // Follow a value that changed underneath the box, and leave one the box itself produced alone.
  useEffect(() => {
    setTyped((current) => (sameValue(current, value) ? current : written(value)));
  }, [value]);

  return (
    <TextInput
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={typed}
      onChange={(e) => {
        // Digits, one separator and a sign are all a decimal can hold; anything else never reaches the box.
        const next = e.target.value.replace(/[^\d.,-]/g, '');
        setTyped(next);
        if (next.trim() === '') return onValueChange(null);
        const read = parseDecimal(next);
        if (Number.isFinite(read)) onValueChange(read);
      }}
    />
  );
}

/** A number as the box shows it: `3,5`, with no grouping — the values a decimal field takes are small. */
function written(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '' : String(value).replace('.', ',');
}

function sameValue(typed: string, value: number | null): boolean {
  if (value === null) return typed.trim() === '';
  return parseDecimal(typed) === value;
}
