'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { TEXT_TAP } from '@/components/ui/phone';
import { Toast, useToast } from '@/components/ui/toast';

/**
 * A value with a copy button.
 *
 * Two things the prototype's version gets wrong (`Overall.html:8836-8845`), and neither
 * is cosmetic:
 *
 * - It shows a truncated string and copies a different, longer one. The truncation is
 *   literal markup, so what you read is not what you get.
 * - It reports success whether or not the copy worked — the `catch` is empty and the
 *   toast fires regardless. Somebody then pastes nothing, having been told it copied.
 *
 * Here the value shown is the value copied, and a failure says so and leaves the text
 * selectable so it can be copied by hand.
 *
 * **A copy that worked also toasts** — *Link copied ✓* or *Code copied ✓*, the caller's `copied` (P18.95-T1
 * AC-6, ADR-0167 §5; UI-008) — through the shell's toast, beside the *Copied.* it has always said under the
 * button. **A copy that failed toasts nothing**: its sentence stays under the button, where the text to
 * select by hand is.
 */
export function CopyableValue({
  label,
  value,
  mono,
  action = 'Copy',
  border = 'solid',
  copied,
}: {
  label: string;
  value: string;
  /** The toast once the copy has worked: `CONFIRMED.linkCopied` or `CONFIRMED.codeCopied` (`lib/confirmations.ts`). */
  copied: string;
  mono?: boolean;
  /**
   * The button's own words. `User_Management_Section.html:447` and `:452` label them
   * `Copy link` and `Copy code` rather than a bare `Copy`, and with three artefacts side
   * by side a bare one leaves three identical buttons for a screen reader to distinguish.
   */
  action?: string;
  /** The prototype dashes the link box and leaves the code box solid (`:181`, `:190`). */
  border?: 'solid' | 'dashed';
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const { toast, show } = useToast();

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      // Absent in an insecure context and in some in-app browsers, which is exactly
      // where a field team will be reading this.
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(value);
      setState('copied');
      show(copied);
    } catch {
      setState('failed');
    }
  }

  return (
    <div
      className={cn(
        'rounded-md border border-hairline bg-base p-3',
        border === 'dashed' && 'border-dashed',
      )}
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p
        className={cn(
          'mt-1 break-all text-navy',
          mono ? 'font-mono text-xl font-bold' : 'text-md',
        )}
      >
        {value}
      </p>
      <button
        type="button"
        onClick={() => void copy()}
        className={cn('mt-2 text-md font-semibold text-navy underline', TEXT_TAP)}
      >
        {action}
      </button>
      {state !== 'idle' && (
        <p role="status" className={cn('mt-1 text-sm', state === 'copied' ? 'text-success' : 'text-alert')}>
          {state === 'copied'
            ? 'Copied.'
            : 'Could not copy — select the text above and copy it yourself.'}
        </p>
      )}
      <Toast toast={toast} />
    </div>
  );
}
