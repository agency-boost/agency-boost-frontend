'use client';

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
                  <Field
                    label={type.code}
                    htmlFor={`t-${type.code}`}
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
        </Card>
      ))}
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
                  <Field label={stage.code} htmlFor={`s-${stage.code}`} className="min-w-60 flex-1">
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
        </Card>
      ))}
    </div>
  );
}
