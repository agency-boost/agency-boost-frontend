'use client';

import { useState } from 'react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Dialog } from '@/components/ui/dialog';
import { LineIcon } from '@/components/ui/line-icon';
import { SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { dataUploadMessages } from '@/i18n/messages/data-upload';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { revertImport, type BatchView, type ImportResult } from '@/lib/production';
import { useCan } from '@/lib/session';

/**
 * **Riwayat unggah · <Bulan YYYY>** (P19.21-T1 AC-7; frames 4, 8): each upload of the month that went through, newest
 * first — the file, the day and time, *oleh NAME*, *n ke anggota* (green) and *n belum jadi anggota* — or *"Belum ada
 * unggahan untuk November 2026."*.
 *
 * **Undoing the latest upload stays** (P9-T4; the owner's rule that fidelity work never strips a feature): a ⋯ on its row,
 * for whoever holds `data_upload:revert_batch` while the month is open, asked once. An undone upload says so.
 */
export function UploadHistory({
  batches, title, zone, locked, onUndone,
}: {
  /** `null` while it is read. */
  batches: readonly BatchView[] | null;
  title: string;
  zone: string;
  locked: boolean;
  onUndone: (result: ImportResult) => void;
}) {
  const t = useMessages(dataUploadMessages);
  const figures = useFigureLanguage();
  const canUndo = useCan('data_upload:revert_batch');
  const [asking, setAsking] = useState<BatchView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const undo = async (batch: BatchView) => {
    setAsking(null);
    setError(null);
    try {
      onUndone(await revertImport(batch.id));
    } catch (err) {
      setError(toDisplayError(err));
    }
  };

  return (
    <section aria-labelledby="upload-history" className="flex flex-col gap-2">
      <h2 id="upload-history" className="text-md font-bold text-navy">{t.historyOf({ month: title })}</h2>
      <div className="rounded-lg bg-card">
        {batches === null ? (
          <div className="p-4"><SkeletonBar className="h-5 w-2/3" /></div>
        ) : batches.length === 0 ? (
          <p className="px-4 py-3 text-md text-muted">{t.noUploads({ month: title })}</p>
        ) : (
          <ul>
            {batches.map((batch) => (
              <li key={batch.id} data-batch={batch.id} className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-2.5 last:border-b-0">
                <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-hover-row text-navy">
                  <LineIcon name="document" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-md text-navy">{batch.filename}</b>
                  <small className="block text-sm text-muted">
                    {t.uploadedBy({ when: batch.committedAt ? formatDateTime(batch.committedAt, zone, figures) : '', who: batch.committedBy })}
                  </small>
                </span>
                {batch.status === 'reverted' ? (
                  <span className="rounded-pill bg-pill-grey px-2.5 py-1 text-sm font-bold text-pill-grey-ink">{t.revertedTag}</span>
                ) : (
                  <span className="flex flex-wrap gap-1.5">
                    <span className="rounded-pill bg-pill-green px-2.5 py-1 text-sm font-bold text-pill-green-ink">
                      {t.toMembers({ count: batch.memberRowCount ?? Math.max(0, batch.writtenRowCount - (batch.heldRowCount ?? 0)) })}
                    </span>
                    {(batch.heldRowCount ?? 0) > 0 && (
                      <span className="rounded-pill bg-secondary-50 px-2.5 py-1 text-sm font-bold text-navy">
                        {t.notYet({ count: batch.heldRowCount ?? 0 })}
                      </span>
                    )}
                  </span>
                )}
                {batch.canRevert && canUndo && !locked && (
                  <ActionMenu
                    glyph="⋯"
                    label={t.historyActions({ filename: batch.filename })}
                    items={[{ label: t.undoUpload, tone: 'alert', onSelect: () => setAsking(batch) }]}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-alert">{error.message}</p>}
      <Dialog
        open={asking !== null}
        message={asking ? t.askUndo({ filename: asking.filename, month: title }) : ''}
        confirmLabel={t.undoUpload}
        cancelLabel={t.cancel}
        tone="danger"
        onConfirm={() => { if (asking) void undo(asking); }}
        onCancel={() => setAsking(null)}
      />
    </section>
  );
}
