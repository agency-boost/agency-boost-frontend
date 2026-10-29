'use client';

import React, { useState } from 'react';
import {
  Button, Card, CodeField, ColorInput, Field, FieldRow, Select, Switch, TextInput,
} from '@/components/ui/field';
import {
  benchmarkFromInput, benchmarkToInput, displayUnitLabels, formatBenchmark, reexpress, unitFor,
  type RatioDisplayUnit,
} from '@/lib/ratio-format';
import { ConfigBadge } from '@/components/ui/config-badge';
import { DragHandle } from '@/components/ui/drag-handle';
import { suggestCode } from '@/lib/config-code';
import { formatNumber, formatPercent, formatRupiah, formatRupiahCompact, parseDecimal } from '@/lib/format';
import { planSummaryTile, summaryGroups, summaryTileName } from '@/lib/summary-tiles';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { autoBadge, byHandBadge } from '@/lib/activation';
import type { TemplateLinkKind, TemplateLinkKinds } from '@/lib/admin';
import { ActivityBindingFields } from '@/components/activity-binding-fields';
import { BINDING_ROLE_LABEL, BINDING_ROLES, type ActivityBinding } from '@/lib/activity-binding';
import { kept } from '@/i18n/kept';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { adminTemplateEditorMessages } from '@/i18n/messages/admin-template-editor';
import { activityTypesMessages } from '@/i18n/messages/settings-activity-types';
import { capabilityMessages } from '@/i18n/messages/settings-capability';
import { checklistMessages } from '@/i18n/messages/settings-checklist';
import { leadStatusesMessages } from '@/i18n/messages/settings-lead-statuses';
import { ratioBenchmarksMessages } from '@/i18n/messages/settings-ratio-benchmarks';
import { settingsMessages } from '@/i18n/messages/settings';

export interface TaxonomyPayload {
  categories: {
    code: string; label: string; displayOrder: number;
    /**
     * The summary tile the section counts toward, and its label (ADR-0064). Both or neither, and
     * one label per code across the payload — saving or publishing refuses anything else. Optional
     * because a payload authored before the fields existed carries neither: a tile of its own.
     */
    summaryGroupCode?: string | null;
    summaryGroupLabel?: string | null;
  }[];
  types: {
    code: string; categoryCode: string; label: string;
    description: string | null; displayOrder: number;
  }[];
  /**
   * **Which of its types each cascade role counts** (ADR-0163 §1) — copied into every office made from the
   * template. Absent on a template that never set one: its offices count the default binding. Publishing checks
   * it against the taxonomy it publishes.
   */
  bindings?: ActivityBinding;
}

export interface PipelinePayload {
  statuses: {
    pipeline: 'sales' | 'recruitment'; code: string; label: string;
    rank: number; isTerminal: boolean;
    /**
     * What the KPM Overview counts as *Expected to close* (ADR-0043). Optional on a payload
     * authored before the flag existed; provisioning reads a missing one as `false`.
     */
    isLateStage?: boolean;
  }[];
}

/**
 * The activity taxonomy of a company template (P4-T8).
 *
 * **The same shape the office's own screen edits, and deliberately not the same code
 * path.** `/kpm/settings/activity-types` writes rows in `activityTypes`; this writes a
 * payload that is *copied* into them when an office is created. Sharing a component
 * between the two would mean one form posting to two different contracts, which is how
 * "the same shape" quietly becomes "the same document" — and copy-on-provision depends on
 * them being different documents.
 *
 * What is shared is the vocabulary: a code that never changes, a label that does, and a
 * display order that binds nothing.
 */
/**
 * Reorder a template payload's rows, by pointer or by keyboard.
 *
 * A template's order is what a new office opens with, so it is worth setting here rather
 * than leaving every Owner to redo it. Same handle as the Owner's screens — grab it, or
 * focus it and press ↑/↓ — because the two sides should not teach two gestures for one
 * action.
 *
 * Moving a row edits the **draft in the browser**; nothing is written until *Save draft*.
 * So there is no endpoint here and no whole-list contract: the array in hand is the order.
 */
/**
 * Renumber an ordinal from array position (P4-T24).
 *
 * **Dragging a row here changed nothing that reached an office.** `useRowDrag` reordered
 * the array and no call site recomputed `displayOrder` or `rank`; they were written once,
 * when a row was created. Provisioning copies the ordinal verbatim
 * (`provisioning.service.ts`) and an office reads its taxonomy sorted by it, so a Super
 * Admin dragged rows, published, and every office created afterwards showed the order from
 * before the drag. The circled numbers on screen confirmed the new one.
 *
 * The Owner's screens never had this: their reorder endpoints take the whole ordered id
 * list and renumber server-side. A template payload is a JSON document, so there is no
 * server-side renumber to save it — it has to happen here.
 *
 * `groupOf` because the two ordinals are not the same kind of number. A type's
 * `displayOrder` runs 1–12 across every section (`activity-taxonomy.spec.ts`), while a
 * lead status's `rank` restarts per pipeline — renumbering those in one sequence would
 * hand the recruitment ladder ranks 7–13.
 */
export function withOrdinals<T>(
  rows: T[],
  field: string,
  groupOf: (row: T) => string = () => '',
): T[] {
  const next: Record<string, number> = {};
  return rows.map((row) => {
    const group = groupOf(row);
    next[group] = (next[group] ?? 0) + 1;
    return { ...row, [field]: next[group] };
  });
}

function useRowDrag<T>(
  rows: T[],
  keyOf: (row: T) => string,
  onReorder: (next: T[]) => void,
  /**
   * The ordinal to rewrite after a move. Required, not optional: every one of the four
   * call sites forgot it, and an optional argument would let a fifth forget too.
   *
   * **`'position'` for a list whose order *is* its order** — the activation checklist and the
   * capability grids carry no ordinal at all, because `activation-input.ts` reads
   * *"the position in the list the caller sent"* when it provisions an office. Spelled as a
   * word rather than allowed as `undefined`, so it stays a decision somebody made.
   */
  ordinal: { field: string; groupOf?: (row: T) => string } | 'position',
  /**
   * Whether one row may land on another. Types live in one flat array across every
   * section, so without this a drag into another section would move the row and leave its
   * `categoryCode` behind — the heading would say one thing and the data another.
   * Cross-section moves are excluded here for the same reason they are on the Owner's
   * screen: they change who can log the type, and that deserves a named control.
   */
  canPlace: (from: T, to: T) => boolean = () => true,
) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const place = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    const next = [...rows];
    const from = next.findIndex((r) => keyOf(r) === fromKey);
    const to = next.findIndex((r) => keyOf(r) === toKey);
    if (from < 0 || to < 0 || !canPlace(next[from], next[to])) return;
    next.splice(to, 0, ...next.splice(from, 1));
    onReorder(ordinal === 'position'
      ? next
      : withOrdinals(next, ordinal.field, ordinal.groupOf));
  };

  return {
    dragging,
    over,
    /** Props for the row itself: the drop target and its two visual states. */
    rowProps: (key: string) => ({
      'data-row': key,
      className: `${over === key ? 'bg-canvas' : ''} ${dragging === key ? 'opacity-40' : ''}`,
      onDragOver: (e: React.DragEvent) => {
        if (!dragging) return;
        e.preventDefault();
        setOver(key);
      },
      onDragLeave: () => setOver((now) => (now === key ? null : now)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const held = dragging;
        setDragging(null);
        setOver(null);
        if (held) place(held, key);
      },
    }),
    /** Props for the handle. */
    handleProps: (key: string) => ({
      onPick: () => setDragging(key),
      onDrop: () => { setDragging(null); setOver(null); },
      onMove: (by: -1 | 1) => {
        const at = rows.findIndex((r) => keyOf(r) === key);
        // Step over anything this row may not land on — the next row in its own section,
        // not merely the next row.
        let to = at + by;
        while (to >= 0 && to < rows.length && !canPlace(rows[at], rows[to])) to += by;
        if (at < 0 || to < 0 || to >= rows.length) return;
        place(key, keyOf(rows[to]));
      },
    }),
  };
}

/**
 * A row that reads as text until somebody presses **Edit**.
 *
 * The editors put every value in a live `TextInput`, so a stray keystroke on a focused
 * field changed a preset that seeds every future office of a company — and the draft
 * saved it without anybody noticing the field had been touched. Reading is the common
 * case; editing is the deliberate one, and the screen should be shaped that way round.
 *
 * Matches the Owner's screens, where a row is text with an **Edit** beside it.
 */
function EditableRow({
  rowKey,
  fields,
  values,
  onSave,
  reshape,
  disabled,
  code,
  children,
  badge,
  actions,
}: {
  /**
   * A stable, space-free id for this row — its `code`.
   *
   * The first version built the field ids out of the row's *label*, which contains spaces.
   * `aria-describedby` is a space-separated list of ids, so `label-Submission polis-label-hint`
   * parsed as three ids that did not exist and the hint linked to nothing — the exact
   * defect `Field` had just been fixed for, reintroduced one layer up.
   */
  rowKey: string;
  /**
   * A field with `options` is a select, one with `kind: 'color'` is a picker, and everything
   * else is a text input.
   *
   * A colour field must not be **first**: the Save button reads `fields[0]` to decide whether
   * there is anything to save.
   */
  fields: {
    key: string; label: string; hint?: string; kind?: 'color';
    options?: { value: string; label: string }[];
    /**
     * The id of a `<datalist>` whose names the text input offers — a free field with suggestions,
     * where a select would close off the one value that is new.
     */
    list?: string;
    /** The longest value the server accepts, so a longer one cannot be typed at all. */
    maxLength?: number;
  }[];
  values: Record<string, string>;
  /**
   * Save the row. Returning `{ field, error }` refuses it: the row stays open, and the reason shows
   * at that field — for a refusal the screen can know before anything is sent.
   */
  onSave: (next: Record<string, string>) => void | { field: string; error: string };
  /**
   * Adjust the rest of the draft when one field changes.
   *
   * For a ratio's unit (P4-T25): the benchmark is typed the way it is shown, so switching
   * from a number to a percentage must turn `0.3` into `30` — reinterpreting the same text
   * would save a benchmark a hundred times smaller than the one on screen.
   */
  reshape?: (
    next: Record<string, string>, changed: string, previous: Record<string, string>,
  ) => Record<string, string>;
  disabled?: boolean;
  /** What the row reads as when it is not being edited. */
  children: React.ReactNode;
  /**
   * The row's stable code, shown read-only while editing.
   *
   * It used to arrive as the *hint* of the first field, which put the identity in the small print
   * under the name — a caption on the wrong thing. It is a field of its own now.
   */
  code?: string;
  /**
   * What the row *is*, shown between the text and the controls.
   *
   * A slot rather than something the caller renders inside `children`: `EditableRow` owns the Edit
   * button, so without this a badge could only land before the text or after Edit — and the
   * prototype puts it between them.
   */
  badge?: React.ReactNode;
  /** Row controls that stay available either way. */
  actions?: React.ReactNode;
}) {
  const settings = useMessages(settingsMessages);
  const t = useMessages(adminTemplateEditorMessages);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);
  const [refusal, setRefusal] = useState<{ field: string; error: string } | null>(null);

  if (!editing) {
    return (
      /*
       * **Centred, not top-aligned.** A row whose text runs to two lines put its badge and its
       * buttons level with the first line and left them stranded above the second. The prototype
       * centres its config rows (`KPM_Owner.html:276`) for the same reason.
       */
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {/* Before Edit, as `.config-row` has it: drag → label → badge → actions (`:1501`). */}
        {badge}
        <span className="flex flex-wrap items-center gap-4">
          <Button
            variant="inline"
            disabled={disabled}
            onClick={() => { setDraft(values); setRefusal(null); setEditing(true); }}
          >
            {settings.edit}
          </Button>
          {actions}
        </span>
      </div>
    );
  }

  const id = (key: string) => `${rowKey}-${key}`;

  return (
    <div className="flex flex-col gap-2">
      {code && (
        <CodeField
          id={id('code')}
          value={code}
          reason={t.codeReason}
        />
      )}
      {fields.map((field) => {
        const change = (value: string) => {
          if (refusal?.field === field.key) setRefusal(null);
          const next = { ...draft, [field.key]: value };
          setDraft(reshape ? reshape(next, field.key, draft) : next);
        };
        return (
          <Field
            key={field.key}
            label={field.label}
            htmlFor={id(field.key)}
            hint={field.hint}
            error={refusal?.field === field.key ? refusal.error : undefined}
          >
            {field.options ? (
              <Select
                id={id(field.key)}
                value={draft[field.key] ?? ''}
                disabled={disabled}
                onChange={(e) => change(e.target.value)}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            ) : field.kind === 'color' ? (
              <ColorInput
                id={id(field.key)}
                value={draft[field.key] ?? ''}
                disabled={disabled}
                onChange={change}
              />
            ) : (
              <TextInput
                id={id(field.key)}
                list={field.list}
                maxLength={field.maxLength}
                value={draft[field.key] ?? ''}
                disabled={disabled}
                onChange={(e) => change(e.target.value)}
              />
            )}
          </Field>
        );
      })}
      <span className="flex flex-wrap gap-2">
        <Button
          disabled={disabled || !(draft[fields[0].key] ?? '').trim()}
          onClick={() => {
            const refused = onSave(draft);
            if (refused) {
              setRefusal(refused);
              return;
            }
            setEditing(false);
          }}
        >
          {settings.save}
        </Button>
        <Button variant="secondary" disabled={disabled} onClick={() => setEditing(false)}>
          {settings.cancel}
        </Button>
      </span>
    </div>
  );
}

