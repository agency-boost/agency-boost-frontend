'use client';

import { useCallback, useEffect, useState } from 'react';
import { SettingsScreen } from '@/components/settings-screen';
import { SettingsReviewed } from '@/components/settings-reviewed';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { DragHandle } from '@/components/ui/drag-handle';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, Card, CodeField, Field, FieldRow, Select, TextInput,
} from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { CONTROL_PHONE } from '@/components/ui/phone';
import { ReorderArrows } from '@/components/ui/reorder-arrows';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { SkeletonCards } from '@/components/ui/skeleton';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { kept } from '@/i18n/kept';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { settingsMessages } from '@/i18n/messages/settings';
import { checklistMessages } from '@/i18n/messages/settings-checklist';
import { uiMessages } from '@/i18n/messages/ui';
import { aspectTitle, autoBadge, byHandBadge, fromDataWords } from '@/lib/activation';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { suggestCode } from '@/lib/config-code';
import { formatNumber } from '@/lib/format';
import { useCan } from '@/lib/session';
import { usePhone } from '@/lib/use-phone';
import {
  listTraining, publishActivationChecklist, publishConfig, readActivationChecklist, saveActivationDraft,
  type ActivationChecklist, type ActivationDraft, type ActivationLink, type ActivationVersion,
  type TrainingCategoryRow,
} from '@/lib/tenant-config';
import { HANDLE_TOUCH, TEXT_BUTTON_TOUCH } from '../settings-touch';

/** The link options the prototype's select offers, plus the office's own published modules: §A.2's titles, kept. */
const FEATURE_LINKS = [
  { value: 'feature:goals', label: kept('Goal Settings') },
  { value: 'feature:leads', label: kept('Leads Management') },
  { value: 'feature:activity', label: kept('Activity Management') },
];

/** What an item's line names as its source, as the 19 November card names it (mockup f16): the feature's menu name. */
const FEATURE_SOURCE: Record<string, string> = {
  'feature:goals': kept('Goal Setting'),
  'feature:leads': kept('Leads'),
  'feature:activity': kept('Activity'),
};

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
 * What the server resolved each link to — its words and **whether it works** (`live`) — by kind, from every item it
 * answered with. A link chosen here and not saved yet is in neither, and stays unresolved until *Simpan draf* answers.
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
 * **The data-backed items, by code** (P18.8-T7 G2; ADR-0171 §3): they store no link — their kind is bound by their
 * code — and the server serves each its kind as `link`, carrying its `form`. Nothing here knows which codes are bound.
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
 * The badge saying **whether** a link completes the item (P13-T3 AC-1, ADR-0062 §3; parity I-80): *Auto* for a link
 * that works, *Ticked by hand* for one that does not — never when. Since P19.21 it stands in the item's sheet, and on
 * the card only beside a link that does not work, so the line *"Selesai otomatis dari: …"* never claims what is not so.
 */
