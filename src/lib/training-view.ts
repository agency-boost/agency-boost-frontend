import { projectStaged, type StagedMark } from '@/lib/staged-projection';
import {
  stageChange,
  type ConfigChange,
  type TrainingCategoryRow,
  type TrainingModuleRow,
  type TrainingSkillRow,
} from '@/lib/tenant-config';

/** A category without the skills the read nests in it. */
export type TrainingCategory = Omit<TrainingCategoryRow, 'skills'>;
/** A skill without the modules the read nests in it. */
export type TrainingSkill = Omit<TrainingSkillRow, 'modules'>;
export type TrainingModule = TrainingModuleRow;

export type TrainingEntity = 'trainingCategory' | 'trainingSkill' | 'trainingModule';

/** One row as it will be once what is staged is saved. */
export interface ShownRow<T> {
  row: T;
  /** What an op staged **on this row** does to it. */
  staged: StagedMark | null;
  /** Archived, whether by itself or because the category or skill above it is. */
  archived: boolean;
  /**
   * Archived only because the row above it is — by an archive that is staged, since a saved one
   * has already archived this row as well. The Undo for it is on that row, not this one.
   */
  cascaded: boolean;
}

export interface TrainingView {
  categories: ShownRow<TrainingCategory>[];
  skills: ShownRow<TrainingSkill>[];
  modules: ShownRow<TrainingModule>[];
}

/** The read's tree as three lists, which is how the batch addresses it — one op, one row. */
export function flattenTraining(tree: TrainingCategoryRow[]) {
  const categories: TrainingCategory[] = tree.map(({ skills: _skills, ...category }) => category);
  const skills: TrainingSkill[] = tree.flatMap((category) =>
    category.skills.map(({ modules: _modules, ...skill }) => skill));
  const modules: TrainingModule[] = tree.flatMap((category) =>
    category.skills.flatMap((skill) => skill.modules));
  return { categories, skills, modules };
}

/**
 * The office's training taxonomy as it will be (P5-T1).
 *
 * **Flattened before it is projected**, because a staged op can move a row: a skill named into
 * another category, a module under another skill. Projecting the nested read would leave a
 * moved row drawn under the parent it is leaving. As three lists, a move is one field changing,
 * and each row's parent is looked up by code afterwards — the way the server holds them.
 *
 * **An archive reaches down, on screen as it does on the server.** Archiving a category takes
 * its skills and their modules with it (`TrainingService.archiveCategory`), so a staged archive
 * shows them archived too. A restore does not reach down, and neither does this: the rows a
 * category once held stay archived after it comes back.
 */
export function projectTraining(tree: TrainingCategoryRow[], staged: ConfigChange[]): TrainingView {
  const flat = flattenTraining(tree);

  const categories = projectStaged(flat.categories, staged, {
    entity: 'trainingCategory',
    create: (body, id) => ({
      id,
      code: String(body.code ?? '').toUpperCase(),
      label: String(body.label ?? ''),
      description: body.description ? String(body.description) : null,
      displayOrder: flat.categories.length + 1,
      version: 0,
      status: 'active' as const,
    }),
  }).map(({ row, staged: mark }) => ({
    row, staged: mark, archived: row.status === 'archived', cascaded: false,
  }));

  const skills = projectStaged(flat.skills, staged, {
    entity: 'trainingSkill',
    create: (body, id) => ({
      id,
      code: String(body.code ?? '').toUpperCase(),
      categoryCode: String(body.categoryCode ?? ''),
      label: String(body.label ?? ''),
      displayOrder: flat.skills.length + 1,
      version: 0,
      status: 'active' as const,
    }),
  }).map(({ row, staged: mark }) => {
    const own = row.status === 'archived';
    const parent = categories.find((c) => c.row.code === row.categoryCode);
    const above = !parent || parent.archived;
    return { row, staged: mark, archived: own || above, cascaded: !own && above };
  });

  const modules = projectStaged(flat.modules, staged, {
    entity: 'trainingModule',
    create: (body, id) => ({
      id,
      code: String(body.code ?? '').toUpperCase(),
      skillCode: String(body.skillCode ?? ''),
      title: String(body.title ?? ''),
      // What the server defaults it to: nothing in P5-T1 gives a module content.
      publishState: body.publishState === 'published' ? 'published' as const : 'draft' as const,
      displayOrder: flat.modules.length + 1,
      version: 0,
      status: 'active' as const,
    }),
  }).map(({ row, staged: mark }) => {
    const own = row.status === 'archived';
    const parent = skills.find((s) => s.row.code === row.skillCode);
    const above = !parent || parent.archived;
    return { row, staged: mark, archived: own || above, cascaded: !own && above };
  });

  return { categories, skills, modules };
}

