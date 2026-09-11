'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { ACTIVITY_SETTINGS_TABS, SettingsTabs } from '@/components/settings-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import {
  archiveActivityType,
  createActivityType,
  listActivityTypes,
  reorderActivityTypes,
  restoreActivityType,
  updateActivityType,
  type ActivityCategoryRow,
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
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState({ code: '', label: '', description: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const load = useCallback(async () => {
    try {
      setCategories(await listActivityTypes(showArchived));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [showArchived]);

  useEffect(() => { void load(); }, [load]);

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      await load();
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
    const to = at + by;
    if (to < 0 || to >= order.length) return;
    [order[at], order[to]] = [order[to], order[at]];
    void run(`move:${id}`, () => reorderActivityTypes(order));
  }

  const flat = (categories ?? []).flatMap((c) => c.types);

  return (
    <Page
      title="Activity types"
      subtitle="What this office counts. Agents see these on Log Activity, in this order."
      permission="tenant_config:read"
    >
      <SettingsTabs tabs={ACTIVITY_SETTINGS_TABS} />
      {error && <ErrorBanner {...error} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-md text-navy">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {categories === null ? (
        <SkeletonCards count={5} />
      ) : categories.length === 0 ? (
        <EmptyState title="No activity types yet" />
      ) : (
        <div className="flex flex-col gap-4">
          {categories.map((category) => (
            <Card key={category.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-navy">{category.label}</h2>
                <span className="text-sm text-muted">
                  <code>{category.code}</code>
                  {' · '}
                  {category.types.length} {category.types.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <ul className="mt-3 flex flex-col divide-y divide-hairline">
                {category.types.map((type) => (
                  <li key={type.id} className="flex flex-wrap items-start gap-3 py-3">
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-semibold text-navy"
                      aria-hidden
                    >
                      {type.displayOrder}
                    </span>

                    <div className="min-w-0 flex-1">
                      {editing === type.id ? (
                        <div className="flex flex-wrap items-end gap-2">
                          <Field label="Label" htmlFor={`label-${type.id}`} className="min-w-60 flex-1">
                            <TextInput
                              id={`label-${type.id}`}
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                            />
                          </Field>
                          <Button
                            disabled={!editLabel.trim() || busy !== null}
                            onClick={() => void run(`edit:${type.id}`, async () => {
                              await updateActivityType(type.id, { label: editLabel });
                              setEditing(null);
                            })}
                          >
                            Save
                          </Button>
                          <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
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
                          disabled={busy !== null || flat[0]?.id === type.id}
                          onClick={() => move(flat, type.id, -1)}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="secondary"
                          aria-label={`Move ${type.label} down`}
                          disabled={busy !== null || flat.at(-1)?.id === type.id}
                          onClick={() => move(flat, type.id, 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => { setEditing(type.id); setEditLabel(type.label); }}
                        >
                          Edit
                        </Button>
                        {type.status === 'active' ? (
                          <Button
                            variant="danger"
                            disabled={busy !== null}
                            onClick={() => void run(`archive:${type.id}`, () => archiveActivityType(type.id))}
                          >
                            Archive
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            disabled={busy !== null}
                            onClick={() => void run(`restore:${type.id}`, () => restoreActivityType(type.id))}
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
                  <Button
                    disabled={!draft.code.trim() || !draft.label.trim() || busy !== null}
                    onClick={() => void run(`add:${category.code}`, async () => {
                      await createActivityType({
                        code: draft.code,
                        categoryCode: category.code,
                        label: draft.label,
                        description: draft.description || undefined,
                      });
                      setAdding(null);
                      setDraft({ code: '', label: '', description: '' });
                    })}
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