function LinkBadge({ link }: { link: ActivationLink }) {
  const language = useLanguage();
  const auto = autoBadge(link.completesWhen, language);
  const byHand = byHandBadge(language);
  return link.live ? (
    <TippedGlyph
      glyph={auto.glyph}
      name={auto.name}
      tip={auto.tip}
      align="fit"
      face={cn(BADGE_FACE, 'bg-success/10 text-success hover:bg-success/15 hover:text-success')}
    />
  ) : (
    <TippedGlyph
      glyph={byHand.glyph}
      name={byHand.name}
      tip={byHand.tip}
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

/** The orange *+ Tambah item* line at a card's foot (mockup f16), 44px tall below 1024px. */
const ADD_LINE = cn(
  'inline-flex items-center gap-1.5 text-md font-bold text-primary-ink hover:underline disabled:opacity-40',
  TEXT_BUTTON_TOUCH,
);

/**
 * The office's 90-day activation checklist (P5-T3) — **drawn as the client's 19 November card** (P19.21-T3 AC-3;
 * mockup `data-upload-pengaturan-*` f16, ADR-0274).
 *
 * - **The note** under *‹ Pengaturan*: *"New hire mendapat versi 1 · 90 hari. Perubahan menjadi versi baru, hanya untuk
 *   new hire berikutnya."* — the published version and the office's window, read from the server.
 * - **The aspects as white cards**, two side by side from 768px: *"1. Introduction"*, *"4 item"*, a ⋯ (*Ganti nama ·
 *   Naikkan · Turunkan · Hapus*); each item ⠿, its name and *"Selesai otomatis dari: …"* — a feature, a module, the
 *   office's data, or *manual*; *+ Tambah item* at the foot. An item opens its sheet: its code read-only, its name,
 *   *Diselesaikan dari* (the select), its badge, ↑ ↓ and *Hapus*.
 * - **The orange bar only while there is a draft** (the frame's bar; *"Draf. Agent masih memakai versi n."* with
 *   *Simpan draf* and *Terbitkan ke agent*). **The checklist publishes on its own** (ADR-0031): a version is what a
 *   hire's activation pins, so this bar is the activation module's draft, not the office's snapshot.
 *
 * **A published version is never edited.** Editing writes a draft; publishing turns that draft into the next version,
 * given to hires who start after it. Somebody halfway through their ninety days keeps the checklist they started on.
 */
export default function ActivationChecklistPage() {
  const t = useMessages(checklistMessages);
  const language = useLanguage();
  const s = useMessages(settingsMessages);
  const u = useMessages(uiMessages);
  const figures = useFigureLanguage();
  const canWrite = useCan('tenant_config:write');
  // The screen's own gate (P18.2-T3): a field member meets the refusal, and nothing is asked for them.
  const canRead = useCan('activation_settings:read');
  /** On a phone a drag never starts: ↑ ↓ beside an aspect's ⠿ (P18.9-T7 AC-6). */
  const phone = usePhone();
  const [server, setServer] = useState<ActivationChecklist | null>(null);
  const [draft, setDraft] = useState<ActivationDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [modules, setModules] = useState<TrainingCategoryRow[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addingAspect, setAddingAspect] = useState(false);
  const [entry, setEntry] = useState({ label: '', code: '', codeTouched: false, first: '' });
  const [dragging, setDragging] = useState<{ aspect: string; item?: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /** The item, the aspect, or the new item a sheet holds, with what it edits until *Simpan*. */
  const [itemSheet, setItemSheet] = useState<{ aspect: string; code: string; label: string; autoLink: string | null } | null>(null);
  const [aspectSheet, setAspectSheet] = useState<{ code: string; label: string } | null>(null);
  const [addSheet, setAddSheet] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [checklist, tree] = await Promise.all([readActivationChecklist(), listTraining()]);
      setServer(checklist);
      // Never assumed: an office whose database has not had the checklist seeded answers with neither.
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
  const offered = modules.flatMap((c) => c.skills.flatMap((sk) => sk.modules))
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

    // An item stays in its own aspect: moving it elsewhere is a different decision.
    if (held.aspect !== target.aspect) return;
    const items = draft.aspects.find((a) => a.code === held.aspect)!.items;
    const from = items.findIndex((i) => i.code === held.item);
    const to = items.findIndex((i) => i.code === target.item);
    if (from < 0 || to < 0 || from === to) return;
    patchAspect(held.aspect, { items: move(items, from, to) });
  }

  /** Where an item completes from, as its line names it (mockup f16): the office's data, a feature, a module, *manual*. */
  function sourceOf(item: DraftItem): { words: string; link: ActivationLink | null } {
    if (item.autoLink === null) {
      const data = bound.get(item.code);
      return data ? { words: data.label, link: data } : { words: t.manual, link: null };
    }
    const link = links.get(item.autoLink) ?? null;
    if (item.autoLink.startsWith('feature:')) {
      return { words: FEATURE_SOURCE[item.autoLink] ?? link?.label ?? item.autoLink, link };
    }
    if (item.autoLink.startsWith('training:')) {
      const code = item.autoLink.slice('training:'.length);
      const title = offered.find((m) => m.code === code)?.title ?? link?.label ?? code;
      return { words: `${kept('Training')} › ${title}`, link };
    }
    return { words: link?.label ?? item.autoLink, link };
  }

  function aspectCard(aspect: DraftAspect, at: number) {
    const aspects = draft!.aspects;
    const menu: ActionMenuItem[] = [
      { label: s.rename, onSelect: () => setAspectSheet({ code: aspect.code, label: aspect.label }) },
      {
        label: u.moveUp({ label: aspect.label }),
        disabled: busy || at === 0,
        onSelect: () => change({ aspects: move(aspects, at, at - 1) }),
      },
      {
        label: u.moveDown({ label: aspect.label }),
        disabled: busy || at === aspects.length - 1,
        onSelect: () => change({ aspects: move(aspects, at, at + 1) }),
      },
      {
        label: s.remove,
        tone: 'alert',
        disabled: busy || aspects.length === 1,
        reason: aspects.length === 1 ? t.oneAspect : undefined,
        hint: aspects.length === 1 ? undefined : t.removesAspect({ name: aspect.label, n: aspect.items.length }),
        onSelect: () => change({ aspects: aspects.filter((a) => a.code !== aspect.code) }),
      },
    ];
    return (
      <section
        key={aspect.code}
        aria-labelledby={`aspect-${aspect.code}`}
        // `DragHandle` lifts the closest `li, [data-row]` as the drag image.
        data-row={aspect.code}
        className={cn(
          'overflow-hidden rounded-lg border border-card-edge bg-card',
          over === aspect.code && 'ring-2 ring-primary',
          dragging?.aspect === aspect.code && dragging.item === undefined && 'opacity-40',
        )}
        onDragOver={(e) => {
          if (!dragging || dragging.item !== undefined) return;
          e.preventDefault();
          setOver(aspect.code);
        }}
        onDragLeave={() => setOver((now) => (now === aspect.code ? null : now))}
        onDrop={(e) => { e.preventDefault(); drop({ aspect: aspect.code }); }}
      >
        <div className="flex items-center gap-2 border-b border-divider px-4 py-3">
          {canWrite && (
            <DragHandle
              label={aspect.label}
              disabled={busy}
              className={HANDLE_TOUCH}
              onPick={() => setDragging({ aspect: aspect.code })}
              onDrop={() => { setDragging(null); setOver(null); }}
              onMove={(by) => change({ aspects: move(aspects, at, at + by) })}
            />
          )}
          <h2 id={`aspect-${aspect.code}`} className="min-w-0 flex-1 font-display text-md font-bold text-navy">
            {/* The position, then the name: a label typed with its own number keeps one (`aspectTitle`). */}
            {`${formatNumber(at + 1, {}, figures)}. ${aspectTitle(aspect.label)}`}
          </h2>
          <span className="shrink-0 text-sm text-muted">{s.items({ n: aspect.items.length })}</span>
          {canWrite && phone && (
            <ReorderArrows
              label={aspect.label}
              index={at}
              count={aspects.length}
              disabled={busy}
              onMove={(by) => change({ aspects: move(aspects, at, at + by) })}
            />
          )}
          {canWrite && <ActionMenu glyph="⋯" label={s.actionsFor({ name: aspect.label })} items={menu} />}
        </div>

        <ul className="flex flex-col">
          {aspect.items.map((item, index) => {
            const source = sourceOf(item);
            return (
              <li
                key={item.code}
                data-item={item.code}
                className={cn(
                  'flex items-center gap-2 border-b border-divider px-4 py-2',
                  over === item.code && 'bg-base',
                  dragging?.item === item.code && 'opacity-40',
                )}
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
                    className={HANDLE_TOUCH}
                    onPick={() => setDragging({ aspect: aspect.code, item: item.code })}
                    onDrop={() => { setDragging(null); setOver(null); }}
                    onMove={(by) => patchAspect(aspect.code, { items: move(aspect.items, index, index + by) })}
                  />
                )}
                <button
                  type="button"
                  aria-haspopup="dialog"
                  className="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center text-left"
                  onClick={() => setItemSheet({
                    aspect: aspect.code, code: item.code, label: item.label, autoLink: item.autoLink,
                  })}
                >
                  <span className="text-md font-semibold text-navy">{item.label}</span>
                  <span className="text-sm text-muted">{t.completesFromLine({ source: source.words })}</span>
                </button>
                {/* Data honesty: a link that does not work says *Dicentang manual*, beside the line naming it. */}
                {source.link && !source.link.live && <LinkBadge link={source.link} />}
              </li>
            );
          })}
        </ul>

        {canWrite && (
          <div className="px-4 py-2.5">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={t.addItemTo({ name: aspect.label })}
              className={ADD_LINE}
              onClick={() => {
                setAddSheet(aspect.code);
                setEntry({ label: '', code: '', codeTouched: false, first: '' });
              }}
            >
              <LineIcon name="plus" className="h-4 w-4" />
              {t.addItem.replace(/^\+\s*/, '')}
            </button>
          </div>
        )}
      </section>
    );
  }

  /**
   * **The sheets** (P19.2-T3 AC-3, at every width since P19.21): an item's — its badge, its code, its name, *Diselesaikan
   * dari* (the select), ↑ ↓ and *Hapus*, *Simpan* pinned; an aspect's name; a new item. Each changes the draft, and the
   * bar's *Simpan draf* saves it.
   */
  function sheets() {
    const aspects = draft!.aspects;
    const sheetAspect = itemSheet ? aspects.find((a) => a.code === itemSheet.aspect) ?? null : null;
    const index = sheetAspect && itemSheet ? sheetAspect.items.findIndex((i) => i.code === itemSheet.code) : -1;
    const sheetItem = sheetAspect && index >= 0 ? sheetAspect.items[index] : null;
    const data = sheetItem && sheetItem.autoLink === null ? bound.get(sheetItem.code) : undefined;
    const adding = addSheet === null ? null : aspects.find((a) => a.code === addSheet) ?? null;
    return (
      <>
        <ResponsiveSheet
          open={itemSheet !== null && sheetItem !== null}
          title={sheetItem?.label ?? ''}
          onClose={() => setItemSheet(null)}
          footer={canWrite && itemSheet && sheetAspect ? (
            <Button
              className="w-full"
              disabled={!itemSheet.label.trim()}
              onClick={() => {
                patchItem(sheetAspect.code, itemSheet.code, { label: itemSheet.label.trim(), autoLink: itemSheet.autoLink });
                setItemSheet(null);
              }}
            >
              {s.save}
            </Button>
          ) : undefined}
        >
          {itemSheet && sheetAspect && sheetItem && (
            <div className="flex flex-col gap-3 pb-2">
              {(data || (sheetItem.autoLink !== null && links.has(sheetItem.autoLink))) && (
                <p>{data ? <LinkBadge link={data} /> : <LinkBadge link={links.get(sheetItem.autoLink!)!} />}</p>
              )}
              <CodeField id={`code-item-code-${sheetItem.code}`} value={sheetItem.code} reason={t.itemReason} />
              <Field label={s.item} htmlFor={`label-${sheetItem.code}`}>
                <TextInput
                  id={`label-${sheetItem.code}`}
                  value={itemSheet.label}
                  disabled={!canWrite}
                  onChange={(e) => setItemSheet({ ...itemSheet, label: e.target.value })}
                />
              </Field>
              <Field label={t.completesFrom} htmlFor={`link-${sheetItem.code}`}>
                {data ? (
                  /* The one thing it completes from, offering nothing else: data-backed, never *manual* (G2). */
                  <Select id={`link-${sheetItem.code}`} value={data.kind} disabled onChange={() => undefined}>
                    <option value={data.kind}>{fromDataWords(data.label, language)}</option>
                  </Select>
                ) : (
                  <Select
                    id={`link-${sheetItem.code}`}
                    value={itemSheet.autoLink ?? ''}
                    disabled={busy || !canWrite}
                    onChange={(e) => setItemSheet({ ...itemSheet, autoLink: e.target.value === '' ? null : e.target.value })}
                  >
                    <option value="">{t.noLink}</option>
                    <optgroup label={t.feature}>
                      {FEATURE_LINKS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </optgroup>
                    <optgroup label={t.trainingModule}>
                      {offered.map((m) => <option key={m.code} value={`training:${m.code}`}>{m.title}</option>)}
                    </optgroup>
                  </Select>
                )}
              </Field>
              {canWrite && (
                <div className="flex flex-wrap items-center gap-2">
                  <ReorderArrows
                    label={sheetItem.label}
                    index={index}
                    count={sheetAspect.items.length}
                    disabled={busy}
                    onMove={(by) => patchAspect(sheetAspect.code, { items: move(sheetAspect.items, index, index + by) })}
                  />
                  <span className="ml-auto">
                    <Button
                      variant="inlineDanger"
                      disabled={busy || sheetAspect.items.length === 1}
                      title={sheetAspect.items.length === 1 ? t.oneItem : undefined}
                      onClick={() => {
                        patchAspect(sheetAspect.code, { items: sheetAspect.items.filter((i) => i.code !== sheetItem.code) });
                        setItemSheet(null);
                      }}
                    >
                      {s.remove}
                    </Button>
                  </span>
                </div>
              )}
            </div>
          )}
        </ResponsiveSheet>

        <ResponsiveSheet
          open={aspectSheet !== null}
          title={s.rename}
          onClose={() => setAspectSheet(null)}
          footer={aspectSheet ? (
            <Button
              className="w-full"
              disabled={!aspectSheet.label.trim()}
              onClick={() => {
                patchAspect(aspectSheet.code, { label: aspectSheet.label.trim() });
                setAspectSheet(null);
              }}
            >
              {s.save}
            </Button>
          ) : undefined}
        >
          {aspectSheet && (
            <div className="flex flex-col gap-3 pb-2">
              <CodeField id={`code-aspect-${aspectSheet.code}`} value={aspectSheet.code} reason={t.aspectReason} />
              <Field label={s.name} htmlFor={`aspect-name-${aspectSheet.code}`}>
                <TextInput
                  id={`aspect-name-${aspectSheet.code}`}
                  value={aspectSheet.label}
                  onChange={(e) => setAspectSheet({ ...aspectSheet, label: e.target.value })}
                />
              </Field>
            </div>
          )}
        </ResponsiveSheet>

        <ResponsiveSheet
          open={adding !== null}
          title={t.addItem.replace(/^\+\s*/, '')}
          description={adding?.label}
          onClose={() => setAddSheet(null)}
          footer={adding ? (
            <Button
              className="w-full"
              disabled={!entry.label.trim() || !entry.code.trim()}
              onClick={() => {
                patchAspect(adding.code, {
                  items: [...adding.items, { code: entry.code.trim(), label: entry.label.trim(), autoLink: null }],
                });
                setAddSheet(null);
              }}
            >
              {s.add}
            </Button>
          ) : undefined}
        >
          {adding && (
            <div className="flex flex-col gap-3 pb-2">
              <Field label={s.item} htmlFor="new-item-label">
                <TextInput
                  id="new-item-label"
                  value={entry.label}
                  onChange={(e) => setEntry((d) => ({
                    ...d, label: e.target.value, code: d.codeTouched ? d.code : suggestCode(e.target.value),
                  }))}
                />
              </Field>
              <Field label={s.code} htmlFor="new-item-code" hint={t.itemCodeHint}>
                <TextInput
                  id="new-item-code"
                  value={entry.code}
                  onChange={(e) => setEntry((d) => ({
                    ...d, code: e.target.value.toUpperCase(), codeTouched: e.target.value !== '',
                  }))}
                />
              </Field>
            </div>
          )}
        </ResponsiveSheet>
      </>
    );
  }

  const undo = () => {
    const current = server!.draft ?? server!.published;
    setDraft(current ? toDraft(current) : { aspects: [] });
    setDirty(false);
  };

  /**
   * **The orange bar, only while a draft waits** (P19.21-T2 AC-3 for this page; mockup f12's *pubBar*): what agents are
   * still on, then *Simpan draf* while there are edits, *Terbitkan ke agent* once the draft is saved. The starting point
   * an office has never saved is a draft too: saving it is what gives the office a checklist at all.
   */
  const draftBar = server !== null && draft !== null && canWrite && (dirty || hasDraft || server.published === null) ? (
    <div
      role="status"
      data-draft-bar=""
      className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-primary-50 p-3"
    >
      <LineIcon name="alert" className="h-5 w-5 shrink-0 text-primary-ink" />
      <p className="min-w-0 flex-1 text-md text-navy">
        <strong>{t.draftWord}</strong>{' '}
        {server.published ? t.stillOn({ version: server.published.version }) : t.noneYet}
      </p>
      {dirty && (
        <Button variant="inline" disabled={busy} className={TEXT_BUTTON_TOUCH} onClick={undo}>{t.undoEdits}</Button>
      )}
      {saved && !dirty && <span className="text-md font-semibold text-success">{s.saved}</span>}
      <Button
        variant="secondary"
        className={CONTROL_PHONE}
        disabled={busy || draft.aspects.length === 0 || (!dirty && (hasDraft || server.published !== null))}
        onClick={() => void run(() => saveActivationDraft(draft))}
      >
        {busy ? s.saving : t.saveDraft}
      </Button>
      <Button
        className={CONTROL_PHONE}
        disabled={busy || dirty || !hasDraft}
        title={dirty ? t.saveDraftFirst : t.publishVersion({ n: version })}
        // P19.21-T2 (ADR-0274 §5): the version first, then the snapshot's checklist section, so the hub's
        // *Belum diterbitkan* clears with one press — the second call publishes no draft, there is none left.
        onClick={() => void run(async () => {
          const published = await publishActivationChecklist();
          await publishConfig(['activation_checklist']);
          return published;
        })}
      >
        {t.publishToAgents}
      </Button>
    </div>
  ) : null;

  return (
    <SettingsScreen
      title={kept('Activation checklist')}
      // P19.3-T2 AC-5 (UI-149, Overview case 0b): *Sudah sesuai*, step 3 of the KPM setup card — the checklist unchanged.
      actions={<SettingsReviewed page="activation-checklist" />}
      // The office's administration's own read since P18.2-T3 (as `training_settings:read`).
      permission="activation_settings:read"
      error={error}
      bars={draftBar}
      toolbar={canWrite && draft && !addingAspect ? {
        actions: (
          <Button
            variant="secondary"
            className={CONTROL_PHONE}
            onClick={() => {
              setAddingAspect(true);
              setEntry({ label: '', code: '', codeTouched: false, first: '' });
            }}
          >
            <LineIcon name="plus" className="h-4 w-4" />
            {t.addAspect.replace(/^\+\s*/, '')}
          </Button>
        ),
      } : undefined}
    >
      {server === null || draft === null ? (
        error ? null : <SkeletonCards count={2} />
      ) : (
        <div className="flex flex-col gap-3">
          {/* The note (mockup f16), from the server: the version hires are given and the window, or how to begin. */}
          <p data-version-note="" className="text-sm text-muted">
            {server.published ? (
              t.note({ version: server.published.version, days: formatNumber(server.windowDays, {}, figures) })
            ) : (
              <>
                {hasDraft ? t.draftOnly({ version: <strong>{t.version({ n: version })}</strong> })
                  : server.draft === null ? t.fromNothing({ version: <strong>{t.version({ n: 1 })}</strong> })
                    : t.fromStandard({ standard: <strong>{t.standardChecklist}</strong> })}
                {' '}
                {t.window({ days: <strong className="text-navy">{t.days({ n: formatNumber(server.windowDays, {}, figures) })}</strong> })}
              </>
            )}
          </p>

          {canWrite && addingAspect && (
            <Card>
              <h2 className="font-display text-lg font-bold text-navy">{t.addAnAspect}</h2>
              <p className="mt-1 text-sm text-muted">{t.aspectLead}</p>
              <FieldRow className="mt-3">
                <Field label={t.aspect} htmlFor="new-aspect-label" className="min-w-60 flex-1">
                  <TextInput
                    id="new-aspect-label"
                    className={CONTROL_PHONE}
                    value={entry.label}
                    onChange={(e) => setEntry((d) => ({
                      ...d, label: e.target.value, code: d.codeTouched ? d.code : suggestCode(e.target.value),
                    }))}
                  />
                </Field>
                <Field label={s.code} htmlFor="new-aspect-code" hint={t.aspectCodeHint} className="min-w-48">
                  <TextInput
                    id="new-aspect-code"
                    className={CONTROL_PHONE}
                    value={entry.code}
                    onChange={(e) => setEntry((d) => ({
                      ...d, code: e.target.value.toUpperCase(), codeTouched: e.target.value !== '',
                    }))}
                  />
                </Field>
                <Field label={t.firstItem} htmlFor="new-aspect-item" className="min-w-60 flex-1">
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
                  {t.addTheAspect}
                </Button>
                <Button variant="secondary" className={CONTROL_PHONE} onClick={() => setAddingAspect(false)}>{s.cancel}</Button>
              </div>
            </Card>
          )}

          {draft.aspects.length === 0 && !addingAspect ? (
            <Card><EmptyState title={t.none} /></Card>
          ) : (
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
              {draft.aspects.map((aspect, at) => aspectCard(aspect, at))}
            </div>
          )}
        </div>
      )}
      {server !== null && draft !== null && sheets()}
    </SettingsScreen>
  );
}
