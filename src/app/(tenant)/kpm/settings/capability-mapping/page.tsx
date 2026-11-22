'use client';

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { PublishBar } from '@/components/publish-bar';
import { SettingsScreen } from '@/components/settings-screen';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfigBadge } from '@/components/ui/config-badge';
import { DragHandle } from '@/components/ui/drag-handle';
import { Button, Field, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { SkeletonCards } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { kept } from '@/i18n/kept';
import { useMessages } from '@/i18n/language-provider';
import { settingsMessages } from '@/i18n/messages/settings';
import { capabilityMessages } from '@/i18n/messages/settings-capability';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  addCapability, moved, ownMilestoneCodes, reorderCapabilityList, reorderWithin, type CapabilityAdd,
} from '@/lib/capability-mapping';
import { useCan } from '@/lib/session';
import {
  readCapabilityCatalog, renameCapability, setCapabilityStatus,
  type CapabilityCatalog, type CapabilityEntry,
} from '@/lib/tenant-config';
import { ARCHIVED_SWITCH_ROW, HANDLE_TOUCH } from '../settings-touch';

/** The screen's title, its nav item (§A.1): the same in both languages. */
const TITLE = kept('Capability Mapping');

type Part = 'stage' | 'milestone' | 'grid' | 'item';
type Adding =
  | { kind: 'milestone'; stageCode: string }
  | { kind: 'stage' }
  | { kind: 'item'; gridCode: string }
  | { kind: 'grid' };

/** A row's identity on the page: its part, its grid where it has one, its code. */
const keyOf = (part: Part, code: string, gridCode?: string) => `${part}:${gridCode ?? ''}:${code}`;
const sameAdding = (a: Adding | null, b: Adding) => JSON.stringify(a) === JSON.stringify(b);

/**
 * **Pengaturan › Capability Mapping as two cards** (P19.21-T3 AC-4, ADR-0274; `data-upload-pengaturan-*` frame 18) —
 * what leaders tick by hand in each agent's profile, **no automatic rule**:
 *
 * - **Ladder** — *"Tahap = tahap tertinggi yang semua milestone-nya dicentang leader"*; the *tahap* numbered, each with
 *   **its own** milestones as the boxes a leader ticks (the ladder is cumulative, so a stage shows only what it adds,
 *   `ownMilestoneCodes`); *+ Tambah milestone* under each, *+ Tambah tahap* at the foot — a new stage with its first
 *   milestone, so it is never one everybody is on.
 * - **Skill tracker** — *"Dicentang leader di profil agent · n kelompok"*; each *kelompok* with *"n skill"*, tap to
 *   open its skills; *+ Tambah skill*, *+ Tambah kelompok*.
 *
 * The pencil renames — **the code never moves**, and it is shown while renaming —, the handle reorders (drag, or the
 * arrow keys on it) without touching a stage's seniority, and ⋯ archives or restores: a milestone under a stage is
 * taken out of every stage that requires it and put back when restored. *Tampilkan yang diarsipkan* is kept from the
 * screen before (the owner's rule that fidelity work never strips a requested feature). Side by side from 1024px,
 * stacked below it.
 *
 * **A draft, published on its own** (P19.21-T2): agents' and leaders' screens read the published catalog, so the bar
 * says when they are on an older version, with *Terbitkan ke agent* (`PublishBar`, `capability_mapping`).
 */
