'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useMessages } from '@/i18n/language-provider';
import { trainingSettingsMessages } from '@/i18n/messages/training-settings';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  applyTemplateSync, readTemplateSync,
  type TemplateSyncResult, type TemplateSyncView,
} from '@/lib/template-sync';

/**
 * ***Sinkron dari template*** (OD-270, ADR-0220 §4; UI-161): a control in Settings › Training's toolbar, **shown only when
 * the KPM's names differ from its template's**, and the dialog it opens — every difference by code, the KPM's words
 * beside the template's, before anything is written. *Terapkan* sends what the dialog read (the template versions and the
 * KPM's revision), so a list that went stale is refused `409` rather than applied.
 *
 * The Owner's and the Admins' to apply. Anybody else who reads the screen — the Super Admin in a view-as — sees the list
 * and no *Terapkan*; the API refuses the write either way.
 */
export function TemplateSyncControl({
  canWrite, refreshKey, onApplied, onError,
}: {
  canWrite: boolean;
  /** Read again when this moves: after the page saves, its training — and so its revision — changed. */
  refreshKey: number;
  /** After an apply, with what it did: the page reads its rows and the publish bar again. */
  onApplied: (result: TemplateSyncResult) => void;
  /** A refusal, for the page's own error banner. */
  onError: (error: ApiError) => void;
}) {
  const t = useMessages(trainingSettingsMessages).sync;
  const ui = useMessages(uiV1Messages);
  const [view, setView] = useState<TemplateSyncView | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setView(await readTemplateSync());
    } catch {
      // The control is an extra: a failed read shows none, and the screen it sits on is unaffected.
      setView(null);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  // Nothing to take — or an answer of another shape — draws nothing (ADR-0220 §4: shown only when something differs).
  if (!view || !Array.isArray(view.differences) || view.differences.length === 0) return null;

  async function apply() {
    if (!view) return;
    setBusy(true);
    try {
      const result = await applyTemplateSync(view);
      setOpen(false);
      onApplied(result);
      await load();
    } catch (err) {
      setOpen(false);
      onError(toDisplayError(err));
      // A stale list is refused; read what is true now.
      await load();
    } finally {
      setBusy(false);
    }
  }

  const name = view.template?.name;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>{t.button}</Button>
      <Modal
        open={open}
        placement="responsive"
        handle
        closeLabel={ui.close}
        title={t.title}
        description={name ? t.lead({ template: name }) : t.leadNoName}
        onClose={() => setOpen(false)}
        footer={(
          <div className="flex flex-wrap items-center gap-2.5">
            {canWrite ? (
              <Button disabled={busy} onClick={() => void apply()}>{busy ? t.applying : t.apply}</Button>
            ) : (
              <p className="text-sm text-muted">{t.readOnly}</p>
            )}
            <Button variant="secondary" onClick={() => setOpen(false)}>{t.cancel}</Button>
          </div>
        )}
      >
        <ul className="flex flex-col divide-y divide-hairline" aria-label={t.title}>
          {view.differences.map((d) => (
            <li key={`${d.level}:${d.code}:${d.field}`} className="py-2.5" data-difference={`${d.level}:${d.code}:${d.field}`}>
              <p className="text-sm font-semibold text-muted">
                {t.level[d.level]} · {t.field[d.field]} · <span className="font-mono">{d.code}</span>
              </p>
              <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-md">
                <dt className="text-muted">{t.now}</dt>
                <dd className="break-words text-navy">{d.from ?? <span className="text-muted">{t.none}</span>}</dd>
                <dt className="text-muted">{t.fromTemplate}</dt>
                <dd className="break-words font-semibold text-navy">{d.to ?? <span className="font-normal text-muted">{t.none}</span>}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
