'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import {
  criterionValue, criterionVerdict, mocButtonName, OWN_COPY, periodWords, PROTOTYPE_COPY, type Moc,
} from '@/lib/kpm-analytics';

/** Which leader's MOC the dialog shows. */
export interface MocOpen {
  name: string;
  moc: Moc;
}

/**
 * The MOC column's cell (`.moc-icon`, `KPM_Owner.html:827-829`; `mocCellHtml`, `:3281-3284`): a 26px
 * circle, ✓ on green or ✕ on red, **a button named for its leader** — *"MOC requirements met for {name}"*
 * or *"MOC requirements not yet met for {name}"* — opening the dialog. The glyph is hidden from a screen
 * reader; the name carries the verdict in words.
 *
 * **`unknown` draws *—*, never ✕** (D-moc): an input not uploaded is not a failure. Its button is named
 * with the server's sentence saying which input is missing, and opens the same dialog, where the criteria
 * that could be read still show. A leader the company's rules do not cover (`null`) is a plain *—*.
 */
export function MocCell({ moc, name, onOpen }: { moc: Moc | null; name: string; onOpen: (open: MocOpen) => void }) {
  if (!moc) return <span className="text-md text-muted">—</span>;
  const label = mocButtonName(moc, name);
  return (
    <button
      type="button"
      aria-label={label}
      title={moc.status === 'unknown' ? (moc.missing ?? OWN_COPY.notUploaded) : label}
      onClick={() => onOpen({ name, moc })}
      className={cn(
        'inline-flex h-[26px] w-[26px] items-center justify-center rounded-full text-md font-bold',
        moc.status === 'met' && 'bg-success/[0.12] text-success',
        moc.status === 'not_met' && 'bg-alert/10 text-alert',
        moc.status === 'unknown' && 'bg-muted/10 text-muted',
      )}
    >
      <span aria-hidden="true">{moc.status === 'met' ? '✓' : moc.status === 'not_met' ? '✕' : '—'}</span>
    </button>
  );
}

/**
 * *"{name} — Maintenance of Contract"* (`:1875-1890`, `openMocModal` `:3291-3318`), verbatim: the overall
 * badge, *Requirements met* or *Not yet met*; each criterion's figure over its threshold with *Met* or
 * *Gap*; and the path sentence. Each criterion also names the period it was read over (OD-22), under its
 * label, in the line the prototype gives it.
 *
 * Every figure, threshold and verdict is the server's (D-moc): this draws them and decides nothing. With
 * an input not uploaded the badge gives way to the server's sentence saying which, and that criterion
 * reads *Not uploaded yet* rather than *Gap*.
 *
 * `Modal`, so Escape, the backdrop and *Close* shut it and the focus goes back to the leader's button.
 */
export function MocDialog({ open, onClose }: { open: MocOpen | null; onClose: () => void }) {
  if (!open) return null;
  const { name, moc } = open;
  const unknown = moc.status === 'unknown';
  return (
    <Modal
      open
      title={PROTOTYPE_COPY.mocDialog(name)}
      description={unknown ? (moc.missing ?? OWN_COPY.notUploaded) : undefined}
      onClose={onClose}
      focusDialog
      className="max-w-[440px]"
    >
      {!unknown && (
        // `.cfg-badge.won` / `.lost` (`:286-287`), the badge under the name.
        <span
          className={cn(
            '-mt-2 mb-1 inline-flex rounded-pill px-[9px] py-[3px] text-2xs font-bold uppercase tracking-wide',
            moc.status === 'met' ? 'bg-success/10 text-success' : 'bg-alert/10 text-alert',
          )}
        >
          {moc.status === 'met' ? PROTOTYPE_COPY.requirementsMet : PROTOTYPE_COPY.notYetMet}
        </span>
      )}
      <ul className="mt-2">
        {moc.criteria.map((criterion) => (
          // `.moc-criteria-row` (`:830-836`): the label left, the figures right, a hairline between rows.
          <li
            key={criterion.code}
            className="flex items-start justify-between gap-3 border-b border-hairline py-[9px] text-base last:border-b-0"
          >
            <span className="min-w-0">
              <span className="block font-semibold text-navy">{criterion.label}</span>
              {criterion.period && <span className="block text-xs text-muted">{periodWords(criterion.period)}</span>}
            </span>
            <span className="shrink-0 text-right text-sm text-muted">
              <strong className="font-bold text-navy">{criterionValue(criterion.code, criterion.current)}</strong>
              {' / '}
              {criterionValue(criterion.code, criterion.required)}
              {' — '}
              <span
                className={cn(
                  'font-semibold',
                  criterion.met === true && 'text-success',
                  criterion.met === false && 'text-alert',
                )}
              >
                {criterionVerdict(criterion.met)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {/* `.ratio-equation-note` (`:258`): the path the leader met it by, or what is still needed. */}
      {moc.path && <p className="mt-2.5 text-sm leading-snug text-muted">{moc.path}</p>}
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>{OWN_COPY.close}</Button>
      </div>
    </Modal>
  );
}
