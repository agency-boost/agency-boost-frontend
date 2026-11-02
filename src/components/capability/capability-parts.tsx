'use client';

import { ConfigBadge } from '@/components/ui/config-badge';
import { InlineSaveStatus, type InlineSaveStatusProps } from '@/components/ui/inline-save-status';
import { LineIcon } from '@/components/ui/line-icon';
import { TonePill } from '@/components/ui/tone-pill';
import { useMessages } from '@/i18n/language-provider';
import { coachingLeaderNotesMessages } from '@/i18n/messages/coaching-leader-notes';
import { cn } from '@/lib/cn';
import type { RungState } from '@/lib/capability-view';

/**
 * **The parts the *Capability mapping* tab and its ladder sheet share** (Phase 18.99 T10; UI-035, UI-037): a tick row,
 * a step of the progress line, the current stage's pill and the *Archived* badge. Their own file, so the sheet — loaded
 * only when it is opened — and the page draw one row one way.
 */

/**
 * The office stopped offering this row: it still renders where it was ticked, and is ticked anew nowhere (P11-T9
 * AC-3). The space is the label's, so a screen reader hears *Cold calling Archived*, not one word.
 */
export function ArchivedBadge() {
  const t = useMessages(coachingLeaderNotesMessages);
  return <>{' '}<ConfigBadge tone="navy" className="ml-1 align-middle">{t.archived}</ConfigBadge></>;
}

/**
 * **One tick row** (UI-037): the whole row is the target — the label wraps the box — at least 44px tall on a phone and
 * a tablet with a 22px box, 32px with an 18px box on a desktop. Its save says itself at the row's end (*Menyimpan… →
 * Tersimpan ✓*, P18.95-T1 AC-5), outside the label, so the box's name stays its words and a retry is its own button.
 */
export function TickRow({
  label, archived = false, checked, locked, muted = false, onChange, status,
}: {
  label: string;
  archived?: boolean;
  checked: boolean;
  /** Not tickable: the reader may not tick, the row or its section is archived, or the section does not apply. */
  locked: boolean;
  /** A section that does not apply: grey words, still readable (UI-038 — no 45% opacity). */
  muted?: boolean;
  onChange: (on: boolean) => void;
  status: InlineSaveStatusProps;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2 lg:min-h-8" data-tick-row="">
      <label
        className={cn(
          'flex min-h-11 min-w-0 flex-1 items-center gap-3 py-1 text-md font-medium leading-snug lg:min-h-8 lg:gap-2.5 lg:text-base',
          muted ? 'text-signal-grey' : 'text-navy',
          locked ? 'cursor-default' : 'cursor-pointer',
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-[22px] w-[22px] shrink-0 accent-success disabled:cursor-not-allowed lg:h-[18px] lg:w-[18px]"
        />
        <span className="min-w-0">
          {label}
          {archived && <ArchivedBadge />}
        </span>
      </label>
      <InlineSaveStatus {...status} label={label} className="shrink-0" />
    </div>
  );
}

/**
 * **A step of the ladder** (UI-035): done, the accent with a ✓; the current one, the accent with its number and a light
 * ring; one above, a grey outline. **Navy on the accent** — white on `#E8954A` is 2.38:1 (parity I-542). Not a status
 * dot (the report's *Rules*): it carries a number or a ✓, and the stage's name beside it says where the coachee is.
 */
export function StepMarker({ state, n, size = 'sm' }: { state: RungState; n: number; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      data-step={state}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold',
        size === 'sm' ? 'h-5 w-5 text-xs' : 'h-[26px] w-[26px] text-base lg:h-6 lg:w-6 lg:text-xs',
        state === 'next' ? 'border-2 border-line bg-card text-signal-grey' : 'bg-amber text-navy',
        state === 'current' && 'ring-4 ring-amber/40',
      )}
    >
      {state === 'done' ? <LineIcon name="check" className="h-3.5 w-3.5" /> : n}
    </span>
  );
}

/** *TAHAP SAAT INI* (UI-035): the current stage's pill, its words the catalogue's, set in capitals as the mockup draws. */
export function CurrentStagePill({ className }: { className?: string }) {
  const t = useMessages(coachingLeaderNotesMessages);
  return (
    <TonePill tone="amber" className={cn('font-bold uppercase tracking-wide', className)}>{t.currentStage}</TonePill>
  );
}
