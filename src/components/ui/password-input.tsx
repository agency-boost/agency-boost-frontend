'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/cn';
import { TextInput } from './field';

/**
 * A password field you can read back.
 *
 * Every password box in the product is one of these, so the toggle cannot be present on
 * one screen and missing on the next — which is what six separate `type="password"`
 * inputs had already produced.
 *
 * **Why offer it at all.** The rule we ask people to follow is *"at least 10 characters,
 * length beats symbols"*, and a long passphrase is exactly the thing that is easy to
 * mistype and impossible to check. Masking defends against somebody reading over your
 * shoulder; it does nothing about the far commoner failure, which is typing a passphrase
 * wrong twice and being told only that the two do not match. The person decides which
 * risk is in the room — so it starts masked and they open it.
 *
 * Three things this gets right that a naive version does not:
 *
 * 1. **A real `<button type="button">`.** A `<span>` with an `onClick` is not reachable by
 *    keyboard, and a button without `type` submits the form it sits in — which on a
 *    sign-in page means revealing the password *and* attempting to log in.
 * 2. **The accessible name says what pressing it will do**, and changes when it does. A
 *    static "Toggle password" leaves a screen-reader user with no idea which state they
 *    are in; `aria-pressed` carries that, and the label carries the action.
 * 3. **It never becomes the only way to read the field.** The input keeps its own label,
 *    `autoComplete` and validation exactly as `TextInput` had them.
 *
 * The state is deliberately local and per-field. Revealing your current password should
 * not also reveal the new one two boxes down.
 */
export function PasswordInput({
  id,
  className,
  invalid,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { invalid?: boolean }) {
  const [shown, setShown] = useState(false);
  const fallbackId = useId();
  const inputId = id ?? fallbackId;

  return (
    <div className="relative flex">
      <TextInput
        {...props}
        id={inputId}
        type={shown ? 'text' : 'password'}
        invalid={invalid}
        // Room for the button, so a long value never runs underneath it.
        className={cn('w-full pr-16', className)}
      />
      <button
        type="button"
        // `aria-controls` rather than a label association: the button is not a second
        // label for the field, it is a control that acts on it.
        aria-controls={inputId}
        aria-pressed={shown}
        // The visible word is "Show"; the accessible name says what it shows. WCAG 2.5.3
        // is satisfied because the visible text is contained in the accessible name, and
        // a screen-reader user gets the noun a sighted user gets from the layout.
        aria-label={shown ? 'Hide password' : 'Show password'}
        onClick={() => setShown((was) => !was)}
        className={cn(
          'absolute inset-y-0 right-0 px-3 text-sm font-semibold text-muted',
          'underline hover:text-navy focus-visible:text-navy',
        )}
      >
        {shown ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
