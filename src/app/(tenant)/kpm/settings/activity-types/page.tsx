'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { PublishBar } from '@/components/publish-bar';
import { StagedChangesBar } from '@/components/staged-changes-bar';
import { ACTIVITY_SETTINGS_TABS, SettingsTabs } from '@/components/settings-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, Card, ErrorBanner, Field, ReadOnlyField, TextInput,
} from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import { useTenantConfig } from '@/lib/tenant-config-cache';
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
  const canWrite = useCan('tenant_config:write');
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

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      await load();
      setPublished((n) => n + 1);
    } catch (err) {
      setError(toDisplayError(err));
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
      ? 'Everyone'
      : codes.map((c) => ladder.find((l) => l.code === c)?.label ?? c).join(' · '));

  /** The rows in view, in order — what the ↑↓ edges are about. */
  const visibleFlat = flat.filter((t) => showArchived || t.status === 'active');

  /** What the reader sees, which is a subset of what a reorder sends. */
  const shown = (categories ?? []).map((c) => ({
    ...c,
    types: showArchived ? c.types : c.types.filter((t) => t.status === 'active'),
  }));

  return (
    <Page
      title="Activity types"
      subtitle="What this office counts. Agents see these on Log Activity, in this order."
      permission="tenant_config:read"
    >
      <SettingsTabs tabs={ACTIVITY_SETTINGS_TABS} />
      {error && <ErrorBanner {...error} />}
      <PublishBar refreshKey={published} />

      <StagedChangesBar
        count={staged.length}
        busy={busy !== null}
        onSave={() => void saveStaged()}
        onDiscard={() => setStaged([])}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* `config-toolbar`'s hint: the prototype leads every settings screen with a count
            sentence, and it is the fastest way to see that a taxonomy is complete. */}
        <p className="text-sm text-muted">
          {categories === null
            ? '\u00a0'
            : `${categories.flatMap((c) => c.types).filter((t) => t.status === 'active').length} `
              + `activity types across ${categories.length} categories`}
        </p>
        <label className="flex items-center gap-2 text-md text-navy">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {canWrite && categories !== null && (
        <Card className="mb-4">
          {addingSection ? (
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-bold text-navy">Add a section</h2>
              <p className="text-sm text-muted">
                A heading on the agent&rsquo;s Log Activity screen, with its own activity
                types under it. You choose who it applies to after it exists.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Code" htmlFor="new-section-code" hint="Permanent once saved." className="min-w-48">
                  <TextInput
                    id="new-section-code"
                    value={section.code}
                    onChange={(e) => setSection({ ...section, code: e.target.value.toUpperCase() })}
                    placeholder="REFERRALS"
                  />
                </Field>
                <Field label="Name" htmlFor="new-section-label" className="min-w-60 flex-1">
                  <TextInput
                    id="new-section-label"
                    value={section.label}
                    onChange={(e) => setSection({ ...section, label: e.target.value })}
                  />
                </Field>
                <Field
                  label="Description"
                  htmlFor="new-section-description"
                  hint="Optional."
                  className="min-w-60 flex-1"
                >
                  <TextInput
                    id="new-section-description"
                    value={section.description}
                    onChange={(e) => setSection({ ...section, description: e.target.value })}
                  />
                </Field>
              </div>
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
                  Add the section
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAddingSection(false);
                    setSection({ code: '', label: '', description: '' });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setAddingSection(true)}>Add a section</Button>
          )}
        </Card>
      )}

      {categories === null ? (
        <SkeletonCards count={5} />
      ) : categories.length === 0 ? (
        <EmptyState title="No activity types yet" />
      ) : (
        // `acttype-grid`: two columns, one per category, collapsing at the prototype's
        // own 760px. Five cards stacked made the screen a scroll where it is a glance.
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {shown.map((category) => (
            <Card
              key={category.id}
              className={over === category.id ? 'ring-2 ring-amber' : ''}
              onDragOver={(e) => {
                if (!dragging || dragging.kind !== 'section') return;
                e.preventDefault();
                setOver(category.id);
              }}
              onDragLeave={() => setOver((now) => (now === category.id ? null : now))}
              onDrop={(e) => { e.preventDefault(); drop(category.id); }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                {canWrite && (
                  <span
                    draggable
                    onDragStart={() => setDragging({ kind: 'section', id: category.id })}
                    onDragEnd={() => { setDragging(null); setOver(null); }}
                    aria-hidden
                    className="cursor-grab select-none text-md text-muted"
                  >
                    ⠿
                  </span>
                )}
                <h2 className="font-display text-lg font-bold text-navy">{category.label}</h2>
                <span className="flex items-center gap-2">
                  <code className="text-sm text-muted">{category.code}</code>
                  <span className="whitespace-nowrap rounded-full border border-hairline bg-canvas px-2 py-0.5 text-sm font-semibold text-muted">
                    {category.types.length} {category.types.length === 1 ? 'item' : 'items'}
                  </span>
                </span>
              </div>

              {category.description && (
                <p className="mt-1 text-sm text-muted">{category.description}</p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2 border-b border-hairline pb-3">
                {scoping === category.id ? (
                  <>
                    <fieldset className="min-w-0 flex-1">
                      <legend className="text-sm font-semibold text-navy">Applies to</legend>
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
                      <p className="mt-1 text-sm text-muted">
                        Tick none to ask everyone. Everything in this section is hidden from
                        anybody on a rung you leave unticked.
                      </p>
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
                      Save
                    </Button>
                    <Button variant="secondary" onClick={() => setScoping(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <p className="flex-1 text-md text-navy">
                      <span className="text-muted">Applies to </span>
                      <strong>{appliesTo(category.appliesToOrgLevelCodes)}</strong>
                    </p>
                    {canWrite && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setScoping(category.id);
                            setRungs(category.appliesToOrgLevelCodes);
                          }}
                        >
                          Change who it applies to
                        </Button>
                        {category.status === 'active' ? (
                          <Button
                            variant="secondary"
                            disabled={busy !== null}
                            title="Archives the section and everything in it."
                            onClick={() => stage({
                              op: 'category.archive',
                              id: category.id,
                              expectedVersion: category.version,
                            })}
                          >
                            Archive the section
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            disabled={busy !== null}
                            onClick={() => stage({
                              op: 'category.restore',
                              id: category.id,
                              expectedVersion: category.version,
                            })}
                          >
                            Restore the section
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              <ul className="mt-3 flex flex-col divide-y divide-hairline">
                {category.types.map((type) => (
                  <li
                    key={type.id}
                    className={`flex flex-wrap items-start gap-3 py-3 ${
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
                      <span
                        draggable
                        onDragStart={() => setDragging({ kind: 'type', id: type.id })}
                        onDragEnd={() => { setDragging(null); setOver(null); }}
                        // Aria-hidden because the ↑↓ buttons below are the accessible path
                        // and announcing a third, unusable control would be noise.
                        aria-hidden
                        className="mt-1 cursor-grab select-none text-md text-muted"
                      >
                        ⠿
                      </span>
                    )}
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-navy text-sm font-bold text-navy"
                      aria-hidden
                    >
                      {type.displayOrder}
                    </span>

                    <div className="min-w-0 flex-1">
                      {editing === type.id ? (
                        <div className="flex flex-col gap-2">
                          {/* The code, shown and not editable. `ReadOnlyField` is a `<dl>`
                              rather than a labelled control on purpose: it is not an input
                              that happens to be disabled — disabled reads as "not right
                              now", and this is never. */}
                          <ReadOnlyField
                            label="Code"
                            value={type.code}
                            reason="Every activity logged, every ratio and every goal points at it."
                          />
                          <div className="flex flex-wrap items-end gap-2">
                            <Field label="Label" htmlFor={`label-${type.id}`} className="min-w-60 flex-1">
                              <TextInput
                                id={`label-${type.id}`}
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                              />
                            </Field>
                            <Field
                              label="Description"
                              htmlFor={`description-${type.id}`}
                              hint="Optional. Shown under the name on the agent's screen."
                              className="min-w-60 flex-1"
                            >
                              <TextInput
                                id={`description-${type.id}`}
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                              />
                            </Field>
                          </div>
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
                              Save
                            </Button>
                            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-md text-navy">{type.label}</p>
                          {type.description && (
                            <p className="text-sm text-muted">{type.description}</p>
                          )}
                          <p className="mt-0.5 text-sm text-muted">
                            {/* The part that does not move when the numbers do. */}
                            <code>{type.code}</code>
                            {type.status === 'archived' && ' · archived'}
                          </p>
                        </>
                      )}
                    </div>

                    {canWrite && editing !== type.id && (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          aria-label={`Move ${type.label} up`}
                          disabled={busy !== null || visibleFlat[0]?.id === type.id}
                          onClick={() => move(flat, type.id, -1)}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="secondary"
                          aria-label={`Move ${type.label} down`}
                          disabled={busy !== null || visibleFlat.at(-1)?.id === type.id}
                          onClick={() => move(flat, type.id, 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditing(type.id);
                            setEditLabel(type.label);
                            setEditDescription(type.description ?? '');
                          }}
                        >
                          Edit
                        </Button>
                        {type.status === 'active' ? (
                          <Button
                            variant="danger"
                            disabled={busy !== null}
                            onClick={() => stage({
                              op: 'type.archive', id: type.id, expectedVersion: type.version,
                            })}
                          >
                            Archive
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            disabled={busy !== null}
                            onClick={() => stage({
                              op: 'type.restore', id: type.id, expectedVersion: type.version,
                            })}
                          >
                            Restore
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {canWrite && (adding === category.code ? (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-hairline pt-3">
                  <Field
                    label="Code"
                    htmlFor={`code-${category.id}`}
                    hint="Permanent. Ratios and goals bind to it."
                    className="min-w-48"
                  >
                    <TextInput
                      id={`code-${category.id}`}
                      value={draft.code}
                      onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                      placeholder="SELL_REFERRAL"
                    />
                  </Field>
                  <Field label="Label" htmlFor={`new-label-${category.id}`} className="min-w-60 flex-1">
                    <TextInput
                      id={`new-label-${category.id}`}
                      value={draft.label}
                      onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    />
                  </Field>
                  {/* `draft.description` was sent from the first day and no input was ever
                      bound to it, so it was always the empty string. */}
                  <Field
                    label="Description"
                    htmlFor={`new-description-${category.id}`}
                    hint="Optional. Shown under the name on the agent's screen."
                    className="min-w-60 flex-1"
                  >
                    <TextInput
                      id={`new-description-${category.id}`}
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      placeholder="telepon, WhatsApp, tatap muka, dll"
                    />
                  </Field>
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
                    Add
                  </Button>
                  <Button variant="secondary" onClick={() => setAdding(null)}>Cancel</Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => { setAdding(category.code); setDraft({ code: '', label: '', description: '' }); }}
                >
                  Add to {category.label}
                </Button>
              ))}
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
