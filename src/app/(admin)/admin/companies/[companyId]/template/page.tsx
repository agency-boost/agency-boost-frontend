'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, use } from 'react';
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
  type CompanyTemplate, type TemplateKind,
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
 * A company's Company template (P4-T8, ADR-0018).
 *
 * **One screen per company, with each item of the Owner's Settings group as a tab** — the
 * prototype puts *Company template* inside the Companies nav group beside the role ladder and
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
  /**
   * The loaded template and **which kind it is**, in one piece of state.
   *
   * They were two, cleared by the effect that reloads on a tab change — and an effect runs
   * *after* the render that changed the tab. So switching from Activity types to Lead
   * statuses produced one render holding the new kind and the old payload, and
   * `PipelineEditor` read `payload.statuses` off a taxonomy: *Cannot read properties of
   * undefined (reading 'filter')*.
   *
   * Holding them together makes that state unrepresentable rather than unlikely, and it
   * closes a second hole with it: two loads in flight had no ordering guard, so a slow
   * answer for a tab you had left could overwrite the one you were on.
   */
  const [loaded, setLoaded] = useState<{
    kind: TemplateKind;
    template: CompanyTemplate;
    payload: Record<string, unknown>;
  } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  /**
   * The kind most recently asked for.
   *
   * A ref rather than state: it is read at the moment a response lands, and it must be the
   * value at *that* moment, not the one captured when the request went out. `fetch` has no
   * cancellation here, so dropping the answer is the cancellation.
   */
  const wanted = useRef<TemplateKind | null>(null);

  const load = useCallback(async (kind: TemplateKind) => {
    wanted.current = kind;
    setLoaded(null);
    try {
      const row = await readTemplate(companyId, kind);
      // **Dropped if the reader has moved on.** Tagging the state with its kind stops a
      // late answer being *drawn* under the wrong tab; this stops it clobbering the right
      // one, which would blank the screen back to a skeleton for no reason a reader could
      // see. On a slow connection that is the ordinary case, not the rare one.
      if (wanted.current !== kind) return;
      setLoaded({ kind, template: row, payload: row.payload });
      setDirty(false);
    } catch (err) {
      if (wanted.current !== kind) return;
      setError(toDisplayError(err));
    }
  }, [companyId]);

  useEffect(() => {
    if (tab.kind) void load(tab.kind);
  }, [tab, load]);

  async function run(action: () => Promise<CompanyTemplate>) {
    setBusy(true);
    setError(null);
    try {
      const row = await action();
      setLoaded({ kind: row.kind, template: row, payload: row.payload });
      setDirty(false);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  const change = (next: Record<string, unknown>) => {
    setLoaded((current) => (current ? { ...current, payload: next } : current));
    setDirty(true);
  };

  /** Only ever the template for the tab being looked at. */
  const current = loaded?.kind === tab.kind ? loaded : null;

  return (
    <Page
      title="Company template"
      subtitle="What every new office of this company starts life with."
      permission="company_template:read"
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
      ) : current === null ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <Card className="mb-4">
            <p className="text-md text-navy">
              {current.template.publishedVersion === null ? (
                <>
                  Nothing is published yet. New offices of this company start from the
                  AgencyBoost defaults — which is what you are looking at, ready to edit.
                </>
              ) : (
                <>
                  New offices start from <strong>version {current.template.publishedVersion}</strong>.
                  {current.template.status === 'draft' && (
                    <> You have unpublished changes, which will become version {current.template.version}.</>
                  )}
                </>
              )}
            </p>
            {current.template.officesBehind > 0 && (
              <p className="mt-2 text-md text-muted">
                {current.template.officesBehind}{' '}
                {current.template.officesBehind === 1 ? 'office is' : 'offices are'} running something
                older. Publishing does not change them — an office owns its own copy from the
                day it is created.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                disabled={busy || !dirty}
                onClick={() => void run(() => saveTemplateDraft(companyId, tab.kind!, current.payload))}
              >
                {busy ? 'Saving…' : 'Save draft'}
              </Button>
              <Button
                variant="secondary"
                disabled={busy || dirty || current.template.status !== 'draft'}
                title={dirty ? 'Save the draft first.' : undefined}
                onClick={() => void run(() => publishTemplate(companyId, tab.kind!))}
              >
                Publish version {current.template.version}
              </Button>
            </div>
          </Card>

          {/* Switched on the **loaded** kind, not the selected tab. They cannot differ —
              `current` is null unless they match — and keying off the payload's own kind
              means a later edit to that guard cannot reintroduce the mismatch. */}
          {current.kind === 'activity_taxonomy' ? (
            <TaxonomyEditor
              payload={current.payload as unknown as TaxonomyPayload}
              disabled={busy}
              onChange={(next) => change(next as unknown as Record<string, unknown>)}
            />
          ) : (
            <PipelineEditor
              payload={current.payload as unknown as PipelinePayload}
              disabled={busy}
              onChange={(next) => change(next as unknown as Record<string, unknown>)}
            />
          )}
        </>
      )}
    </Page>
  );
}
