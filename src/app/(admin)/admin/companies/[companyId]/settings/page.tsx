'use client';

import dynamic from 'next/dynamic';
import { use, useEffect, useState } from 'react';
import { CompanyFrame, useCompany } from '@/components/kpm-template/company-frame';
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
import { useHashTab } from '@/lib/use-hash-tab';
import { CAMPAIGN_PARTS } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/*
 * **Products and Recruitment load when they are opened** (P18.98-T6, the bundle): each reads and writes its own data
 * and draws four card skeletons until it has it, the skeleton below being the one it would draw first anyway.
 */
const ProductsTab = dynamic(
  () => import('@/components/products-tab').then((m) => m.ProductsTab),
  { loading: () => <SkeletonCards count={4} /> },
);
const RecruitmentPlaybookTab = dynamic(
  () => import('@/components/recruitment-playbook-tab').then((m) => m.RecruitmentPlaybookTab),
  { loading: () => <SkeletonCards count={4} /> },
);

const TABS = ['products', 'campaigns', 'recruitment'] as const;
type Tab = (typeof TABS)[number];

/**
 * **A company's page, tab *Pengaturan perusahaan*** (ADR-0185 §2; P18.99-T20 AC-1): what is the company's rather than a
 * template's — its products (ADR-0033), its carrier rules (ADR-0026) and its recruitment playbook (ADR-0125) — read
 * live by every office it has, said once: *Berlaku langsung untuk semua KPM perusahaan ini.*
 *
 * *Campaign* keeps a draft and a *Terbitkan*, saved as it is made like a template's sections, and asks before it
 * publishes because publishing reaches the offices that exist. *Produk* and *Rekrutmen* save as they always did. **A
 * part once opened stays mounted**, hidden when another is shown, so moving between them never loses an edit.
 *
 * Super Admin only: `company_template:read` to see it; the playbook's writes are `recruitment_playbook:write`.
 */
export default function CompanySettingsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const words = useMessages(adminTemplateMessages);
  const t = words.settings;
  const company = useCompany(companyId);
  const [tab, selectTab] = useHashTab(TABS.map((x) => ({ href: `#${x}` })));
  const current = (TABS.find((x) => `#${x}` === tab) ?? TABS[0]) as Tab;
  const [opened, setOpened] = useState<ReadonlySet<Tab>>(new Set([TABS[0]]));
  const [playbookDirty, setPlaybookDirty] = useState(false);

  useEffect(() => {
    setOpened((was) => (was.has(current) ? was : new Set([...was, current])));
  }, [current]);

  return (
    <CompanyFrame companyId={companyId} company={company} permission="company_template:read">
      <p className="mb-4 text-md font-semibold text-navy">{t.line}</p>
      <SettingsTabs
        variant="subtabs"
        label={words.companyPage.settings}
        tabs={TABS.map((x) => ({ label: t[x], href: `#${x}` }))}
        activeHref={`#${current}`}
        onSelect={selectTab}
      />
      {opened.has('products') && (
        <div hidden={current !== 'products'}><ProductsTab companyId={companyId} /></div>
      )}
      {opened.has('campaigns') && (
        <div hidden={current !== 'campaigns'}><CampaignRules companyId={companyId} /></div>
      )}
      {opened.has('recruitment') && (
        <div hidden={current !== 'recruitment'}>
          <RecruitmentPlaybookTab companyId={companyId} onDirtyChange={setPlaybookDirty} />
        </div>
      )}
      {/* The playbook saves on its own button: an edit not saved is asked about before the page is left. */}
      <LeaveGuard active={playbookDirty} />
    </CompanyFrame>
  );
}

/**
 * **The company's carrier rules** (`campaign_kinds`, ADR-0026, ADR-0034): production club tiers, Maintenance of Contract
 * and promotion paths, each a pill, through the existing editor. A draft saved as it is made; *Terbitkan* asks first,
 * because it applies at once to every office of the company, including the ones that exist.
 */
function CampaignRules({ companyId }: { companyId: string }) {
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
            onPublish={() => setAsking(true)}
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
