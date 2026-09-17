import { describe, expect, it } from 'vitest';
import { sequenceVersions, stageChange, type ConfigChange } from '@/lib/tenant-config';

describe('sequenceVersions — the version a batch finds each row at', () => {
  it('leaves one op per row exactly as the screen read it', () => {
    const ops: ConfigChange[] = [
      { op: 'type.update', id: 't-1', expectedVersion: 3, body: { label: 'Closing' } },
      { op: 'type.archive', id: 't-2', expectedVersion: 7 },
      { op: 'type.create', body: { code: 'NEW_ONE' } },
    ];

    expect(sequenceVersions(ops)).toEqual(ops);
  });

  /*
   * The defect: an edit and an archive on one row, saved together, both named version 3. The
   * batch had moved the row to 4 after the edit, and refused the archive as a conflict.
   */
  it('names the version the earlier op on the same row leaves behind', () => {
    const ops = stageChange(
      stageChange([], { op: 'trainingModule.update', id: 'm-1', expectedVersion: 3, body: { publishState: 'draft' } }),
      { op: 'trainingModule.archive', id: 'm-1', expectedVersion: 3 },
    );

    expect(sequenceVersions(ops).map((c) => c.expectedVersion)).toEqual([3, 4]);
  });

  it('counts per row, and per kind of row', () => {
    const ops: ConfigChange[] = [
      { op: 'trainingSkill.update', id: 'x', expectedVersion: 1, body: { label: 'A' } },
      // Another collection's row with the same id is not the same row.
      { op: 'trainingModule.update', id: 'x', expectedVersion: 5, body: { title: 'B' } },
      { op: 'trainingSkill.archive', id: 'x', expectedVersion: 1 },
      { op: 'trainingSkill.restore', id: 'x', expectedVersion: 1 },
    ];

    expect(sequenceVersions(ops).map((c) => c.expectedVersion)).toEqual([1, 5, 2, 3]);
  });

  it('does not change what is staged', () => {
    const ops: ConfigChange[] = [
      { op: 'type.update', id: 't-1', expectedVersion: 3, body: { label: 'Closing' } },
      { op: 'type.archive', id: 't-1', expectedVersion: 3 },
    ];
    sequenceVersions(ops);

    expect(ops[1].expectedVersion).toBe(3);
  });
});
