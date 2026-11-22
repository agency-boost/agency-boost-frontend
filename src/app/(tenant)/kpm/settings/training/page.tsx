'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PublishBar } from '@/components/publish-bar';
import { SettingsScreen } from '@/components/settings-screen';
import { TemplateSyncControl } from '@/components/training/template-sync-control';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfigBadge } from '@/components/ui/config-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Field, Select, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { settingsMessages } from '@/i18n/messages/settings';
import { trainingSettingsMessages } from '@/i18n/messages/training-settings';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { suggestCode } from '@/lib/config-code';
import { formatFileSize } from '@/lib/recruitment-pitch';
import { useCan } from '@/lib/session';
import {
  applyConfigChanges, listTraining, readModuleContent, saveModuleContent,
  type ConfigChange, type TrainingCategoryRow, type TrainingModuleRow, type TrainingSkillRow,
} from '@/lib/tenant-config';
import { TRAINING_DESCRIPTION_MAX } from '@/lib/training-text';
import {
  categoryCounts, codeTaken, flattenTraining, liveModules, TRAINING_ACCEPT, trainingFileType, uploadTrainingFile,
  withUploaded,
} from '@/lib/training-view';
import { ARCHIVED_SWITCH_ROW } from '../settings-touch';

type Level = 'category' | 'skill' | 'module';
type Adding = { level: 'category' } | { level: 'skill'; categoryCode: string } | { level: 'module'; skillCode: string };
type Row = TrainingCategoryRow | TrainingSkillRow | TrainingModuleRow;

/** The batch's entity for each level (`POST /kpm/settings/changes`). */
const ENTITY = { category: 'trainingCategory', skill: 'trainingSkill', module: 'trainingModule' } as const;
const MAX_BYTES = 25 * 1024 * 1024;

const nameOfRow = (row: Row) => ('title' in row ? row.title : row.label);
const keyOf = (level: Level, code: string) => `${level}:${code}`;
/** A control inside a row that does its own thing: a tap on it never opens or closes the row. */
const CONTROL = { 'data-row-control': '' } as const;

/**
 * **Pengaturan › Training as one layered tree** (P19.25-T4, ADR-0282; `data-upload-pengaturan-*` frame 17; the brief's
 * *"one layered tree like Group Tree, no Kategori/Skills/Modul tabs"*): *Kategori › Skill › Modul*, a chevron and indent
 * lines like Group Tree, a tap on a row opens or closes it.
 *
 * - **A category** — its folder, its name, *"n skill · n modul"*; **a skill** — *"n modul"*; **a module** — *"n dari 30
 *   selesai"* (the KPM's counted members who marked it done, ADR-0139; never a test account) or *Belum ada yang
 *   belajar*, then the file agents are shown with ***Ganti***, or ***Unggah materi*** (any format, ADR-0282 §3) — right
 *   on the row: picked, signed, sent, and saved as the module's material, which agents read at once (ADR-0032).
 * - **The pencil beside every name renames** (with its *Deskripsi singkat*, ADR-0220 §1); the code never moves and is
 *   shown while renaming. **⋯ archives** — a category takes everything under it, a restore brings back the one row
 *   (invariant §3) — and on a module opens ***Materi & detail***, its page: every file, video and link, *Urungkan
 *   perubahan saya*, the skill it teaches and whether agents are offered it.
 * - ***+ Tambah kategori*** above the tree, ***+ Tambah skill*** and ***+ Tambah modul*** at the foot of each open
 *   category and skill; a new module is offered to agents once the KPM publishes.
 * - **Kept from the screen before** (the owner's rule that fidelity work never strips a requested feature): *x / y modul
 *   punya materi* (UI-162) beside the path, *Tampilkan yang diarsipkan*, and *Sinkron dari template* (ADR-0220 §4).
 *
 * **Each edit is written at once and waits for *Terbitkan ke agent*** (P19.21-T2): the orange bar says so, and only
 * then. A module's material is the exception it always was — read live, never published (the Phase 18.2 exit review).
 */
