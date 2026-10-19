import { describe, expect, it } from 'vitest';
import type { ConfigChange, TrainingCategoryRow } from '@/lib/tenant-config';
import {
  codeTaken, flattenTraining, isUnsaved, projectTraining, stageEdit, stageStatus, unstageTraining,
} from '@/lib/training-view';

const TREE: TrainingCategoryRow[] = [
  {
    id: 'c-sales', code: 'SALES', label: 'Sales', description: null, displayOrder: 1, version: 1, status: 'active',
    skills: [
      {
        id: 's-prospecting', code: 'PROSPECTING', categoryCode: 'SALES', label: 'Prospecting',
        displayOrder: 1, version: 2, status: 'active',
        modules: [
          {
            id: 'm-list', code: 'PROSPECT_LIST', skillCode: 'PROSPECTING', title: 'Building Your Prospect List',
            publishState: 'published', displayOrder: 1, version: 3, status: 'active',
          },
        ],
      },
    ],
  },
  {
    id: 'c-product', code: 'PRODUCT', label: 'Product', description: 'What we sell.', displayOrder: 2, version: 1,
    status: 'active', skills: [],
  },
];

const shownModule = (ops: ConfigChange[]) => projectTraining(TREE, ops).modules[0];

describe('the training taxonomy as it will be (P5-T1)', () => {
  it('flattens the nested read into the three lists the batch addresses', () => {
    const flat = flattenTraining(TREE);

    expect(flat.categories.map((c) => c.code)).toEqual(['SALES', 'PRODUCT']);
    expect(flat.skills.map((s) => s.code)).toEqual(['PROSPECTING']);
    expect(flat.modules.map((m) => m.code)).toEqual(['PROSPECT_LIST']);
    expect(flat.categories[0]).not.toHaveProperty('skills');
  });

  it('shows nothing staged as exactly what the office has', () => {
    const view = projectTraining(TREE, []);

    expect(view.categories.every((c) => c.staged === null && !c.archived)).toBe(true);
    expect(shownModule([])).toMatchObject({ staged: null, archived: false, cascaded: false });
  });

  it('draws a staged category archive down through its skills and modules', () => {
    const view = projectTraining(TREE, [{ op: 'trainingCategory.archive', id: 'c-sales', expectedVersion: 1 }]);

    expect(view.categories[0]).toMatchObject({ staged: 'archived', archived: true, cascaded: false });
    expect(view.skills[0]).toMatchObject({ staged: null, archived: true, cascaded: true });
    expect(view.modules[0]).toMatchObject({ staged: null, archived: true, cascaded: true });
  });

  it('does not bring back what a restored category once held', () => {
    const archived: TrainingCategoryRow[] = [{
      ...TREE[0],
      status: 'archived',
      skills: [{ ...TREE[0].skills[0], status: 'archived' }],
    }];
    const view = projectTraining(archived, [{ op: 'trainingCategory.restore', id: 'c-sales', expectedVersion: 1 }]);

    expect(view.categories[0]).toMatchObject({ archived: false, staged: 'restored' });
    expect(view.skills[0]).toMatchObject({ archived: true, cascaded: false });
  });

  it('moves a skill with its modules when its category changes', () => {
    const view = projectTraining(TREE, [
      { op: 'trainingSkill.update', id: 's-prospecting', expectedVersion: 2, body: { categoryCode: 'PRODUCT' } },
    ]);

    expect(view.skills[0].row.categoryCode).toBe('PRODUCT');
    // The module holds its skill, not a category, so it goes wherever the skill goes.
    expect(view.modules[0].row.skillCode).toBe('PROSPECTING');
  });

  it('draws a staged module as a draft, under the skill it names', () => {
    const view = projectTraining(TREE, [
      { op: 'trainingModule.create', body: { code: 'cold_calls', skillCode: 'PROSPECTING', title: 'Cold calls' } },
    ]);

    const added = view.modules[1];
    expect(added).toMatchObject({ staged: 'added', archived: false });
    expect(added.row).toMatchObject({ code: 'COLD_CALLS', publishState: 'draft', skillCode: 'PROSPECTING' });
    expect(isUnsaved(added.row)).toBe(true);
    expect(isUnsaved(view.modules[0].row)).toBe(false);
  });

  it('draws staged categories and skills with the fields they were given', () => {
    const view = projectTraining(TREE, [
      { op: 'trainingCategory.create', body: { code: 'LEGAL', label: 'Legal', description: 'Rules.' } },
      { op: 'trainingSkill.create', body: { code: 'CONTRACTS', categoryCode: 'LEGAL', label: 'Contracts' } },
      { op: 'trainingModule.create', body: { code: 'READING', skillCode: 'CONTRACTS', title: 'Reading', publishState: 'published' } },
    ]);

    expect(view.categories[2].row).toMatchObject({ code: 'LEGAL', description: 'Rules.', status: 'active' });
    expect(view.skills[1]).toMatchObject({ archived: false, row: { categoryCode: 'LEGAL' } });
    expect(view.modules[1].row.publishState).toBe('published');
  });

  it('treats a row whose parent is nowhere as archived, since no screen can show it', () => {
    const view = projectTraining(TREE, [
      { op: 'trainingSkill.create', body: { code: 'ORPHAN', categoryCode: 'NOWHERE', label: 'Orphan' } },
    ]);

    expect(view.skills[1]).toMatchObject({ archived: true, cascaded: true });
  });
});

