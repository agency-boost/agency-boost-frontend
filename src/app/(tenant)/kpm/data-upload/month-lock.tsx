'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner } from '@/components/ui/field';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatDayLong } from '@/lib/format';
import { lockMonth, reopenMonth, type MonthState } from '@/lib/production';
import { useCan } from '@/lib/session';
import { monthLabel } from './month-label';

/** What the month's state means, in a sentence a reader can act on (ADR-0050). */
export function describeLock(state: MonthState): string {
  const who = state.changedBy ?? 'somebody';
  const when = state.changedAt ? formatDayLong(state.changedAt) : '';
  switch (state.reason) {
    case 'open':
      return `Open for imports and corrections until ${formatCalendarDay(state.editableUntil)}, when it locks.`;
    case 'schedule':
      return `Locked — its window closed after ${formatCalendarDay(state.editableUntil)}. Reopen it to change its figures.`;
    case 'locked_by_hand':
      return `Locked by ${who}${when ? ` on ${when}` : ''}. Reopen it to change its figures.`;
    default:
      return `Reopened by ${who}${when ? ` on ${when}` : ''}. It stays open until somebody locks it again.`;
  }
}

/**
 * **Is this month open, and why** — with the one act that changes it (P9-T4, ADR-0050).
 *
 * The prototype has no notion of a month ending (L-38). The lock is enforced by the writes; this
 * line is how a reader learns of it before a write is refused, and the button is `lock_month` or
 * `reopen_month`, each behind a confirmation because each is audited and each changes what everybody
 * in the office can do to the month.
 */
export function MonthLock({ state, onChanged }: { state: MonthState; onChanged: (next: MonthState) => void }) {
  const canLock = useCan('data_upload:lock_month');
  const canReopen = useCan('data_upload:reopen_month');
  const [asking, setAsking] = useState<'lock' | 'reopen' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const label = monthLabel(state.month);

  const act = async () => {
    const which = asking;
    setAsking(null);
    setBusy(true);
    setError(null);
    try {
      onChanged(await (which === 'lock' ? lockMonth : reopenMonth)(state.month));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span
          className={cn(
            'rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-wide',
            state.locked ? 'bg-alert/10 text-alert' : 'bg-navy/[0.06] text-navy',
          )}
        >
          {state.locked ? 'Locked' : 'Open'}
        </span>
        <span className="text-muted">{describeLock(state)}</span>
        {!state.locked && canLock && (
          <Button variant="inline" disabled={busy} onClick={() => setAsking('lock')}>Lock month</Button>
        )}
        {state.locked && canReopen && (
          <Button variant="inline" disabled={busy} onClick={() => setAsking('reopen')}>Reopen month</Button>
        )}
      </div>
      {error && <div className="mt-2"><ErrorBanner {...error} /></div>}
      <Dialog
        open={asking !== null}
        message={asking === 'lock'
          ? `Lock ${label}? Imports, reverts and corrections to it will be refused until somebody reopens it.`
          : `Reopen ${label}? Its figures can be imported, reverted and corrected again until somebody locks it.`}
        confirmLabel={asking === 'lock' ? 'Lock month' : 'Reopen month'}
        onConfirm={act}
        onCancel={() => setAsking(null)}
      />
    </div>
  );
}
