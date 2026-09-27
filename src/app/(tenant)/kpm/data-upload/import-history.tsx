'use client';

import { useEffect, useId, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner } from '@/components/ui/field';
import { SkeletonBar } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDayLong } from '@/lib/format';
import {
  readHistory, revertImport, type BatchView, type ImportResult, type MonthState,
} from '@/lib/production';
import { useCan } from '@/lib/session';
import { monthLabel, plural } from './month-label';

/**
 * **Every import of the month, and the way back from the latest** (P9-T4).
 *
 * The prototype keeps no record of an import at all — its commit ends in an `alert()` and the file is
 * forgotten (F-81). Here each one says what it was, who confirmed it and when, what it wrote and what
 * it did not take; and the month's latest standing import can be reverted, behind a confirmation,
 * with `revert_batch`. Only the latest, because undoing one underneath another would put back values
 * the later one had already replaced.
 */
export function ImportHistory({
  month, state, generation, onReverted,
}: {
  month: string;
  state: MonthState;
  /** Advanced by the page after any write, so the list is read again. */
  generation: number;
  onReverted: (result: ImportResult) => void;
}) {
  const allowed = useCan('data_upload:read_history');
  const canRevert = useCan('data_upload:revert_batch');
  const headingId = useId();
  const [batches, setBatches] = useState<BatchView[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [asking, setAsking] = useState<BatchView | null>(null);
  const [busy, setBusy] = useState(false);
  const label = monthLabel(month);

  useEffect(() => {
    if (!allowed) return undefined;
    let live = true;
    setError(null);
    readHistory(month)
      .then((h) => { if (live) setBatches(h.batches); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [allowed, month, generation]);

  if (!allowed) return null;

  const revert = async () => {
    const batch = asking!;
    setAsking(null);
    setBusy(true);
    setError(null);
    try {
      onReverted(await revertImport(batch.id));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  };

  const revertable = batches?.some((b) => b.canRevert) ?? false;

  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className="mb-2 font-display text-md font-bold text-navy">Imports for {label}</h2>
      {error && <div className="mb-2"><ErrorBanner {...error} /></div>}

      {batches === null && !error && (
        <div aria-hidden="true" className="space-y-2">
          <SkeletonBar className="w-1/2" />
          <SkeletonBar className="w-2/3" />
        </div>
      )}

      {batches?.length === 0 && (
        <p className="text-sm text-muted">Nothing has been imported for {label} yet.</p>
      )}

      {batches && batches.length > 0 && (
        <ul className="rounded-lg border border-hairline bg-card px-4">
          {batches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline py-2.5 last:border-b-0">
              <div className="min-w-0">
                <p className="break-all font-semibold text-navy">{b.filename}</p>
                <p className="text-sm text-muted">
                  Imported by {b.committedBy ?? 'somebody'}
                  {b.committedAt ? ` on ${formatDayLong(b.committedAt)}` : ''}
                  {' · '}{plural(b.writtenRowCount, 'agent')}, {plural(b.cellCount, 'figure')}
                  {b.issueCount ? `, ${b.issueCount} not taken` : ''}
                </p>
                {b.status === 'reverted' && (
                  <p className="text-sm text-muted">
                    Reverted by {b.revertedBy ?? 'somebody'}
                    {b.revertedAt ? ` on ${formatDayLong(b.revertedAt)}` : ''}
                    {' — '}{plural(b.restoredCellCount, 'figure')} put back
                    {b.keptCellCount ? `, ${b.keptCellCount} kept because something changed them since` : ''}.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-wide',
                    b.status === 'committed' ? 'bg-navy/[0.06] text-navy' : 'bg-hairline/60 text-muted',
                  )}
                >
                  {b.status === 'committed' ? 'Standing' : 'Reverted'}
                </span>
                {b.canRevert && canRevert && (
                  <Button variant="inlineDanger" disabled={busy || state.locked} onClick={() => setAsking(b)}>
                    Revert
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {revertable && canRevert && state.locked && (
        <p className="mt-2 text-sm text-muted">{label} is locked — reopen it to revert an import.</p>
      )}

      <Dialog
        open={asking !== null}
        message={`Revert “${asking?.filename ?? ''}”? Every figure it wrote into ${label} goes back to what it was before — empty where it was empty.`}
        confirmLabel="Revert import"
        tone="danger"
        onConfirm={revert}
        onCancel={() => setAsking(null)}
      />
    </section>
  );
}
