'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, use } from 'react';
import dynamic from 'next/dynamic';
import { SettingsScreen } from '@/components/settings-screen';
import { listMetrics, type MetricDefinition } from '@/lib/tenant-config';
import {
  ActivationChecklistEditor, CampaignKindsEditor, CapabilityLadderEditor, EventTypesEditor,
  PipelineEditor, RatioSetEditor, TaxonomyEditor, TrainingEditor,
  type ActivationChecklistPayload, type CampaignKindsPayload, type CapabilityLadderPayload,
  type EventTypesPayload, type PipelinePayload, type RatioSetPayload,
  type TaxonomyPayload, type TrainingTaxonomyPayload,
} from '@/components/template-editor';
import { Button, Card } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useHashTab } from '@/lib/use-hash-tab';
import { tileRefusal } from '@/lib/summary-tiles';
import {
  listTemplates, publishTemplate, readTemplate, saveTemplateDraft,
  type CompanyTemplate, type NamedTemplate, type TemplateKind,
} from '@/lib/admin';
import { TemplatePicker } from '@/components/template-picker';
import { kept } from '@/i18n/kept';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { adminTemplateMessages } from '@/i18n/messages/admin-template';
import { checklistMessages } from '@/i18n/messages/settings-checklist';
import { settingsMessages } from '@/i18n/messages/settings';

/*
 * **The Products and Recruitment tabs load when they are opened** (P18.98-T6, the bundle, 2026-10-29). Each reads and
 * writes its own data and draws four card skeletons until it has it, so the skeleton below is the one it would draw
 * first anyway: nothing on the screen changes. Bundled with the page, their words in both languages took this route to
 * 210 kB, past the 200 kB budget, for two tabs most visits never open.
 */
const ProductsTab = dynamic(
  () => import('@/components/products-tab').then((m) => m.ProductsTab),
  { loading: () => <SkeletonCards count={4} /> },
);
const RecruitmentPlaybookTab = dynamic(
  () => import('@/components/recruitment-playbook-tab').then((m) => m.RecruitmentPlaybookTab),
  { loading: () => <SkeletonCards count={4} /> },
);

/**
 * **The tabs every template shares** (ADR-0115 §3, §7): carrier rules, products and the recruitment
 * playbook are the company's, read live by its offices (ADR-0026, ADR-0033, ADR-0125), one per company
 * whichever template is shown. Said in a tooltip on the tab, the smallest form that says it (ADR-0062 §2);
 * its words are `admin-template.tsx`'s `shared`.
 */
const SHARED_GROUPS = ['campaigns', 'products', 'recruitment'] as const;
const isShared = (group: string): group is (typeof SHARED_GROUPS)[number] =>
  (SHARED_GROUPS as readonly string[]).includes(group);

/**
 * Each item of the Owner's Settings group, as ADR-0018 lays them out — one row per **leaf**.
 *
 * **Every subtab on this screen is declared here and drawn by the shell.** Three editors used
 * to draw their own, below the Save card, while `Activity types` drew its two through the
 * shell above it — so the same control sat on either side of the same button depending on
 * which tab you were on, in two different shapes. A reader cannot learn a layout that moves.
 *
 * Two kinds of leaf share the row and are deliberately indistinguishable to a reader:
 *
 * - **A different template kind** — `Activity types` / `Ratio benchmarks`. Switching reloads.
 * - **A section of one kind** — `Sales` / `Recruitment`. Switching draws a different part of
 *   the payload already in hand, so an unsaved draft survives it and nothing is refetched.
 */
