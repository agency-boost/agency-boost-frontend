'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/field';
import { checkAgentCodes, type CompanyTemplate } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { freshKodes, monthLabel, type AdvancedAnalyticsConfig } from '@/lib/advanced-analytics';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { adminTemplateAnalyticsMessages } from '@/i18n/messages/admin-template-analytics';

/** What blocks a publish: the registered codes the agent-code format does not match (AA UI-018, Case 10). */
interface Blocked {
  mismatched: number;
  total: number;
  examples: string[];
  pattern: string;
}

/**
 * ***Terbitkan* for *Advanced analytics*** (P19.5-T1 AC-11, AC-15; spec §6): the agent-code format is tested over every
 * registered code first — any mismatch opens *Belum bisa diterbitkan*, naming up to five — else *Terbitkan Advanced
 * analytics v<n>?*, which says the section applies to **every KPM on the template**, existing ones included, and how
 * many; the columns, each new one with its start month; that the Owners and Admins are told; the sections shown and
 * hidden; and that running surveys keep their questions and cut-offs. The server refuses a mismatch the same way
 * (`409 ANALYTICS_CODE_PATTERN_MISMATCH`), and its answer opens the same dialog.
 */
export function useAnalyticsPublish({
  companyId,
  templateId,
  view,
  payload,
  flush,
  publish,
  onOpenUpload,
}: {
  companyId: string;
  templateId: string;
  view: CompanyTemplate | undefined;
  payload: Record<string, unknown> | undefined;
  /** Every edit saved first, so the dialog describes what will be published. */
  flush: () => Promise<boolean>;
  /** The section's own publish; its refusal comes back here. */
  publish: () => Promise<{ ok: boolean; error: ApiError | null }>;
  onOpenUpload: () => void;
}) {
  const t = useMessages(adminTemplateAnalyticsMessages).publish;
  const names = useMessages(adminTemplateAnalyticsMessages).sections.names;
  const language = useLanguage() === 'en' ? 'en' : 'id';
  const [dialog, setDialog] = useState<null | 'confirm' | Blocked>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const config = payload as unknown as AdvancedAnalyticsConfig | undefined;

  async function request() {
    if (!config) return;
    setError(null);
    setBusy(true);
    try {
      if (!(await flush())) return;
      const pattern = config.uploadRules.agentCodePattern;
      const check = await checkAgentCodes(companyId, templateId, pattern);
      setDialog(check.mismatched > 0 ? { ...check, pattern } : 'confirm');
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    const done = await publish();
    setBusy(false);
    if (done.error?.code === 'ANALYTICS_CODE_PATTERN_MISMATCH') {
      const d = done.error.details as { mismatched: number; total: number; examples: string[]; pattern?: string } | undefined;
      setDialog({
        mismatched: d?.mismatched ?? 0, total: d?.total ?? 0, examples: d?.examples ?? [],
        pattern: d?.pattern ?? config?.uploadRules.agentCodePattern ?? '',
      });
      return;
    }
    setDialog(null);
    setError(done.error);
  }

  const published = (view?.published?.payload as unknown as AdvancedAnalyticsConfig | undefined) ?? null;
  const fresh = config ? config.uploadFields.filter((f) => freshKodes(published, config).has(f.kode)) : [];
  const months = [...new Set(fresh.map((f) => monthLabel(f.effectiveFrom, language)))].join(', ');
  const off = config ? config.sections.filter((s) => !s.enabled) : [];
  const kpms = view?.analytics?.kpms ?? 0;

  const dialogs = (
    <>
      <Modal
        open={dialog === 'confirm'}
        title={t.title({ v: view?.version ?? 1 })}
        onClose={() => setDialog(null)}
        className="max-w-[30rem]"
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>{t.cancel}</Button>
            <Button onClick={() => void confirm()} disabled={busy}>{t.confirm}</Button>
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
        onClose={() => setDialog(null)}
        className="max-w-[30rem]"
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>{t.close}</Button>
            <Button onClick={() => { setDialog(null); onOpenUpload(); }}>{t.openUpload}</Button>
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

  return { request: () => void request(), busy, error, dialogs };
}
