'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

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
 */
export function CopyableValue({
  label,
  value,
  mono,
  action = 'Copy',
  border = 'solid',
}: {
  label: string;
  value: string;
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
        className="mt-2 text-md font-semibold text-navy underline"
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
    </div>
  );
}
