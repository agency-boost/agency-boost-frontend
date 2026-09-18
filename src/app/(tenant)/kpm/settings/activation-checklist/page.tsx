'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { SettingsScreen } from '@/components/settings-screen';
import { DragHandle } from '@/components/ui/drag-handle';
import { ConfigBadge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, Card, Field, ReadOnlyField, Select, TextInput,
} from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { suggestCode } from '@/lib/config-code';
import { useCan } from '@/lib/session';
import {
  listTraining, publishActivationChecklist, readActivationChecklist, saveActivationDraft,
  type ActivationChecklist, type ActivationDraft, type ActivationVersion,
  type TrainingCategoryRow,
} from '@/lib/tenant-config';

/** The link options the prototype's select offers, plus the office's own published modules. */
const FEATURE_LINKS = [
  { value: 'feature:goals', label: 'Goal Settings' },
  { value: 'feature:leads', label: 'Leads Management' },
  { value: 'feature:activity', label: 'Activity Management' },
];

type DraftAspect = ActivationDraft['aspects'][number];
type DraftItem = DraftAspect['items'][number];

/** The server's version as the local working copy — the shape a save sends back. */
const toDraft = (version: ActivationVersion): ActivationDraft => ({
  aspects: version.aspects.map((aspect) => ({
    code: aspect.code,
    label: aspect.label,
    items: aspect.items.map((item) => ({
      code: item.code, label: item.label, autoLink: item.autoLink,
    })),
  })),
});

const move = <T,>(rows: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};

/**
 * The office's 90-day activation checklist (P5-T3, `KPM_Owner.html:1524-1560`).
 *
 * **Draft, then publish, and the publish is this screen's own.** Every other settings screen edits
 * rows the office publishes as one snapshot; a checklist is a document whose versions a hire's
 * activation pins, so it publishes separately (ADR-0031). The office-wide *Publish to agents* bar is
 * deliberately absent here — it would say nothing true about this screen.
 *
 * **A published version is never edited.** Editing writes a draft; publishing turns that draft into
 * the next version, which is given to hires who start after it. Somebody halfway through their
 * ninety days keeps the checklist they started on.
 */
