'use client';

import { useEffect, useState } from 'react';
import { DraftBar, useVersionWords } from '@/components/kpm-template/draft-bar';
import { KindEditor } from '@/components/kpm-template/kind-editor';
import { useTemplateDrafts } from '@/components/kpm-template/use-template-drafts';
import { SettingsTabs } from '@/components/settings-tabs';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LeaveGuard } from '@/components/ui/save-state';
import { SkeletonCards } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import type { ApiError } from '@/lib/api-client';
import { listMetrics, type MetricDefinition } from '@/lib/tenant-config';
import { CAMPAIGN_PARTS } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/**
 * **The company's carrier rules** (`campaign_kinds`, ADR-0026, ADR-0034): production club tiers, Maintenance of Contract
 * and promotion paths, each a pill, through the existing editor, its draft saved as it is made. Moved here from the old
 * *Pengaturan perusahaan* tab (P19.23-T4 AC-4): *Pengaturan template*'s *Campaigns* row opens it.
 *
 * **Publishing, for an insurer, is *Terbitkan ke KPM*'s** (ADR-0278 §7: nothing automatic): `onPublish` takes the reader
 * there. The Default template has no KPM, so its *Terbitkan* asks and publishes here, as before.
 */
export function CampaignRules({ companyId, onPublish }: { companyId: string; onPublish?: () => void }) {
  const words = useMessages(adminTemplateMessages);
  const drafts = useTemplateDrafts({ companyId, templateId: null, kinds: ['campaign_kinds'] });
  const [tab, selectTab] = useState<string>(CAMPAIGN_PARTS[0].key);
  const part = CAMPAIGN_PARTS.find((p) => p.key === tab) ?? CAMPAIGN_PARTS[0];
  const draft = drafts.drafts.campaign_kinds;
  const version = useVersionWords(draft?.view, true);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [asking, setAsking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<ApiError | null>(null);
  const { toast, show } = useToast();

  // A rule editor with no metric list can still edit names and ranks: a failure here does not take it down.
  useEffect(() => {
    void listMetrics().then(setMetrics).catch(() => setMetrics([]));
  }, []);

  async function publish() {
    setAsking(false);
    setPublishing(true);
    setPublishError(null);
    const done = await drafts.publish();
    setPublishing(false);
    setPublishError(done.error);
    if (done.ok) show(words.editor.published);
  }

  const state = drafts.saving ? 'saving' : drafts.dirty || drafts.error ? 'unsaved' : 'saved';

  return (
    <>
      <SettingsTabs
        variant="subtabs"
        touch
        label={words.editor.parts({ section: words.settings.campaigns })}
        tabs={CAMPAIGN_PARTS.map((p) => ({ label: words.pills[p.key as keyof typeof words.pills], href: `#${p.key}` }))}
        activeHref={`#${part.key}`}
        onSelect={(href) => selectTab(href.slice(1))}
      />
      {drafts.loadError && (
        <div className="mb-4 flex flex-col gap-2">
          <ErrorBanner {...drafts.loadError} />
          <Button variant="secondary" className="self-start" onClick={drafts.retryLoad}>{words.editor.retry}</Button>
        </div>
      )}
      {!drafts.loadError && !drafts.ready && <SkeletonCards count={3} label={words.editor.loading} />}
      {drafts.ready && draft && (
        <>
          <DraftBar
            state={state}
            version={version}
            archived={false}
            publishable={drafts.publishable}
            publishing={publishing}
            saveError={drafts.error}
            publishError={publishError}
            onRetry={() => void drafts.flush()}
            onReload={drafts.retryLoad}
            onPublish={() => (onPublish ? onPublish() : setAsking(true))}
          />
          <KindEditor
            kind="campaign_kinds"
            half={part.half}
            view={draft.view}
            payload={draft.payload}
            onChange={(next) => drafts.change('campaign_kinds', next)}
            disabled={publishing}
            metrics={metrics}
          />
        </>
      )}
      <Dialog
        open={asking}
        message={words.settings.campaignQuestion}
        confirmLabel={words.editor.publish}
        cancelLabel={words.cancel}
        onCancel={() => setAsking(false)}
        onConfirm={() => void publish()}
      />
      <LeaveGuard active={Boolean(drafts.error)} />
      <Toast toast={toast} />
    </>
  );
}