export default function CapabilityMappingPage() {
  const t = useMessages(capabilityMessages);
  const s = useMessages(settingsMessages);
  const canWrite = useCan('tenant_config:write');
  const ladderId = useId();
  const skillsId = useId();
  const [catalog, setCatalog] = useState<CapabilityCatalog | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<{ key: string; label: string } | null>(null);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [draft, setDraft] = useState({ label: '', first: '' });
  const [openGroups, setOpenGroups] = useState<Set<string> | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [publishKey, setPublishKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setCatalog(await readCapabilityCatalog());
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<CapabilityCatalog>) => {
    setBusy(true);
    setError(null);
    try {
      setCatalog(await action());
      // Every write leaves a draft agents are not on yet: the bar reads the state again.
      setPublishKey((k) => k + 1);
      return true;
    } catch (err) {
      setError(toDisplayError(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (catalog === null) {
    return (
      <SettingsScreen title={TITLE} permission="tenant_config:read" error={error} bars={<PublishBar />}>
        {error ? null : <SkeletonCards count={2} />}
      </SettingsScreen>
    );
  }

  const shown = <T extends CapabilityEntry>(rows: T[]) => rows.filter((r) => showArchived || r.status === 'active');
  const milestoneOrder = catalog.milestones.map((m) => m.code);
  const milestoneOf = new Map(catalog.milestones.map((m) => [m.code, m]));
  const stages = shown(catalog.stages);
  const attached = new Set(catalog.stages.flatMap((st) => st.requiredMilestoneCodes));
  const loose = shown(catalog.milestones.filter((m) => !attached.has(m.code)));
  // The first kelompok opens by default, as the mockup draws it; then the reader decides.
  const opened = openGroups ?? new Set(catalog.grids.slice(0, 1).map((g) => g.code));
  const toggleGroup = (code: string) => {
    const next = new Set(opened);
    if (next.has(code)) next.delete(code); else next.add(code);
    setOpenGroups(next);
  };

  const startAdding = (next: Adding) => { setDraft({ label: '', first: '' }); setAdding(next); };
  const submitAdd = async (body: CapabilityAdd) => {
    if (await run(() => addCapability(body))) setAdding(null);
  };

  /** The pencil beside a name, or the name being renamed with its code under it. */
  const nameOf = (entry: CapabilityEntry, part: Part, gridCode?: string, strong = false) => {
    const key = keyOf(part, entry.code, gridCode);
    if (editing?.key === key) {
      return (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editing.label.trim()) return;
            void run(async () => {
              const next = await renameCapability({ part, code: entry.code, label: editing.label.trim(), gridCode });
              setEditing(null);
              return next;
            });
          }}
        >
          <Field label={s.name} htmlFor={`rename-${key}`} hint={t.codeHint({ code: entry.code })} className="min-w-40 flex-1">
            <TextInput
              id={`rename-${key}`}
              value={editing.label}
              disabled={busy}
              autoFocus
              onChange={(e) => setEditing({ key, label: e.target.value })}
            />
          </Field>
          <Button type="submit" disabled={busy || !editing.label.trim()}>{s.save}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setEditing(null)}>{s.cancel}</Button>
        </form>
      );
    }
    return (
      <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
        <span className={cn('text-navy', strong ? 'text-md font-bold' : 'text-md')}>{entry.label}</span>
        {canWrite && (
          <button
            type="button"
            aria-label={t.renameName({ label: entry.label })}
            disabled={busy}
            onClick={() => setEditing({ key, label: entry.label })}
            // 44 × 44px below 1024px (UI-142), the 24px glyph centred in it; 24px from 1024px, as frame 18 draws it.
            className="inline-flex h-6 w-6 items-center justify-center rounded text-signal-grey hover:text-navy max-lg:h-11 max-lg:w-11"
          >
            <LineIcon name="pencil" className="h-3.5 w-3.5" />
          </button>
        )}
        {entry.status === 'archived' && <ConfigBadge tone="open">{s.archivedBadge}</ConfigBadge>}
      </span>
    );
  };

  /** ⋯: archive, or restore an archived one. Archiving a milestone takes it out of its stages (ADR-0274). */
  const menuOf = (entry: CapabilityEntry, part: Part, gridCode?: string) => (canWrite ? (
    <ActionMenu
      label={t.moreFor({ label: entry.label })}
      glyph="⋯"
      triggerClassName="max-lg:h-11 max-lg:w-11"
      items={[{
        label: entry.status === 'archived' ? s.restore : s.archive,
        tone: entry.status === 'archived' ? 'neutral' : 'alert',
        hint: entry.status === 'archived' ? undefined : part === 'milestone' ? t.archiveMilestoneTip : t.archiveTip,
        onSelect: () => void run(() => setCapabilityStatus({
          part, code: entry.code, status: entry.status === 'archived' ? 'active' : 'archived', gridCode,
        })),
      }]}
    />
  ) : null);

  /** A row with its handle: drag it over another of the same list, or press ↑ ↓ on the handle. */
  const handleOf = (label: string, key: string, move: (by: -1 | 1) => void) => (canWrite ? (
    <DragHandle
      label={label}
      disabled={busy}
      className={cn(HANDLE_TOUCH, 'text-signal-grey')}
      onPick={() => setDragging(key)}
      onDrop={() => setDragging(null)}
      onMove={move}
    />
  ) : null);
  const dropOn = (list: string, at: number, apply: (from: number, to: number) => void) => ({
    onDragOver: (e: React.DragEvent) => { if (dragging?.startsWith(`${list}#`)) e.preventDefault(); },
    onDrop: (e: React.DragEvent) => {
      if (!dragging?.startsWith(`${list}#`)) return;
      e.preventDefault();
      const from = Number(dragging.slice(list.length + 1));
      setDragging(null);
      if (from !== at) apply(from, at);
    },
  });

  /** A box a leader ticks in the profile: drawn, never ticked here. */
  const box = <span aria-hidden="true" className="h-[18px] w-[18px] shrink-0 rounded-sm border-[1.5px] border-hairline bg-card" />;
  const rail = <span aria-hidden="true" className="ml-3 h-6 w-px shrink-0 self-stretch bg-hairline" />;
  const addLink = (label: string, onClick: () => void, indent = false) => (canWrite ? (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={cn(
        'flex min-h-11 w-full items-center gap-2 px-4 text-left text-base font-bold text-primary-ink hover:bg-hover-row lg:min-h-10',
        indent && 'pl-8',
      )}
    >
      <LineIcon name="plus" className="h-4 w-4" />
      {label}
    </button>
  ) : null);
  const addForm = (fields: ReactNode, submit: () => void, ready: boolean) => (
    <form
      className="flex flex-wrap items-end gap-2 border-t border-divider px-4 py-3"
      onSubmit={(e) => { e.preventDefault(); if (ready) submit(); }}
    >
      {fields}
      <Button type="submit" disabled={busy || !ready}>{s.add}</Button>
      <Button variant="secondary" disabled={busy} onClick={() => setAdding(null)}>{s.cancel}</Button>
    </form>
  );
  const nameField = (id: string, label: string, value: string, set: (v: string) => void) => (
    <Field label={label} htmlFor={id} className="min-w-40 flex-1">
      <TextInput id={id} value={value} disabled={busy} autoFocus={label !== t.firstMilestone} onChange={(e) => set(e.target.value)} />
    </Field>
  );

  const milestoneRows = (codes: string[], stageCode: string | null) => codes.map((code, index) => {
    const m = milestoneOf.get(code);
    if (!m || (!showArchived && m.status !== 'active')) return null;
    const list = `milestones:${stageCode ?? ''}`;
    const reorder = (from: number, to: number) => void run(() => reorderCapabilityList({
      part: 'milestone', codes: reorderWithin(milestoneOrder, codes, from, to),
    }));
    return (
      <li key={code} data-milestone={code} className="flex min-h-11 items-center gap-2 border-t border-divider py-1.5 pr-2" {...dropOn(list, index, reorder)}>
        {rail}
        {handleOf(m.label, `${list}#${index}`, (by) => reorder(index, index + by))}
        {box}
        <span className="min-w-0 flex-1">{nameOf(m, 'milestone')}</span>
        {menuOf(m, 'milestone')}
      </li>
    );
  });

  const ladder = (
    <section aria-labelledby={ladderId} className="overflow-hidden rounded-lg bg-card" data-card="ladder">
      <div className="border-b border-divider px-4 py-3">
        <h2 id={ladderId} className="m-0 font-display text-lg font-bold text-navy">{t.ladder}</h2>
        <p className="m-0 text-sm text-muted">{t.ladderNote}</p>
      </div>
      {stages.length === 0 && <EmptyState title={t.noStages} />}
      <ol className="m-0 list-none p-0">
        {stages.map((stage, index) => {
          const own = ownMilestoneCodes(stage, catalog.stages, milestoneOrder);
          const reorder = (from: number, to: number) => void run(() => reorderCapabilityList({
            part: 'stage', codes: moved(catalog.stages.map((st) => st.code), from, to),
          }));
          const here: Adding = { kind: 'milestone', stageCode: stage.code };
          return (
            <li key={stage.code} data-stage={stage.code} className="border-t border-divider first:border-t-0">
              <div className="flex min-h-11 items-center gap-2 px-2 py-2" {...dropOn('stages', index, reorder)}>
                {handleOf(stage.label, `stages#${index}`, (by) => reorder(index, index + by))}
                <span
                  aria-label={t.stageNumber({ n: index + 1 })}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-hairline text-sm font-bold text-navy"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">{nameOf(stage, 'stage', undefined, true)}</span>
                {menuOf(stage, 'stage')}
              </div>
              <ul className="m-0 list-none p-0">{milestoneRows(own, stage.code)}</ul>
              {sameAdding(adding, here)
                ? addForm(
                  nameField(`add-milestone-${stage.code}`, s.name, draft.label, (label) => setDraft((d) => ({ ...d, label }))),
                  () => void submitAdd({ part: 'milestone', label: draft.label.trim(), stageCode: stage.code }),
                  draft.label.trim() !== '',
                )
                : addLink(t.addMilestone, () => startAdding(here), true)}
            </li>
          );
        })}
      </ol>
      {loose.length > 0 && (
        <div className="border-t border-divider" data-loose-milestones="">
          <p className="m-0 px-4 pt-3 text-sm font-semibold text-muted">{t.unattached}</p>
          <ul className="m-0 list-none p-0">{milestoneRows(loose.map((m) => m.code), null)}</ul>
        </div>
      )}
      <div className="border-t border-divider">
        {sameAdding(adding, { kind: 'stage' })
          ? addForm(
            <>
              {nameField('add-stage', t.stageName, draft.label, (label) => setDraft((d) => ({ ...d, label })))}
              {nameField('add-stage-first', t.firstMilestone, draft.first, (first) => setDraft((d) => ({ ...d, first })))}
            </>,
            () => void submitAdd({ part: 'stage', label: draft.label.trim(), firstMilestone: draft.first.trim() }),
            draft.label.trim() !== '' && draft.first.trim() !== '',
          )
          : addLink(t.addStage, () => startAdding({ kind: 'stage' }))}
      </div>
    </section>
  );

  const grids = shown(catalog.grids);
  const tracker = (
    <section aria-labelledby={skillsId} className="overflow-hidden rounded-lg bg-card" data-card="skills">
      <div className="border-b border-divider px-4 py-3">
        <h2 id={skillsId} className="m-0 font-display text-lg font-bold text-navy">{t.skillTracker}</h2>
        <p className="m-0 text-sm text-muted">{t.skillTrackerNote({ n: catalog.grids.filter((g) => g.status === 'active').length })}</p>
      </div>
      {grids.length === 0 && <EmptyState title={t.noGrids} />}
      <ul className="m-0 list-none p-0">
        {grids.map((grid, index) => {
          const isOpen = opened.has(grid.code);
          const items = shown(grid.items);
          const reorderGrids = (from: number, to: number) => void run(() => reorderCapabilityList({
            part: 'grid', codes: moved(catalog.grids.map((g) => g.code), from, to),
          }));
          const here: Adding = { kind: 'item', gridCode: grid.code };
          return (
            <li key={grid.code} data-grid={grid.code} className="border-t border-divider first:border-t-0">
              <div className="flex min-h-11 items-center gap-2 px-2 py-2" {...dropOn('grids', index, reorderGrids)}>
                {handleOf(grid.label, `grids#${index}`, (by) => reorderGrids(index, index + by))}
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={t.openGroup({ label: grid.label })}
                  onClick={() => toggleGroup(grid.code)}
                  className="flex h-11 w-8 shrink-0 items-center justify-center text-primary-ink lg:h-8"
                >
                  <LineIcon name={isOpen ? 'chevronDown' : 'chevronRight'} className="h-4 w-4" />
                </button>
                <span className="min-w-0 flex-1">
                  {nameOf(grid, 'grid', undefined, true)}
                  <span className="block text-sm text-muted">
                    {t.skills({ n: grid.items.filter((i) => i.status === 'active').length })}
                    {grid.requiresDownline && <> · {t.downlineOnly}</>}
                  </span>
                </span>
                {menuOf(grid, 'grid')}
              </div>
              {isOpen && (
                <>
                  <ul className="m-0 list-none p-0">
                    {items.map((item) => {
                      const reorder = (from: number, to: number) => void run(() => reorderCapabilityList({
                        part: 'item', gridCode: grid.code, codes: moved(grid.items.map((i) => i.code), from, to),
                      }));
                      // The handle moves among every skill of the group, shown or archived, so the order sent is whole.
                      const whole = grid.items.findIndex((i) => i.code === item.code);
                      return (
                        <li key={item.code} data-skill={item.code} className="flex min-h-11 items-center gap-2 border-t border-divider py-1.5 pr-2" {...dropOn(`items:${grid.code}`, whole, reorder)}>
                          {rail}
                          {handleOf(item.label, `items:${grid.code}#${whole}`, (by) => reorder(whole, whole + by))}
                          {box}
                          <span className="min-w-0 flex-1">{nameOf(item, 'item', grid.code)}</span>
                          {menuOf(item, 'item', grid.code)}
                        </li>
                      );
                    })}
                  </ul>
                  {sameAdding(adding, here)
                    ? addForm(
                      nameField(`add-skill-${grid.code}`, s.name, draft.label, (label) => setDraft((d) => ({ ...d, label }))),
                      () => void submitAdd({ part: 'item', label: draft.label.trim(), gridCode: grid.code }),
                      draft.label.trim() !== '',
                    )
                    : addLink(t.addSkill, () => startAdding(here), true)}
                </>
              )}
            </li>
          );
        })}
      </ul>
      <div className="border-t border-divider">
        {sameAdding(adding, { kind: 'grid' })
          ? addForm(
            nameField('add-group', s.name, draft.label, (label) => setDraft((d) => ({ ...d, label }))),
            () => void submitAdd({ part: 'grid', label: draft.label.trim() }),
            draft.label.trim() !== '',
          )
          : addLink(t.addGroup, () => startAdding({ kind: 'grid' }))}
      </div>
    </section>
  );

  return (
    <SettingsScreen
      title={TITLE}
      permission="tenant_config:read"
      error={null}
      bars={<PublishBar refreshKey={publishKey} />}
    >
      <div className="flex flex-col gap-3">
        {error && (
          <div role="alert" className="rounded-md border border-primary bg-card p-4">
            <p className="text-md text-navy">{error.message}</p>
          </div>
        )}
        <div className="grid items-start gap-3 lg:grid-cols-[1fr_1.25fr]">
          {ladder}
          {tracker}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-muted">
          <span>{t.footTicks}</span>
          <span className="inline-flex items-center gap-1">
            <LineIcon name="pencil" className="h-3.5 w-3.5" />
            {t.footHow}
          </span>
          <label className={cn('inline-flex items-center gap-2', ARCHIVED_SWITCH_ROW)}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            {s.showArchived}
          </label>
        </div>
      </div>
    </SettingsScreen>
  );
}
