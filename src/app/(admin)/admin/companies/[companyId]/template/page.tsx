'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, use } from 'react';
import { ComingInPhase } from '@/components/coming-in-phase';
import { SettingsScreen } from '@/components/settings-screen';
import {
  PipelineEditor, RatioSetEditor, TaxonomyEditor,
  type PipelinePayload, type RatioSetPayload, type TaxonomyPayload,
} from '@/components/template-editor';
import { Button, Card } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  publishTemplate, readTemplate, saveTemplateDraft,
  type CompanyTemplate, type TemplateKind,
} from '@/lib/admin';

/** Each item of the Owner's Settings group, as ADR-0018 lays them out. */
const TABS: {
  key: string; label: string; kind: TemplateKind | null; phase: number; under?: string;
}[] = [
  /*
   * `Activity types` and `Ratio benchmarks` are **subtabs of one item**, not two tabs.
   * ADR-0018's own table says so, and it mirrors the Owner's Settings group, where the
   * benchmarks live inside the Activity types screen (`KPM_Owner.html:1329-1330`).
   */
  { key: 'activity', label: 'Activity types', kind: 'activity_taxonomy', phase: 4, under: 'activity' },
  { key: 'ratios', label: 'Ratio benchmarks', kind: 'ratio_set', phase: 4, under: 'activity' },
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
  /** A tab the reader asked for while holding unsaved edits. `null` the rest of the time. */
  const [pendingTab, setPendingTab] = useState<typeof TABS[number] | null>(null);

  /** One entry per Owner Settings **item** — the top row. */
  const GROUPS = TABS.filter((t) => (t.under ?? t.key) === t.key);
  /** The halves of the item in view. More than one means a second row of tabs. */
  const siblings = TABS.filter((t) => (t.under ?? t.key) === (tab.under ?? tab.key));
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
  /*
   * The activity codes a ratio may be built from, read from this company's own taxonomy
   * template — the draft if there is one, because that is what the Super Admin is looking
   * at on the tab next door and what they will publish alongside it.
   *
   * Publishing checks the **published** taxonomy, so a ratio built here against an
   * unpublished type is refused until the taxonomy goes out with it. Offering only
   * published codes would be the other mistake: it would make the two tabs impossible to
   * fill in one sitting.
   */
  const [available, setAvailable] = useState<{ code: string; label: string }[]>([]);

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

  useEffect(() => {
    if (tab.kind !== 'ratio_set') return;
    void readTemplate(companyId, 'activity_taxonomy')
      .then((row) => {
        const { types } = row.payload as { types?: { code: string; label: string }[] };
        setAvailable(types ?? []);
      })
      // A ratio editor with no code list is still usable — it just cannot offer names.
      // Failing the whole tab over it would be worse than showing codes alone.
      .catch(() => setAvailable([]));
  }, [companyId, tab.kind]);

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
    <SettingsScreen
      title="Company template"
      subtitle="What every new office of this company starts life with."
      permission="company_template:read"
      actions={(
        <Link href="/admin/companies" className="text-md font-semibold text-navy underline">
          Back to companies
        </Link>
      )}
      /*
       * Two rows, because an Owner Settings **item** split across routes is one item with
       * subtabs — ADR-0018's own table, and the Owner's own screen. The shell fixes where
       * they sit; `variant="subtabs"` fixes what they look like, which mattered here more
       * than anywhere: the group is *Activity types* and so is the first of its halves, so
       * the same word sat in two identically-underlined rows.
       */
      tabsLabel="Template sections"
      tabs={GROUPS.map((g) => ({ label: g.label, href: `#${g.key}` }))}
      activeHref={`#${tab.under ?? tab.key}`}
      /*
       * Unsaved edits are named before they are lost.
       *
       * Switching tabs reloads, and `load` resets `dirty` — so a draft somebody had typed
       * vanished with nothing said. `dirty` was already tracked and already gated both
       * buttons; the one place it was not consulted was the one place a change could
       * disappear.
       */
      onSelectTab={(href) => {
        // The first tab of the group, so opening `Activity types` lands on its own half.
        const next = TABS.find((t) => `#${t.under ?? t.key}` === href) ?? TABS[0];
        if (next.key === tab.key) return;
        if (dirty) { setPendingTab(next); return; }
        setTab(next);
      }}
      subtabs={siblings.length > 1
        ? siblings.map((t) => ({ label: t.label, href: `#${t.key}` }))
        : undefined}
      subtabsLabel={`${tab.under
        ? GROUPS.find((g) => g.key === tab.under)?.label
        : tab.label} sections`}
      activeSubtab={`#${tab.key}`}
      onSelectSubtab={(href) => {
        const next = TABS.find((t) => `#${t.key}` === href) ?? tab;
        if (next.key === tab.key) return;
        if (dirty) { setPendingTab(next); return; }
        setTab(next);
      }}
      error={error}
    >
      {pendingTab && (
        <div role="alert" className="mb-4 rounded-md border border-amber bg-card p-4">
          <p className="text-md text-navy">
            <strong>You have edits here that are not saved.</strong>{' '}
            <span className="text-muted">
              Opening {pendingTab.label} discards them — a draft lives on one tab at a time.
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => { const next = pendingTab; setPendingTab(null); setTab(next); }}
            >
              Discard and open {pendingTab.label}
            </Button>
            <Button onClick={() => setPendingTab(null)}>Stay here</Button>
          </div>
        </div>
      )}


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
            {/*
              * Two sentences, because they are two different facts (P5-T12). "Running
              * something older" is only true of an office whose record says so. An office
              * created before its record for this kind existed may be entirely current, and
              * counting it as behind would have told a Super Admin that every existing office
              * was behind on the Lead statuses and Ratio benchmarks tabs.
              */}
            {(current.template.officesBehind > 0 || current.template.officesUnrecorded > 0) && (
              <p className="mt-2 text-md text-muted">
                {current.template.officesBehind > 0 && (
                  <>
                    {current.template.officesBehind}{' '}
                    {current.template.officesBehind === 1 ? 'office is' : 'offices are'} running
                    something older.{' '}
                  </>
                )}
                {current.template.officesUnrecorded > 0 && (
                  <>
                    {current.template.officesUnrecorded}{' '}
                    {current.template.officesUnrecorded === 1
                      ? 'office was created before the version of this template it started from '
                        + 'was recorded, so whether it is current is not known.'
                      : 'offices were created before the version of this template they started '
                        + 'from was recorded, so whether they are current is not known.'}{' '}
                  </>
                )}
                Publishing does not change them — an office owns its own copy from the day it is
                created.
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

          {/*
            * Switched on the **loaded** kind, not the selected tab. They cannot differ —
            * `current` is null unless they match — and keying off the payload's own kind
            * means a later edit to that guard cannot reintroduce the mismatch.
            *
            * A `switch` with an explicit default, not a ternary. It was
            * `activity_taxonomy ? Taxonomy : Pipeline`, so adding any third kind rendered
            * a payload of the wrong shape through `PipelineEditor` and crashed on
            * `payload.statuses.filter` — a kind added without touching this line would
            * have taken the screen down rather than saying it had no editor.
            */}
          {(() => {
            switch (current.kind) {
              case 'activity_taxonomy':
                return (
                  <TaxonomyEditor
                    payload={current.payload as unknown as TaxonomyPayload}
                    disabled={busy}
                    onChange={(next) => change(next as unknown as Record<string, unknown>)}
                  />
                );
              case 'lead_pipeline':
                return (
                  <PipelineEditor
                    payload={current.payload as unknown as PipelinePayload}
                    disabled={busy}
                    onChange={(next) => change(next as unknown as Record<string, unknown>)}
                  />
                );
              case 'ratio_set':
                return (
                  <RatioSetEditor
                    payload={current.payload as unknown as RatioSetPayload}
                    available={available}
                    disabled={busy}
                    onChange={(next) => change(next as unknown as Record<string, unknown>)}
                  />
                );
              default:
                return (
                  <Card>
                    <p className="text-md text-navy">
                      This preset has no editor yet. It is stored and copied into new
                      offices exactly as it is.
                    </p>
                  </Card>
                );
            }
          })()}
        </>
      )}
    </SettingsScreen>
  );
}
