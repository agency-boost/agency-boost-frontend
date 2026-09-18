'use client';

import Link from 'next/link';
import type React from 'react';
import { use, useCallback, useEffect, useState } from 'react';
import { ConfigBadge } from '@/components/ui/config-badge';
import { ModuleContentEditor } from '@/components/module-content';
import { PublishBar } from '@/components/publish-bar';
import { SettingsScreen } from '@/components/settings-screen';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, Card, CodeField, Field, Select, TextInput,
} from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import {
  applyConfigChanges, listTraining, type TrainingCategoryRow,
} from '@/lib/tenant-config';
import { flattenTraining } from '@/lib/training-view';

const BACK = '/kpm/settings/training#modules';

interface Form {
  title: string;
  categoryCode: string;
  skillCode: string;
  published: boolean;
}

/** The module, and the skill and category it sits under, from the office's taxonomy. */
function find(tree: TrainingCategoryRow[], moduleId: string) {
  const flat = flattenTraining(tree);
  const current = flat.modules.find((m) => m.id === moduleId);
  if (!current) return null;
  const skill = flat.skills.find((s) => s.code === current.skillCode);
  const category = flat.categories.find((c) => c.code === skill?.categoryCode);
  return { flat, current, skill, category };
}

const formOf = (tree: TrainingCategoryRow[], moduleId: string): Form | null => {
  const found = find(tree, moduleId);
  return found && {
    title: found.current.title,
    categoryCode: found.category?.code ?? '',
    skillCode: found.current.skillCode,
    published: found.current.publishState === 'published',
  };
};

/**
 * One training module (P5-T1) — the prototype's module modal (`KPM_Owner.html:1611-1638`) as a
 * page.
 *
 * **A page rather than a modal** because P5-T2 fills it with files, videos and links, and a route
 * survives a reload and can be sent to somebody. What P5-T1 gives it is the prototype's head and
 * footer: the title, the skill it teaches, and the *Published* toggle.
 *
 * **Save changes writes at once**, as one batch, rather than staging: this page is one row and
 * one decision, and the prototype's button says *Save changes*. Publishing to agents is still a
 * separate step, and the bar above says when it is due.
 *
 * **The category is chosen to narrow the skills**, and is not saved: a module's category is its
 * skill's (ADR-0029), so choosing another category means choosing a skill in it.
 */
