'use client';

import React, { useState } from 'react';
import { Button, Card, Field, TextInput } from '@/components/ui/field';
import { SettingsTabs } from '@/components/settings-tabs';
import { DragHandle } from '@/components/ui/drag-handle';

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
  disabled,
  children,
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
  fields: { key: string; label: string; hint?: string }[];
  values: Record<string, string>;
  onSave: (next: Record<string, string>) => void;
  disabled?: boolean;
  /** What the row reads as when it is not being edited. */
  children: React.ReactNode;
  /** Row controls that stay available either way. */
  actions?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <span className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
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
      {fields.map((field) => (
        <Field key={field.key} label={field.label} htmlFor={id(field.key)} hint={field.hint}>
          <TextInput
            id={id(field.key)}
            value={draft[field.key] ?? ''}
            disabled={disabled}
            onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
          />
        </Field>
      ))}
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
              <h2 className="font-display text-lg font-bold text-navy">{category.label}</h2>
              <span className="ml-auto flex items-center gap-2">
                <code className="text-sm text-muted">{category.code}</code>
                <span className="whitespace-nowrap rounded-full border border-hairline bg-canvas px-2 py-0.5 text-sm font-semibold text-muted">
                  {mine.length} {mine.length === 1 ? 'item' : 'items'}
                </span>
              </span>
            </div>

            <ul className="mt-3 flex flex-col divide-y divide-hairline">
              {mine.map((type, index) => {
                const { className, ...rowProps } = drag.rowProps(type.code);
                return (
                <li
                  key={type.code}
                  {...rowProps}
                  className={`flex flex-wrap items-start gap-3 py-3 ${className}`}
                >
                  <DragHandle
                    label={type.label}
                    disabled={disabled}
                    className="mt-1 cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
                    {...drag.handleProps(type.code)}
                  />
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-navy text-sm font-bold text-navy"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <EditableRow
                      rowKey={type.code}
                      disabled={disabled}
                      fields={[
                        { key: 'label', label: 'Name', hint: type.code },
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
                          variant="secondary"
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
                      <code className="text-sm text-muted">{type.code}</code>
                    </EditableRow>
                  </div>
                </li>
                );
              })}
            </ul>

            <AddRow
              disabled={disabled}
              what="activity type"
              onAdd={(code, label) => onChange({
                ...payload,
                // Renumbered rather than counted: `types.length + 1` counts across
                // every section and collides with an existing number after any removal.
                types: withOrdinals(
                  [...types, {
                    code, categoryCode: category.code, label, description: null,
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
}: {
  what: string;
  onAdd: (code: string, label: string) => void;
  disabled?: boolean;
  /** Drops the divider and top margin, for a row that already sits in a toolbar. */
  bare?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  /*
   * `what` is prose — *"activity type"* — and it was going straight into a DOM id, so the
   * field's id was `add-code-activity type`. A space is a separator in `aria-describedby`
   * and in `for`, which makes the hint point at two ids that do not exist.
   */
  const slug = what.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  if (!open) {
    return (
      <Button
        variant="secondary"
        className={bare ? undefined : 'mt-3'}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Add {/^[aeiou]/i.test(what) ? 'an' : 'a'} {what}
      </Button>
    );
  }

  return (
    <div className={bare
      ? 'flex flex-wrap items-end gap-3'
      : 'mt-3 flex flex-wrap items-end gap-3 border-t border-hairline pt-3'}
    >
      <Field label="Code" htmlFor={`add-code-${slug}`} hint="Permanent once published." className="min-w-48">
        <TextInput
          id={`add-code-${slug}`}
          value={code}
          disabled={disabled}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </Field>
      <Field label="Name" htmlFor={`add-label-${slug}`} className="min-w-60 flex-1">
        <TextInput
          id={`add-label-${slug}`}
          value={label}
          disabled={disabled}
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>
      <Button
        disabled={disabled || !code.trim() || !label.trim()}
        onClick={() => {
          onAdd(code.trim(), label.trim());
          setCode('');
          setLabel('');
          setOpen(false);
        }}
      >
        Add
      </Button>
      <Button variant="secondary" disabled={disabled} onClick={() => setOpen(false)}>Cancel</Button>
    </div>
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
              className={`flex flex-wrap items-start gap-3 py-3 ${className}`}
            >
              <DragHandle
                label={stage.label}
                disabled={disabled}
                className="mt-1 cursor-grab select-none text-md text-muted disabled:cursor-not-allowed"
                {...drag.handleProps(stage.code)}
              />
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-navy text-sm font-bold text-navy"
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <EditableRow
                  rowKey={stage.code}
                  disabled={disabled}
                  fields={[{ key: 'label', label: 'Name', hint: stage.code }]}
                  values={{ label: stage.label }}
                  onSave={(next) => onChange({
                    statuses: allStatuses.map((s) => (s.code === stage.code
                      ? { ...s, label: next.label.trim() }
                      : s)),
                  })}
                >
                  <p className="text-md text-navy">{stage.label}</p>
                  <code className="text-sm text-muted">{stage.code}</code>
                </EditableRow>
              </div>
              <span className="mt-1 flex flex-wrap items-center gap-2">
                {stage.isTerminal ? (
                  <span className="rounded-full bg-amber px-2 py-0.5 text-sm font-semibold uppercase tracking-wide text-navy">
                    Closes the pipeline
                  </span>
                ) : (
                  <span className="rounded-full border border-hairline bg-canvas px-2 py-0.5 text-sm font-semibold uppercase tracking-wide text-muted">
                    Open
                  </span>
                )}
                {!stage.isTerminal && (
                  <Button
                    variant="secondary"
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
                  variant="secondary"
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
            fields={[
              { key: 'label', label: 'Name', hint: ratio.code },
              {
                key: 'benchmark',
                label: ratio.comparison === 'band' ? 'Within, either side' : 'On track at or above',
                hint: ratio.comparison === 'band'
                  ? 'Percentage points either side of an even split.'
                  : undefined,
              },
            ]}
            values={{ label: ratio.label, benchmark: String(ratio.benchmark) }}
            onSave={(next) => patch(ratio.code, {
              label: next.label.trim(),
              benchmark: Number(next.benchmark) || 0,
            })}
            actions={(
              <Button
                variant="secondary"
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
              <code>{ratio.code}</code>
              {' · '}
              {ratio.comparison === 'band' ? 'On track within ' : 'On track at or above '}
              <strong>{ratio.benchmark}</strong>
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
            Every office of this company is measured this way, and cannot change it — which
            is what lets their figures sit in one column. Changing it here changes what the
            <strong> next </strong>office starts from; offices already created keep the copy
            they were built with.
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
              benchmark: 0, comparison: 'gte', displayOrder: 0,
            }],
            'displayOrder',
          ),
        })}
      />
    </div>
  );
}
