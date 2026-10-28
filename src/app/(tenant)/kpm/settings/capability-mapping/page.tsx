'use client';

import { useCallback, useEffect, useState } from 'react';
import { PublishBar } from '@/components/publish-bar';
import { SettingsScreen } from '@/components/settings-screen';
import { BelowDesktopTip } from '@/components/ui/below-desktop-tip';
import { ConfigBadge } from '@/components/ui/config-badge';
import { DragHandle } from '@/components/ui/drag-handle';
import {
  Button, Card, Field, FieldRow, TextInput,
} from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { SHOWN_FROM_DESKTOP } from '@/components/ui/tablet';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useHashTab } from '@/lib/use-hash-tab';
import { suggestCode } from '@/lib/config-code';
import { useCan } from '@/lib/session';
import {
  addCapabilityItem, readCapabilityCatalog, renameCapability, reorderCapability,
  setCapabilityStatus,
  type CapabilityCatalog, type CapabilityEntry,
} from '@/lib/tenant-config';

const move = <T,>(rows: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};

/**
 * The office's capability catalog (P5-T8, ADR-0025, ADR-0036).
 *
 * **You edit it here; leaders assess against it.** One catalog per office is what makes two
 * leaders' assessments comparable — a grid each leader could extend is a grid nobody can roll up.
 *
 * **Every item has a code, and renaming never moves one.** Two of the prototype's four grids have
 * no codes at all: a tick is bound to the label text, so correcting a typo would orphan every
 * assessment that used it. Each row's code is shown in its *Rename* dialog, under the name box, so that
 * rule is visible rather than merely true; the rows themselves carry the name alone.
 *
 * **Reordering is presentation.** A stage's seniority is its own number, so tidying the ladder
 * cannot move anybody's stage — which is exactly what the prototype's array index does.
 *
 * **Two halves, named as the Company template names them.** *Ladder* is what a stage **is**;
 * *Skills* is what somebody is assessed **against**. Six cards in one scroll put the ladder that
 * governs everything above four grids running to about twenty-seven items.
 *
 * **The screen is called Capability Mapping, the same as the Super Admin's tab.** It was
 * *Capability catalog* until an office read it as a second product catalog next to Products, then
 * *Skills & stages*; it is now the prototype's own words for this card (`Overall.html:4349`), on
 * both sides, so nobody has to learn that one screen is the other under a different name.
 */
const TABS = [
  { label: 'Ladder', href: '#ladder' },
  { label: 'Skills', href: '#skills' },
];

/**
 * **The ladder's grey sentence, in the client's words** (P18.97-T4 AC-6, ADR-0176 §6; the grey-text table of 2026-10-27,
 * UI-027 — 27 words on how a stage is decided, *ⓘ · ⓘ · Show*): shown from 1024px, behind an ⓘ beside *The ladder*
 * below it.
 */
const LADDER_NOTE = 'A person’s stage = highest stage with all milestones ticked.';

