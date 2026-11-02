'use client';

import { use, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { SettingsTabs } from '@/components/settings-tabs';
import { BackLink } from '@/components/kpm-template/company-frame';
import { DraftBar, useVersionWords } from '@/components/kpm-template/draft-bar';
import { KindEditor } from '@/components/kpm-template/kind-editor';
import { useTemplateDrafts } from '@/components/kpm-template/use-template-drafts';
import { Button, ErrorBanner } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { LeaveGuard } from '@/components/ui/save-state';
import { SkeletonCards } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { listTemplates, readTemplate, type NamedTemplate } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { tileRefusal } from '@/lib/summary-tiles';
import { useHashTab } from '@/lib/use-hash-tab';
import { sectionOf, templateHref, type TemplateSection } from '@/lib/template-sections';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/**
 * **One section of a template, through its existing editor** (ADR-0185 §3; P18.99-T20 AC-3): its parts as pills, its
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
    if (done.ok) show(words.editor.published);
  }

  const state = drafts.saving ? 'saving' : drafts.dirty || drafts.error ? 'unsaved' : 'saved';

  return (
    <>
      {section.parts.length > 1 && (
        <SettingsTabs
          variant="subtabs"
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
            publishError={publishError}
            onRetry={() => void drafts.flush()}
            onPublish={() => void publish()}
          />
          <KindEditor
            kind={part.kind}
            half={part.half}
            view={draft.view}
            payload={draft.payload}
            onChange={(next) => drafts.change(part.kind, next)}
            disabled={archived || publishing}
            available={available}
            modules={modules}
          />
        </>
      )}
      {/* A draft the server refused would be lost by leaving: asked first. A draft on its way is sent as it closes. */}
      <LeaveGuard active={Boolean(drafts.error)} />
      <Toast toast={toast} />
    </>
  );
}
