'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SettingsScreen, TenantConfigBars } from '@/components/settings-screen';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { ConfigBadge } from '@/components/ui/config-badge';
import { DragHandle } from '@/components/ui/drag-handle';
import { ACTIVITY_SETTINGS_TABS } from '@/components/settings-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, Card, CodeField, Field, FieldRow, TextInput,
} from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { kept } from '@/i18n/kept';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { settingsMessages } from '@/i18n/messages/settings';
import { activityTypesMessages } from '@/i18n/messages/settings-activity-types';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useCan } from '@/lib/session';
import { projectStaged, unstageRow } from '@/lib/staged-projection';
import { planSummaryTile, summaryGroups, summaryTileName, tileRefusal } from '@/lib/summary-tiles';
import { reservedRefusal } from '@/lib/reserved-types';
import { BINDING_ROLE_LABEL, readOwnActivityBinding, rolesByCode, type BindingRole } from '@/lib/activity-binding';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { useMediaQuery } from '@/lib/use-media-query';
import {
  applyConfigChanges,
  stageChange,
  reorderActivityCategories,
  listActivityTypes,
  reorderActivityTypes,
  type ActivityCategoryRow,
  type ConfigChange,
  type ActivityTypeRow,
} from '@/lib/tenant-config';

/** The two section actions that open an editor in their line — the inline link and the ⋮ item, found by their words. */
type Opener = 'rename' | 'scope';

/*
 * **The chip on a bound type: the stage it counts as** (P18.97-T4 AC-1, ADR-0176 §3; the client's UI-022: *"Set
 * Appointment Set appointment"* read as a name and its alias run together). It is no name of the type but the cascade
 * stage the office's activity binding counts it as (ADR-0163 §3), so it says so — *Counts as: Sales meeting* — on the
 * quiet chip the prototype draws for the activity a cascade column counts (`.activity-tag`, `Overall.html:718-721`).
 * Its words are the catalogue's (`countsAs`, `messages/settings-activity-types.ts`).
 */

/**
 * Examples of a code, in the fields that take one: identifiers, the same in both languages, never words (the
 * approved glossary's §D: *a code or key* is not a string to translate).
 */
const SECTION_CODE_EXAMPLE = 'REFERRALS';
const TYPE_CODE_EXAMPLE = 'SELL_REFERRAL';
/**
 * The prototype's own example of a type's description (`KPM_Owner.html`), in the language the platform's activity
 * items are written in (OD-238): an example of what an office types, shown as it is in both languages (ADR-0179 §5).
 */
const DESCRIPTION_EXAMPLE = 'telepon, WhatsApp, tatap muka, dll';

/**
 * What this office counts (P4-T1, `KPM_Owner.html:1340-1440`).
 *
 * **A card per category, numbered items inside** — the prototype's `acttype-card`, whose
 * `Edit` link is an `alert()`. The numbers are the thing to be careful about: the
 * prototype treats 1–12 as the primary key and binds its ratio formulas to them, and here
 * they are **position only**. Reordering renumbers the display and rebinds nothing, which
 * is why the code is shown beside each row: it is the part that does not move.
 *
 * **Archiving is what deleting means** (invariant §3). Every activity log ever written
 * names a type, so a retired one leaves the capture screen and stays readable. *Show
 * archived* is how somebody finds one to bring back.
 */