export default function CapabilityMappingPage() {
  const canWrite = useCan('tenant_config:write');
  const [tab, setTab] = useHashTab(TABS);
  const [catalog, setCatalog] = useState<CapabilityCatalog | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [entry, setEntry] = useState({ label: '', code: '', touched: false });

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
      <SettingsScreen
        title="Capability Mapping"
        permission="tenant_config:read"
        error={error}
        bars={<PublishBar />}
      >
        {error ? null : <SkeletonCards count={3} />}
      </SettingsScreen>
    );
  }

  const visible = <T extends CapabilityEntry>(rows: T[]) =>
    rows.filter((r) => showArchived || r.status === 'active');

  /** One row: its label, its code, and the controls that never touch the code. */
  const row = (
    item: CapabilityEntry,
    part: 'stage' | 'milestone' | 'grid' | 'item',
    gridCode?: string,
    onMove?: (by: -1 | 1) => void,
    extra?: React.ReactNode,
  ) => {
    const key = `${part}:${gridCode ?? ''}:${item.code}`;
    const open = editing === key;
    return (
      <li key={key} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        {onMove && canWrite && (
          <DragHandle
            label={item.label}
            disabled={busy}
            onPick={() => undefined}
            onDrop={() => undefined}
            onMove={onMove}
          />
        )}
        <div className="min-w-0 flex-1">
          {open ? (
            <Field
              label="Name"
              htmlFor={`label-${key}`}
              /* The code, where a reader is acting on the row — so it is visible exactly when it
                 matters, that renaming is not touching the identity a tick binds to. It used to
                 be under every row of every list, which is the noise the client asked us to
                 take out. */
              hint={`Code ${item.code} — a tick names this, and renaming never moves it.`}
            >
              <TextInput
                id={`label-${key}`}
                value={label}
                disabled={busy}
                onChange={(e) => setLabel(e.target.value)}
              />
            </Field>
          ) : (
            <p className="text-md text-navy">{item.label}</p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-2">
            {item.status === 'archived' && <ConfigBadge tone="open">Archived</ConfigBadge>}
            {extra}
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            {open ? (
              <>
                <Button
                  disabled={busy || !label.trim()}
                  onClick={() => void run(async () => {
                    const next = await renameCapability({
                      part, code: item.code, label: label.trim(), gridCode,
                    });
                    setEditing(null);
                    return next;
                  })}
                >
                  Save
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="inline"
                  disabled={busy}
                  onClick={() => { setEditing(key); setLabel(item.label); }}
                >
                  Rename
                </Button>
                <Button
                  variant="inlineDanger"
                  disabled={busy}
                  title={item.status === 'archived'
                    ? undefined
                    : 'Keeps it on assessments that already tick it, and offers it on no new one.'}
                  onClick={() => void run(() => setCapabilityStatus({
                    part,
                    code: item.code,
                    status: item.status === 'archived' ? 'active' : 'archived',
                    gridCode,
                  }))}
                >
                  {item.status === 'archived' ? 'Restore' : 'Archive'}
                </Button>
              </>
            )}
          </div>
        )}
      </li>
    );
  };

  const addPanel = (part: 'milestone' | 'item', gridCode?: string) => (
    <FieldRow className="px-4 pb-4 pt-2 sm:px-5">
      <Field label="Name" htmlFor={`add-label-${gridCode ?? part}`} className="min-w-48 flex-1">
        <TextInput
          id={`add-label-${gridCode ?? part}`}
          value={entry.label}
          disabled={busy}
          onChange={(e) => setEntry((n) => ({
            ...n, label: e.target.value, code: n.touched ? n.code : suggestCode(e.target.value),
          }))}
        />
      </Field>
      <Field
        label="Code"
        htmlFor={`add-code-${gridCode ?? part}`}
        hint="Chosen once. Never reused."
        className="min-w-40"
      >
        <TextInput
          id={`add-code-${gridCode ?? part}`}
          value={entry.code}
          disabled={busy}
          onChange={(e) => setEntry((n) => ({
            ...n, code: e.target.value.toUpperCase(), touched: e.target.value !== '',
          }))}
        />
      </Field>
      <FieldRow.Actions>
        <Button
          disabled={busy || !entry.label.trim() || !entry.code.trim()}
          onClick={() => void run(async () => {
            const next = await addCapabilityItem({
              part, code: entry.code.trim(), label: entry.label.trim(), gridCode,
            });
            setEntry({ label: '', code: '', touched: false });
            setAddingTo(null);
            return next;
          })}
        >
          Add
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setAddingTo(null)}>Cancel</Button>
      </FieldRow.Actions>
    </FieldRow>
  );

  const reorder = (part: 'stage' | 'milestone' | 'grid', codes: string[], at: number, by: -1 | 1) =>
    run(() => reorderCapability({ part, codes: move(codes, at, at + by) }));

  const stageCodes = catalog.stages.map((s) => s.code);
  const milestoneCodes = catalog.milestones.map((m) => m.code);

  return (
    <SettingsScreen
      title="Capability Mapping"
      subtitle="The ladder and the skill grids your leaders assess people against."
      permission="tenant_config:read"
      tabsLabel="Capability Mapping sections"
      tabs={TABS}
      activeHref={tab}
      onSelectTab={setTab}
      error={null}
      bars={<PublishBar />}
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div role="alert" className="rounded-md border border-amber bg-card p-4">
            <p className="text-md text-navy">{error.message}</p>
          </div>
        )}

        <label className="flex items-center gap-2 text-md text-navy">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>

        {tab === '#ladder' && (
        <>
        <Card className="p-0">
          <div className="border-b border-hairline px-4 py-3 sm:px-5">
            <div className="flex items-center gap-1">
              <h2 className="font-display text-lg font-bold text-navy">The ladder</h2>
              {catalog.stages.length > 0 && <BelowDesktopTip text={LADDER_NOTE} />}
            </div>
            {catalog.stages.length > 0 && (
              <p className={cn('mt-1 text-sm text-muted', SHOWN_FROM_DESKTOP)}>{LADDER_NOTE}</p>
            )}
          </div>
          {/*
            * A catalog with no stage at all. Since ADR-0116 (2026-10-08) every new office is given the
            * platform ladder where its source has none, so provisioning no longer makes one; an office
            * started Empty before then still could be.
            */}
          {catalog.stages.length === 0 && <EmptyState title="No stages yet." />}
          <ul className="flex flex-col divide-y divide-hairline">
            {visible(catalog.stages).map((stage, index) => row(
              stage, 'stage', undefined,
              (by) => void reorder('stage', stageCodes, index, by),
              <ConfigBadge tone="won">
                Needs {stage.requiredMilestoneCodes.length}{' '}
                {stage.requiredMilestoneCodes.length === 1 ? 'milestone' : 'milestones'}
              </ConfigBadge>,
            ))}
          </ul>
        </Card>

        <Card className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
            <h2 className="font-display text-lg font-bold text-navy">Milestones</h2>
            {canWrite && (
              <Button
                variant="secondary"
                className="ml-auto"
                disabled={busy || addingTo === 'milestone'}
                onClick={() => { setEntry({ label: '', code: '', touched: false }); setAddingTo('milestone'); }}
              >
                Add a milestone
              </Button>
            )}
          </div>
          {catalog.milestones.length === 0 && addingTo !== 'milestone' && (
            <EmptyState title="No milestones yet." />
          )}
          <ul className="flex flex-col divide-y divide-hairline">
            {visible(catalog.milestones).map((milestone, index) => row(
              milestone, 'milestone', undefined,
              (by) => void reorder('milestone', milestoneCodes, index, by),
            ))}
          </ul>
          {addingTo === 'milestone' && addPanel('milestone')}
        </Card>
        </>
        )}

        {tab === '#skills' && catalog.grids.length === 0 && (
          <Card><EmptyState title="No skill grids yet." /></Card>
        )}
        {tab === '#skills' && catalog.grids.map((grid) => (
          <Card key={grid.code} className="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
              <h2 className="font-display text-lg font-bold text-navy">{grid.label}</h2>
              {grid.requiresDownline && (
                <ConfigBadge tone="open">Only for somebody with a downline</ConfigBadge>
              )}
              {canWrite && (
                <Button
                  variant="secondary"
                  className="ml-auto"
                  disabled={busy || addingTo === grid.code}
                  onClick={() => { setEntry({ label: '', code: '', touched: false }); setAddingTo(grid.code); }}
                >
                  Add an item
                </Button>
              )}
            </div>
            <ul className="flex flex-col divide-y divide-hairline">
              {visible(grid.items).map((item) => row(item, 'item', grid.code))}
            </ul>
            {addingTo === grid.code && addPanel('item', grid.code)}
          </Card>
        ))}
      </div>
    </SettingsScreen>
  );
}
