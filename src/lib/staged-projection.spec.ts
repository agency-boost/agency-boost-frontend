import { describe, expect, it } from 'vitest';
import { projectStaged, unstageRow } from '@/lib/staged-projection';
import type { ConfigChange } from '@/lib/tenant-config';

interface Row { id: string; label: string; benchmark: number; status: 'active' | 'archived' }

const ROWS: Row[] = [
  { id: 'r-1', label: 'Selling success rate', benchmark: 0.15, status: 'active' },
  { id: 'r-2', label: 'Leads per activity', benchmark: 0.3, status: 'active' },
];

const project = (ops: ConfigChange[], rows = ROWS) => projectStaged(rows, ops, {
  entity: 'ratio',
  create: (body, id) => ({
    id,
    label: String(body.label ?? ''),
    benchmark: Number(body.benchmark ?? 0),
    status: 'active',
  }),
});

describe('projectStaged', () => {
  it('leaves rows alone when nothing is staged', () => {
    expect(project([])).toEqual([
      { row: ROWS[0], staged: null },
      { row: ROWS[1], staged: null },
    ]);
  });

  /*
   * The assertion this module exists for, and the defect the client reported three times:
   * the edit panel staged a new benchmark and the card went on showing the old one.
   */
  it('shows an edited row as it will be, not as the office still has it', () => {
    const [first] = project([
      { op: 'ratio.update', id: 'r-1', expectedVersion: 3, body: { benchmark: 0.2 } },
    ]);

    expect(first.row.benchmark).toBe(0.2);
    expect(first.staged).toBe('edited');
  });

  it('keeps the fields the edit did not touch', () => {
    const [first] = project([{ op: 'ratio.update', id: 'r-1', body: { benchmark: 0.2 } }]);

    expect(first.row.label).toBe('Selling success rate');
  });

  it('shows a row that is only staged for archive as archived', () => {
    const [, second] = project([{ op: 'ratio.archive', id: 'r-2' }]);

    expect(second.row.status).toBe('archived');
    expect(second.staged).toBe('archived');
  });

  it('shows a restore as active again', () => {
    const rows: Row[] = [{ ...ROWS[0], status: 'archived' }];
    const [only] = project([{ op: 'ratio.restore', id: 'r-1' }], rows);

    expect(only.row.status).toBe('active');
    expect(only.staged).toBe('restored');
  });

  it('shows a row that does not exist yet, so Add is not a button that does nothing', () => {
    const out = project([{ op: 'ratio.create', body: { label: 'Referral conversion', benchmark: 0.4 } }]);

    expect(out).toHaveLength(3);
    expect(out[2].row.label).toBe('Referral conversion');
    expect(out[2].staged).toBe('added');
    // Keyable, and never sent: `applyConfigChanges` puts only `op` and `body` on the wire.
    expect(out[2].row.id).toMatch(/^staged:ratio:\d+$/);
  });

  it('lets the last op on a row win, the way stageChange collapses them', () => {
    const [first] = project([
      { op: 'ratio.update', id: 'r-1', body: { benchmark: 0.2 } },
      { op: 'ratio.update', id: 'r-1', body: { benchmark: 0.25 } },
    ]);

    expect(first.row.benchmark).toBe(0.25);
  });

  it('reports an edited-then-archived row as archived', () => {
    // The stronger statement of the two: the reader needs to know it is leaving the list.
    const [first] = project([
      { op: 'ratio.update', id: 'r-1', body: { benchmark: 0.2 } },
      { op: 'ratio.archive', id: 'r-1' },
    ]);

    expect(first.staged).toBe('archived');
    expect(first.row.benchmark).toBe(0.2);
  });

  it('ignores operations belonging to another entity', () => {
    // One screen stages categories and types together; a category op must not be hunted
    // for among the types and silently dropped on the floor either.
    expect(project([{ op: 'type.archive', id: 'r-1' }])).toEqual([
      { row: ROWS[0], staged: null },
      { row: ROWS[1], staged: null },
    ]);
  });

  it('ignores an operation naming a row the screen is not showing', () => {
    expect(project([{ op: 'ratio.update', id: 'gone', body: { benchmark: 9 } }])).toHaveLength(2);
  });
});

describe('unstageRow', () => {
  it('takes back every op on one existing row and leaves its neighbours staged', () => {
    const ops: ConfigChange[] = [
      { op: 'ratio.update', id: 'r-1', body: { benchmark: 0.2 } },
      { op: 'ratio.archive', id: 'r-1' },
      { op: 'ratio.update', id: 'r-2', body: { benchmark: 0.5 } },
    ];

    expect(unstageRow(ops, 'ratio', 'r-1')).toEqual([ops[2]]);
  });

  it('takes back a create by the positional id it was shown under', () => {
    const ops: ConfigChange[] = [
      { op: 'ratio.update', id: 'r-1', body: { benchmark: 0.2 } },
      { op: 'ratio.create', body: { label: 'Referral conversion' } },
    ];

    expect(unstageRow(ops, 'ratio', 'staged:ratio:1')).toEqual([ops[0]]);
  });

  it('leaves another entity’s op on the same id alone', () => {
    const ops: ConfigChange[] = [{ op: 'type.archive', id: 'r-1' }];

    expect(unstageRow(ops, 'ratio', 'r-1')).toEqual(ops);
  });
});