export default function ActivationChecklistPage() {
  const canWrite = useCan('tenant_config:write');
  const [server, setServer] = useState<ActivationChecklist | null>(null);
  const [draft, setDraft] = useState<ActivationDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [modules, setModules] = useState<TrainingCategoryRow[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addingAspect, setAddingAspect] = useState(false);
  const [entry, setEntry] = useState({ label: '', code: '', codeTouched: false, first: '' });
  /*
   * Native HTML5 drag, as the other settings screens do it, and the ↑/↓ on the same handle for
   * the keyboard and for a phone, where drag never fires (parity I-71). An item moves within its
   * aspect; an aspect moves among aspects.
   */
  const [dragging, setDragging] = useState<{ aspect: string; item?: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [checklist, tree] = await Promise.all([readActivationChecklist(), listTraining()]);
      setServer(checklist);
      // Never assumed: an office whose database has not had the checklist seeded answers with
      // neither, and dereferencing that threw — which `toDisplayError` then reported as
      // "Could not reach the server", sending the reader to check their connection over a bug.
      const current = checklist.draft ?? checklist.published;
      setDraft(current ? toDraft(current) : { aspects: [] });
      setDirty(false);
      setModules(tree);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** Every module agents are offered, which is the only kind an item may wait for. */
  const offered = modules.flatMap((c) => c.skills.flatMap((s) => s.modules))
    .filter((m) => m.status === 'active' && m.publishState === 'published');

  function change(next: ActivationDraft) {
    setDraft(next);
    setDirty(true);
    setSaved(false);
  }

  const patchAspect = (code: string, fields: Partial<DraftAspect>) => change({
    aspects: draft!.aspects.map((a) => (a.code === code ? { ...a, ...fields } : a)),
  });

  const patchItem = (aspectCode: string, itemCode: string, fields: Partial<DraftItem>) =>
    patchAspect(aspectCode, {
      items: draft!.aspects.find((a) => a.code === aspectCode)!.items
        .map((i) => (i.code === itemCode ? { ...i, ...fields } : i)),
    });

  async function run(action: () => Promise<ActivationChecklist>) {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      setServer(next);
      const current = next.draft ?? next.published;
      setDraft(current ? toDraft(current) : { aspects: [] });
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  const version = server?.draft?.version ?? ((server?.published?.version ?? 0) + 1);
  /** A draft the office has actually saved. The starting point carries no id, and publishes nothing. */
  const hasDraft = Boolean(server?.draft?.id);

  function linkOf(item: DraftItem) {
    if (item.autoLink === null) return null;
    const feature = FEATURE_LINKS.find((f) => f.value === item.autoLink);
    if (feature) return { label: feature.label, live: false, phase: 11 };
    const code = item.autoLink.replace(/^training:/, '');
    return { label: offered.find((m) => m.code === code)?.title ?? code, live: false, phase: 12 };
  }

  /** Drop what is held where `target` sits — within one aspect, or among the aspects. */
  function drop(target: { aspect: string; item?: string }) {
    const held = dragging;
    setDragging(null);
    setOver(null);
    if (!held || !draft) return;

    if (held.item === undefined || target.item === undefined) {
      if (held.item !== undefined || target.item !== undefined) return;
      const from = draft.aspects.findIndex((a) => a.code === held.aspect);
      const to = draft.aspects.findIndex((a) => a.code === target.aspect);
      if (from < 0 || to < 0 || from === to) return;
      change({ aspects: move(draft.aspects, from, to) });
      return;
    }

    // An item stays in its own aspect: moving it elsewhere is a different decision, and the
    // heading and the item would otherwise disagree about where it lives.
    if (held.aspect !== target.aspect) return;
    const items = draft.aspects.find((a) => a.code === held.aspect)!.items;
    const from = items.findIndex((i) => i.code === held.item);
    const to = items.findIndex((i) => i.code === target.item);
    if (from < 0 || to < 0 || from === to) return;
    patchAspect(held.aspect, { items: move(items, from, to) });
  }

  function aspectCard(aspect: DraftAspect, at: number) {
    return (
      <Card
        key={aspect.code}
        className={`p-0 ${over === aspect.code ? 'ring-2 ring-amber' : ''}`}
        onDragOver={(e) => {
          if (!dragging || dragging.item !== undefined) return;
          e.preventDefault();
          setOver(aspect.code);
        }}
        onDragLeave={() => setOver((now) => (now === aspect.code ? null : now))}
        onDrop={(e) => { e.preventDefault(); drop({ aspect: aspect.code }); }}
      >
        {/* `checklist-section-head`: the heading left, its add control right. */}
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
          {canWrite && (
            <DragHandle
              label={aspect.label}
              disabled={busy}
              onPick={() => setDragging({ aspect: aspect.code })}
              onDrop={() => { setDragging(null); setOver(null); }}
              onMove={(by) => change({ aspects: move(draft!.aspects, at, at + by) })}
            />
          )}
          <h2 className="font-display text-lg font-bold text-navy">{aspect.label}</h2>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <ConfigBadge tone={aspect.items.length > 0 ? 'won' : 'open'}>
              {aspect.items.length} {aspect.items.length === 1 ? 'item' : 'items'}
            </ConfigBadge>
            {canWrite && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAddingAspect(false);
                    setAddingTo(aspect.code);
                    setEntry({ label: '', code: '', codeTouched: false, first: '' });
                  }}
                >
                  + Add item
                </Button>
{/*
                  * One rule, on both screens: an aspect is removed **with** its items. An aspect
                  * holding none cannot be saved — the checker refuses it — so "empty it first"
                  * would be a path that dead-ends, which is what it did when it was tried.
                  */}
                <Button
                  variant="inlineDanger"
                  disabled={busy || draft!.aspects.length === 1}
                  title={draft!.aspects.length === 1
                    ? 'A checklist needs at least one aspect.'
                    : `Removes ${aspect.label} and its ${aspect.items.length} `
                      + `${aspect.items.length === 1 ? 'item' : 'items'} from the next version.`}
                  onClick={() => change({
                    aspects: draft!.aspects.filter((a) => a.code !== aspect.code),
                  })}
                >
                  Remove
                </Button>
              </>
            )}
          </span>
        </div>

        <ul className="flex flex-col divide-y divide-hairline">
          {aspect.items.map((item, index) => {
            const link = linkOf(item);
            return (
              <li
                key={item.code}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5 ${
                  over === item.code ? 'bg-base' : ''
                } ${dragging?.item === item.code ? 'opacity-40' : ''}`}
                onDragOver={(e) => {
                  if (!dragging || dragging.item === undefined) return;
                  e.preventDefault();
                  setOver(item.code);
                }}
                onDragLeave={() => setOver((now) => (now === item.code ? null : now))}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  drop({ aspect: aspect.code, item: item.code });
                }}
              >
                {canWrite && (
                  <DragHandle
                    label={item.label}
                    disabled={busy}
                    className="cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
                    onPick={() => setDragging({ aspect: aspect.code, item: item.code })}
                    onDrop={() => { setDragging(null); setOver(null); }}
                    onMove={(by) => patchAspect(aspect.code, {
                      items: move(aspect.items, index, index + by),
                    })}
                  />
                )}

                <div className="min-w-0 flex-1">
                  {editing === item.code ? (
                    <div className="flex flex-col gap-2">
                      <ReadOnlyField
                        label="Code"
                        value={item.code}
                        reason="Every hire's progress on this item points at it."
                      />
                      <div className="flex flex-wrap items-end gap-2">
                        <Field label="Item" htmlFor={`label-${item.code}`} className="min-w-60 flex-1">
                          <TextInput
                            id={`label-${item.code}`}
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                          />
                        </Field>
                        <Button
                          disabled={!editLabel.trim()}
                          onClick={() => {
                            patchItem(aspect.code, item.code, { label: editLabel.trim() });
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
                      <p className="text-md text-navy">{item.label}</p>
                      {link && (
                        <p className="mt-0.5 text-sm text-muted">
                          Completes from <strong className="text-navy">{link.label}</strong>
                          {' — '}
                          {`ticked by the leader until the ${link.label === 'Training module' ? 'module' : 'link'} `
                            + `starts working in phase ${link.phase}`}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {item.autoLink !== null && <ConfigBadge tone="won">Auto</ConfigBadge>}

                {canWrite && editing !== item.code && (
                  /* Wraps rather than holding its width: the select alone is wider than half a
                     phone, and a row that cannot shrink pushes the whole page sideways. */
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <Field label="Completes from" htmlFor={`link-${item.code}`} className="min-w-44 flex-1">
                      <Select
                        id={`link-${item.code}`}
                        value={item.autoLink ?? ''}
                        disabled={busy}
                        onChange={(e) => patchItem(aspect.code, item.code, {
                          autoLink: e.target.value === '' ? null : e.target.value,
                        })}
                      >
                        <option value="">No link (manual)</option>
                        <optgroup label="Feature">
                          {FEATURE_LINKS.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Training module">
                          {offered.map((m) => (
                            <option key={m.code} value={`training:${m.code}`}>{m.title}</option>
                          ))}
                        </optgroup>
                      </Select>
                    </Field>
                    <Button
                      variant="inline"
                      onClick={() => { setEditing(item.code); setEditLabel(item.label); }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="inlineDanger"
                      disabled={busy || aspect.items.length === 1}
                      title={aspect.items.length === 1
                        ? 'An aspect needs at least one item — remove the aspect instead.'
                        : undefined}
                      onClick={() => patchAspect(aspect.code, {
                        items: aspect.items.filter((i) => i.code !== item.code),
                      })}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {canWrite && addingTo === aspect.code && (
          <div className="flex flex-wrap items-end gap-3 border-t border-hairline px-4 py-3 sm:px-5">
            <Field label="Item" htmlFor="new-item-label" className="min-w-60 flex-1">
              <TextInput
                id="new-item-label"
                value={entry.label}
                onChange={(e) => setEntry((d) => ({
                  ...d, label: e.target.value, code: d.codeTouched ? d.code : suggestCode(e.target.value),
                }))}
              />
            </Field>
            <Field
              label="Code"
              htmlFor="new-item-code"
              hint="Filled in from the item. Permanent once saved."
              className="min-w-48"
            >
              <TextInput
                id="new-item-code"
                value={entry.code}
                onChange={(e) => setEntry((d) => ({
                  ...d, code: e.target.value.toUpperCase(), codeTouched: e.target.value !== '',
                }))}
              />
            </Field>
            <Button
              disabled={!entry.label.trim() || !entry.code.trim()}
              onClick={() => {
                patchAspect(aspect.code, {
                  items: [...aspect.items, {
                    code: entry.code.trim(), label: entry.label.trim(), autoLink: null,
                  }],
                });
                setAddingTo(null);
              }}
            >
              Add
            </Button>
            <Button variant="secondary" onClick={() => setAddingTo(null)}>Cancel</Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <SettingsScreen
      title="Activation checklist"
      subtitle="What every new hire works through in their first 90 days."
      permission="tenant_config:read"
      error={error}
      toolbar={{
        /* The prototype's own sentence, which is the whole explanation of the AUTO badge. */
        hint: 'Applies to every new hire’s 90-day activation. Items linked to a feature or '
          + 'training module auto-complete when the agent does that action — no manual check-off needed.',
        actions: (
          <>
            {canWrite && draft && !addingAspect && (
              <Button onClick={() => {
                setAddingTo(null);
                setAddingAspect(true);
                setEntry({ label: '', code: '', codeTouched: false, first: '' });
              }}
              >
                + Add aspect
              </Button>
            )}
          </>
        ),
      }}
    >
      {server === null || draft === null ? (
        error ? null : <SkeletonCards count={3} />
      ) : server.draft === null && server.published === null ? (
        /* Neither a version nor a starting point. Our own API never answers this — it sends the
           standard checklist — so this is an older server, and it says so rather than drawing an
           editor over nothing. */
        <Card>
          <EmptyState title="This office has no activation checklist yet." />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <p className="text-md text-navy">
              {server.published ? (
                <>
                  Hires starting now are given{' '}
                  <strong>version {server.published.version}</strong>.
                  {hasDraft && <> You have an unpublished draft, which will become version {version}.</>}
                </>
              ) : hasDraft ? (
                <>
                  Nothing is published yet, so no hire has been given a checklist. Your draft will
                  become <strong>version {version}</strong>.
                </>
              ) : (
                <>
                  Nothing is published yet, so no hire has been given a checklist. What you are
                  looking at is the <strong>standard checklist</strong>, ready to edit — save it, then
                  publish version 1.
                </>
              )}
            </p>
            <p className="mt-2 text-md text-muted">
              Publishing gives the new version to hires who start <strong>after</strong> it. Anybody
              part-way through their ninety days keeps the checklist they started on, which is why a
              published version is never edited.
            </p>
            {/* The one setting this screen shows and does not own. */}
            <p className="mt-2 text-sm text-muted">
              The window is <strong className="text-navy">{server.windowDays} days</strong> — change it
              in{' '}
              <Link href="/kpm/settings/branch-info" className="font-semibold text-navy underline">
                Branch info
              </Link>.
            </p>

            {canWrite && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {/* The starting point is savable as it stands: saving it is what makes the office
                    have a checklist at all. */}
                <Button
                  disabled={busy || (!dirty && (hasDraft || server.published !== null))}
                  onClick={() => void run(() => saveActivationDraft(draft))}
                >
                  {busy ? 'Saving…' : 'Save draft'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || dirty || !hasDraft}
                  title={dirty ? 'Save the draft first.' : undefined}
                  onClick={() => void run(publishActivationChecklist)}
                >
                  Publish version {version}
                </Button>
                {dirty && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      const current = server.draft ?? server.published;
                      setDraft(current ? toDraft(current) : { aspects: [] });
                      setDirty(false);
                    }}
                  >
                    Undo my edits
                  </Button>
                )}
                {saved && !dirty && (
                  <p role="status" className="text-md font-semibold text-success">Saved.</p>
                )}
              </div>
            )}
          </Card>

          {canWrite && addingAspect && (
            <Card>
              <h2 className="font-display text-lg font-bold text-navy">Add an aspect</h2>
              <p className="mt-1 text-sm text-muted">
                An aspect is a heading with items under it. It needs its first item now, because an
                aspect with nothing in it is a heading a hire opens and finds empty.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Field label="Aspect" htmlFor="new-aspect-label" className="min-w-60 flex-1">
                  <TextInput
                    id="new-aspect-label"
                    value={entry.label}
                    onChange={(e) => setEntry((d) => ({
                      ...d,
                      label: e.target.value,
                      code: d.codeTouched ? d.code : suggestCode(e.target.value),
                    }))}
                  />
                </Field>
                <Field
                  label="Code"
                  htmlFor="new-aspect-code"
                  hint="Filled in from the name. Permanent once saved."
                  className="min-w-48"
                >
                  <TextInput
                    id="new-aspect-code"
                    value={entry.code}
                    onChange={(e) => setEntry((d) => ({
                      ...d, code: e.target.value.toUpperCase(), codeTouched: e.target.value !== '',
                    }))}
                  />
                </Field>
                <Field label="Its first item" htmlFor="new-aspect-item" className="min-w-60 flex-1">
                  <TextInput
                    id="new-aspect-item"
                    value={entry.first}
                    onChange={(e) => setEntry((d) => ({ ...d, first: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={!entry.label.trim() || !entry.code.trim() || !entry.first.trim()}
                  onClick={() => {
                    change({
                      aspects: [...draft.aspects, {
                        code: entry.code.trim(),
                        label: entry.label.trim(),
                        items: [{
                          code: suggestCode(entry.first) || `${entry.code.trim()}_1`,
                          label: entry.first.trim(),
                          autoLink: null,
                        }],
                      }],
                    });
                    setAddingAspect(false);
                  }}
                >
                  Add the aspect
                </Button>
                <Button variant="secondary" onClick={() => setAddingAspect(false)}>Cancel</Button>
              </div>
            </Card>
          )}

          {draft.aspects.map((aspect, at) => aspectCard(aspect, at))}
        </div>
      )}
    </SettingsScreen>
  );
}
