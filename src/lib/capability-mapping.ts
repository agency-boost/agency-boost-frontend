import { api } from './api-client';
import type { CapabilityCatalog, CapabilityStage } from './tenant-config';

/**
 * **Capability Mapping's writes as P19.21-T3 AC-4 draws them** (ADR-0274): a *tahap* with its first milestone, a
 * milestone under a *tahap*, a *kelompok*, a skill — each named by its label alone, the server making the code once — and
 * a kelompok's skills reordered. The read and the rename and archive stay `lib/tenant-config.ts`'.
 */
export type CapabilityAdd =
  | { part: 'stage'; label: string; firstMilestone: string }
  | { part: 'milestone'; label: string; stageCode?: string }
  | { part: 'grid'; label: string }
  | { part: 'item'; label: string; gridCode: string };

export const addCapability = (body: CapabilityAdd) =>
  api<CapabilityCatalog>('/kpm/settings/capability-mapping/items', { method: 'POST', body });

export const reorderCapabilityList = (body: { part: 'stage' | 'milestone' | 'grid' | 'item'; codes: string[]; gridCode?: string }) =>
  api<CapabilityCatalog>('/kpm/settings/capability-mapping/order', { method: 'PATCH', body });

/**
 * **A *tahap*'s own milestones** (P19.21-T3 AC-4; frame 18): the ladder is cumulative — each stage requires everything
 * the stages below it do — so a stage shows only what it adds: its required codes less those of every stage of lower
 * seniority (`stageOrder`, never its position on screen). In the catalog's milestone order.
 */
export function ownMilestoneCodes(stage: CapabilityStage, stages: readonly CapabilityStage[], order: readonly string[]): string[] {
  const below = new Set(stages.filter((s) => s.stageOrder < stage.stageOrder).flatMap((s) => s.requiredMilestoneCodes));
  const own = new Set(stage.requiredMilestoneCodes.filter((code) => !below.has(code)));
  return order.filter((code) => own.has(code));
}

/** `codes` with the entry at `from` moved to `to`; the same list when `to` is outside it. */
export function moved<T>(codes: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= codes.length || from === to) return [...codes];
  const next = [...codes];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/**
 * **A milestone dragged within its *tahap***: the catalog's whole milestone order, with the stage's own milestones
 * permuted among the places they already hold — every other milestone stays where it is, so the reorder the API takes
 * (every code, once) moves nothing outside the stage.
 */
export function reorderWithin(order: readonly string[], own: readonly string[], from: number, to: number): string[] {
  const next = moved(own, from, to);
  const places = order.map((code, at) => (own.includes(code) ? at : -1)).filter((at) => at >= 0);
  const result = [...order];
  places.forEach((at, i) => { result[at] = next[i]; });
  return result;
}
