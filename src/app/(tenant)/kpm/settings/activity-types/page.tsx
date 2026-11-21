'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SettingsScreen, TenantConfigBars } from '@/components/settings-screen';
import { SettingsReviewed } from '@/components/settings-reviewed';
import { ActivityBindingSheet } from '@/components/activity-binding-sheet';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { ConfigBadge } from '@/components/ui/config-badge';
import { DragHandle } from '@/components/ui/drag-handle';
import { LineIcon } from '@/components/ui/line-icon';
import { ReorderArrows } from '@/components/ui/reorder-arrows';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { TonePill } from '@/components/ui/tone-pill';
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
import { ACTIVITY_SHORT_LABEL_MAX } from '@/lib/activity-text';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { usePhone } from '@/lib/use-phone';
import { ARCHIVED_SWITCH_ROW, CHECK_LINE_TOUCH, HANDLE_TOUCH, TEXT_BUTTON_TOUCH } from '../settings-touch';
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

/*
 * **The chip on a bound type: the stage it counts as** (P18.9-T4 AC-1, ADR-0176 §3; the client's UI-022). It is no name
 * of the type but the cascade stage the office's activity binding counts it as (ADR-0163 §3) — the owner's explicit
 * request of 2026-10-26 — so it stays on the row, beside the name, in the 19 November card too.
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

/** The orange *+ …* line at a card's foot (mockup f13's `color:var(--or)`), 44px tall below 1024px. */
const ADD_LINE = cn(
  'inline-flex items-center gap-1.5 text-md font-bold text-primary-ink hover:underline disabled:opacity-40',
  TEXT_BUTTON_TOUCH,
);

/**
 * What this office counts (P4-T1) — **drawn as the client's 19 November card** (P19.21-T3 AC-1; mockup
 * `data-upload-pengaturan-*` f13–f14, ADR-0274).
 *
 * - *Activity types | Ratio benchmarks* as the tabs, and *Pengaitan aktivitas* and *+ Tambah kategori* as the toolbar's
 *   two buttons. The frame — *‹ Pengaturan*, the title, the per-setting orange bar — is `SettingsScreen`'s.
 * - **A white card per category, side by side** (three from 1024px, two from 768px, one on a phone): ⠿, the name,
 *   *"n aktivitas · untuk <siapa>"* and a ⋯ with *Ganti nama · Ubah untuk siapa · Arsipkan*. Its activities numbered
 *   under it, each with ⠿ and its own ⋯; *+ Tambah aktivitas* at the card's foot.
 * - **The legend under the cards**: *"Seret ⠿ untuk mengubah urutan · ⋯ = ganti nama, untuk siapa, arsipkan ·
 *   Tampilkan yang diarsipkan"*, the last one the archived rows' switch.
 *
 * **Earlier features stay, inside that footprint** (the owner's rule): staging behind *Simpan perubahan*, the archived
 * view, a section's description and summary tile (in *Ganti nama*'s editor), a type's code, *Nama singkat* and
 * description (in its ⋯'s *Ganti nama* sheet), ↑ ↓ on a phone, the bound chip, the activity binding.
 *
 * **The numbers are position only** (invariant §4): reordering renumbers and rebinds nothing. Since P19.21 they count
 * the live rows of each card, as the 19 November card draws them. **Archiving is what deleting means** (invariant §3).
 */
