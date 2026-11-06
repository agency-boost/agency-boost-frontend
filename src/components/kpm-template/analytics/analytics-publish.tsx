'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { checkAgentCodes, type CompanyTemplate } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import type { AdvancedAnalyticsConfig } from '@/lib/advanced-analytics';
import { useOpenedOnce } from '@/lib/use-opened-once';
import type { Blocked } from '@/components/kpm-template/analytics/analytics-publish-dialogs';

/**
 * **The two dialogs, loaded the first time one opens** (the bundle, 2026-11-06; `performance-and-scale.md`): every
 * section's page calls this hook, and only *Terbitkan* on *Advanced analytics* opens them — their words were the section
 * page's heaviest first-load module.
 */
const AnalyticsPublishDialogs = dynamic(
  () => import('@/components/kpm-template/analytics/analytics-publish-dialogs').then((m) => m.AnalyticsPublishDialogs),
  { ssr: false },
);

/**
 * ***Terbitkan* for *Advanced analytics*** (P19.5-T1 AC-11, AC-15; spec §6): the agent-code format is tested over every
 * registered code first — any mismatch opens *Belum bisa diterbitkan*, naming up to five — else *Terbitkan Advanced
 * analytics v<n>?*, which says the section applies to **every KPM on the template**, existing ones included, and how
 * many; the columns, each new one with its start month; that the Owners and Admins are told; the sections shown and
 * hidden; and that running surveys keep their questions and cut-offs. The server refuses a mismatch the same way
 * (`409 ANALYTICS_CODE_PATTERN_MISMATCH`), and its answer opens the same dialog. The dialogs themselves are
 * `analytics-publish-dialogs.tsx`'s.
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
  const [dialog, setDialog] = useState<null | 'confirm' | Blocked>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const config = payload as unknown as AdvancedAnalyticsConfig | undefined;
  const opened = useOpenedOnce(dialog !== null);

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

  const dialogs = opened ? (
    <AnalyticsPublishDialogs
      dialog={dialog}
      busy={busy}
      view={view}
      config={config}
      onClose={() => setDialog(null)}
      onConfirm={() => void confirm()}
      onOpenUpload={onOpenUpload}
    />
  ) : null;

  return { request: () => void request(), busy, error, dialogs };
}