const TABS: {
  /** Unique, and what stands in the address bar. */
  key: string;
  /** The top row this leaf belongs to. */
  group: string;
  /** The top row's label, §A.3's kept term. Written once per group; the first leaf's copy is the one read. */
  groupLabel: string;
  /** The subtab's own label, §A.3's kept term. Only drawn when its group has more than one leaf. */
  label: string;
  kind: TemplateKind | null;
  /** Set when several leaves share one `kind` and differ only in what they draw. */
  section?: string;
}[] = [
  /*
   * `Activity types` and `Ratio benchmarks` are **subtabs of one item**, not two tabs.
   * ADR-0018's own table says so, and it mirrors the Owner's Settings group, where the
   * benchmarks live inside the Activity types screen (`KPM_Owner.html:1329-1330`).
   */
  { key: 'activity', group: 'activity', groupLabel: kept('Activity types'), label: kept('Activity types'), kind: 'activity_taxonomy' },
  { key: 'ratios', group: 'activity', groupLabel: kept('Activity types'), label: kept('Ratio benchmarks'), kind: 'ratio_set' },

  // The Owner's own screen splits the two ladders this way, and a Super Admin filling a
  // template should be looking at what an Owner will see.
  { key: 'leads-sales', group: 'leads', groupLabel: kept('Lead statuses'), label: kept('Sales'), kind: 'lead_pipeline', section: 'sales' },
  { key: 'leads-recruitment', group: 'leads', groupLabel: kept('Lead statuses'), label: kept('Recruitment'), kind: 'lead_pipeline', section: 'recruitment' },

  { key: 'activation', group: 'activation', groupLabel: kept('Activation checklist'), label: kept('Activation checklist'), kind: 'activation_checklist' },

  { key: 'training-categories', group: 'training', groupLabel: kept('Training'), label: kept('Categories'), kind: 'training_taxonomy', section: 'categories' },
  { key: 'training-skills', group: 'training', groupLabel: kept('Training'), label: kept('Skills'), kind: 'training_taxonomy', section: 'skills' },
  { key: 'training-modules', group: 'training', groupLabel: kept('Training'), label: kept('Modules'), kind: 'training_taxonomy', section: 'modules' },

  /*
   * Same position as the Owner's sidebar. ADR-0018 makes this screen a mirror of that group,
   * so the order is read from there rather than chosen again here — it had drifted.
   *
   * **Called *Capability Mapping* on both sides**, with the same two halves. It was
   * *Capability catalog* until an office read it as a second product catalog next to Products,
   * then *Skills & stages*, and is now the prototype's own words for this card
   * (`Overall.html:4349`) — which is what the Owner's screen says too, so nobody has to learn
   * that one screen is the other under a different name (parity L-23).
   */
  { key: 'capability-ladder', group: 'capability', groupLabel: kept('Capability Mapping'), label: kept('Ladder'), kind: 'capability_ladder', section: 'ladder' },
  { key: 'capability-skills', group: 'capability', groupLabel: kept('Capability Mapping'), label: kept('Skills'), kind: 'capability_ladder', section: 'skills' },

  { key: 'events', group: 'events', groupLabel: kept('Events'), label: kept('Events'), kind: 'event_types' },

  /*
   * **The Owner's *Campaigns* tab has no counterpart here, and that is not an omission.**
   * Their screen holds the office's own campaign records beside the carrier's rules; this one
   * holds only the rules, because a company campaign is a **live record** and not a preset
   * copied into an office (ADR-0034). The subtabs are therefore the Owner's two *headings*
   * rather than their two tabs. Authoring a company's own campaigns is Phase 12.
   */
  { key: 'campaign-tiers', group: 'campaigns', groupLabel: kept('Campaigns'), label: kept('Production club tiers'), kind: 'campaign_kinds', section: 'production_club' },
  { key: 'campaign-moc', group: 'campaigns', groupLabel: kept('Campaigns'), label: kept('Maintenance of Contract'), kind: 'campaign_kinds', section: 'moc' },
  // `QUALIFICATION_RULE_KINDS` has three members and the Owner's screen surfaces two. A rule
  // of this kind is storable, publishable and provisioned like the others; leaving it out of
  // the row would make the only screen that can author it unreachable.
  { key: 'campaign-promotion', group: 'campaigns', groupLabel: kept('Campaigns'), label: kept('Promotion paths'), kind: 'campaign_kinds', section: 'promotion_path' },

  { key: 'products', group: 'products', groupLabel: kept('Products'), label: kept('Products'), kind: null },

  /*
   * **The company's recruitment playbook** (P17-T8, OD-88 → 5, ADR-0125): *Products*' kind of tab —
   * the company's own, read live by every agent's Attack Plan, no template kind and no draft bar.
   * Not under *Lead statuses › Recruitment*, which is a preset ladder copied into an office; this is
   * the words a plan is built from.
   */
  { key: 'recruitment', group: 'recruitment', groupLabel: kept('Recruitment'), label: kept('Recruitment'), kind: null },
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
  const t = useMessages(adminTemplateMessages);
  const settings = useMessages(settingsMessages);
  const checklist = useMessages(checklistMessages);
  const language = useLanguage();
  /*
   * **The tab stands in the address bar**, so a refresh lands where the reader was and a
   * pasted link opens the tab it was copied from. It used to be `useState(TABS[0])`, which
   * meant every reload and every shared link went back to Activity types.
   */
  const [tabHref, selectTabHref] = useHashTab(TABS.map((x) => ({ href: `#${x.key}` })));
  const tab = TABS.find((x) => `#${x.key}` === tabHref) ?? TABS[0];
  /**
   * Where the reader asked to go while holding unsaved edits — another tab, or another template.
   * `null` the rest of the time.
   */
  const [pendingTab, setPendingTab] = useState<{ label: string; go: () => void } | null>(null);

  /**
   * **The company's templates, and the one shown** (ADR-0115 §3). Every kind tab reads and writes the
   * template picked here; the company's default until the reader picks another.
   */
  const [templates, setTemplates] = useState<NamedTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const shown = templates?.find((row) => row.id === templateId) ?? null;

  /** One entry per Owner Settings **item** — the top row, first leaf wins. */
  const GROUPS = TABS.filter((x, i) => TABS.findIndex((y) => y.group === x.group) === i);
  /** The leaves of the item in view. More than one means a second row of tabs. */
  const siblings = TABS.filter((x) => x.group === tab.group);
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
   * Unsaved edits on the *Recruitment* tab, which holds its own form: the playbook is not a template
   * kind, so `dirty` never sees it, and leaving the tab discards it all the same.
   */
  const [playbookDirty, setPlaybookDirty] = useState(false);

  /**
   * Move to a leaf, asking first only when something could actually be lost.
   *
   * **A section change cannot lose anything** — it draws a different part of the payload
   * already in hand, so warning about unsaved edits there would be a false alarm on every
   * `Sales` ↔ `Recruitment` click. Only a change of `kind` reloads, and only that discards —
   * that, and leaving the *Recruitment* tab, whose playbook form goes with it.
   */
  const go = (next: typeof TABS[number]) => {
    if (next.key === tab.key) return;
    if ((dirty && next.kind !== tab.kind) || (tab.key === 'recruitment' && playbookDirty)) {
      setPendingTab({ label: next.label, go: () => selectTabHref(`#${next.key}`) });
      return;
    }
    selectTabHref(`#${next.key}`);
  };

  /**
   * Show another template, asking first when unsaved edits would go with the one shown — whether the
   * reader picked it, or just made it with *New template* or *Import from another company* (P13.2's exit
   * review: those two opened it straight away, and the draft went with no question asked).
   */
  const openTemplate = (nextId: string, name: string) => {
    if (nextId === templateId) return;
    if (dirty) {
      setPendingTab({ label: name, go: () => setTemplateId(nextId) });
      return;
    }
    setTemplateId(nextId);
  };
  const pickTemplate = (nextId: string) => {
    const next = templates?.find((row) => row.id === nextId);
    if (next) openTemplate(nextId, next.name);
  };

  useEffect(() => {
    void listTemplates(companyId)
      .then((rows) => {
        setTemplates(rows);
        setTemplateId((was) => (rows.some((row) => row.id === was) ? was : (rows.find((row) => row.isDefault) ?? rows[0])?.id ?? null));
      })
      .catch((err) => setError(toDisplayError(err)));
  }, [companyId]);

  /**
   * A template was made, renamed, made the default or archived: the list as the API now has it. One just
   * made is opened through the same question a pick asks — "Stay here" keeps the draft, and the new
   * template waits in the picker.
   */
  const templateChanged = (saved: NamedTemplate, select: boolean) => {
    void listTemplates(companyId).then(setTemplates).catch(() => {
      setTemplates((list) => (list ? [...list.filter((row) => row.id !== saved.id), saved] : [saved]));
    });
    if (select) openTemplate(saved.id, saved.name);
  };
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
  /*
   * The company's own training modules, for the checklist's link picker — read from the
   * `training_taxonomy` tab's draft for the same reason the ratio editor reads the taxonomy's:
   * a Super Admin fills both in one sitting, and offering only published codes would make that
   * impossible. Provisioning checks the link against what an office is actually given.
   */
  const [companyModules, setCompanyModules] = useState<{ code: string; title: string }[]>([]);

  /**
   * The platform's metric vocabulary, for the Campaigns tab (P5-T9).
   *
   * Read rather than listed here: a rule names a metric the product actually computes, and a
   * second copy of the list in this file is the thing invariant 7 exists to prevent.
   */
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);

  /**
   * The kind most recently asked for.
   *
   * A ref rather than state: it is read at the moment a response lands, and it must be the
   * value at *that* moment, not the one captured when the request went out. `fetch` has no
   * cancellation here, so dropping the answer is the cancellation.
   */
  const wanted = useRef<string | null>(null);

  const load = useCallback(async (kind: TemplateKind, template: string) => {
    const key = `${template}:${kind}`;
    wanted.current = key;
    setLoaded(null);
    try {
      const row = await readTemplate(companyId, kind, template);
      // **Dropped if the reader has moved on.** Tagging the state with its kind stops a
      // late answer being *drawn* under the wrong tab; this stops it clobbering the right
      // one, which would blank the screen back to a skeleton for no reason a reader could
      // see. On a slow connection that is the ordinary case, not the rare one.
      if (wanted.current !== key) return;
      setLoaded({ kind, template: row, payload: row.payload });
      setDirty(false);
    } catch (err) {
      if (wanted.current !== key) return;
      setError(toDisplayError(err));
    }
  }, [companyId]);

  /*
   * Keyed on the **kind**, not on the leaf. Switching `Sales` → `Recruitment` is the same
   * template drawn differently; refetching it would throw away the draft in hand and blink
   * the screen back to a skeleton for a change that touched no data.
   */
  useEffect(() => {
    if (tab.kind && templateId) void load(tab.kind, templateId);
  }, [tab.kind, templateId, load]);

  useEffect(() => {
    if (tab.kind !== 'activation_checklist' || !templateId) return;
    void readTemplate(companyId, 'training_taxonomy', templateId)
      .then((row) => {
        const { modules } = row.payload as { modules?: { code: string; title: string }[] };
        setCompanyModules(modules ?? []);
      })
      // A checklist editor with no module list still works: it offers the three feature links.
      .catch(() => setCompanyModules([]));
  }, [companyId, tab.kind, templateId]);

  useEffect(() => {
    if (tab.kind !== 'campaign_kinds') return;
    // A rule editor with no metric list can still edit names and ranks, so a failure here does
    // not take the tab down with it.
    void listMetrics().then(setMetrics).catch(() => setMetrics([]));
  }, [tab.kind]);

  useEffect(() => {
    if (tab.kind !== 'ratio_set' || !templateId) return;
    void readTemplate(companyId, 'activity_taxonomy', templateId)
      .then((row) => {
        const { types } = row.payload as { types?: { code: string; label: string }[] };
        setAvailable(types ?? []);
      })
      // A ratio editor with no code list is still usable — it just cannot offer names.
      // Failing the whole tab over it would be worse than showing codes alone.
      .catch(() => setAvailable([]));
  }, [companyId, tab.kind, templateId]);

  async function run(action: () => Promise<CompanyTemplate>) {
    setBusy(true);
    setError(null);
    try {
      const row = await action();
      setLoaded({ kind: row.kind, template: row, payload: row.payload });
      setDirty(false);
    } catch (err) {
      const shown = toDisplayError(err);
      setError(tileRefusal(shown, language) ?? shown);
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
      title={t.title}
      subtitle={t.subtitle}
      permission="company_template:read"
      actions={(
        <div className="flex flex-col items-end gap-3">
          <Link href="/admin/companies" className="text-md font-semibold text-navy underline">
            {t.backToCompanies}
          </Link>
          {templates && templateId && (
            <TemplatePicker
              companyId={companyId}
              templates={templates}
              selectedId={templateId}
              onSelect={pickTemplate}
              onChanged={templateChanged}
              disabled={busy}
            />
          )}
        </div>
      )}
      /*
       * Two rows, because an Owner Settings **item** split across routes is one item with
       * subtabs — ADR-0018's own table, and the Owner's own screen. The shell fixes where
       * they sit; `variant="subtabs"` fixes what they look like, which mattered here more
       * than anywhere: the group is *Activity types* and so is the first of its halves, so
       * the same word sat in two identically-underlined rows.
       */
      tabsLabel={t.sections}
      tabs={GROUPS.map((g) => ({
        label: g.groupLabel, href: `#${g.group}`, hint: isShared(g.group) ? t.shared[g.group] : undefined,
      }))}
      activeHref={`#${tab.group}`}
      /*
       * Unsaved edits are named before they are lost.
       *
       * Switching tabs reloads, and `load` resets `dirty` — so a draft somebody had typed
       * vanished with nothing said. `dirty` was already tracked and already gated both
       * buttons; the one place it was not consulted was the one place a change could
       * disappear.
       */
      // The group's first leaf, so opening `Lead statuses` lands on `Sales`.
      onSelectTab={(href) => go(TABS.find((x) => `#${x.group}` === href) ?? TABS[0])}
      subtabs={siblings.length > 1
        ? siblings.map((x) => ({ label: x.label, href: `#${x.key}` }))
        : undefined}
      subtabsLabel={settings.sections({ title: tab.groupLabel })}
      activeSubtab={`#${tab.key}`}
      onSelectSubtab={(href) => go(TABS.find((x) => `#${x.key}` === href) ?? tab)}
      error={error}
    >
      {pendingTab && (
        <div role="alert" className="mb-4 rounded-md border border-amber bg-card p-4">
          <p className="text-md text-navy">
            <strong>{t.pending.unsaved}</strong>{' '}
            <span className="text-muted">{t.pending.discards({ label: pendingTab.label })}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const next = pendingTab;
                setPendingTab(null);
                next.go();
              }}
            >
              {t.pending.discardAndOpen({ label: pendingTab.label })}
            </Button>
            <Button onClick={() => setPendingTab(null)}>{t.pending.stay}</Button>
          </div>
        </div>
      )}


      {/*
        * **Products is a tab with no template kind**, because a catalog is not a preset copied
        * into an office — it is read live (ADR-0033). It owns its own reading and writing, and
        * carries no draft bar, which is the whole point of it being here rather than behind one.
        */}
      {tab.key === 'products' ? (
        <ProductsTab companyId={companyId} />
      ) : tab.key === 'recruitment' ? (
        // The playbook is the company's, not the template's: switching template leaves it as it is.
        <RecruitmentPlaybookTab companyId={companyId} onDirtyChange={setPlaybookDirty} />
      ) : current === null || !shown ? (
        <SkeletonCards count={3} />
      ) : (
        <>
          <Card className="mb-4">
            <p className="text-md text-navy">
              {current.template.publishedVersion === null ? (
                /*
                 * ADR-0115 §1: there is no fallback any more. An office made from this template gets
                 * none of a kind it never published — the three cascade activity types excepted, and the
                 * capability ladder, which is the platform's where a template has none (ADR-0116).
                 */
                current.kind === 'campaign_kinds' ? t.publish.nothingRules
                  : current.kind === 'capability_ladder' ? t.publish.nothingLadder({ name: shown.name })
                    : t.publish.nothingNone({ name: shown.name })
              ) : t.publish.published({
                // The carrier rules are the company's, whichever template is shown (ADR-0115 §7).
                name: current.kind === 'campaign_kinds' ? null : shown.name,
                version: <strong>{t.publish.version({ n: current.template.publishedVersion })}</strong>,
                draft: current.template.status === 'draft' ? current.template.version : null,
              })}
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
                {[
                  current.template.officesBehind > 0 ? t.publish.behind({ n: current.template.officesBehind }) : null,
                  current.template.officesUnrecorded > 0
                    ? t.publish.unrecorded({ n: current.template.officesUnrecorded }) : null,
                  t.publish.unchanged,
                ].filter(Boolean).join(' ')}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                disabled={busy || !dirty || (shown.status === 'archived' && current.kind !== 'campaign_kinds')}
                title={shown.status === 'archived' ? t.publish.archivedKept : undefined}
                onClick={() => void run(() => saveTemplateDraft(companyId, tab.kind!, current.payload, templateId))}
              >
                {busy ? settings.saving : checklist.saveDraft}
              </Button>
              {/* Kept as it is when archived, as Save draft is — but for the company's own campaign kinds. */}
              <Button
                variant="secondary"
                disabled={busy || dirty || current.template.status !== 'draft'
                  || (shown.status === 'archived' && current.kind !== 'campaign_kinds')}
                title={shown.status === 'archived' && current.kind !== 'campaign_kinds'
                  ? t.publish.archivedKept
                  : dirty ? checklist.saveDraftFirst : undefined}
                onClick={() => void run(() => publishTemplate(companyId, tab.kind!, templateId))}
              >
                {checklist.publishVersion({ n: current.template.version })}
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
                    pipeline={tab.section as 'sales' | 'recruitment'}
                    disabled={busy}
                    onChange={(next) => change(next as unknown as Record<string, unknown>)}
                  />
                );
              case 'activation_checklist':
                return (
                  <ActivationChecklistEditor
                    payload={current.payload as unknown as ActivationChecklistPayload}
                    modules={companyModules}
                    linkKinds={current.template.linkKinds ?? null}
                    disabled={busy}
                    onChange={(next) => change(next as unknown as Record<string, unknown>)}
                  />
                );
              case 'training_taxonomy':
                return (
                  <TrainingEditor
                    payload={current.payload as unknown as TrainingTaxonomyPayload}
                    section={tab.section as 'categories' | 'skills' | 'modules'}
                    disabled={busy}
                    onChange={(next) => change(next as unknown as Record<string, unknown>)}
                  />
                );
              case 'event_types':
                return (
                  <EventTypesEditor
                    payload={current.payload as unknown as EventTypesPayload}
                    disabled={busy}
                    onChange={(next) => change(next as unknown as Record<string, unknown>)}
                  />
                );
              case 'campaign_kinds':
                return (
                  <CampaignKindsEditor
                    payload={current.payload as unknown as CampaignKindsPayload}
                    metrics={metrics.map((m) => ({ key: m.key, label: m.name, unit: m.unit }))}
                    section={tab.section as 'production_club' | 'moc' | 'promotion_path'}
                    disabled={busy}
                    onChange={(next) => change(next as unknown as Record<string, unknown>)}
                  />
                );
              case 'capability_ladder':
                return (
                  <CapabilityLadderEditor
                    payload={current.payload as unknown as CapabilityLadderPayload}
                    section={tab.section as 'ladder' | 'skills'}
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
                    <p className="text-md text-navy">{t.noEditor}</p>
                  </Card>
                );
            }
          })()}
        </>
      )}
    </SettingsScreen>
  );
}
