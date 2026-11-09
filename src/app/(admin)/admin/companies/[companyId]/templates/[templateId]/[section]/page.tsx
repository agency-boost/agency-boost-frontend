'use client';

import dynamic from 'next/dynamic';
import { use, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { SettingsTabs } from '@/components/settings-tabs';
import { BackLink } from '@/components/kpm-template/company-frame';
import { DraftBar, useVersionWords } from '@/components/kpm-template/draft-bar';
import { KindEditor } from '@/components/kpm-template/kind-editor';
import { materialCount, type PayloadMaterial } from '@/components/kpm-template/material-count';
import { useTemplateDrafts } from '@/components/kpm-template/use-template-drafts';
import { useAnalyticsPublish } from '@/components/kpm-template/analytics/analytics-publish';
import { Button, ErrorBanner } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { LeaveGuard } from '@/components/ui/save-state';
import { SkeletonCards } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { isOfficeKind, listTemplates, readTemplate, type NamedTemplate } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { tileRefusal } from '@/lib/summary-tiles';
import { useHashTab } from '@/lib/use-hash-tab';
import { sectionOf, templateHref, type TemplateSection } from '@/lib/template-sections';
import { useOpenedOnce } from '@/lib/use-opened-once';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/*
 * **The two dialogs load the first time they open** (the bundle, 2026-11-06; `performance-and-scale.md`): a module's
 * material from its row's *Materi*, and *Terapkan juga ke KPM yang sudah ada?* after a publish. Mounted from then on,
 * closed, as they always were (`useOpenedOnce`).
 */
const TemplateModuleMaterialDialog = dynamic(
  () => import('@/components/kpm-template/template-module-material').then((m) => m.TemplateModuleMaterialDialog),
  { ssr: false },
);
const ApplyToOfficesDialog = dynamic(
  () => import('@/components/kpm-template/apply-to-offices-dialog').then((m) => m.ApplyToOfficesDialog),
  { ssr: false },
);

/**
 * **One section of a template, through its existing editor** (ADR-0185 §3; P18.11-T20 AC-3): its parts as pills, its
 * draft saved as it is made — no *Save draft*, and no *a draft lives on one tab at a time*, because nothing waits
 * anywhere but the server — and its own *Terbitkan*. The way back is the template's checklist.
 *
 * Super Admin only (`company_template:read`; every write `company_template:write`, refused to every tenant role by the
 * API).
 */
export default function SectionPage({
  params,
}: {
  params: Promise<{ companyId: string; templateId: string; section: string }>;
}) {
  const { companyId, templateId, section: slug } = use(params);
  const words = useMessages(adminTemplateMessages);
  const section = sectionOf(slug);
  const [templates, setTemplates] = useState<NamedTemplate[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    void listTemplates(companyId)
      .then((rows) => { if (live) setTemplates(rows); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [companyId]);

  const template = templates?.find((row) => row.id === templateId) ?? null;
  const back = <BackLink href={templateHref(companyId, templateId)}>{template?.name ?? words.card.list}</BackLink>;

  if (!section) {
    return (
      <Page title={words.checklist.list} permission="company_template:read" actions={back}>
        <div className="rounded-lg border border-card-edge bg-card">
          <EmptyState title={words.editor.unknown} action={back} />
        </div>
      </Page>
    );
  }

  return (
    <Page
      title={words.sections[section.slug]}
      subtitle={template?.name}
      permission="company_template:read"
      actions={back}
    >
      {error && <ErrorBanner {...error} />}
      {templates !== null && !template && !error && (
        <div className="rounded-lg border border-card-edge bg-card">
          <EmptyState title={words.checklist.unknown} action={back} />
        </div>
      )}
      {(templates === null || template) && (
        <SectionBody
          key={section.slug}
          companyId={companyId}
          templateId={templateId}
          section={section}
          template={template}
        />
      )}
    </Page>
  );
}

function SectionBody({
  companyId,
  templateId,
  section,
  template,
}: {
  companyId: string;
  templateId: string;
  section: TemplateSection;
  /** `null` while the template is read: the editors wait for it, to know whether it is archived. */
  template: NamedTemplate | null;
}) {
  const words = useMessages(adminTemplateMessages);
  const language = useLanguage();
  const archived = template?.status === 'archived';
  const drafts = useTemplateDrafts({ companyId, templateId, kinds: section.kinds, readOnly: archived });
  const [tab, selectTab] = useHashTab(section.parts.map((part) => ({ href: `#${part.key}` })));
  const part = section.parts.find((p) => `#${p.key}` === tab) ?? section.parts[0];
  const draft = drafts.drafts[part.kind];
  const version = useVersionWords(draft?.view);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<ApiError | null>(null);
  const { toast, show } = useToast();
  /** ADR-0208: the module whose material is open, and the question after a publish. */
  const [materialFor, setMaterialFor] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  /*
   * The checklist's links name this template's training modules: read from its training draft — what the Super Admin
   * fills in the same sitting — once, where the section is the checklist. A checklist with no module list still works:
   * it offers the three feature links.
   */
  const [modules, setModules] = useState<{ code: string; title: string }[]>([]);
  useEffect(() => {
    if (!section.kinds.includes('activation_checklist')) return;
    void readTemplate(companyId, 'training_taxonomy', templateId)
      .then((row) => setModules((row.payload as { modules?: { code: string; title: string }[] }).modules ?? []))
      .catch(() => setModules([]));
  }, [companyId, templateId, section]);

  // The ratios' formulas name the activity types of the taxonomy beside them, as the reader edits it.
  const types = (drafts.drafts.activity_taxonomy?.payload as { types?: { code: string; label: string }[] } | undefined)?.types;
  const available = (types ?? []).map(({ code, label }) => ({ code, label }));

  async function publish() {
    setPublishing(true);
    setPublishError(null);
    const done = await drafts.publish();
    setPublishing(false);
    setPublishError(done.error);
    if (done.ok) {
      show(words.editor.published);
      // *Terapkan juga ke KPM yang sudah ada?* (ADR-0208 §4): asked when the template has offices to reach — never for
      // the playbook, which they read live (ADR-0210 §4): there is nothing to push.
      if ((template?.officeCount ?? 0) > 0 && pushable.length > 0) setApplyOpen(true);
    }
  }

  /*
   * **The section's material** (ADR-0208 §1; UI-162): each module's, from the training draft the reader is editing, and
   * *x / y modul punya materi* — y the section's modules, x those holding a file, a video or a link.
   */
  type MaterialModule = { code: string; title: string; content?: PayloadMaterial };
  const trainingModules = section.kinds.includes('training_taxonomy')
    ? ((drafts.drafts.training_taxonomy?.payload as { modules?: MaterialModule[] } | undefined)?.modules ?? [])
    : [];
  const withMaterial = trainingModules.filter((m) => materialCount(m.content) > 0).length;
  const materialModule = trainingModules.find((m) => m.code === materialFor) ?? null;
  const materialMounted = useOpenedOnce(materialModule !== null);
  const applyMounted = useOpenedOnce(applyOpen);

  /*
   * *Advanced analytics* asks first (P19.5-T1 AC-11, AC-15): its agent-code format tested over every registered code,
   * then *Terbitkan Advanced analytics v<n>?* — or *Belum bisa diterbitkan*. It is read live by every KPM on the
   * template, so nothing is pushed after it (ADR-0214 §1).
   */
  const analytics = useAnalyticsPublish({
    companyId,
    templateId,
    view: drafts.drafts.advanced_analytics?.view,
    payload: drafts.drafts.advanced_analytics?.payload,
    flush: drafts.flush,
    publish: async () => {
      setPublishing(true);
      const done = await drafts.publish();
      setPublishing(false);
      if (done.ok) show(words.editor.published);
      return done;
    },
    onOpenUpload: () => selectTab('#data'),
  });

  const state = drafts.saving ? 'saving' : drafts.dirty || drafts.error ? 'unsaved' : 'saved';
  /** The kinds a push can reach: every one but the playbook, read live (ADR-0210 §4). */
  const pushable = section.kinds.filter(isOfficeKind);

  return (
    <>
      {section.parts.length > 1 && (
        // 44px below 1024px (P19.2-T2 AC-5; UI-135: *tab rows become 44px*), as the company's own settings tabs are.
        <SettingsTabs
          variant="subtabs"
          touch
          label={words.editor.parts({ section: words.sections[section.slug] })}
          tabs={section.parts.map((p) => ({ label: words.pills[p.key as keyof typeof words.pills], href: `#${p.key}` }))}
          activeHref={`#${part.key}`}
          onSelect={selectTab}
        />
      )}

      {drafts.loadError && (
        <div className="mb-4 flex flex-col gap-2">
          <ErrorBanner {...drafts.loadError} />
          <Button variant="secondary" className="self-start" onClick={drafts.retryLoad}>{words.editor.retry}</Button>
        </div>
      )}
      {!drafts.loadError && (!drafts.ready || !template) && <SkeletonCards count={3} label={words.editor.loading} />}

      {drafts.ready && template && draft && (
        <>
          <DraftBar
            state={state}
            version={version}
            archived={archived}
            publishable={drafts.publishable}
            publishing={publishing}
            // A summary tile's refusal in the tile's own words, as the Owner's screen says it (P10.1-T5 AC-5).
            saveError={drafts.error && (tileRefusal(drafts.error, language) ?? drafts.error)}
            publishError={section.slug === 'analytics' ? analytics.error : publishError}
            onRetry={() => void drafts.flush()}
            onReload={drafts.retryLoad}
            onPublish={section.slug === 'analytics' ? analytics.request : () => void publish()}
          />
          {section.slug === 'training' && (
            <p className="mb-3 text-sm text-muted">{words.material.count({ x: withMaterial, y: trainingModules.length })}</p>
          )}
          {section.slug === 'recruitment' && <p className="mb-3 text-sm text-muted">{words.editor.playbookLive}</p>}
          <KindEditor
            kind={part.kind}
            half={part.half}
            view={draft.view}
            payload={draft.payload}
            onChange={(next) => drafts.change(part.kind, next)}
            disabled={archived || publishing}
            available={available}
            modules={modules}
            material={part.kind === 'training_taxonomy' && !archived ? {
              label: (module) => ({
                text: words.material.open({ n: materialCount(module.content) }),
                name: words.material.openName({ title: module.title }),
              }),
              onOpen: setMaterialFor,
            } : undefined}
            refusal={part.kind === 'recruitment_playbook' ? publishError : null}
            template={{ companyId, templateId }}
          />
        </>
      )}
      {/* A draft the server refused would be lost by leaving: asked first. A draft on its way is sent as it closes. */}
      <LeaveGuard active={Boolean(drafts.error)} />
      {materialMounted && (
        <TemplateModuleMaterialDialog
          open={materialModule !== null}
          companyId={companyId}
          templateId={templateId}
          module={materialModule}
          revision={drafts.drafts.training_taxonomy?.view.revision ?? 0}
          beforeSave={drafts.flush}
          onSaved={(view) => drafts.accept('training_taxonomy', view)}
          onClose={() => setMaterialFor(null)}
        />
      )}
      {applyMounted && (
        <ApplyToOfficesDialog
          open={applyOpen}
          companyId={companyId}
          templateId={templateId}
          kinds={pushable}
          onClose={() => setApplyOpen(false)}
        />
      )}
      {section.slug === 'analytics' && analytics.dialogs}
      <Toast toast={toast} />
    </>
  );
}