export default function ActivityTypesPage() {
  const t = useMessages(activityTypesMessages);
  const s = useMessages(settingsMessages);
  const language = useLanguage();
  const canWrite = useCan('tenant_config:write');
  /** On a phone a drag never starts: ↑ ↓ beside a card's ⠿, and in a type's sheet (P19.2-T3 AC-3). */
  const phone = usePhone();
  /** The type whose sheet is open — its ⋯'s *Ganti nama*, at every width since P19.21. */
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  /*
   * **Which types the office's activity binding names** (ADR-0163 §3, P18.6-T2 AC-3): a bound type wears its role beside
   * its name, and is the one an archive refuses. A failed read leaves the names unmarked.
   */
  const canReadBinding = useCan('activity_binding:read');
  const [bound, setBound] = useState<Map<string, BindingRole>>(new Map());
  const [categories, setCategories] = useState<ActivityCategoryRow[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  // Bumped after any write, so the publish bar re-reads rather than going stale behind an edit the Owner just made.
  const [published, setPublished] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState({ code: '', label: '', shortLabel: '', description: '' });
  const [editLabel, setEditLabel] = useState('');
  /** ***Nama singkat*** (P19.8-T4 AC-5, ADR-0229 §5): one field beside the name wherever the name is edited. */
  const [editShortLabel, setEditShortLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  // Section-level controls (P4-T18). The ladder is the company's (ADR-0012): this reads it.
  const { ladder } = useTenantConfig();
  const [scoping, setScoping] = useState<string | null>(null);
  const [rungs, setRungs] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  /*
   * **Where the focus goes when a category's editor opens and closes** (WCAG 2.4.3; parity F-255). *Ganti nama* and
   * *Ubah untuk siapa* open an editor under the card's head, chosen from its ⋯ — so opening moves the focus to the
   * editor's first control, and closing gives it back to the ⋯.
   */
  const cards = useRef(new Map<string, HTMLElement>());
  const editors = useRef<{ renaming: string | null; scoping: string | null }>({ renaming: null, scoping: null });
  /** `tile` is the section's summary tile (ADR-0064): one field in its rename, never a card of its own. */
  const [sectionDraft, setSectionDraft] = useState({ label: '', description: '', tile: '' });
  /** Why the typed tile name was refused, shown at the field — or null. */
  const [tileError, setTileError] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [section, setSection] = useState({ code: '', label: '', description: '' });
  // Native HTML5 drag, the way the frozen prototype does it. No library: two vertical lists.
  const [dragging, setDragging] = useState<{ kind: 'type' | 'section'; id: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /*
   * Staged edits (P4-T19). Reordering is the one thing that still writes immediately: it bumps no version and reaches
   * nobody until publish, so holding it behind Save would mean a drag that visibly did nothing.
   */
  const [staged, setStaged] = useState<ConfigChange[]>([]);

  /*
   * **Always read the archived rows, and filter for display.** Reordering names the whole list, and the server counts
   * every type the office has — archived included. Fetching once also makes the archived switch free.
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
    const focusIn = (id: string, into: 'editor' | 'menu') => {
      const card = cards.current.get(id);
      if (!card) return;
      const target = into === 'editor'
        ? card.querySelector<HTMLElement>('[data-editor] input, [data-editor] select, [data-editor] textarea')
        : card.querySelector<HTMLElement>('[data-section-head] button[aria-haspopup="menu"]');
      target?.focus();
    };
    // Closed first, then opened: moving straight from one section's editor to another's ends in the new one.
    if (was.renaming && was.renaming !== renaming) focusIn(was.renaming, 'menu');
    if (was.scoping && was.scoping !== scoping) focusIn(was.scoping, 'menu');
    if (renaming && renaming !== was.renaming) focusIn(renaming, 'editor');
    if (scoping && scoping !== was.scoping) focusIn(scoping, 'editor');
  }, [renaming, scoping]);

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
   * Move one row, and send the whole list — stepping over anything the reader cannot see, because swapping with a
   * hidden neighbour reads on screen as a button that did nothing.
   */
  function move(all: ActivityTypeRow[], id: string, by: -1 | 1) {
    const order = all.map((row) => row.id);
    const at = order.indexOf(id);
    const visible = new Set(all.filter((row) => showArchived || row.status === 'active').map((row) => row.id));
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

  /** Drop `dragging` where `targetId` sits, and send the whole list. The ⠿'s ↑ ↓ keys are the keyboard path. */
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

    const order = flat.map((row) => row.id);
    const from = order.indexOf(held.id);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(to, 0, ...order.splice(from, 1));
    void run(`drag:${held.id}`, () => reorderActivityTypes(order));
  }

  /** Who a section is for, in words. Empty reads as *Semua orang* — a blank looks like a setting that failed to load. */
  const appliesTo = (codes: string[]) =>
    (codes.length === 0
      ? s.everyone
      : codes.map((c) => ladder.find((l) => l.code === c)?.label ?? c).join(' · '));

  /*
   * What the reader sees: a subset of what a reorder sends, and the rows as they *will* be rather than as the office
   * still has them (P4-T19, `lib/staged-projection.ts`).
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
      // A new type belongs to the one section it named.
      staged.filter((c) => c.op !== 'type.create' || c.body?.categoryCode === category.code),
      {
        entity: 'type',
        create: (body, id) => ({
          id,
          code: String(body.code ?? ''),
          categoryCode: category.code,
          label: String(body.label ?? ''),
          shortLabel: body.shortLabel ? String(body.shortLabel) : null,
          description: body.description ? String(body.description) : null,
          appliesToOrgLevelCodes: [],
          displayOrder: category.types.length + 1,
          version: 0,
          status: 'active' as const,
        }),
      },
    // A row held for archive stays on screen even when archived rows are hidden: it has not happened yet.
    ).filter(({ row, staged: mark }) => showArchived || row.status === 'active' || mark),
  }));

  type Section = (typeof shown)[number];
  type ShownType = Section['types'][number];

  const startRename = (category: Section) => {
    setScoping(null);
    setTileError(null);
    setRenaming(category.id);
    setSectionDraft({
      label: category.label,
      description: category.description ?? '',
      tile: summaryTileName(category),
    });
  };
  const startScoping = (category: Section) => {
    setRenaming(null);
    setScoping(category.id);
    setRungs(category.appliesToOrgLevelCodes);
  };
  /** A category's ⋯ (mockup f14): *Ganti nama · Ubah untuk siapa · Arsipkan* — or *Pulihkan* for an archived one. */
  const sectionMenu = (category: Section): ActionMenuItem[] => [
    { label: s.rename, onSelect: () => startRename(category) },
    { label: t.changeWho, onSelect: () => startScoping(category) },
    category.status === 'active'
      ? {
        label: s.archive,
        tone: 'alert',
        hint: t.archiveSectionHint,
        disabled: busy !== null,
        onSelect: () => stage({ op: 'category.archive', id: category.id, expectedVersion: category.version }),
      }
      : {
        label: s.restore,
        disabled: busy !== null,
        onSelect: () => stage({ op: 'category.restore', id: category.id, expectedVersion: category.version }),
      },
  ];

  const openType = (type: ActivityTypeRow) => {
    setSheetFor(type.id);
    setEditLabel(type.label);
    setEditShortLabel(type.shortLabel ?? '');
    setEditDescription(type.description ?? '');
  };
  /** A type's ⋯: *Ganti nama* (its sheet: name, *Nama singkat*, description, its code read-only) and *Arsipkan*. */
  const typeMenu = (type: ActivityTypeRow): ActionMenuItem[] => [
    { label: s.rename, onSelect: () => openType(type) },
    type.status === 'active'
      ? {
        label: s.archive,
        tone: 'alert',
        disabled: busy !== null,
        onSelect: () => stage({ op: 'type.archive', id: type.id, expectedVersion: type.version }),
      }
      : {
        label: s.restore,
        disabled: busy !== null,
        onSelect: () => stage({ op: 'type.restore', id: type.id, expectedVersion: type.version }),
      },
  ];

  /** A staged mark and its *Urungkan*, on a row or a card's head. */
  const stagedMark = (mark: ShownType['staged'], entity: 'type' | 'category', id: string) => (mark ? (
    <span className="flex items-center gap-2">
      <TonePill tone="amber">{s.staged.mark[mark]}</TonePill>
      <button
        type="button"
        className={cn('text-sm font-semibold text-navy underline', TEXT_BUTTON_TOUCH)}
        onClick={() => setStaged((now) => unstageRow(now, entity, id))}
      >
        {s.undo}
      </button>
    </span>
  ) : null);

  /**
   * **A type's sheet** (its ⋯'s *Ganti nama*): its stage, its code read-only, its name, *Nama singkat* and description,
   * *Simpan* pinned; ↑ ↓ on a phone, where a drag never starts. Every edit is staged, as everything here is.
   */
  function typeSheet() {
    const found = sheetFor === null ? null
      : shown.flatMap((c) => c.types).find(({ row }) => row.id === sheetFor) ?? null;
    const type = found?.row ?? null;
    const close = () => setSheetFor(null);
    const siblings = type ? shown.find((c) => c.types.some(({ row }) => row.id === type.id))?.types ?? [] : [];
    const at = siblings.findIndex(({ row }) => row.id === type?.id);
    return (
      <ResponsiveSheet
        open={type !== null}
        title={type?.label ?? ''}
        onClose={close}
        footer={type && canWrite ? (
          <Button
            className="w-full"
            disabled={!editLabel.trim() || busy !== null}
            onClick={() => {
              stage({
                op: 'type.update',
                id: type.id,
                expectedVersion: type.version,
                body: { label: editLabel, shortLabel: editShortLabel.trim() || null, description: editDescription },
              });
              close();
            }}
          >
            {s.save}
          </Button>
        ) : undefined}
      >
        {type && (
          <div className="flex flex-col gap-3">
            {bound.has(type.code) && (
              <p>
                <ConfigBadge tone="navy" className="normal-case tracking-normal">
                  <span title={t.countsAsTip({ stage: BINDING_ROLE_LABEL[bound.get(type.code)!] })}>
                    {t.countsAs({ stage: BINDING_ROLE_LABEL[bound.get(type.code)!] })}
                  </span>
                </ConfigBadge>
              </p>
            )}
            {/* The code, shown and not editable: `readOnly`, so it stays in the tab order and can be copied. */}
            <CodeField id={`code-type-code-${type.code}`} value={type.code} reason={t.codeReason} />
            <Field label={s.label} htmlFor={`label-${type.id}`}>
              <TextInput id={`label-${type.id}`} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </Field>
            <ShortLabelField
              id={`short-label-${type.id}`}
              value={editShortLabel}
              onChange={setEditShortLabel}
              label={t.shortLabel}
              hint={t.shortLabelHint({ max: ACTIVITY_SHORT_LABEL_MAX })}
            />
            <Field label={s.description} htmlFor={`description-${type.id}`} hint={t.descriptionHint}>
              <TextInput
                id={`description-${type.id}`}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </Field>
            {phone && (
              <ReorderArrows
                label={type.label}
                index={at}
                count={siblings.length}
                disabled={busy !== null}
                onMove={(by) => move(flat, type.id, by)}
              />
            )}
          </div>
        )}
      </ResponsiveSheet>
    );
  }

  /** A section's editor under its head: its name, description and summary tile, or who it is for. */
  function sectionEditor(category: Section) {
    if (scoping === category.id) {
      return (
        <div data-editor="" className="flex flex-col gap-3 border-b border-divider px-4 py-3">
          <fieldset className="min-w-0">
            <legend className="text-sm font-semibold text-navy">{s.appliesTo}</legend>
            <ul className="mt-1 flex flex-wrap gap-3">
              {ladder.map((rung) => (
                <li key={rung.code}>
                  <label className={cn('flex items-center gap-1.5 text-md text-navy', CHECK_LINE_TOUCH)}>
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
          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>
      );
    }
    if (renaming !== category.id) return null;
    return (
      <div data-editor="" className="flex flex-col gap-3 border-b border-divider px-4 py-3">
        <FieldRow className="min-w-0">
          <Field label={s.name} htmlFor={`rename-${category.id}`} className="min-w-48 flex-1">
            <TextInput
              id={`rename-${category.id}`}
              value={sectionDraft.label}
              onChange={(e) => setSectionDraft((d) => ({ ...d, label: e.target.value }))}
            />
          </Field>
          <Field label={s.description} htmlFor={`redescribe-${category.id}`} hint={s.optional} className="min-w-48 flex-1">
            <TextInput
              id={`redescribe-${category.id}`}
              value={sectionDraft.description}
              onChange={(e) => setSectionDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </Field>
          {/* The summary tile: one field, in the edit that already exists (ADR-0064, ADR-0062 §2). */}
          <Field
            label={t.summaryTile}
            htmlFor={`tile-${category.id}`}
            hint={t.summaryTileHint}
            error={tileError ?? undefined}
            className="min-w-48 flex-1"
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
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy !== null || !sectionDraft.label.trim()}
            onClick={() => {
              // Against every section, archived included, and under the name being saved.
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
              // The other sections the name changes, staged beside it, so one save sends one consistent state.
              for (const change of plan.changes.filter((c) => c.code !== category.code)) {
                const other = shown.find((row) => row.code === change.code)!;
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
        </div>
      </div>
    );
  }

  return (
    <SettingsScreen
      title={kept('Activity types')}
      permission="tenant_config:read"
      // P19.3-T2 AC-5 (UI-149): *Sudah sesuai*, step 2 of the KPM setup card (Activity types and Ratio benchmarks).
      actions={<SettingsReviewed page="activity-types" />}
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
        actions: (
          <>
            {/* *Pengaitan aktivitas* (P19.4-T3; ADR-0206 §1): the office's own binding; the chips below follow a save. */}
            <ActivityBindingSheet onSaved={(binding) => setBound(rolesByCode(binding))} />
            {canWrite && categories !== null && (
              <Button variant="secondary" disabled={addingSection} onClick={() => setAddingSection(true)}>
                <LineIcon name="plus" className="h-4 w-4" />
                {t.addCategory}
              </Button>
            )}
          </>
        ),
      }}
    >
      {canWrite && addingSection && (
        <Card className="mb-4">
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold text-navy">{t.addCategory}</h2>
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
              <Field label={s.description} htmlFor="new-section-description" hint={s.optional} className="min-w-60 flex-1">
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
                    body: { code: section.code, label: section.label, description: section.description || undefined },
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
        </Card>
      )}

      {categories === null ? (
        error ? null : <SkeletonCards count={3} />
      ) : categories.length === 0 && staged.length === 0 ? (
        <EmptyState title={t.none} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((category, sectionAt) => {
            let counted = 0;
            const live = category.types.filter(({ row }) => row.status === 'active').length;
            return (
              <section
                key={category.id}
                aria-labelledby={`category-${category.id}`}
                // `data-row` is what `DragHandle` looks for to set the drag image.
                data-row={category.id}
                ref={(el) => {
                  if (el) cards.current.set(category.id, el);
                  else cards.current.delete(category.id);
                }}
                className={cn(
                  'overflow-hidden rounded-lg border border-card-edge bg-card',
                  over === category.id && 'ring-2 ring-primary',
                  dragging?.kind === 'section' && dragging.id === category.id && 'opacity-40',
                )}
                onDragOver={(e) => {
                  if (!dragging || dragging.kind !== 'section') return;
                  e.preventDefault();
                  setOver(category.id);
                }}
                onDragLeave={() => setOver((now) => (now === category.id ? null : now))}
                onDrop={(e) => { e.preventDefault(); drop(category.id); }}
              >
                <div data-section-head="" className="flex items-start gap-2 border-b border-divider px-4 py-3">
                  {canWrite && (
                    <DragHandle
                      label={category.label}
                      disabled={busy !== null}
                      className={HANDLE_TOUCH}
                      onPick={() => setDragging({ kind: 'section', id: category.id })}
                      onDrop={() => { setDragging(null); setOver(null); }}
                      onMove={(by) => moveSection(category.id, by)}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 id={`category-${category.id}`} className="font-display text-md font-bold text-navy">
                      {category.label}
                    </h2>
                    <p className="text-sm text-muted">
                      {t.sectionMeta({ n: live, who: appliesTo(category.appliesToOrgLevelCodes) })}
                    </p>
                    {category.status === 'archived' && <p className="text-sm text-muted">{s.archivedLine}</p>}
                  </div>
                  {stagedMark(category.staged, 'category', category.id)}
                  {canWrite && phone && (
                    <ReorderArrows
                      label={category.label}
                      index={sectionAt}
                      count={shown.length}
                      disabled={busy !== null}
                      onMove={(by) => moveSection(category.id, by)}
                    />
                  )}
                  {canWrite && (
                    <ActionMenu glyph="⋯" label={s.actionsFor({ name: category.label })} items={sectionMenu(category)} />
                  )}
                </div>

                {sectionEditor(category)}

                <ol className="flex flex-col">
                  {category.types.map(({ row: type, staged: typeMark }) => {
                    const number = type.status === 'active' ? (counted += 1) : null;
                    return (
                      <li
                        key={type.id}
                        data-type={type.id}
                        className={cn(
                          'flex items-center gap-2.5 border-b border-divider px-4 py-2',
                          over === type.id && 'bg-base',
                          dragging?.id === type.id && 'opacity-40',
                        )}
                        onDragOver={(e) => {
                          if (!dragging || dragging.kind !== 'type') return;
                          e.preventDefault();
                          setOver(type.id);
                        }}
                        onDragLeave={() => setOver((now) => (now === type.id ? null : now))}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(type.id); }}
                      >
                        {canWrite && (
                          <DragHandle
                            label={type.label}
                            disabled={busy !== null}
                            className={HANDLE_TOUCH}
                            onPick={() => setDragging({ kind: 'type', id: type.id })}
                            onDrop={() => { setDragging(null); setOver(null); }}
                            onMove={(by) => move(flat, type.id, by)}
                          />
                        )}
                        {/* No number on an archived row: it is out of the sequence the agent sees (2026-09-24). */}
                        <span
                          data-number=""
                          aria-hidden
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            number === null ? 'border border-dashed border-hairline text-transparent' : 'bg-base text-navy',
                          )}
                        >
                          {number ?? '–'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-md text-navy">
                            {type.label}
                            {/* The stage it counts as, said as one, and set apart from the name (P18.9-T4 AC-1). */}
                            {bound.has(type.code) && (
                              <ConfigBadge tone="navy" className="ml-2 align-middle normal-case tracking-normal">
                                <span title={t.countsAsTip({ stage: BINDING_ROLE_LABEL[bound.get(type.code)!] })}>
                                  {t.countsAs({ stage: BINDING_ROLE_LABEL[bound.get(type.code)!] })}
                                </span>
                              </ConfigBadge>
                            )}
                          </p>
                          {type.status === 'archived' && <p className="text-sm text-muted">{s.archivedLine}</p>}
                        </div>
                        {stagedMark(typeMark, 'type', type.id)}
                        {canWrite && (
                          <ActionMenu glyph="⋯" label={s.actionsFor({ name: type.label })} items={typeMenu(type)} />
                        )}
                      </li>
                    );
                  })}
                </ol>

                {canWrite && (adding === category.code ? (
                  <FieldRow className="px-4 py-3">
                    <Field label={s.code} htmlFor={`code-${category.id}`} hint={t.typeCodeHint} className="min-w-40">
                      <TextInput
                        id={`code-${category.id}`}
                        value={draft.code}
                        onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                        placeholder={TYPE_CODE_EXAMPLE}
                      />
                    </Field>
                    <Field label={s.label} htmlFor={`new-label-${category.id}`} className="min-w-48 flex-1">
                      <TextInput
                        id={`new-label-${category.id}`}
                        value={draft.label}
                        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                      />
                    </Field>
                    <ShortLabelField
                      id={`new-short-label-${category.id}`}
                      value={draft.shortLabel}
                      onChange={(shortLabel) => setDraft({ ...draft, shortLabel })}
                      label={t.shortLabel}
                      hint={t.shortLabelHint({ max: ACTIVITY_SHORT_LABEL_MAX })}
                      className="min-w-40"
                    />
                    <Field
                      label={s.description}
                      htmlFor={`new-description-${category.id}`}
                      hint={t.descriptionHint}
                      className="min-w-48 flex-1"
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
                              ...(draft.shortLabel.trim() ? { shortLabel: draft.shortLabel.trim() } : {}),
                              description: draft.description || undefined,
                            },
                          });
                          setAdding(null);
                          setDraft({ code: '', label: '', shortLabel: '', description: '' });
                        }}
                      >
                        {s.add}
                      </Button>
                      <Button variant="secondary" onClick={() => setAdding(null)}>{s.cancel}</Button>
                    </FieldRow.Actions>
                  </FieldRow>
                ) : (
                  <div className="px-4 py-2.5">
                    <button
                      type="button"
                      aria-label={t.addTo({ name: category.label })}
                      className={ADD_LINE}
                      onClick={() => { setAdding(category.code); setDraft({ code: '', label: '', shortLabel: '', description: '' }); }}
                    >
                      <LineIcon name="plus" className="h-4 w-4" />
                      {t.addActivity}
                    </button>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {/* The legend under the cards (mockup f13): how to order, what ⋯ holds, and the archived rows' switch. */}
      {categories !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
          {canWrite && <span>{t.legendDrag({ handle: '⠿' })}</span>}
          {canWrite && <span>{t.legendMenu}</span>}
          <label className={cn('flex items-center gap-2 text-sm text-muted', ARCHIVED_SWITCH_ROW)}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            {s.showArchived}
          </label>
        </div>
      )}

      {typeSheet()}

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

/**
 * ***Nama singkat*** (P19.8-T4 AC-5, ADR-0229 §5; MOB UI-180): one field beside the name, held to the server's bound
 * (`ACTIVITY_SHORT_LABEL_MAX`, mirrored) so the limit is heard before a round trip; the hint says where the words show.
 */
function ShortLabelField({
  id, value, onChange, label, hint, className,
}: {
  id: string; value: string; onChange: (next: string) => void; label: string; hint: string; className?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} className={className}>
      <TextInput id={id} value={value} maxLength={ACTIVITY_SHORT_LABEL_MAX} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