/** A row created in this sitting and not saved: it has no id the server knows. */
export const isUnsaved = (row: { id: string }) => row.id.startsWith('staged:');

/**
 * Stage an edit, sending only what differs from the office's saved row.
 *
 * A field put back to what it was is **taken out** of the staged body, and an edit left with
 * nothing in it is dropped. Otherwise publishing a module and unpublishing it again would still
 * send an update, mark the row *Edited* and move its version — a change made of no change.
 */
export function stageEdit(
  now: ConfigChange[],
  entity: TrainingEntity,
  saved: { id: string; version: number } & Record<string, unknown>,
  fields: Record<string, unknown>,
): ConfigChange[] {
  const op = `${entity}.update` as ConfigChange['op'];
  const previous = now.find((c) => c.op === op && c.id === saved.id);
  const body: Record<string, unknown> = { ...previous?.body, ...fields };
  for (const key of Object.keys(body)) {
    if (body[key] === saved[key] || (body[key] === '' && saved[key] === null)) delete body[key];
  }

  const without = now.filter((c) => !(c.op === op && c.id === saved.id));
  if (Object.keys(body).length === 0) return without;
  // Replaced rather than merged by `stageChange`, which would put the removed fields back.
  return stageChange(without, { op, id: saved.id, expectedVersion: saved.version, body });
}

/**
 * Archive or restore, where pressing the opposite of a staged one **takes that one back**.
 *
 * A category staged for archive shows *Restore*. Staging a restore beside the archive would, once
 * saved, archive the category, archive everything in it, and bring back the category alone — which
 * is not what anybody pressing Archive and then Restore means.
 */
export function stageStatus(
  now: ConfigChange[],
  entity: TrainingEntity,
  row: { id: string; version: number },
  to: 'archive' | 'restore',
): ConfigChange[] {
  const opposite = `${entity}.${to === 'archive' ? 'restore' : 'archive'}`;
  if (now.some((c) => c.op === opposite && c.id === row.id)) {
    return now.filter((c) => !(c.op === opposite && c.id === row.id));
  }
  return stageChange(now, {
    op: `${entity}.${to}` as ConfigChange['op'],
    id: row.id,
    expectedVersion: row.version,
  });
}

/**
 * Take one row's staged ops back — and, for a category or skill that was only ever staged, the
 * rows staged inside it.
 *
 * A skill added to a category added in the same sitting names that category by code. Undoing the
 * category alone would leave the skill naming nothing: drawn under no category, and refused at Save
 * for a reason the reader had already dealt with. The screens offer no way to *move* a saved row into
 * an unsaved one, so what hangs off an unsaved row is only ever a create.
 */
export function unstageTraining(
  now: ConfigChange[],
  entity: TrainingEntity,
  row: { id: string; code: string },
): ConfigChange[] {
  const own = /^staged:[^:]+:(\d+)$/.exec(row.id);
  if (!own) {
    return now.filter((c) => !(c.op.startsWith(`${entity}.`) && c.id === row.id));
  }

  const gone = new Set<number>([Number(own[1])]);
  const code = (value: unknown) => String(value ?? '').trim().toUpperCase();
  const skills = new Set<string>(entity === 'trainingSkill' ? [code(row.code)] : []);
  if (entity === 'trainingCategory') {
    now.forEach((c, at) => {
      if (c.op === 'trainingSkill.create' && code(c.body?.categoryCode) === code(row.code)) {
        gone.add(at);
        skills.add(code(c.body?.code));
      }
    });
  }
  now.forEach((c, at) => {
    if (c.op === 'trainingModule.create' && skills.has(code(c.body?.skillCode))) gone.add(at);
  });
  return now.filter((_, at) => !gone.has(at));
}

/**
 * Whether a code is taken at one level of this office — **archived rows included**, and rows
 * staged but not saved. A code is never reused, and the server refuses one that is; saying so
 * beside the field is kinder than refusing the whole batch at Save.
 */
export function codeTaken(rows: ShownRow<{ code: string }>[], code: string): boolean {
  const wanted = code.trim().toUpperCase();
  return wanted !== '' && rows.some((r) => r.row.code.toUpperCase() === wanted);
}
