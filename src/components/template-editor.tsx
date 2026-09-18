'use client';

import React, { useState } from 'react';
import {
  Button, Card, CodeField, ColorInput, Field, FieldRow, Select, TextInput,
} from '@/components/ui/field';
import {
  benchmarkFromInput, benchmarkToInput, DISPLAY_UNIT_LABEL, formatBenchmark, reexpress, unitFor,
  type RatioDisplayUnit,
} from '@/lib/ratio-format';
import { SettingsTabs } from '@/components/settings-tabs';
import { ConfigBadge } from '@/components/ui/config-badge';
import { DragHandle } from '@/components/ui/drag-handle';
import { suggestCode } from '@/lib/config-code';

export interface TaxonomyPayload {
  categories: { code: string; label: string; displayOrder: number }[];
  types: {
    code: string; categoryCode: string; label: string;
    description: string | null; displayOrder: number;
  }[];
}

export interface PipelinePayload {
  statuses: {
    pipeline: 'sales' | 'recruitment'; code: string; label: string;
    rank: number; isTerminal: boolean;
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
   */
  ordinal: { field: string; groupOf?: (row: T) => string },
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
    onReorder(withOrdinals(next, ordinal.field, ordinal.groupOf));
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
  }[];
  values: Record<string, string>;
  onSave: (next: Record<string, string>) => void;
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);

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
            onClick={() => { setDraft(values); setEditing(true); }}
          >
            Edit
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
          reason="Permanent. Everything that refers to this row refers to its code."
        />
      )}
      {fields.map((field) => {
        const change = (value: string) => {
          const next = { ...draft, [field.key]: value };
          setDraft(reshape ? reshape(next, field.key, draft) : next);
        };
        return (
          <Field key={field.key} label={field.label} htmlFor={id(field.key)} hint={field.hint}>
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
          onClick={() => { onSave(draft); setEditing(false); }}
        >
          Save
        </Button>
        <Button variant="secondary" disabled={disabled} onClick={() => setEditing(false)}>
          Cancel
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
  const categories = payload.categories ?? [];
  const types = payload.types ?? [];

  const patchType = (code: string, fields: Partial<TaxonomyPayload['types'][number]>) => onChange({
    ...payload,
    types: types.map((t) => (t.code === code ? { ...t, ...fields } : t)),
  });

  /** A section's name, which nothing could change until now — a typo was permanent. */
  const patchCategory = (code: string, fields: Partial<TaxonomyPayload['categories'][number]>) =>
    onChange({
      ...payload,
      categories: categories.map((c) => (c.code === code ? { ...c, ...fields } : c)),
    });

  const drag = useRowDrag(
    types,
    (t) => t.code,
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
          {types.length} activity {types.length === 1 ? 'type' : 'types'} across
          {' '}{categories.length} {categories.length === 1 ? 'section' : 'sections'}
        </p>
        <AddRow
          bare
          disabled={disabled}
          what="section"
          onAdd={(code, label) => onChange({
            ...payload,
            categories: withOrdinals(
              [...categories, { code, label, displayOrder: 0 }],
              'displayOrder',
            ),
          })}
        />
      </div>

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
                <EditableRow
                  rowKey={`section-${category.code}`}
                  disabled={disabled}
                  code={category.code}
                  fields={[{ key: 'label', label: 'Name' }]}
                  values={{ label: category.label }}
                  onSave={(next) => patchCategory(category.code, { label: next.label.trim() })}
                  badge={(
                    <ConfigBadge tone={mine.length > 0 ? 'won' : 'open'}>
                      {mine.length} {mine.length === 1 ? 'item' : 'items'}
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
                        { key: 'label', label: 'Name' },
                        {
                          key: 'description',
                          label: 'Description',
                          hint: "Optional. Shown under the name on the agent's screen.",
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
                              types.filter((t) => t.code !== type.code),
                              'displayOrder',
                            ),
                          })}
                        >
                          Remove
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
              what="activity type"
              fields={[{
                key: 'description',
                label: 'Description',
                hint: "Optional. Shown under the name on the agent's screen.",
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
    </div>
  );
}

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
 */
function AddRow({
  what,
  onAdd,
  disabled,
  bare,
  suggest,
  taken,
  nameLabel = 'Name',
  fields = [],
}: {
  what: string;
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
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  const [label, setLabel] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>({});
  const clash = code.trim() !== '' && (taken?.(code.trim().toUpperCase()) ?? false);
  /*
   * `what` is prose — *"activity type"* — and it was going straight into a DOM id, so the
   * field's id was `add-code-activity type`. A space is a separator in `aria-describedby`
   * and in `for`, which makes the hint point at two ids that do not exist.
   */
  const slug = what.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  /** *an aspect*, *an item*, *a category* — the button said it correctly and the refusal did not. */
  const article = /^[aeiou]/i.test(what) ? 'an' : 'a';

  if (!open) {
    return (
      <Button
        variant="secondary"
        className={bare ? undefined : 'mt-3'}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Add {article} {what}
      </Button>
    );
  }

  const name = (
    <Field label={nameLabel} htmlFor={`add-label-${slug}`} className="min-w-60 flex-1">
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
        label="Code"
        htmlFor={`add-code-${slug}`}
        hint={suggest ? 'Filled in from the name. Permanent once published.' : 'Permanent once published.'}
        error={clash ? `This template already has ${article} ${what} with this code.` : undefined}
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
          Add
        </Button>
        <Button variant="secondary" disabled={disabled} onClick={() => setOpen(false)}>Cancel</Button>
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
 */
export function PipelineEditor({
  payload,
  onChange,
  disabled,
}: {
  payload: PipelinePayload;
  onChange: (next: PipelinePayload) => void;
  disabled?: boolean;
}) {
  const [tab, setTab] = useState<'sales' | 'recruitment'>('sales');
  /*
   * A template that nobody has authored yet arrives as `payload: {}`.
   *
   * The dispatch in the template screen casts each payload with `as unknown as`, which
   * tells TypeScript the arrays are there and cannot check that they are — so an
   * unauthored preset took the whole screen down on `.filter of undefined` rather than
   * rendering as the empty thing it is. Empty is a real state for every one of these.
   */
  const allStatuses = payload.statuses ?? [];
  const mine = allStatuses.filter((s) => s.pipeline === tab);

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
      <SettingsTabs
        tabs={[
          { label: 'Sales', href: 'sales' },
          { label: 'Recruitment', href: 'recruitment' },
        ]}
        activeHref={tab}
        onSelect={(href) => setTab(href as 'sales' | 'recruitment')}
      />

      <p className="mb-4 text-sm text-muted">
        {mine.length} {mine.length === 1 ? 'status' : 'statuses'} — order determines the
        pipeline stage sequence.
      </p>

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
                  fields={[{ key: 'label', label: 'Name' }]}
                  badge={stage.isTerminal ? (
                    <ConfigBadge tone="won">Closes the pipeline</ConfigBadge>
                  ) : (
                    <ConfigBadge tone="open">Open</ConfigBadge>
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
                {!stage.isTerminal && (
                  <Button
                    variant="inline"
                    disabled={disabled}
                    onClick={() => onChange({
                      // Exactly one per pipeline: publishing refuses anything else, so the
                      // screen never lets a second one be set.
                      statuses: allStatuses.map((s) => (s.pipeline === tab
                        ? { ...s, isTerminal: s.code === stage.code }
                        : s)),
                    })}
                  >
                    Make this close it
                  </Button>
                )}
                <Button
                  variant="inlineDanger"
                  disabled={disabled || stage.isTerminal}
                  title={stage.isTerminal ? 'Make another stage close the pipeline first.' : undefined}
                  onClick={() => onChange({
                    statuses: withOrdinals(
                      allStatuses.filter((s) => s.code !== stage.code),
                      'rank',
                      (st) => st.pipeline,
                    ),
                  })}
                >
                  Remove
                </Button>
              </span>
            </li>
            );
          })}
        </ul>

        <AddRow
          disabled={disabled}
          what={`${tab} stage`}
          onAdd={(code, label) => onChange({
            // Appended, and never terminal: exactly one stage closes each pipeline, and
            // moving that is a deliberate second act rather than a side effect of adding.
            // Renumbered per pipeline: `mine.length + 1` collides with a rank that is
            // still in use as soon as a stage has been removed.
            statuses: withOrdinals(
              [...allStatuses, {
                pipeline: tab, code, label, rank: 0, isTerminal: false,
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
  return (
    <fieldset className="min-w-0 flex-1">
      <legend className="text-sm font-semibold text-navy">{heading}</legend>
      {available.length === 0 ? (
        // The taxonomy tab has nothing yet, or could not be read. Showing the codes it
        // already holds beats an empty box that looks like a broken control.
        <p className="mt-1 text-sm text-muted">
          {codes.length ? codes.join(' + ') : 'Nothing yet.'} — add activity types on the
          Activity types tab first.
        </p>
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
              { key: 'label', label: 'Name' },
              {
                key: 'benchmark',
                label: ratio.comparison === 'band' ? 'Within, either side' : 'On track at or above',
                hint: ratio.comparison === 'band'
                  ? 'Percentage points either side of an even split.'
                  : 'Typed the way it is shown — 15 for 15.0% as a percentage, 0.30 as a number.',
              },
              // A band is points and has no other way to be written, so it gets no choice.
              ...(ratio.comparison === 'band' ? [] : [{
                key: 'displayUnit',
                label: 'Shown as',
                options: [
                  { value: 'percent', label: DISPLAY_UNIT_LABEL.percent },
                  { value: 'decimal', label: DISPLAY_UNIT_LABEL.decimal },
                ],
              }]),
            ]}
            values={{
              label: ratio.label,
              benchmark: benchmarkToInput(ratio.benchmark, unitFor(ratio)),
              displayUnit: unitFor(ratio),
            }}
            reshape={(next, changed, previous) => (changed === 'displayUnit'
              ? {
                ...next,
                benchmark: reexpress(
                  previous.benchmark,
                  previous.displayUnit as RatioDisplayUnit,
                  next.displayUnit as RatioDisplayUnit,
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
                Remove
              </Button>
            )}
          >
            <p className="text-md font-semibold text-navy">{ratio.label}</p>
            <p className="text-sm text-muted">
              {ratio.comparison === 'band' ? 'On track within ' : 'On track at or above '}
              <strong>{formatBenchmark(ratio.benchmark, unitFor(ratio))}</strong>
            </p>
          </EditableRow>

          <div className="mt-3 flex flex-wrap gap-4 border-t border-hairline pt-3">
            <FormulaSide
              heading="Counts"
              codes={ratio.numerator}
              available={available}
              disabled={disabled}
              onChange={(numerator) => patch(ratio.code, { numerator })}
            />
            <FormulaSide
              heading="Out of"
              codes={ratio.denominator}
              available={available}
              disabled={disabled}
              onChange={(denominator) => patch(ratio.code, { denominator })}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            This is what every new office of this company starts from, and what a comparison
            across offices is computed with. An office may change its own copy afterwards
            (ADR-0024) — its screen says so when it has, and the comparison still uses this.
            Changing it here changes what the <strong>next</strong> office starts from;
            offices already created keep the copy they were built with.
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
            Remove
          </Button>
        </Card>
        );
      })}

      <AddRow
        disabled={disabled}
        what="ratio"
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

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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
  onChange,
  disabled,
}: {
  payload: TrainingTaxonomyPayload;
  onChange: (next: TrainingTaxonomyPayload) => void;
  disabled?: boolean;
}) {
  const [tab, setTab] = useState<TrainingTab>('categories');
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
          <p className="text-sm text-muted">{count(categories.length, 'category', 'categories')}</p>
          <AddRow
            bare
            suggest
            disabled={disabled}
            what="category"
            fields={[{
              key: 'description',
              label: 'Description',
              hint: 'Optional. Agents read it under the category.',
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
          {categories.length === 0 ? empty('No training categories yet.') : (
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
                        { key: 'label', label: 'Name' },
                        {
                          key: 'description',
                          label: 'Description',
                          hint: "Optional. Shown under the name on the agent's training screen.",
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
                          title={mine.length > 0 ? 'Remove its skills first.' : undefined}
                          onClick={() => put({ categories: categories.filter((c) => c.code !== category.code) })}
                        >
                          Remove
                        </Button>
                      )}
                      badge={mine.length === 0
                        ? <ConfigBadge tone="open">Empty</ConfigBadge>
                        : (
                          <ConfigBadge tone={offered > 0 ? 'won' : 'open'}>
                            {count(mine.length, 'skill', 'skills')} · {count(offered, 'module', 'modules')} published
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
            <label htmlFor="template-training-skills-category" className={filterLabel}>Category</label>
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
              what="skill"
              taken={(code) => skills.some((s) => s.code === code)}
              onAdd={(code, label) => put({
                skills: [...skills, { code, categoryCode: skillsTabCategory.code, label }],
              })}
            />
          )}
        </div>
        <Card className="p-0">
          {!skillsTabCategory ? empty('Add a category first — a skill always sits in one.')
            : mine.length === 0 ? empty('No skills for this category yet.') : (
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
                          { key: 'label', label: 'Name' },
                          {
                            key: 'categoryCode',
                            label: 'Category',
                            hint: 'Its modules move with it.',
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
                            title={teaching.length > 0 ? 'Remove its modules first.' : undefined}
                            onClick={() => put({ skills: skills.filter((s) => s.code !== skill.code) })}
                          >
                            Remove
                          </Button>
                        )}
                        badge={(
                          <ConfigBadge tone={teaching.length > 0 ? 'won' : 'open'}>
                            {count(teaching.length, 'module', 'modules')}
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
              <label htmlFor="template-training-modules-category" className={filterLabel}>Category</label>
              <Select
                id="template-training-modules-category"
                value={modulesTabCategory?.code ?? ''}
                onChange={(e) => { setModulesCategory(e.target.value); setModulesSkill('all'); }}
              >
                {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </Select>
            </span>
            <span className={pair}>
              <label htmlFor="template-training-modules-skill" className={filterLabel}>Skill</label>
              <Select
                id="template-training-modules-skill"
                value={modulesTabSkill}
                onChange={(e) => setModulesSkill(e.target.value)}
              >
                <option value="all">All skills</option>
                {modulesTabSkills.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
              </Select>
            </span>
          </div>
          {/* A module teaches one skill, so it is added to the one chosen — "All skills" names none. */}
          {modulesTabSkill === 'all' ? (
            <p className="text-sm text-muted">Choose a skill to add a module to it.</p>
          ) : (
            <AddRow
              bare
              suggest
              disabled={disabled}
              what="module"
              nameLabel="Title"
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
          {rows.length === 0 ? empty('No modules for this category/skill yet.') : (
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
                        { key: 'title', label: 'Title' },
                        {
                          key: 'skillCode',
                          label: 'Skill',
                          options: skills.map((s) => ({
                            value: s.code, label: `${categoryLabel(s.categoryCode)} › ${s.label}`,
                          })),
                        },
                        {
                          key: 'publishState',
                          label: 'Publish state',
                          hint: 'Whether an office made from this template offers it to agents.',
                          options: [
                            { value: 'draft', label: 'Draft' },
                            { value: 'published', label: 'Published' },
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
                          {isPublished ? 'Published' : 'Draft'}
                        </ConfigBadge>
                      )}
                      actions={(
                        <Button
                          variant="inlineDanger"
                          disabled={disabled}
                          onClick={() => put({ modules: modules.filter((m) => m.code !== module.code) })}
                        >
                          Remove
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
      <SettingsTabs
        variant="subtabs"
        label="Training template sections"
        tabs={[
          { label: 'Categories', href: '#categories' },
          { label: 'Skills', href: '#skills' },
          { label: 'Modules', href: '#modules' },
        ]}
        activeHref={`#${tab}`}
        onSelect={(href) => setTab(href.slice(1) as TrainingTab)}
      />
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

/** The three feature links, which exist for every company. Training links name a module code. */
const ACTIVATION_FEATURE_OPTIONS = [
  { value: '', label: 'No link (manual)' },
  { value: 'feature:goals', label: 'Goal Settings' },
  { value: 'feature:leads', label: 'Leads Management' },
  { value: 'feature:activity', label: 'Activity Management' },
];

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
  onChange,
  disabled,
}: {
  payload: ActivationChecklistPayload;
  /** The company's own training modules, for the link picker. */
  modules: { code: string; title: string }[];
  onChange: (next: ActivationChecklistPayload) => void;
  disabled?: boolean;
}) {
  // A template nobody has authored yet arrives as `payload: {}`; empty is a real state.
  const aspects = payload.aspects ?? [];
  const put = (next: ActivationChecklistPayload['aspects']) => onChange({ aspects: next });

  const linkOptions = [
    ...ACTIVATION_FEATURE_OPTIONS,
    ...modules.map((m) => ({ value: `training:${m.code}`, label: `Training · ${m.title}` })),
  ];
  const linkLabel = (link: string | null | undefined) =>
    linkOptions.find((o) => o.value === (link ?? ''))?.label
    // A module this company's taxonomy no longer defines still has to render as something.
    ?? `Training · ${String(link).replace(/^training:/, '')}`;

  const patchAspect = (code: string, fields: Partial<ActivationChecklistPayload['aspects'][number]>) =>
    put(aspects.map((a) => (a.code === code ? { ...a, ...fields } : a)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {count(aspects.flatMap((a) => a.items).length, 'item', 'items')} across
          {' '}{count(aspects.length, 'aspect', 'aspects')}
        </p>
        <AddRow
          bare
          suggest
          disabled={disabled}
          what="aspect"
          taken={(code) => aspects.some((a) => a.code === code)}
          onAdd={(code, label) => put([...aspects, { code, label, items: [] }])}
        />
      </div>

      {aspects.length === 0 ? (
        <Card><p className="text-md text-muted">No aspects yet.</p></Card>
      ) : aspects.map((aspect) => (
        <Card key={aspect.code} className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              {/* Renameable, which it was not: a typo in an aspect's name could only be fixed by
                  removing the aspect and every item under it. */}
              <EditableRow
                rowKey={`aspect-${aspect.code}`}
                disabled={disabled}
                code={aspect.code}
                fields={[{ key: 'label', label: 'Name' }]}
                values={{ label: aspect.label }}
                onSave={(next) => patchAspect(aspect.code, { label: next.label.trim() })}
                badge={(
                  <ConfigBadge tone={aspect.items.length > 0 ? 'won' : 'open'}>
                    {count(aspect.items.length, 'item', 'items')}
                  </ConfigBadge>
                )}
              >
                <h3 className="font-display text-lg font-bold text-navy">{aspect.label}</h3>
              </EditableRow>
            </div>
            <span className="flex flex-wrap items-center gap-2">
{/* With its items, as the Owner's own screen removes one: an aspect holding none is a
                  state neither an office nor a template may publish. */}
              <Button
                variant="inlineDanger"
                disabled={disabled}
                title={`Removes ${aspect.label} and its ${aspect.items.length} `
                  + `${aspect.items.length === 1 ? 'item' : 'items'}.`}
                onClick={() => put(aspects.filter((a) => a.code !== aspect.code))}
              >
                Remove
              </Button>
            </span>
          </div>

          <ul className="flex flex-col divide-y divide-hairline">
            {aspect.items.map((item) => (
              <li key={item.code} className="px-4 py-3 sm:px-5">
                <EditableRow
                  rowKey={item.code}
                  disabled={disabled}
                  code={item.code}
                  fields={[
                    { key: 'label', label: 'Item' },
                    {
                      key: 'autoLink',
                      label: 'Completes from',
                      hint: 'A linked item completes on its own once the evaluator for that link ships.',
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
                      Remove
                    </Button>
                  )}
                >
                  <p className="text-md text-navy">{item.label}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2">
                    {item.autoLink
                      ? <ConfigBadge tone="won">Auto · {linkLabel(item.autoLink)}</ConfigBadge>
                      : <ConfigBadge tone="open">Ticked by the leader</ConfigBadge>}
                  </p>
                </EditableRow>
              </li>
            ))}
          </ul>

          <div className="px-4 pb-3 sm:px-5">
            <AddRow
              suggest
              disabled={disabled}
              what="item"
              nameLabel="Item"
              fields={[{
                key: 'autoLink',
                label: 'Completes from',
                hint: 'A linked item completes on its own once the evaluator for that link ships.',
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
      ))}
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
  // A template nobody has authored yet arrives as `payload: {}`; empty is a real state.
  const types = payload.types ?? [];
  const put = (next: EventTypesPayload['types']) => onChange({ types: next });
  const drag = useRowDrag(types, (t) => t.code, put, { field: 'displayOrder' });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {count(types.length, 'type', 'types')} every new office of this company starts with
        </p>
        <AddRow
          bare
          suggest
          disabled={disabled}
          what="event type"
          fields={[
            { key: 'description', label: 'Description', hint: 'Optional.', wide: true },
            { key: 'emoji', label: 'Emoji', hint: 'Optional. One character.' },
          ]}
          taken={(code) => types.some((t) => t.code === code)}
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
          <p className="text-md text-muted">
            No types yet. An office with none has nothing to file an event under, so publishing
            an empty list is refused.
          </p>
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
                    { key: 'label', label: 'Name' },
                    {
                      key: 'description',
                      label: 'Description',
                      hint: 'Optional. Shown under the name on the office’s own settings screen.',
                    },
                    { key: 'emoji', label: 'Emoji', hint: 'Optional. One character, for the list.' },
                    {
                      key: 'color',
                      label: 'Color',
                      kind: 'color',
                      hint: 'Optional. Pick one, or paste a colour your company already uses.',
                    },
                  ]}
                  values={{
                    label: type.label,
                    description: type.description ?? '',
                    emoji: type.emoji ?? '',
                    color: type.color ?? '',
                  }}
                  onSave={(next) => put(types.map((t) => (t.code === type.code ? {
                    ...t,
                    label: next.label.trim(),
                    description: next.description.trim() || null,
                    emoji: next.emoji.trim() || null,
                    color: next.color.trim() || null,
                  } : t)))}
                  actions={(
                    <Button
                      variant="inlineDanger"
                      disabled={disabled}
                      onClick={() => put(types.filter((t) => t.code !== type.code))}
                    >
                      Remove
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

/** The three kinds a carrier rule can be, in the order a Super Admin thinks about them. */
const RULE_KINDS = [
  { code: 'production_club', label: 'Production clubs', blurb: 'Annual recognition tiers.' },
  { code: 'moc', label: 'Maintenance of Contract', blurb: 'What a contract has to keep meeting.' },
  { code: 'promotion_path', label: 'Promotion paths', blurb: 'What a promotion asks for.' },
];

const COMPARATORS = [
  { value: 'gte', label: 'at least (≥)' },
  { value: 'gt', label: 'more than (>)' },
  { value: 'lte', label: 'at most (≤)' },
  { value: 'lt', label: 'less than (<)' },
  { value: 'eq', label: 'exactly (=)' },
];

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
  onChange,
  disabled,
}: {
  payload: CampaignKindsPayload;
  /** The metric registry, so a rule names a metric that exists rather than a typed string. */
  metrics: { key: string; label: string; unit: string }[];
  onChange: (next: CampaignKindsPayload) => void;
  disabled?: boolean;
}) {
  const rules = payload.rules ?? [];
  const put = (next: CampaignKindsPayload['rules']) => onChange({ rules: next });
  const patch = (code: string, kind: string, fields: Partial<CampaignKindsPayload['rules'][number]>) =>
    put(rules.map((r) => (r.code === code && r.kind === kind ? { ...r, ...fields } : r)));

  const metricOptions = metrics.map((m) => ({ value: m.key, label: m.label }));
  const metricLabel = (key: string) =>
    metrics.find((m) => m.key === key)?.label
    // A metric the registry does not define is shown as what it is, not hidden: the rule records
    // what it is waiting on, and a screen that dropped it would show a rule that never passes.
    ?? `${key} — not in the registry yet`;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-md text-navy">
          These are the insurer&rsquo;s own rules, and every office of this company reads them.
          {' '}
          <span className="text-muted">
            An office cannot edit or delete one. Publishing here reaches the offices that already
            exist, not only the ones created afterwards — so a threshold you change today is the
            one every standing is measured against tomorrow.
          </span>
        </p>
      </Card>

      {RULE_KINDS.map((kind) => {
        const mine = rules.filter((r) => r.kind === kind.code)
          .sort((a, b) => a.rank - b.rank);
        return (
          <Card key={kind.code} className="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
              <h2 className="font-display text-lg font-bold text-navy">{kind.label}</h2>
              <span className="text-sm text-muted">{kind.blurb}</span>
              <span className="ml-auto">
                <ConfigBadge tone={mine.length > 0 ? 'won' : 'open'}>
                  {count(mine.length, 'rule', 'rules')}
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
                      { key: 'name', label: 'Name' },
                      {
                        key: 'rank',
                        label: 'Rank',
                        hint: 'The order the tiers are climbed in. Two rules at one rank is refused.',
                      },
                      { key: 'reward', label: 'Reward', hint: 'Optional. What qualifying earns.' },
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
                        title="Removing it here retires it on publish. Standings that qualified under it stay readable."
                        onClick={() => put(rules.filter(
                          (r) => !(r.code === rule.code && r.kind === rule.kind),
                        ))}
                      >
                        Remove
                      </Button>
                    )}
                  >
                    <p className="text-md text-navy">{rule.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      <ConfigBadge tone="open">Rank {rule.rank}</ConfigBadge>
                      {rule.reward && <span className="text-sm text-muted">{rule.reward}</span>}
                    </p>
                  </EditableRow>

                  <div className="mt-2 flex flex-col gap-2">
                    {(rule.criteriaGroups ?? []).map((group, g) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <div key={g} className="rounded-sm border border-hairline p-3">
                        <p className="text-sm text-muted">
                          {g > 0 && <strong>{rule.groupMode === 'any' ? 'or ' : 'and '}</strong>}
                          {group.mode === 'any' ? 'any one of these' : 'all of these'}
                        </p>
                        <ul className="mt-2 flex flex-col divide-y divide-hairline">
                          {group.criteria.map((criterion, c) => (
                            // eslint-disable-next-line react/no-array-index-key
                            <li key={c} className="py-2">
                              <EditableRow
                                rowKey={`${rule.kind}-${rule.code}-${g}-${c}`}
                                disabled={disabled}
                                fields={[
                                  { key: 'metricKey', label: 'Metric', options: metricOptions },
                                  { key: 'comparator', label: 'Comparison', options: COMPARATORS },
                                  {
                                    key: 'value',
                                    label: 'Value',
                                    hint: 'Money is in sen — Rp 1.200.000.000 is 120000000000.',
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
                                      value: Number(next.value) || 0,
                                    } : cr)),
                                  } : gr)),
                                })}
                              >
                                <p className="text-md text-navy">
                                  {metricLabel(criterion.metricKey)}
                                  {' '}
                                  {COMPARATORS.find((o) => o.value === criterion.comparator)?.label
                                    ?? criterion.comparator}
                                  {' '}
                                  {criterion.value.toLocaleString('id-ID')}
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
                what={`${kind.label.toLowerCase()} rule`}
                fields={[
                  { key: 'rank', label: 'Rank', hint: 'The order the tiers are climbed in.' },
                  { key: 'reward', label: 'Reward', hint: 'Optional.', wide: true },
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
  onChange,
  disabled,
}: {
  payload: CapabilityLadderPayload;
  onChange: (next: CapabilityLadderPayload) => void;
  disabled?: boolean;
}) {
  const stages = payload.stages ?? [];
  const milestones = payload.milestones ?? [];
  const grids = payload.grids ?? [];
  const put = (next: Partial<CapabilityLadderPayload>) =>
    onChange({ stages, milestones, grids, ...next });

  const milestoneLabel = (code: string) =>
    milestones.find((m) => m.code === code)?.label
    // A stage requiring a milestone nobody defines is refused at publish; until then it has to
    // render as what it is rather than vanish, or the refusal will read as coming from nowhere.
    ?? `${code} — no milestone defines this`;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
          <h2 className="font-display text-lg font-bold text-navy">Milestones</h2>
          <span className="text-sm text-muted">What a stage is reached by.</span>
          <span className="ml-auto flex items-center gap-2">
            <ConfigBadge tone={milestones.length > 0 ? 'won' : 'open'}>
              {count(milestones.length, 'milestone', 'milestones')}
            </ConfigBadge>
            <AddRow
              bare
              suggest
              disabled={disabled}
              what="milestone"
              taken={(code) => milestones.some((m) => m.code === code)}
              onAdd={(code, label) => put({ milestones: [...milestones, { code, label }] })}
            />
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-hairline">
          {milestones.map((milestone) => (
            <li key={milestone.code} className="px-4 py-3 sm:px-5">
              <EditableRow
                rowKey={milestone.code}
                disabled={disabled}
                code={milestone.code}
                fields={[{ key: 'label', label: 'Name' }]}
                values={{ label: milestone.label }}
                onSave={(next) => put({
                  milestones: milestones.map((m) => (m.code === milestone.code
                    ? { ...m, label: next.label.trim() } : m)),
                })}
                actions={(
                  <Button
                    variant="inlineDanger"
                    disabled={disabled}
                    title="A stage that requires it will be refused at publish until you change that too."
                    onClick={() => put({
                      milestones: milestones.filter((m) => m.code !== milestone.code),
                    })}
                  >
                    Remove
                  </Button>
                )}
              >
                <p className="text-md text-navy">{milestone.label}</p>
              </EditableRow>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
          <h2 className="font-display text-lg font-bold text-navy">Stages</h2>
          <span className="text-sm text-muted">
            Seniority is the rank, not the position on this page.
          </span>
          <span className="ml-auto flex items-center gap-2">
            <ConfigBadge tone={stages.length > 0 ? 'won' : 'open'}>
              {count(stages.length, 'stage', 'stages')}
            </ConfigBadge>
            <AddRow
              bare
              suggest
              disabled={disabled}
              what="stage"
              fields={[{
                key: 'stageOrder',
                label: 'Rank',
                hint: 'How senior the stage is. Two stages at one rank is refused.',
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
          {[...stages].sort((a, b) => a.stageOrder - b.stageOrder).map((stage) => (
            <li key={stage.code} className="px-4 py-3 sm:px-5">
              <EditableRow
                rowKey={stage.code}
                disabled={disabled}
                code={stage.code}
                fields={[
                  { key: 'label', label: 'Name' },
                  {
                    key: 'stageOrder',
                    label: 'Rank',
                    hint: 'How senior the stage is. Two stages at one rank is refused at publish.',
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
                    Remove
                  </Button>
                )}
              >
                <p className="text-md text-navy">{stage.label}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2">
                  <ConfigBadge tone="open">Rank {stage.stageOrder}</ConfigBadge>
                </p>
              </EditableRow>

              <fieldset className="mt-2 rounded-sm border border-hairline p-3">
                <legend className="px-1 text-sm text-muted">Reached by</legend>
                {milestones.length === 0 ? (
                  <p className="text-sm text-muted">
                    Add a milestone first — a stage requiring none is one everybody is already on.
                  </p>
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
            </li>
          ))}
        </ul>
      </Card>

      {grids.map((grid) => (
        <Card key={grid.code} className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3 sm:px-5">
            <h2 className="font-display text-lg font-bold text-navy">{grid.label}</h2>
            {grid.requiresDownline && (
              <ConfigBadge tone="open">Only for somebody with a downline</ConfigBadge>
            )}
            <span className="ml-auto flex items-center gap-2">
              <ConfigBadge tone={grid.items.length > 0 ? 'won' : 'open'}>
                {count(grid.items.length, 'item', 'items')}
              </ConfigBadge>
              <Button
                variant="inlineDanger"
                disabled={disabled}
                onClick={() => put({ grids: grids.filter((g) => g.code !== grid.code) })}
              >
                Remove
              </Button>
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-hairline">
            {grid.items.map((item) => (
              <li key={item.code} className="px-4 py-3 sm:px-5">
                <EditableRow
                  rowKey={`${grid.code}-${item.code}`}
                  disabled={disabled}
                  code={item.code}
                  fields={[{ key: 'label', label: 'Item' }]}
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
                      Remove
                    </Button>
                  )}
                >
                  <p className="text-md text-navy">{item.label}</p>
                </EditableRow>
              </li>
            ))}
          </ul>
          <div className="px-4 pb-3 sm:px-5">
            <AddRow
              suggest
              disabled={disabled}
              what="item"
              nameLabel="Item"
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
        what="grid"
        fields={[{
          key: 'requiresDownline',
          label: 'Who it applies to',
          options: [
            { value: '', label: 'Everybody' },
            { value: 'downline', label: 'Only somebody with a downline' },
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
    </div>
  );
}
