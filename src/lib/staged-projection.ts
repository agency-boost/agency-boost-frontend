import type { ConfigChange } from '@/lib/tenant-config';

/** What a staged operation did to the row, from the reader's point of view. */
export type StagedMark = 'added' | 'edited' | 'archived' | 'restored';

export interface StagedRow<T> {
  row: T;
  /** `null` when this row is exactly what the office already has. */
  staged: StagedMark | null;
}

/** The sentence each mark puts on the row. */
export const STAGED_LABEL: Record<StagedMark, string> = {
  added: 'Added — not saved yet',
  edited: 'Edited — not saved yet',
  archived: 'Archived — not saved yet',
  restored: 'Restored — not saved yet',
};

/**
 * The rows as they *will* be, given what is staged but not sent (P4-T19).
 *
 * **Without this the settings screens showed a staged edit nowhere.** Save inside an edit
 * panel called `stageChange` and closed the panel; the card underneath went on rendering
 * the row the server sent, because the only thing staging touched was a separate list. So
 * an Owner typed a new benchmark, pressed Save, and read the old number back — and the
 * one piece of evidence the edit existed was a count in a bar that, on that screen, sat
 * above two checkboxes and scrolled out of view. It was reported three times as
 * *"edit Ratio di owner masih belum bisa"*, and editing was never the part that was
 * broken.
 *
 * Applied in order, so the last op on a row wins — the same rule {@link stageChange} uses
 * when it collapses two edits into one. A create has no id and no row to merge onto, so
 * the caller supplies the shape it will take; showing it is the point, because otherwise
 * *Add a ratio* is a button that visibly does nothing.
 *
 * A pure function over both lists rather than state the screens keep in step: two sources
 * that must agree are two sources that eventually will not.
 */
export function projectStaged<T extends { id: string }>(
  rows: T[],
  ops: ConfigChange[],
  {
    entity,
    create,
  }: {
    /** `'ratio'` matches `ratio.create`, `ratio.update`, `ratio.archive`, `ratio.restore`. */
    entity: string;
    /**
     * The row a `*.create` will become, given a stable id so React can key it.
     *
     * Optional because not every screen stages creates — Ratio benchmarks writes a new
     * ratio immediately and only holds edits, so it has no unsaved create to draw. A
     * staged create with no factory is left out rather than guessed at.
     */
    create?: (body: Record<string, unknown>, id: string) => T;
  },
): StagedRow<T>[] {
  const out: StagedRow<T>[] = rows.map((row) => ({ row, staged: null }));

  ops.forEach((change, index) => {
    const [subject, action] = change.op.split('.');
    if (subject !== entity) return;

    if (action === 'create') {
      // The id is positional and local: it never reaches the API — `applyConfigChanges`
      // sends `op` and `body` — and it exists so the row can be keyed and undone.
      if (create) {
        out.push({ row: create(change.body ?? {}, `staged:${entity}:${index}`), staged: 'added' });
      }
      return;
    }

    const at = out.findIndex((entry) => entry.row.id === change.id);
    if (at === -1) return;

    const { row } = out[at];
    if (action === 'update') {
      out[at] = { row: { ...row, ...(change.body ?? {}) }, staged: out[at].staged ?? 'edited' };
    } else if (action === 'archive') {
      out[at] = { row: { ...row, status: 'archived' }, staged: 'archived' };
    } else if (action === 'restore') {
      out[at] = { row: { ...row, status: 'active' }, staged: 'restored' };
    }
  });

  return out;
}

/**
 * Drop every staged operation touching one row, so a reader can take an edit back.
 *
 * By id for an existing row, and by the positional id {@link projectStaged} minted for a
 * create — which is why that id encodes the op's index rather than anything about the row.
 */
export function unstageRow(ops: ConfigChange[], entity: string, id: string): ConfigChange[] {
  const staged = /^staged:([^:]+):(\d+)$/.exec(id);
  if (staged) {
    const index = Number(staged[2]);
    return ops.filter((_, at) => at !== index);
  }
  return ops.filter((change) => !(change.op.startsWith(`${entity}.`) && change.id === id));
}