export function TaxonomyEditor({
  payload,
  onChange,
  disabled,
}: {
  payload: TaxonomyPayload;
  onChange: (next: TaxonomyPayload) => void;
  disabled?: boolean;
}) {
  /*
   * A template that nobody has authored yet arrives as `payload: {}`.
   *
   * The dispatch in the template screen casts each payload with `as unknown as`, which
   * tells TypeScript the arrays are there and cannot check that they are — so an
   * unauthored preset took the whole screen down on `.filter of undefined` rather than
   * rendering as the empty thing it is. Empty is a real state for every one of these.
   */
  const t = useMessages(adminTemplateEditorMessages);
  const settings = useMessages(settingsMessages);
  const office = useMessages(activityTypesMessages);
  const language = useLanguage();
  const categories = payload.categories ?? [];
  const types = payload.types ?? [];

  const patchType = (code: string, fields: Partial<TaxonomyPayload['types'][number]>) => onChange({
    ...payload,
    types: types.map((row) => (row.code === code ? { ...row, ...fields } : row)),
  });

  const drag = useRowDrag(
    types,
    (row) => row.code,
    (next) => onChange({ ...payload, types: next }),
    // 1–12 across every section, not 1–n within each: the seeded taxonomy is numbered
    // that way and `activity-taxonomy.spec.ts` pins it.
    { field: 'displayOrder' },
    (from, to) => from.categoryCode === to.categoryCode,
  );
  const sectionDrag = useRowDrag(
    categories,
    (c) => c.code,
    (next) => onChange({ ...payload, categories: next }),
    { field: 'displayOrder' },
  );

  return (
    <div className="flex flex-col gap-4">
      {/*
        * The section control is a toolbar, not the grid's last cell.
        *
        * It was a bare unlabelled `Card` sitting after the five sections, so in a
        * two-column grid it read as a sixth section that had failed to load — below the
        * fold, and captioned with a phrase differing from its five neighbours only in its
        * last two words. The Super Admin's report was that adding a section was not
        * possible; it was possible and unfindable, which amounts to the same thing.
        */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {t.taxonomyCount({ types: types.length, sections: categories.length })}
        </p>
        <AddRow
          bare
          disabled={disabled}
          noun="section"
          onAdd={(code, label) => onChange({
            ...payload,
            categories: withOrdinals(
              [...categories, { code, label, displayOrder: 0 }],
              'displayOrder',
            ),
          })}
        />
      </div>

      {/* The tiles a section can join, offered by every section's *Summary tile* field. */}
      <datalist id="template-summary-tile-names">
        {summaryGroups(categories).map((group) => (
          <option key={group.code} value={group.label} />
        ))}
      </datalist>

      {/* `acttype-grid`: two columns, one per section, collapsing at the prototype's own
          760px — the same shape the Owner's screen uses, because a Super Admin filling a
          template is looking at what an Owner will see. */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
      {categories.map((category) => {
        const mine = types.filter((type) => type.categoryCode === category.code);
        const { className, ...rowProps } = sectionDrag.rowProps(category.code);
        return (
          <Card key={category.code} {...rowProps} className={className}>
            {/* `ml-auto` on the meta group, not `justify-between` on the row: three
                children spread, and the heading ended up floating mid-card instead of
                sitting hard left the way the prototype's `.acttype-card-head` does. */}
            <div className="flex flex-wrap items-baseline gap-2">
              <DragHandle
                label={category.label}
                disabled={disabled}
                {...sectionDrag.handleProps(category.code)}
              />
              <div className="min-w-0 flex-1">
                {/*
                  * **The summary tile is one more field in the section's own edit** (ADR-0064,
                  * ADR-0062 §2), the same field the Owner has, so a template is authored in the
                  * terms an office will edit it in. Both stored fields are always written.
                  */}
                <EditableRow
                  rowKey={`section-${category.code}`}
                  disabled={disabled}
                  code={category.code}
                  fields={[
                    { key: 'label', label: settings.name },
                    {
                      key: 'tile',
                      label: office.summaryTile,
                      hint: office.summaryTileHint,
                      list: 'template-summary-tile-names',
                      maxLength: 80,
                    },
                  ]}
                  values={{ label: category.label, tile: summaryTileName(category) }}
                  onSave={(next) => {
                    const label = next.label.trim();
                    const plan = planSummaryTile(next.tile ?? '', { ...category, label }, categories, language);
                    if ('refused' in plan) return { field: 'tile', error: plan.refused };
                    // Every section the name changes — joined, renamed with the tile, or left alone
                    // in it — in one draft, so the save sends one consistent state.
                    const changed = new Map(plan.changes.map((c) => [c.code, c]));
                    onChange({
                      ...payload,
                      categories: categories.map((c) => {
                        const tile = changed.get(c.code);
                        const named = c.code === category.code ? { label } : {};
                        return tile
                          ? { ...c, ...named, summaryGroupCode: tile.summaryGroupCode, summaryGroupLabel: tile.summaryGroupLabel }
                          : { ...c, ...named };
                      }),
                    });
                    return undefined;
                  }}
                  badge={(
                    <ConfigBadge tone={mine.length > 0 ? 'won' : 'open'}>
                      {settings.items({ n: mine.length })}
                    </ConfigBadge>
                  )}
                >
                  <h2 className="font-display text-lg font-bold text-navy">{category.label}</h2>
                </EditableRow>
              </div>
            </div>

            <ul className="mt-3 flex flex-col divide-y divide-hairline">
              {mine.map((type, index) => {
                const { className, ...rowProps } = drag.rowProps(type.code);
                return (
                <li
                  key={type.code}
                  {...rowProps}
                  className={`flex flex-wrap items-center gap-3 py-3 ${className}`}
                >
                  <DragHandle
                    label={type.label}
                    disabled={disabled}
                    className="cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
                    {...drag.handleProps(type.code)}
                  />
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-navy text-sm font-bold text-navy"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <EditableRow
                      rowKey={type.code}
                      disabled={disabled}
                      code={type.code}
                      fields={[
                        { key: 'label', label: settings.name },
                        {
                          key: 'description',
                          label: settings.description,
                          hint: office.descriptionHint,
                        },
                      ]}
                      values={{ label: type.label, description: type.description ?? '' }}
                      onSave={(next) => patchType(type.code, {
                        label: next.label.trim(),
                        description: next.description.trim() || null,
                      })}
                      actions={(
                        <Button
                          variant="inlineDanger"
                          disabled={disabled}
                          onClick={() => onChange({
                            ...payload,
                            types: withOrdinals(
                              types.filter((row) => row.code !== type.code),
                              'displayOrder',
                            ),
                            // A removed type is no longer the template's to count (ADR-0163).
                            ...(payload.bindings ? { bindings: unbound(payload.bindings, type.code) } : {}),
                          })}
                        >
                          {settings.remove}
                        </Button>
                      )}
                    >
                      <p className="text-md text-navy">{type.label}</p>
                      {type.description && (
                        <p className="text-sm text-muted">{type.description}</p>
                      )}
                    </EditableRow>
                  </div>
                </li>
                );
              })}
            </ul>

            <AddRow
              disabled={disabled}
              noun="activityType"
              fields={[{
                key: 'description',
                label: settings.description,
                hint: office.descriptionHint,
                wide: true,
              }]}
              onAdd={(code, label, extra) => onChange({
                ...payload,
                // Renumbered rather than counted: `types.length + 1` counts across
                // every section and collides with an existing number after any removal.
                types: withOrdinals(
                  [...types, {
                    code,
                    categoryCode: category.code,
                    label,
                    description: extra.description?.trim() || null,
                    displayOrder: 0,
                  }],
                  'displayOrder',
                ),
              })}
            />
          </Card>
        );
      })}

      </div>

      <TemplateBinding payload={payload} types={types} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/**
 * **The template's activity binding** (ADR-0163 §3, P18.9-T2 AC-3): which of its types the summary, the goal plan and
 * coaching count at each cascade stage, in every office made from it. The explicit request of the product owner,
 * 2026-10-26: one card under the sections, read as one line per stage, edited behind *Edit binding*.
 */
function TemplateBinding({
  payload, types, onChange, disabled,
}: {
  payload: TaxonomyPayload;
  types: TaxonomyPayload['types'];
  onChange: (next: TaxonomyPayload) => void;
  disabled?: boolean;
}) {
  const t = useMessages(adminTemplateEditorMessages).binding;
  const [editing, setEditing] = useState(false);
  const binding = payload.bindings;
  const name = (code: string) => types.find((type) => type.code === code)?.label ?? code;
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-navy">{t.title}</h2>
        {!editing && (
          <Button variant="inline" disabled={disabled} onClick={() => setEditing(true)}>{t.edit}</Button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">{binding ? t.set : t.notSet}</p>
      {editing ? (
        <div className="mt-3 flex flex-col gap-3">
          <ActivityBindingFields
            idPrefix="template-binding"
            value={binding ?? { leads: [], appointments: [], closings: [] }}
            types={types.map((type) => ({ code: type.code, label: type.label, status: 'active' as const }))}
            disabled={disabled}
            onChange={(next) => onChange({ ...payload, bindings: next })}
          />
          <Button variant="secondary" className="self-start" onClick={() => setEditing(false)}>{t.done}</Button>
        </div>
      ) : binding && (
        <ul className="mt-2 flex flex-col gap-0.5 text-sm text-navy">
          {BINDING_ROLES.map((role) => (
            <li key={role}>{`${BINDING_ROLE_LABEL[role]}: ${(binding[role] ?? []).map(name).join(', ') || '—'}`}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** A binding with one code taken out of every role. */
function unbound(binding: ActivityBinding, code: string): ActivityBinding {
  return Object.fromEntries(
    BINDING_ROLES.map((role) => [role, (binding[role] ?? []).filter((c) => c !== code)]),
  ) as unknown as ActivityBinding;
}

/** **The kinds of row *Add …* adds**, each named in its own words in both languages (`add`, the catalogue's). */
type AddNoun = keyof typeof adminTemplateEditorMessages.en.add;

/**
 * **The slug a new row's field ids are built from**, one per kind — the English noun the button names, as it always was
 * (`add-code-activity-type`), so a hint points at an id that exists and no id moves with the reader's language.
 */
const NOUN_SLUG: Record<AddNoun, string> = {
  section: 'section',
  activityType: 'activity-type',
  salesStage: 'sales-stage',
  recruitmentStage: 'recruitment-stage',
  ratio: 'ratio',
  category: 'category',
  skill: 'skill',
  module: 'module',
  aspect: 'aspect',
  item: 'item',
  eventType: 'event-type',
  productionClubRule: 'production-clubs-rule',
  mocRule: 'maintenance-of-contract-rule',
  promotionPathRule: 'promotion-paths-rule',
  milestone: 'milestone',
  stage: 'stage',
  grid: 'grid',
};

/** The carrier rules' *Add …*, by their kind. */
const RULE_NOUN: Record<string, AddNoun> = {
  production_club: 'productionClubRule',
  moc: 'mocRule',
  promotion_path: 'promotionPathRule',
};

/**
 * Add one row to a template payload.
 *
 * Shared by all three editors because the shape is identical — a permanent code and a
 * name — and because "how do I add one" should not have three answers on one screen.
 *
 * The code is upper-cased as it is typed rather than on save, so what a Super Admin sees
 * is what gets stored. It is also the only field they can never change afterwards: an
 * office records the codes it was seeded with, and every activity logged against them
 * holds one.
 *
 * **What it adds is a `noun`, not a phrase** (P18.98-T6): the button and the refusal of a taken code are whole messages
 * per kind of row (`add`), so each language names the row in its own words — the article *a* or *an* was chosen here,
 * from the English noun.
 */
function AddRow({
  noun,
  onAdd,
  disabled,
  bare,
  suggest,
  taken,
  nameLabel,
  fields = [],
}: {
  noun: AddNoun;
  onAdd: (code: string, label: string, extra: Record<string, string>) => void;
  disabled?: boolean;
  /** Drops the divider and top margin, for a row that already sits in a toolbar. */
  bare?: boolean;
  /**
   * Fill the code in from the name until somebody types in it (P5-T1), and put the name first
   * so there is something to fill it from. Training's rows are named in sentences, and a code
   * typed from scratch for each is how they end up `MODULE_1`.
   */
  suggest?: boolean;
  /**
   * Whether this payload already uses a code at this level. Publishing refuses a code used
   * twice; saying so beside the field is the same answer, sooner.
   */
  taken?: (code: string) => boolean;
  /** The name field's label, *Name* where none is given. */
  nameLabel?: string;
  /**
   * Anything beyond the code and the name.
   *
   * A create form offering less than its own edit panel makes somebody save a row and immediately
   * edit it to finish the job — which is what an activity type's Description made them do.
   * `wide` gives a field the room a sentence needs.
   */
  fields?: {
    key: string; label: string; hint?: string; wide?: true;
    options?: { value: string; label: string }[];
  }[];
}) {
  const settings = useMessages(settingsMessages);
  const t = useMessages(adminTemplateEditorMessages);
  const named = t.add[noun];
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [label, setLabel] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>({});
  const clash = code.trim() !== '' && (taken?.(code.trim().toUpperCase()) ?? false);
  /*
   * The noun went straight into a DOM id once, as prose — `add-code-activity type` — and a space is a separator in
   * `aria-describedby` and in `for`, which made the hint point at two ids that did not exist. Its slug, now.
   */
  const slug = NOUN_SLUG[noun];

  if (!open) {
    return (
      <Button
        variant="secondary"
        className={bare ? undefined : 'mt-3'}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {named.open}
      </Button>
    );
  }

  const name = (
    <Field label={nameLabel ?? settings.name} htmlFor={`add-label-${slug}`} className="min-w-60 flex-1">
      <TextInput
        id={`add-label-${slug}`}
        value={label}
        disabled={disabled}
        onChange={(e) => {
          setLabel(e.target.value);
          if (suggest && !touched) setCode(suggestCode(e.target.value));
        }}
      />
    </Field>
  );

  return (
    <FieldRow className={bare ? undefined : 'mt-3 border-t border-hairline pt-3'}>
      {suggest && name}
      <Field
        label={settings.code}
        htmlFor={`add-code-${slug}`}
        hint={suggest ? t.codeHintSuggested : t.codeHint}
        error={clash ? named.clash : undefined}
        className="min-w-48"
      >
        <TextInput
          id={`add-code-${slug}`}
          value={code}
          disabled={disabled}
          invalid={clash}
          onChange={(e) => {
            const value = e.target.value.toUpperCase();
            setCode(value);
            // Emptying the field hands it back to the name.
            setTouched(value !== '');
          }}
        />
      </Field>
      {!suggest && name}
      {fields.map((field) => (
        <Field
          key={field.key}
          label={field.label}
          htmlFor={`add-${field.key}-${slug}`}
          hint={field.hint}
          className={field.wide ? 'min-w-60 flex-1' : 'min-w-40'}
        >
          {field.options ? (
            <Select
              id={`add-${field.key}-${slug}`}
              value={extra[field.key] ?? ''}
              disabled={disabled}
              onChange={(e) => setExtra((now) => ({ ...now, [field.key]: e.target.value }))}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          ) : (
            <TextInput
              id={`add-${field.key}-${slug}`}
              value={extra[field.key] ?? ''}
              disabled={disabled}
              onChange={(e) => setExtra((now) => ({ ...now, [field.key]: e.target.value }))}
            />
          )}
        </Field>
      ))}
      <FieldRow.Actions>
        <Button
          disabled={disabled || !code.trim() || !label.trim() || clash}
          onClick={() => {
            onAdd(code.trim(), label.trim(), extra);
            setCode('');
            setTouched(false);
            setLabel('');
            setExtra({});
            setOpen(false);
          }}
        >
          {settings.add}
        </Button>
        <Button variant="secondary" disabled={disabled} onClick={() => setOpen(false)}>{settings.cancel}</Button>
      </FieldRow.Actions>
    </FieldRow>
  );
}

/**
 * The two lead ladders of a company template.
 *
 * **Sales and Recruitment are subtabs, not two stacked cards** — the Owner's own screen
 * arranges them that way, and a Super Admin filling a template should be looking at what
 * an Owner will see. Stacked, the two ladders read as one eleven-stage list on a narrow
 * screen, and the hint about order then describes an order that does not exist.
 *
 * **The subtabs are the screen's, not this component's.** They were drawn here, below the
 * Save card, while the Activity types group drew its two above it through the shell — two
 * shapes in two places for one idea. The screen now declares every leaf and draws every
 * row; this takes the chosen one as a prop.
 */
export function PipelineEditor({
  payload,
  pipeline,
  onChange,
  disabled,
}: {
  payload: PipelinePayload;
  /** Which ladder to draw. The screen's subtab row chooses it. */
  pipeline: 'sales' | 'recruitment';
  onChange: (next: PipelinePayload) => void;
  disabled?: boolean;
}) {
  /*
   * A template that nobody has authored yet arrives as `payload: {}`.
   *
   * The dispatch in the template screen casts each payload with `as unknown as`, which
   * tells TypeScript the arrays are there and cannot check that they are — so an
   * unauthored preset took the whole screen down on `.filter of undefined` rather than
   * rendering as the empty thing it is. Empty is a real state for every one of these.
   */
  const t = useMessages(adminTemplateEditorMessages);
  const settings = useMessages(settingsMessages);
  const ladder = useMessages(leadStatusesMessages);
  const allStatuses = payload.statuses ?? [];
  const mine = allStatuses.filter((s) => s.pipeline === pipeline);

  const drag = useRowDrag(
    allStatuses,
    (st) => st.code,
    (statuses) => onChange({ statuses }),
    // Per pipeline: both ladders start at 1, so renumbering them in one sequence would
    // give recruitment ranks that carry on from where sales stopped.
    { field: 'rank', groupOf: (st) => st.pipeline },
    // One ladder at a time: a sales stage does not belong in the recruitment sequence.
    (from, to) => from.pipeline === to.pipeline,
  );

  return (
    <div>
      <p className="mb-4 text-sm text-muted">{t.pipeline.count({ n: mine.length })}</p>

      <Card>
        <ul className="flex flex-col divide-y divide-hairline">
          {mine.map((stage, index) => {
            const { className, ...rowProps } = drag.rowProps(stage.code);
            return (
            <li
              key={stage.code}
              {...rowProps}
              className={`flex flex-wrap items-center gap-3 py-3 ${className}`}
            >
              <DragHandle
                label={stage.label}
                disabled={disabled}
                className="cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
                {...drag.handleProps(stage.code)}
              />
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-navy text-sm font-bold text-navy"
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <EditableRow
                  rowKey={stage.code}
                  disabled={disabled}
                  code={stage.code}
                  fields={[{ key: 'label', label: settings.name }]}
                  badge={stage.isTerminal ? (
                    <ConfigBadge tone="won">{ladder.closesPipeline}</ConfigBadge>
                  ) : (
                    <ConfigBadge tone="open">{ladder.open}</ConfigBadge>
                  )}
                  values={{ label: stage.label }}
                  onSave={(next) => onChange({
                    statuses: allStatuses.map((s) => (s.code === stage.code
                      ? { ...s, label: next.label.trim() }
                      : s)),
                  })}
                >
                  <p className="text-md text-navy">{stage.label}</p>
                </EditableRow>
              </div>
              <span className="flex flex-wrap items-center gap-2">
                {/*
                  * What an office starts with, not what it is stuck with (ADR-0043). The
                  * Owner's own screen carries the same switch; a company that could not set
                  * it here would hand every new office the platform's answer and no way to
                  * change what the *next* one starts from.
                  */}
                {!stage.isTerminal && (
                  <Switch
                    id={`tpl-late-${stage.code}`}
                    label={kept('Expected to close')}
                    checked={stage.isLateStage ?? false}
                    disabled={disabled}
                    onChange={(next) => onChange({
                      statuses: allStatuses.map((s) => (s.code === stage.code
                        ? { ...s, isLateStage: next }
                        : s)),
                    })}
                  />
                )}
                {!stage.isTerminal && (
                  <Button
                    variant="inline"
                    disabled={disabled}
                    onClick={() => onChange({
                      // Exactly one per pipeline: publishing refuses anything else, so the
                      // screen never lets a second one be set.
                      statuses: allStatuses.map((s) => (s.pipeline === pipeline
                        ? { ...s, isTerminal: s.code === stage.code }
                        : s)),
                    })}
                  >
                    {t.pipeline.makeClose}
                  </Button>
                )}
                <Button
                  variant="inlineDanger"
                  disabled={disabled || stage.isTerminal}
                  title={stage.isTerminal ? ladder.closingKept : undefined}
                  onClick={() => onChange({
                    statuses: withOrdinals(
                      allStatuses.filter((s) => s.code !== stage.code),
                      'rank',
                      (st) => st.pipeline,
                    ),
                  })}
                >
                  {settings.remove}
                </Button>
              </span>
            </li>
            );
          })}
        </ul>

        <AddRow
          disabled={disabled}
          noun={pipeline === 'sales' ? 'salesStage' : 'recruitmentStage'}
          onAdd={(code, label) => onChange({
            // Appended, and never terminal: exactly one stage closes each pipeline, and
            // moving that is a deliberate second act rather than a side effect of adding.
            // Renumbered per pipeline: `mine.length + 1` collides with a rank that is
            // still in use as soon as a stage has been removed.
            statuses: withOrdinals(
              [...allStatuses, {
                pipeline, code, label, rank: 0, isTerminal: false, isLateStage: false,
              }],
              'rank',
              (st) => st.pipeline,
            ),
          })}
        />
      </Card>
    </div>
  );
}

export interface RatioSetPayload {
  ratios: {
    code: string; label: string; numerator: string[]; denominator: string[];
    benchmark: number; comparison: 'gte' | 'band'; displayOrder: number;
    /** How the benchmark is written (P4-T25). Absent on a payload saved before units existed. */
    displayUnit?: RatioDisplayUnit;
    appliesToOrgLevelCodes?: string[];
  }[];
}

/**
 * A side of a ratio's formula: the activity types it sums.
 *
 * Checkboxes over the company's own taxonomy, not free text. A formula is a pair of code
 * lists (`ratio-definition.schema.ts`), and a typed code is a code that can be typed
 * wrong — publishing would then refuse it, which is the right answer arriving at the wrong
 * moment.
 */
function FormulaSide({
  heading,
  codes,
  available,
  disabled,
  onChange,
}: {
  heading: string;
  codes: string[];
  available: { code: string; label: string }[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  const t = useMessages(adminTemplateEditorMessages).ratios;
  return (
    <fieldset className="min-w-0 flex-1">
      <legend className="text-sm font-semibold text-navy">{heading}</legend>
      {available.length === 0 ? (
        // The taxonomy tab has nothing yet, or could not be read. Showing the codes it
        // already holds beats an empty box that looks like a broken control.
        <p className="mt-1 text-sm text-muted">{t.formulaEmpty({ codes: codes.join(' + ') })}</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-3">
          {available.map((type) => (
            <li key={type.code}>
              <label className="flex items-center gap-1.5 text-md text-navy">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={codes.includes(type.code)}
                  onChange={(e) => onChange(e.target.checked
                    ? [...codes, type.code]
                    : codes.filter((c) => c !== type.code))}
                />
                {type.label}
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

/**
 * The ratio set of a company template (P4-T22).
 *
 * `ratio_set` has been a `TemplateKind` with a starting payload and a provisioning reader
 * since P4-T8, and had no screen until P4-T20.
 *
 * **The formula is editable here, and that is the point.** It was read-only in the first
 * version of this editor, on the reasoning that an office may not change a
 * `origin: 'platform'` ratio's formula (ADR-0021) — which had the dependency backwards. An
 * office's copy is immutable *because the company defines it upstream*; if this screen
 * cannot define it, nothing can, and `ratio_set` is decorative. Publishing a new version
 * does not reach into offices already created (ADR-0018), so what is edited here is what
 * the **next** office of this company starts from.
 *
 * `origin` does not exist on a template payload at all — it is written at provisioning.
 */
export function RatioSetEditor({
  payload,
  available,
  onChange,
  disabled,
}: {
  payload: RatioSetPayload;
  /** The company's own activity types, for the formula pickers. */
  available: { code: string; label: string }[];
  onChange: (next: RatioSetPayload) => void;
  disabled?: boolean;
}) {
  /*
   * A template that nobody has authored yet arrives as `payload: {}`.
   *
   * The dispatch in the template screen casts each payload with `as unknown as`, which
   * tells TypeScript the arrays are there and cannot check that they are — so an
   * unauthored preset took the whole screen down on `.filter of undefined` rather than
   * rendering as the empty thing it is. Empty is a real state for every one of these.
   */
  const t = useMessages(adminTemplateEditorMessages).ratios;
  const settings = useMessages(settingsMessages);
  const office = useMessages(ratioBenchmarksMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const units = displayUnitLabels(language, figures);
  const allRatios = payload.ratios ?? [];

  const patch = (code: string, fields: Partial<RatioSetPayload['ratios'][number]>) => onChange({
    ratios: allRatios.map((r) => (r.code === code ? { ...r, ...fields } : r)),
  });

  const drag = useRowDrag(
    allRatios,
    (r) => r.code,
    (ratios) => onChange({ ratios }),
    { field: 'displayOrder' },
  );

  return (
    <div className="flex flex-col gap-4">
      {allRatios.map((ratio) => {
        const { className, ...rowProps } = drag.rowProps(ratio.code);
        return (
        <Card key={ratio.code} {...rowProps} className={className}>
          <DragHandle
            label={ratio.label}
            disabled={disabled}
            className="cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
            {...drag.handleProps(ratio.code)}
          />
          <EditableRow
            rowKey={ratio.code}
            disabled={disabled}
            code={ratio.code}
            fields={[
              { key: 'label', label: settings.name },
              {
                key: 'benchmark',
                label: ratio.comparison === 'band' ? office.withinEitherSide : office.atOrAbove,
                hint: ratio.comparison === 'band'
                  ? office.bandHintEmpty
                  // The units' examples are figures, in the reader's (P18.98-T3): *0,30*, *0.30* in English.
                  : t.typedAsShown({
                    percent: formatPercent(15, {}, figures),
                    decimal: formatNumber(0.3, { decimals: 2 }, figures),
                  }),
              },
              // A band is points and has no other way to be written, so it gets no choice.
              ...(ratio.comparison === 'band' ? [] : [{
                key: 'displayUnit',
                label: office.shownAs,
                options: [
                  { value: 'percent', label: units.percent },
                  { value: 'decimal', label: units.decimal },
                ],
              }]),
            ]}
            values={{
              label: ratio.label,
              benchmark: benchmarkToInput(ratio.benchmark, unitFor(ratio), figures),
              displayUnit: unitFor(ratio),
            }}
            reshape={(next, changed, previous) => (changed === 'displayUnit'
              ? {
                ...next,
                benchmark: reexpress(
                  previous.benchmark,
                  previous.displayUnit as RatioDisplayUnit,
                  next.displayUnit as RatioDisplayUnit,
                  figures,
                ),
              }
              : next)}
            onSave={(next) => {
              const unit: RatioDisplayUnit = ratio.comparison === 'band'
                ? 'points'
                : next.displayUnit as RatioDisplayUnit;
              const benchmark = benchmarkFromInput(next.benchmark, unit);
              patch(ratio.code, {
                label: next.label.trim(),
                benchmark: Number.isNaN(benchmark) ? 0 : benchmark,
                displayUnit: unit,
              });
            }}
            actions={(
              <Button
                variant="inlineDanger"
                disabled={disabled}
                onClick={() => onChange({
                  ratios: withOrdinals(
                    allRatios.filter((r) => r.code !== ratio.code),
                    'displayOrder',
                  ),
                })}
              >
                {settings.remove}
              </Button>
            )}
          >
            <p className="text-md font-semibold text-navy">{ratio.label}</p>
            <p className="text-sm text-muted">
              {ratio.comparison === 'band' ? office.onTrackWithin : office.onTrackAtOrAbove}
              <strong>{formatBenchmark(ratio.benchmark, unitFor(ratio), figures, language)}</strong>
            </p>
          </EditableRow>

          <div className="mt-3 flex flex-wrap gap-4 border-t border-hairline pt-3">
            <FormulaSide
              heading={office.counts}
              codes={ratio.numerator}
              available={available}
              disabled={disabled}
              onChange={(numerator) => patch(ratio.code, { numerator })}
            />
            <FormulaSide
              heading={office.outOf}
              codes={ratio.denominator}
              available={available}
              disabled={disabled}
              onChange={(denominator) => patch(ratio.code, { denominator })}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            {t.startsFrom({ strong: (words) => <strong>{words}</strong> })}
          </p>

          <Button
            variant="danger"
            className="mt-3"
            disabled={disabled}
            onClick={() => onChange({
              ratios: withOrdinals(
                allRatios.filter((r) => r.code !== ratio.code),
                'displayOrder',
              ),
            })}
          >
            {settings.remove}
          </Button>
        </Card>
        );
      })}

      <AddRow
        disabled={disabled}
        noun="ratio"
        onAdd={(code, label) => onChange({
          ratios: withOrdinals(
            [...allRatios, {
              code, label, numerator: [], denominator: [],
              // A floor of zero and an empty formula: publishing refuses both, which is
              // the right moment for it — the Super Admin has said what they are adding
              // and not yet what it counts.
              benchmark: 0, comparison: 'gte', displayUnit: 'decimal', displayOrder: 0,
            }],
            'displayOrder',
          ),
        })}
      />
    </div>
  );
}

export interface TrainingTaxonomyPayload {
  categories: { code: string; label: string; description?: string | null }[];
  skills: { code: string; categoryCode: string; label: string }[];
  modules: {
    code: string; skillCode: string; title: string;
    /** Absent reads as a draft, which is what an office would make of it. */
    publishState?: 'draft' | 'published';
  }[];
}

type TrainingTab = 'categories' | 'skills' | 'modules';

/**
 * The training taxonomy of a company template (P5-T1, ADR-0029).
 *
 * **It mirrors the Owner's Settings › Training**, as every tab here mirrors its screen: the same
 * three subtabs, the same filters, the same badges — a Super Admin filling a template is looking
 * at what an Owner will be handed.
 *
 * **What differs is what removing means.** An office archives, because its agents' progress
 * points at its rows. A template payload is a document nothing points at until an office is made
 * from it, so a row here is removed outright. A category or skill with rows under it is not: the
 * payload would then name a parent it does not define, which publishing refuses anyway.
 *
 * **No order to set.** The prototype draws no handle on any of the three lists, and an office
 * cannot reorder its copy either (ADR-0029), so a row's place is the order it was added in.
 */
export function TrainingEditor({
  payload,
  section,
  onChange,
  disabled,
}: {
  payload: TrainingTaxonomyPayload;
  /** Which of the three lists to draw. The screen's subtab row chooses it. */
  section: TrainingTab;
  onChange: (next: TrainingTaxonomyPayload) => void;
  disabled?: boolean;
}) {
  const tab = section;
  const all = useMessages(adminTemplateEditorMessages);
  const t = all.training;
  const settings = useMessages(settingsMessages);
  const [skillsCategory, setSkillsCategory] = useState('');
  const [modulesCategory, setModulesCategory] = useState('');
  const [modulesSkill, setModulesSkill] = useState('all');

  /*
   * A template that nobody has authored yet arrives as `payload: {}`, and the template screen's
   * cast cannot check the arrays are there. Empty is a real state here as in every editor.
   */
  const categories = payload.categories ?? [];
  const skills = payload.skills ?? [];
  const modules = payload.modules ?? [];
  const put = (next: Partial<TrainingTaxonomyPayload>) => onChange({ categories, skills, modules, ...next });

  const categoryLabel = (code: string) => categories.find((c) => c.code === code)?.label ?? code;
  const skillLabel = (code: string) => skills.find((s) => s.code === code)?.label ?? code;

  const skillsTabCategory = categories.find((c) => c.code === skillsCategory) ?? categories[0];
  const modulesTabCategory = categories.find((c) => c.code === modulesCategory) ?? categories[0];
  const modulesTabSkills = skills.filter((s) => s.categoryCode === modulesTabCategory?.code);
  const modulesTabSkill = modulesTabSkills.some((s) => s.code === modulesSkill) ? modulesSkill : 'all';

  const filter = 'flex flex-wrap items-center gap-x-4 gap-y-2';
  // A label held to its select, so a narrow screen wraps the pair rather than the label alone.
  const pair = 'flex items-center gap-2';
  const filterLabel = 'text-sm font-semibold text-muted';
  const empty = (text: string) => <p className="px-5 py-10 text-center text-md text-muted">{text}</p>;

  function categoriesPanel() {
    return (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">{t.categories({ n: categories.length })}</p>
          <AddRow
            bare
            suggest
            disabled={disabled}
            noun="category"
            fields={[{
              key: 'description',
              label: settings.description,
              hint: t.categoryHint,
              wide: true,
            }]}
            taken={(code) => categories.some((c) => c.code === code)}
            onAdd={(code, label, extra) => put({
              categories: [
                ...categories,
                { code, label, description: extra.description?.trim() || null },
              ],
            })}
          />
        </div>
        <Card className="p-0">
          {categories.length === 0 ? empty(t.noCategories) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {categories.map((category) => {
                const mine = skills.filter((s) => s.categoryCode === category.code);
                const codes = new Set(mine.map((s) => s.code));
                const offered = modules.filter((m) =>
                  codes.has(m.skillCode) && m.publishState === 'published').length;
                return (
                  <li key={category.code} className="px-4 py-3 sm:px-5">
                    <EditableRow
                      rowKey={category.code}
                      disabled={disabled}
                      code={category.code}
                      fields={[
                        { key: 'label', label: settings.name },
                        {
                          key: 'description',
                          label: settings.description,
                          hint: t.categoryEditHint,
                        },
                      ]}
                      values={{ label: category.label, description: category.description ?? '' }}
                      onSave={(next) => put({
                        categories: categories.map((c) => (c.code === category.code
                          ? { ...c, label: next.label.trim(), description: next.description.trim() || null }
                          : c)),
                      })}
                      actions={(
                        <Button
                          variant="inlineDanger"
                          disabled={disabled || mine.length > 0}
                          title={mine.length > 0 ? t.removeSkillsFirst : undefined}
                          onClick={() => put({ categories: categories.filter((c) => c.code !== category.code) })}
                        >
                          {settings.remove}
                        </Button>
                      )}
                      badge={mine.length === 0
                        ? <ConfigBadge tone="open">{t.empty}</ConfigBadge>
                        : (
                          <ConfigBadge tone={offered > 0 ? 'won' : 'open'}>
                            {t.categoryBadge({ skills: mine.length, modules: offered })}
                          </ConfigBadge>
                        )}
                    >
                      <p className="text-md font-semibold text-navy">{category.label}</p>
                      {category.description && <p className="text-sm text-muted">{category.description}</p>}
                    </EditableRow>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </>
    );
  }

  function skillsPanel() {
    const mine = skills.filter((s) => s.categoryCode === skillsTabCategory?.code);
    return (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className={filter}>
            <label htmlFor="template-training-skills-category" className={filterLabel}>{t.category}</label>
            <Select
              id="template-training-skills-category"
              value={skillsTabCategory?.code ?? ''}
              onChange={(e) => setSkillsCategory(e.target.value)}
            >
              {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </Select>
          </div>
          {skillsTabCategory && (
            <AddRow
              bare
              suggest
              disabled={disabled}
              noun="skill"
              taken={(code) => skills.some((s) => s.code === code)}
              onAdd={(code, label) => put({
                skills: [...skills, { code, categoryCode: skillsTabCategory.code, label }],
              })}
            />
          )}
        </div>
        <Card className="p-0">
          {!skillsTabCategory ? empty(t.categoryFirst)
            : mine.length === 0 ? empty(t.noSkills) : (
              <ul className="flex flex-col divide-y divide-hairline">
                {mine.map((skill) => {
                  const teaching = modules.filter((m) => m.skillCode === skill.code);
                  return (
                    <li key={skill.code} className="px-4 py-3 sm:px-5">
                      <EditableRow
                        rowKey={skill.code}
                        disabled={disabled}
                        code={skill.code}
                        fields={[
                          { key: 'label', label: settings.name },
                          {
                            key: 'categoryCode',
                            label: t.category,
                            hint: t.modulesMove,
                            options: categories.map((c) => ({ value: c.code, label: c.label })),
                          },
                        ]}
                        values={{ label: skill.label, categoryCode: skill.categoryCode }}
                        onSave={(next) => put({
                          skills: skills.map((s) => (s.code === skill.code
                            ? { ...s, label: next.label.trim(), categoryCode: next.categoryCode }
                            : s)),
                        })}
                        actions={(
                          <Button
                            variant="inlineDanger"
                            disabled={disabled || teaching.length > 0}
                            title={teaching.length > 0 ? t.removeModulesFirst : undefined}
                            onClick={() => put({ skills: skills.filter((s) => s.code !== skill.code) })}
                          >
                            {settings.remove}
                          </Button>
                        )}
                        badge={(
                          <ConfigBadge tone={teaching.length > 0 ? 'won' : 'open'}>
                            {t.modules({ n: teaching.length })}
                          </ConfigBadge>
                        )}
                      >
                        <p className="text-md font-semibold text-navy">{skill.label}</p>
                      </EditableRow>
                    </li>
                  );
                })}
              </ul>
            )}
        </Card>
      </>
    );
  }

  function modulesPanel() {
    const rows = modulesTabSkills
      .filter((s) => modulesTabSkill === 'all' || s.code === modulesTabSkill)
      .flatMap((s) => modules.filter((m) => m.skillCode === s.code));
    return (
      <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className={filter}>
            <span className={pair}>
              <label htmlFor="template-training-modules-category" className={filterLabel}>{t.category}</label>
              <Select
                id="template-training-modules-category"
                value={modulesTabCategory?.code ?? ''}
                onChange={(e) => { setModulesCategory(e.target.value); setModulesSkill('all'); }}
              >
                {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </Select>
            </span>
            <span className={pair}>
              <label htmlFor="template-training-modules-skill" className={filterLabel}>{t.skill}</label>
              <Select
                id="template-training-modules-skill"
                value={modulesTabSkill}
                onChange={(e) => setModulesSkill(e.target.value)}
              >
                <option value="all">{t.allSkills}</option>
                {modulesTabSkills.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
              </Select>
            </span>
          </div>
          {/* A module teaches one skill, so it is added to the one chosen — "All skills" names none. */}
          {modulesTabSkill === 'all' ? (
            <p className="text-sm text-muted">{t.chooseSkill}</p>
          ) : (
            <AddRow
              bare
              suggest
              disabled={disabled}
              noun="module"
              nameLabel={all.title}
              taken={(code) => modules.some((m) => m.code === code)}
              onAdd={(code, title) => put({
                // A draft, as an office's new module is: publishing is a decision about content,
                // and the template has none yet.
                modules: [...modules, { code, skillCode: modulesTabSkill, title, publishState: 'draft' }],
              })}
            />
          )}
        </div>
        <Card className="p-0">
          {rows.length === 0 ? empty(t.noModules) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {rows.map((module) => {
                const isPublished = module.publishState === 'published';
                return (
                  <li key={module.code} className="px-4 py-3 sm:px-5">
                    <EditableRow
                      rowKey={module.code}
                      disabled={disabled}
                      code={module.code}
                      fields={[
                        { key: 'title', label: all.title },
                        {
                          key: 'skillCode',
                          label: t.skill,
                          options: skills.map((s) => ({
                            value: s.code, label: `${categoryLabel(s.categoryCode)} › ${s.label}`,
                          })),
                        },
                        {
                          key: 'publishState',
                          label: t.publishState,
                          hint: t.publishStateHint,
                          options: [
                            { value: 'draft', label: t.draft },
                            { value: 'published', label: t.published },
                          ],
                        },
                      ]}
                      values={{
                        title: module.title,
                        skillCode: module.skillCode,
                        publishState: isPublished ? 'published' : 'draft',
                      }}
                      onSave={(next) => put({
                        modules: modules.map((m) => (m.code === module.code
                          ? {
                            ...m,
                            title: next.title.trim(),
                            skillCode: next.skillCode,
                            publishState: next.publishState as 'draft' | 'published',
                          }
                          : m)),
                      })}
                      badge={(
                        <ConfigBadge tone={isPublished ? 'won' : 'open'}>
                          {isPublished ? t.published : t.draft}
                        </ConfigBadge>
                      )}
                      actions={(
                        <Button
                          variant="inlineDanger"
                          disabled={disabled}
                          onClick={() => put({ modules: modules.filter((m) => m.code !== module.code) })}
                        >
                          {settings.remove}
                        </Button>
                      )}
                    >
                      <p className="text-md font-semibold text-navy">{module.title}</p>
                      <p className="text-sm text-muted">{skillLabel(module.skillCode)}</p>
                    </EditableRow>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </>
    );
  }

  return (
    <div>
      {tab === 'categories' && categoriesPanel()}
      {tab === 'skills' && skillsPanel()}
      {tab === 'modules' && modulesPanel()}
    </div>
  );
}

export interface ActivationChecklistPayload {
  aspects: {
    code: string;
    label: string;
    items: { code: string; label: string; autoLink?: string | null }[];
  }[];
}

/**
 * The three feature links, which exist for every company — each a page's title, kept English (§A.2). Training links
 * name a module code. *No link (manual)* comes first, in the office's checklist's words (`settings-checklist.ts`).
 */
const ACTIVATION_FEATURES = [
  { value: 'feature:goals', label: kept('Goal Settings') },
  { value: 'feature:leads', label: kept('Leads Management') },
  { value: 'feature:activity', label: kept('Activity Management') },
];

/** `ConfigBadge`'s pill, painted on the button that carries the badge's words (ADR-0062 §2, form 2). */
const LINK_BADGE_FACE = 'h-auto w-auto whitespace-nowrap rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-wide';

/**
 * A link's badge, from **what the server resolves it to** (P18.5-T3 AC-6, I-80; the carry at
 * `functional/activation.md:1404-1407`): *Auto*, with the registry's sentence as its tooltip and its name,
 * only for a link that completes the item on its own (`live`), and *Ticked by hand* for one that does
 * not — the office's own screen's badge (`LinkBadge`). It said *Auto* for any link, and *Ticked by the
 * leader* for a manual item, stale since ADR-0105. A manual item has no badge; a link not resolved yet —
 * chosen and not saved — claims neither.
 */
function TemplateLinkBadge({ link }: { link: TemplateLinkKind }) {
  // The activation's own words, in the reader's language (`activation.ts`; P18.98-T6): `completesWhen` is the
  // registry's sentence, as the server sends it.
  const language = useLanguage();
  const badge = link.live ? autoBadge(link.completesWhen, language) : byHandBadge(language);
  return (
    <TippedGlyph
      glyph={badge.glyph}
      name={badge.name}
      tip={badge.tip}
      align="fit"
      face={link.live
        ? `${LINK_BADGE_FACE} bg-success/10 text-success hover:bg-success/15 hover:text-success`
        : `${LINK_BADGE_FACE} border border-hairline bg-base text-muted hover:bg-base hover:text-navy`}
    />
  );
}

/** The resolved view of one item's link: by its kind, and `training` for any `training:<code>`. */
const resolveLinkKind = (kinds: TemplateLinkKinds | null | undefined, link: string): TemplateLinkKind | null =>
  kinds?.[link] ?? (link.startsWith('training:') ? kinds?.training ?? null : null);

/**
 * The activation checklist of a company template (P5-T3, ADR-0031).
 *
 * **It mirrors the Owner's own screen**: aspects with items under them, and a link per item. What
 * differs is what a link can be checked against — a template has no office, so a training link is
 * checked for shape here and resolved against the modules an office is actually given when it is
 * created. The module names offered come from this company's own `training_taxonomy` draft, the way
 * the ratio editor offers this company's activity types.
 */
export function ActivationChecklistEditor({
  payload,
  modules,
  linkKinds,
  onChange,
  disabled,
}: {
  payload: ActivationChecklistPayload;
  /** The company's own training modules, for the link picker. */
  modules: { code: string; title: string }[];
  /** Each link kind as the template read resolves it (P18.5-T3 AC-6): what the badge reads `live` from. */
  linkKinds?: TemplateLinkKinds | null;
  onChange: (next: ActivationChecklistPayload) => void;
  disabled?: boolean;
}) {
  const t = useMessages(adminTemplateEditorMessages).checklist;
  const settings = useMessages(settingsMessages);
  const office = useMessages(checklistMessages);
  // A template nobody has authored yet arrives as `payload: {}`; empty is a real state.
  const aspects = payload.aspects ?? [];
  const put = (next: ActivationChecklistPayload['aspects']) => onChange({ aspects: next });

  // A module's title is the company's, as typed; *Training* is the menu's, kept (§A.1).
  const linkOptions = [
    { value: '', label: office.noLink },
    ...ACTIVATION_FEATURES,
    ...modules.map((m) => ({ value: `training:${m.code}`, label: `${kept('Training')} · ${m.title}` })),
  ];
  const linkLabel = (link: string | null | undefined) =>
    linkOptions.find((o) => o.value === (link ?? ''))?.label
    // A module this company's taxonomy no longer defines still has to render as something.
    ?? `${kept('Training')} · ${String(link).replace(/^training:/, '')}`;

  const patchAspect = (code: string, fields: Partial<ActivationChecklistPayload['aspects'][number]>) =>
    put(aspects.map((a) => (a.code === code ? { ...a, ...fields } : a)));

  /*
   * **Order is the order here**, not a stored ordinal: `activation-input.ts` provisions an
   * office by reading *"the position in the list the caller sent"*. So a drag rewrites the
   * array and nothing else.
   *
   * This screen was the last of the template's lists without a handle — the only way to move
   * an aspect was to remove it, with every item under it, and add it back in the right place.
   */
  const aspectDrag = useRowDrag(aspects, (a) => a.code, put, 'position');

  /**
   * One drag context per aspect, built on demand.
   *
   * `useRowDrag` holds state, so calling it inside the `aspects.map` would break the rules of
   * hooks the moment an aspect is added or removed. One hook over the flattened items would
   * be worse: an item dragged into another aspect would move in the list and keep the aspect
   * it came from, which is the defect `canPlace` exists to prevent elsewhere in this file.
   *
   * So the items of every aspect share one hook, keyed `aspectCode:itemCode`, and a move is
   * refused unless both rows belong to the same aspect.
   */
  const flatItems = aspects.flatMap((a) => a.items.map((i) => ({ ...i, aspectCode: a.code })));
  const flatDrag = useRowDrag(
    flatItems,
    (i) => `${i.aspectCode}:${i.code}`,
    (next) => put(aspects.map((a) => ({
      ...a,
      items: next.filter((i) => i.aspectCode === a.code)
        .map(({ aspectCode: _aspectCode, ...item }) => item),
    }))),
    'position',
    (from, to) => from.aspectCode === to.aspectCode,
  );
  const itemDrag = (aspectCode: string) => ({
    rowProps: (code: string) => flatDrag.rowProps(`${aspectCode}:${code}`),
    handleProps: (code: string) => flatDrag.handleProps(`${aspectCode}:${code}`),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {t.count({ items: aspects.flatMap((a) => a.items).length, aspects: aspects.length })}
        </p>
        <AddRow
          bare
          suggest
          disabled={disabled}
          noun="aspect"
          taken={(code) => aspects.some((a) => a.code === code)}
          onAdd={(code, label) => put([...aspects, { code, label, items: [] }])}
        />
      </div>

      {aspects.length === 0 ? (
        <Card><p className="text-md text-muted">{t.noAspects}</p></Card>
      ) : aspects.map((aspect) => {
        const { className: aspectCls, ...aspectRow } = aspectDrag.rowProps(aspect.code);
        return (
        <Card key={aspect.code} className={`p-0 ${aspectCls}`} {...aspectRow}>
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
            <DragHandle
              label={aspect.label}
              disabled={disabled}
              className="cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
              {...aspectDrag.handleProps(aspect.code)}
            />
            <div className="min-w-0 flex-1">
              {/* Renameable, which it was not: a typo in an aspect's name could only be fixed by
                  removing the aspect and every item under it. */}
              <EditableRow
                rowKey={`aspect-${aspect.code}`}
                disabled={disabled}
                code={aspect.code}
                fields={[{ key: 'label', label: settings.name }]}
                values={{ label: aspect.label }}
                onSave={(next) => patchAspect(aspect.code, { label: next.label.trim() })}
                badge={(
                  <ConfigBadge tone={aspect.items.length > 0 ? 'won' : 'open'}>
                    {settings.items({ n: aspect.items.length })}
                  </ConfigBadge>
                )}
              >
                {/* An `h2`, as the office's own checklist and this screen's other editors head theirs: an `h3` under the
                    page's `h1` skipped a level (axe's heading-order, found walking it in P18.98-T6). */}
                <h2 className="font-display text-lg font-bold text-navy">{aspect.label}</h2>
              </EditableRow>
            </div>
            <span className="flex flex-wrap items-center gap-2">
{/* With its items, as the Owner's own screen removes one: an aspect holding none is a
                  state neither an office nor a template may publish. */}
              <Button
                variant="inlineDanger"
                disabled={disabled}
                title={t.removesAspect({ name: aspect.label, n: aspect.items.length })}
                onClick={() => put(aspects.filter((a) => a.code !== aspect.code))}
              >
                {settings.remove}
              </Button>
            </span>
          </div>

          <ul className="flex flex-col divide-y divide-hairline">
            {aspect.items.map((item) => {
              const { className: itemCls, ...itemRow } = itemDrag(aspect.code).rowProps(item.code);
              return (
              <li key={item.code} {...itemRow} className={`px-4 py-3 sm:px-5 ${itemCls}`}>
                <div className="flex items-start gap-3">
                <DragHandle
                  label={item.label}
                  disabled={disabled}
                  className="mt-0.5 cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
                  {...itemDrag(aspect.code).handleProps(item.code)}
                />
                <div className="min-w-0 flex-1">
                <EditableRow
                  rowKey={item.code}
                  disabled={disabled}
                  code={item.code}
                  fields={[
                    { key: 'label', label: settings.item },
                    {
                      key: 'autoLink',
                      label: office.completesFrom,
                      hint: t.linkHint,
                      options: linkOptions,
                    },
                  ]}
                  values={{ label: item.label, autoLink: item.autoLink ?? '' }}
                  onSave={(next) => patchAspect(aspect.code, {
                    items: aspect.items.map((i) => (i.code === item.code
                      ? { ...i, label: next.label.trim(), autoLink: next.autoLink || null }
                      : i)),
                  })}
                  actions={(
                    <Button
                      variant="inlineDanger"
                      disabled={disabled}
                      onClick={() => patchAspect(aspect.code, {
                        items: aspect.items.filter((i) => i.code !== item.code),
                      })}
                    >
                      {settings.remove}
                    </Button>
                  )}
                >
                  <p className="text-md text-navy">{item.label}</p>
                  {item.autoLink && (
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      {(() => {
                        const resolved = resolveLinkKind(linkKinds, item.autoLink);
                        return resolved && <TemplateLinkBadge link={resolved} />;
                      })()}
                      <span className="text-sm text-muted">{linkLabel(item.autoLink)}</span>
                    </p>
                  )}
                </EditableRow>
                </div>
                </div>
              </li>
              );
            })}
          </ul>

          <div className="px-4 pb-3 sm:px-5">
            <AddRow
              suggest
              disabled={disabled}
              noun="item"
              nameLabel={settings.item}
              fields={[{
                key: 'autoLink',
                label: office.completesFrom,
                hint: t.linkHint,
                options: linkOptions,
                wide: true,
              }]}
              taken={(code) => aspects.some((a) => a.items.some((i) => i.code === code))}
              onAdd={(code, label, extra) => patchAspect(aspect.code, {
                items: [...aspect.items, { code, label, autoLink: extra.autoLink || null }],
              })}
            />
          </div>
        </Card>
        );
      })}
    </div>
  );
}

// ------------------------------------------------ the two kinds ADR-0034 named (P5-T9 AC-4)

export interface EventTypesPayload {
  types: {
    code: string; label: string; description?: string | null;
    emoji?: string | null; color?: string | null;
    /**
     * The order an office's screen lists them in.
     *
     * Written here rather than derived from array position, so a payload that arrives out of
     * order still seeds the order it states — and so `useRowDrag` has the ordinal it rewrites.
     */
    displayOrder?: number;
  }[];
}

/**
 * The event types of a company template (P5-T6, ADR-0034, P5-T9 AC-4).
 *
 * **Types, never occurrences.** An event is a live record an office or a company runs; what is
 * copied into a new office is the list of things an event may *be* — which is why this tab was a
 * sign until the kind existed, and why there will never be a kind for an event itself.
 *
 * An insurer that runs *Product launch* and not *Community* should not hand every one of its
 * offices a type it never uses, and every office deleting the same row by hand is not a default.
 */
export function EventTypesEditor({
  payload,
  onChange,
  disabled,
}: {
  payload: EventTypesPayload;
  onChange: (next: EventTypesPayload) => void;
  disabled?: boolean;
}) {
  const t = useMessages(adminTemplateEditorMessages).events;
  const settings = useMessages(settingsMessages);
  // A template nobody has authored yet arrives as `payload: {}`; empty is a real state.
  const types = payload.types ?? [];
  const put = (next: EventTypesPayload['types']) => onChange({ types: next });
  const drag = useRowDrag(types, (row) => row.code, put, { field: 'displayOrder' });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t.count({ n: types.length })}</p>
        <AddRow
          bare
          suggest
          disabled={disabled}
          noun="eventType"
          fields={[
            { key: 'description', label: settings.description, hint: settings.optional, wide: true },
            { key: 'emoji', label: t.emoji, hint: t.emojiAddHint },
          ]}
          taken={(code) => types.some((row) => row.code === code)}
          onAdd={(code, label, extra) => put([
            ...types, {
              code,
              label,
              description: extra.description?.trim() || null,
              emoji: extra.emoji?.trim() || null,
              // The colour picker is a two-part control; it belongs on the edit panel where
              // there is room for it, not squeezed into a create row four fields wide.
              color: null,
            },
          ])}
        />
      </div>

      {types.length === 0 ? (
        <Card>
          <p className="text-md text-muted">{t.none}</p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="flex flex-col divide-y divide-hairline">
            {types.map((type) => {
              const { className, ...rowProps } = drag.rowProps(type.code);
              return (
              <li key={type.code} {...rowProps} className={`px-4 py-3 sm:px-5 ${className}`}>
                <div className="flex items-center gap-3">
                  <DragHandle
                    label={type.label}
                    disabled={disabled}
                    className="cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
                    {...drag.handleProps(type.code)}
                  />
                  <div className="min-w-0 flex-1">
                <EditableRow
                  rowKey={type.code}
                  disabled={disabled}
                  code={type.code}
                  fields={[
                    { key: 'label', label: settings.name },
                    {
                      key: 'description',
                      label: settings.description,
                      hint: t.descriptionHint,
                    },
                    { key: 'emoji', label: t.emoji, hint: t.emojiHint },
                    {
                      key: 'color',
                      label: t.color,
                      kind: 'color',
                      hint: t.colorHint,
                    },
                  ]}
                  values={{
                    label: type.label,
                    description: type.description ?? '',
                    emoji: type.emoji ?? '',
                    color: type.color ?? '',
                  }}
                  onSave={(next) => put(types.map((row) => (row.code === type.code ? {
                    ...row,
                    label: next.label.trim(),
                    description: next.description.trim() || null,
                    emoji: next.emoji.trim() || null,
                    color: next.color.trim() || null,
                  } : row)))}
                  actions={(
                    <Button
                      variant="inlineDanger"
                      disabled={disabled}
                      onClick={() => put(types.filter((row) => row.code !== type.code))}
                    >
                      {settings.remove}
                    </Button>
                  )}
                >
                  <p className="flex flex-wrap items-center gap-2 text-md text-navy">
                    {type.emoji && <span aria-hidden="true">{type.emoji}</span>}
                    {type.label}
                    {/*
                      * The swatch alone. The hex is on the edit panel, where it is set.
                      *
                      * This does not weaken *"colour is never the only cue"* — that rule is about
                      * colour carrying **status**, and the row's name is right here carrying it.
                      * The swatch is `aria-hidden`, so a screen reader used to announce
                      * *"Training 📚 #2D9CDB"* and the hex was noise to it. `title` keeps the
                      * value a hover away for a sighted reader.
                      */}
                    {type.color && (
                      <span
                        aria-hidden="true"
                        title={type.color}
                        className="inline-block h-3 w-3 rounded-sm border border-hairline"
                        style={{ backgroundColor: type.color }}
                      />
                    )}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2">
                    {type.description && <span className="text-sm text-muted">{type.description}</span>}
                  </p>
                </EditableRow>
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

export interface CampaignKindsPayload {
  rules: {
    kind: string;
    code: string;
    name: string;
    appliesToOrgLevelCodes?: string[];
    criteriaGroups: { mode: string; criteria: { metricKey: string; comparator: string; value: number }[] }[];
    groupMode?: string;
    reward?: string;
    rank: number;
  }[];
}

/** The three kinds a carrier rule can be, in the order a Super Admin thinks about them; their words are `rules.kinds`. */
const RULE_KINDS = ['production_club', 'moc', 'promotion_path'] as const;

/** The comparators a criterion offers, in order; their words are `rules.comparators`. */
const COMPARATORS = ['gte', 'gt', 'lte', 'lt', 'eq'] as const;
const isComparator = (value: string): value is (typeof COMPARATORS)[number] =>
  (COMPARATORS as readonly string[]).includes(value);

/**
 * A company's carrier rules (ADR-0026, ADR-0034, P5-T9 AC-4).
 *
 * **A metric, a comparator and a number — never a display string.** The prototype writes
 * *"Net APE ≥ Rp 600 juta"*, which nothing can evaluate and nothing can refuse, so a campaign could
 * promise a reward against a figure the product never produces.
 *
 * **Publishing this applies it**, rather than seeding a future office: carrier rules are the
 * company's and every office reads them live, so a change reaches the offices that already exist.
 */
export function CampaignKindsEditor({
  payload,
  metrics,
  section,
  onChange,
  disabled,
}: {
  payload: CampaignKindsPayload;
  /**
   * Which rule kind to draw — the screen's subtab row chooses it.
   *
   * The Owner's own Campaigns screen puts these two under one tab as two headings, and the
   * Super Admin's equivalent stacked them the same way. Split, because they answer different
   * questions of the same insurer and a reader comes for one of them.
   */
  section: 'production_club' | 'moc' | 'promotion_path';
  /** The metric registry, so a rule names a metric that exists rather than a typed string. */
  metrics: { key: string; label: string; unit: string }[];
  onChange: (next: CampaignKindsPayload) => void;
  disabled?: boolean;
}) {
  const t = useMessages(adminTemplateEditorMessages).rules;
  const settings = useMessages(settingsMessages);
  const figures = useFigureLanguage();
  const comparators = COMPARATORS.map((value) => ({ value, label: t.comparators[value] }));
  const comparatorLabel = (value: string) => (isComparator(value) ? t.comparators[value] : value);
  const rules = payload.rules ?? [];
  const put = (next: CampaignKindsPayload['rules']) => onChange({ rules: next });
  const patch = (code: string, kind: string, fields: Partial<CampaignKindsPayload['rules'][number]>) =>
    put(rules.map((r) => (r.code === code && r.kind === kind ? { ...r, ...fields } : r)));

  const metricOptions = metrics.map((m) => ({ value: m.key, label: m.label }));
  const metricLabel = (key: string): React.ReactNode => {
    const known = metrics.find((m) => m.key === key)?.label;
    if (known) return known;
    /*
     * A metric the registry does not define is shown as what it is, not hidden: the rule records
     * what it is waiting on, and a screen that dropped it would show a rule that never passes.
     *
     * Its key, then the console's own word for what is not built: **Soon**, the admin nav's pill
     * (`AgencyBoost_Superadmin.html:177`, `admin-shell.tsx`), in the light-ground shape the
     * placeholders' *Upcoming* pill takes. The words behind it are the Owner's for the same rules,
     * *Not measured yet* (`/kpm/settings/campaigns`): a tooltip for a pointer and `sr-only` for a
     * screen reader, the smallest footprint that says it (ADR-0062 §2, forms 2 and 4). It read
     * *"{key} — not in the registry yet"*, a developer's sentence (P10.1-T2, the client's
     * request of 2026-10-01 that what is not ready says so).
     */
    return (
      <>
        {key}
        {' '}
        <span title={t.notMeasured}>
          <ConfigBadge tone="navy" className="text-muted">{t.soon}</ConfigBadge>
        </span>
        <span className="sr-only">{t.notMeasuredSpoken}</span>
      </>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-md text-navy">
          {t.lead}
          {' '}
          <span className="text-muted">{t.detail}</span>
        </p>
      </Card>

      {RULE_KINDS.filter((code) => code === section).map((code) => {
        const kind = { code, ...t.kinds[code] };
        const mine = rules.filter((r) => r.kind === kind.code)
          .sort((a, b) => a.rank - b.rank);
        return (
          <Card key={kind.code} className="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
              <h2 className="font-display text-lg font-bold text-navy">{kind.label}</h2>
              <span className="text-sm text-muted">{kind.blurb}</span>
              <span className="ml-auto">
                <ConfigBadge tone={mine.length > 0 ? 'won' : 'open'}>
                  {t.count({ n: mine.length })}
                </ConfigBadge>
              </span>
            </div>

            <ul className="flex flex-col divide-y divide-hairline">
              {mine.map((rule) => (
                <li key={`${rule.kind}:${rule.code}`} className="px-4 py-3 sm:px-5">
                  <EditableRow
                    rowKey={`${rule.kind}-${rule.code}`}
                    disabled={disabled}
                    code={rule.code}
                    fields={[
                      { key: 'name', label: settings.name },
                      {
                        key: 'rank',
                        label: t.rank,
                        hint: t.rankHint,
                      },
                      { key: 'reward', label: t.reward, hint: t.rewardHint },
                    ]}
                    values={{
                      name: rule.name, rank: String(rule.rank), reward: rule.reward ?? '',
                    }}
                    onSave={(next) => patch(rule.code, rule.kind, {
                      name: next.name.trim(),
                      rank: Number(next.rank) || rule.rank,
                      reward: next.reward.trim(),
                    })}
                    actions={(
                      <Button
                        variant="inlineDanger"
                        disabled={disabled}
                        title={t.removeTip}
                        onClick={() => put(rules.filter(
                          (r) => !(r.code === rule.code && r.kind === rule.kind),
                        ))}
                      >
                        {settings.remove}
                      </Button>
                    )}
                  >
                    <p className="text-md text-navy">{rule.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      <ConfigBadge tone="open">{t.rankBadge({ n: rule.rank })}</ConfigBadge>
                      {rule.reward && <span className="text-sm text-muted">{rule.reward}</span>}
                    </p>
                  </EditableRow>

                  <div className="mt-2 flex flex-col gap-2">
                    {(rule.criteriaGroups ?? []).map((group, g) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <div key={g} className="rounded-sm border border-hairline p-3">
                        <p className="text-sm text-muted">
                          {t.group({
                            join: g > 0 ? (rule.groupMode === 'any' ? 'or' : 'and') : null,
                            mode: group.mode === 'any' ? 'any' : 'all',
                            strong: (words) => <strong>{words}</strong>,
                          })}
                        </p>
                        <ul className="mt-2 flex flex-col divide-y divide-hairline">
                          {group.criteria.map((criterion, c) => (
                            // eslint-disable-next-line react/no-array-index-key
                            <li key={c} className="py-2">
                              <EditableRow
                                rowKey={`${rule.kind}-${rule.code}-${g}-${c}`}
                                disabled={disabled}
                                fields={[
                                  { key: 'metricKey', label: t.metric, options: metricOptions },
                                  { key: 'comparator', label: t.comparison, options: comparators },
                                  {
                                    key: 'value',
                                    label: t.value,
                                    // Rp 1.200.000.000 in the reader's figures; the digits after it are what is typed.
                                    hint: t.moneyInSen({ sum: formatRupiah(120_000_000_000, figures) }),
                                  },
                                ]}
                                values={{
                                  metricKey: criterion.metricKey,
                                  comparator: criterion.comparator,
                                  value: String(criterion.value),
                                }}
                                onSave={(next) => patch(rule.code, rule.kind, {
                                  criteriaGroups: rule.criteriaGroups.map((gr, gi) => (gi === g ? {
                                    ...gr,
                                    criteria: gr.criteria.map((cr, ci) => (ci === c ? {
                                      metricKey: next.metricKey,
                                      comparator: next.comparator,
                                      // A sum in whole digits; anything else a decimal, comma or point (ADR-0167 §1).
                                      value: (metrics.find((m) => m.key === next.metricKey)?.unit === 'idr_minor'
                                        ? Number(next.value.replace(/\D/g, ''))
                                        : parseDecimal(next.value)) || 0,
                                    } : cr)),
                                  } : gr)),
                                })}
                              >
                                <p className="text-md text-navy">
                                  {t.criterion({
                                    metric: metricLabel(criterion.metricKey),
                                    comparator: comparatorLabel(criterion.comparator),
                                    // A rule in words: compact where that loses nothing (ADR-0167 §1), in the
                                    // reader's figures (P18.98-T3).
                                    value: metrics.find((m) => m.key === criterion.metricKey)?.unit === 'idr_minor'
                                      ? formatRupiahCompact(criterion.value, { lossless: true }, figures)
                                      : formatNumber(criterion.value, { maxDecimals: 2 }, figures),
                                  })}
                                </p>
                              </EditableRow>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            <div className="px-4 pb-3 sm:px-5">
              <AddRow
                suggest
                disabled={disabled}
                noun={RULE_NOUN[kind.code]}
                fields={[
                  { key: 'rank', label: t.rank, hint: t.rankAddHint },
                  { key: 'reward', label: t.reward, hint: settings.optional, wide: true },
                ]}
                taken={(code) => rules.some((r) => r.kind === kind.code && r.code === code)}
                onAdd={(code, label, extra) => put([...rules, {
                  kind: kind.code,
                  code,
                  name: label,
                  appliesToOrgLevelCodes: [],
                  // One group with one criterion, because a rule asking for nothing is one
                  // everybody qualifies for on the day it publishes — and publishing refuses it.
                  criteriaGroups: [{
                    mode: 'all',
                    criteria: [{
                      metricKey: metrics[0]?.key ?? 'APE_ACHIEVED', comparator: 'gte', value: 0,
                    }],
                  }],
                  groupMode: 'all',
                  reward: extra.reward?.trim() ?? '',
                  rank: Number(extra.rank) || rules.filter((r) => r.kind === kind.code).length + 1,
                }])}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export interface CapabilityLadderPayload {
  stages: { code: string; label: string; requiredMilestoneCodes: string[]; stageOrder: number }[];
  milestones: { code: string; label: string }[];
  grids: {
    code: string; label: string; requiresDownline?: boolean;
    items: { code: string; label: string }[];
  }[];
}

/**
 * A company's capability ladder (P5-T8, ADR-0025, ADR-0036, P5-T9 AC-4).
 *
 * **Every row carries a code, in all three lists.** Two of the prototype's four grids have no ids
 * at all, so a tick there is bound to the label and correcting a typo orphans every assessment
 * that used it. There is no way to add a row without one here.
 *
 * **A stage's seniority is `stageOrder`, never its position.** The prototype works somebody's stage
 * out from the stage's index in its own array, so tidying the ladder for readability moves
 * everybody. Reordering the list on this screen changes where a stage is drawn and nothing else.
 */
export function CapabilityLadderEditor({
  payload,
  section,
  onChange,
  disabled,
}: {
  payload: CapabilityLadderPayload;
  /**
   * `ladder` draws what a stage **is** — the milestones and the stages that require them.
   * `skills` draws what somebody is assessed **against** — the four grids.
   *
   * Two questions, and the screen used to stack all six cards in one scroll: the four grids
   * are ~27 items between them, so the stage ladder that governs everything sat above a
   * column somebody had to scroll past to reach the thing they came for.
   */
  section: 'ladder' | 'skills';
  onChange: (next: CapabilityLadderPayload) => void;
  disabled?: boolean;
}) {
  const t = useMessages(adminTemplateEditorMessages).capability;
  const settings = useMessages(settingsMessages);
  const office = useMessages(capabilityMessages);
  const rules = useMessages(adminTemplateEditorMessages).rules;
  const stages = payload.stages ?? [];
  const milestones = payload.milestones ?? [];
  const grids = payload.grids ?? [];
  const put = (next: Partial<CapabilityLadderPayload>) =>
    onChange({ stages, milestones, grids, ...next });

  const milestoneLabel = (code: string) =>
    milestones.find((m) => m.code === code)?.label
    // A stage requiring a milestone nobody defines is refused at publish; until then it has to
    // render as what it is rather than vanish, or the refusal will read as coming from nowhere.
    ?? t.undefinedMilestone({ code });

  /*
   * **Three lists, three different answers to "what is the order".**
   *
   * A milestone list has no ordinal — its order is the order a reader scans it in, and
   * provisioning copies the array. A stage's seniority is its `rank`, which is the whole point
   * of the hint above it, so a drag rewrites the rank rather than the position. A grid's items
   * are position-ordered like the milestones, and one row may never land in another grid.
   */
  const milestoneDrag = useRowDrag(
    milestones, (m) => m.code, (next) => put({ milestones: next }), 'position',
  );
  const stageDrag = useRowDrag(
    stages, (s) => s.code, (next) => put({ stages: next }), { field: 'stageOrder' },
  );
  const flatGridItems = grids.flatMap(
    (g) => g.items.map((i) => ({ ...i, gridCode: g.code })),
  );
  const gridDrag = useRowDrag(
    flatGridItems,
    (i) => `${i.gridCode}:${i.code}`,
    (next) => put({
      grids: grids.map((g) => ({
        ...g,
        items: next.filter((i) => i.gridCode === g.code).map(({ gridCode: _gridCode, ...item }) => item),
      })),
    }),
    'position',
    (from, to) => from.gridCode === to.gridCode,
  );

  return (
    <div className="flex flex-col gap-4">
      {section === 'ladder' && (
        <>
        <Card className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
            <h2 className="font-display text-lg font-bold text-navy">{office.milestones}</h2>
            <span className="text-sm text-muted">{t.milestonesLead}</span>
            <span className="ml-auto flex items-center gap-2">
              <ConfigBadge tone={milestones.length > 0 ? 'won' : 'open'}>
                {t.milestones({ n: milestones.length })}
              </ConfigBadge>
              <AddRow
                bare
                suggest
                disabled={disabled}
                noun="milestone"
                taken={(code) => milestones.some((m) => m.code === code)}
                onAdd={(code, label) => put({ milestones: [...milestones, { code, label }] })}
              />
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-hairline">
            {milestones.map((milestone) => {
              const { className: mCls, ...mRow } = milestoneDrag.rowProps(milestone.code);
              return (
              <li key={milestone.code} {...mRow} className={`px-4 py-3 sm:px-5 ${mCls}`}>
                <div className="flex items-start gap-3">
                <DragHandle
                  label={milestone.label}
                  disabled={disabled}
                  className="mt-0.5 cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
                  {...milestoneDrag.handleProps(milestone.code)}
                />
                <div className="min-w-0 flex-1">
                <EditableRow
                  rowKey={milestone.code}
                  disabled={disabled}
                  code={milestone.code}
                  fields={[{ key: 'label', label: settings.name }]}
                  values={{ label: milestone.label }}
                  onSave={(next) => put({
                    milestones: milestones.map((m) => (m.code === milestone.code
                      ? { ...m, label: next.label.trim() } : m)),
                  })}
                  actions={(
                    <Button
                      variant="inlineDanger"
                      disabled={disabled}
                      title={t.milestoneRemoveTip}
                      onClick={() => put({
                        milestones: milestones.filter((m) => m.code !== milestone.code),
                      })}
                    >
                      {settings.remove}
                    </Button>
                  )}
                >
                  <p className="text-md text-navy">{milestone.label}</p>
                </EditableRow>
                </div>
                </div>
              </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
            <h2 className="font-display text-lg font-bold text-navy">{t.stages}</h2>
            <span className="text-sm text-muted">{t.stagesLead}</span>
            <span className="ml-auto flex items-center gap-2">
              <ConfigBadge tone={stages.length > 0 ? 'won' : 'open'}>
                {t.stageCount({ n: stages.length })}
              </ConfigBadge>
              <AddRow
                bare
                suggest
                disabled={disabled}
                noun="stage"
                fields={[{
                  key: 'stageOrder',
                  label: rules.rank,
                  hint: t.stageRankAddHint,
                }]}
                taken={(code) => stages.some((s) => s.code === code)}
                onAdd={(code, label, extra) => put({
                  stages: [...stages, {
                    code,
                    label,
                    requiredMilestoneCodes: [],
                    stageOrder: Number(extra.stageOrder) || stages.length + 1,
                  }],
                })}
              />
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-hairline">
            {[...stages].sort((a, b) => a.stageOrder - b.stageOrder).map((stage) => {
              const { className: sCls, ...sRow } = stageDrag.rowProps(stage.code);
              return (
              <li key={stage.code} {...sRow} className={`px-4 py-3 sm:px-5 ${sCls}`}>
                <div className="flex items-start gap-3">
                <DragHandle
                  label={stage.label}
                  disabled={disabled}
                  className="mt-0.5 cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
                  {...stageDrag.handleProps(stage.code)}
                />
                <div className="min-w-0 flex-1">
                <EditableRow
                  rowKey={stage.code}
                  disabled={disabled}
                  code={stage.code}
                  fields={[
                    { key: 'label', label: settings.name },
                    {
                      key: 'stageOrder',
                      label: rules.rank,
                      hint: t.stageRankHint,
                    },
                  ]}
                  values={{ label: stage.label, stageOrder: String(stage.stageOrder) }}
                  onSave={(next) => put({
                    stages: stages.map((s) => (s.code === stage.code ? {
                      ...s,
                      label: next.label.trim(),
                      stageOrder: Number(next.stageOrder) || s.stageOrder,
                    } : s)),
                  })}
                  actions={(
                    <Button
                      variant="inlineDanger"
                      disabled={disabled}
                      onClick={() => put({ stages: stages.filter((s) => s.code !== stage.code) })}
                    >
                      {settings.remove}
                    </Button>
                  )}
                >
                  <p className="text-md text-navy">{stage.label}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2">
                    <ConfigBadge tone="open">{rules.rankBadge({ n: stage.stageOrder })}</ConfigBadge>
                  </p>
                </EditableRow>

                <fieldset className="mt-2 rounded-sm border border-hairline p-3">
                  <legend className="px-1 text-sm text-muted">{t.reachedBy}</legend>
                  {milestones.length === 0 ? (
                    <p className="text-sm text-muted">{t.milestoneFirst}</p>
                  ) : milestones.map((milestone) => (
                    <label
                      key={milestone.code}
                      className="flex items-center gap-2 py-1 text-md text-navy"
                    >
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={stage.requiredMilestoneCodes.includes(milestone.code)}
                        onChange={(e) => put({
                          stages: stages.map((s) => (s.code === stage.code ? {
                            ...s,
                            requiredMilestoneCodes: e.target.checked
                              ? [...s.requiredMilestoneCodes, milestone.code]
                              : s.requiredMilestoneCodes.filter((c) => c !== milestone.code),
                          } : s)),
                        })}
                      />
                      {milestoneLabel(milestone.code)}
                    </label>
                  ))}
                </fieldset>
                </div>
                </div>
              </li>
              );
            })}
          </ul>
        </Card>
        </>
      )}

      {section === 'skills' && (
        <>
        {grids.map((grid) => (
          <Card key={grid.code} className="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
              <h2 className="font-display text-lg font-bold text-navy">{grid.label}</h2>
              {grid.requiresDownline && (
                <ConfigBadge tone="open">{office.downlineOnly}</ConfigBadge>
              )}
              <span className="ml-auto flex items-center gap-2">
                <ConfigBadge tone={grid.items.length > 0 ? 'won' : 'open'}>
                  {settings.items({ n: grid.items.length })}
                </ConfigBadge>
                <Button
                  variant="inlineDanger"
                  disabled={disabled}
                  onClick={() => put({ grids: grids.filter((g) => g.code !== grid.code) })}
                >
                  {settings.remove}
                </Button>
              </span>
          </div>
          <ul className="flex flex-col divide-y divide-hairline">
            {grid.items.map((item) => {
              const { className: gCls, ...gRow } = gridDrag.rowProps(`${grid.code}:${item.code}`);
              return (
              <li key={item.code} {...gRow} className={`px-4 py-3 sm:px-5 ${gCls}`}>
                <div className="flex items-start gap-3">
                <DragHandle
                  label={item.label}
                  disabled={disabled}
                  className="mt-0.5 cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
                  {...gridDrag.handleProps(`${grid.code}:${item.code}`)}
                />
                <div className="min-w-0 flex-1">
                <EditableRow
                  rowKey={`${grid.code}-${item.code}`}
                  disabled={disabled}
                  code={item.code}
                  fields={[{ key: 'label', label: settings.item }]}
                  values={{ label: item.label }}
                  onSave={(next) => put({
                    grids: grids.map((g) => (g.code === grid.code ? {
                      ...g,
                      items: g.items.map((i) => (i.code === item.code
                        ? { ...i, label: next.label.trim() } : i)),
                    } : g)),
                  })}
                  actions={(
                    <Button
                      variant="inlineDanger"
                      disabled={disabled}
                      onClick={() => put({
                        grids: grids.map((g) => (g.code === grid.code
                          ? { ...g, items: g.items.filter((i) => i.code !== item.code) } : g)),
                      })}
                    >
                      {settings.remove}
                    </Button>
                  )}
                >
                  <p className="text-md text-navy">{item.label}</p>
                </EditableRow>
                </div>
                </div>
              </li>
              );
            })}
          </ul>
          <div className="px-4 pb-3 sm:px-5">
            <AddRow
              suggest
              disabled={disabled}
              noun="item"
              nameLabel={settings.item}
              // Across the whole catalog: a tick names a code, not a code within a grid.
              taken={(code) => grids.some((g) => g.items.some((i) => i.code === code))}
              onAdd={(code, label) => put({
                grids: grids.map((g) => (g.code === grid.code
                  ? { ...g, items: [...g.items, { code, label }] } : g)),
              })}
            />
          </div>
        </Card>
      ))}

      <AddRow
        suggest
        disabled={disabled}
        noun="grid"
        fields={[{
          key: 'requiresDownline',
          label: t.whoItAppliesTo,
          options: [
            { value: '', label: t.everybody },
            { value: 'downline', label: office.downlineOnly },
          ],
          wide: true,
        }]}
        taken={(code) => grids.some((g) => g.code === code)}
        onAdd={(code, label, extra) => put({
          grids: [...grids, {
            code, label, requiresDownline: extra.requiresDownline === 'downline', items: [],
          }],
        })}
      />
        </>
      )}
    </div>
  );
}
