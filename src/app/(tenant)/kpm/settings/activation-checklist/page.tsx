'use client';

import { useCallback, useEffect, useState } from 'react';
import { SettingsScreen } from '@/components/settings-screen';
import { BelowDesktopTip } from '@/components/ui/below-desktop-tip';
import { DRAG_HANDLE_CLASS, DragHandle } from '@/components/ui/drag-handle';
import { ConfigBadge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, Card, CodeField, Field, FieldRow, Select, TextInput,
} from '@/components/ui/field';
import { CONTROL_PHONE, TAP_TARGET } from '@/components/ui/phone';
import { ReorderArrows } from '@/components/ui/reorder-arrows';
import { SkeletonCards } from '@/components/ui/skeleton';
import { SHOWN_FROM_DESKTOP } from '@/components/ui/tablet';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { OWN_COPY, PROTOTYPE_COPY } from '@/lib/activation';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { suggestCode } from '@/lib/config-code';
import { useCan } from '@/lib/session';
import { usePhone } from '@/lib/use-phone';
import {
  listTraining, publishActivationChecklist, readActivationChecklist, saveActivationDraft,
  type ActivationChecklist, type ActivationDraft, type ActivationLink, type ActivationVersion,
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

/**
 * What the server resolved each link to — its words and **whether it works** (`live`) — by kind, from
 * every item it answered with, the published version's and the draft's. A link chosen here and not saved
 * yet is in neither, and stays unresolved until **Save draft** answers with it.
 */
function resolvedLinks(server: ActivationChecklist | null): Map<string, ActivationLink> {
  const links = new Map<string, ActivationLink>();
  for (const version of [server?.published, server?.draft]) {
    for (const aspect of version?.aspects ?? []) {
      for (const item of aspect.items) if (item.link) links.set(item.link.kind, item.link);
    }
  }
  return links;
}

/**
 * **The three data-backed items, by code** (P18.96-T7 G2; ADR-0171 §3): *Close first case independently*, *Reach
 * Independent Agent milestone* and *Weekly 1-on-1 check-in* store no link — their kind is bound by their code — and
 * the server serves each its kind as `link`, a data kind's carrying its `form`. Read from every version it answered
 * with, so an item the draft keeps keeps its kind; one that stores a link of its own reads that link, as the field
 * does (`effectiveAutoLink`). Nothing here knows which codes are bound (invariant §7).
 */
function boundLinks(server: ActivationChecklist | null): Map<string, ActivationLink> {
  const bound = new Map<string, ActivationLink>();
  for (const version of [server?.published, server?.draft]) {
    for (const aspect of version?.aspects ?? []) {
      for (const item of aspect.items) if (item.autoLink === null && item.link?.form) bound.set(item.code, item.link);
    }
  }
  return bound;
}

/** `ConfigBadge`'s pill, painted on the button that carries the badge's words (ADR-0062 §2, form 2). */
const BADGE_FACE = 'h-auto w-auto whitespace-nowrap rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-wide';

/**
 * The row's badge (`.checklist-auto-badge`, `KPM_Owner.html:1532-1560`), saying **whether** the link
 * completes the item and never when (P13-T3 AC-1, ADR-0062 §3; parity I-80). *Auto* only for a link that
 * works, with the registry's sentence as its tooltip and in its name, as on the hire's page; for one that
 * does not, *Ticked by hand*, and its tooltip says who ticks it. A link not yet resolved claims neither.
 */
function LinkBadge({ link }: { link: ActivationLink }) {
  return link.live ? (
    <TippedGlyph
      glyph={PROTOTYPE_COPY.auto}
      name={OWN_COPY.autoName(link.completesWhen)}
      tip={OWN_COPY.autoTip(link.completesWhen)}
      align="fit"
      face={cn(BADGE_FACE, 'bg-success/10 text-success hover:bg-success/15 hover:text-success')}
    />
  ) : (
    <TippedGlyph
      glyph={OWN_COPY.byHand}
      name={OWN_COPY.byHandName}
      tip={OWN_COPY.byHandTip}
      align="fit"
      face={cn(BADGE_FACE, 'border border-hairline bg-base text-muted hover:bg-base hover:text-navy')}
    />
  );
}

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
/**
 * **The checklist's two grey sentences, in the client's words, each with its verdict per size** (P18.97-T4 AC-6,
 * ADR-0176 §6; the grey-text table of 2026-10-27, UI-027). From 1024px both are shown; at 768–1023px both are behind
 * an ⓘ beside their subject; below 768px the first is behind its ⓘ and the second is removed.
 */
const GREY = {
  /** Was 32 words: who a published version reaches, and why one is never edited. *ⓘ · ⓘ · Show.* */
  newVersions: 'New versions apply to new hires only.',
  /** Was the prototype's 27-word toolbar sentence, the AUTO badge's explanation. *Remove · ⓘ · Show.* */
  linkedItems: 'Linked items complete automatically.',
} as const;

export default function ActivationChecklistPage() {
  const canWrite = useCan('tenant_config:write');
  // The screen's own gate (P18.5-T3): a field member meets the refusal, and nothing is asked for them.
  const canRead = useCan('activation_settings:read');
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
  /*
   * **On a phone, ↑ and ↓ beside each handle** (P18.97-T7 AC-6, ADR-0178 §5; UI-040): a drag never starts on a touch
   * screen and its handle's keys need a keyboard, so the list could not be reordered there at all. They move a row
   * through the same `move` the handle's keys do; and below 768px every control here is a 44 × 44px target.
   */
  const phone = usePhone();

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

  useEffect(() => { if (canRead) void load(); }, [load, canRead]);

  const links = resolvedLinks(server);
  const bound = boundLinks(server);

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
        /* As on Activity types: without `data-row` the drag image is the handle button, not the
           section — `DragHandle` looks for `closest('li, [data-row]')` and finds neither here. */
        data-row={aspect.code}
        className={[
          'p-0',
          over === aspect.code ? 'ring-2 ring-amber' : '',
          dragging?.aspect === aspect.code && dragging.item === undefined ? 'opacity-40' : '',
        ].filter(Boolean).join(' ')}
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
              className={cn(DRAG_HANDLE_CLASS, TAP_TARGET)}
              onPick={() => setDragging({ aspect: aspect.code })}
              onDrop={() => { setDragging(null); setOver(null); }}
              onMove={(by) => change({ aspects: move(draft!.aspects, at, at + by) })}
            />
          )}
          {/* Not while its name is being edited: the field takes the line, and a name is not an order. */}
          {canWrite && phone && editing !== `aspect-${aspect.code}` && (
            <ReorderArrows
              label={aspect.label}
              index={at}
              count={draft!.aspects.length}
              disabled={busy}
              onMove={(by) => change({ aspects: move(draft!.aspects, at, at + by) })}
            />
          )}
          {editing === `aspect-${aspect.code}` ? (
            /* Renameable, which it was not: a typo in an aspect's name could only be fixed by
               removing the aspect and every item under it. */
            <FieldRow className="min-w-0 flex-1">
              <CodeField
                id={`code-aspect-${aspect.code}`}
                value={aspect.code}
                reason="Every hire's progress on this aspect points at it."
                inputClassName={CONTROL_PHONE}
              />
              <Field label="Name" htmlFor={`aspect-name-${aspect.code}`} className="min-w-60 flex-1">
                <TextInput
                  id={`aspect-name-${aspect.code}`}
                  value={editLabel}
                  disabled={busy}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className={CONTROL_PHONE}
                />
              </Field>
              <FieldRow.Actions>
                <Button
                  disabled={busy || !editLabel.trim()}
                  className={CONTROL_PHONE}
                  onClick={() => {
                    patchAspect(aspect.code, { label: editLabel.trim() });
                    setEditing(null);
                  }}
                >
                  Save
                </Button>
                <Button variant="secondary" disabled={busy} className={CONTROL_PHONE} onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </FieldRow.Actions>
            </FieldRow>
          ) : (
            <h2 className="font-display text-lg font-bold text-navy">{aspect.label}</h2>
          )}
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <ConfigBadge tone={aspect.items.length > 0 ? 'won' : 'open'}>
              {aspect.items.length} {aspect.items.length === 1 ? 'item' : 'items'}
            </ConfigBadge>
            {canWrite && editing !== `aspect-${aspect.code}` && (
              <>
                <Button
                  variant="inline"
                  onClick={() => {
                    setEditing(`aspect-${aspect.code}`);
                    setEditLabel(aspect.label);
                  }}
                >
                  Rename
                </Button>
                <Button
                  variant="secondary"
                  className={CONTROL_PHONE}
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
            // P18.96-T7 G2: completes from the office's data, by its code — drawn so, and not re-linked here.
            const data = item.autoLink === null ? bound.get(item.code) : undefined;
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
                    className={cn(DRAG_HANDLE_CLASS, TAP_TARGET)}
                    onPick={() => setDragging({ aspect: aspect.code, item: item.code })}
                    onDrop={() => { setDragging(null); setOver(null); }}
                    onMove={(by) => patchAspect(aspect.code, {
                      items: move(aspect.items, index, index + by),
                    })}
                  />
                )}
                {canWrite && phone && editing !== item.code && (
                  <ReorderArrows
                    label={item.label}
                    index={index}
                    count={aspect.items.length}
                    disabled={busy}
                    onMove={(by) => patchAspect(aspect.code, {
                      items: move(aspect.items, index, index + by),
                    })}
                  />
                )}

                <div className="min-w-0 flex-1">
                  {editing === item.code ? (
                    <div className="flex flex-col gap-2">
                      <CodeField
                        id={`code-item-code-${item.code}`}
                        value={item.code}
                        reason="Every hire's progress on this item points at it."
                        inputClassName={CONTROL_PHONE}
                      />
                      <FieldRow>
                        <Field label="Item" htmlFor={`label-${item.code}`} className="min-w-60 flex-1">
                          <TextInput
                            id={`label-${item.code}`}
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className={CONTROL_PHONE}
                          />
                        </Field>
                        <FieldRow.Actions>
                          <Button
                            disabled={!editLabel.trim()}
                            className={CONTROL_PHONE}
                            onClick={() => {
                              patchItem(aspect.code, item.code, { label: editLabel.trim() });
                              setEditing(null);
                            }}
                          >
                            Save
                          </Button>
                          <Button variant="secondary" className={CONTROL_PHONE} onClick={() => setEditing(null)}>Cancel</Button>
                        </FieldRow.Actions>
                      </FieldRow>
                    </div>
                  ) : (
                    /* The item and nothing under it, as the prototype draws the row
                       (`KPM_Owner.html:1530-1560`): the badge says whether its link works, and the
                       select beside it what it completes from. The sub-line that was here said when
                       the link would start working, by phase number (P10.1-T2 AC-13). */
                    <p className="text-md text-navy">{item.label}</p>
                  )}
                </div>

                {data && <LinkBadge link={data} />}
                {item.autoLink !== null && links.has(item.autoLink) && (
                  <LinkBadge link={links.get(item.autoLink)!} />
                )}

                {canWrite && editing !== item.code && (
                  /* Wraps rather than holding its width: the select alone is wider than half a
                     phone, and a row that cannot shrink pushes the whole page sideways. */
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <Field label="Completes from" htmlFor={`link-${item.code}`} className="min-w-44 flex-1">
                      {data ? (
                        /* The same select, holding the one thing it completes from and offering nothing else: the
                           Owner reads it as data-backed, where *No link (manual)* said a leader ticks it (G2). */
                        <Select id={`link-${item.code}`} value={data.kind} disabled onChange={() => undefined} className={CONTROL_PHONE}>
                          <option value={data.kind}>{OWN_COPY.fromData(data.label)}</option>
                        </Select>
                      ) : (
                        <Select
                          id={`link-${item.code}`}
                          value={item.autoLink ?? ''}
                          disabled={busy}
                          className={CONTROL_PHONE}
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
                      )}
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
          <FieldRow className="border-t border-hairline px-4 py-3 sm:px-5">
            <Field label="Item" htmlFor="new-item-label" className="min-w-60 flex-1">
              <TextInput
                id="new-item-label"
                className={CONTROL_PHONE}
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
                className={CONTROL_PHONE}
                value={entry.code}
                onChange={(e) => setEntry((d) => ({
                  ...d, code: e.target.value.toUpperCase(), codeTouched: e.target.value !== '',
                }))}
              />
            </Field>
            <FieldRow.Actions>
              <Button
                disabled={!entry.label.trim() || !entry.code.trim()}
                className={CONTROL_PHONE}
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
              <Button variant="secondary" className={CONTROL_PHONE} onClick={() => setAddingTo(null)}>Cancel</Button>
            </FieldRow.Actions>
          </FieldRow>
        )}
      </Card>
    );
  }

  return (
    <SettingsScreen
      title="Activation checklist"
      subtitle="What every new hire works through in their first 90 days."
      // The office's administration's own read since P18.5-T3 (as `training_settings:read`): a field member typing
      // the address meets the permission-denied state rather than a page of failed reads.
      permission="activation_settings:read"
      error={error}
      toolbar={{
        /* The prototype's own sentence, the whole explanation of the AUTO badge, in the client's words: shown from
           1024px, an ⓘ in its place at 768–1023px, and nothing on a phone — each AUTO badge says what it waits for. */
        hint: (
          <>
            <span className={SHOWN_FROM_DESKTOP}>{GREY.linkedItems}</span>
            <BelowDesktopTip text={GREY.linkedItems} onPhone="remove" />
          </>
        ),
        actions: (
          <>
            {canWrite && draft && !addingAspect && (
              <Button className={CONTROL_PHONE} onClick={() => {
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
              ) : server.draft === null ? (
                /*
                 * Neither a version nor a starting point: an office started from a source that held
                 * no checklist (ADR-0115 §8). Its Owner authors the first aspect from nothing; until
                 * a version is published nobody has an activation.
                 */
                <>
                  Nothing is published yet, so no hire has been given a checklist. Add its first
                  aspect, save it, then publish <strong>version 1</strong>.
                </>
              ) : (
                <>
                  Nothing is published yet, so no hire has been given a checklist. What you are
                  looking at is the <strong>standard checklist</strong>, ready to edit — save it, then
                  publish version 1.
                </>
              )}
              {/* Below 1024px the sentence under this one is its ⓘ, beside the version it is about (P18.97-T4 AC-6). */}
              <BelowDesktopTip text={GREY.newVersions} className="ml-1" />
            </p>
            <p className={cn('mt-2 text-md text-muted', SHOWN_FROM_DESKTOP)}>{GREY.newVersions}</p>
            {/* The one setting this screen shows and does not own. It used to end "— change it in
                Branch info", linking there; Branch info has no window field and no screen edits
                the window, so the sentence states the fact and points nowhere (X-45). */}
            <p className="mt-2 text-sm text-muted">
              The window is <strong className="text-navy">{server.windowDays} days</strong>.
            </p>

            {canWrite && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {/* The starting point is savable as it stands: saving it is what makes the office
                    have a checklist at all. */}
                <Button
                  className={CONTROL_PHONE}
                  disabled={busy || draft.aspects.length === 0
                    || (!dirty && (hasDraft || server.published !== null))}
                  onClick={() => void run(() => saveActivationDraft(draft))}
                >
                  {busy ? 'Saving…' : 'Save draft'}
                </Button>
                <Button
                  variant="secondary"
                  className={CONTROL_PHONE}
                  disabled={busy || dirty || !hasDraft}
                  title={dirty ? 'Save the draft first.' : undefined}
                  onClick={() => void run(publishActivationChecklist)}
                >
                  Publish version {version}
                </Button>
                {dirty && (
                  <Button
                    variant="secondary"
                    className={CONTROL_PHONE}
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
              <FieldRow className="mt-3">
                <Field label="Aspect" htmlFor="new-aspect-label" className="min-w-60 flex-1">
                  <TextInput
                    id="new-aspect-label"
                    className={CONTROL_PHONE}
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
                    className={CONTROL_PHONE}
                    value={entry.code}
                    onChange={(e) => setEntry((d) => ({
                      ...d, code: e.target.value.toUpperCase(), codeTouched: e.target.value !== '',
                    }))}
                  />
                </Field>
                <Field label="Its first item" htmlFor="new-aspect-item" className="min-w-60 flex-1">
                  <TextInput
                    id="new-aspect-item"
                    className={CONTROL_PHONE}
                    value={entry.first}
                    onChange={(e) => setEntry((d) => ({ ...d, first: e.target.value }))}
                  />
                </Field>
              </FieldRow>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={!entry.label.trim() || !entry.code.trim() || !entry.first.trim()}
                  className={CONTROL_PHONE}
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
                <Button variant="secondary" className={CONTROL_PHONE} onClick={() => setAddingAspect(false)}>Cancel</Button>
              </div>
            </Card>
          )}

          {draft.aspects.length === 0 && !addingAspect && (
            <Card>
              <EmptyState title="This office has no activation checklist yet." />
            </Card>
          )}
          {draft.aspects.map((aspect, at) => aspectCard(aspect, at))}
        </div>
      )}
    </SettingsScreen>
  );
}
