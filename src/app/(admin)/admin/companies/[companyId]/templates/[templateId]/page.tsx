'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { BackLink, useCompany, useCompanyName } from '@/components/kpm-template/company-frame';
import { OfficesBehindDialog } from '@/components/kpm-template/offices-behind-dialog';
import { PublishAllDialog, PublishAllReport } from '@/components/kpm-template/publish-all-dialog';
import { TemplateActions } from '@/components/kpm-template/template-actions';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { LineIcon } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import {
  listTemplateOffices, listTemplates, publishAllTemplate,
  type NamedTemplate, type PublishAllOutcome, type TemplateOffice,
} from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  companyHref, sectionHref, sectionState, sectionsWaiting, TEMPLATE_SECTIONS, templateHref, type TemplateSection,
} from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

const STATE_TONE: Record<ReturnType<typeof sectionState>['state'], PillTone> = {
  published: 'green',
  draft: 'amber',
  partial: 'blue',
  empty: 'grey',
};

/**
 * **One template, as a checklist of its sections** (ADR-0185 §3; P18.99-T20 AC-2): each of the six with *Terbit vN*,
 * *Draf* or *Kosong* — words on a tinted pill, never a dot (D-27) — and a › to its editor; *Terbitkan semua (n)*, asking
 * first which sections it will publish; *N KPM memakai versi lama*, which lists them; and the template's ⋮.
 *
 * Super Admin only (`company_template:read`, its writes `company_template:write`); the API refuses every tenant role.
 */
