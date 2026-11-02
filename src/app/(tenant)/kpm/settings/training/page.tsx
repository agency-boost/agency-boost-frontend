'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SettingsScreen, TenantConfigBars } from '@/components/settings-screen';
import { ConfigBadge as Badge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, ButtonLink, Card, CodeField, Field, Select, Switch, TextInput,
} from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { settingsMessages } from '@/i18n/messages/settings';
import { trainingSettingsMessages } from '@/i18n/messages/training-settings';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { suggestCode } from '@/lib/config-code';
import { useCan } from '@/lib/session';
import {
  applyConfigChanges, listTraining, stageChange,
  type ConfigChange, type TrainingCategoryRow,
} from '@/lib/tenant-config';
import {
  codeTaken, flattenTraining, isUnsaved, projectTraining, stageEdit, stageStatus, unstageTraining,
  type ShownRow, type TrainingEntity,
} from '@/lib/training-view';

type Tab = 'categories' | 'skills' | 'modules';

/** The prototype's three subtabs (`KPM_Owner.html:1566-1570`), held in the URL; their names kept English (§A.3). */
const TAB_KEYS: readonly Tab[] = ['categories', 'skills', 'modules'];

/** The level an add panel or a code's refusal names, by tab. */
const LEVEL = { categories: 'category', skills: 'skill', modules: 'module' } as const;

/**
 * Examples of a code, in the fields that take one: identifiers, the same in both languages, never words (the approved
 * glossary's §D: *a code or key* is not a string to translate).
 */
const CODE_EXAMPLE = { category: 'PRODUCT_KNOWLEDGE', skill: 'NEEDS_ANALYSIS', module: 'REFERRAL_GENERATION' } as const;

