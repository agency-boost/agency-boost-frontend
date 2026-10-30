import {
  gridItems, ladderStages, stageMilestones,
  type CapabilityGridRow, type CapabilityProfileCatalog, type CapabilityRow, type CapabilityStageRow,
} from './coaching';

/**
 * **The *Capability mapping* tab as UI V1 draws it** (Phase 18.99 T10; UI-035, UI-036): the ladder with each criterion
 * once, and the *Skill tracker*'s sections with their counts. Read from the profile the server sends
 * (`GET …/profile`), never worked out against it: the stage is still the server's.
 *
 * **The stored model is unchanged** — and needed no change. A stage stores the milestones it requires
 * *cumulatively* (`requiredMilestoneCodes`), which is why the old ladder drew *Sells policies independently* under
 * every stage; but **a milestone is one code, ticked once** (`milestoneCodes`). So the view lists a milestone under the
 * most junior drawn stage that requires it and nowhere else, and ticking it there is ticking *every* stage's copy:
 * there was only ever one.
 */

/** Where a stage stands against the coachee's: below it, it, or above it — by seniority (`stageOrder`), never by place. */
export type RungState = 'done' | 'current' | 'next';

export interface LadderRung {
  stage: CapabilityStageRow;
  /** Its number on screen: its place in the office's display order, from 1. */
  n: number;
  state: RungState;
  /** The milestones this stage adds to the ones below it — each milestone under one stage only (UI-035). */
  added: CapabilityRow[];
}

/**
 * The ladder as drawn (`ladderStages`: the office's display order, an archived stage only while it is the current
 * one), each stage with **only the criteria it adds** (UI-035). A milestone belongs to the most junior drawn stage
 * whose requirements name it; a stage that adds nothing is drawn with no rows.
 *
 * Below the first stage (`stageCode` null) every rung is `next`.
 */
export function ladderRungs(
  catalog: CapabilityProfileCatalog, stageCode: string | null, ticked: ReadonlySet<string>,
): LadderRung[] {
  const drawn = ladderStages(catalog, stageCode);
  const current = drawn.find((s) => s.code === stageCode) ?? null;
  const owner = new Map<string, string>();
  for (const stage of [...drawn].sort((a, b) => a.stageOrder - b.stageOrder)) {
    for (const code of stage.requiredMilestoneCodes) if (!owner.has(code)) owner.set(code, stage.code);
  }
  return drawn.map((stage, i) => ({
    stage,
    n: i + 1,
    state: current === null || stage.stageOrder > current.stageOrder
      ? 'next'
      : stage.code === current.code ? 'current' : 'done',
    added: stageMilestones(stage, catalog, ticked).filter((m) => owner.get(m.code) === stage.code),
  }));
}

/** A *Skill tracker* section's count: its drawn items ticked, over its drawn items — *Personal selling 6/7*. */
export function gridCount(grid: CapabilityGridRow, ticked: ReadonlySet<string>): { done: number; total: number } {
  const items = gridItems(grid, ticked);
  return { done: items.filter((i) => ticked.has(i.code)).length, total: items.length };
}

/**
 * The section a phone and a tablet open first (UI-036, D-25's pattern): the first one that applies and still has an
 * item to tick; none when every section that applies is complete. `applies` says whether a section applies to this
 * coachee — a downline section for somebody with nobody below does not, nor one the office archived.
 */
export function firstIncomplete(
  grids: readonly CapabilityGridRow[], ticked: ReadonlySet<string>, applies: (grid: CapabilityGridRow) => boolean,
): string | null {
  const open = grids.find((g) => {
    if (!applies(g)) return false;
    const { done, total } = gridCount(g, ticked);
    return done < total;
  });
  return open?.code ?? null;
}