export default function TrainingModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = use(params);
  const canWrite = useCan('tenant_config:write');
  const [tree, setTree] = useState<TrainingCategoryRow[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(0);

  const load = useCallback(async () => {
    try {
      const next = await listTraining(true);
      setTree(next);
      setForm(formOf(next, moduleId));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [moduleId]);

  useEffect(() => { void load(); }, [load]);

  const found = tree ? find(tree, moduleId) : null;

  const title = found?.current.title ?? 'Training module';
  const where = found?.category && found.skill
    ? `${found.category.label} › ${found.skill.label}`
    : undefined;

  function body() {
    if (tree === null) return error ? null : <SkeletonCards count={2} />;

    // Not in this office — including a module that belongs to another one, which is the same
    // answer the API gives it (ADR-0002).
    if (!found || !form) {
      return (
        <Card>
          <EmptyState
            title="This module is not in your office's training catalog."
            action={<Link href={BACK} className="text-md font-semibold text-navy underline">Back to Training</Link>}
          />
        </Card>
      );
    }

    const { current, flat } = found;
    const archived = current.status === 'archived';
    const categories = flat.categories.filter((c) => c.status === 'active');
    const skills = flat.skills.filter((s) => s.status === 'active' && s.categoryCode === form.categoryCode);
    const changes: Record<string, unknown> = {
      ...(form.title.trim() !== current.title ? { title: form.title.trim() } : {}),
      ...(form.skillCode !== current.skillCode ? { skillCode: form.skillCode } : {}),
      ...((form.published ? 'published' : 'draft') !== current.publishState
        ? { publishState: form.published ? 'published' : 'draft' }
        : {}),
    };
    const ready = form.title.trim() !== '' && form.skillCode !== '' && Object.keys(changes).length > 0;

    async function save() {
      setBusy(true);
      setError(null);
      setSaved(false);
      try {
        await applyConfigChanges([{
          op: 'trainingModule.update', id: current.id, expectedVersion: current.version, body: changes,
        }]);
        await load();
        setPublished((n) => n + 1);
        setSaved(true);
      } catch (err) {
        setError(toDisplayError(err));
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="flex flex-col gap-4">
        {!canWrite || archived ? (
          <Card>
            {archived && (
              <p className="mb-3 text-md text-navy">
                <strong>This module is archived.</strong>{' '}
                <span className="text-muted">
                  No agent is offered it. Bring it back from{' '}
                  <Link href={BACK} className="font-semibold text-navy underline">Training</Link>
                  {' '}— on Modules, with Show archived on.
                </span>
              </p>
            )}
            <dl className="grid gap-3 sm:grid-cols-2">
              {([
                ['Title', current.title],
                ['Skill', found.skill?.label ?? current.skillCode],
                ['Category', found.category?.label ?? '—'],
                /*
                 * A capsule, as `.cfg-badge` has it. Plain text in a `<dl>` read as a caption
                 * rather than as the state it names — and the same word was a badge one screen
                 * away, on the list this page is opened from.
                 */
                ['Publish state', (
                  <ConfigBadge key="state" tone={current.publishState === 'published' ? 'won' : 'open'}>
                    {current.publishState === 'published' ? 'Published' : 'Draft'}
                  </ConfigBadge>
                )],
                ['Code', current.code],
              ] as [string, React.ReactNode][]).map(([term, value]) => (
                <div key={term}>
                  <dt className="text-sm font-semibold text-muted">{term}</dt>
                  <dd className="text-md text-navy">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : (
          <Card>
            <div className="flex flex-col gap-3">
              <Field label="Title" htmlFor="module-title">
                <TextInput
                  id="module-title"
                  value={form.title}
                  onChange={(e) => { setSaved(false); setForm({ ...form, title: e.target.value }); }}
                />
              </Field>
              <div className="flex flex-wrap items-start gap-3">
                <Field label="Category" htmlFor="module-category" className="min-w-48 flex-1">
                  <Select
                    id="module-category"
                    value={form.categoryCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setSaved(false);
                      setForm({
                        ...form,
                        categoryCode: code,
                        // Where the module already is, if it is in this category; else its first skill.
                        skillCode: code === found.category?.code
                          ? current.skillCode
                          : flat.skills.find((s) => s.status === 'active' && s.categoryCode === code)?.code ?? '',
                      });
                    }}
                  >
                    {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </Select>
                </Field>
                <Field
                  label="Skill"
                  htmlFor="module-skill"
                  hint={skills.length === 0 ? 'This category has no skills yet. Add one on Training first.' : undefined}
                  className="min-w-48 flex-1"
                >
                  {/* The chosen category's skills — the prototype offers Sales's whatever (F-13). */}
                  <Select
                    id="module-skill"
                    value={form.skillCode}
                    onChange={(e) => { setSaved(false); setForm({ ...form, skillCode: e.target.value }); }}
                  >
                    {skills.length === 0 && <option value="">No skills</option>}
                    {skills.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
                  </Select>
                </Field>
              </div>
              <CodeField
                id={`code-current-code-${current.code}`}
                value={current.code}
                reason="Permanent. Whatever refers to this module refers to its code, so the title can change and nothing loses track of it."
              />
              <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-3">
                {/* The prototype's toggle. Its name stays *Published* while its state changes —
                    a switch whose name flipped to *Draft* would announce a different control. */}
                <input
                  id="module-published"
                  type="checkbox"
                  role="switch"
                  className="h-5 w-5 accent-amber"
                  checked={form.published}
                  aria-describedby="module-published-hint"
                  onChange={(e) => { setSaved(false); setForm({ ...form, published: e.target.checked }); }}
                />
                <label htmlFor="module-published" className="text-md font-semibold text-navy">Published</label>
                <span id="module-published-hint" className="text-sm text-muted">
                  {form.published
                    ? 'Agents are offered it once your office next publishes its changes.'
                    : 'A draft. No agent is offered it.'}
                </span>
                <Button className="ml-auto" disabled={!ready || busy} onClick={() => void save()}>
                  {busy ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
              {saved && (
                <p role="status" className="text-md font-semibold text-success">
                  Saved to your office.
                </p>
              )}
            </div>
          </Card>
        )}

        {/*
          * `Files · Videos · Links` (`KPM_Owner.html:1618-1630`), built in P5-T2.
          *
          * Its own Save, beside the module's: the title is a row in the office's staged
          * configuration and the content is files, which cannot be staged because their bytes go
          * straight to storage. Two Saves on one screen is worse than one, so each says what it
          * saves.
          */}
        <ModuleContentEditor moduleCode={current.code} canWrite={canWrite} />
      </div>
    );
  }

  return (
    <SettingsScreen
      title={title}
      subtitle={where}
      permission="tenant_config:read"
      actions={<Link href={BACK} className="text-md font-semibold text-navy underline">Back to Training</Link>}
      error={error}
      bars={<PublishBar refreshKey={published} />}
    >
      {body()}
    </SettingsScreen>
  );
}