export default function TrainingSettingsPage() {
  const t = useMessages(trainingSettingsMessages);
  const s = useMessages(settingsMessages);
  const figures = useFigureLanguage();
  const router = useRouter();
  const canWrite = useCan('tenant_config:write');
  const [tree, setTree] = useState<TrainingCategoryRow[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishKey, setPublishKey] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [openRows, setOpenRows] = useState<Set<string> | null>(null);
  /** The row being renamed — its name, its description and, for a skill, the category it sits in (it can move). */
  const [renaming, setRenaming] = useState<{ key: string; label: string; description: string; categoryCode?: string } | null>(null);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [draft, setDraft] = useState({ label: '', code: '', codeTouched: false });
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const target = useRef<TrainingModuleRow | null>(null);

  const load = useCallback(async () => {
    try {
      setTree(await listTraining(true));
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** One write, then the tree read again and the bar asked again: every taxonomy edit leaves a draft. */
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await load();
      setPublishKey((k) => k + 1);
      return true;
    } catch (err) {
      setError(toDisplayError(err));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const change = (op: ConfigChange) => run(() => applyConfigChanges([op]));

  if (tree === null) {
    return (
      <SettingsScreen title={t.title} permission="training_settings:read" error={error} bars={<PublishBar />}>
        {error ? null : <SkeletonCards count={3} />}
      </SettingsScreen>
    );
  }

  const flat = flattenTraining(tree);
  const visible = <T extends { status: 'active' | 'archived' }>(rows: T[]) =>
    rows.filter((r) => showArchived || r.status === 'active');
  const categories = visible(tree);
  // The first category and its first skill open, as the mockup draws them; then the reader decides.
  const firstCategory = categories.find((c) => c.status === 'active');
  const opened = openRows ?? new Set([
    ...(firstCategory ? [keyOf('category', firstCategory.code)] : []),
    ...(firstCategory?.skills[0] ? [keyOf('skill', firstCategory.skills[0].code)] : []),
  ]);
  const toggle = (key: string) => {
    const next = new Set(opened);
    if (next.has(key)) next.delete(key); else next.add(key);
    setOpenRows(next);
  };
  const rowClick = (key: string) => (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('[data-row-control]')) return;
    toggle(key);
  };

  const activeModules = flat.modules.filter((m) => m.status === 'active');
  const withMaterial = activeModules.filter((m) => m.material !== undefined && m.material !== 'none').length;

  // ---------------------------------------------------------------- writes

  const submitRename = (level: Level, row: Row) => {
    if (!renaming) return;
    const label = renaming.label.trim();
    const description = renaming.description.trim();
    if (!label) return;
    const before = { label: nameOfRow(row), description: row.description ?? '' };
    // A skill may move to another category, its modules with it (ADR-0029) — kept from the Skills tab's *Edit*.
    const moved = level === 'skill' && 'categoryCode' in row && renaming.categoryCode && renaming.categoryCode !== row.categoryCode
      ? { categoryCode: renaming.categoryCode } : {};
    if (label === before.label && description === before.description && Object.keys(moved).length === 0) {
      setRenaming(null);
      return;
    }
    const named = level === 'module' ? { title: label } : { label };
    const body = level === 'category'
      ? { ...named, description }
      : { ...named, ...(description !== before.description ? { description: description || null } : {}), ...moved };
    void change({ op: `${ENTITY[level]}.update`, id: row.id, expectedVersion: row.version, body }).then((ok) => {
      if (ok) setRenaming(null);
    });
  };

  const setStatus = (level: Level, row: Row) => change({
    op: `${ENTITY[level]}.${row.status === 'archived' ? 'restore' : 'archive'}`, id: row.id, expectedVersion: row.version,
  });

  const startAdding = (next: Adding) => { setRenaming(null); setDraft({ label: '', code: '', codeTouched: false }); setAdding(next); };
  const submitAdd = () => {
    if (!adding) return;
    const label = draft.label.trim();
    const code = draft.code.trim();
    const body = adding.level === 'category' ? { code, label }
      : adding.level === 'skill' ? { code, categoryCode: adding.categoryCode, label }
        // Offered to agents with the KPM's next publish, as every edit here is.
        : { code, skillCode: adding.skillCode, title: label, publishState: 'published' };
    void change({ op: `${ENTITY[adding.level]}.create`, body }).then((ok) => {
      if (!ok) return;
      // The row just added is in view: its parent stays open.
      const parent = adding.level === 'skill' ? keyOf('category', adding.categoryCode)
        : adding.level === 'module' ? keyOf('skill', adding.skillCode) : null;
      if (parent) setOpenRows(new Set([...opened, parent]));
      setAdding(null);
    });
  };

  /** *Unggah materi* / *Ganti*: the picker, then sign → send → confirm → save the module's material. */
  const choose = (row: TrainingModuleRow) => {
    if (busy || uploading) return;
    target.current = row;
    picker.current?.click();
  };
  const upload = async (file: File | undefined) => {
    if (picker.current) picker.current.value = '';
    const chosen = target.current;
    if (!file || !chosen) return;
    setError(null);
    setNotice(null);
    if (file.size > MAX_BYTES) {
      setError({ code: 'ASSET_TOO_LARGE', message: t.content.tooLarge({ name: file.name, size: formatFileSize(file.size, figures) }), requestId: '' });
      return;
    }
    const mimeType = trainingFileType(file);
    if (!mimeType) {
      setError({ code: 'ASSET_TYPE_NOT_ALLOWED', message: t.content.notAccepted({ name: file.name }), requestId: '' });
      return;
    }
    setUploading(file.name);
    try {
      const item = await uploadTrainingFile(file, mimeType);
      const view = await readModuleContent(chosen.code);
      await saveModuleContent(chosen.code, withUploaded(view, item));
      await load();
      setNotice(t.tree.uploaded({ title: chosen.title }));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setUploading(null);
    }
  };

  // ---------------------------------------------------------------- parts

  const rail = <span aria-hidden="true" className="ml-1.5 w-[18px] shrink-0 self-stretch border-l-2 border-hairline" />;

  /** The name, and the pencil beside it — or, while renaming, the name and its description in a form. */
  const nameBlock = (level: Level, row: Row, sub: ReactNode, strong: boolean) => {
    const key = keyOf(level, row.code);
    const label = nameOfRow(row);
    if (renaming?.key === key) {
      return (
        <form
          {...CONTROL}
          className="flex min-w-0 flex-1 flex-wrap items-end gap-2 py-1"
          onSubmit={(e) => { e.preventDefault(); submitRename(level, row); }}
        >
          <Field label={s.name} htmlFor={`rename-${key}`} hint={t.tree.codeOf({ code: row.code })} className="min-w-40 flex-1">
            <TextInput
              id={`rename-${key}`}
              value={renaming.label}
              disabled={busy}
              autoFocus
              onChange={(e) => setRenaming({ ...renaming, label: e.target.value })}
            />
          </Field>
          <Field
            label={level === 'category' ? s.description : t.shortDescription}
            htmlFor={`describe-${key}`}
            className="min-w-40 flex-1"
          >
            <TextInput
              id={`describe-${key}`}
              value={renaming.description}
              disabled={busy}
              maxLength={level === 'category' ? undefined : TRAINING_DESCRIPTION_MAX}
              onChange={(e) => setRenaming({ ...renaming, description: e.target.value })}
            />
          </Field>
          {level === 'skill' && (
            <Field label={t.category} htmlFor={`move-${key}`} hint={t.movesWithIt} className="min-w-40">
              <Select
                id={`move-${key}`}
                value={renaming.categoryCode ?? ''}
                disabled={busy}
                onChange={(e) => setRenaming({ ...renaming, categoryCode: e.target.value })}
              >
                {/* Where it is, and any active category it could go. */}
                {(tree ?? [])
                  .filter((c) => c.status === 'active' || ('categoryCode' in row && c.code === row.categoryCode))
                  .map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </Select>
            </Field>
          )}
          <Button type="submit" disabled={busy || !renaming.label.trim()}>{s.save}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setRenaming(null)}>{s.cancel}</Button>
        </form>
      );
    }
    return (
      <span className="flex min-w-0 flex-1 basis-40 flex-col">
        <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
          <span className={cn('text-navy', strong ? 'text-md font-bold' : 'text-base font-semibold')}>{label}</span>
          {canWrite && (
            <button
              {...CONTROL}
              type="button"
              aria-label={t.tree.rename({ label })}
              disabled={busy}
              onClick={() => {
                setAdding(null);
                setRenaming({ key, label, description: row.description ?? '', ...('categoryCode' in row ? { categoryCode: row.categoryCode } : {}) });
              }}
              // 44 × 44px below 1024px (UI-142), the glyph centred; 24px from 1024px, as frame 17 draws it.
              className="inline-flex h-6 w-6 items-center justify-center rounded text-signal-grey hover:text-navy max-lg:h-11 max-lg:w-11"
            >
              <LineIcon name="pencil" className="h-3.5 w-3.5" />
            </button>
          )}
          {'publishState' in row && row.publishState === 'draft' && row.status === 'active' && (
            <span title={t.tree.draftTip}><ConfigBadge tone="open">{t.tree.draft}</ConfigBadge></span>
          )}
          {row.status === 'archived' && <ConfigBadge tone="open">{s.archivedBadge}</ConfigBadge>}
        </span>
        <span className="text-sm text-muted">{sub}</span>
      </span>
    );
  };

  /** ⋯: archive or restore; on a module, its page first. */
  const menuOf = (level: Level, row: Row) => (canWrite ? (
    <span {...CONTROL} className="shrink-0">
      <ActionMenu
        label={t.tree.more({ label: nameOfRow(row) })}
        glyph="⋯"
        triggerClassName="max-lg:h-11 max-lg:w-11"
        items={[
          ...(level === 'module' ? [{ label: t.tree.manage, onSelect: () => router.push(`/kpm/settings/training/${row.id}`) }] : []),
          {
            label: row.status === 'archived' ? s.restore : s.archive,
            tone: row.status === 'archived' ? 'neutral' as const : 'alert' as const,
            hint: row.status === 'archived' || level === 'module' ? undefined : t.tree.archiveTip,
            onSelect: () => void setStatus(level, row),
          },
        ]}
      />
    </span>
  ) : null);

  const addRow = (label: string, next: Adding, rails: number) => {
    if (!canWrite) return null;
    const open = JSON.stringify(adding) === JSON.stringify(next);
    if (open) return addForm(rails);
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => startAdding(next)}
        className="flex min-h-11 w-full items-center gap-2 border-t border-divider px-4 text-left text-base font-bold text-primary-ink hover:bg-hover-row lg:min-h-10"
      >
        {Array.from({ length: rails }, (_, i) => <span key={i} className="contents">{rail}</span>)}
        <LineIcon name="plus" className="h-4 w-4" />
        {label}
      </button>
    );
  };

  const addForm = (rails: number) => {
    if (!adding) return null;
    const level = adding.level;
    const taken = codeTaken(level === 'category' ? flat.categories : level === 'skill' ? flat.skills : flat.modules, draft.code);
    const ready = draft.label.trim() !== '' && draft.code.trim() !== '' && !taken;
    return (
      <form
        className="flex flex-wrap items-end gap-2 border-t border-divider px-4 py-3"
        onSubmit={(e) => { e.preventDefault(); if (ready) submitAdd(); }}
      >
        {Array.from({ length: rails }, (_, i) => <span key={i} className="contents">{rail}</span>)}
        <Field label={level === 'module' ? t.moduleTitle : s.name} htmlFor={`add-${level}`} className="min-w-40 flex-1">
          <TextInput
            id={`add-${level}`}
            value={draft.label}
            disabled={busy}
            autoFocus
            onChange={(e) => {
              const label = e.target.value;
              setDraft((d) => ({ ...d, label, code: d.codeTouched ? d.code : suggestCode(label) }));
            }}
          />
        </Field>
        <Field
          label={s.code}
          htmlFor={`add-${level}-code`}
          hint={t.codeHint}
          error={taken ? t.codeTaken[level] : undefined}
          className="min-w-40"
        >
          <TextInput
            id={`add-${level}-code`}
            value={draft.code}
            invalid={taken}
            disabled={busy}
            onChange={(e) => {
              const code = e.target.value.toUpperCase();
              setDraft((d) => ({ ...d, code, codeTouched: code !== '' }));
            }}
          />
        </Field>
        <Button type="submit" disabled={busy || !ready}>{s.add}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => setAdding(null)}>{s.cancel}</Button>
      </form>
    );
  };

  /** A module's figure, its file with *Ganti* or *Unggah materi*, and ⋯. */
  const moduleRow = (row: TrainingModuleRow) => {
    const c = row.completion;
    const sub = c === undefined ? null : c.started === 0 ? t.tree.nobodyYet : t.tree.done({ done: c.done, of: c.of });
    const item = row.materialItem ?? null;
    const live = row.status === 'active';
    return (
      <li key={row.code} data-module={row.code} className="flex min-h-11 flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-divider bg-card px-4 py-2">
        {rail}
        {rail}
        <LineIcon name="fileText" className="h-[18px] w-[18px] text-signal-grey" />
        {nameBlock('module', row, sub, false)}
        <span className="ml-auto flex items-center gap-2">
          {item && (
            <span
              title={item.label}
              data-material-item=""
              className="inline-flex max-w-[7rem] items-center gap-1 truncate rounded-md bg-hover-row px-2 py-1 text-sm text-navy sm:max-w-[11.25rem]"
            >
              <LineIcon name={item.kind === 'link' ? 'link' : 'paperclip'} className="h-3.5 w-3.5" />
              <span className="truncate">{item.label}</span>
            </span>
          )}
          {canWrite && live && (
            <Button
              {...CONTROL}
              variant={item ? 'secondary' : 'primary'}
              disabled={busy || uploading !== null}
              aria-label={item ? t.tree.replaceName({ title: row.title }) : t.tree.uploadName({ title: row.title })}
              className="h-8 gap-1.5 px-3 text-sm max-lg:min-h-11"
              onClick={() => choose(row)}
            >
              {!item && <LineIcon name="ti-upload" className="h-4 w-4" />}
              {item ? t.tree.replace : t.tree.upload}
            </Button>
          )}
          {menuOf('module', row)}
        </span>
      </li>
    );
  };

  const skillRow = (skill: TrainingSkillRow) => {
    const key = keyOf('skill', skill.code);
    const isOpen = opened.has(key);
    const modules = visible(skill.modules);
    return (
      <li key={skill.code} data-skill={skill.code} className="border-t border-divider">
        {/* A tap on the row opens it (the brief); the chevron is the control a keyboard and a screen reader use. */}
        <div onClick={rowClick(key)} className="flex min-h-11 cursor-pointer items-center gap-2.5 bg-base/40 px-4 py-2">
          {rail}
          <button
            {...CONTROL}
            type="button"
            aria-expanded={isOpen}
            aria-label={t.tree.toggle({ label: skill.label })}
            onClick={() => toggle(key)}
            className="flex h-8 w-6 shrink-0 items-center justify-center text-signal-grey max-lg:h-11"
          >
            <LineIcon name={isOpen ? 'chevronDown' : 'chevronRight'} className="h-4 w-4" />
          </button>
          {nameBlock('skill', skill, t.tree.skillLine({ modules: liveModules(skill) }), false)}
          {menuOf('skill', skill)}
        </div>
        {isOpen && (
          <>
            <ul className="m-0 list-none p-0">{modules.map(moduleRow)}</ul>
            {skill.status === 'active' && addRow(t.tree.addModule, { level: 'module', skillCode: skill.code }, 2)}
          </>
        )}
      </li>
    );
  };

  const categoryRow = (category: TrainingCategoryRow) => {
    const key = keyOf('category', category.code);
    const isOpen = opened.has(key);
    const counts = categoryCounts(category);
    return (
      <li key={category.code} data-category={category.code} className="border-t border-divider first:border-t-0">
        <div onClick={rowClick(key)} className="flex min-h-11 cursor-pointer items-center gap-2.5 bg-card px-4 py-2.5">
          <button
            {...CONTROL}
            type="button"
            aria-expanded={isOpen}
            aria-label={t.tree.toggle({ label: category.label })}
            onClick={() => toggle(key)}
            className="flex h-8 w-6 shrink-0 items-center justify-center text-primary-ink max-lg:h-11"
          >
            <LineIcon name={isOpen ? 'chevronDown' : 'chevronRight'} className="h-4 w-4" />
          </button>
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary/[0.08] text-navy">
            <LineIcon name="folder" className="h-[18px] w-[18px]" />
          </span>
          {nameBlock('category', category, t.tree.categoryLine(counts), true)}
          {menuOf('category', category)}
        </div>
        {isOpen && (
          <>
            <ul className="m-0 list-none p-0">{visible(category.skills).map(skillRow)}</ul>
            {category.status === 'active' && addRow(t.tree.addSkill, { level: 'skill', categoryCode: category.code }, 1)}
          </>
        )}
      </li>
    );
  };

  return (
    <SettingsScreen title={t.title} permission="training_settings:read" error={null} bars={<PublishBar refreshKey={publishKey} />}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="m-0 text-sm text-muted">
            <span>{t.tree.path}</span>
            <span aria-hidden="true">{' · '}</span>
            <span>{t.materialCount({ x: withMaterial, y: activeModules.length })}</span>
          </p>
          <span className="ml-auto flex flex-wrap items-center gap-3">
            <TemplateSyncControl
              canWrite={canWrite}
              refreshKey={publishKey}
              onApplied={(result) => {
                setNotice(t.sync.done[result.outcome]);
                setError(null);
                void load();
                setPublishKey((k) => k + 1);
              }}
              onError={(err) => { setNotice(null); setError(err); }}
            />
            {canWrite && (
              <Button variant="secondary" disabled={busy} className="gap-1.5 max-lg:min-h-11" onClick={() => startAdding({ level: 'category' })}>
                <LineIcon name="plus" className="h-4 w-4" />
                {t.tree.addCategory}
              </Button>
            )}
          </span>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-primary bg-card p-4">
            <p className="text-md text-navy">{error.message}</p>
          </div>
        )}
        {uploading && <p role="status" className="m-0 text-md text-muted">{t.content.uploading({ name: uploading })}</p>}
        {notice && <p role="status" className="m-0 text-md font-semibold text-success">{notice}</p>}

        <section className="overflow-hidden rounded-lg bg-card" aria-label={t.tree.path} data-training-tree="">
          {adding?.level === 'category' && addForm(0)}
          {categories.length === 0
            ? <EmptyState title={t.noCategories} />
            : <ul className="m-0 list-none p-0">{categories.map(categoryRow)}</ul>}
        </section>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-muted">
          <span>{t.tree.tapToOpen}</span>
          <span>{t.tree.uploadAnywhere}</span>
          <span className="inline-flex items-center gap-1">
            <LineIcon name="pencil" className="h-3.5 w-3.5" />
            {t.tree.renameNote}
          </span>
          <label className={cn('inline-flex items-center gap-2', ARCHIVED_SWITCH_ROW)}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            {s.showArchived}
          </label>
        </div>
      </div>

      {canWrite && (
        <input
          ref={picker}
          type="file"
          hidden
          accept={TRAINING_ACCEPT}
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      )}
    </SettingsScreen>
  );
}
