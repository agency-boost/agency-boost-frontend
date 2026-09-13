'use client';

import { useState } from 'react';
import { Button, Card, Field, TextInput } from '@/components/ui/field';

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
export function TaxonomyEditor({
  payload,
  onChange,
  disabled,
}: {
  payload: TaxonomyPayload;
  onChange: (next: TaxonomyPayload) => void;
  disabled?: boolean;
}) {
  const { categories, types } = payload;

  return (
    <div className="flex flex-col gap-4">
      {categories.map((category) => (
        <Card key={category.code}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-lg font-bold text-navy">{category.label}</h3>
            <code className="text-sm text-muted">{category.code}</code>
          </div>

          <ul className="mt-3 flex flex-col divide-y divide-hairline">
            {types
              .filter((type) => type.categoryCode === category.code)
              .map((type) => (
                <li key={type.code} className="flex flex-wrap items-end gap-3 py-3">
                  {/* `label="Name"`, not the code. It read `label={type.code}`, so a
                      screen reader announced *"SELL_SUBMISSION, edit text"* and the human
                      name was the value. The code belongs beside the field, not as it. */}
                  <Field
                    label="Name"
                    htmlFor={`t-${type.code}`}
                    hint={type.code}
                    className="min-w-60 flex-1"
                  >
                    <TextInput
                      id={`t-${type.code}`}
                      value={type.label}
                      disabled={disabled}
                      onChange={(e) => onChange({
                        ...payload,
                        types: types.map((t) => (t.code === type.code
                          ? { ...t, label: e.target.value }
                          : t)),
                      })}
                    />
                  </Field>
                  <Button
                    variant="danger"
                    disabled={disabled}
                    onClick={() => onChange({
                      ...payload,
                      types: types.filter((t) => t.code !== type.code),
                    })}
                  >
                    Remove
                  </Button>
                </li>
              ))}
          </ul>

          <AddRow
            disabled={disabled}
            what="activity type"
            onAdd={(code, label) => onChange({
              ...payload,
              types: [...types, {
                code, categoryCode: category.code, label, description: null,
                displayOrder: types.length + 1,
              }],
            })}
          />
        </Card>
      ))}

      <AddRow
        disabled={disabled}
        what="section"
        onAdd={(code, label) => onChange({
          ...payload,
          categories: [...categories, { code, label, displayOrder: categories.length + 1 }],
        })}
      />
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
}: {
  what: string;
  onAdd: (code: string, label: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');

  if (!open) {
    return (
      <Button variant="secondary" className="mt-3" disabled={disabled} onClick={() => setOpen(true)}>
        Add {/^[aeiou]/i.test(what) ? 'an' : 'a'} {what}
      </Button>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-hairline pt-3">
      <Field label="Code" htmlFor={`add-code-${what}`} hint="Permanent once published." className="min-w-48">
        <TextInput
          id={`add-code-${what}`}
          value={code}
          disabled={disabled}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </Field>
      <Field label="Name" htmlFor={`add-label-${what}`} className="min-w-60 flex-1">
        <TextInput
          id={`add-label-${what}`}
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

/** The two ladders of a company template. Same argument as above. */
export function PipelineEditor({
  payload,
  onChange,
  disabled,
}: {
  payload: PipelinePayload;
  onChange: (next: PipelinePayload) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {(['sales', 'recruitment'] as const).map((pipeline) => (
        <Card key={pipeline}>
          <h3 className="font-display text-lg font-bold capitalize text-navy">{pipeline}</h3>
          <ul className="mt-3 flex flex-col divide-y divide-hairline">
            {payload.statuses
              .filter((s) => s.pipeline === pipeline)
              .map((stage) => (
                <li key={stage.code} className="flex flex-wrap items-end gap-3 py-3">
                  <Field
                    label="Name"
                    htmlFor={`s-${stage.code}`}
                    hint={stage.code}
                    className="min-w-60 flex-1"
                  >
                    <TextInput
                      id={`s-${stage.code}`}
                      value={stage.label}
                      disabled={disabled}
                      onChange={(e) => onChange({
                        statuses: payload.statuses.map((s) => (s.code === stage.code
                          ? { ...s, label: e.target.value }
                          : s)),
                      })}
                    />
                  </Field>
                  <Button
                    variant={stage.isTerminal ? 'primary' : 'secondary'}
                    disabled={disabled || stage.isTerminal}
                    onClick={() => onChange({
                      // Exactly one per pipeline: the server refuses to publish anything
                      // else, so the screen never lets a second one be set.
                      statuses: payload.statuses.map((s) => (s.pipeline === pipeline
                        ? { ...s, isTerminal: s.code === stage.code }
                        : s)),
                    })}
                  >
                    {stage.isTerminal ? 'Closes the pipeline' : 'Make this close it'}
                  </Button>
                </li>
              ))}
          </ul>

          <AddRow
            disabled={disabled}
            what={`${pipeline} stage`}
            onAdd={(code, label) => onChange({
              // Appended, and never terminal: exactly one stage closes each pipeline and
              // moving that is a deliberate second act, not a side effect of adding.
              statuses: [...payload.statuses, {
                pipeline, code, label,
                rank: payload.statuses.filter((s) => s.pipeline === pipeline).length + 1,
                isTerminal: false,
              }],
            })}
          />
        </Card>
      ))}
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
 * The ratio set of a company template (P4-T20).
 *
 * `ratio_set` has been a `TemplateKind` with a starting payload and a provisioning reader
 * since P4-T8, and had no screen — so the one preset a company could not edit was the one
 * ADR-0018's own subtab table names beside the taxonomy.
 *
 * **The formula is not editable here.** A template's ratios are copied into offices as
 * `origin: 'platform'`, whose formulas an office may not change (ADR-0021) — so a Super
 * Admin editing one would be rewriting a metric every office of that company is compared
 * on, from a screen that gives no sign of it. What is editable is what an office may
 * change too: the name and the benchmark. Publishing refuses a formula naming a code the
 * published taxonomy does not declare, which is where the two templates are held together.
 */
export function RatioSetEditor({
  payload,
  onChange,
  disabled,
}: {
  payload: RatioSetPayload;
  onChange: (next: RatioSetPayload) => void;
  disabled?: boolean;
}) {
  const patch = (code: string, fields: Partial<RatioSetPayload['ratios'][number]>) => onChange({
    ratios: payload.ratios.map((r) => (r.code === code ? { ...r, ...fields } : r)),
  });

  return (
    <div className="flex flex-col gap-4">
      {payload.ratios.map((ratio) => (
        <Card key={ratio.code}>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Name" htmlFor={`r-${ratio.code}`} hint={ratio.code} className="min-w-60 flex-1">
              <TextInput
                id={`r-${ratio.code}`}
                value={ratio.label}
                disabled={disabled}
                onChange={(e) => patch(ratio.code, { label: e.target.value })}
              />
            </Field>
            <Field
              label={ratio.comparison === 'band' ? 'Within, either side' : 'On track at or above'}
              htmlFor={`b-${ratio.code}`}
              className="min-w-40"
            >
              <TextInput
                id={`b-${ratio.code}`}
                type="number"
                step="0.01"
                value={String(ratio.benchmark)}
                disabled={disabled}
                onChange={(e) => patch(ratio.code, { benchmark: Number(e.target.value) })}
              />
            </Field>
          </div>

          {/* Read-only, and said rather than disabled. An office cannot change a platform
              ratio's formula either — this is the same rule, one level up. */}
          <p className="mt-3 text-sm text-muted">
            Counts <strong>{ratio.numerator.join(' + ') || '—'}</strong> out of{' '}
            <strong>{ratio.denominator.join(' + ') || '—'}</strong>. The formula is fixed:
            every office of this company is measured the same way, which is what makes their
            figures comparable.
          </p>

          <Button
            variant="danger"
            className="mt-3"
            disabled={disabled}
            onClick={() => onChange({ ratios: payload.ratios.filter((r) => r.code !== ratio.code) })}
          >
            Remove
          </Button>
        </Card>
      ))}
    </div>
  );
}