const tabOf = (hash: string): Tab | null => {
  const key = hash.replace(/^#/, '');
  return key === 'categories' || key === 'skills' || key === 'modules' ? key : null;
};

interface Draft {
  code: string;
  /** Once somebody types a code, the label stops rewriting it. Emptying the field hands it back. */
  codeTouched: boolean;
  label: string;
  description: string;
  categoryCode: string;
  skillCode: string;
}

const EMPTY_DRAFT: Draft = {
  code: '', codeTouched: false, label: '', description: '', categoryCode: '', skillCode: '',
};

/**
 * An office's training catalog: categories, their skills, and the modules that teach each skill
 * (P5-T1, ADR-0029, `KPM_Owner.html:1565-1609`).
 *
 * **Every level is the office's own**, so every level can be added, renamed and archived — the
 * prototype's categories have only an `alert('Edit')`, and its skills and modules a red
 * *Delete*. Archiving is what deleting means (invariant §3): an agent's completed module has to
 * go on rendering in their history after it is withdrawn.
 *
 * **Two things here are called publish, and they are different.** A module's *Published* or
 * *Draft* says whether agents are offered it at all; the bar at the top publishes the office's
 * configuration, which is when they are. A module reaches an agent when it is published *and*
 * the office has published since.
 *
 * **Every edit is staged**, like the other settings screens, and shown as it will be before
 * anything is sent. What is new is that an archive reaches down: a category staged for archive
 * shows its skills and modules going with it, because that is what saving it will do.
 */
export default function TrainingSettingsPage() {
  const t = useMessages(trainingSettingsMessages);
  const s = useMessages(settingsMessages);
  const router = useRouter();
  const TABS = TAB_KEYS.map((key) => ({ label: t.tabs[key], href: `#${key}` }));
  const canWrite = useCan('tenant_config:write');
  const [tree, setTree] = useState<TrainingCategoryRow[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped after a save, so the publish bar reads again rather than going stale behind it.
  const [published, setPublished] = useState(0);
  const [staged, setStaged] = useState<ConfigChange[]>([]);
  const [tab, setTab] = useState<Tab>('categories');
  const [showArchived, setShowArchived] = useState(false);
  // Off the lists and read-only while editing, as on every settings screen (parity I-64).
  // The prototype's filters: one category on Skills; a category and a skill on Modules.
  const [skillsCategory, setSkillsCategory] = useState('');
  const [modulesCategory, setModulesCategory] = useState('');
  const [modulesSkill, setModulesSkill] = useState('all');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ label: '', description: '', categoryCode: '' });
  /** A module somebody asked to open while holding unsaved edits, which leaving would lose. */
  const [leaving, setLeaving] = useState<{ id: string; title: string } | null>(null);

  /*
   * Archived rows always, and filtered for display: *Show archived* then costs no round trip,
   * and a code is checked for reuse against every row the office has ever had.
   */
  const load = useCallback(async () => {
    try {
      setTree(await listTraining(true));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // A link to `#modules` lands on Modules — the module page's way back does exactly that.
  useEffect(() => {
    const fromUrl = tabOf(window.location.hash);
    if (fromUrl) setTab(fromUrl);
  }, []);

  function selectTab(href: string) {
    const next = tabOf(href);
    if (!next) return;
    setTab(next);
    setAdding(false);
    setEditing(null);
    // Replaced, not pushed: the subtab is a view of one screen, and Back should leave it.
    window.history.replaceState(window.history.state, '', href);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await applyConfigChanges(staged);
      setStaged([]);
      // Read again rather than taking the batch's answer, which is what agents would be
      // offered — no drafts and nothing archived, so this screen cannot be drawn from it.
      await load();
      setPublished((n) => n + 1);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  const view = tree ? projectTraining(tree, staged) : null;
  const saved = tree ? flattenTraining(tree) : null;

  /*
   * What the reader sees. A row staged for anything stays on screen whatever the toggle says —
   * hiding it would take its Undo with it — and so does a row an archive above it is about to
   * take, because that is the consequence of the archive and the reader should see it.
   */
  const shown = <T,>(rows: ShownRow<T>[]) =>
    rows.filter((r) => showArchived || !r.archived || r.staged !== null || r.cascaded);

  const categories = view ? shown(view.categories) : [];
  const liveCategories = view ? view.categories.filter((c) => !c.archived) : [];
  const liveSkills = view ? view.skills.filter((s) => !s.archived) : [];
  const labelOfSkill = (code: string) =>
    view?.skills.find((s) => s.row.code === code)?.row.label ?? code;

  const skillsTabCategory = categories.find((c) => c.row.code === skillsCategory)?.row
    ?? categories[0]?.row;
  const modulesTabCategory = categories.find((c) => c.row.code === modulesCategory)?.row
    ?? categories[0]?.row;
  const modulesTabSkills = view
    ? shown(view.skills).filter((s) => s.row.categoryCode === modulesTabCategory?.code)
    : [];
  const modulesTabSkill = modulesTabSkills.some((s) => s.row.code === modulesSkill)
    ? modulesSkill
    : 'all';

  /** Stage an edit to a saved row, sending only what differs from what the office has. */
  function stageFields(
    entity: TrainingEntity,
    id: string,
    fields: Record<string, unknown>,
  ) {
    const list = entity === 'trainingCategory'
      ? saved?.categories
      : entity === 'trainingSkill' ? saved?.skills : saved?.modules;
    const row = list?.find((r) => r.id === id);
    if (!row) return;
    setStaged((now) => stageEdit(
      now, entity, row as unknown as { id: string; version: number } & Record<string, unknown>, fields,
    ));
  }

  function openAdd() {
    setEditing(null);
    setAdding(true);
    const category = tab === 'modules' ? modulesTabCategory : skillsTabCategory;
    const live = category && liveCategories.some((c) => c.row.code === category.code)
      ? category.code
      : liveCategories[0]?.row.code ?? '';
    const skill = modulesTabSkill !== 'all'
      ? modulesTabSkill
      : liveSkills.find((s) => s.row.categoryCode === live)?.row.code ?? '';
    setDraft({ ...EMPTY_DRAFT, categoryCode: live, skillCode: skill });
  }

  function openModule(event: React.MouseEvent, id: string, title: string) {
    if (staged.length === 0) return;
    event.preventDefault();
    setLeaving({ id, title });
  }

  /*
   * Render helpers, called as functions rather than mounted as components. A component declared
   * inside this one would be a new component on every render, which React remounts — so the Code
   * field would lose focus after every character typed into it.
   */

  /** The row's own staged chip and Undo, and the note on a row an archive above is taking. */
  function marks(entity: TrainingEntity, row: ShownRow<{ id: string; code: string }>, parent: string) {
    return (
      <>
        {row.staged && (
          <p className="mt-1 text-sm">
            <span className="rounded-full bg-amber/20 px-2 py-0.5 text-navy">
              {s.staged.mark[row.staged]}
            </span>
            <button
              type="button"
              className="ml-2 font-semibold text-navy underline"
              onClick={() => setStaged((now) => unstageTraining(now, entity, row.row))}
            >
              {s.undo}
            </button>
          </p>
        )}
        {row.cascaded && (
          <p className="mt-1 text-sm text-muted">{t.archivedWith({ parent })}</p>
        )}
      </>
    );
  }

  /**
   * Whether the row is archived **itself** — a row an archive above is taking says so in its own
   * note, and saying *archived* twice reads as two things.
   *
   * The code used to share this line. It is on the edit panel now and nowhere else.
   */
  function meta(archived: boolean) {
    if (!archived) return null;
    return <p className="mt-0.5 text-sm text-muted">{s.archivedLine}</p>;
  }

  /** Archive, or Restore — or, where the row above is archived, why it cannot come back yet. */
  function statusAction(
    entity: TrainingEntity,
    row: ShownRow<{ id: string; version: number; status: 'active' | 'archived' }>,
    /** The row above, for a skill or a module. */
    parent?: { label: string; archived: boolean },
  ) {
    // Taken by an archive above it: the Undo for that is on the row above.
    if (row.cascaded) return null;
    if (row.row.status === 'active') {
      return (
        <Button
          variant="inlineDanger"
          disabled={busy}
          onClick={() => setStaged((now) => stageStatus(now, entity, row.row, 'archive'))}
        >
          {s.archive}
        </Button>
      );
    }
    if (parent?.archived) {
      return <span className="text-sm text-muted">{t.restoreFirst({ name: parent.label })}</span>;
    }
    return (
      <Button
        variant="inline"
        disabled={busy}
        onClick={() => setStaged((now) => stageStatus(now, entity, row.row, 'restore'))}
      >
        {s.restore}
      </Button>
    );
  }

  /** The Code field of an add panel: suggested from the name until somebody types in it. */
  function codeField(level: 'category' | 'skill' | 'module', rows: ShownRow<{ code: string }>[]) {
    const taken = codeTaken(rows, draft.code);
    return (
      <Field
        label={s.code}
        htmlFor="training-new-code"
        hint={t.codeHint}
        error={taken ? t.codeTaken[level] : undefined}
        className="min-w-48"
      >
        <TextInput
          id="training-new-code"
          value={draft.code}
          invalid={taken}
          placeholder={CODE_EXAMPLE[level]}
          onChange={(e) => {
            const value = e.target.value.toUpperCase();
            setDraft((d) => ({ ...d, code: value, codeTouched: value !== '' }));
          }}
        />
      </Field>
    );
  }

  const nameChanged = (value: string) => setDraft((d) => ({
    ...d, label: value, code: d.codeTouched ? d.code : suggestCode(value),
  }));

  function addPanel() {
    if (!view) return null;
    const heading = t.addHeading[LEVEL[tab]];
    const categorySelect = (
      <Field label={t.category} htmlFor="training-new-category" className="min-w-48">
        <Select
          id="training-new-category"
          value={draft.categoryCode}
          onChange={(e) => {
            const code = e.target.value;
            setDraft((d) => ({
              ...d,
              categoryCode: code,
              skillCode: liveSkills.find((s) => s.row.categoryCode === code)?.row.code ?? '',
            }));
          }}
        >
          {liveCategories.map((c) => (
            <option key={c.row.code} value={c.row.code}>{c.row.label}</option>
          ))}
        </Select>
      </Field>
    );
    const cancel = (
      <Button variant="secondary" onClick={() => { setAdding(false); setDraft(EMPTY_DRAFT); }}>
        {s.cancel}
      </Button>
    );

    if (tab === 'categories') {
      const ready = draft.code.trim() && draft.label.trim() && !codeTaken(view.categories, draft.code);
      return (
        <Card className="mb-4">
          <h2 className="font-display text-lg font-bold text-navy">{heading}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Field label={s.name} htmlFor="training-new-label" className="min-w-60 flex-1">
              <TextInput id="training-new-label" value={draft.label} onChange={(e) => nameChanged(e.target.value)} />
            </Field>
            {codeField('category', view.categories)}
            <Field
              label={s.description}
              htmlFor="training-new-description"
              hint={t.descriptionHint}
              className="min-w-60 flex-1"
            >
              <TextInput
                id="training-new-description"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={!ready || busy}
              onClick={() => {
                setStaged((now) => stageChange(now, {
                  op: 'trainingCategory.create',
                  body: {
                    code: draft.code.trim(),
                    label: draft.label.trim(),
                    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
                  },
                }));
                setAdding(false);
                setDraft(EMPTY_DRAFT);
              }}
            >
              {t.addButton.category}
            </Button>
            {cancel}
          </div>
        </Card>
      );
    }

    if (tab === 'skills') {
      const ready = draft.categoryCode && draft.code.trim() && draft.label.trim()
        && !codeTaken(view.skills, draft.code);
      return (
        <Card className="mb-4">
          <h2 className="font-display text-lg font-bold text-navy">{heading}</h2>
          {liveCategories.length === 0 ? (
            <p className="mt-2 text-md text-navy">
              {t.categoryFirst}
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {categorySelect}
              <Field label={s.name} htmlFor="training-new-label" className="min-w-60 flex-1">
                <TextInput id="training-new-label" value={draft.label} onChange={(e) => nameChanged(e.target.value)} />
              </Field>
              {codeField('skill', view.skills)}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={!ready || busy}
              onClick={() => {
                setStaged((now) => stageChange(now, {
                  op: 'trainingSkill.create',
                  body: { code: draft.code.trim(), categoryCode: draft.categoryCode, label: draft.label.trim() },
                }));
                // Onto the category it went into, so the row just added is the row in view.
                setSkillsCategory(draft.categoryCode);
                setAdding(false);
                setDraft(EMPTY_DRAFT);
              }}
            >
              {t.addButton.skill}
            </Button>
            {cancel}
          </div>
        </Card>
      );
    }

    const skillsOfDraft = liveSkills.filter((s) => s.row.categoryCode === draft.categoryCode);
    const ready = draft.skillCode && draft.code.trim() && draft.label.trim()
      && !codeTaken(view.modules, draft.code);
    return (
      <Card className="mb-4">
        <h2 className="font-display text-lg font-bold text-navy">{heading}</h2>
        <p className="mt-1 text-sm text-muted">
          {t.moduleLead}
        </p>
        {liveSkills.length === 0 ? (
          <p className="mt-2 text-md text-navy">
            {t.skillFirst}
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {categorySelect}
            <Field label={t.skill} htmlFor="training-new-skill" className="min-w-48">
              <Select
                id="training-new-skill"
                value={draft.skillCode}
                onChange={(e) => setDraft((d) => ({ ...d, skillCode: e.target.value }))}
              >
                {skillsOfDraft.length === 0 && <option value="">{t.noSkillsInCategory}</option>}
                {skillsOfDraft.map((s) => (
                  <option key={s.row.code} value={s.row.code}>{s.row.label}</option>
                ))}
              </Select>
            </Field>
            <Field label={t.moduleTitle} htmlFor="training-new-label" className="min-w-60 flex-1">
              <TextInput id="training-new-label" value={draft.label} onChange={(e) => nameChanged(e.target.value)} />
            </Field>
            {codeField('module', view.modules)}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={!ready || busy}
            onClick={() => {
              setStaged((now) => stageChange(now, {
                op: 'trainingModule.create',
                body: { code: draft.code.trim(), skillCode: draft.skillCode, title: draft.label.trim() },
              }));
              setModulesCategory(draft.categoryCode);
              setModulesSkill('all');
              setAdding(false);
              setDraft(EMPTY_DRAFT);
            }}
          >
            {t.addButton.module}
          </Button>
          {cancel}
        </div>
      </Card>
    );
  }

  /** A category's badge: what it holds that agents are offered, or *Empty*. */
  function categoryBadge(row: ShownRow<{ code: string }>) {
    if (row.archived) return <Badge tone="open">{s.archivedBadge}</Badge>;
    const skills = liveSkills.filter((s) => s.row.categoryCode === row.row.code);
    if (skills.length === 0) return <Badge tone="open">{t.empty}</Badge>;
    const codes = new Set(skills.map((s) => s.row.code));
    const offered = view!.modules.filter((m) =>
      !m.archived && codes.has(m.row.skillCode) && m.row.publishState === 'published').length;
    return (
      <Badge tone={offered > 0 ? 'won' : 'open'}>
        {t.categoryBadge({ skills: skills.length, modules: offered })}
      </Badge>
    );
  }

  const filterClass = 'flex flex-wrap items-center gap-x-4 gap-y-2';
  const filterPair = 'flex items-center gap-2';
  const filterLabel = 'text-sm font-semibold text-muted';

  const hint = !view ? ' ' : tab === 'skills' ? (
    <div className={filterClass}>
      <label htmlFor="training-skills-category" className={filterLabel}>{t.category}</label>
      <Select
        id="training-skills-category"
        value={skillsTabCategory?.code ?? ''}
        onChange={(e) => { setSkillsCategory(e.target.value); setEditing(null); }}
      >
        {categories.map((c) => <option key={c.row.code} value={c.row.code}>{c.row.label}</option>)}
      </Select>
    </div>
  ) : tab === 'modules' ? (
    <div className={filterClass}>
      {/* Each label held to its select, so a narrow screen wraps a pair, never a label alone. */}
      <span className={filterPair}>
        <label htmlFor="training-modules-category" className={filterLabel}>{t.category}</label>
        <Select
          id="training-modules-category"
          value={modulesTabCategory?.code ?? ''}
          onChange={(e) => { setModulesCategory(e.target.value); setModulesSkill('all'); }}
        >
          {categories.map((c) => <option key={c.row.code} value={c.row.code}>{c.row.label}</option>)}
        </Select>
      </span>
      <span className={filterPair}>
        <label htmlFor="training-modules-skill" className={filterLabel}>{t.skill}</label>
        {/* The chosen category's skills. The prototype offers Sales's whatever is chosen (F-13). */}
        <Select
          id="training-modules-skill"
          value={modulesTabSkill}
          onChange={(e) => setModulesSkill(e.target.value)}
        >
          <option value="all">{t.allSkills}</option>
          {modulesTabSkills.map((s) => <option key={s.row.code} value={s.row.code}>{s.row.label}</option>)}
        </Select>
      </span>
    </div>
  ) : undefined;

  const addLabel = t.addLabel[LEVEL[tab]];

  function categoriesList() {
    if (categories.length === 0) {
      return <EmptyState title={t.noCategories} />;
    }
    return (
      <ul className="flex flex-col divide-y divide-hairline">
        {categories.map((category) => {
          const unsaved = isUnsaved(category.row);
          return (
            <li key={category.row.id} className="px-4 py-3 sm:px-5">
              {editing === category.row.id ? (
                <div className="flex flex-col gap-3">
                  <CodeField
                    id={`code-category-row-code-${category.row.code}`}
                    value={category.row.code}
                    reason={t.categoryReason}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Field label={s.name} htmlFor={`name-${category.row.id}`} className="min-w-60 flex-1">
                      <TextInput
                        id={`name-${category.row.id}`}
                        value={edit.label}
                        onChange={(e) => setEdit((d) => ({ ...d, label: e.target.value }))}
                      />
                    </Field>
                    <Field
                      label={s.description}
                      htmlFor={`description-${category.row.id}`}
                      hint={t.descriptionHint}
                      className="min-w-60 flex-1"
                    >
                      <TextInput
                        id={`description-${category.row.id}`}
                        value={edit.description}
                        onChange={(e) => setEdit((d) => ({ ...d, description: e.target.value }))}
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!edit.label.trim() || busy}
                      onClick={() => {
                        stageFields('trainingCategory', category.row.id, {
                          label: edit.label.trim(), description: edit.description.trim(),
                        });
                        setEditing(null);
                      }}
                    >
                      {s.save}
                    </Button>
                    <Button variant="secondary" onClick={() => setEditing(null)}>{s.cancel}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-md font-semibold text-navy">{category.row.label}</p>
                    {category.row.description && (
                      <p className="text-sm text-muted">{category.row.description}</p>
                    )}
                    {meta(category.row.status === 'archived')}
                    {marks('trainingCategory', category, '')}
                  </div>
                  {categoryBadge(category)}
                  {canWrite && !unsaved && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        variant="inline"
                        onClick={() => {
                          setAdding(false);
                          setEditing(category.row.id);
                          setEdit({
                            label: category.row.label,
                            description: category.row.description ?? '',
                            categoryCode: '',
                          });
                        }}
                      >
                        {s.edit}
                      </Button>
                      {statusAction('trainingCategory', category)}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  function skillsList() {
    if (!skillsTabCategory) return <EmptyState title={t.noCategories} />;
    const rows = shown(view!.skills).filter((s) => s.row.categoryCode === skillsTabCategory.code);
    if (rows.length === 0) {
      return <EmptyState title={t.noSkills} />;
    }
    return (
      <ul className="flex flex-col divide-y divide-hairline">
        {rows.map((skill) => {
          const unsaved = isUnsaved(skill.row);
          const category = view!.categories.find((c) => c.row.code === skill.row.categoryCode);
          const modules = view!.modules.filter((m) => !m.archived && m.row.skillCode === skill.row.code);
          return (
            <li key={skill.row.id} className="px-4 py-3 sm:px-5">
              {editing === skill.row.id ? (
                <div className="flex flex-col gap-3">
                  <CodeField
                    id={`code-skill-row-code-${skill.row.code}`}
                    value={skill.row.code}
                    reason={t.skillReason}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Field label={s.name} htmlFor={`name-${skill.row.id}`} className="min-w-60 flex-1">
                      <TextInput
                        id={`name-${skill.row.id}`}
                        value={edit.label}
                        onChange={(e) => setEdit((d) => ({ ...d, label: e.target.value }))}
                      />
                    </Field>
                    <Field
                      label={t.category}
                      htmlFor={`category-${skill.row.id}`}
                      hint={t.movesWithIt}
                      className="min-w-48"
                    >
                      <Select
                        id={`category-${skill.row.id}`}
                        value={edit.categoryCode}
                        onChange={(e) => setEdit((d) => ({ ...d, categoryCode: e.target.value }))}
                      >
                        {/* Where it is, and any saved, active category it could go. Not one
                            added in this sitting: undoing that would leave the move naming
                            nothing. */}
                        {view!.categories
                          .filter((c) => !c.archived || c.row.code === skill.row.categoryCode)
                          .filter((c) => !isUnsaved(c.row))
                          .map((c) => (
                            <option key={c.row.code} value={c.row.code}>{c.row.label}</option>
                          ))}
                      </Select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!edit.label.trim() || busy}
                      onClick={() => {
                        stageFields('trainingSkill', skill.row.id, {
                          label: edit.label.trim(), categoryCode: edit.categoryCode,
                        });
                        setEditing(null);
                      }}
                    >
                      {s.save}
                    </Button>
                    <Button variant="secondary" onClick={() => setEditing(null)}>{s.cancel}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-md font-semibold text-navy">{skill.row.label}</p>
                    {meta(skill.row.status === 'archived')}
                    {marks('trainingSkill', skill, category?.row.label ?? '')}
                  </div>
                  {skill.archived
                    ? <Badge tone="open">{s.archivedBadge}</Badge>
                    : (
                      <Badge tone={modules.length > 0 ? 'won' : 'open'}>
                        {t.moduleCount({ n: modules.length })}
                      </Badge>
                    )}
                  {canWrite && !unsaved && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        variant="inline"
                        onClick={() => {
                          setAdding(false);
                          setEditing(skill.row.id);
                          setEdit({ label: skill.row.label, description: '', categoryCode: skill.row.categoryCode });
                        }}
                      >
                        {s.edit}
                      </Button>
                      {statusAction(
                        'trainingSkill',
                        skill,
                        category && { label: category.row.label, archived: category.archived },
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  function modulesList() {
    if (!modulesTabCategory) return <EmptyState title={t.noCategories} />;
    const rows = modulesTabSkills
      .filter((s) => modulesTabSkill === 'all' || s.row.code === modulesTabSkill)
      .flatMap((s) => shown(view!.modules).filter((m) => m.row.skillCode === s.row.code));
    if (rows.length === 0) {
      return <EmptyState title={t.noModules} />;
    }
    return (
      <ul className="flex flex-col divide-y divide-hairline">
        {rows.map((module) => {
          const unsaved = isUnsaved(module.row);
          const skill = view!.skills.find((s) => s.row.code === module.row.skillCode);
          const isPublished = module.row.publishState === 'published';
          return (
            <li key={module.row.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-md font-semibold text-navy">{module.row.title}</p>
                <p className="text-sm text-muted">{labelOfSkill(module.row.skillCode)}</p>
                {meta(module.row.status === 'archived')}
                {marks('trainingModule', module, skill?.row.label ?? '')}
              </div>
              {module.archived ? <Badge tone="open">{s.archivedBadge}</Badge> : (
                /*
                  * One control, not a badge and a button. The row used to show a *Published*
                  * badge beside an *Unpublish* button — two things answering one question, and
                  * whichever a reader trusted the other contradicted.
                  *
                  * It renders for every reader, disabled where there is nothing to toggle: a
                  * module staged but not yet saved, and anybody without write permission, still
                  * need to be told which state it is in.
                  *
                  * It stages like any other edit — the module reaches agents when the office
                  * next publishes, not when this is pressed.
                  */
                <Switch
                  id={`publish-${module.row.id}`}
                  label={t.published}
                  checked={isPublished}
                  disabled={busy || !canWrite || unsaved}
                  onChange={(next) => stageFields('trainingModule', module.row.id, {
                    publishState: next ? 'published' : 'draft',
                  })}
                />
              )}
              {canWrite && !unsaved && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <ButtonLink
                    variant="inline"
                    href={`/kpm/settings/training/${module.row.id}`}
                    onClick={(e) => openModule(e, module.row.id, module.row.title)}
                  >
                    {s.edit}
                  </ButtonLink>

                  {statusAction(
                    'trainingModule',
                    module,
                    skill && { label: skill.row.label, archived: skill.archived },
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <SettingsScreen
      title={t.title}
      subtitle={t.subtitle}
      permission="training_settings:read"
      tabs={TABS}
      tabsLabel={s.sections({ title: t.title })}
      activeHref={`#${tab}`}
      onSelectTab={selectTab}
      error={error}
      bars={(
        <TenantConfigBars
          publishRefreshKey={published}
          staged={{
            count: staged.length,
            busy,
            onSave: () => void save(),
            onDiscard: () => setStaged([]),
          }}
        />
      )}
      toolbar={{
        hint,
        /* Archiving is reversible and Restore is one click away, so nothing here is red and
           nothing asks for confirmation — the same call the other settings screens make. */
        actions: (
          <>
            <label className="flex items-center gap-2 text-md text-navy">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              {s.showArchived}
            </label>
            {canWrite && view && !adding && <Button onClick={openAdd}>{addLabel}</Button>}
          </>
        ),
      }}
    >
      {leaving && (
        <div role="alert" className="mb-4 rounded-md border border-amber bg-card p-4">
          <p className="text-md text-navy">
            <strong>{t.unsaved}</strong>{' '}
            <span className="text-muted">
              {t.openingDiscards({ title: leaving.title })}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const { id } = leaving;
                setStaged([]);
                setLeaving(null);
                router.push(`/kpm/settings/training/${id}`);
              }}
            >
              {t.discardAndOpen({ title: leaving.title })}
            </Button>
            <Button onClick={() => setLeaving(null)}>{t.stayHere}</Button>
          </div>
        </div>
      )}

      {canWrite && adding && addPanel()}

      {view === null ? (
        error ? null : <SkeletonCards count={3} />
      ) : (
        // The prototype's `config-table`: one bordered list, a row per entry.
        <Card className="p-0">
          {tab === 'categories' && categoriesList()}
          {tab === 'skills' && skillsList()}
          {tab === 'modules' && modulesList()}
        </Card>
      )}

    </SettingsScreen>
  );
}
