'use client';

import { useEffect, useId, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner } from '@/components/ui/field';
import { SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDayLong } from '@/lib/format';
import {
  readHistory, revertImport, type BatchView, type ImportResult, type MonthState,
} from '@/lib/production';
import { useCan } from '@/lib/session';
import { monthLabel } from './month-label';

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
  const t = useMessages(dataUploadMessages);
  const figures = useFigureLanguage();
  const allowed = useCan('data_upload:read_history');
  const canRevert = useCan('data_upload:revert_batch');
  const headingId = useId();
  const [batches, setBatches] = useState<BatchView[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [asking, setAsking] = useState<BatchView | null>(null);
  const [busy, setBusy] = useState(false);
  const label = monthLabel(month, figures);

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
      <h2 id={headingId} className="mb-2 font-display text-md font-bold text-navy">{t.importsFor({ month: label })}</h2>
      {error && <div className="mb-2"><ErrorBanner {...error} /></div>}

      {batches === null && !error && (
        <div aria-hidden="true" className="space-y-2">
          <SkeletonBar className="w-1/2" />
          <SkeletonBar className="w-2/3" />
        </div>
      )}

      {batches?.length === 0 && (
        <p className="text-sm text-muted">{t.nothingImported({ month: label })}</p>
      )}

      {batches && batches.length > 0 && (
        <ul className="rounded-lg border border-hairline bg-card px-4">
          {batches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline py-2.5 last:border-b-0">
              <div className="min-w-0">
                <p className="break-all font-semibold text-navy">{b.filename}</p>
                <p className="text-sm text-muted">
                  {t.importedBy({
                    by: b.committedBy,
                    day: b.committedAt ? formatDayLong(b.committedAt, figures) : null,
                    agents: b.writtenRowCount,
                    figures: b.cellCount,
                    notTaken: b.issueCount,
                  })}
                </p>
                {b.status === 'reverted' && (
                  <p className="text-sm text-muted">
                    {t.revertedBy({
                      by: b.revertedBy,
                      day: b.revertedAt ? formatDayLong(b.revertedAt, figures) : null,
                      restored: b.restoredCellCount,
                      kept: b.keptCellCount,
                    })}
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
                  {b.status === 'committed' ? t.standing : t.revertedTag}
                </span>
                {b.canRevert && canRevert && (
                  <Button variant="inlineDanger" disabled={busy || state.locked} onClick={() => setAsking(b)}>
                    {t.revert}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {revertable && canRevert && state.locked && (
        <p className="mt-2 text-sm text-muted">{t.lockedRevert({ month: label })}</p>
      )}

      <Dialog
        open={asking !== null}
        message={t.askRevert({ filename: asking?.filename ?? '', month: label })}
        confirmLabel={t.revertImport}
        cancelLabel={t.cancel}
        tone="danger"
        onConfirm={revert}
        onCancel={() => setAsking(null)}
      />
    </section>
  );
}
