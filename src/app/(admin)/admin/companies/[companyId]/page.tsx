'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { CompanyFrame, useCompany } from '@/components/kpm-template/company-frame';
import { NewTemplateDialog } from '@/components/kpm-template/new-template-dialog';
import { TemplateCard } from '@/components/kpm-template/template-card';
import { Button, ErrorBanner } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { LineIcon } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { listTemplates, type NamedTemplate } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { templateHref } from '@/lib/template-sections';
import { useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';

/**
 * **A company's page, tab *Template KPM*** (ADR-0185 §2; P18.99-T20 AC-1): a card per template — the default first,
 * then the others, then the archived — and *Template baru*. Opening a card opens its checklist.
 *
 * Super Admin only: `company_template:read` to see it, and the API refuses every tenant role whatever this renders.
 */
export default function CompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const t = useMessages(adminTemplateMessages).card;
  const router = useRouter();
  const company = useCompany(companyId);
  const [templates, setTemplates] = useState<NamedTemplate[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let live = true;
    setTemplates(null);
    setError(null);
    void listTemplates(companyId)
      .then((rows) => { if (live) setTemplates(rows); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [companyId, attempt]);

  // The default first, then the active by name, then the archived — the API's order, kept.
  const ordered = templates
    ? [...templates.filter((x) => x.status === 'active'), ...templates.filter((x) => x.status === 'archived')]
    : null;

  return (
    <CompanyFrame companyId={companyId} company={company} permission="company_template:read">
      {error && (
        <div className="mb-4 flex flex-col gap-2">
          <ErrorBanner {...error} />
          <Button variant="secondary" className="self-start" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
        </div>
      )}

      {!error && ordered === null && <CardsSkeleton label={t.loading} />}

      {ordered?.length === 0 && (
        <div className="rounded-lg border border-card-edge bg-card">
          <EmptyState boost="thinking" title={t.none} />
        </div>
      )}

      {ordered && ordered.length > 0 && (
        <ul aria-label={t.list} className="flex flex-col gap-3">
          {ordered.map((template) => (
            <li key={template.id}><TemplateCard companyId={companyId} template={template} /></li>
          ))}
        </ul>
      )}

      {ordered && (
        <Button className="mt-4 gap-1" onClick={() => setCreating(true)}>
          <LineIcon name="plus" className="h-4 w-4" />
          {t.newTemplate}
        </Button>
      )}

      <NewTemplateDialog
        open={creating}
        companyId={companyId}
        onClose={() => setCreating(false)}
        onCreated={(made) => {
          setCreating(false);
          router.push(templateHref(companyId, made.id));
        }}
      />
    </CompanyFrame>
  );
}

/** The cards on their way: a name, a pill and the line under them, as each card draws them. */
function CardsSkeleton({ label }: { label: string }) {
  return (
    <Skeleton label={label}>
      <div className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-card-edge bg-card px-5 py-4">
            <SkeletonBar className="h-5 w-48" />
            <SkeletonBar className="mt-2 w-64 max-w-full" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}