describe('staging an edit sends only what differs', () => {
  const saved = { ...TREE[0].skills[0].modules[0] } as unknown as { id: string; version: number } & Record<string, unknown>;

  it('stages the fields that changed, at the version read', () => {
    const ops = stageEdit([], 'trainingModule', saved, { publishState: 'draft' });

    expect(ops).toEqual([
      { op: 'trainingModule.update', id: 'm-list', expectedVersion: 3, body: { publishState: 'draft' } },
    ]);
  });

  it('merges a second edit to the same row into the first', () => {
    const once = stageEdit([], 'trainingModule', saved, { publishState: 'draft' });
    const twice = stageEdit(once, 'trainingModule', saved, { title: 'Prospect lists' });

    expect(twice).toHaveLength(1);
    expect(twice[0].body).toEqual({ publishState: 'draft', title: 'Prospect lists' });
  });

  it('takes a field back out when it is put back, and drops an edit left empty', () => {
    const unpublished = stageEdit([], 'trainingModule', saved, { publishState: 'draft' });

    expect(stageEdit(unpublished, 'trainingModule', saved, { publishState: 'published' })).toEqual([]);
  });

  it('reads a cleared description as the null the office already has', () => {
    const category = { ...TREE[0] } as unknown as { id: string; version: number } & Record<string, unknown>;

    expect(stageEdit([], 'trainingCategory', category, { label: 'Sales', description: '' })).toEqual([]);
  });

  it('leaves other rows and other ops alone', () => {
    const others: ConfigChange[] = [{ op: 'trainingModule.archive', id: 'm-list', expectedVersion: 3 }];

    expect(stageEdit(others, 'trainingModule', saved, { title: 'X' })).toEqual([
      others[0],
      { op: 'trainingModule.update', id: 'm-list', expectedVersion: 3, body: { title: 'X' } },
    ]);
  });
});

describe('archive and restore', () => {
  const row = { id: 'c-sales', version: 1 };

  it('stages the one asked for', () => {
    expect(stageStatus([], 'trainingCategory', row, 'archive')).toEqual([
      { op: 'trainingCategory.archive', id: 'c-sales', expectedVersion: 1 },
    ]);
  });

  /*
   * Staged together, archive then restore would archive every skill and module in the category
   * and bring back only the category. Pressing Restore on a staged archive means Undo.
   */
  it('takes back a staged archive rather than staging a restore beside it', () => {
    const archived = stageStatus([], 'trainingCategory', row, 'archive');

    expect(stageStatus(archived, 'trainingCategory', row, 'restore')).toEqual([]);
  });

  it('takes back a staged restore the same way', () => {
    const restored = stageStatus([], 'trainingSkill', row, 'restore');

    expect(stageStatus(restored, 'trainingSkill', row, 'archive')).toEqual([]);
  });
});

describe('a code already taken', () => {
  const view = projectTraining(TREE, [
    { op: 'trainingModule.create', body: { code: 'COLD_CALLS', skillCode: 'PROSPECTING', title: 'Cold calls' } },
  ]);

  it('is found whatever its case, counting rows staged but not saved', () => {
    expect(codeTaken(view.modules, 'prospect_list')).toBe(true);
    expect(codeTaken(view.modules, 'COLD_CALLS')).toBe(true);
  });

  it('is only ever taken within its own level, and never when blank', () => {
    expect(codeTaken(view.modules, 'PROSPECTING')).toBe(false);
    expect(codeTaken(view.modules, '  ')).toBe(false);
  });
});

describe('taking a row back', () => {
  const ops: ConfigChange[] = [
    { op: 'trainingCategory.create', body: { code: 'LEGAL', label: 'Legal' } },
    { op: 'trainingSkill.create', body: { code: 'contracts', categoryCode: 'legal', label: 'Contracts' } },
    { op: 'trainingModule.create', body: { code: 'READING', skillCode: 'CONTRACTS', title: 'Reading' } },
    { op: 'trainingModule.create', body: { code: 'COLD', skillCode: 'PROSPECTING', title: 'Cold calls' } },
    { op: 'trainingModule.update', id: 'm-list', expectedVersion: 3, body: { title: 'Lists' } },
  ];
  const view = projectTraining(TREE, ops);

  it('takes an unsaved category back with the skills and modules staged inside it', () => {
    const legal = view.categories.find((c) => c.row.code === 'LEGAL')!.row;

    expect(unstageTraining(ops, 'trainingCategory', legal)).toEqual([ops[3], ops[4]]);
  });

  it('takes an unsaved skill back with its modules, and nothing else', () => {
    const contracts = view.skills.find((s) => s.row.code === 'CONTRACTS')!.row;

    expect(unstageTraining(ops, 'trainingSkill', contracts)).toEqual([ops[0], ops[3], ops[4]]);
  });

  it('takes an unsaved module back alone', () => {
    const cold = view.modules.find((m) => m.row.code === 'COLD')!.row;

    expect(unstageTraining(ops, 'trainingModule', cold)).toEqual([ops[0], ops[1], ops[2], ops[4]]);
  });

  it('takes every op on a saved row back, and no other row', () => {
    const list = view.modules.find((m) => m.row.code === 'PROSPECT_LIST')!.row;

    expect(unstageTraining(ops, 'trainingModule', list)).toEqual(ops.slice(0, 4));
  });
});