export default function ActivityTypesPage() {
  const t = useMessages(activityTypesMessages);
  const s = useMessages(settingsMessages);
  const language = useLanguage();
  const canWrite = useCan('tenant_config:write');
  /*
   * **Below 1024px a section's three actions sit behind one ⋮** (P18.97-T6 AC-3, ADR-0178 §2; the client's UI-037:
   * *Rename*, *Change who it applies to* and *Archive the section* wrapped to two rows on a phone and three on a
   * tablet). Asked where the page mounts, before its read, so the sections never draw one way and then the other;
   * from 1024px the hook answers false and the row is the inline links it was, to the byte.
   */
  const belowDesktop = useMediaQuery(['phone', 'tablet']);
  /*
   * **Which types the office's activity binding names** (ADR-0163 §3, P18.9-T2 AC-3): the Owner and the Admin read
   * it, the Super Admin keeps it. A bound type wears its role beside its name — the explicit request of the product
   * owner, 2026-10-26 — and is the one an archive refuses. A failed read leaves the names unmarked.
   */
  const canReadBinding = useCan('activity_binding:read');
  const [bound, setBound] = useState<Map<string, BindingRole>>(new Map());
  const [categories, setCategories] = useState<ActivityCategoryRow[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  // Bumped after any write, so the publish bar re-reads rather than going stale behind
  // an edit the Owner just made.
  const [published, setPublished] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState({ code: '', label: '', description: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  // Section-level controls (P4-T18). The ladder is the company's (ADR-0012): this reads it.
  const { ladder } = useTenantConfig();
  const [scoping, setScoping] = useState<string | null>(null);
  const [rungs, setRungs] = useState<string[]>([]);
  /*
   * Renaming a section (P4-T24). The op and the batch both accepted `label` and
   * `description` from the day the endpoint landed; the screen offered no control, so a
   * section could be created with a typo and never corrected. The code is untouched by
   * this — that is the identity, and invariant §4 is why.
   */
  const [renaming, setRenaming] = useState<string | null>(null);
  /*
   * **Where the focus goes when a section's editor opens and closes** (WCAG 2.4.3; P18.97-T4, parity F-255). *Rename*
   * and *Change who it applies to* replace the line they sit on with an editor, so the control that opened it is gone
   * the moment it is chosen — and the focus with it, to the top of the page. Each section's line is held here, so
   * opening moves the focus to the editor's first control and closing gives it back to what opened it: the inline
   * link from 1024px, the section's ⋮ below it. Refs, not attributes: the line's markup at 1024px is pinned.
   */
  const lines = useRef(new Map<string, HTMLDivElement>());
  const editors = useRef<{ renaming: string | null; scoping: string | null }>({ renaming: null, scoping: null });
  /*
   * `tile` is the section's summary tile (ADR-0064): the name of the tile it counts toward on the
   * agents' strip, or empty for a tile of its own. One field in this edit, not a card of its own
   * (ADR-0062 §2) — see `planSummaryTile` for how a name becomes the two stored fields.
   */
  const [sectionDraft, setSectionDraft] = useState({ label: '', description: '', tile: '' });
  /** Why the typed tile name was refused, shown at the field — or null. */
  const [tileError, setTileError] = useState<string | null>(null);
  /*
   * Codes off the list by default (P4-T24).
   *
   * `SELL_SUBMISSION` under every one of twelve rows is noise to the Owner who reads this
   * screen weekly, and the identity is still reachable: the edit panel always shows it,
   * and this toggle brings it back for template work and for support tickets. The same
   * control, defaulted the same way, as the ratio screen.
   */
  const [addingSection, setAddingSection] = useState(false);
  const [section, setSection] = useState({ code: '', label: '', description: '' });
  // Native HTML5 drag, the way the frozen prototype does it
  // (`AgencyBoost_KPM_Owner.html:2873-2900`). No library: this screen is two vertical
  // lists, and `check-bundle-size.mjs` gates what a dependency would cost.
  const [dragging, setDragging] = useState<{ kind: 'type' | 'section'; id: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /*
   * Staged edits (P4-T19), the same model the ratio screen uses. Reordering is the one
   * thing that still writes immediately: it bumps no version and reaches nobody until
   * publish, so holding it behind Save would mean a drag that visibly did nothing.
   */
  const [staged, setStaged] = useState<ConfigChange[]>([]);

  /*
   * **Always read the archived rows, and filter for display.**
   *
   * Reordering names the whole list, and the server counts every type the office has —
   * archived included (`activity.service.ts:182`). Reading only the visible ones sent a
   * short list, so an office with a single archived type got `400 Send every activity
   * type, once each` on every reorder, for ever. Office 0417 reached that state the
   * ordinary way: somebody made a test type and archived it.
   *
   * Fetching once and filtering also means toggling *Show archived* costs no round trip.
   */
  const load = useCallback(async () => {
    try {
      setCategories(await listActivityTypes(true));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const was = editors.current;
    editors.current = { renaming, scoping };
    /** The editor's first control, or what opened it — the link by its words from 1024px, the ⋮ below. */
    const focusIn = (id: string, into: 'editor' | Opener) => {
      const line = lines.current.get(id);
      if (!line) return;
      const target = into === 'editor'
        ? line.querySelector<HTMLElement>('input, select, textarea, button')
        : belowDesktop
          ? line.querySelector<HTMLElement>('button[aria-haspopup="menu"]')
          : [...line.querySelectorAll<HTMLElement>('button')]
            .find((b) => b.textContent === (into === 'rename' ? s.rename : s.changeWhoItAppliesTo));
      target?.focus();
    };
    // Closed first, then opened: moving straight from one section's editor to another's ends in the new one.
    if (was.renaming && was.renaming !== renaming) focusIn(was.renaming, 'rename');
    if (was.scoping && was.scoping !== scoping) focusIn(was.scoping, 'scope');
    if (renaming && renaming !== was.renaming) focusIn(renaming, 'editor');
    if (scoping && scoping !== was.scoping) focusIn(scoping, 'editor');
  }, [renaming, scoping, belowDesktop, s]);

  useEffect(() => {
    if (!canReadBinding) return;
    let live = true;
    readOwnActivityBinding()
      .then((binding) => { if (live) setBound(rolesByCode(binding)); })
      .catch(() => { /* the names stay unmarked; the archive's refusal still says why */ });
    return () => { live = false; };
  }, [canReadBinding]);

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      await load();
      setPublished((n) => n + 1);
    } catch (err) {
      const shown = toDisplayError(err);
      // A bound type, or its section, refused archiving (ADR-0163 §5): said plainly.
      setError(tileRefusal(shown, language) ?? reservedRefusal(shown) ?? shown);
    } finally {
      setBusy(null);
    }
  }

  /**
   * Move one row, and send the whole list.
   *
   * The endpoint takes every id in the order wanted rather than a single move, so this
   * computes the new order and hands it over entire. Two people dragging at once then
   * produce one of their two orders, rather than an interleaving neither asked for.
   */
  function move(all: ActivityTypeRow[], id: string, by: -1 | 1) {
    const order = all.map((t) => t.id);
    const at = order.indexOf(id);

    /*
     * Step over anything the reader cannot see. The list sent is every type the office
     * has, archived included — but swapping with a hidden neighbour reads on screen as a
     * button that did nothing, and the reader presses it again.
     */
    const visible = new Set(all.filter((t) => showArchived || t.status === 'active').map((t) => t.id));
    let to = at + by;
    while (to >= 0 && to < order.length && !visible.has(order[to])) to += by;
    if (to < 0 || to >= order.length) return;

    [order[at], order[to]] = [order[to], order[at]];
    void run(`move:${id}`, () => reorderActivityTypes(order));
  }

  // Every type in the office, archived included: this is the list a reorder must name.
  const flat = (categories ?? []).flatMap((c) => c.types);

  /** Move a section by one, skipping any the reader cannot see. The handle's ↑↓ path. */
  function moveSection(id: string, by: -1 | 1) {
    const all = categories ?? [];
    const order = all.map((c) => c.id);
    const at = order.indexOf(id);
    const visible = new Set(all.filter((c) => showArchived || c.status === 'active').map((c) => c.id));
    let to = at + by;
    while (to >= 0 && to < order.length && !visible.has(order[to])) to += by;
    if (at < 0 || to < 0 || to >= order.length) return;
    [order[at], order[to]] = [order[to], order[at]];
    void run(`move-section:${id}`, () => reorderActivityCategories(order));
  }

  /** Hold an edit instead of sending it. Two ops on one row collapse into the later one. */
  const stage = (change: ConfigChange) => setStaged((now) => stageChange(now, change));

  async function saveStaged() {
    await run('save', async () => {
      await applyConfigChanges(staged);
      setStaged([]);
    });
  }

  /**
   * Drop `dragging` where `targetId` sits, and send the whole list.
   *
   * Reordering by naming every id is the endpoint's contract and the reason is written on
   * it: a single move would make the server infer what happened to the rest. So this
   * splices locally and hands over the result entire.
   *
   * **Drag is the pointer path; the ↑↓ buttons are the keyboard and touch path.** Native
   * HTML5 drag reaches neither, and half of this product is used on a phone — so the
   * buttons stay, prominent, rather than hiding behind a handle.
   */
  function drop(targetId: string) {
    const held = dragging;
    setDragging(null);
    setOver(null);
    if (!held || held.id === targetId) return;

    if (held.kind === 'section') {
      const order = (categories ?? []).map((c) => c.id);
      const from = order.indexOf(held.id);
      const to = order.indexOf(targetId);
      if (from < 0 || to < 0) return;
      order.splice(to, 0, ...order.splice(from, 1));
      void run(`drag-section:${held.id}`, () => reorderActivityCategories(order));
      return;
    }

    const order = flat.map((t) => t.id);
    const from = order.indexOf(held.id);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(to, 0, ...order.splice(from, 1));
    void run(`drag:${held.id}`, () => reorderActivityTypes(order));
  }

  /**
   * Who a section is for, in words. Empty reads as *Everyone* — a blank beside
   * "Applies to" looks like a setting that failed to load.
   */
  const appliesTo = (codes: string[]) =>
    (codes.length === 0
      ? s.everyone
      : codes.map((c) => ladder.find((l) => l.code === c)?.label ?? c).join(' · '));

  /*
   * What the reader sees: a subset of what a reorder sends, and — since P4-T19 — the rows
   * as they *will* be rather than as the office still has them.
   *
   * Every one of this screen's eight operations was staged and none of them showed:
   * archiving five types changed nothing on screen, and adding one drew no row at all. The
   * only evidence was a count in a bar. See `lib/staged-projection.ts`.
   */
  const shown = projectStaged(categories ?? [], staged, {
    entity: 'category',
    create: (body, id) => ({
      id,
      code: String(body.code ?? ''),
      label: String(body.label ?? ''),
      description: body.description ? String(body.description) : null,
      appliesToOrgLevelCodes: [],
      displayOrder: (categories?.length ?? 0) + 1,
      version: 0,
      status: 'active' as const,
      types: [],
    }),
  }).map(({ row: category, staged: mark }) => ({
    ...category,
    staged: mark,
    types: projectStaged(
      category.types,
      // A new type belongs to the one section it named. Without this filter every section
      // would sprout its own copy of it.
      staged.filter((c) => c.op !== 'type.create' || c.body?.categoryCode === category.code),
      {
        entity: 'type',
        create: (body, id) => ({
          id,
          code: String(body.code ?? ''),
          categoryCode: category.code,
          label: String(body.label ?? ''),
          description: body.description ? String(body.description) : null,
          appliesToOrgLevelCodes: [],
          displayOrder: category.types.length + 1,
          version: 0,
          status: 'active' as const,
        }),
      },
    // A row held for archive stays on screen even when archived rows are hidden: it has
    // not happened yet, and hiding it takes the Undo away with it.
    ).filter(({ row, staged: mark }) => showArchived || row.status === 'active' || mark),
  }));

  /*
   * **A section's actions, once** — the inline links from 1024px and the ⋮'s items below it do the same four things
   * (P18.97-T6 AC-3), so the two cannot come to differ. Archiving and restoring are staged, as every edit here is.
   */
  type Section = (typeof shown)[number];
  const startRename = (category: Section) => {
    setTileError(null);
    setRenaming(category.id);
    setSectionDraft({
      label: category.label,
      description: category.description ?? '',
      tile: summaryTileName(category),
    });
  };
  const startScoping = (category: Section) => {
    setScoping(category.id);
    setRungs(category.appliesToOrgLevelCodes);
  };
  const archiveSection = (category: Section) => stage({
    op: 'category.archive',
    id: category.id,
    expectedVersion: category.version,
  });
  const restoreSection = (category: Section) => stage({
    op: 'category.restore',
    id: category.id,
    expectedVersion: category.version,
  });
  /** The ⋮'s items, in the inline links' order and words; archive and restore held while a write is out, as theirs. */
  const sectionMenu = (category: Section): ActionMenuItem[] => [
    { label: s.rename, onSelect: () => startRename(category) },
    { label: s.changeWhoItAppliesTo, onSelect: () => startScoping(category) },
    category.status === 'active'
      ? {
        label: t.archiveSection,
        tone: 'alert',
        hint: t.archiveSectionHint,
        disabled: busy !== null,
        onSelect: () => archiveSection(category),
      }
      : { label: t.restoreSection, disabled: busy !== null, onSelect: () => restoreSection(category) },
  ];

  /**
   * The badge an agent sees beside a row, counted over the **live** rows only.
   *
   * `displayOrder` is the stored ordinal and it keeps counting through archived rows — so an
   * office that archived item 3 saw `1 2 4 5`, which reads as a row that failed to load rather
   * than as one that was retired. An archived row gets **no number at all**: it is out of the
   * sequence, and giving it one would put the gap back the moment archived rows were shown.
   *
   * Counted across the whole office rather than per section, because that is what the badge has
   * always meant — the prototype's 1–12 run through all four sections. Presentation only, and
   * reorderable, which is why nothing references it (glossary §*Display numbers are not
   * identifiers*).
   */
  const liveNumber = new Map<string, number>();
  let counted = 0;
  for (const category of (categories ?? [])) {
    for (const type of category.types) {
      if (type.status !== 'active') continue;
      counted += 1;
      liveNumber.set(type.id, counted);
    }
  }

  return (
    <SettingsScreen
      title={kept('Activity types')}
      subtitle={t.subtitle}
      permission="tenant_config:read"
      tabs={ACTIVITY_SETTINGS_TABS}
      error={error}
      bars={(
        <TenantConfigBars
          publishRefreshKey={published}
          staged={{
            count: staged.length,
            busy: busy !== null,
            onSave: () => void saveStaged(),
            onDiscard: () => setStaged([]),
          }}
        />
      )}
      toolbar={{
        /* `config-toolbar`'s hint: the prototype leads every settings screen with a count
           sentence, and it is the fastest way to see that a taxonomy is complete. */
        /* Counted off the projection, so the sentence agrees with the cards under it.
           Read from `categories` it described the office's saved taxonomy while the
           screen showed the staged one. */
        hint: categories === null
          ? '\u00a0'
          : t.count({
            types: shown.flatMap((c) => c.types).filter(({ row }) => row.status === 'active').length,
            sections: shown.length,
          }),
        /* Archiving is reversible by design (invariant §3) and Restore is one click away,
           so the controls are not red and there is no confirmation: a confirm on a
           reversible act teaches people to dismiss confirms. */
        actions: (
          <>
            <label className="flex items-center gap-2 text-md text-navy">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              {s.showArchived}
            </label>
          </>
        ),
      }}
    >

      {canWrite && categories !== null && (
        <Card className="mb-4">
          {addingSection ? (
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-bold text-navy">{t.addSection}</h2>
              <p className="text-sm text-muted">{t.addSectionLead}</p>
              <FieldRow>
                <Field label={s.code} htmlFor="new-section-code" hint={t.permanentOnceSaved} className="min-w-48">
                  <TextInput
                    id="new-section-code"
                    value={section.code}
                    onChange={(e) => setSection({ ...section, code: e.target.value.toUpperCase() })}
                    placeholder={SECTION_CODE_EXAMPLE}
                  />
                </Field>
                <Field label={s.name} htmlFor="new-section-label" className="min-w-60 flex-1">
                  <TextInput
                    id="new-section-label"
                    value={section.label}
                    onChange={(e) => setSection({ ...section, label: e.target.value })}
                  />
                </Field>
                <Field
                  label={s.description}
                  htmlFor="new-section-description"
                  hint={s.optional}
                  className="min-w-60 flex-1"
                >
                  <TextInput
                    id="new-section-description"
                    value={section.description}
                    onChange={(e) => setSection({ ...section, description: e.target.value })}
                  />
                </Field>
              </FieldRow>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy !== null || !section.code.trim() || !section.label.trim()}
                  onClick={() => {
                    stage({
                      op: 'category.create',
                      body: {
                        code: section.code,
                        label: section.label,
                        description: section.description || undefined,
                      },
                    });
                    setSection({ code: '', label: '', description: '' });
                    setAddingSection(false);
                  }}
                >
                  {t.addTheSection}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAddingSection(false);
                    setSection({ code: '', label: '', description: '' });
                  }}
                >
                  {s.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setAddingSection(true)}>{t.addSection}</Button>
          )}
        </Card>
      )}

      {categories === null ? (
        <SkeletonCards count={5} />
      ) : categories.length === 0 ? (
        <EmptyState title={t.none} />
      ) : (
        // `acttype-grid`: two columns, one per category, collapsing at the prototype's
        // own 760px. Five cards stacked made the screen a scroll where it is a glance.
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {shown.map((category) => (
            <Card
              key={category.id}
              /* `data-row` is what `DragHandle` looks for to set the drag image — without it
                 the browser lifts the handle button instead of the section. */
              data-row={category.id}
              className={[
                over === category.id ? 'ring-2 ring-amber' : '',
                dragging?.kind === 'section' && dragging.id === category.id ? 'opacity-40' : '',
              ].filter(Boolean).join(' ')}
              onDragOver={(e) => {
                if (!dragging || dragging.kind !== 'section') return;
                e.preventDefault();
                setOver(category.id);
              }}
              onDragLeave={() => setOver((now) => (now === category.id ? null : now))}
              onDrop={(e) => { e.preventDefault(); drop(category.id); }}
            >
              {/*
                * `ml-auto` on the trailing group, not `justify-between` on the row.
                *
                * The prototype's `.acttype-card-head` has two children — heading left,
                * count pill right. This had three, because the drag handle was put in the
                * head, so `justify-between` spread them and the heading floated to the
                * middle of the card. Worse, the handle is behind `canWrite`, so **where
                * the heading sat depended on who was reading**. Pushing only the meta
                * group right states the intent and is indifferent to how many controls
                * precede it.
                */}
              <div className="flex flex-wrap items-baseline gap-2">
                {canWrite && (
                  <DragHandle
                    label={category.label}
                    disabled={busy !== null}
                    onPick={() => setDragging({ kind: 'section', id: category.id })}
                    onDrop={() => { setDragging(null); setOver(null); }}
                    onMove={(by) => moveSection(category.id, by)}
                  />
                )}
                <h2 className="font-display text-lg font-bold text-navy">{category.label}</h2>
                <span className="ml-auto flex items-center gap-2">
                  {category.staged && (
                    <>
                      <span className="whitespace-nowrap rounded-full bg-amber/20 px-2 py-0.5 text-sm text-navy">
                        {s.staged.mark[category.staged]}
                      </span>
                      <button
                        type="button"
                        className="text-sm font-semibold text-navy underline"
                        onClick={() => setStaged((now) => unstageRow(now, 'category', category.id))}
                      >
                        {s.undo}
                      </button>
                    </>
                  )}
                  <span className="whitespace-nowrap rounded-full border border-hairline bg-canvas px-2 py-0.5 text-sm font-semibold text-muted">
                    {s.items({ n: category.types.length })}
                  </span>
                </span>
              </div>

              {category.description && (
                <p className="mt-1 text-sm text-muted">{category.description}</p>
              )}

              <div
                ref={(line) => {
                  if (line) lines.current.set(category.id, line);
                  else lines.current.delete(category.id);
                }}
                className="mt-2 flex flex-wrap items-center gap-2 border-b border-hairline pb-3"
              >
                {scoping === category.id ? (
                  <>
                    <fieldset className="min-w-0 flex-1">
                      <legend className="text-sm font-semibold text-navy">{s.appliesTo}</legend>
                      <ul className="mt-1 flex flex-wrap gap-3">
                        {ladder.map((rung) => (
                          <li key={rung.code}>
                            <label className="flex items-center gap-1.5 text-md text-navy">
                              <input
                                type="checkbox"
                                checked={rungs.includes(rung.code)}
                                onChange={(e) => setRungs((now) => (e.target.checked
                                  ? [...now, rung.code]
                                  : now.filter((c) => c !== rung.code)))}
                              />
                              {rung.label}
                            </label>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-sm text-muted">{t.scopeHint}</p>
                    </fieldset>
                    <Button
                      disabled={busy !== null}
                      onClick={() => {
                        stage({
                          op: 'category.update',
                          id: category.id,
                          expectedVersion: category.version,
                          body: { appliesToOrgLevelCodes: rungs },
                        });
                        setScoping(null);
                      }}
                    >
                      {s.save}
                    </Button>
                    <Button variant="secondary" onClick={() => setScoping(null)}>{s.cancel}</Button>
                  </>
                ) : renaming === category.id ? (
                  <>
                    <FieldRow className="min-w-0 flex-1">
                      <Field
                        label={s.name}
                        htmlFor={`rename-${category.id}`}
                        className="min-w-60 flex-1"
                      >
                        <TextInput
                          id={`rename-${category.id}`}
                          value={sectionDraft.label}
                          onChange={(e) => setSectionDraft((d) => ({ ...d, label: e.target.value }))}
                        />
                      </Field>
                      <Field
                        label={s.description}
                        htmlFor={`redescribe-${category.id}`}
                        hint={s.optional}
                        className="min-w-60 flex-1"
                      >
                        <TextInput
                          id={`redescribe-${category.id}`}
                          value={sectionDraft.description}
                          onChange={(e) => setSectionDraft((d) => ({
                            ...d, description: e.target.value,
                          }))}
                        />
                      </Field>
                      {/*
                        * **The summary tile: one field, in the edit that already exists** (ADR-0064,
                        * ADR-0062 §2). A name, offering the tiles the office already has; sections
                        * with the same one share a tile above the Activity Dashboard (Log Activity draws
                        * a tile per section since P18.95-T5 AC-2).
                        */}
                      <Field
                        label={t.summaryTile}
                        htmlFor={`tile-${category.id}`}
                        hint={t.summaryTileHint}
                        error={tileError ?? undefined}
                        className="min-w-60 flex-1"
                      >
                        <TextInput
                          id={`tile-${category.id}`}
                          list="summary-tile-names"
                          maxLength={80}
                          value={sectionDraft.tile}
                          onChange={(e) => {
                            setTileError(null);
                            setSectionDraft((d) => ({ ...d, tile: e.target.value }));
                          }}
                        />
                      </Field>
                    </FieldRow>
                    <Button
                      disabled={busy !== null || !sectionDraft.label.trim()}
                      onClick={() => {
                        // Against every section, archived included — they still render history —
                        // and under the name being saved, so typing it means a tile of its own.
                        const plan = planSummaryTile(
                          sectionDraft.tile, { ...category, label: sectionDraft.label.trim() }, shown, language,
                        );
                        if ('refused' in plan) {
                          setTileError(plan.refused);
                          return;
                        }
                        const pair = (code: string) => {
                          const change = plan.changes.find((c) => c.code === code)!;
                          // Both, always: the server refuses a code without a label, or one alone.
                          return { summaryGroupCode: change.summaryGroupCode, summaryGroupLabel: change.summaryGroupLabel };
                        };
                        stage({
                          op: 'category.update',
                          id: category.id,
                          expectedVersion: category.version,
                          body: {
                            label: sectionDraft.label,
                            description: sectionDraft.description || undefined,
                            ...pair(category.code),
                          },
                        });
                        // The other sections the name changes — joined, renamed with the tile, or
                        // left alone in it — staged beside it, so one save sends one consistent state.
                        for (const change of plan.changes.filter((c) => c.code !== category.code)) {
                          const other = shown.find((s) => s.code === change.code)!;
                          stage({
                            op: 'category.update',
                            id: other.id,
                            expectedVersion: other.version,
                            body: pair(other.code),
                          });
                        }
                        setTileError(null);
                        setRenaming(null);
                      }}
                    >
                      {s.save}
                    </Button>
                    <Button variant="secondary" onClick={() => { setTileError(null); setRenaming(null); }}>{s.cancel}</Button>
                  </>
                ) : (
                  <>
                    <p className="flex-1 text-md text-navy">
                      {/* The label, then who: a label and its value, in that order in both languages. */}
                      <span className="text-muted">{s.appliesTo}{' '}</span>
                      <strong>{appliesTo(category.appliesToOrgLevelCodes)}</strong>
                    </p>
                    {canWrite && (belowDesktop ? (
                      // One ⋮ at the line's end, named for its section, the menu's keys and words its own.
                      <ActionMenu label={s.actionsFor({ name: category.label })} items={sectionMenu(category)} />
                    ) : (
                      <>
                        <Button variant="inline" onClick={() => startRename(category)}>
                          {s.rename}
                        </Button>
                        <Button variant="inline" onClick={() => startScoping(category)}>
                          {s.changeWhoItAppliesTo}
                        </Button>
                        {category.status === 'active' ? (
                          <Button
                            variant="inlineDanger"
                            disabled={busy !== null}
                            title={t.archiveSectionHint}
                            onClick={() => archiveSection(category)}
                          >
                            {t.archiveSection}
                          </Button>
                        ) : (
                          <Button
                            variant="inline"
                            disabled={busy !== null}
                            onClick={() => restoreSection(category)}
                          >
                            {t.restoreSection}
                          </Button>
                        )}
                      </>
                    ))}
                  </>
                )}
              </div>

              <ul className="mt-3 flex flex-col divide-y divide-hairline">
                {category.types.map(({ row: type, staged: typeMark }) => (
                  <li
                    key={type.id}
                    className={`flex flex-wrap items-center gap-3 py-3 ${
                      over === type.id ? 'bg-canvas' : ''
                    } ${dragging?.id === type.id ? 'opacity-40' : ''}`}
                    onDragOver={(e) => {
                      if (!dragging || dragging.kind !== 'type') return;
                      e.preventDefault();
                      setOver(type.id);
                    }}
                    onDragLeave={() => setOver((now) => (now === type.id ? null : now))}
                    onDrop={(e) => { e.preventDefault(); drop(type.id); }}
                  >
                    {canWrite && (
                      <DragHandle
                        label={type.label}
                        disabled={busy !== null}
                        className="cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
                        onPick={() => setDragging({ kind: 'type', id: type.id })}
                        onDrop={() => { setDragging(null); setOver(null); }}
                        onMove={(by) => move(flat, type.id, by)}
                      />
                    )}
                    {/*
                      * No number on an archived row. It is out of the sequence the agent sees,
                      * and numbering it would put back the gap this is here to remove — the
                      * empty circle keeps the rows aligned with each other.
                      */}
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        liveNumber.has(type.id)
                          ? 'border-2 border-navy text-navy'
                          : 'border border-dashed border-hairline text-transparent',
                      )}
                      aria-hidden
                    >
                      {liveNumber.get(type.id) ?? '–'}
                    </span>

                    <div className="min-w-0 flex-1">
                      {editing === type.id ? (
                        <div className="flex flex-col gap-2">
                          {/* The code, shown and not editable. `readOnly` rather than
                              `disabled`: the old argument — that disabled reads as "not
                              right now", and this is never — still holds, and read-only
                              answers it without leaving the tab order or refusing to be
                              copied, which is half of why it is on screen. */}
                          <CodeField
                            id={`code-type-code-${type.code}`}
                            value={type.code}
                            reason={t.codeReason}
                          />
                          <FieldRow>
                            <Field label={s.label} htmlFor={`label-${type.id}`} className="min-w-60 flex-1">
                              <TextInput
                                id={`label-${type.id}`}
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                              />
                            </Field>
                            <Field
                              label={s.description}
                              htmlFor={`description-${type.id}`}
                              hint={t.descriptionHint}
                              className="min-w-60 flex-1"
                            >
                              <TextInput
                                id={`description-${type.id}`}
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                              />
                            </Field>
                          </FieldRow>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              disabled={!editLabel.trim() || busy !== null}
                              onClick={() => {
                                stage({
                                  op: 'type.update',
                                  id: type.id,
                                  expectedVersion: type.version,
                                  body: { label: editLabel, description: editDescription },
                                });
                                setEditing(null);
                              }}
                            >
                              {s.save}
                            </Button>
                            <Button variant="secondary" onClick={() => setEditing(null)}>{s.cancel}</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-md text-navy">
                            {type.label}
                            {/* The stage it counts as, said as one, and set apart from the name (P18.97-T4 AC-1). */}
                            {bound.has(type.code) && (
                              <ConfigBadge
                                tone="navy"
                                className="ml-2 align-middle normal-case tracking-normal"
                              >
                                <span title={t.countsAsTip({ stage: BINDING_ROLE_LABEL[bound.get(type.code)!] })}>
                                  {t.countsAs({ stage: BINDING_ROLE_LABEL[bound.get(type.code)!] })}
                                </span>
                              </ConfigBadge>
                            )}
                          </p>
                          {type.description && (
                            <p className="text-sm text-muted">{type.description}</p>
                          )}
                          {type.status === 'archived' && (
                            <p className="mt-0.5 text-sm text-muted">{s.archivedLine}</p>
                          )}
                          {typeMark && (
                            <p className="mt-1 text-sm">
                              <span className="rounded-full bg-amber/20 px-2 py-0.5 text-navy">
                                {s.staged.mark[typeMark]}
                              </span>
                              <button
                                type="button"
                                className="ml-2 font-semibold text-navy underline"
                                onClick={() => setStaged((now) => unstageRow(now, 'type', type.id))}
                              >
                                {s.undo}
                              </button>
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {canWrite && editing !== type.id && (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          variant="inline"
                          onClick={() => {
                            setEditing(type.id);
                            setEditLabel(type.label);
                            setEditDescription(type.description ?? '');
                          }}
                        >
                          {s.edit}
                        </Button>
                        {type.status === 'active' ? (
                          <Button
                            variant="inlineDanger"
                            disabled={busy !== null}
                            onClick={() => stage({
                              op: 'type.archive', id: type.id, expectedVersion: type.version,
                            })}
                          >
                            {s.archive}
                          </Button>
                        ) : (
                          <Button
                            variant="inline"
                            disabled={busy !== null}
                            onClick={() => stage({
                              op: 'type.restore', id: type.id, expectedVersion: type.version,
                            })}
                          >
                            {s.restore}
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {canWrite && (adding === category.code ? (
                <FieldRow className="mt-3 border-t border-hairline pt-3">
                  <Field
                    label={s.code}
                    htmlFor={`code-${category.id}`}
                    hint={t.typeCodeHint}
                    className="min-w-48"
                  >
                    <TextInput
                      id={`code-${category.id}`}
                      value={draft.code}
                      onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                      placeholder={TYPE_CODE_EXAMPLE}
                    />
                  </Field>
                  <Field label={s.label} htmlFor={`new-label-${category.id}`} className="min-w-60 flex-1">
                    <TextInput
                      id={`new-label-${category.id}`}
                      value={draft.label}
                      onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    />
                  </Field>
                  {/* `draft.description` was sent from the first day and no input was ever
                      bound to it, so it was always the empty string. */}
                  <Field
                    label={s.description}
                    htmlFor={`new-description-${category.id}`}
                    hint={t.descriptionHint}
                    className="min-w-60 flex-1"
                  >
                    <TextInput
                      id={`new-description-${category.id}`}
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      placeholder={DESCRIPTION_EXAMPLE}
                    />
                  </Field>
                  <FieldRow.Actions>
                    <Button
                      disabled={!draft.code.trim() || !draft.label.trim() || busy !== null}
                      onClick={() => {
                        stage({
                          op: 'type.create',
                          body: {
                            code: draft.code,
                            categoryCode: category.code,
                            label: draft.label,
                            description: draft.description || undefined,
                          },
                        });
                        setAdding(null);
                        setDraft({ code: '', label: '', description: '' });
                      }}
                    >
                      {s.add}
                    </Button>
                    <Button variant="secondary" onClick={() => setAdding(null)}>{s.cancel}</Button>
                  </FieldRow.Actions>
                </FieldRow>
              ) : (
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => { setAdding(category.code); setDraft({ code: '', label: '', description: '' }); }}
                >
                  {t.addTo({ name: category.label })}
                </Button>
              ))}
            </Card>
          ))}
        </div>
      )}

      {/* The tiles a section can join: the office's groups as they will be, staged edits included. */}
      {canWrite && (
        <datalist id="summary-tile-names">
          {summaryGroups(shown).map((group) => (
            <option key={group.code} value={group.label} />
          ))}
        </datalist>
      )}
    </SettingsScreen>
  );
}
