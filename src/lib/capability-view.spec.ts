import { describe, expect, it } from 'vitest';
import { firstIncomplete, gridCount, ladderRungs } from './capability-view';
import type { CapabilityGridRow, CapabilityProfileCatalog, CapabilityStatus } from './coaching';

const row = (code: string, displayOrder: number, status: CapabilityStatus = 'active') => ({ code, label: code, displayOrder, status });
const stage = (code: string, n: number, required: string[], displayOrder = n, status: CapabilityStatus = 'active') => ({
  ...row(code, displayOrder, status), stageOrder: n, requiredMilestoneCodes: required,
});
const grid = (code: string, items: string[], status: CapabilityStatus = 'active'): CapabilityGridRow => ({
  ...row(code, 1, status), requiresDownline: false, items: items.map((c, i) => row(c, i + 1)),
});

/** The platform ladder (`capability.ts`): each stage stores its milestones cumulatively. */
const CATALOG: CapabilityProfileCatalog = {
  stages: [
    stage('S1', 1, ['M1']),
    stage('S2', 2, ['M1', 'M2']),
    stage('S3', 3, ['M1', 'M2', 'M3', 'M4']),
    stage('S4', 4, ['M1', 'M2', 'M3', 'M4', 'M5']),
  ],
  milestones: ['M1', 'M2', 'M3', 'M4', 'M5'].map((c, i) => row(c, i + 1)),
  grids: [],
};
const added = (rungs: ReturnType<typeof ladderRungs>) => rungs.map((r) => r.added.map((m) => m.code));

describe('the capability ladder as UI V1 draws it (Phase 18.99 T10)', () => {
  it('UI-035 lists each criterion once, under the most junior stage that requires it', () => {
    const rungs = ladderRungs(CATALOG, 'S2', new Set(['M1', 'M2']));
    expect(added(rungs)).toEqual([['M1'], ['M2'], ['M3', 'M4'], ['M5']]);
    expect(rungs.flatMap((r) => r.added).length).toBe(5);
  });

  it('UI-035 marks the stages by seniority: below the current one done, the current one, above it next', () => {
    expect(ladderRungs(CATALOG, 'S2', new Set()).map((r) => [r.n, r.state]))
      .toEqual([[1, 'done'], [2, 'current'], [3, 'next'], [4, 'next']]);
    expect(ladderRungs(CATALOG, null, new Set()).map((r) => r.state)).toEqual(['next', 'next', 'next', 'next']);
  });

  it('UI-035 a ladder drawn top rung first still gives each criterion to its junior stage, numbered by place', () => {
    const reversed = { ...CATALOG, stages: CATALOG.stages.map((s) => ({ ...s, displayOrder: 5 - s.stageOrder })) };
    const rungs = ladderRungs(reversed, 'S3', new Set());
    expect(rungs.map((r) => [r.n, r.stage.code, r.state])).toEqual([[1, 'S4', 'next'], [2, 'S3', 'current'], [3, 'S2', 'done'], [4, 'S1', 'done']]);
    expect(added(rungs)).toEqual([['M5'], ['M3', 'M4'], ['M2'], ['M1']]);
  });

  it('UI-035 a stage not drawn passes its criteria to the next drawn stage that requires them; an archived unticked one is not drawn', () => {
    const catalog = {
      ...CATALOG,
      stages: [stage('S1', 1, ['M1'], 1, 'archived'), ...CATALOG.stages.slice(1)],
      milestones: CATALOG.milestones.map((m) => (m.code === 'M4' ? { ...m, status: 'archived' as const } : m)),
    };
    expect(added(ladderRungs(catalog, 'S2', new Set(['M1'])))).toEqual([['M1', 'M2'], ['M3'], ['M5']]);
    expect(added(ladderRungs(catalog, 'S2', new Set(['M1', 'M4'])))).toEqual([['M1', 'M2'], ['M3', 'M4'], ['M5']]);
  });

  it('UI-036 counts a section’s drawn items ticked over its drawn items', () => {
    const selling = grid('SELLING', ['A', 'B', 'C']);
    expect(gridCount(selling, new Set(['A', 'C', 'Z']))).toEqual({ done: 2, total: 3 });
    const withArchived = { ...selling, items: [...selling.items, row('OLD', 4, 'archived')] };
    // An archived item is drawn only where it is ticked, and counted only then.
    expect(gridCount(withArchived, new Set(['A']))).toEqual({ done: 1, total: 3 });
    expect(gridCount(withArchived, new Set(['A', 'OLD']))).toEqual({ done: 2, total: 4 });
  });

  it('UI-036 opens the first section that applies and still has an item to tick; none when all are complete', () => {
    const grids = [grid('ONE', ['A']), grid('TWO', ['B', 'C']), grid('THREE', ['D'])];
    const all = () => true;
    expect(firstIncomplete(grids, new Set(['A']), all)).toBe('TWO');
    expect(firstIncomplete(grids, new Set(), (g) => g.code !== 'ONE')).toBe('TWO');
    expect(firstIncomplete(grids, new Set(['A', 'B', 'C', 'D']), all)).toBeNull();
  });
});
