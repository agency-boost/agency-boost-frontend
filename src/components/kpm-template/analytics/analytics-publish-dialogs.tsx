'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/field';
import type { CompanyTemplate } from '@/lib/admin';
import { freshKodes, monthLabel, type AdvancedAnalyticsConfig } from '@/lib/advanced-analytics';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { adminTemplateAnalyticsMessages } from '@/i18n/messages/admin-template-analytics';

/** What blocks a publish: the registered codes the agent-code format does not match (AA UI-018, Case 10). */
export interface Blocked {
  mismatched: number;
  total: number;
  examples: string[];
  pattern: string;
}

/**
 * ***Terbitkan Advanced analytics v<n>?* and *Belum bisa diterbitkan*** (P19.5-T1 AC-11, AC-15; spec §6), as
 * `useAnalyticsPublish` opens them: in a module of their own, loaded the first time one opens (the bundle, 2026-11-06).
 */
export function AnalyticsPublishDialogs({
  dialog,
  busy,
  view,
  config,
  onClose,
  onConfirm,
  onOpenUpload,
}: {
  dialog: null | 'confirm' | Blocked;
  busy: boolean;
  view: CompanyTemplate | undefined;
  config: AdvancedAnalyticsConfig | undefined;
  onClose: () => void;
  onConfirm: () => void;
  onOpenUpload: () => void;
}) {
  const t = useMessages(adminTemplateAnalyticsMessages).publish;
  const names = useMessages(adminTemplateAnalyticsMessages).sections.names;
  const language = useLanguage() === 'en' ? 'en' : 'id';
  const published = (view?.published?.payload as unknown as AdvancedAnalyticsConfig | undefined) ?? null;
  const fresh = config ? config.uploadFields.filter((f) => freshKodes(published, config).has(f.kode)) : [];
  const months = [...new Set(fresh.map((f) => monthLabel(f.effectiveFrom, language)))].join(', ');
  const off = config ? config.sections.filter((s) => !s.enabled) : [];
  const kpms = view?.analytics?.kpms ?? 0;

  return (
    <>
      <Modal
        open={dialog === 'confirm'}
        title={t.title({ v: view?.version ?? 1 })}
        onClose={onClose}
        className="max-w-[30rem]"
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>{t.cancel}</Button>
            <Button onClick={onConfirm} disabled={busy}>{t.confirm}</Button>
          </div>
        )}
      >
        <p className="text-md text-navy">{t.lead({ kpms })}</p>
        {config && (
          <ul className="mt-2.5 list-disc pl-5 text-md text-navy">
            <li>
              {t.columns({ n: config.uploadFields.length })}
              {fresh.length > 0 && t.columnsNew({ n: fresh.length, months })}. {t.columnsTail}
            </li>
            <li>{t.told}</li>
            <li>
              {t.shown({ on: config.sections.length - off.length, of: config.sections.length })}
              {off.length > 0 && t.hidden({ names: off.map((s) => names[s.kode]).join(', ') })}.
            </li>
            <li>{t.running}</li>
          </ul>
        )}
      </Modal>
      <Modal
        open={dialog !== null && dialog !== 'confirm'}
        title={t.blockedTitle}
        onClose={onClose}
        className="max-w-[30rem]"
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>{t.close}</Button>
            <Button onClick={() => { onClose(); onOpenUpload(); }}>{t.openUpload}</Button>
          </div>
        )}
      >
        {dialog !== null && dialog !== 'confirm' && (
          <>
            <p className="text-md text-navy">
              {t.blocked({
                n: dialog.mismatched, total: dialog.total, pattern: dialog.pattern, examples: dialog.examples.join(', '),
              })}
            </p>
            <p className="mt-2 text-sm text-muted">{t.blockedHint}</p>
          </>
        )}
      </Modal>
    </>
  );
}
