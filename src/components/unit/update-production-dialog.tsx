'use client';

import { useRef, useState } from 'react';
import { Button, ErrorBanner, TextInput } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import {
  dialogGroups, everyRow, inputsOf, OWN_COPY, productionChanges, PROTOTYPE_COPY, regroup, rowName, updateUnitProduction,
  type ProductionCadence, type ProductionInputs, type UnitDashboardView,
} from '@/lib/unit-dashboard';

/**
 * *Update production* (`Overall.html:4679-4701`, `:7508-7555`; OD-137, ADR-0121): the month's and the
 * year's APE achieved for everybody on the roster, typed from the company report and saved together.
 *
 * **Each changed cell is a correction of the month table**, written under the reader's name through the
 * same function the month table's own correction uses, and seen by every screen that reads production.
 * So: prefilled with what the month table holds, blank where it holds nothing; whole rupiah typed, minor
 * units sent; **only the cells that changed are sent**, and an emptied box is left as it was — a leader
 * cannot clear a figure (ADR-0051). The toast counts the rows that changed, not every row (a Fix of
 * `:7554`).
 *
 * **A refusal stays in the dialog with what was typed** — a locked month or a revision somebody else
 * moved (409), a figure out of bounds (422) — and the box it names is marked. A stale revision reads the
 * dashboard again behind the dialog, so the next *Save all* is pinned to the new one; only what was typed
 * here is sent, so nobody else's figure is overwritten by a box nobody touched.
 */
export function UpdateProductionDialog({
  view, onClose, onSaved, onStale,
}: {
  view: UnitDashboardView;
  onClose: () => void;
  /** Saved: how many rows changed, for the toast. */
  onSaved: (updated: number) => void;
  /** The month moved on somewhere else: read the dashboard again for its new revision. */
  onStale: () => void;
}) {
  // What the dialog opened on: its groups, and the figures each box was prefilled with.
  const [opened] = useState(() => ({ groups: dialogGroups(view), rows: everyRow(view) }));
  const [inputs, setInputs] = useState<ProductionInputs>(() => inputsOf(opened.rows));
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  /** The first box, which takes the focus as the dialog opens: the ✕ comes before it in the page. */
  const firstInput = useRef<HTMLElement | null>(null);
  const holdFirst = (cell: HTMLTableCellElement | null) => {
    if (cell) firstInput.current = cell.querySelector('input');
  };

  const type = (membershipId: string, cadence: ProductionCadence, typed: string) =>
    setInputs((current) => ({ ...current, [membershipId]: { ...current[membershipId], [cadence]: regroup(typed) } }));

  /** The box a 422 names (`details.membershipId`, `details.cadence`), marked until the next save. */
  const refused = error?.details && typeof error.details.membershipId === 'string'
    ? { membershipId: error.details.membershipId, cadence: error.details.cadence }
    : null;

  async function save() {
    const rows = productionChanges(opened.rows, inputs);
    if (rows.length === 0) {
      onSaved(0);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await updateUnitProduction({ month: view.production.month, revision: view.production.revision, rows });
      onSaved(result.updated);
    } catch (err) {
      const shown = toDisplayError(err);
      setError(shown);
      // A month that moved, or was locked, while the dialog was open: re-read what is behind it, so the
      // next save carries the new revision and the button takes the lock's state once the dialog closes.
      if (err instanceof ApiRequestError && (shown.code === 'VERSION_CONFLICT' || shown.code === 'UPLOAD_MONTH_LOCKED')) onStale();
    } finally {
      setSaving(false);
    }
  }

  let first = true;
  return (
    <Modal
      open
      title={PROTOTYPE_COPY.updateProduction}
      description={PROTOTYPE_COPY.dialogHint}
      onClose={onClose}
      initialFocus={firstInput}
      className="relative max-w-[560px]"
      footer={(
        // `.bulk-modal-footer` (`:1638`): *Cancel* and *Save all*, at its end — held there as the table scrolls.
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>{PROTOTYPE_COPY.cancel}</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? OWN_COPY.saving : PROTOTYPE_COPY.saveAll}
          </Button>
        </div>
      )}
      eyebrow={(
        // `.bulk-close` (`:4686`): ✕ at the header's end, named *Close*.
        <Button
          variant="icon"
          aria-label={PROTOTYPE_COPY.close}
          onClick={onClose}
          className="absolute right-4 top-4"
        >
          <span aria-hidden="true">✕</span>
        </Button>
      )}
    >
      <div className="-mx-6 max-h-[55vh] overflow-auto border-y border-hairline">
        <table className="relative w-full min-w-[440px] border-collapse text-left">
          <thead>
            <tr>
              {[PROTOTYPE_COPY.dialogName, PROTOTYPE_COPY.dialogMonth, PROTOTYPE_COPY.dialogYear].map((name) => (
                <th
                  key={name}
                  scope="col"
                  className="sticky top-0 z-[1] border-b border-hairline bg-card px-[22px] py-2.5 text-2xs font-bold uppercase tracking-wide text-muted"
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          {opened.groups.map((group) => (
            <tbody key={group.label}>
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={3}
                  className="border-b border-hairline bg-navy/[0.04] px-[22px] py-2 text-left text-sm font-bold text-navy"
                >
                  {group.label}
                </th>
              </tr>
              {group.rows.map(({ row, indent }) => {
                const name = rowName(row);
                const boxes = inputs[row.membershipId];
                return (
                  <tr key={row.membershipId} className="border-b border-hairline">
                    <th scope="row" className="px-[22px] py-2 text-left font-normal">
                      <span className="text-base font-semibold text-navy" style={indent ? { paddingLeft: indent * 18 } : undefined}>
                        {name}
                      </span>
                    </th>
                    {(['monthly', 'ytd'] as const).map((cadence) => {
                      const ref = first ? holdFirst : undefined;
                      first = false;
                      return (
                        <td key={cadence} ref={ref} className="px-[22px] py-2">
                          <TextInput
                            prefix="Rp"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            aria-label={`${cadence === 'monthly' ? PROTOTYPE_COPY.dialogMonth : PROTOTYPE_COPY.dialogYear}, ${name}`}
                            value={boxes?.[cadence] ?? ''}
                            onChange={(e) => type(row.membershipId, cadence, e.target.value)}
                            invalid={refused?.membershipId === row.membershipId && refused.cadence === cadence}
                            className="h-9 w-full"
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>

      {error && <div className="mt-4"><ErrorBanner {...error} /></div>}
    </Modal>
  );
}