export default function TemplatePage({
  params,
}: {
  params: Promise<{ companyId: string; templateId: string }>;
}) {
  const { companyId, templateId } = use(params);
  const words = useMessages(adminTemplateMessages);
  const t = words.checklist;
  const router = useRouter();
  const company = useCompany(companyId);
  const companyName = useCompanyName(company);
  const [templates, setTemplates] = useState<NamedTemplate[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [offices, setOffices] = useState<TemplateOffice[] | null>(null);
  const [dialog, setDialog] = useState<null | 'publish' | 'offices'>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PublishAllOutcome[] | null>(null);
  const [publishError, setPublishError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    void listTemplates(companyId)
      .then((rows) => { if (live) setTemplates(rows); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [companyId, attempt]);

  // The offices it answers for: the count's, read again after a publish. A failure leaves the line out — it is a
  // pointer to the offices list, and the checklist works without it.
  const [officesRead, setOfficesRead] = useState(0);
  useEffect(() => {
    let live = true;
    void listTemplateOffices(companyId, templateId)
      .then((rows) => { if (live) setOffices(rows); })
      .catch(() => { if (live) setOffices(null); });
    return () => { live = false; };
  }, [companyId, templateId, officesRead]);

  const template = templates?.find((row) => row.id === templateId) ?? null;
  const archived = template?.status === 'archived';
  const waiting = template ? sectionsWaiting(template) : [];
  const behind = offices?.filter((o) => o.behind.length > 0).length ?? 0;

  /** The template as an action answered it, in the list in hand. */
  const replace = (saved: NamedTemplate) => {
    setTemplates((rows) => rows?.map((row) => {
      if (row.id === saved.id) return saved;
      // *Make default* moves it: no other template is the default now.
      return saved.isDefault ? { ...row, isDefault: false } : row;
    }) ?? rows);
  };

  async function publishAll() {
    setBusy(true);
    setPublishError(null);
    try {
      const answer = await publishAllTemplate(companyId, templateId);
      replace(answer.template);
      setResults(answer.results);
      setOfficesRead((n) => n + 1);
    } catch (err) {
      setPublishError(toDisplayError(err));
    } finally {
      setBusy(false);
      setDialog(null);
    }
  }

  return (
    <Page
      title={template?.name ?? words.card.list}
      subtitle={template ? <TemplateFacts template={template} /> : undefined}
      permission="company_template:read"
      actions={(
        <div className="flex flex-wrap items-start gap-4">
          <BackLink href={companyHref(companyId)}>{companyName}</BackLink>
          {template && (
            <TemplateActions
              companyId={companyId}
              template={template}
              onChanged={replace}
              onCreated={(made) => router.push(templateHref(companyId, made.id))}
            />
          )}
        </div>
      )}
    >
      {error && (
        <div className="mb-4 flex flex-col gap-2">
          <ErrorBanner {...error} />
          <Button variant="secondary" className="self-start" onClick={() => setAttempt((n) => n + 1)}>
            {words.card.retry}
          </Button>
        </div>
      )}
      {!error && templates === null && <ChecklistSkeleton label={words.card.loading} />}
      {templates !== null && !template && (
        <div className="rounded-lg border border-card-edge bg-card">
          <EmptyState
            title={t.unknown}
            action={<BackLink href={companyHref(companyId)}>{companyName}</BackLink>}
          />
        </div>
      )}

      {template && (
        <>
          <Card density="compact" className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-md font-semibold text-navy">
                {archived ? t.archived : waiting.length > 0 ? t.changed({ n: waiting.length }) : t.noChanges}
              </p>
              {behind > 0 && (
                <Button variant="inline" className="self-start text-navy underline" onClick={() => setDialog('offices')}>
                  {t.behind({ n: behind })}
                </Button>
              )}
            </div>
            {!archived && (
              <Button disabled={busy || waiting.length === 0} onClick={() => setDialog('publish')}>
                {busy ? t.publishing : t.publishAll({ n: waiting.length })}
              </Button>
            )}
          </Card>

          {publishError && <ErrorBanner {...publishError} />}
          {results && <PublishAllReport results={results} />}

          <ul aria-label={t.list} className="divide-y divide-divider overflow-hidden rounded-lg border border-card-edge bg-card">
            {TEMPLATE_SECTIONS.map((section) => (
              <li key={section.slug}>
                <SectionRow companyId={companyId} template={template} section={section} />
              </li>
            ))}
          </ul>

          <PublishAllDialog
            open={dialog === 'publish'}
            sections={waiting}
            busy={busy}
            onConfirm={() => void publishAll()}
            onClose={() => setDialog(null)}
          />
          <OfficesBehindDialog open={dialog === 'offices'} offices={offices ?? []} onClose={() => setDialog(null)} />
        </>
      )}
    </Page>
  );
}

/** Under the template's name: *★ Default* or *Diarsipkan*, and the offices it answers for. */
function TemplateFacts({ template }: { template: NamedTemplate }) {
  const t = useMessages(adminTemplateMessages).card;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {template.isDefault && <TonePill tone="blue"><span aria-hidden="true">★ </span>{t.default}</TonePill>}
      {template.status === 'archived' && <TonePill tone="grey">{t.archived}</TonePill>}
      <span>{t.usedBy({ n: template.officeCount })}</span>
    </span>
  );
}

/**
 * One section's row: its name, its state on a pill, what a draft stands over or each kind's version, and a ›. The
 * whole row is the link to the section's editor.
 */
function SectionRow({
  companyId,
  template,
  section,
}: {
  companyId: string;
  template: NamedTemplate;
  section: TemplateSection;
}) {
  const words = useMessages(adminTemplateMessages);
  const t = words.checklist;
  const { state, versions } = sectionState(template, section);
  const single = versions.length === 1 ? versions[0].version : null;
  const label = state === 'draft' ? t.state.draft
    : state === 'empty' ? t.state.empty
      : state === 'partial' ? t.state.partial
        : single !== null ? t.state.published({ v: single }) : t.state.publishedParts;
  // What the pill does not say: a draft's published version, or both kinds of a two-kind section.
  const detail = versions.length > 1
    ? (state === 'empty' ? null : versions.map((v) => t.part({
      name: words.parts[v.kind as keyof typeof words.parts], v: v.version,
    })).join(' · '))
    : state === 'draft' ? t.draftOver({ v: versions[0].version }) : null;

  return (
    <Link
      href={sectionHref(companyId, template.id, section.slug)}
      className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-hover-row"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-md font-semibold text-navy">{words.sections[section.slug]}</span>
        {detail && <span className="block text-sm text-muted">{detail}</span>}
      </span>
      <TonePill tone={STATE_TONE[state]}>{label}</TonePill>
      <LineIcon name="chevronRight" className="h-5 w-5 shrink-0 text-navy" />
    </Link>
  );
}

/** The checklist on its way: the bar, then six rows of a name and a pill. */
function ChecklistSkeleton({ label }: { label: string }) {
  return (
    <Skeleton label={label}>
      <div className="mb-4 rounded-lg border border-card-edge bg-card px-5 py-4">
        <SkeletonBar className="h-4 w-40" />
      </div>
      <div className="divide-y divide-divider rounded-lg border border-card-edge bg-card">
        {TEMPLATE_SECTIONS.map((section) => (
          <div key={section.slug} className="flex items-center justify-between px-4 py-4">
            <SkeletonBar className="h-4 w-40" />
            <SkeletonBar className="h-5 w-20" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}
