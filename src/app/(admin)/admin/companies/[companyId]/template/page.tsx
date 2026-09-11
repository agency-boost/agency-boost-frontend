'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, use } from 'react';
import { ComingInPhase } from '@/components/coming-in-phase';
import { Page } from '@/components/page';
import { SettingsTabs } from '@/components/settings-tabs';
import {
  PipelineEditor, TaxonomyEditor, type PipelinePayload, type TaxonomyPayload,
} from '@/components/template-editor';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  publishTemplate, readTemplate, saveTemplateDraft,
  type PlatformTemplate, type TemplateKind,
} from '@/lib/admin';

/** Each item of the Owner's Settings group, as ADR-0018 lays them out. */
const TABS: { key: string; label: string; kind: TemplateKind | null; phase: number }[] = [
  { key: 'activity', label: 'Activity types', kind: 'activity_taxonomy', phase: 4 },
  { key: 'leads', label: 'Lead statuses', kind: 'lead_pipeline', phase: 4 },
  { key: 'activation', label: 'Activation checklist', kind: null, phase: 5 },
  { key: 'training', label: 'Training', kind: null, phase: 5 },
  { key: 'events', label: 'Events', kind: null, phase: 5 },
  { key: 'campaigns', label: 'Campaigns', kind: null, phase: 5 },
  { key: 'products', label: 'Products', kind: null, phase: 5 },
];

/**
 * A company's KPM template (P4-T8, ADR-0018).
 *
 * **One screen per company, with each item of the Owner's Settings group as a tab** — the
 * prototype puts *KPM template* inside the Companies nav group beside the role ladder and
 * the product catalog, and says *"each company has its own"*.
 *
 * **Branch info is not a tab**, matching the client's own range. It is a fact about one
 * office, not a preset — the prototype disables its Company field as *"tagged by
 * Superadmin"*, which is the same boundary from the other side.
 *
 * **Publishing reaches nothing that already exists.** Copy-on-provision means copy once,
 * so the screen says what publishing does and does not do rather than leaving a Super
 * Admin to find out from an office that did not change.
 */
export default function CompanyTemplatePage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = use(params);
  const [tab, setTab] = useState(TABS[0]);
  const [template, setTemplate] = useState<PlatformTemplate | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async (kind: TemplateKind) => {
    setTemplate(null);
    setPayload(null);
    try {
      const row = await readTemplate(companyId, kind);
      setTemplate(row);
      setPayload(row.payload);
      setDirty(false);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [companyId]);

  useEffect(() => {
    if (tab.kind) void load(tab.kind);
  }, [tab, load]);

  async function run(action: () => Promise<PlatformTemplate>) {
    setBusy(true);
    setError(null);
    try {
      const row = await action();
      setTemplate(row);
      setPayload(row.payload);
      setDirty(false);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  const change = (next: Record<string, unknown>) => {
    setPayload(next);
    setDirty(true);
  };

  return (
    <Page
      title="KPM template"
      subtitle="What every new office of this company starts life with."
      permission="platform_template:read"
      actions={(
        <Link href="/admin/companies" className="text-md font-semibold text-navy underline">
          Back to companies
        </Link>
      )}
    >
      {error && <ErrorBanner {...error} />}

      <SettingsTabs
        tabs={TABS.map((t) => ({ label: t.label, href: `#${t.key}` }))}
        onSelect={(href) => setTab(TABS.find((t) => `#${t.key}` === href) ?? TABS[0])}
        activeHref={`#${tab.key}`}
      />

      {tab.kind === null ? (
        <ComingInPhase
          phase={tab.phase}
          what={`The ${tab.label.toLowerCase()} every new office of this company will start with.`}
          elsewhere={[
            {
              label: 'Activity types',
              href: `/admin/companies/${companyId}/template`,
              detail: 'The part of this template that is built, and editable now.',
            },
            {
              label: 'Companies',
              href: '/admin/companies',
              detail: 'Every company on the platform.',
            },
          ]}
        />
      ) : template === null || payload === null ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <Card className="mb-4">
            <p className="text-md text-navy">
              {template.publishedVersion === null ? (
                <>
                  Nothing is published yet. New offices of this company start from the
                  AgencyBoost defaults — which is what you are looking at, ready to edit.
                </>
              ) : (
                <>
                  New offices start from <strong>version {template.publishedVersion}</strong>.
                  {template.status === 'draft' && (
                    <> You have unpublished changes, which will become version {template.version}.</>
                  )}
                </>
              )}
            </p>
            {template.officesBehind > 0 && (
              <p className="mt-2 text-md text-muted">
                {template.officesBehind}{' '}
                {template.officesBehind === 1 ? 'office is' : 'offices are'} running something
                older. Publishing does not change them — an office owns its own copy from the
                day it is created.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                disabled={busy || !dirty}
                onClick={() => void run(() => saveTemplateDraft(companyId, tab.kind!, payload))}
              >
                {busy ? 'Saving…' : 'Save draft'}
              </Button>
              <Button
                variant="secondary"
                disabled={busy || dirty || template.status !== 'draft'}
                title={dirty ? 'Save the draft first.' : undefined}
                onClick={() => void run(() => publishTemplate(companyId, tab.kind!))}
              >
                Publish version {template.version}
              </Button>
            </div>
          </Card>

          {tab.kind === 'activity_taxonomy' ? (
            <TaxonomyEditor
              payload={payload as unknown as TaxonomyPayload}
              disabled={busy}
              onChange={(next) => change(next as unknown as Record<string, unknown>)}
            />
          ) : (
            <PipelineEditor
              payload={payload as unknown as PipelinePayload}
              disabled={busy}
              onChange={(next) => change(next as unknown as Record<string, unknown>)}
            />
          )}
        </>
      )}
    </Page>
  );
}
